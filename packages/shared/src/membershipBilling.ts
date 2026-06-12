import { normalizeSubscriptionTier, type SubscriptionTier } from './subscriptions.js';

export const MEMBERSHIP_ENTITLEMENT_SOURCES = [
  'manual_admin',
  'stripe',
  'apple_app_store',
  'google_play',
  'promo',
  'migration',
  'revenuecat_later',
] as const;
export type MembershipEntitlementSource = typeof MEMBERSHIP_ENTITLEMENT_SOURCES[number];

export const MEMBERSHIP_BILLING_PROVIDER_SOURCES = [
  'stripe',
  'apple_app_store',
  'google_play',
  'revenuecat_later',
] as const satisfies readonly MembershipEntitlementSource[];
export type MembershipBillingProviderSource = typeof MEMBERSHIP_BILLING_PROVIDER_SOURCES[number];

export const MEMBERSHIP_NON_BILLING_ENTITLEMENT_SOURCES = [
  'manual_admin',
  'promo',
  'migration',
] as const satisfies readonly MembershipEntitlementSource[];
export type MembershipNonBillingEntitlementSource = typeof MEMBERSHIP_NON_BILLING_ENTITLEMENT_SOURCES[number];

export const MEMBERSHIP_PURCHASE_CHANNELS = [
  'web',
  'ios',
  'android',
  'admin',
  'internal',
  'cross_platform_later',
] as const;
export type MembershipPurchaseChannel = typeof MEMBERSHIP_PURCHASE_CHANNELS[number];

export type MembershipEntitlementSourceMetadata = {
  source: MembershipEntitlementSource;
  displayName: string;
  channel: MembershipPurchaseChannel;
  billingProvider: boolean;
  userPurchasable: boolean;
  nativeStore: boolean;
  enabledByDefault: boolean;
  description: string;
};

export const MEMBERSHIP_ENTITLEMENT_SOURCE_METADATA = {
  manual_admin: {
    source: 'manual_admin',
    displayName: 'Manual admin grant',
    channel: 'admin',
    billingProvider: false,
    userPurchasable: false,
    nativeStore: false,
    enabledByDefault: true,
    description: 'Internal admin/test entitlement source. Does not process payments.',
  },
  stripe: {
    source: 'stripe',
    displayName: 'Stripe Billing',
    channel: 'web',
    billingProvider: true,
    userPurchasable: true,
    nativeStore: false,
    enabledByDefault: false,
    description: 'Future web/PWA subscription billing provider for Plus and Pro memberships.',
  },
  apple_app_store: {
    source: 'apple_app_store',
    displayName: 'Apple App Store',
    channel: 'ios',
    billingProvider: true,
    userPurchasable: true,
    nativeStore: true,
    enabledByDefault: false,
    description: 'Future iOS in-app subscription source for digital Membership features.',
  },
  google_play: {
    source: 'google_play',
    displayName: 'Google Play Billing',
    channel: 'android',
    billingProvider: true,
    userPurchasable: true,
    nativeStore: true,
    enabledByDefault: false,
    description: 'Future Android in-app subscription source for digital Membership features.',
  },
  promo: {
    source: 'promo',
    displayName: 'Promotional grant',
    channel: 'internal',
    billingProvider: false,
    userPurchasable: false,
    nativeStore: false,
    enabledByDefault: true,
    description: 'Internal promotional entitlement source. Does not process payments.',
  },
  migration: {
    source: 'migration',
    displayName: 'Migration grant',
    channel: 'internal',
    billingProvider: false,
    userPurchasable: false,
    nativeStore: false,
    enabledByDefault: true,
    description: 'Internal entitlement source for future data migrations or grandfathered accounts.',
  },
  revenuecat_later: {
    source: 'revenuecat_later',
    displayName: 'RevenueCat later',
    channel: 'cross_platform_later',
    billingProvider: true,
    userPurchasable: false,
    nativeStore: false,
    enabledByDefault: false,
    description: 'Optional future cross-platform entitlement aggregator. Not required for first billing implementation.',
  },
} as const satisfies Record<MembershipEntitlementSource, MembershipEntitlementSourceMetadata>;

export const MEMBERSHIP_BILLING_INTERVALS = ['monthly', 'yearly'] as const;
export type MembershipBillingInterval = typeof MEMBERSHIP_BILLING_INTERVALS[number];

export type PaidPersonalMembershipTier = Extract<SubscriptionTier, 'plus' | 'pro'>;

export const PAID_PERSONAL_MEMBERSHIP_TIERS = ['plus', 'pro'] as const satisfies readonly PaidPersonalMembershipTier[];

export const MEMBERSHIP_PRODUCT_HANDLES = [
  'hellowhen_plus_monthly',
  'hellowhen_plus_yearly',
  'hellowhen_pro_monthly',
  'hellowhen_pro_yearly',
] as const;
export type MembershipProductHandle = typeof MEMBERSHIP_PRODUCT_HANDLES[number];

export type MembershipProviderProductKeySet = {
  stripeLookupKey: string;
  appleProductId: string;
  googleProductId: string;
  revenueCatProductId: string;
};

export type MembershipProductMetadata = {
  handle: MembershipProductHandle;
  tier: PaidPersonalMembershipTier;
  interval: MembershipBillingInterval;
  displayName: string;
  description: string;
  providerProductKeys: MembershipProviderProductKeySet;
};

export const MEMBERSHIP_PRODUCT_METADATA = {
  hellowhen_plus_monthly: {
    handle: 'hellowhen_plus_monthly',
    tier: 'plus',
    interval: 'monthly',
    displayName: 'Plus monthly',
    description: 'Internal product handle for monthly Plus Membership.',
    providerProductKeys: {
      stripeLookupKey: 'hellowhen_plus_monthly',
      appleProductId: 'hellowhen.plus.monthly',
      googleProductId: 'hellowhen_plus_monthly',
      revenueCatProductId: 'hellowhen_plus_monthly',
    },
  },
  hellowhen_plus_yearly: {
    handle: 'hellowhen_plus_yearly',
    tier: 'plus',
    interval: 'yearly',
    displayName: 'Plus yearly',
    description: 'Internal product handle for yearly Plus Membership.',
    providerProductKeys: {
      stripeLookupKey: 'hellowhen_plus_yearly',
      appleProductId: 'hellowhen.plus.yearly',
      googleProductId: 'hellowhen_plus_yearly',
      revenueCatProductId: 'hellowhen_plus_yearly',
    },
  },
  hellowhen_pro_monthly: {
    handle: 'hellowhen_pro_monthly',
    tier: 'pro',
    interval: 'monthly',
    displayName: 'Pro monthly',
    description: 'Internal product handle for monthly Pro Membership.',
    providerProductKeys: {
      stripeLookupKey: 'hellowhen_pro_monthly',
      appleProductId: 'hellowhen.pro.monthly',
      googleProductId: 'hellowhen_pro_monthly',
      revenueCatProductId: 'hellowhen_pro_monthly',
    },
  },
  hellowhen_pro_yearly: {
    handle: 'hellowhen_pro_yearly',
    tier: 'pro',
    interval: 'yearly',
    displayName: 'Pro yearly',
    description: 'Internal product handle for yearly Pro Membership.',
    providerProductKeys: {
      stripeLookupKey: 'hellowhen_pro_yearly',
      appleProductId: 'hellowhen.pro.yearly',
      googleProductId: 'hellowhen_pro_yearly',
      revenueCatProductId: 'hellowhen_pro_yearly',
    },
  },
} as const satisfies Record<MembershipProductHandle, MembershipProductMetadata>;

export const MEMBERSHIP_TIER_PRIORITY = {
  free: 0,
  plus: 10,
  pro: 20,
} as const satisfies Record<Extract<SubscriptionTier, 'free' | 'plus' | 'pro'>, number>;

export const MEMBERSHIP_ENTITLEMENT_SOURCE_PRIORITY = {
  manual_admin: 100,
  revenuecat_later: 90,
  stripe: 80,
  apple_app_store: 80,
  google_play: 80,
  promo: 70,
  migration: 60,
} as const satisfies Record<MembershipEntitlementSource, number>;

export type MembershipProviderReference = {
  source: MembershipEntitlementSource;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  providerProductId?: string | null;
  providerPriceId?: string | null;
  lastProviderEventId?: string | null;
  lastProviderSyncAt?: string | Date | null;
};

export type MembershipEntitlementCandidate = MembershipProviderReference & {
  tier: SubscriptionTier;
  productHandle?: MembershipProductHandle | null;
  currentPeriodStart?: string | Date | null;
  currentPeriodEnd?: string | Date | null;
  cancelAtPeriodEnd?: boolean | null;
};

function includesValue<TValue extends string>(values: readonly TValue[], value: string | null | undefined): value is TValue {
  return values.includes(String(value ?? '').trim().toLowerCase() as TValue);
}

export function normalizeMembershipEntitlementSource(
  value: string | null | undefined,
): MembershipEntitlementSource {
  const normalized = String(value ?? '').trim().toLowerCase();
  return includesValue(MEMBERSHIP_ENTITLEMENT_SOURCES, normalized) ? normalized : 'manual_admin';
}

export function normalizeMembershipBillingProviderSource(
  value: string | null | undefined,
): MembershipBillingProviderSource {
  const normalized = normalizeMembershipEntitlementSource(value);
  return includesValue(MEMBERSHIP_BILLING_PROVIDER_SOURCES, normalized) ? normalized : 'stripe';
}
export function normalizeMembershipBillingInterval(
  value: string | null | undefined,
): MembershipBillingInterval {
  const normalized = String(value ?? '').trim().toLowerCase();
  return includesValue(MEMBERSHIP_BILLING_INTERVALS, normalized) ? normalized : 'monthly';
}

export function normalizeMembershipProductHandle(
  value: string | null | undefined,
): MembershipProductHandle | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  return includesValue(MEMBERSHIP_PRODUCT_HANDLES, normalized) ? normalized : null;
}

export function isMembershipBillingProviderSource(
  value: string | null | undefined,
): boolean {
  return includesValue(MEMBERSHIP_BILLING_PROVIDER_SOURCES, normalizeMembershipEntitlementSource(value));
}

export function isMembershipNativeStoreSource(value: string | null | undefined): boolean {
  const metadata = MEMBERSHIP_ENTITLEMENT_SOURCE_METADATA[normalizeMembershipEntitlementSource(value)];
  return metadata.nativeStore;
}

export function isMembershipWebBillingSource(value: string | null | undefined): boolean {
  return normalizeMembershipEntitlementSource(value) === 'stripe';
}

export function isMembershipManualEntitlementSource(value: string | null | undefined): boolean {
  return normalizeMembershipEntitlementSource(value) === 'manual_admin';
}

export function getMembershipEntitlementSourceMetadata(
  value: string | null | undefined,
): MembershipEntitlementSourceMetadata {
  return MEMBERSHIP_ENTITLEMENT_SOURCE_METADATA[normalizeMembershipEntitlementSource(value)];
}

export function getMembershipProductMetadata(
  value: string | null | undefined,
): MembershipProductMetadata | null {
  const handle = normalizeMembershipProductHandle(value);
  return handle ? MEMBERSHIP_PRODUCT_METADATA[handle] : null;
}

export function getMembershipProductHandleForTier(
  tier: string | null | undefined,
  interval: MembershipBillingInterval = 'monthly',
): MembershipProductHandle | null {
  const normalizedTier = normalizeSubscriptionTier(tier);
  if (normalizedTier !== 'plus' && normalizedTier !== 'pro') return null;
  return `hellowhen_${normalizedTier}_${interval}` as MembershipProductHandle;
}

export function getDefaultMembershipProductHandleForTier(
  tier: string | null | undefined,
): MembershipProductHandle | null {
  return getMembershipProductHandleForTier(tier, 'monthly');
}

export function getMembershipTierPriority(tier: string | null | undefined): number {
  const normalizedTier = normalizeSubscriptionTier(tier);
  if (normalizedTier === 'pro') return MEMBERSHIP_TIER_PRIORITY.pro;
  if (normalizedTier === 'plus') return MEMBERSHIP_TIER_PRIORITY.plus;
  return MEMBERSHIP_TIER_PRIORITY.free;
}

export function compareMembershipTierPriority(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return getMembershipTierPriority(left) - getMembershipTierPriority(right);
}

export function pickHigherMembershipTier(
  left: string | null | undefined,
  right: string | null | undefined,
): Extract<SubscriptionTier, 'free' | 'plus' | 'pro'> {
  return compareMembershipTierPriority(left, right) >= 0
    ? normalizePaidOrFreeMembershipTier(left)
    : normalizePaidOrFreeMembershipTier(right);
}

export function normalizePaidOrFreeMembershipTier(
  value: string | null | undefined,
): Extract<SubscriptionTier, 'free' | 'plus' | 'pro'> {
  const normalizedTier = normalizeSubscriptionTier(value);
  if (normalizedTier === 'pro') return 'pro';
  if (normalizedTier === 'plus') return 'plus';
  return 'free';
}

export function getMembershipEntitlementSourcePriority(value: string | null | undefined): number {
  return MEMBERSHIP_ENTITLEMENT_SOURCE_PRIORITY[normalizeMembershipEntitlementSource(value)];
}

export function compareMembershipEntitlementSourcePriority(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return getMembershipEntitlementSourcePriority(left) - getMembershipEntitlementSourcePriority(right);
}
