const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// @expo/metro-runtime ships raw TypeScript (.ts) source files.
// Metro skips node_modules by default, so we must explicitly allow
// Babel to transform this package (and the other Expo packages).
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
};

module.exports = config;
