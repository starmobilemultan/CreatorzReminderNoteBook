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
  // Resolve local modules directory
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, 'modules'),
  ],
};

module.exports = config;
