# Sign in with Apple (mapp)

Required for **App Store** when the app offers Google sign-in ([App Store Review Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/)). Android does not require Apple sign-in.

## Code

| File | Role |
| ---- | ---- |
| [AppleSignInButton.tsx](../components/auth/AppleSignInButton.tsx) | iOS-only wrapper; disabled in Expo Go |
| [AppleSignInButtonNative.tsx](../components/auth/AppleSignInButtonNative.tsx) | `expo-apple-authentication` → Firebase `OAuthProvider('apple.com')` |
| [login.tsx](../app/auth/login.tsx) / [signup.tsx](../app/auth/signup.tsx) | Auth screens |
| [app.config.js](../app.config.js) | `ios.usesAppleSignIn: true`, `expo-apple-authentication` plugin |

## Console setup (per environment)

### Apple Developer

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources) → **Identifiers** → App IDs.
2. For each bundle ID (`com.assetmem.dev`, `com.assetmem.staging`, `com.assetmem.app`), enable **Sign in with Apple**.
3. EAS credentials / provisioning profiles must be regenerated after enabling the capability (new native build).

### Firebase

1. **Authentication** → **Sign-in method** → enable **Apple**.
2. No extra OAuth client ID in `firebase-config.ts` (unlike Google `iosClientId`).
3. Use the same Firebase project as the build: **homegeek-staging** for dev/staging, **homegeek-prod** for production.

## Testing

- Use a **physical iPhone** with an EAS **staging** or **development** build (not Expo Go).
- Simulator support for Sign in with Apple is limited; treat device testing as the gate before App Review.

## App Review notes

Mention parity: email/password, Google, and Sign in with Apple on iOS.

**Billing (3.1.1):** iOS does not sell subscriptions or link to Stripe checkout. See [APP_STORE_BILLING_IOS.md](./APP_STORE_BILLING_IOS.md) for review notes and the `isIosAppStoreBillingRestricted()` guard. Android still uses web handoff billing.
