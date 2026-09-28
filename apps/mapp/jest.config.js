/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js)'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@asset-mem/common/firebase$': '<rootDir>/../common/src/firebase/firebase-native.ts',
    '^@asset-mem/common/firebase-config$': '<rootDir>/../common/src/firebase/firebase-config.ts',
    '^@asset-mem/common/(.*)$': '<rootDir>/../common/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|nativewind|react-native-css-interop|react-native-reanimated|react-native-gifted-chat|react-native-markdown-display|react-native-youtube-iframe|@rn-primitives/.*|lucide-react-native)',
  ],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/__tests__/**',
  ],
};
