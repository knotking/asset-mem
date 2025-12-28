# WebApp Troubleshooting Guide

This document provides solutions to common issues you might encounter while developing or deploying the webapp.

## Table of Contents
- [Chat Session Creation Fails](#chat-session-creation-fails)
- [Environment Variables Not Loading](#environment-variables-not-loading)
- [Build Failures](#build-failures)
- [Firebase Authentication Issues](#firebase-authentication-issues)

---

## Chat Session Creation Fails

### Symptoms
- Error: `"Failed to create agent session ID"`
- Error in console: `NEXT_PUBLIC_AGENT_SESSION_URL environment variable not set`
- Unable to create new chat sessions in the webapp

### Root Cause
The webapp requires environment variables to communicate with the backend agent service. If these variables are not loaded or the Next.js dev server was started before the `.env` file was updated, the variables won't be available to the application.

### Solution

**1. Verify Environment Variables Exist**

Check that your `.env` file contains:

```env
NEXT_PUBLIC_AGENT_SESSION_URL=https://homecare-agent-proxy-321433914812.us-central1.run.app/92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376/agent-session
NEXT_PUBLIC_AGENT_SSE_URL=https://homecare-agent-proxy-321433914812.us-central1.run.app/92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376/firebase-agent-stream
```

**2. Restart the Development Server**

Environment variables are loaded at startup time, so you **must restart** the Next.js dev server:

```bash
# Stop the current dev server (Ctrl+C in the terminal)
# Then restart it:
cd apps/webapp
npm run dev
```

**3. Verify Variables Are Loaded**

Add a temporary log to verify the variables are loaded:

```typescript
// In apps/webapp/src/app/actions.ts
console.log('Agent Session URL:', process.env.NEXT_PUBLIC_AGENT_SESSION_URL);
```

If this logs `undefined`, the server needs to be restarted.

### Prevention

- Always restart the Next.js dev server after modifying `.env` files
- Use `.env.local` for local overrides that won't be committed
- Document required environment variables in `.env.example`

---

## Environment Variables Not Loading

### Symptoms
- `process.env.NEXT_PUBLIC_*` returns `undefined`
- Environment-dependent features fail to work

### Root Cause
Next.js loads environment variables at build/start time, not during runtime. Changes to `.env` files require a server restart.

### Solution

**For Development:**

1. Stop the dev server (Ctrl+C)
2. Start it again: `npm run dev`

**For Production:**

1. Verify variables are set in `apphosting.yaml` (for Firebase App Hosting)
2. Redeploy the application
3. Check Cloud Run environment variables in the GCP Console

### Environment Variable Precedence

Next.js loads environment variables in this order (highest to lowest priority):

1. `.env.local` (loaded in all environments except test)
2. `.env.development`, `.env.production`, `.env.test` (environment-specific)
3. `.env` (all environments)

**Important:** Only `NEXT_PUBLIC_*` variables are exposed to the browser. Server-only variables should NOT have this prefix.

---

## Build Failures

### Symptoms
- `npm run build` fails
- TypeScript errors during build
- Deployment fails in Firebase App Hosting

### Common Causes & Solutions

**1. TypeScript Errors**

Run type checking:
```bash
npm run typecheck
```

Fix any type errors reported.

**2. Missing Dependencies**

Clear and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

**3. Build Cache Issues**

Clear Next.js cache:
```bash
rm -rf .next
npm run build
```

**4. Node Version Mismatch**

Ensure you're using Node.js 20+:
```bash
node --version  # Should be v20.x or higher
```

If not, use nvm to switch:
```bash
nvm install 20
nvm use 20
```

---

## Firebase Authentication Issues

### Symptoms
- Users can't log in
- "Firebase not initialized" errors
- Auth state not persisting

### Solution

**1. Check Firebase Config**

Verify `src/lib/firebase.ts` has correct configuration:

```typescript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // ... other config
};
```

**2. Verify Firebase Project Settings**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings → General
4. Verify the configuration matches your code

**3. Check Authentication Methods**

1. Go to Firebase Console → Authentication → Sign-in method
2. Ensure your desired auth methods (Email/Password, Google, etc.) are enabled

**4. Domain Authorization**

For production, ensure your domain is authorized:

1. Firebase Console → Authentication → Settings
2. Add your domain to "Authorized domains"

---

## Additional Resources

- [Next.js Environment Variables Docs](https://nextjs.org/docs/basic-features/environment-variables)
- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [Project README](../README.md)
- [Deployment Guide](./DEPLOYMENT.md)

---

## Getting Help

If you encounter issues not covered here:

1. Check the browser console for error messages
2. Check the terminal/server logs
3. Review the [Next.js documentation](https://nextjs.org/docs)
4. Check Firebase status: https://status.firebase.google.com

