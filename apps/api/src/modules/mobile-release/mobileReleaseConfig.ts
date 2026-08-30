import type { MobileReleasePolicyQuery } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { evaluateMobileReleasePolicy } from './mobileReleasePolicy.js';

export function getConfiguredMobileReleasePolicy(input: MobileReleasePolicyQuery) {
  return evaluateMobileReleasePolicy(input, {
    enabled: env.mobileReleasePolicyEnabled,
    ios: {
      latestVersion: env.mobileIosLatestVersion,
      latestBuild: env.mobileIosLatestBuild,
      minimumSupportedVersion: env.mobileIosMinimumSupportedVersion,
      minimumSupportedBuild: env.mobileIosMinimumSupportedBuild,
      releaseNotes: {
        en: env.mobileUpdateMessageEn,
        fr: env.mobileUpdateMessageFr,
        es: env.mobileUpdateMessageEs,
      },
    },
    android: {
      latestVersion: env.mobileAndroidLatestVersion,
      latestBuild: env.mobileAndroidLatestBuild,
      minimumSupportedVersion: env.mobileAndroidMinimumSupportedVersion,
      minimumSupportedBuild: env.mobileAndroidMinimumSupportedBuild,
      releaseNotes: {
        en: env.mobileUpdateMessageEn,
        fr: env.mobileUpdateMessageFr,
        es: env.mobileUpdateMessageEs,
      },
    },
  });
}
