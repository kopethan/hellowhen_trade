const fs = require('fs');
const path = require('path');
const { withDangerousMod, withPodfileProperties } = require('@expo/config-plugins');

const DEFAULT_IOS_DEPLOYMENT_TARGET = '15.0';
const MARKER_START = '# Hellowhen: force minimum iOS deployment target for pods';
const MARKER_END = '# /Hellowhen: force minimum iOS deployment target for pods';

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPostInstallPatch(deploymentTarget) {
  return `
    ${MARKER_START}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current_target.nil? || Gem::Version.new(current_target) < Gem::Version.new('${deploymentTarget}')
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'
        end
      end
    end
    ${MARKER_END}
`;
}

function patchPodfile(contents, deploymentTarget) {
  let next = contents;

  // Keep Expo's generated root `platform :ios, podfile_properties[...]` line intact.
  // The deployment target value is written safely into Podfile.properties.json below.
  // Replacing or adding another root platform line can make CocoaPods fail with:
  // "The target `Pods` already has a platform set."
  const markerPattern = new RegExp(
    `\\n\\s*${escapeForRegExp(MARKER_START)}[\\s\\S]*?${escapeForRegExp(MARKER_END)}\\n`,
    'm',
  );
  next = next.replace(markerPattern, '\n');

  const patch = buildPostInstallPatch(deploymentTarget);
  if (/post_install do \|installer\|/.test(next)) {
    return next.replace(/post_install do \|installer\|\n/, `post_install do |installer|\n${patch}`);
  }

  return `${next.trimEnd()}\n\npost_install do |installer|${patch}end\n`;
}

function withIosDeploymentTarget(config, props = {}) {
  const deploymentTarget = props.deploymentTarget || DEFAULT_IOS_DEPLOYMENT_TARGET;

  config = withPodfileProperties(config, (config) => {
    config.modResults['ios.deploymentTarget'] = deploymentTarget;
    return config;
  });

  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const contents = await fs.promises.readFile(podfilePath, 'utf8');
      await fs.promises.writeFile(podfilePath, patchPodfile(contents, deploymentTarget));
      return config;
    },
  ]);
}

module.exports = withIosDeploymentTarget;
