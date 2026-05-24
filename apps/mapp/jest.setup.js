// Extend matchers from @testing-library/react-native (built-in in v12.4+).
// @testing-library/jest-native is deprecated; use RNTL matchers only.

// Silence NativeWind / Reanimated warnings in unit tests
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

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
