# Staging IPA — install on your iPhone (Phase 3)

Requires **Apple Developer Program** ($99/year) for ad hoc internal distribution or TestFlight. iOS bundle ID: **`com.assetmem.staging`**. Expo project slug **`assetmem-staging`** (see [eas.json](../eas.json)); project ID **`66c0400f-d590-4459-88a7-21ed4367854e`**.

Android sideload (no Play account): [STAGING_DEVICE_TEST.md](./STAGING_DEVICE_TEST.md).

## Prerequisites

- [Expo account](https://expo.dev) and `eas login`
- **`APP_VERSION` in [eas.json](../eas.json) staging** must match `apps/mapp/.env` if you use one (`0.0.1` today)
- `PROXY_BASE_URL` for staging (in `eas.json`)
- **Apple Developer Program** enrolled
- **Firebase (Google Sign-In):** iOS app `com.assetmem.staging` in **homegeek-staging**, `iosClientId` in [firebase-config.ts](../../common/src/firebase/firebase-config.ts), `GOOGLE_IOS_CLIENT_ID_BY_ENV` in [app.config.js](../app.config.js) — see [GOOGLE_SIGN_IN.md](./GOOGLE_SIGN_IN.md)
- **Firebase (Sign in with Apple):** enable **Apple** provider in Authentication for staging and prod; enable Sign in with Apple capability on App IDs `com.assetmem.dev`, `.staging`, `.app` in Apple Developer portal — see [SIGN_IN_WITH_APPLE.md](./SIGN_IN_WITH_APPLE.md)
- Email/password works without OAuth setup

## Build

```bash
cd apps/mapp
eas build --platform ios --profile staging --non-interactive
```

Or GitHub Actions → **Deploy Mapp - EAS Build** → environment **staging**, platform **ios**.

First build prompts EAS to create distribution certificate and provisioning profile for `com.assetmem.staging`.

## Install on device

### Option A — Ad hoc (fastest)

1. Register iPhone UDID: [expo.dev](https://expo.dev) → project **assetmem-staging** → Credentials → iOS.
2. Rebuild if the device was added after the last build.
3. Open the build page → install via QR code or link on the device.

### Option B — TestFlight internal

After App Store Connect app exists (production bundle `com.assetmem.app`), you can submit a staging or prod IPA to TestFlight and add internal testers.

App name on home screen: **AssetMem AI (staging)**. Can coexist with a future production install (`com.assetmem.app`).

## Sign-off checklist

- [ ] App launches (standalone EAS build, not Expo Go)
- [ ] Sign in — email/password
- [ ] **Google Sign-In** (after Firebase iOS OAuth)
- [ ] **Sign in with Apple** on physical iPhone (not Simulator for full flow)
- [ ] Create property → chat (SSE stream)
- [ ] Camera / photo picker (checkpoint or upload)
- [ ] Location prompt in chat settings (`expo-location`)
- [ ] Document upload / analysis (smoke)
- [ ] Billing handoff opens web (`PlanBillingSettings` → `WEB_APP_URL`)
- [ ] Settings → Privacy Policy / Terms open in browser
- [ ] No blocking crash on cold start

## Fixes

| Change type | Action |
|-------------|--------|
| JS only | `eas update --channel staging --message "…"` |
| Native / config (Apple capability, permissions, bundle ID) | New `eas build --profile staging` |

After sign-off → Apple Developer + App Store Connect + prod TestFlight (see iOS launch plan).
