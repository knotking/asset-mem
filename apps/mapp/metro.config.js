const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Allow Metro to access files outside of the project root
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Add the @common and @asset-mem/common aliases
config.resolver.extraNodeModules = {
  '@common': path.resolve(__dirname, '../common'),
  '@asset-mem/common': path.resolve(__dirname, '../common'),
};

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
