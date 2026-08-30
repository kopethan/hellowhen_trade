import {
  MOBILE_RELEASE_NOTES_MAX_LENGTH,
  mobileReleaseTargetSchema,
  type MobilePlatform,
  type MobileReleaseLocale,
  type MobileReleasePolicyQuery,
  type MobileReleasePolicyResponse,
  type MobileReleaseTarget,
} from '@hellowhen/contracts';

type MobileReleasePlatformConfig = {
  latestVersion: string;
  latestBuild: string;
  minimumSupportedVersion: string;
  minimumSupportedBuild: string;
  releaseNotes: Partial<Record<MobileReleaseLocale, string>>;
};

export type MobileReleasePolicyConfig = {
  enabled: boolean;
  ios: MobileReleasePlatformConfig;
  android: MobileReleasePlatformConfig;
};

function parseVersionParts(version: string) {
  return version.split('.').map((part) => BigInt(part));
}

export function compareMobileReleaseTargets(left: MobileReleaseTarget, right: MobileReleaseTarget) {
  const leftVersion = parseVersionParts(left.version);
  const rightVersion = parseVersionParts(right.version);

  for (let index = 0; index < 3; index += 1) {
    const leftPart = leftVersion[index] ?? 0n;
    const rightPart = rightVersion[index] ?? 0n;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }

  if (left.build < right.build) return -1;
  if (left.build > right.build) return 1;
  return 0;
}

function parseConfiguredTarget(version: string, build: string): MobileReleaseTarget | null {
  const result = mobileReleaseTargetSchema.safeParse({ version, build });
  return result.success ? result.data : null;
}

function getPlatformConfig(config: MobileReleasePolicyConfig, platform: MobilePlatform) {
  return platform === 'ios' ? config.ios : config.android;
}

function validReleaseNote(value: string | undefined) {
  const note = value?.trim();
  if (!note || note.length > MOBILE_RELEASE_NOTES_MAX_LENGTH) return null;
  return note;
}

function getReleaseNotes(config: MobileReleasePlatformConfig, locale: MobileReleaseLocale) {
  return validReleaseNote(config.releaseNotes[locale])
    ?? validReleaseNote(config.releaseNotes.en)
    ?? null;
}

function disabledPolicy(input: MobileReleasePolicyQuery): MobileReleasePolicyResponse {
  return {
    enabled: false,
    platform: input.platform,
    status: 'current',
    installed: { version: input.version, build: input.build },
    latest: null,
    minimumSupported: null,
    releaseNotes: null,
  };
}

export function evaluateMobileReleasePolicy(
  input: MobileReleasePolicyQuery,
  config: MobileReleasePolicyConfig,
): MobileReleasePolicyResponse {
  if (!config.enabled) return disabledPolicy(input);

  const platformConfig = getPlatformConfig(config, input.platform);
  const latest = parseConfiguredTarget(platformConfig.latestVersion, platformConfig.latestBuild);
  const minimumSupported = parseConfiguredTarget(platformConfig.minimumSupportedVersion, platformConfig.minimumSupportedBuild);

  if (!latest || !minimumSupported) return disabledPolicy(input);
  if (compareMobileReleaseTargets(minimumSupported, latest) > 0) return disabledPolicy(input);

  const installed = { version: input.version, build: input.build };
  const belowMinimum = compareMobileReleaseTargets(installed, minimumSupported) < 0;
  const belowLatest = compareMobileReleaseTargets(installed, latest) < 0;
  const status = belowMinimum ? 'mandatory' : belowLatest ? 'optional' : 'current';

  return {
    enabled: true,
    platform: input.platform,
    status,
    installed,
    latest,
    minimumSupported,
    releaseNotes: status === 'current' ? null : getReleaseNotes(platformConfig, input.locale),
  };
}
