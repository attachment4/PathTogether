const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK совместимость с Metro
config.resolver.unstable_enablePackageExports = false;

// На web нативный модуль виджета отсутствует — резолвим в пустой модуль,
// чтобы веб-сборка не падала. Все обращения к нему в коде обёрнуты в try/catch.
const _defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-android-widget') {
    return { type: 'empty' };
  }
  if (_defaultResolveRequest) {
    return _defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
