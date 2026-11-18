# OnlyTools Core

The shared platform for [onlytools.click](https://onlytools.click), a family of small, simple tools
built for everyday personal use.

Core owns what every app shares:

- **Landing** at `onlytools.click`: the list of apps, each linking to its subdomain.
- **OnlyTools account (SSO)**: one Cognito user pool with email and Google sign-in at
  `auth.onlytools.click`. Sign in once and every app lets you in.
- **Roles**: `platform-admin`, `<app>-user` and `<app>-admin` groups decide who can open what.
  Some apps are open to everyone, some are invite-only; subscriptions will grant roles later.
- **Admin panel** at `onlytools.click/admin`: users, their roles in every app, app settings and
  metrics, in one place.

## Apps

| App | URL | Repo |
|---|---|---|
| CarLog: a digital service book for your cars | [carlog.onlytools.click](https://carlog.onlytools.click) | [car-log](https://github.com/EvgenKrava/car-log) |
| GigHunter: a freelance gig radar with Telegram alerts (invite-only) | [gighunter.onlytools.click](https://gighunter.onlytools.click) | [gighunter](https://github.com/EvgenKrava/gighunter) |
| FoodLog: a calorie and macro tracker | foodlog.onlytools.click (in progress) | [foodlog](https://github.com/EvgenKrava/foodlog) |

## Status

Design stage. Read the design spec first:
[docs/specs/2026-11-18-onlytools-core-design.md](docs/specs/2026-11-18-onlytools-core-design.md).

## Planned stack

pnpm + Turborepo, TypeScript, React + Vite (landing and admin), AWS Lambda + HTTP API, Cognito,
S3 + CloudFront, SSM Parameter Store for app settings, and Terraform for all infrastructure
(AWS profile `yevhenii`, `us-east-1`).
