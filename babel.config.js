module.exports = function (api) {
  // Конфиг зависит от платформы сборки (web / ios / android), поэтому кешируем по ней.
  const platform = api.caller((caller) => caller && caller.platform);
  api.cache.using(() => platform);

  const plugins = [];

  // На web Babel не транспилирует const/let в var (в отличие от native-таргета),
  // поэтому латентные обращения к переменным до их объявления вызывают TDZ-краш
  // при рендере. Включаем block-scoping только для web — поведение совпадает с native,
  // нативный бандл не меняется.
  if (platform === 'web') {
    plugins.push('@babel/plugin-transform-block-scoping');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
