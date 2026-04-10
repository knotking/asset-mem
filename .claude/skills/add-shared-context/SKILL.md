---
name: add-shared-context
description: Add a new React context (or any new module) to the @homeapp/common shared package consumed by both mapp and webapp. Use whenever the user wants to share state, types, hooks, or Firebase logic between the mobile and web apps. Covers the package exports map, build step, conditional Firebase resolution, and how consumers pick it up.
---

# Adding a shared module to apps/common

`apps/common` is published as `@homeapp/common` via npm workspaces. Both `apps/mapp` and `apps/webapp` consume it through the workspace symlink. **It is NOT a transparent shared folder** — every entry point must be declared in `apps/common/package.json` `exports`.

## Where things live

```
apps/common/src/
├── contexts/    ← React context providers (auth, session, property, …)
├── firebase/    ← firebase-config.ts, firebase-web.ts, firebase-native.ts
├── lib/         ← utilities (e.g. format-tokens)
├── constants/
└── types.ts     ← shared TS types
```

## Step 1 — write the module

Pick the right directory by purpose. For contexts, create `apps/common/src/contexts/<name>-context.tsx`. Keep the file framework-agnostic where possible — if you need React Native vs DOM behavior, see the conditional-export pattern below.

## Step 2 — declare an export

Edit `apps/common/package.json` and add an entry under `exports`. Example:

```json
"./contexts/foo-context": "./src/contexts/foo-context.tsx"
```

For modules that need different React Native vs Web implementations, use a conditional export (the same pattern `./firebase` uses today):

```json
"./foo": {
  "react-native": "./src/foo/foo-native.ts",
  "default": "./src/foo/foo-web.ts"
}
```

The `react-native` condition is resolved by Metro automatically; everything else (Next.js, plain Node, browsers) gets `default`.

**This step is mandatory.** Without an `exports` entry, TypeScript and the bundlers will not resolve the import path even though the file exists.

## Step 3 — build the package

```bash
cd apps/common && npm run build      # tsc --build → dist/
```

`apps/common/package.json` declares `main: dist/index.js` and `types: dist/index.d.ts`, so consumers need the build to exist before TS can resolve imports. Re-run after every change to shared code.

## Step 4 — consume it

In mapp or webapp:

```ts
import { FooProvider, useFoo } from '@homeapp/common/contexts/foo-context';
```

Use the **subpath you declared in `exports`**, not a deep relative path into `dist/`.

If a consumer can't see your new export:
- Did you build `apps/common`? (`npm run build` in that dir)
- Did you add the entry to the `exports` map?
- Restart Metro (mapp) or Next dev server (webapp) — they cache module resolution.

## Step 5 — wire providers

For a context that's meant to be available globally:
- **mapp**: wrap inside `apps/mapp/app/_layout.tsx` alongside the other providers.
- **webapp**: wrap inside `apps/webapp/src/app/layout.tsx` (or a per-route layout).

If the context depends on another context, mount it inside that one.

## Firebase specifics

`apps/common/src/firebase/firebase-config.ts` has Firebase project config hardcoded for `dev`/`staging`/`prod` and selects via `Constants.expoConfig?.extra?.appEnv`. **Do not** add a new Firebase project here without also updating `apps/mapp/app.config.js` `extra.appEnv` and the App Hosting yamls. Most new shared modules should consume `app` from the existing entry rather than re-initializing Firebase.

## Quick checklist
- [ ] File added under `apps/common/src/...`
- [ ] `exports` entry added to `apps/common/package.json`
- [ ] `npm run build` run in `apps/common`
- [ ] Consumer imports via `@homeapp/common/...` subpath
- [ ] Provider wrapped in mapp `_layout.tsx` and webapp `layout.tsx` if it's global
- [ ] Metro / Next dev server restarted after the build
