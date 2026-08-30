import {
  mobileReleasePolicyResponseSchema,
  type MobilePlatform,
  type MobileReleasePolicyResponse,
  type MobileReleaseTarget,
} from '@hellowhen/contracts';

export type NativeReleaseMetadata = {
  platform: string;
  version: string | null | undefined;
  build: string | null | undefined;
};

export type InstalledMobileRelease = {
  platform: MobilePlatform;
  target: MobileReleaseTarget;
};

export type OptionalUpdateDismissal = {
  platform: MobilePlatform;
  version: string;
  build: number;
};

const MARKETING_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const BUILD_NUMBER_PATTERN = /^[1-9]\d*$/;

function isMobilePlatform(platform: string): platform is MobilePlatform {
  return platform === 'ios' || platform === 'android';
}

function parseVersionParts(version: string) {
  return version.split('.').map((part) => BigInt(part));
}

export function compareAppUpdateTargets(left: MobileReleaseTarget, right: MobileReleaseTarget) {
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

export function readInstalledReleaseTarget(metadata: NativeReleaseMetadata): InstalledMobileRelease | null {
  if (!isMobilePlatform(metadata.platform)) return null;

  const version = metadata.version?.trim();
  const buildText = metadata.build?.trim();
  if (!version || !MARKETING_VERSION_PATTERN.test(version)) return null;
  if (!buildText || !BUILD_NUMBER_PATTERN.test(buildText)) return null;

  const build = Number(buildText);
  if (!Number.isSafeInteger(build) || build < 1) return null;

  return {
    platform: metadata.platform,
    target: { version, build },
  };
}

export function validateAppUpdatePolicyResponse(
  value: unknown,
  installedRelease: InstalledMobileRelease,
): MobileReleasePolicyResponse | null {
  const result = mobileReleasePolicyResponseSchema.safeParse(value);
  if (!result.success) return null;

  const policy = result.data;
  if (policy.platform !== installedRelease.platform) return null;
  if (policy.installed.version !== installedRelease.target.version || policy.installed.build !== installedRelease.target.build) return null;

  if (!policy.enabled) {
    return policy.status === 'current' ? policy : null;
  }

  if (!policy.latest || !policy.minimumSupported) return null;
  if (compareAppUpdateTargets(policy.minimumSupported, policy.latest) > 0) return null;

  const belowMinimum = compareAppUpdateTargets(installedRelease.target, policy.minimumSupported) < 0;
  const belowLatest = compareAppUpdateTargets(installedRelease.target, policy.latest) < 0;
  const expectedStatus = belowMinimum ? 'mandatory' : belowLatest ? 'optional' : 'current';
  if (policy.status !== expectedStatus) return null;

  return policy;
}

export function getOptionalUpdateDismissal(policy: MobileReleasePolicyResponse): OptionalUpdateDismissal | null {
  if (!policy.enabled || policy.status !== 'optional' || !policy.latest) return null;
  return {
    platform: policy.platform,
    version: policy.latest.version,
    build: policy.latest.build,
  };
}

export function matchesOptionalUpdateDismissal(
  policy: MobileReleasePolicyResponse,
  dismissal: OptionalUpdateDismissal | null,
) {
  const target = getOptionalUpdateDismissal(policy);
  if (!target || !dismissal) return false;
  return target.platform === dismissal.platform
    && target.version === dismissal.version
    && target.build === dismissal.build;
}

export function shouldPresentAppUpdate(
  policy: MobileReleasePolicyResponse | null,
  dismissal: OptionalUpdateDismissal | null,
) {
  if (!policy?.enabled || policy.status === 'current') return false;
  if (policy.status === 'mandatory') return Boolean(policy.minimumSupported);
  if (!policy.latest) return false;
  return !matchesOptionalUpdateDismissal(policy, dismissal);
}
