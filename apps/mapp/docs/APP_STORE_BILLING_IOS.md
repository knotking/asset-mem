# App Store billing (Guideline 3.1.1)

Native **iOS** builds do not offer in-app purchase or external checkout for Plus/Pro subscriptions. Android and web keep Stripe billing via `PlanBillingSettings` and the web app.

## Rationale

Apple [Guideline 3.1.1](https://developer.apple.com/app-store/review/guidelines/#business) requires digital subscriptions sold in the app to use In-App Purchase unless a storefront-specific exception applies. Until StoreKit products are implemented, iOS uses the **3.1.3(b) reader** model: subscribers who purchased on the web sign in with the same Firebase account and receive entitlements from Firestore `users/{uid}/billing/summary`.

## Code

| File | Behavior on `Platform.OS === 'ios'` |
| ---- | ----------------------------------- |
| [ios-billing-compliance.ts](../lib/ios-billing-compliance.ts) | `isIosAppStoreBillingRestricted()`, `planSettingsScreenTitle()` (`Plan & usage` on iOS) |
| [PlanBillingSettings.tsx](../components/settings/PlanBillingSettings.tsx) | Current plan + usage only; iOS title **Plan & usage**; no prices, upgrade, or Stripe portal buttons |
| [landing.tsx](../app/landing.tsx) | Pricing section hidden |
| [api.ts](../lib/api.ts), [api-reports.ts](../lib/api-reports.ts) | Quota errors omit “upgrade your plan” |
| [AccountDeletionSettings.tsx](../components/settings/AccountDeletionSettings.tsx) | No Stripe / Plan & billing cancel steering |

## App Review notes (suggested)

> Subscriptions are not sold in the iOS app. Settings → Plan & usage shows the signed-in account’s current plan and monthly usage limits only. Users who subscribed on our website can access their plan in the iOS app with the same login (Guideline 3.1.3(b)). There are no links or buttons to purchase or manage subscriptions outside the app.

## Future: In-App Purchase

When adding StoreKit, remove or narrow `isIosAppStoreBillingRestricted()` and wire App Store receipts into the same Firestore billing summary the proxy already enforces.
