# HomeApp Monorepo

This repository contains multiple applications (`mapp` and `webapp`) managed within a single monorepo structure.

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js**: [LTS version recommended](https://nodejs.org/en/download/)
*   **npm** (Node Package Manager): Comes with Node.js.
*   **Expo CLI** (for `mapp` development):
    ```bash
    npm install -g expo-cli
    ```

## Monorepo Setup

To set up the monorepo and install all dependencies for `mapp`, `webapp`, and `common` packages, navigate to the root of this project and run:

```bash
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is used to handle potential peer dependency conflicts, especially with `next-themes` and React 19.

## Local Development

### Firebase Configuration

Both `mapp` and `webapp` rely on Firebase. You will need to set up your Firebase project and configure the environment variables.

1.  Create a `.env.dev` file in the root of the project (`/Users/prakashbaskaran/projects/HomeApp/.env.dev`).
2.  Add your Firebase configuration details to this file. An example `firebase-config.ts` is located in `apps/common/src/firebase-config.ts`. You'll need to populate the `.env.dev` with the corresponding values.

    ```
    # Example .env.dev content
    EXPO_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
    EXPO_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
    EXPO_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
    EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID
    ```

### Running `mapp` (Mobile Application)

The `mapp` is an Expo-based React Native application.

1.  Navigate to the `mapp` directory:
    ```bash
    cd apps/mapp
    ```
2.  Start the Expo development server:
    ```bash
    npm run dev
    ```
    This will open a new tab in your browser with the Expo Dev Tools. You can then run the app on an iOS simulator, Android emulator, or your physical device using the Expo Go app.

### Running `webapp` (Web Application)

The `webapp` is a Next.js application.

1.  Navigate to the `webapp` directory:
    ```bash
    cd apps/webapp
    ```
2.  Start the Next.js development server:
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:9002` (as configured in `package.json`).

## Building Shared Library

The `common` package is a shared library used by `mapp` and `webapp`. You need to build it for changes to be reflected.

1.  Navigate to the `common` directory:
    ```bash
    cd apps/common
    ```
2.  Build the package:
    ```bash
    npm run build
    ```

## Type Checking

To run type checks for `mapp` and `webapp`:

### For `mapp`:

1.  Navigate to the `mapp` directory:
    ```bash
    cd apps/mapp
    ```
2.  Run the TypeScript compiler:
    ```bash
    npx tsc --noEmit
    ```

### For `webapp`:

1.  Navigate to the `webapp` directory:
    ```bash
    cd apps/webapp
    ```
2.  Run the type check script:
    ```bash
    npm run typecheck
    ```
