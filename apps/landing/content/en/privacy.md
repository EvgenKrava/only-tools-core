---
title: Privacy policy | Only Tools
description: What personal data Only Tools apps collect, why, where it is stored and how to delete it.
kind: legal
---
# Privacy policy

Effective date: 18 November 2026.

This policy explains how {{fop_name}}, individual entrepreneur, tax ID {{tax_id}} ("we"), handles personal data in the Only Tools apps at onlytools.click: CarLog, FoodLog, GigHunter and MoneyLog. We follow the Law of Ukraine "On Personal Data Protection" and, for users in the EU, the GDPR.

## What we collect

- **Account:** email address, name if you give it, and the sign-in method (password or Google). Passwords are stored by Amazon Cognito as salted hashes; we never see them.
- **What you enter in the apps:** cars, service records, reminders, receipts and photos in CarLog; food entries, products, dishes, targets, height, weight and age in FoodLog; your profile, settings, Telegram bot token and Claude API key in GigHunter; your monobank personal token (stored encrypted with AWS KMS), accounts, transactions, categories, rules and budgets in MoneyLog.
- **Technical data:** server logs with IP address, browser type and errors, kept for up to 30 days to keep the service secure and working.
- **Payments:** monobank processes card payments for Only Tools Plus and support payments. We receive only the payment status and amount, never card details. For subscriptions monobank keeps a card token so it can renew; you can remove it on the Plus page.

## Why we use it

- to provide the apps and keep your data in sync between devices;
- to send the reminders and notifications you turn on;
- to run the AI features you use;
- to answer your requests and handle payments and refunds;
- to protect the service from abuse.

We do not sell personal data and do not use it for advertising.

## Who processes it for us

- **Amazon Web Services** (region us-east-1, USA): hosting, database, file storage, sign-in.
- **AI providers:** when you scan an invoice or chat in CarLog, the text or image is sent to Claude models through Amazon Bedrock or Anthropic. In GigHunter, job descriptions and your profile are sent to Anthropic with your own API key. These providers do not use the data to train models.
- **Telegram:** GigHunter sends job alerts through the bot you connect.
- **monobank personal API:** MoneyLog uses the personal token you connect to read your accounts and statement. It cannot make payments.
- **Open Food Facts:** FoodLog sends only the barcode you scan to look up a product.
- **monobank (JSC "Universal Bank"):** card payments, if you buy a paid plan.
- **Google:** only if you choose to sign in with Google.

## Cookies and local storage

We use only what the apps need to work: sign-in tokens in your browser's storage and the `ot_lang` cookie that remembers your language. No advertising or tracking cookies.

## How long we keep it

Your data stays until you delete it or your account. GigHunter deletes found jobs after 30 days. After you delete your account, the data is erased from the live database right away and from backups within 35 days.

## Your rights

You can see, correct, get a copy of and delete your data, withdraw consent and object to processing. Most of this is available in the apps (each app has account deletion); for anything else write to {{email}}. You can also complain to the Ukrainian Parliament Commissioner for Human Rights or to your local data protection authority.

## Children

The apps are not intended for children under 16.

## Changes

We will publish any change on this page and, for significant changes, notify you by email.

## Contact

{{fop_name}}, {{address}}. Email: {{email}}. Phone: {{phone}}.
