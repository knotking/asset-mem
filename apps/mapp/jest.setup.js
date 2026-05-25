// Extend matchers from @testing-library/react-native (built-in in v12.4+).
// @testing-library/jest-native is deprecated; use RNTL matchers only.

// Silence NativeWind / Reanimated warnings; shim LayoutAnimationConfig for accordion tests
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    LayoutAnimationConfig: ({ children }) => children,
    LinearTransition: { duration: () => ({}) },
    FadeOutUp: { duration: () => ({}) },
  };
});

// Default NetInfo online
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Minimal Firestore mocks for utility imports used by UI components.
jest.mock('firebase/firestore', () => ({
  query: jest.fn(),
  getDocs: jest.fn(async () => ({ docs: [] })),
  writeBatch: jest.fn(() => ({ commit: jest.fn(async () => undefined) })),
}));
