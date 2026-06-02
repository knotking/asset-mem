# Mobile app update policy (OTA + native)

The mapp client reads **`config/mobileApp`** in Firestore (world-readable). Each environment key (`prod`, `staging`, `dev`) holds policy fields.

## Firestore shape

Document: `config/mobileApp`

```json
{
  "prod": {
    "minimumNativeVersion": "1.0.0",
    "forceOta": false,
    "iosStoreUrl": "https://apps.apple.com/app/id6774020500",
    "androidStoreUrl": "https://play.google.com/store/apps/details?id=com.assetmem.app",
    "message": "Optional custom copy for the blocker screen."
  },
  "staging": {
    "minimumNativeVersion": "0.0.1",
    "forceOta": false
  }
}
```

| Field | Effect |
|-------|--------|
| `minimumNativeVersion` | If installed **native** version is lower, full-screen **force native** blocker → Open app store |
| `forceOta` | When an OTA is available: download in background, then **force OTA** blocker (no dismiss) until Restart |
| `iosStoreUrl` / `androidStoreUrl` | Override defaults from [app.config.js](../app.config.js) `extra` |
| `message` | Optional body text on the native blocker |

**Native version** = App Store / Play version (`Constants.nativeAppVersion`).  
**OTA** = same `runtimeVersion` / `APP_VERSION` channel only.

## Behavior

- **`forceOta: false`** (default): optional “Update ready” alert with Later / Restart after download.
- **`forceOta: true`**: blocking screen while downloading, then Restart only.
- **Native below minimum**: blocking screen until user opens the store (no in-app bypass in production).

Deploy Firestore rules after changing [firestore.rules](../../webapp/firestore.rules).

## Settings UI (all release builds)

| UI | When |
|----|------|
| **Version** `x.y.z` | Always visible at bottom of Settings |
| **OTA** `xxxxxxxx · tap to copy` | After **5 quick taps** on Version |
| Developer simulate tools | Same gesture, **`__DEV__` only** (`npm run dev`) |

The OTA line shows the running bundle’s `Updates.updateId` (staging and prod builds alike). If no OTA has been applied yet, it shows **OTA —**.

**Privacy / UX:** OTA details **hide** when the app goes to background/inactive or is fully closed. Users must tap Version 5× again to reveal them.

## Dev mocks

In `__DEV__`, when no real `updateId` exists, the UI shows a mock prefix `00000000` for copy/testing. Simulate actions: OTA prompt, force OTA, force OTA downloading, force native.

## Ops checklist

1. Publish OTA to the correct channel (`staging` / `prod`).
2. For mandatory JS fix: set `forceOta: true` on that env in Firestore (revert after adoption).
3. For breaking native/API changes: bump `minimumNativeVersion` and ship a new EAS **build** to the stores.
4. Deploy Firestore rules (`config/mobileApp` public read) before relying on policy in production.
5. Confirm adoption: Settings → Version 5× → compare OTA prefix with Expo dashboard update ID.

See also [DEPLOY.md](./DEPLOY.md) (in-app OTA UX and channels).
