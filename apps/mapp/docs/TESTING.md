# Mapp unit tests

Jest + `jest-expo` + `@testing-library/react-native` for chat perf regression tests and component rendering.

## Commands

```bash
# From repo root (after npm ci)
npm test --workspace=@homeapp/common
npm test --workspace=mapp

# From apps/mapp
npm test
npm run test:watch
```

## Layout

| Path | Purpose |
|------|---------|
| [`jest.config.js`](../jest.config.js) | `jest-expo` preset, `@/` alias, transform ignore patterns |
| [`jest.setup.js`](../jest.setup.js) | Reanimated mock, NetInfo default |
| [`__mocks__/`](../__mocks__/) | GiftedChat, YouTube, expo-image/video, markdown, clipboard, haptics |
| [`__tests__/fixtures/messages.ts`](../__tests__/fixtures/messages.ts) | Shared Firestore `Message` fixtures (incl. `garageDoorDualFormatMessage`) |
| [`lib/gifted-chat-bubble-equal.ts`](../lib/gifted-chat-bubble-equal.ts) | Bubble memo comparator (`areGiftedChatBubblePropsEqual`) |
| [`lib/property-chat-list-props.ts`](../lib/property-chat-list-props.ts) | Android GiftedChat `listViewProps` tuning |
| [`lib/gifted-chat-utils.ts`](../lib/gifted-chat-utils.ts) | GiftedChat transform + `transformMessagesToGiftedChatCached` |
| [`apps/common/src/lib/merge-messages-snapshot.ts`](../../common/src/lib/merge-messages-snapshot.ts) | Incremental Firestore snapshot merge |
| [`__tests__/gifted-chat-utils.cached.test.ts`](../__tests__/gifted-chat-utils.cached.test.ts) | Cached transform reference reuse |
| [`lib/chat-content-cache.ts`](../lib/chat-content-cache.ts) | LRU parse cache for assistant message content |
| [`lib/chat-content-parse.ts`](../lib/chat-content-parse.ts) | Markdown + JSON extraction, visible-section gate (used by cache) |
| [`lib/css-theme-tokens.ts`](../lib/css-theme-tokens.ts) | HSL tokens aligned with `global.css` for native chat styles |
| [`lib/chat-message-native-styles.ts`](../lib/chat-message-native-styles.ts) | StyleSheet bypass for NativeWind opacity/shadow interop issues |
| [`lib/lazy-youtube-player.tsx`](../lib/lazy-youtube-player.tsx) | Defers Youtube WebView until accordion expanded + layout |
| [`__tests__/ChatMessage.youtube.test.tsx`](../__tests__/ChatMessage.youtube.test.tsx) | Lazy YouTube mount gated by `AccordionMountContext` |
| [`lib/structured-accordion-defaults.ts`](../lib/structured-accordion-defaults.ts) | Android: only summary/clarification open; no triage default |
| [`__tests__/structured-accordion-defaults.test.ts`](../__tests__/structured-accordion-defaults.test.ts) | Accordion `defaultValue` by platform and visible sections |
| [`lib/chat-message-equal.ts`](../lib/chat-message-equal.ts) | `ChatMessage` memo comparator (content, steps, file, createdAt) |
| [`__tests__/chat-message.equal.test.ts`](../__tests__/chat-message.equal.test.ts) | `areChatMessagePropsEqual` mirrors bubble comparator |
| [`__tests__/css-theme-tokens.test.ts`](../__tests__/css-theme-tokens.test.ts) | Light/dark token mapping regression |
| [`__tests__/ChatMessage.structured.navigation.test.tsx`](../__tests__/ChatMessage.structured.navigation.test.tsx) | Real accordion + `NavigationContainer` (no nav-context crash) |
| [`__tests__/test-utils.tsx`](../__tests__/test-utils.tsx) | `renderWithProviders()` helper |

## Adding tests

- Place files under `__tests__/**/*.(test|spec).(ts|tsx)`.
- Use fixtures from `__tests__/fixtures/messages.ts` for chat scenarios.
- Mock heavy native modules via `__mocks__/` rather than pulling in real WebViews.
- For GiftedChat behavior, use `getLastGiftedChatProps()` from the GiftedChat mock.

## CI

Pull requests that touch `apps/mapp/**` or `apps/common/**` run [`.github/workflows/test-mapp-frontends.yaml`](../../../.github/workflows/test-mapp-frontends.yaml).

| [`__tests__/logger.test.ts`](../__tests__/logger.test.ts) | Runtime logger gating (`debug`/`info` vs `warn`/`error`) |
| [`__tests__/babel.prod-console.test.js`](../__tests__/babel.prod-console.test.js) | Prod Babel strips `console.log`/`info`/`debug`; keeps `warn`/`error` |
| [`babel.config.js`](../babel.config.js) | `transform-remove-console` when `NODE_ENV=production` and debug flag off |

See also [docs/CLIENT_LOGGING.md](../../../docs/CLIENT_LOGGING.md) for logging policy.

## Manual release check (Phase 4.2)

After `eas build --profile prod-apk` (or internal prod APK), on a mid-range Android device:

- Scroll a long chat (50+ messages) — no severe jank
- Stream a long assistant reply — UI stays responsive
- Expand structured accordions (coverage, DIY) — first expand acceptable; YouTube loads only when section is open
- Cold start → open property chat — time to interactive reasonable
