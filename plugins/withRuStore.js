const { withProjectBuildGradle } = require('@expo/config-plugins');

const withRuStore = (config) => {
  config = withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('rustore')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        'mavenCentral()',
        'mavenCentral()\n        maven { url "https://artifactory.rustore.ru/artifactory/libs-release" }'
      );
    }
    return mod;
  });
  return config;
};

module.exports = withRuStore;
