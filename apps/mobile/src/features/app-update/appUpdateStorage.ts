import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobilePlatform } from '@hellowhen/contracts';
import type { OptionalUpdateDismissal } from './appUpdatePolicy';

const OPTIONAL_UPDATE_DISMISSAL_KEY = 'hellowhen_mobile.appUpdate.dismissedOptional.v1';

function isOptionalUpdateDismissal(value: unknown): value is OptionalUpdateDismissal {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OptionalUpdateDismissal>;
  return (candidate.platform === 'ios' || candidate.platform === 'android')
    && typeof candidate.version === 'string'
    && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(candidate.version)
    && typeof candidate.build === 'number'
    && Number.isSafeInteger(candidate.build)
    && candidate.build > 0;
}

export async function readOptionalUpdateDismissal(platform: MobilePlatform) {
  try {
    const raw = await AsyncStorage.getItem(OPTIONAL_UPDATE_DISMISSAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isOptionalUpdateDismissal(parsed) || parsed.platform !== platform) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeOptionalUpdateDismissal(dismissal: OptionalUpdateDismissal) {
  await AsyncStorage.setItem(OPTIONAL_UPDATE_DISMISSAL_KEY, JSON.stringify(dismissal));
}
