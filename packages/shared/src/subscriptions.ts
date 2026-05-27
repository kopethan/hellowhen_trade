export const ACCOUNT_KINDS = ['individual', 'business_later'] as const;
export type AccountKind = typeof ACCOUNT_KINDS[number];

export const SUBSCRIPTION_TIERS = ['free', 'plus_later', 'pro', 'business_later'] as const;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];

export const SUBSCRIPTION_STATUSES = ['none', 'trialing', 'active', 'past_due', 'canceled', 'expired'] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];

export const PROFESSIONAL_STATUSES = ['none', 'pending_verification', 'verified', 'rejected', 'suspended'] as const;
export type ProfessionalStatus = typeof PROFESSIONAL_STATUSES[number];

export const IDENTITY_VERIFICATION_PROVIDERS = ['none', 'manual', 'stripe_identity', 'airwallex'] as const;
export type IdentityVerificationProvider = typeof IDENTITY_VERIFICATION_PROVIDERS[number];

export const IDENTITY_VERIFICATION_STATUSES = ['none', 'pending', 'verified', 'rejected', 'expired', 'cancelled'] as const;
export type IdentityVerificationStatus = typeof IDENTITY_VERIFICATION_STATUSES[number];

export type ProSubscriptionFeatureFlags = {
  subscriptionsEnabled: boolean;
  proAccountsEnabled: boolean;
  proAccountsVisible: boolean;
  proTrialsEnabled: boolean;
  identityVerificationEnabled: boolean;
  monthlyPriceCents: number;
  monthlyPriceCurrency: string;
  trialDays: number;
};

export const PRO_SUBSCRIPTION_DEFAULTS = {
  monthlyPriceCents: 1499,
  monthlyPriceCurrency: 'eur',
  trialDays: 14,
} as const;

export const PRO_SUBSCRIPTION_FEATURE_DEFAULTS: ProSubscriptionFeatureFlags = {
  subscriptionsEnabled: false,
  proAccountsEnabled: false,
  proAccountsVisible: false,
  proTrialsEnabled: false,
  identityVerificationEnabled: false,
  ...PRO_SUBSCRIPTION_DEFAULTS,
};

export type ProAccessState = {
  professionalStatus: ProfessionalStatus;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
};

export type ProAccessBlocker = 'identity_not_verified' | 'not_on_pro_tier' | 'subscription_not_active';

export type ProGateBlocker =
  | 'subscriptions_disabled'
  | 'pro_accounts_disabled'
  | 'pro_accounts_hidden'
  | ProAccessBlocker;

export type ProGateState = ProAccessState & {
  canSeeProSurfaces: boolean;
  hasProAccess: boolean;
  blockers: ProGateBlocker[];
  price: {
    monthlyCents: number;
    currency: string;
  };
  trialDays: number;
};

export type ProSubscriptionSnapshot = {
  config: ProSubscriptionFeatureFlags;
  state: ProAccessState & {
    accountKind?: AccountKind;
    professionalStatusUpdatedAt?: string | Date | null;
    subscriptionStatusUpdatedAt?: string | Date | null;
  };
  professionalProfile?: Record<string, unknown> | null;
  subscriptionState?: Record<string, unknown> | null;
  identityVerificationState?: Record<string, unknown> | null;
  access: {
    hasProAccess: boolean;
    blockers: ProAccessBlocker[];
  };
};

export function normalizeAccountKind(value: string | undefined | null): AccountKind {
  const normalized = String(value ?? 'individual').trim().toLowerCase();
  return (ACCOUNT_KINDS as readonly string[]).includes(normalized) ? normalized as AccountKind : 'individual';
}

export function normalizeSubscriptionTier(value: string | undefined | null): SubscriptionTier {
  const normalized = String(value ?? 'free').trim().toLowerCase();
  return (SUBSCRIPTION_TIERS as readonly string[]).includes(normalized) ? normalized as SubscriptionTier : 'free';
}

export function normalizeSubscriptionStatus(value: string | undefined | null): SubscriptionStatus {
  const normalized = String(value ?? 'none').trim().toLowerCase();
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(normalized) ? normalized as SubscriptionStatus : 'none';
}

export function normalizeProfessionalStatus(value: string | undefined | null): ProfessionalStatus {
  const normalized = String(value ?? 'none').trim().toLowerCase();
  return (PROFESSIONAL_STATUSES as readonly string[]).includes(normalized) ? normalized as ProfessionalStatus : 'none';
}

export function normalizeIdentityVerificationProvider(value: string | undefined | null): IdentityVerificationProvider {
  const normalized = String(value ?? 'none').trim().toLowerCase();
  return (IDENTITY_VERIFICATION_PROVIDERS as readonly string[]).includes(normalized) ? normalized as IdentityVerificationProvider : 'none';
}

export function normalizeIdentityVerificationStatus(value: string | undefined | null): IdentityVerificationStatus {
  const normalized = String(value ?? 'none').trim().toLowerCase();
  return (IDENTITY_VERIFICATION_STATUSES as readonly string[]).includes(normalized) ? normalized as IdentityVerificationStatus : 'none';
}

export function normalizeProAccessState(state?: Partial<ProAccessState> | null): ProAccessState {
  return {
    professionalStatus: normalizeProfessionalStatus(state?.professionalStatus),
    subscriptionTier: normalizeSubscriptionTier(state?.subscriptionTier),
    subscriptionStatus: normalizeSubscriptionStatus(state?.subscriptionStatus),
  };
}

export function hasProAccess(state?: Partial<ProAccessState> | null): boolean {
  const normalized = normalizeProAccessState(state);
  return normalized.professionalStatus === 'verified'
    && normalized.subscriptionTier === 'pro'
    && (normalized.subscriptionStatus === 'trialing' || normalized.subscriptionStatus === 'active');
}

export function getProAccessBlockers(state?: Partial<ProAccessState> | null): ProAccessBlocker[] {
  const normalized = normalizeProAccessState(state);
  const blockers: ProAccessBlocker[] = [];
  if (normalized.professionalStatus !== 'verified') blockers.push('identity_not_verified');
  if (normalized.subscriptionTier !== 'pro') blockers.push('not_on_pro_tier');
  if (normalized.subscriptionStatus !== 'trialing' && normalized.subscriptionStatus !== 'active') blockers.push('subscription_not_active');
  return blockers;
}

export function evaluateProGate(features: ProSubscriptionFeatureFlags, state?: Partial<ProAccessState> | null): ProGateState {
  const normalized = normalizeProAccessState(state);
  const accessBlockers = getProAccessBlockers(normalized);
  const blockers: ProGateBlocker[] = [];

  if (!features.subscriptionsEnabled) blockers.push('subscriptions_disabled');
  if (!features.proAccountsEnabled) blockers.push('pro_accounts_disabled');
  if (!features.proAccountsVisible) blockers.push('pro_accounts_hidden');
  blockers.push(...accessBlockers);

  return {
    ...normalized,
    canSeeProSurfaces: features.subscriptionsEnabled && features.proAccountsEnabled && features.proAccountsVisible,
    hasProAccess: features.subscriptionsEnabled && features.proAccountsEnabled && hasProAccess(normalized),
    blockers,
    price: {
      monthlyCents: Number.isFinite(features.monthlyPriceCents) ? features.monthlyPriceCents : PRO_SUBSCRIPTION_DEFAULTS.monthlyPriceCents,
      currency: features.monthlyPriceCurrency || PRO_SUBSCRIPTION_DEFAULTS.monthlyPriceCurrency,
    },
    trialDays: Number.isFinite(features.trialDays) ? features.trialDays : PRO_SUBSCRIPTION_DEFAULTS.trialDays,
  };
}
