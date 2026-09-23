const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const fs = require('fs');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// Gradle is invoked through a temporary drive letter because the workspace
// contains Unicode characters. Metro must watch the canonical path as well,
// otherwise Windows can report dependencies under a path it considers outside
// the project during a Release bundle.
const projectRoot = fs.realpathSync(__dirname);
const config = {
  projectRoot,
  watchFolders: [projectRoot],
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
