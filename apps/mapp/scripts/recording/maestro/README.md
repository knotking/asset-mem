# Maestro Mobile App Recording (dev client)

Record native **mapp** demo videos on the iOS Simulator or Android Emulator using **Maestro** and a **development client** build (not Expo Go).

Scene list matches `apps/webapp/scripts/recording/record-webapp.ts`.

## Prerequisites

1. **Maestro**
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Dev client** installed on the simulator/emulator
   ```bash
   cd apps/mapp
   npx expo run:ios
   ```

3. **Metro** running
   ```bash
   cd apps/mapp && npm run dev
   ```

4. **`.env.recording`** in `apps/mapp/`:
   ```bash
   RECORDING_EMAIL=your@email.com
   RECORDING_PASSWORD=yourpassword
   RECORDING_IOS_APP_ID=com.assetmem.staging
   RECORDING_ANDROID_APP_ID=com.assetmem.staging
   RECORDING_APP_SCHEME=assetmem
   ```

## Run

```bash
cd apps/mapp
npm run record:mapp
```

The script reloads the app before each scene, navigates to the right screen, records video, and runs Maestro flows.

## Selector strategy

**Maestro flows use visible text and accessibility labels**, not `testID`s (iOS often does not expose `testID` to Maestro).

| Screen / action | Label or text |
|-----------------|---------------|
| Landing | `Timeline Intelligence`, `Watch Demo`, `Get Started` / `Dashboard` |
| Login | `Welcome Back`, `Enter your email`, `Enter your password`, `Sign In` |
| Dashboard | `Property AI Agent`, `Add New Property`, property row below add card |
| Property tabs (icons) | Tap points: chat `17%,93%`, timeline `50%,93%`, details `83%,93%` |
| Chat settings | `Open chat settings`, `Chat Settings`, `Close settings` |
| Agents | `Checkpoint`, `Service`, `Coverage`, … |
| Chat input | `Type a message...` / `Chat input`, `Send message` |
| Report sheet | `Open full report`, `Close full report`, `Save provider` |
| Timeline subtabs | `Checkpoints`, `Insights`, `Reports` |
| Details | `My pros`, `Upload` / `Upload documents` |

`lib/recording-test-ids.ts` documents IDs used in the app for debugging; flows should prefer labels above.

## Scenes

| # | Scene |
|---|--------|
| 1 | Landing Page Static — hero hold (hero section narration) |
| 2 | Landing Page — scroll through workflow, AI, use cases, enterprise, pricing, footer (per-section narration in JSON) |
| 3 | Login |
| 4 | Property Onboarding |
| 5 | Dashboard |
| 6 | Timeline Checkpoint |
| 7 | Timeline Compare |
| 8 | Timeline Insights |
| 9 | Timeline Reports |
| 10 | Checkpoint Chat |
| 11 | Save Provider & My Pros |
| 12 | Details |

## Troubleshooting

- **Wrong screen after reload** — dashboard/timeline scenes skip `goto-landing` and use `prep/authenticate.yaml`, which waits for `Add New Property` on the home screen before attempting login.
- **"Welcome Back" assertion failed** — session was still active; authenticate now opens `assetmem://home` instead of the login deep link when a valid session exists.
- **Property tabs** — icon tabs use coordinate taps in `prep/nav-*-tab.yaml`; adjust if layout changes.
- **AI chat timeouts** — test account needs checkpoints and address for service-agent results.
