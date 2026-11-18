# OnlyTools Core — design

Status: draft for review, 2026-11-18.

## 1. Goal

`core` is the platform repository for the OnlyTools family of small personal tools under
`onlytools.click`. It owns three things that every app shares:

1. **Landing** at `https://onlytools.click` — a list of apps, each linking to its subdomain.
2. **Identity** — one Cognito user pool (OnlyTools SSO) with email/password and Google sign-in,
   and a role model that restricts what each user can open.
3. **Admin panel** at `https://onlytools.click/admin` — the single place to manage users, their
   roles in every app, and every app's settings. Per-app admin panels move here.

Apps in scope: CarLog (`carlog.`), GigHunter (`gighunter.`, invite-only), FoodLog (`foodlog.`).
SalaryCalculator is out of scope. No billing yet; subscriptions later only add roles.

Non-goals now: payments, changing what any app does, moving CarLog off CDK.

## 2. Repositories and folders

```
~/Work/OnlyTools/
  core/        this repo (GitHub: EvgenKrava/<to be created by owner>)
  CarLog/      EvgenKrava/car-log
  gighunter/   EvgenKrava/gighunter
  FoodLog/     remote to be created by owner
```

Each app stays its own repository. `core` publishes the values apps need (pool id, issuer,
client ids) as SSM parameters, so apps never hard-code another repo's resources.

## 3. Identity

### 3.1 User pool

- One pool `onlytools`, region `us-east-1`, account profile `yevhenii`, Terraform in `core/infra`.
- Tier **Essentials**: managed login pages with branding; free for the first 10,000 MAU.
- Sign-in: email (username = email) + Google. Google federated users are linked to an existing
  email/password user with the same verified email (pre-sign-up trigger), so one person = one `sub`.
- Managed login on the custom domain **`auth.onlytools.click`** (ACM cert in us-east-1). Cognito
  requires the parent domain to resolve, so the landing's apex A record must exist first.
- One app client per app: `core`, `carlog`, `gighunter`, `foodlog`. Public clients (no secret),
  authorization code + PKCE, scopes `openid email profile`, callback/logout URLs per subdomain plus
  `http://localhost:<port>` for local dev.

### 3.2 SSO behaviour

All clients use the same hosted domain, so its session cookie is shared: signing in on one app
lets the others redirect back immediately without a password. Signing out of one app calls the
Cognito `/logout` endpoint, which ends the shared session; other apps keep their tokens until they
expire (access/ID token lifetime 1 h, refresh 30 days).

### 3.3 Roles

Roles are **Cognito groups**. They appear in the ID and access tokens as `cognito:groups` with no
extra Lambda, and the admin panel and a future billing webhook can add or remove them through the
Cognito admin API.

| Group | Meaning |
|---|---|
| `platform-admin` | Opens the core admin panel; manages all users, roles and app settings. |
| `<app>-user` | May use the app (`carlog-user`, `gighunter-user`, `foodlog-user`). |
| `<app>-admin` | App-level moderation inside the app itself where it needs it (e.g. FoodLog catalog approval). |

Rules:

- A signed-in user without `<app>-user` gets the app's "no access" screen and 403 from its API.
  Each API checks the group in its handler (HTTP API JWT authorizers only validate the token and
  audience).
- **Default grants** at sign-up, from a post-confirmation trigger: `carlog-user`, `foodlog-user`.
  GigHunter is invite-only: nobody gets `gighunter-user` by default; an admin grants it.
- Restricting a user = removing a group (one app) or disabling the user in Cognito (everything).
- Group changes reach a user's tokens on the next refresh (within 1 h); the admin panel can also
  call `AdminUserGlobalSignOut` to force it.
- Later, subscriptions add/remove `<app>-user` (or a tier group such as `foodlog-pro`) from a
  billing webhook. If expiring grants or many tiers appear, introduce an entitlements table and a
  pre-token-generation trigger then; not now.

## 4. Landing (`onlytools.click`)

Visual style: the shared OnlyTools look, variant B "Конструктор" (warm palette, a colour per app,
large rounded tiles, mobile-first with a bottom tab bar). Landing, login branding and admin use the
shared stylesheet/components from the "Design shared Only Tools look" work, not a separate style.

- Static page: app cards (name, one-line description, icon, link to subdomain), a "Sign in"
  button, and when signed in, the user's apps marked as available or "no access".
- Hosted as S3 + CloudFront (OAC), Route53 A/AAAA for `onlytools.click` and `www` (redirects to apex).
- The app list lives in one config file in `core` so adding an app is one entry.

## 5. Admin panel (`onlytools.click/admin`)

Requires `platform-admin`. Replaces CarLog's `/admin/users`, `/admin/ai-settings`, `/admin/metrics`.

- **Users**: search/list, see groups, enable/disable, grant/revoke `<app>-user` / `<app>-admin` /
  `platform-admin` (cannot remove own `platform-admin`), force sign-out, send invite (creates the
  user with `AdminCreateUser` and grants the app group — used for GigHunter invites).
- **App settings**: each app's settings are SSM parameters under `/onlytools/<app>/…`
  (secrets as SecureString, e.g. CarLog's Anthropic key moves from `/carlog/anthropic-api-key`).
  The panel reads a small per-app schema from core config to render the form. Apps read their
  parameters at cold start with a short cache.
- **Metrics**: per-app CloudWatch numbers (requests, errors, Lambda duration), like CarLog's page.

Core API: HTTP API + one Lambda (Node, TypeScript), Cognito JWT authorizer with the `core` client
audience, `platform-admin` checked in the handler. IAM limited to this pool, `/onlytools/*`
parameters and CloudWatch read.

## 6. Repo layout and stack

Matches the existing apps: pnpm + turbo, TypeScript strict, React + Vite + MUI, `react-oidc-context`
(as GigHunter), Zod contracts, Terraform.

```
apps/web         landing + /admin SPA
apps/api         admin API Lambda
packages/ui      @onlytools/ui: shared look (CSS) + React components (see 6.1)
packages/auth    @onlytools/auth: OIDC config, role guard, app switcher (see 6.1)
packages/contracts, packages/domain
infra/bootstrap  state bucket
infra/main       pool, domain, clients, groups, triggers, landing hosting, API, SSM outputs
```

Published SSM outputs: `/onlytools/auth/user-pool-id`, `/onlytools/auth/issuer`,
`/onlytools/auth/domain`, `/onlytools/auth/clients/<app>`.

### 6.1 Shared UI and auth packages

The apps do not share one UI stack: CarLog is React 18 + MUI, GigHunter is React 19 + Tailwind 4,
FoodLog plans Tailwind + shadcn/ui. So the shared layer is split by how portable it is:

- **`@onlytools/ui`**
  - `only-tools.css`: design tokens as CSS variables (per-app colour, radii, spacing, type) and
    the base classes from the chosen look (variant B "Конструктор"). Framework-agnostic, so MUI
    apps map the variables into their theme and Tailwind apps reference them in `@theme`.
  - Thin React components with `react >=18` as a peer dependency and no MUI/Tailwind dependency:
    app shell (bottom tab bar on phones, side rail on desktop), app switcher (the OnlyTools
    "launcher" listing apps the user has access to), "no access" screen, account menu.
- **`@onlytools/auth`**: the OIDC settings for the shared pool, a `RequireRole` guard
  (`<app>-user`, `<app>-admin`), and helpers to read groups from tokens; plus a tiny server-side
  helper for Lambdas to check `cognito:groups`.

Distribution: published to **GitHub Packages** (npm registry, `@onlytools` scope mapped to
`EvgenKrava`) from a tag-triggered GitHub Action; apps pin versions and upgrade on their own
schedule. Free at this size. Business components stay in each app; only things every app needs go
here.

## 7. Data retention and running cost

Standing rule: keep the bill near zero. Everything is serverless and pay-per-use, and data that
nobody pays for does not live forever.

- **Every DynamoDB table has TTL on `ttl`**, and every item that is history (logs, runs, matches,
  chats, notifications, imports) is written with an expiry. Uploaded files use S3 lifecycle rules.
- **Defaults per app** (free users):

| App | Data | Kept for |
|---|---|---|
| GigHunter | matches (incl. notified posts), chats | 30 days (was 60) |
| GigHunter | poller runs | 30 days |
| CarLog | chat sessions, imports, scans | as today (7 days / 1 day) |
| FoodLog | diary entries, weight log | 12 months |
| All | user profile/settings | while the account is active |

- **Inactive free accounts**: a daily core job finds users with no sign-in for 12 months and no
  paid role, emails a warning, and 30 days later deletes the user and calls each app's
  `DELETE /internal/users/{sub}` (or the app's own TTL takes care of it). Paid roles (later) lift
  the history limits: the app writes a longer or no `ttl` for subscribers.
- Retention periods are app settings in SSM (`/onlytools/<app>/retention/*`), editable in the admin
  panel; changing them affects new writes only.
- No PITR, no provisioned capacity, log groups kept 14 days, AWS Budgets alert at $20/month.

## 8. Migration order

1. **Core infra + landing** — pool, `auth.onlytools.click`, landing at apex. Nothing existing changes.
2. **Admin panel** — users and roles first, then settings and metrics.
3. **FoodLog** — built against the shared pool from the start (its own Cognito module is dropped
   from its plan). `admin` group becomes `foodlog-admin`.
4. **GigHunter** — switch web + API authorizer to the `gighunter` client; drop its pool and
   pre-sign-up allowlist (invite = `gighunter-user`). Remap its DynamoDB items from the old `sub`
   to the new one by email (one user). Delete the old pool after verification.
5. **CarLog** — still CDK. First set the pool's removal policy to RETAIN and deploy; then read pool
   id/client from the core SSM parameters, switch Amplify config, check `carlog-user` in the API,
   remap data by email (≈5 users; they sign in with Google once more), remove CarLog's admin pages
   once core has parity. Delete the old pool after verification.

## 9. Cost

Cognito Essentials within the 10,000 MAU free tier: $0. ACM: $0. S3 + CloudFront for the landing
and admin: cents per month. Lambda/HTTP API: within free tier at this traffic. SSM standard
parameters: $0. Route53 zone already exists. Expected total: under $1/month.

## 10. Open points

- GitHub remotes for `core` and `FoodLog` (owner creates them).
- Reuse the existing Google OAuth client (add `https://auth.onlytools.click/oauth2/idpresponse` as a
  redirect URI) or create a new "OnlyTools" one — the consent screen shows its name.
