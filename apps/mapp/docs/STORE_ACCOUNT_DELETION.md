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
- Subscriptions: managed on web via Stripe (Plan & billing); not StoreKit. User should cancel before deleting account.

## Copy source of truth

| App | File |
| --- | ---- |
| **mapp** | [apps/common/src/lib/account-deletion.ts](../../common/src/lib/account-deletion.ts) |
| **webapp** | [apps/webapp/src/lib/account-deletion.ts](../../webapp/src/lib/account-deletion.ts) (local; no `@homeapp/common`) |

Keep both files in sync when changing strings.

Web help page: [apps/webapp/src/app/account-deletion/page.tsx](../../webapp/src/app/account-deletion/page.tsx)

Privacy policy: [apps/webapp/src/app/privacy/page.tsx](../../webapp/src/app/privacy/page.tsx)

## Support email

Production: `hello@asset-mem.com` (`NEXT_PUBLIC_SUPPORT_EMAIL` in [apphosting.prod.yaml](../../webapp/apphosting.prod.yaml), `extra.supportEmail` in mapp [app.config.js](../app.config.js)).
