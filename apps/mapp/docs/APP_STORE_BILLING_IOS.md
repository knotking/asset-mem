# App Store billing (StoreKit / Guideline 3.1.1)

Native **iOS** builds sell Plus/Pro via **Apple In-App Purchase** (StoreKit). Android and web keep Stripe billing.

## Architecture

1. User subscribes in **Settings → Plan & billing** (`PlanBillingSettings.tsx`).
2. `react-native-iap` runs the StoreKit purchase with `appAccountToken` (UUID derived from Firebase UID).
3. Mapp calls proxy `POST /billing/ios/verify-transaction` with the transaction id.
4. Proxy validates with **App Store Server API** and writes `users/{uid}/billing/summary` (same doc Stripe uses).
5. **App Store Server Notifications V2** (`POST /apple/app-store-notifications`) keeps renewals/cancellations in sync.

Entitlements (`monthlyTokenLimit`, etc.) are enforced by the existing proxy quota layer.

## Code

| File | Role |
| ---- | ---- |
| [ios-iap-products.ts](../lib/ios-iap-products.ts) | Product IDs, legal URLs, `appAccountToken` helper |
| [ios-iap.ts](../lib/ios-iap.ts) | StoreKit connection, purchase, restore |
| [billing-api.ts](../lib/billing-api.ts) | Proxy verify / restore API calls |
| [hooks/useIosSubscriptions.ts](../hooks/useIosSubscriptions.ts) | React hook for billing UI |
| [ios-billing-compliance.ts](../lib/ios-billing-compliance.ts) | Platform guards (IAP vs Stripe subscriber vs reader-only fallback) |
| [PlanBillingSettings.tsx](../components/settings/PlanBillingSettings.tsx) | Subscribe, restore, manage subscription UI |

Backend: `gcp/proxy/api/services/apple_billing_service.py`, routers `apple_billing.py` + `apple_webhook.py`.

## App Store Connect setup (required before sandbox testing)

1. **Subscription group** — e.g. `assetmem_plus_pro`
2. **Products** (auto-renewable):
   - Plus: `com.assetmem.app.plus.monthly`
   - Pro: `com.assetmem.app.pro.monthly`
3. **Localization** — display name, description (see product table below)
4. **Subscription review screenshot** — see next section
5. **Sandbox testers** — App Store Connect → Users and Access → Sandbox
6. **App Store Server Notifications V2** — Production URL:
   `https://<proxy-host>/apple/app-store-notifications`
   Use staging proxy first; set `APPLE_APP_STORE_ENVIRONMENT=Sandbox` until production cutover.
7. **App Store Connect API key** (.p8) — store in GitHub secrets for proxy deploy:
   - `APPLE_APP_STORE_KEY_ID`
   - `APPLE_APP_STORE_ISSUER_ID`
   - `APPLE_APP_STORE_PRIVATE_KEY` (base64 PEM)
   - `APPLE_BUNDLE_ID` (`com.assetmem.app` prod)
   - `APPLE_APP_STORE_ENVIRONMENT` (`Sandbox` or `Production`)

Plan limits map via `appleProductId` in `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` (see `gcp/common/billing_plans.py`).

### Subscription product fields (prod app)

| Tier | Reference name | Product ID | Duration |
| ---- | -------------- | ---------- | -------- |
| Plus | AssetMem Plus Monthly | `com.assetmem.app.plus.monthly` | 1 month |
| Pro | AssetMem Pro Monthly | `com.assetmem.app.pro.monthly` | 1 month |

Set **Pro above Plus** in the subscription group for upgrade/downgrade ordering. Price tiers: ~$19.99 (Plus), ~$39.99 (Pro) USD.

### Subscription review screenshot

Apple requires one screenshot **per subscription** under **Review Information**. It is for reviewers only (not shown on the App Store listing).

**When:** After products exist in App Store Connect and you have a **native EAS iOS build** with StoreKit prices loading (sandbox Apple ID on device).

**What to capture:** iPhone screenshot of **Settings → Plan & billing** showing:

- Plan cards with **localized StoreKit prices** (not hardcoded web prices)
- **Subscribe to Plus** / **Subscribe to Pro** buttons
- **Restore purchases**
- **Terms of Use** and **Privacy Policy** links

Upload the same screenshot for both Plus and Pro if the screen shows both, or crop per product if Apple asks for product-specific views.

## Cross-platform rules

| User state | iOS behavior |
| ---------- | ------------ |
| Free | Offer Apple IAP (Plus / Pro) |
| Active **Apple** subscriber | Manage via Apple Subscriptions settings |
| Active **Stripe** (web) subscriber | Show plan + usage only; no IAP purchase (409 from proxy if attempted) |
| IAP not configured (dev build) | Falls back to reader-only “Plan & usage” (no purchase UI) |

## EAS build

`react-native-iap` requires a **native iOS build** (not Expo Go). In Expo Go, IAP is disabled automatically (`Constants.appOwnership === 'expo'`) — Plan & billing falls back to read-only **Plan & usage** and will not call StoreKit. Use an EAS **development** or **production** build to test purchases.

Override product IDs per profile with `IOS_IAP_PRODUCT_PLUS` / `IOS_IAP_PRODUCT_PRO` in `eas.json` env if needed.

## App Review notes (suggested)

> Plus and Pro subscriptions are sold via Apple In-App Purchase. Settings → Plan & billing includes Subscribe, Restore Purchases, and Manage Subscription (opens Apple Subscriptions). Sandbox tester: `<email>` / password `<password>`.

Steps for reviewer:

1. Sign in with provided sandbox Apple ID on device (Settings → App Store → Sandbox Account).
2. Open app → Settings → Plan & billing.
3. Tap **Subscribe to Plus** (or Pro) and complete sandbox purchase.
4. Confirm plan and usage limits update on the same screen.

## Local proxy testing

Set in `gcp/proxy/.env`:

```bash
APPLE_APP_STORE_KEY_ID=...
APPLE_APP_STORE_ISSUER_ID=...
APPLE_APP_STORE_PRIVATE_KEY=...   # or base64 of .p8 PEM
APPLE_BUNDLE_ID=com.assetmem.staging
APPLE_APP_STORE_ENVIRONMENT=Sandbox
```

Ensure `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` includes `appleProductId` for plus/pro tiers.
