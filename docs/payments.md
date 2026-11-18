# Only Tools Plus and donations

Payments go through **monobank internet acquiring (plata by mono)** to the owner's FOP account.
Code: `apps/billing` (Lambda), `apps/landing/public/plus/` (pricing, my subscription, donations),
`apps/admin/src/Billing.tsx` (admin tab), `infra/main/billing.tf`.

## What a user gets

| | Free | Plus |
|---|---|---|
| FoodLog AI label scans | 3 a day | 50 a day |
| FoodLog diary history | 90 days | kept forever |
| CarLog cars | 2 | unlimited |
| CarLog receipt scans | 5 a month | 100 a month |

The numbers live in `apps/billing/limits.json` and are published to SSM `/onlytools/plans/limits`
(String, JSON) on `terraform apply`. Prices are in `apps/billing/src/plans.ts` (minor units):

| | Ukraine (UAH) | Everyone else (USD) |
|---|---|---|
| Monthly | 99 UAH | $2.99 |
| Yearly | 790 UAH | $24 |
| Founding lifetime (first 100 buyers) | 1990 UAH | $49 |
| Donation range | 20 to 50 000 UAH | $1 to $1000 |

The page picks hryvnia when the browser's time zone is Kyiv or the site language is Ukrainian, dollars
otherwise; the visitor can switch, and the choice is remembered in the browser. A subscription renews
in the currency it was bought in. USD invoices use `ccy: 840`; the test token accepts them, production
needs monobank to enable USD for the terminal (and decide where the dollars settle).

## How it works

- **Entitlement = Cognito group `plus`.** Billing adds it when a payment succeeds and removes it when
  Plus runs out. Apps check `cognito:groups` in the token they already verify; nothing else to call.
- **Checkout**: `POST /api/billing/checkout {plan}` creates a monobank invoice. Monthly and yearly
  invoices carry `saveCardData {saveCard: true, walletId: <user sub>}` so the card is tokenized.
- **Webhook**: `POST /api/billing/webhook` (public route). The `X-Sign` header is verified
  (ECDSA/SHA-256 over the raw body with the key from `GET /api/merchant/pubkey`, cached, re-fetched once
  on failure). Orders are keyed by our `reference`; stale webhooks are ignored by `modifiedDate`; a paid
  order is applied exactly once (conditional write); the amount must match the order.
- **Renewals**: our own daily job (07:00 Kyiv, EventBridge Scheduler → `onlytools-billing-daily`)
  charges the saved card with `POST /api/merchant/wallet/payment` (`initiationKind: merchant`). A
  failed charge marks the subscription `past_due`, retries after 1, 2 and 3 days, and Plus stays on for
  7 days of grace. After that, or at the end of a canceled period, the job removes the `plus` group and
  deletes the card token at monobank.
  monobank also has a native "regular payments" API (`/api/merchant/subscription/*`), but its webhook
  payload is not documented, so we keep our own scheduler. Both need the same switch from monobank.
- **Cancel / resume / remove card** on `/plus/`: cancel stops renewals and keeps Plus until the period
  ends; removing the card deletes the token at monobank.
- **Donations**: `POST /api/billing/donate {amount, donor?, note?}`, no sign-in, 20 to 50 000 UAH,
  a plain invoice without card saving.
- **Admin**: the "Plus & donations" tab shows subscribers, MRR, revenue by month and recent payments.

Data: DynamoDB `onlytools-billing` (on-demand, PITR, deletion protection). Orders expire after 90 days
(TTL); the `LEDGER` partition keeps every successful payment.

## Going live (owner steps)

1. In the monobank business cabinet (web.monobank.ua) ask support to **enable card tokenization
   (`saveCardData`) for internet acquiring**. Without it monthly and yearly cannot renew.
2. Store the token (the test token from api.monobank.ua first; it accepts any Luhn-valid card number
   and never moves money):

   ```bash
   aws ssm put-parameter --name /onlytools/payments/mono-token --type SecureString --value '<token>' --overwrite --profile yevhenii
   ```

   The Lambda reads it on a cold start; after changing it, run
   `aws lambda update-function-configuration --function-name onlytools-billing --description "token $(date +%s)" --profile yevhenii`
   (and the same for `onlytools-billing-daily`) to force new instances.
3. Deploy: `pnpm -r build && terraform -chdir=infra/main apply`, then `scripts/deploy-web.sh`.
4. Make the public offer (`/terms/`) and refund policy (`/refunds/`) mention recurring charges,
   the price, how to cancel, and the FOP details. monobank checks these before switching on production.
5. Test with the test token end to end, then swap in the production token.

Until step 2 is done, checkout and donations answer 503 "Payments are not set up yet".

## Apps: enforcing the free limits

Each app reads `/onlytools/plans/limits` once per cold start and picks `plus` or `free` by the
`plus` group in the caller's token. Counters stay in the app's own table (e.g. a
`USAGE#<sub>#<yyyy-mm-dd>` item with an atomic `ADD`). Free history retention is enforced by the
app's TTL (FoodLog: `ttl = date + historyDays`; Plus entries get no TTL, and when Plus ends the
app re-applies TTL on its next write).

## Local

`pnpm --filter @onlytools/billing test` runs the billing tests with a fake monobank.
`pnpm --filter @onlytools/billing dev` serves the landing, `/plus/` and (after
`pnpm --filter @onlytools/admin build`) `/admin/` on http://localhost:5187 with an in-memory store
and a fake payment page.
