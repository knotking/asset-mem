---
name: run-frontends
description: Run, build, lint, or typecheck the AssetMem frontends — apps/mapp (Expo / React Native) and apps/webapp (Next.js 15). Use whenever the user wants to start a dev server, debug a build, or work on either client. Covers the order-of-operations with the shared @asset-mem/common package, the unusual webapp port, and the env-injection paths.
---

# Running the AssetMem frontends

Both apps are part of the npm workspaces declared at `package.json` (root). The shared package is `@asset-mem/common` at `apps/common`.

## One-time install

From the repo root:
```bash
npm install --legacy-peer-deps
```
The flag is **not optional** — `next-themes` has a peer dependency on React 18 but the repo is on React 19. You'll get install errors without it.

If you ever need to regenerate just the webapp lockfile:
```bash
npm --prefix=apps/webapp install --legacy-peer-deps
```

## Always: build the shared package after editing it

```bash
cd apps/common && npm run build
```
`apps/common/package.json` declares `main: dist/index.js` and `types: dist/index.d.ts`, so consumers need a compiled `dist/`. After this, restart whichever dev server is running so module resolution picks up the new build.

## Webapp (apps/webapp)

```bash
cd apps/webapp
npm run dev          # next dev on http://localhost:9002  ← not 3000
npm run dev:turbo    # same, with --turbopack
npm run lint
npm run typecheck    # tsc --noEmit
npm run build        # next build, then scripts/fix-firebase-standalone.js
npm start            # serve the built app
```

The post-build `fix-firebase-standalone.js` step patches Firebase for Next.js standalone output. **Don't remove it from the build script** — App Hosting deploys break without it.

For Genkit AI flows under `src/ai/`:
```bash
npm run genkit:dev    # genkit start -- tsx src/ai/dev.ts
npm run genkit:watch
```

Env vars are read from `.env.local` (Next.js convention). Firebase project config comes from `apps/common/src/firebase/firebase-config.ts` which is hardcoded per environment and selected via the env variable. Quota UI uses `POST /token-quota-status` on the proxy (limits from `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` including `free`).

## Mapp (apps/mapp)

```bash
cd apps/mapp
npm run dev          # expo start -c (clears Metro cache, opens dev tools)
npm run ios          # + iOS simulator
npm run android      # + Android emulator
npm run web          # React DOM preview
npm run clean        # rm -rf .expo node_modules
npx tsc --noEmit     # type check (no separate lint script)
```

### Where mapp's runtime config comes from

`apps/mapp/app.config.js` reads `process.env.*` (via `dotenv` for local dev, or EAS build env for builds) and exposes URLs through `expo.extra.*`. The keys are:

| `extra.*` key | env source | endpoint |
|---|---|---|
| `appEnv` | `APP_ENV` | selects Firebase config (`dev`/`staging`/`prod`) |
| `agentSessionUrl` | `PROXY_BASE_URL` | `/agent-session` |
| `agentSseUrl` | same | `/firebase-agent-stream` |
| `ragFileUploadUrl` | same | `/rag-file-upload` |
| `documentAnalysisUrl` | same | `/extract-doc-info` |
| `checkpointAnalysisUrl` | same | `/analyze-checkpoint` |
| `checkpointComparisonUrl` | same | `/compare-checkpoints` |
| `tokenQuotaStatusUrl` | same | `/token-quota-status` |
| `webAppUrl` | `WEB_APP_URL` | for share links |

`buildProxyUrl` in `app.config.js` appends the route to `PROXY_BASE_URL` (origin only). Proxy auth uses Firebase Bearer tokens from `lib/proxy-auth.ts` — do not add a path secret in `lib/api.ts`.

For local dev, create `apps/mapp/.env` with `PROXY_BASE_URL`, `APP_ENV`, optionally `WEB_APP_URL`. For EAS builds, `PROXY_BASE_URL` and `WEB_APP_URL` come from `eas.json` build profiles.

## Working with both apps simultaneously

Typical chain when changing shared code:
1. Edit `apps/common/src/...`
2. `cd apps/common && npm run build`
3. Restart the dev server (Metro / Next) — module resolution caches the previous build
4. (Optional) `npx tsc --noEmit` in mapp and `npm run typecheck` in webapp to confirm types still resolve via the new exports.

## Common gotchas
- **`Cannot find module '@asset-mem/common/...'`** — you forgot to build common, or the new export isn't in `apps/common/package.json` `exports`. See the **add-shared-context** skill.
- **Webapp listening on 3000** — that's not this repo. It's 9002.
- **Mapp can't reach the proxy** — `Constants.expoConfig.extra.agentSessionUrl` is `undefined`. Check `PROXY_BASE_URL` is set in `apps/mapp/.env` (or the EAS profile).
- **Stale dist after a rebase** — `cd apps/common && rm -rf dist && npm run build`.
- **Firebase config wrong** — `Constants.expoConfig.extra.appEnv` is selecting the wrong env. Set `APP_ENV` in `.env`.
