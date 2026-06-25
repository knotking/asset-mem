# Account deletion — App Store & Play Store

Tier-1 compliance: in-app deletion, accurate copy, public help URL, privacy policy alignment.

## In-app deletion

| Platform | Path |
| -------- | ---- |
| **iOS / Android (mapp)** | Settings → **Delete account** |
| **Web** | Settings → **Account** → **Delete account** |

Implementation: Firebase Auth `deleteUser()` (removes sign-in immediately). Property data may remain; users can email support for full erasure. Full delete architecture: [docs/operations/DELETION_PLAN.md](../../../docs/operations/DELETION_PLAN.md).

## Public URL (Play Console Data safety)

Use this as the **account deletion** link in Google Play Console:

```
https://asset-mem.com/account-deletion
```

Staging/local: same path on your deployed web origin if testing.

## Apple App Review notes (suggested)

- Account deletion: Settings → Delete account.
- Sign in with Apple + Google + email on iOS.
- Subscriptions: on **Android**, managed on web via Stripe (Plan & billing). On **iOS**, not sold in-app — screen is **Plan & usage**; see [APP_STORE_BILLING_IOS.md](./APP_STORE_BILLING_IOS.md). Cancel any external subscription before deleting account.

## Copy source of truth

| App | File |
| --- | ---- |
| **mapp** | [apps/common/src/lib/account-deletion.ts](../../common/src/lib/account-deletion.ts) |
| **webapp** | [apps/webapp/src/lib/account-deletion.ts](../../webapp/src/lib/account-deletion.ts) (local; no `@homeapp/common`) |

Keep both files in sync when changing strings.

Web help page: [apps/webapp/src/app/account-deletion/page.tsx](../../webapp/src/app/account-deletion/page.tsx) — public `/account-deletion` URL; subscription copy avoids mobile billing handoff (iOS App Store 3.1.1).

Privacy policy: [apps/webapp/src/app/privacy/page.tsx](../../webapp/src/app/privacy/page.tsx)

## Support email

Production default: `support@buildgeek.ai` (code fallback and `NEXT_PUBLIC_SUPPORT_EMAIL` / `EXPO_PUBLIC_SUPPORT_EMAIL` when unset). Override via Firebase Remote Config `support_email` or build env vars.
