# Staging APK — install on your phone (Phase 3)

No Google Play Developer account required. Android package: **`com.assetmem.staging`**. Expo project slug on [expo.dev](https://expo.dev) is **`assetmem-staging`** (must match `APP_SLUG` in [eas.json](../eas.json)); project ID **`66c0400f-d590-4459-88a7-21ed4367854e`**.

## Prerequisites

- [Expo account](https://expo.dev) and `eas login`
- **`APP_VERSION` in [eas.json](../eas.json) staging** must match any `APP_VERSION` in local `apps/mapp/.env` (both use `0.0.1`). A mismatch breaks the **Configure expo-updates** step (`runtimeVersion` policy is `appVersion`).
- `EXPO_TOKEN` for CI, or local login for `eas build`
- `PROXY_BASE_URL` for staging (in `eas.json` or local `apps/mapp/.env`)
- **Firebase (for Google Sign-In):** register Android app `com.assetmem.staging` in project **homegeek-staging**, add EAS keystore SHA-1, set `androidClientId` in [firebase-config.ts](../../common/src/firebase/firebase-config.ts) — see [GOOGLE_SIGN_IN.md](./GOOGLE_SIGN_IN.md). Email/password works without this step.

## Build

```bash
cd apps/mapp
eas build --platform android --profile staging --non-interactive
```

Or GitHub Actions → **Deploy Mapp - EAS Build** → environment **staging**, platform **android**.

## Install

1. Open the build on [expo.dev](https://expo.dev) → download **APK**.
2. On Android: enable install from your browser/Files app, open APK.
3. Or USB: `adb install -r path/to.apk`.

## Sign-off checklist

- [ ] App launches (not Expo Go)
- [ ] Sign in (email/password; Google after Firebase OAuth setup)
- [ ] Create property → chat
- [ ] Camera / photo upload
- [ ] Location on property flow
- [ ] No crash on cold start

## Fixes

| Change type | Action |
|-------------|--------|
| JS only | `eas update --channel staging --message "…"` |
| Native / config | New `eas build --profile staging` |

After sign-off, continue with Play Console setup (closed test) in the launch plan.
