# Google Sign-In (mapp)

Mobile Google sign-in uses **Expo Auth Session** (`expo-auth-session/providers/google`) and Firebase Auth (`signInWithCredential`). The web app uses `signInWithPopup` and only needs a **web** OAuth client; native iOS and Android each need their **own** OAuth client IDs in addition to `webClientId`.

## Overview

| Client ID | Google Cloud type | Required on | Purpose |
| --------- | ----------------- | ----------- | ------- |
| `webClientId` | Web | iOS, Android, web | Firebase token exchange after OAuth |
| `iosClientId` | iOS | iOS only | Native OAuth flow (`expo-auth-session` on iOS) |
| `androidClientId` | Android | Android only | Native OAuth flow (`expo-auth-session` on Android) |

**Do not** reuse `webClientId` as `iosClientId` or `androidClientId`. Each must be the OAuth client created for that platform in Firebase / Google Cloud.

### Code locations

| File | Role |
| ---- | ---- |
| [apps/common/src/firebase/firebase-config.ts](../../common/src/firebase/firebase-config.ts) | Per-environment `webClientId`, `iosClientId`, `androidClientId` |
| [apps/mapp/components/auth/GoogleSignInButton.tsx](../components/auth/GoogleSignInButton.tsx) | Passes IDs into `Google.useAuthRequest({ ... })` |
| [apps/mapp/app/auth/login.tsx](../app/auth/login.tsx) | Login screen |
| [apps/mapp/app/auth/signup.tsx](../app/auth/signup.tsx) | Sign-up screen |

Environment selection follows `expo.extra.appEnv` (`dev` \| `staging` \| `prod`) from [app.config.js](../app.config.js).

### App identifiers (must match Firebase)

| Platform | Config key | Staging / local | Production |
| -------- | ---------- | --------------- | ------------ |
| iOS | `ios.bundleIdentifier` | `com.assetmem.staging` | `com.assetmem.app` |
| Android | `android.package` | `com.assetmem.staging` | `com.assetmem.app` |
| Dev | either | `com.assetmem.dev` | — |

Values come from `IOS_BUNDLE_ID` / `ANDROID_PACKAGE` in [eas.json](../eas.json). Deep link scheme: **`assetmem`** (`assetmem://`).

**Note:** `APP_SLUG` (e.g. `assetmem-staging`) is only the Expo dashboard URL name and must match your project on [expo.dev](https://expo.dev). It is independent of the Android package (`com.assetmem.staging`).

OAuth client IDs (`webClientId`, `iosClientId`, `androidClientId`) are defined only in [firebase-config.ts](../../common/src/firebase/firebase-config.ts) per environment. Update that file after registering each `com.assetmem.*` app in Firebase.

---

## 1. Firebase / Google Cloud setup

Do this **per Firebase project** (`homegeek-staging` for dev/staging, `homegeek-prod` for production). See [firebase-config.ts](../../common/src/firebase/firebase-config.ts) for `projectId` per env.

### 1.1 Enable Google sign-in in Firebase

1. [Firebase Console](https://console.firebase.google.com) → your project.
2. **Build** → **Authentication** → **Sign-in method**.
3. Enable **Google** and set a support email if prompted.

### 1.2 Web client ID (`webClientId`)

Usually already present if the web app uses Google login.

1. **Project settings** → **Your apps** → **Web app** (or add a web app).
2. Under **SDK setup and configuration**, or in [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**, find the **Web client** OAuth 2.0 client ID.
3. Copy the client ID (`….apps.googleusercontent.com`) → `webClientId` in `firebase-config.ts` for that environment.

This is the same style of ID already stored for staging web: `291418967332-….apps.googleusercontent.com`.

### 1.3 iOS client ID (`iosClientId`)

1. Firebase **Project settings** → **Your apps** → **Add app** → **iOS** (if missing).
2. **iOS bundle ID** must match [app.config.js](../app.config.js) exactly (e.g. `com.assetmem.staging`).
3. Register the app. Firebase creates an **iOS** OAuth client in Google Cloud.
4. Copy the **iOS** OAuth 2.0 client ID (not the web client).
   - From **GoogleService-Info.plist** (`CLIENT_ID`), or  
   - Google Cloud → **Credentials** → client type **iOS**.
5. Set `iosClientId` in `firebase-config.ts` for `dev` / `staging` / `prod` as needed.

**iOS URL scheme (if redirect fails):** Expo may require a custom URL scheme derived from the iOS client ID (reversed form). See [Expo: Google authentication](https://docs.expo.dev/guides/google-authentication/). Scheme in this app: `assetmem` in [app.config.js](../app.config.js).

### 1.4 Android client ID (`androidClientId`)

1. Firebase **Project settings** → **Your apps** → **Add app** → **Android** (if missing).
2. **Android package name** must match `android.package` in [app.config.js](../app.config.js) (e.g. `com.assetmem.staging`).
3. Add **SHA-1 certificate fingerprints** (required for Google Sign-In on device builds). See [§2 SHA-1 fingerprints](#2-sha-1-fingerprints-android).
4. Register the app. Copy the **Android** OAuth 2.0 client ID from Firebase or Google Cloud (**Credentials** → type **Android**).
5. Set `androidClientId` in `firebase-config.ts` for that environment (`dev`, `staging`, or `prod`).

Add **every** SHA-1 you use (debug, EAS build keystore, Play App Signing). Missing SHA-1 often causes `DEVELOPER_ERROR` or sign-in failure on Android.

### 1.5 Production checklist

For `prod` in [firebase-config.ts](../../common/src/firebase/firebase-config.ts):

- [ ] `webClientId` — `homegeek-prod` web OAuth client  
- [ ] `iosClientId` — iOS app registered with **prod** bundle ID  
- [ ] `androidClientId` — Android app registered with **prod** package + prod SHA-1(s)  

---

## 2. SHA-1 fingerprints (Android)

SHA-1 is configured in **Firebase**, not in Expo config. Expo/EAS only helps you **discover** the value.

### 2.1 Local debug builds

```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android
```

Copy the **SHA1** line → Firebase → Android app → **Add fingerprint**.

### 2.2 EAS / Expo dashboard

If `eas` is not installed globally:

```bash
cd apps/mapp
npx eas-cli login
npx eas-cli credentials -p android
```

Or install globally: `npm install -g eas-cli`, then `eas credentials -p android`.

**Expo website:** [expo.dev](https://expo.dev) → your project → **Credentials** → **Android** → select application id → **Keystore** → view **SHA-1** (and SHA-256).

Credentials appear after at least one EAS Android build for that profile. If empty, run e.g. `npx eas-cli build -p android --profile staging` once.

### 2.3 Google Play

For store builds: Play Console → **App signing** → **App signing key certificate** → add that SHA-1 to Firebase as well.

---

## 3. Configure the repo

### 3.1 `firebase-config.ts`

Add or update three fields per environment in [apps/common/src/firebase/firebase-config.ts](../../common/src/firebase/firebase-config.ts):

```ts
interface FirebaseConfigWithClient extends FirebaseOptions {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
}

const firebaseConfigs: Record<Environment, FirebaseConfigWithClient> = {
  dev: {
    // ...apiKey, projectId, etc.
    webClientId: '….apps.googleusercontent.com',
    iosClientId: '….apps.googleusercontent.com',      // iOS OAuth client only
    androidClientId: '….apps.googleusercontent.com',  // Android OAuth client only
  },
  // staging, prod — same shape
};
```

Rebuild `@homeapp/common` after edits:

```bash
cd apps/common && npm run build
```

### 3.2 `GoogleSignInButton.tsx`

Implemented in [GoogleSignInButton.tsx](../components/auth/GoogleSignInButton.tsx):

```ts
Google.useAuthRequest({
  webClientId: firebaseConfig.webClientId,
  iosClientId: firebaseConfig.iosClientId,
  androidClientId: firebaseConfig.androidClientId,
});
```

Without `iosClientId` on iOS you may see:  
`Client Id property 'iosClientId' must be defined to use Google auth on this platform.`

### 3.3 Optional: env-driven IDs

To avoid committing prod secrets, you can later move IDs to `app.config.js` `extra` from `process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` etc. Current pattern matches existing `webClientId` in `firebase-config.ts`.

---

## 4. Expo Go vs simulator / device (important)

Google shows **“doesn't comply with Google's OAuth 2.0 policy”** (or `redirect_uri=exp://…`) when you test in **Expo Go** (`npm run dev` → Expo Go app).

| Runtime | Redirect | Google Sign-In |
| ------- | -------- | -------------- |
| **Expo Go** | `exp://192.168.x.x:8081` | **Not supported** — Google rejects non-HTTPS / `exp://` URIs |
| **Dev build** (`npx expo run:ios` / `run:android`) | `assetmem://` (app scheme) | Supported with correct OAuth clients + bundle ID |
| **EAS build** (TestFlight / internal APK) | `assetmem://` | Supported |

Expo’s own guidance: [Authentication](https://docs.expo.dev/guides/authentication/) — use a **development build**, not Expo Go, for OAuth.

### What to do locally on iOS Simulator

```bash
cd apps/mapp
npx expo run:ios
```

First run installs the native app with scheme `assetmem` (see [app.config.js](../app.config.js)). Open that app (not Expo Go), then try **Continue with Google**.

The in-app button is disabled in Expo Go and shows an error if tapped, pointing here.

### OAuth consent screen (Testing mode)

If the consent screen is **Testing** in Google Cloud → **OAuth consent screen**:

1. Add your Google account under **Test users**.
2. Or publish the app (not required for internal dev).

Missing test users often blocks sign-in with a generic policy error.

### Wrong `iosClientId` (web client used on iOS)

`iosClientId` must be the **iOS** OAuth client from Firebase (iOS app registration), **not** the web client ID. Using the web ID for `iosClientId` triggers policy / invalid-client errors on native iOS.

---

## 5. Verify

1. Rebuild native app (`npx expo run:ios` / `run:android`, or EAS build). OAuth client changes are not hot-reloaded.
2. Open **Login** or **Sign up** → **Continue with Google**.
3. Complete OAuth → should land on `/(tabs)/home`.
4. **Settings → Profile**: Google users should see photo (`photoURL`) and display name when set.

### Troubleshooting

| Symptom | Likely fix |
| ------- | ---------- |
| `iosClientId` must be defined | Set iOS OAuth client in `firebase-config.ts` and pass it in `useAuthRequest` |
| `androidClientId` must be defined | Set Android OAuth client and pass it in `useAuthRequest` |
| Android `DEVELOPER_ERROR` | Add correct SHA-1 for the keystore that signed the APK/AAB |
| Sign-in works on web, not mapp | Confirm platform-specific client IDs, not web-only |
| **OAuth 2.0 policy** / `exp://` redirect | Do **not** use Expo Go; run `npx expo run:ios` and use the dev build; fix `iosClientId` (iOS client, not web) |
| Expo Go quirks | Prefer a **development build** for reliable Google auth testing |
| `eas: command not found` | Use `npx eas-cli …` or `npm install -g eas-cli` |

---

## 6. Related docs

- [ENV_CONFIG.md](./ENV_CONFIG.md) — proxy URLs, `appEnv`, local `.env`
- [DEPLOY.md](./DEPLOY.md) — EAS builds and credentials
- [Expo: Google authentication](https://docs.expo.dev/guides/google-authentication/)
- [Firebase: Authenticate with Google on Android](https://firebase.google.com/docs/auth/android/google-signin)
- [Firebase: Authenticate with Google on Apple platforms](https://firebase.google.com/docs/auth/ios/google-signin)
