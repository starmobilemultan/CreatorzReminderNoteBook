/**
 * metro.config.js — Expo SDK 53 Metro configuration
 *
 * Key configuration:
 * 1. transformIgnorePatterns — allow Babel to transpile Expo packages that
 *    ship raw TypeScript source (e.g. @expo/metro-runtime)
 * 2. sourceExts — add mjs/cjs for ESM compatibility
 * 3. resolver.extraNodeModules — alias native-only modules to web stubs
 * 4. Local modules directory resolution
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ── Block Config Plugin files from Metro bundling ─────────────────────────────
// plugin.js and app.plugin.js are Node.js Expo Config Plugin scripts that run
// only during prebuild. They use dynamic require() / Node.js APIs that are
// incompatible with Metro's static analysis. Exclude them from the JS bundle.
const blockListPatterns = [
  /modules[\/\\]alarm-manager[\/\\]plugin\.js$/,
  /modules[\/\\]alarm-manager[\/\\]app\.plugin\.js$/,
];

const { exclusionList } = require('metro-config');

// ── Packages that need to be transformed by Babel ────────────────────────────
const PACKAGES_TO_TRANSFORM = [
  '@expo/metro-runtime',
  'expo',
  'react-native',
  '@react-native',
  '@react-navigation',
  'expo-router',
  'expo-modules-core',
  'expo-font',
  'expo-asset',
  'expo-constants',
  'expo-file-system',
  'expo-image',
  'expo-linear-gradient',
  'expo-clipboard',
  'expo-haptics',
  'expo-notifications',
  'expo-local-authentication',
  'expo-document-picker',
  'expo-av',
  'expo-application',
  'expo-status-bar',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
  '@expo/vector-icons',
  'react-native-paper',
];

// Merge blockList with any existing exclusions from the default config
const defaultBlockList = config.resolver?.blockList;
const mergedBlockList = exclusionList([
  ...blockListPatterns,
  ...(Array.isArray(defaultBlockList) ? defaultBlockList : defaultBlockList ? [defaultBlockList] : []),
]);

config.transformer = {
  ...config.transformer,
  transformIgnorePatterns: [
    `node_modules/(?!(${PACKAGES_TO_TRANSFORM.join('|')}))`,
  ],
};

config.resolver = {
  ...config.resolver,
  sourceExts: [
    ...(config.resolver?.sourceExts ?? ['js', 'jsx', 'ts', 'tsx', 'json']),
    'mjs',
    'cjs',
  ],
  unstable_enablePackageExports: true,
  blockList: mergedBlockList,
  // Resolve local modules directory
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, 'modules'),
  ],
};

module.exports = config;
