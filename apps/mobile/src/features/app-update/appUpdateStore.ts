import type { MobilePlatform } from '@hellowhen/contracts';

const IOS_APP_STORE_ID = '6781399122';
const ANDROID_PACKAGE_NAME = 'com.hellowhen.app';

type OpenUrl = (url: string) => Promise<unknown>;

export function getAppUpdateStoreUrls(platform: MobilePlatform) {
  if (platform === 'ios') {
    return [
      `itms-apps://apps.apple.com/app/id${IOS_APP_STORE_ID}`,
      `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`,
    ] as const;
  }

  return [
    `market://details?id=${ANDROID_PACKAGE_NAME}`,
    `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`,
  ] as const;
}

export async function openAppUpdateStore(platform: MobilePlatform, openUrl: OpenUrl) {
  const urls = getAppUpdateStoreUrls(platform);
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      await openUrl(url);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not open the app store.');
}
