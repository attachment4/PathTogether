const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK совместимость с Metro
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
