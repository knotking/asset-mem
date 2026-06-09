# Feature discovery (in-app education)

Post-onboarding UX that helps users understand checkpoints, chat modes, comparisons, and AI usage limits.

## Shared logic

| Client | Module |
|--------|--------|
| **mapp + tests** | `apps/common/src/lib/feature-discovery.ts` (`@homeapp/common`) |
| **webapp** | `apps/webapp/src/lib/feature-discovery.ts` — **local mirror only** (Firebase App Hosting does not bundle `@homeapp/common`; ESLint + `npm run check:no-common`) |

Keep the two files in sync when changing copy, counts, or tip IDs:

- `HELP_ARTICLES` — Help hub copy
- `CHAT_SESSION_EMPTY_INTRO` — static new-chat empty state title/subtitle (web + mapp)
- `CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS_BY_AGENT` / `getSuggestedPrompts({ primaryAgent })` — empty-state tap-to-send questions per primary agent (checkpoint, docs, report)
- `getDiscoveryStepStates()` / `shouldShowDiscoveryChecklist()` — second checklist on home
- `shouldShowFeatureTip()` — dismissible contextual banners

## Firestore preferences

`users/{uid}/preferences/user`:

| Field | Purpose |
|-------|---------|
| `featureTipsDismissed` | Map of tip id → true when dismissed (cleared via **Settings → FAQ → Show contextual tips again**) |
| `discoveryChecklistDismissed` | Hide “Discover what you can do next” card |
| `discoveryCompareDone` | User compared two checkpoints |
| `discoveryOptionalAgentUsed` | Sent chat with checkpoint optional agent |
| `discoveryMultiCheckpointChat` | Sent chat with 2+ checkpoints |
| `discoveryAiUsageViewed` | Opened AI usage settings |
| `discoveryFirstStructuredResponseSeen` | Received first structured assistant payload |

## Surfaces

- **Home** — `DiscoveryChecklist` after onboarding completes or checklist dismissed
- **Settings → FAQ** — `HelpHubSettings` articles + deep links
- **Header FAQ (BookOpen)** — web `/home/settings?tab=faq` (hover tooltips on header icons); mapp `settings/faq` + header/property nav icons use `accessibilityLabel` only (no tooltips)
- **Settings → Help & support** — contact support and legal only
- **Chat** — empty state in `ChatList` (web) and `PropertyChatTab.renderChatEmpty` (mapp) using `CHAT_SESSION_EMPTY_INTRO` and `getSuggestedPrompts({ primaryAgent })`; prompts update when the user switches agent in chat settings on a message-free session; tap sends via existing `handleSend` / `onSend`
- **Timeline** — compare tip (web banner; mapp existing hint + milestone on compare)
- **Property details** — docs → Docs chat tip
- **Property cards** — stat labels (uploaded files, saved providers, timeline entries)
- **Session sidebar** — session history microcopy

## Analytics (web)

- `feature_tip_dismiss`
- `feature_tips_reset` (web FAQ)
- `discovery_step_click`
- `suggested_prompt_click`

## Related

- [apps/mapp/docs/HOME_ONBOARDING.md](../apps/mapp/docs/HOME_ONBOARDING.md) — initial 4-step checklist
