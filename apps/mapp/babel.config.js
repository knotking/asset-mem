module.exports = function (api) {
  api.cache.using(
    () => `${process.env.NODE_ENV}:${process.env.EXPO_PUBLIC_DEBUG_LOGS ?? ''}`
  );

  const stripVerboseConsole =
    api.env('production') && process.env.EXPO_PUBLIC_DEBUG_LOGS !== 'true';

  const plugins = stripVerboseConsole
    ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
    : [];

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins,
  };
};
