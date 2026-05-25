const fs = require('fs');
const path = require('path');
const { transformSync } = require('@babel/core');

const SAMPLE_PATH = path.join(__dirname, 'fixtures/console-sample.js');
const BABEL_CONFIG_PATH = path.join(__dirname, '..', 'babel.config.js');

function loadBabelConfig() {
  delete require.cache[BABEL_CONFIG_PATH];
  const configFn = require(BABEL_CONFIG_PATH);
  const api = {
    cache: {
      using: (fn) => fn(),
      forever: () => {},
    },
    env: (name) => process.env.NODE_ENV === name,
  };
  return configFn(api);
}

function transformSample(env) {
  const priorNodeEnv = process.env.NODE_ENV;
  const priorDebug = process.env.EXPO_PUBLIC_DEBUG_LOGS;
  process.env.NODE_ENV = env.NODE_ENV;
  if (env.EXPO_PUBLIC_DEBUG_LOGS === undefined) {
    delete process.env.EXPO_PUBLIC_DEBUG_LOGS;
  } else {
    process.env.EXPO_PUBLIC_DEBUG_LOGS = env.EXPO_PUBLIC_DEBUG_LOGS;
  }

  try {
    const config = loadBabelConfig();
    const code = fs.readFileSync(SAMPLE_PATH, 'utf8');
    return transformSync(code, {
      filename: 'console-sample.js',
      presets: config.presets,
      plugins: config.plugins,
      babelrc: false,
      configFile: false,
    }).code;
  } finally {
    process.env.NODE_ENV = priorNodeEnv;
    if (priorDebug === undefined) {
      delete process.env.EXPO_PUBLIC_DEBUG_LOGS;
    } else {
      process.env.EXPO_PUBLIC_DEBUG_LOGS = priorDebug;
    }
  }
}

describe('babel prod console stripping', () => {
  it('removes log, info, and debug in production when EXPO_PUBLIC_DEBUG_LOGS is unset', () => {
    const output = transformSample({ NODE_ENV: 'production' });
    expect(output).not.toMatch(/console\.log/);
    expect(output).not.toMatch(/console\.info/);
    expect(output).not.toMatch(/console\.debug/);
    expect(output).toMatch(/console\.warn/);
    expect(output).toMatch(/console\.error/);
  });

  it('keeps all console levels in production when EXPO_PUBLIC_DEBUG_LOGS is true', () => {
    const output = transformSample({
      NODE_ENV: 'production',
      EXPO_PUBLIC_DEBUG_LOGS: 'true',
    });
    expect(output).toMatch(/console\.log/);
    expect(output).toMatch(/console\.info/);
    expect(output).toMatch(/console\.debug/);
    expect(output).toMatch(/console\.warn/);
    expect(output).toMatch(/console\.error/);
  });

  it('does not strip console in development', () => {
    const output = transformSample({ NODE_ENV: 'development' });
    expect(output).toMatch(/console\.log/);
    expect(output).toMatch(/console\.debug/);
  });
});
