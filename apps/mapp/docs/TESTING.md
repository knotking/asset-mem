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
| [`__tests__/test-utils.tsx`](../__tests__/test-utils.tsx) | `renderWithProviders()` helper |

## Adding tests

- Place files under `__tests__/**/*.(test|spec).(ts|tsx)`.
- Use fixtures from `__tests__/fixtures/messages.ts` for chat scenarios.
- Mock heavy native modules via `__mocks__/` rather than pulling in real WebViews.
- For GiftedChat behavior, use `getLastGiftedChatProps()` from the GiftedChat mock.

## CI

Pull requests that touch `apps/mapp/**` or `apps/common/**` run [`.github/workflows/test-mapp-frontends.yaml`](../../../.github/workflows/test-mapp-frontends.yaml).

See also [docs/CLIENT_LOGGING.md](../../../docs/CLIENT_LOGGING.md) for logger gating expectations exercised in `__tests__/logger.test.ts`.
