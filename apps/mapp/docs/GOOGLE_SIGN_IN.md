# Google Sign-In (mapp)

Mobile Google sign-in uses **`@react-native-google-signin/google-signin`** (native SDK) and Firebase Auth (`signInWithCredential`). The web app uses `signInWithPopup` and only needs a **web** OAuth client.

## Overview

| Client ID | Google Cloud type | Used in code | Purpose |
| --------- | ----------------- | ------------ | ------- |
| `webClientId` | Web | `GoogleSignin.configure({ webClientId })` | ID token for Firebase; required on iOS and Android |
| `iosClientId` | iOS | `GoogleSignin.configure({ iosClientId })` | Native iOS sign-in only |
| `androidClientId` | Android | *(not passed to SDK)* | Documents the Android OAuth client in Firebase; Google verifies app via **package + SHA-1** |

**Do not** reuse `webClientId` as `iosClientId`. `androidClientId` in `firebase-config.ts` must match the Android OAuth client registered for your package in Firebase.

### Code locations

| File | Role |
| ---- | ---- |
| [apps/common/src/firebase/firebase-config.ts](../../common/src/firebase/firebase-config.ts) | Per-environment `webClientId`, `iosClientId`, `androidClientId` |
| [apps/mapp/components/auth/GoogleSignInButton.tsx](../components/auth/GoogleSignInButton.tsx) | `GoogleSignin.signIn()` → Firebase `signInWithCredential` |
| [apps/mapp/app.config.js](../app.config.js) | Expo config plugin + `iosUrlScheme` for Google Sign-In |
| [apps/mapp/app/auth/login.tsx](../app/auth/login.tsx) | Login screen |
| [apps/mapp/app/auth/signup.tsx](../app/auth/signup.tsx) | Sign-up screen |

Environment selection follows `expo.extra.appEnv` (`dev` \| `staging` \| `prod`) from [app.config.js](../app.config.js).

### App identifiers (must match Firebase)

| Platform | Config key | Staging / local | Production |
| -------- | ---------- | --------------- | ------------ |
| iOS | `ios.bundleIdentifier` | `com.assetmem.staging` | `com.assetmem.app` |
| Android | `android.package` | `com.assetmem.staging` | `com.assetmem.app` |
| Dev | either | `com.assetmem.dev` | — |

Values come from `IOS_BUNDLE_ID` / `ANDROID_PACKAGE` in [eas.json](../eas.json).

OAuth client IDs are defined in [firebase-config.ts](../../common/src/firebase/firebase-config.ts). After changing `iosClientId`, update `GOOGLE_IOS_CLIENT_ID_BY_ENV` in [app.config.js](../app.config.js) (used for the native `iosUrlScheme` at prebuild time).

---

## 1. Firebase / Google Cloud setup

Do this **per Firebase project** (`homegeek-staging` for dev/staging, `homegeek-prod` for production).

### 1.1 Enable Google sign-in in Firebase

1. [Firebase Console](https://console.firebase.google.com) → your project.
2. **Build** → **Authentication** → **Sign-in method**.
3. Enable **Google** and set a support email if prompted.

### 1.2 Web client ID (`webClientId`)

1. **Project settings** → **Your apps** → **Web app**, or Google Cloud → **Credentials** → **Web client**.
2. Copy the client ID → `webClientId` in `firebase-config.ts`.

Passed to `GoogleSignin.configure({ webClientId })` on all platforms.

### 1.3 iOS client ID (`iosClientId`)

1. Firebase → **Add app** → **iOS** with bundle ID matching [app.config.js](../app.config.js) (e.g. `com.assetmem.staging`).
2. Copy the **iOS** OAuth client ID → `iosClientId` in `firebase-config.ts`.
3. Update `GOOGLE_IOS_CLIENT_ID_BY_ENV` in [app.config.js](../app.config.js) for the matching `APP_ENV`, then **prebuild**:

```bash
cd apps/mapp
npx expo prebuild --clean --platform ios
npx expo run:ios
```

The config plugin sets the reversed client ID URL scheme required by the native SDK.

### 1.4 Android (`androidClientId` + SHA-1)

1. Firebase → **Add app** → **Android** with package matching `ANDROID_PACKAGE` (e.g. `com.assetmem.staging`).
2. Add **SHA-1** fingerprints — see [§2](#2-sha-1-fingerprints-android).
3. Copy the **Android** OAuth client ID → `androidClientId` in `firebase-config.ts`.

No custom URI scheme or redirect URI configuration is required for this SDK (unlike browser-based `expo-auth-session`).

### 1.5 OAuth consent screen (app name on the sign-in UI)

Native Google Sign-In shows the **OAuth consent screen app name**, not `expo.name` from [app.config.js](../app.config.js). If the name was never set, Google shows a placeholder like **`project-291418967332`** (project number) instead of **AssetMem AI**.

Configure **per Google Cloud project** (same project as the OAuth client IDs in `firebase-config.ts`):

| `appEnv` | Firebase / GCP project | Project number (example placeholder) |
| -------- | ---------------------- | ------------------------------------ |
| `dev`, `staging` | `homegeek-staging` | `291418967332` |
| `prod` | `homegeek-prod` | `686746113874` |

1. [Google Cloud Console](https://console.cloud.google.com/) → select **`homegeek-staging`** or **`homegeek-prod`**.
2. **APIs & Services** → **OAuth consent screen** (or open `…/apis/credentials/consent?project=homegeek-staging`).
3. **Edit app** → set **App name** to **`AssetMem AI`** (match store branding).
4. Set **User support email**, **Developer contact**, and upload an **App logo** (120×120 recommended).
5. **Save**. No app rebuild required; the next sign-in should show the new name.

For **External** user type and users outside your team, complete verification and **Publish app** when you are ready for production traffic. In **Testing** mode the correct app name still appears; only who can sign in is restricted (see [§4](#oauth-consent-screen-testing-mode)).

### 1.6 Production checklist

- [ ] `webClientId` — prod web OAuth client  
- [ ] `iosClientId` — iOS app with **prod** bundle ID + `app.config.js` iosUrlScheme for `prod`  
- [ ] `androidClientId` — Android app with **prod** package + prod SHA-1(s)  
- [ ] OAuth consent screen **App name** + logo on **`homegeek-prod`** (and **`homegeek-staging`** for dev/staging builds)

---

## 2. SHA-1 fingerprints (Android)

SHA-1 is configured in **Firebase**, not in Expo config.

### 2.1 Local debug builds

```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android
```

Copy **SHA1** → Firebase → Android app → **Add fingerprint**.

### 2.2 EAS / Expo dashboard

```bash
cd apps/mapp
npx eas-cli credentials -p android
```

**expo.dev** → project → **Credentials** → **Android** → **Keystore** → SHA-1.

### 2.3 Google Play

Play Console → **App signing** → add App signing key SHA-1 to Firebase.

---

## 3. Native rebuild required

After adding `@react-native-google-signin/google-signin` or changing `app.config.js` plugins / package name:

```bash
cd apps/mapp
npx expo prebuild --clean
npx expo run:android   # or run:ios
```

EAS builds pick up the config plugin automatically on the next build.

---

## 4. Expo Go vs dev build

| Runtime | Google Sign-In |
| ------- | -------------- |
| **Expo Go** | **Not supported** — button disabled |
| **Dev build** (`npx expo run:android` / `run:ios`) | Supported |
| **EAS build** | Supported |

### OAuth consent screen (Testing mode)

Add test users under Google Cloud → **OAuth consent screen** → **Test users**, or publish the app. Set the **App name** on the consent screen so the native picker does not show `project-<number>` (see [§1.5](#15-oauth-consent-screen-app-name-on-the-sign-in-ui)).

---

## 5. Verify

1. Rebuild native app (see §3).
2. **Login** or **Sign up** → **Continue with Google**.
3. Native account picker → Firebase sign-in → `/(tabs)/home`.

### Troubleshooting

| Symptom | Likely fix |
| ------- | ---------- |
| Sign-in UI shows **`project-291418967332`** (or similar) instead of app name | **OAuth consent screen** → **App name** = `AssetMem AI` on the GCP project for your build (`homegeek-staging` vs `homegeek-prod`) — [§1.5](#15-oauth-consent-screen-app-name-on-the-sign-in-ui) |
| Android `DEVELOPER_ERROR` | Wrong package in Firebase, or missing SHA-1 for the keystore that signed the APK |
| `androidClientId` / config error in app | Set Android OAuth client ID in `firebase-config.ts` |
| Sign-in works on web, not mapp | `webClientId` must be the **Web** client; Android verified via package + SHA-1 |
| Stale package (`com.assetmem.*`) | `npx expo prebuild --clean` so `applicationId` matches `ANDROID_PACKAGE` |
| Expo Go | Use dev build, not Expo Go |
| iOS redirect / scheme errors | Sync `iosClientId` in `firebase-config.ts` and `GOOGLE_IOS_CLIENT_ID_BY_ENV` in `app.config.js`, then prebuild |

---

## 6. Related docs

- [ENV_CONFIG.md](./ENV_CONFIG.md) — proxy URLs, `appEnv`, local `.env`
- [DEPLOY.md](./DEPLOY.md) — EAS builds and credentials
- [Expo: Google authentication](https://docs.expo.dev/guides/google-authentication/)
- [@react-native-google-signin/google-signin](https://react-native-google-signin.github.io/docs/setting-up/expo)
