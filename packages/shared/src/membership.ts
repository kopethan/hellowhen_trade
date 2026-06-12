import {
  normalizeAccountKind,
  normalizeSubscriptionTier,
  type AccountKind,
  type SubscriptionTier,
} from './subscriptions.js';

export const PERSONAL_MEMBERSHIP_TIERS = ['free', 'plus', 'pro'] as const satisfies readonly SubscriptionTier[];
export type PersonalMembershipTier = typeof PERSONAL_MEMBERSHIP_TIERS[number];

export const LEGACY_MEMBERSHIP_PLACEHOLDER_TIERS = ['plus_later', 'business_later'] as const satisfies readonly SubscriptionTier[];
export type LegacyMembershipPlaceholderTier = typeof LEGACY_MEMBERSHIP_PLACEHOLDER_TIERS[number];

export const ACCOUNT_IDENTITY_TYPES = ['personal', 'business_organization'] as const;
export type AccountIdentityType = typeof ACCOUNT_IDENTITY_TYPES[number];

export const HANDLE_NAMESPACES = ['personal', 'organization'] as const;
export type HandleNamespace = typeof HANDLE_NAMESPACES[number];

export type MembershipDisplayKind = 'personal_tier' | 'account_identity';
export type MembershipFeatureGroup = 'core' | 'plus' | 'pro' | 'business';
export type MembershipFeatureAvailability = 'included' | 'limited' | 'upgrade' | 'future';

export const MEMBERSHIP_FEATURE_KEYS = [
  'need_offer_trades',
  'public_profile',
  'safety_moderation',
  'saved_library',
  'saved_collections',
  'agenda',
  'ai_assistance',
  'card_customization',
  'professional_profile',
  'identity_verification',
  'pro_trade_packages',
  'organization_namespace',
  'organization_profile',
  'business_badge',
  'team_members',
  'business_mini_app',
] as const;
export type MembershipFeatureKey = typeof MEMBERSHIP_FEATURE_KEYS[number];

export type MembershipFeatureMetadata = {
  key: MembershipFeatureKey;
  label: string;
  shortLabel: string;
  description: string;
  group: MembershipFeatureGroup;
};

export const MEMBERSHIP_FEATURE_CATALOG = {
  need_offer_trades: {
    key: 'need_offer_trades',
    label: 'Need + Offer trades',
    shortLabel: 'Trades',
    description: 'Post what you need, what you offer, and connect around possible exchanges.',
    group: 'core',
  },
  public_profile: {
    key: 'public_profile',
    label: 'Personal public profile',
    shortLabel: 'Profile',
    description: 'A personal profile and handle in the personal namespace.',
    group: 'core',
  },
  safety_moderation: {
    key: 'safety_moderation',
    label: 'Safety and moderation tools',
    shortLabel: 'Safety',
    description: 'Reporting, moderation, restricted-account guards, and safer private exchanges.',
    group: 'core',
  },
  saved_library: {
    key: 'saved_library',
    label: 'Saved Library',
    shortLabel: 'Saved',
    description: 'Privately save trades, needs, offers, and people for later.',
    group: 'plus',
  },
  saved_collections: {
    key: 'saved_collections',
    label: 'Saved collections',
    shortLabel: 'Collections',
    description: 'Group saved items into private collections.',
    group: 'plus',
  },
  agenda: {
    key: 'agenda',
    label: 'Agenda',
    shortLabel: 'Agenda',
    description: 'Organize trades, reminders, follow-ups, and deadlines privately.',
    group: 'plus',
  },
  ai_assistance: {
    key: 'ai_assistance',
    label: 'Advanced AI assistance',
    shortLabel: 'AI assist',
    description: 'Get help drafting and improving needs, offers, and proposal messages.',
    group: 'plus',
  },
  card_customization: {
    key: 'card_customization',
    label: 'Card customization',
    shortLabel: 'Customization',
    description: 'Use approved Plus presentation options for inventory and trade cards.',
    group: 'plus',
  },
  professional_profile: {
    key: 'professional_profile',
    label: 'Professional profile',
    shortLabel: 'Pro profile',
    description: 'Add professional positioning and credibility details to a personal account.',
    group: 'pro',
  },
  identity_verification: {
    key: 'identity_verification',
    label: 'Identity verification',
    shortLabel: 'Verification',
    description: 'Optional verification foundation for professional trust signals.',
    group: 'pro',
  },
  pro_trade_packages: {
    key: 'pro_trade_packages',
    label: 'Pro trade packages',
    shortLabel: 'Packages',
    description: 'Bundle supporting needs and offers into richer proposal packages.',
    group: 'pro',
  },
  organization_namespace: {
    key: 'organization_namespace',
    label: 'Organization handle namespace',
    shortLabel: 'Org handle',
    description: 'Separate organization handles from personal user handles.',
    group: 'business',
  },
  organization_profile: {
    key: 'organization_profile',
    label: 'Organization profile',
    shortLabel: 'Org profile',
    description: 'A dedicated profile area for businesses, brands, and organizations.',
    group: 'business',
  },
  business_badge: {
    key: 'business_badge',
    label: 'Business badge',
    shortLabel: 'Business badge',
    description: 'Make organization identity clear wherever business content appears.',
    group: 'business',
  },
  team_members: {
    key: 'team_members',
    label: 'Team members',
    shortLabel: 'Team',
    description: 'Future-safe team membership metadata for organization accounts.',
    group: 'business',
  },
  business_mini_app: {
    key: 'business_mini_app',
    label: 'Business mini-app/page',
    shortLabel: 'Mini-app',
    description: 'Future organization app/page surface inside Hellowhen.',
    group: 'business',
  },
} as const satisfies Record<MembershipFeatureKey, MembershipFeatureMetadata>;

export type MembershipFeatureInclusion = {
  key: MembershipFeatureKey;
  availability: MembershipFeatureAvailability;
  note?: string;
};

export type PersonalMembershipTierMetadata = {
  kind: 'personal_tier';
  tier: PersonalMembershipTier;
  displayName: string;
  shortName: string;
  badgeLabel: string;
  description: string;
  paid: boolean;
  featured: boolean;
  featureInclusions: readonly MembershipFeatureInclusion[];
};

export type HandleNamespaceMetadata = {
  namespace: HandleNamespace;
  label: string;
  routePrefix: string;
  pathPattern: string;
  examplePath: string;
  currentLegacyRoutePrefix?: string;
  currentLegacyPathPattern?: string;
  currentLegacyExamplePath?: string;
};

export const HANDLE_NAMESPACE_METADATA = {
  personal: {
    namespace: 'personal',
    label: 'Personal handle',
    routePrefix: '/u',
    pathPattern: '/u/{handle}',
    examplePath: '/u/apple',
  },
  organization: {
    namespace: 'organization',
    label: 'Organization handle',
    routePrefix: '/org',
    pathPattern: '/org/{handle}',
    examplePath: '/org/apple',
    currentLegacyRoutePrefix: '/b',
    currentLegacyPathPattern: '/b/{handle}',
    currentLegacyExamplePath: '/b/apple',
  },
} as const satisfies Record<HandleNamespace, HandleNamespaceMetadata>;

export type AccountIdentityMetadata = {
  kind: 'account_identity';
  identityType: AccountIdentityType;
  accountKind: AccountKind;
  displayName: string;
  shortName: string;
  badgeLabel: string;
  description: string;
  handleNamespace: HandleNamespace;
  personalTier: false;
  featureInclusions: readonly MembershipFeatureInclusion[];
};

export const ACCOUNT_IDENTITY_TYPE_BY_ACCOUNT_KIND = {
  individual: 'personal',
  business_later: 'business_organization',
} as const satisfies Record<AccountKind, AccountIdentityType>;

export const ACCOUNT_KIND_BY_ACCOUNT_IDENTITY_TYPE = {
  personal: 'individual',
  business_organization: 'business_later',
} as const satisfies Record<AccountIdentityType, AccountKind>;

const CORE_PERSONAL_FEATURES = [
  { key: 'need_offer_trades', availability: 'included' },
  { key: 'public_profile', availability: 'included' },
  { key: 'safety_moderation', availability: 'included' },
] as const satisfies readonly MembershipFeatureInclusion[];

const PLUS_PERSONAL_FEATURES = [
  { key: 'saved_library', availability: 'included' },
  { key: 'saved_collections', availability: 'included' },
  { key: 'agenda', availability: 'included' },
  { key: 'ai_assistance', availability: 'included' },
  { key: 'card_customization', availability: 'included' },
] as const satisfies readonly MembershipFeatureInclusion[];

const PRO_PERSONAL_FEATURES = [
  { key: 'professional_profile', availability: 'included' },
  { key: 'identity_verification', availability: 'included' },
  { key: 'pro_trade_packages', availability: 'included' },
] as const satisfies readonly MembershipFeatureInclusion[];

export const PERSONAL_MEMBERSHIP_TIER_METADATA = {
  free: {
    kind: 'personal_tier',
    tier: 'free',
    displayName: 'Free / Basic',
    shortName: 'Basic',
    badgeLabel: 'Basic',
    description: 'Core personal account for posting needs, offers, and exchanges.',
    paid: false,
    featured: false,
    featureInclusions: [
      ...CORE_PERSONAL_FEATURES,
      { key: 'saved_library', availability: 'upgrade', note: 'Plus private organization feature.' },
      { key: 'agenda', availability: 'upgrade', note: 'Plus private organization feature.' },
      { key: 'ai_assistance', availability: 'upgrade', note: 'Plus assistance feature.' },
    ],
  },
  plus: {
    kind: 'personal_tier',
    tier: 'plus',
    displayName: 'Plus',
    shortName: 'Plus',
    badgeLabel: 'Plus',
    description: 'Personal membership for private organization, assistance, and customization tools.',
    paid: true,
    featured: true,
    featureInclusions: [
      ...CORE_PERSONAL_FEATURES,
      ...PLUS_PERSONAL_FEATURES,
    ],
  },
  pro: {
    kind: 'personal_tier',
    tier: 'pro',
    displayName: 'Pro',
    shortName: 'Pro',
    badgeLabel: 'Pro',
    description: 'Professional personal membership with Plus features and pro trust/package foundations.',
    paid: true,
    featured: false,
    featureInclusions: [
      ...CORE_PERSONAL_FEATURES,
      ...PLUS_PERSONAL_FEATURES,
      ...PRO_PERSONAL_FEATURES,
    ],
  },
} as const satisfies Record<PersonalMembershipTier, PersonalMembershipTierMetadata>;

export const ACCOUNT_IDENTITY_METADATA = {
  personal: {
    kind: 'account_identity',
    identityType: 'personal',
    accountKind: 'individual',
    displayName: 'Personal account',
    shortName: 'Personal',
    badgeLabel: 'Personal',
    description: 'A person using Hellowhen with a personal profile and personal handle namespace.',
    handleNamespace: 'personal',
    personalTier: false,
    featureInclusions: [
      { key: 'public_profile', availability: 'included' },
    ],
  },
  business_organization: {
    kind: 'account_identity',
    identityType: 'business_organization',
    accountKind: 'business_later',
    displayName: 'Business / organization account',
    shortName: 'Business',
    badgeLabel: 'Business',
    description: 'A separate organization identity with its own handle namespace, badge, profile, and future team/app surfaces.',
    handleNamespace: 'organization',
    personalTier: false,
    featureInclusions: [
      { key: 'organization_namespace', availability: 'included', note: 'Separate from personal /u handles.' },
      { key: 'organization_profile', availability: 'included' },
      { key: 'business_badge', availability: 'included' },
      { key: 'team_members', availability: 'future' },
      { key: 'business_mini_app', availability: 'future' },
    ],
  },
} as const satisfies Record<AccountIdentityType, AccountIdentityMetadata>;

export const MEMBERSHIP_DISPLAY_CARD_KEYS = ['free', 'plus', 'pro', 'business'] as const;
export type MembershipDisplayCardKey = typeof MEMBERSHIP_DISPLAY_CARD_KEYS[number];
export type MembershipDisplayCard = PersonalMembershipTierMetadata | typeof ACCOUNT_IDENTITY_METADATA.business_organization;

export function isPersonalMembershipTier(value: string | null | undefined): value is PersonalMembershipTier {
  const normalized = normalizeSubscriptionTier(value);
  return (PERSONAL_MEMBERSHIP_TIERS as readonly string[]).includes(normalized);
}

export function isLegacyMembershipPlaceholderTier(value: string | null | undefined): value is LegacyMembershipPlaceholderTier {
  const normalized = normalizeSubscriptionTier(value);
  return (LEGACY_MEMBERSHIP_PLACEHOLDER_TIERS as readonly string[]).includes(normalized);
}

export function normalizePersonalMembershipTier(value: string | null | undefined): PersonalMembershipTier {
  const normalized = normalizeSubscriptionTier(value);
  return isPersonalMembershipTier(normalized) ? normalized : 'free';
}

export function getPersonalMembershipTierMetadata(value: string | null | undefined): PersonalMembershipTierMetadata {
  return PERSONAL_MEMBERSHIP_TIER_METADATA[normalizePersonalMembershipTier(value)];
}

export function getAccountIdentityTypeForKind(value: string | null | undefined): AccountIdentityType {
  return ACCOUNT_IDENTITY_TYPE_BY_ACCOUNT_KIND[normalizeAccountKind(value)];
}

export function getAccountIdentityMetadata(value: string | null | undefined): AccountIdentityMetadata {
  return ACCOUNT_IDENTITY_METADATA[getAccountIdentityTypeForKind(value)];
}

export function getMembershipDisplayCard(key: MembershipDisplayCardKey): MembershipDisplayCard {
  if (key === 'business') return ACCOUNT_IDENTITY_METADATA.business_organization;
  return PERSONAL_MEMBERSHIP_TIER_METADATA[key];
}

export function listMembershipDisplayCards(): MembershipDisplayCard[] {
  return MEMBERSHIP_DISPLAY_CARD_KEYS.map((key) => getMembershipDisplayCard(key));
}
