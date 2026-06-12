export const ACCOUNT_KINDS = ['individual', 'business_later'] as const;
export type AccountKind = typeof ACCOUNT_KINDS[number];

export const SUBSCRIPTION_TIERS = ['free', 'plus', 'plus_later', 'pro', 'business_later'] as const;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];

export const SUBSCRIPTION_STATUSES = ['none', 'trialing', 'active', 'past_due', 'canceled', 'expired'] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];

export const AI_ASSIST_TASK_TYPES = [
  'need_title',
  'need_description',
  'offer_title',
  'offer_description',
  'proposal_message',
  'translate_text',
  'category_tags',
  'safety_readability',
] as const;
export type AiAssistTaskType = typeof AI_ASSIST_TASK_TYPES[number];

export const AI_ASSIST_USAGE_STATUSES = ['reserved', 'completed', 'failed', 'refunded'] as const;
export type AiAssistUsageStatus = typeof AI_ASSIST_USAGE_STATUSES[number];

export const AI_ASSIST_QUOTA_COUNTED_STATUSES = ['completed'] as const satisfies readonly AiAssistUsageStatus[];

export type AiAssistQuotaSnapshot = {
  periodKey: string;
  resetAt: string;
  used: number;
  quota: number;
  remaining: number;
  isUnlimited: false;
};

export const PROFESSIONAL_STATUSES = ['none', 'pending_verification', 'verified', 'rejected', 'suspended'] as const;
export type ProfessionalStatus = typeof PROFESSIONAL_STATUSES[number];

export const IDENTITY_VERIFICATION_PROVIDERS = ['none', 'manual', 'stripe_identity', 'airwallex'] as const;
export type IdentityVerificationProvider = typeof IDENTITY_VERIFICATION_PROVIDERS[number];

export const IDENTITY_VERIFICATION_STATUSES = ['none', 'pending', 'verified', 'rejected', 'expired', 'cancelled'] as const;
export type IdentityVerificationStatus = typeof IDENTITY_VERIFICATION_STATUSES[number];

export type PlusSubscriptionFeatureFlags = {
  plusEnabled: boolean;
  plusPublic: boolean;
  aiAssistEnabled: boolean;
  customizationEnabled: boolean;
  adminGrantsEnabled: boolean;
  monthlyPriceCents: number;
  monthlyPriceCurrency: string;
  yearlyPriceCents: number;
  yearlyPriceCurrency: string;
  freeMonthlyAiAssistQuota: number;
  plusMonthlyAiAssistQuota: number;
};

export const PLUS_SUBSCRIPTION_DEFAULTS = {
  monthlyPriceCents: 499,
  monthlyPriceCurrency: 'eur',
  yearlyPriceCents: 3999,
  yearlyPriceCurrency: 'eur',
  freeMonthlyAiAssistQuota: 3,
  plusMonthlyAiAssistQuota: 75,
} as const;

export const PLUS_SUBSCRIPTION_FEATURE_DEFAULTS: PlusSubscriptionFeatureFlags = {
  plusEnabled: false,
  plusPublic: false,
  aiAssistEnabled: false,
  customizationEnabled: false,
  adminGrantsEnabled: false,
  ...PLUS_SUBSCRIPTION_DEFAULTS,
};

export type PlusAccessState = {
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
};

export type PlusAccessBlocker = 'not_on_plus_tier' | 'subscription_not_active';
export type PlusGateBlocker = 'plus_disabled' | 'plus_hidden' | PlusAccessBlocker;
export type PlusPrivateFeatureBlocker = PlusGateBlocker | 'feature_disabled';

export type PlusEntitlements = {
  aiAssist: boolean;
  customization: boolean;
  monthlyAiAssistQuota: number;
};

export type PlusGateState = PlusAccessState & {
  canSeePlusSurfaces: boolean;
  hasPlusAccess: boolean;
  blockers: PlusGateBlocker[];
  price: {
    monthlyCents: number;
    monthlyCurrency: string;
    yearlyCents: number;
    yearlyCurrency: string;
  };
  entitlements: PlusEntitlements;
};

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

export function normalizePlusAccessState(state?: Partial<PlusAccessState> | null): PlusAccessState {
  return {
    subscriptionTier: normalizeSubscriptionTier(state?.subscriptionTier),
    subscriptionStatus: normalizeSubscriptionStatus(state?.subscriptionStatus),
  };
}

export function isPlusEntitledTier(tier: SubscriptionTier): boolean {
  return tier === 'plus' || tier === 'pro';
}

export function isActiveSubscriptionStatus(status: SubscriptionStatus): boolean {
  return status === 'trialing' || status === 'active';
}

export function hasPlusAccess(state?: Partial<PlusAccessState> | null): boolean {
  const normalized = normalizePlusAccessState(state);
  return isPlusEntitledTier(normalized.subscriptionTier) && isActiveSubscriptionStatus(normalized.subscriptionStatus);
}

export function getPlusAccessBlockers(state?: Partial<PlusAccessState> | null): PlusAccessBlocker[] {
  const normalized = normalizePlusAccessState(state);
  const blockers: PlusAccessBlocker[] = [];
  if (!isPlusEntitledTier(normalized.subscriptionTier)) blockers.push('not_on_plus_tier');
  if (!isActiveSubscriptionStatus(normalized.subscriptionStatus)) blockers.push('subscription_not_active');
  return blockers;
}

export function getPlusAiAssistQuotaForPlan(
  state?: Partial<PlusAccessState> | null,
  features: Pick<PlusSubscriptionFeatureFlags, 'freeMonthlyAiAssistQuota' | 'plusMonthlyAiAssistQuota'> = PLUS_SUBSCRIPTION_FEATURE_DEFAULTS,
): number {
  return hasPlusAccess(state) ? features.plusMonthlyAiAssistQuota : features.freeMonthlyAiAssistQuota;
}

export function buildAiAssistPeriodKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getAiAssistPeriodResetAt(periodKey = buildAiAssistPeriodKey()): Date {
  const [rawYear, rawMonth] = periodKey.split('-');
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  }
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

export function buildAiAssistQuotaSnapshot(input: {
  used: number;
  quota: number;
  periodKey?: string;
}): AiAssistQuotaSnapshot {
  const periodKey = input.periodKey ?? buildAiAssistPeriodKey();
  const used = Math.max(0, Math.trunc(Number.isFinite(input.used) ? input.used : 0));
  const quota = Math.max(0, Math.trunc(Number.isFinite(input.quota) ? input.quota : 0));
  return {
    periodKey,
    resetAt: getAiAssistPeriodResetAt(periodKey).toISOString(),
    used,
    quota,
    remaining: Math.max(quota - used, 0),
    isUnlimited: false,
  };
}

export function canUseAiAssist(features: Pick<PlusSubscriptionFeatureFlags, 'plusEnabled' | 'aiAssistEnabled'>): boolean {
  return Boolean(features.plusEnabled && features.aiAssistEnabled);
}

export function getPlusEntitlements(features: PlusSubscriptionFeatureFlags, state?: Partial<PlusAccessState> | null): PlusEntitlements {
  const hasAccess = features.plusEnabled && hasPlusAccess(state);
  return {
    aiAssist: canUseAiAssist(features),
    customization: hasAccess && features.customizationEnabled,
    monthlyAiAssistQuota: getPlusAiAssistQuotaForPlan(state, features),
  };
}

export function canUsePlusPrivateFeature(input: {
  plusEnabled: boolean;
  featureEnabled: boolean;
  state?: Partial<PlusAccessState> | null;
}): boolean {
  return Boolean(input.plusEnabled && input.featureEnabled && hasPlusAccess(input.state));
}

export function canUseAgendaFeature(input: {
  plusEnabled: boolean;
  agendaEnabled: boolean;
  state?: Partial<PlusAccessState> | null;
}): boolean {
  return canUsePlusPrivateFeature({
    plusEnabled: input.plusEnabled,
    featureEnabled: input.agendaEnabled,
    state: input.state,
  });
}

export function getPlusPrivateFeatureBlockers(input: {
  plusEnabled: boolean;
  plusPublic?: boolean;
  featureEnabled: boolean;
  state?: Partial<PlusAccessState> | null;
}): PlusPrivateFeatureBlocker[] {
  const normalized = normalizePlusAccessState(input.state);
  const blockers: PlusPrivateFeatureBlocker[] = [];
  if (!input.plusEnabled) blockers.push('plus_disabled');
  if (input.plusPublic === false) blockers.push('plus_hidden');
  if (!input.featureEnabled) blockers.push('feature_disabled');
  blockers.push(...getPlusAccessBlockers(normalized));
  return blockers;
}

export function evaluatePlusGate(features: PlusSubscriptionFeatureFlags, state?: Partial<PlusAccessState> | null): PlusGateState {
  const normalized = normalizePlusAccessState(state);
  const accessBlockers = getPlusAccessBlockers(normalized);
  const blockers: PlusGateBlocker[] = [];

  if (!features.plusEnabled) blockers.push('plus_disabled');
  if (!features.plusPublic) blockers.push('plus_hidden');
  blockers.push(...accessBlockers);

  return {
    ...normalized,
    canSeePlusSurfaces: features.plusEnabled && features.plusPublic,
    hasPlusAccess: features.plusEnabled && hasPlusAccess(normalized),
    blockers,
    price: {
      monthlyCents: Number.isFinite(features.monthlyPriceCents) ? features.monthlyPriceCents : PLUS_SUBSCRIPTION_DEFAULTS.monthlyPriceCents,
      monthlyCurrency: features.monthlyPriceCurrency || PLUS_SUBSCRIPTION_DEFAULTS.monthlyPriceCurrency,
      yearlyCents: Number.isFinite(features.yearlyPriceCents) ? features.yearlyPriceCents : PLUS_SUBSCRIPTION_DEFAULTS.yearlyPriceCents,
      yearlyCurrency: features.yearlyPriceCurrency || PLUS_SUBSCRIPTION_DEFAULTS.yearlyPriceCurrency,
    },
    entitlements: getPlusEntitlements(features, normalized),
  };
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
    && isActiveSubscriptionStatus(normalized.subscriptionStatus);
}

export function getProAccessBlockers(state?: Partial<ProAccessState> | null): ProAccessBlocker[] {
  const normalized = normalizeProAccessState(state);
  const blockers: ProAccessBlocker[] = [];
  if (normalized.professionalStatus !== 'verified') blockers.push('identity_not_verified');
  if (normalized.subscriptionTier !== 'pro') blockers.push('not_on_pro_tier');
  if (!isActiveSubscriptionStatus(normalized.subscriptionStatus)) blockers.push('subscription_not_active');
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
