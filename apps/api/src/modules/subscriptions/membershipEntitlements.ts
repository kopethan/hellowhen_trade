import {
  getMembershipEntitlementSourceMetadata,
  getMembershipEntitlementSourcePriority,
  getMembershipTierPriority,
  normalizeMembershipEntitlementSource,
  normalizeSubscriptionStatus,
  normalizeSubscriptionTier,
  type MembershipEntitlementSource,
  type SubscriptionStatus,
  type SubscriptionTier,
} from '@hellowhen/shared';

export const membershipEntitlementUserSelect = {
  id: true,
  subscriptionTier: true,
  subscriptionStatus: true,
  subscriptionStatusUpdatedAt: true,
  subscriptionState: {
    select: {
      id: true,
      tier: true,
      status: true,
      provider: true,
      externalCustomerId: true,
      externalSubscriptionId: true,
      currentPeriodStartedAt: true,
      currentPeriodEndsAt: true,
      trialStartedAt: true,
      trialEndsAt: true,
      canceledAt: true,
      pastDueAt: true,
      expiresAt: true,
      lastSyncedAt: true,
      adminNote: true,
    },
  },
} as const;

export type MembershipSubscriptionStateRow = {
  id: string;
  tier: string | null;
  status: string | null;
  provider: string | null;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  currentPeriodStartedAt?: Date | string | null;
  currentPeriodEndsAt?: Date | string | null;
  trialStartedAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  canceledAt?: Date | string | null;
  pastDueAt?: Date | string | null;
  expiresAt?: Date | string | null;
  lastSyncedAt?: Date | string | null;
  adminNote?: string | null;
};

export type MembershipEntitlementUserRow = {
  id: string;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  subscriptionStatusUpdatedAt?: Date | string | null;
  subscriptionState?: MembershipSubscriptionStateRow | null;
};

export type MembershipEntitlementAccessState = {
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
};

export type MembershipEntitlementCandidate = MembershipEntitlementAccessState & {
  source: MembershipEntitlementSource;
  sourceLabel: string;
  candidateKind: 'user_app_state' | 'subscription_state';
  subscriptionStateId?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodStartedAt?: Date | string | null;
  currentPeriodEndsAt?: Date | string | null;
  trialStartedAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  canceledAt?: Date | string | null;
  pastDueAt?: Date | string | null;
  expiresAt?: Date | string | null;
  lastSyncedAt?: Date | string | null;
  adminNote?: string | null;
  activePaidAccess: boolean;
  tierPriority: number;
  sourcePriority: number;
  statusReason: 'stored_status' | 'period_still_active' | 'period_expired' | 'no_entitlement';
};

export type MembershipEntitlementCandidateSummary = {
  source: MembershipEntitlementSource;
  sourceLabel: string;
  candidateKind: MembershipEntitlementCandidate['candidateKind'];
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  activePaidAccess: boolean;
  statusReason: MembershipEntitlementCandidate['statusReason'];
  currentPeriodEndsAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
};

export type MembershipEntitlementSerialized = {
  source: MembershipEntitlementSource;
  sourceLabel: string;
  provider: MembershipEntitlementResolution['provider'];
  accessState: MembershipEntitlementAccessState;
  activePaidAccess: boolean;
  selectedCandidateKind: MembershipEntitlementCandidate['candidateKind'];
  selectedCandidate: MembershipEntitlementCandidateSummary;
  candidates: MembershipEntitlementCandidateSummary[];
  reconciliation: MembershipEntitlementResolution['reconciliation'];
};

export type MembershipEntitlementResolution = {
  userId: string;
  appState: MembershipEntitlementAccessState & {
    subscriptionStatusUpdatedAt?: Date | string | null;
  };
  accessState: MembershipEntitlementAccessState;
  source: MembershipEntitlementSource;
  sourceLabel: string;
  provider: {
    source: MembershipEntitlementSource;
    billingProvider: boolean;
    nativeStore: boolean;
    channel: string;
  };
  activePaidAccess: boolean;
  candidates: MembershipEntitlementCandidate[];
  selectedCandidateKind: MembershipEntitlementCandidate['candidateKind'];
  reconciliation: {
    usedSubscriptionState: boolean;
    usedUserAppStateFallback: boolean;
    appStateDiffersFromAccessState: boolean;
    reason: 'subscription_state_selected' | 'user_app_state_selected' | 'free_or_inactive';
    selectionRule: 'active_paid_higher_tier_source_priority' | 'free_or_inactive_fallback';
    appStateRecommendation: 'in_sync' | 'sync_user_app_state_from_subscription_state' | 'keep_user_app_state_fallback';
    candidateCount: number;
    activeCandidateCount: number;
  };
};

type MembershipEntitlementClient = {
  user: {
    findUnique: (args: unknown) => Promise<MembershipEntitlementUserRow | null>;
  };
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFuture(value: Date | string | null | undefined, now: Date) {
  const date = toDate(value);
  return Boolean(date && date.getTime() > now.getTime());
}

function isPastOrNow(value: Date | string | null | undefined, now: Date) {
  const date = toDate(value);
  return Boolean(date && date.getTime() <= now.getTime());
}

function isActiveStatus(status: SubscriptionStatus) {
  return status === 'trialing' || status === 'active';
}

function hasPaidTier(tier: SubscriptionTier) {
  return tier === 'plus' || tier === 'pro';
}

function normalizeStatusForPeriod(input: {
  status: string | null | undefined;
  currentPeriodEndsAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  now: Date;
}): { status: SubscriptionStatus; reason: MembershipEntitlementCandidate['statusReason'] } {
  const storedStatus = normalizeSubscriptionStatus(input.status);
  const latestKnownEndAt = input.expiresAt ?? input.currentPeriodEndsAt ?? input.trialEndsAt;

  if ((storedStatus === 'canceled' || storedStatus === 'active' || storedStatus === 'trialing') && isFuture(latestKnownEndAt, input.now)) {
    return {
      status: storedStatus === 'trialing' ? 'trialing' : 'active',
      reason: storedStatus === 'canceled' ? 'period_still_active' : 'stored_status',
    };
  }

  if (isActiveStatus(storedStatus) && isPastOrNow(latestKnownEndAt, input.now)) {
    return { status: 'expired', reason: 'period_expired' };
  }

  if (storedStatus === 'none') return { status: storedStatus, reason: 'no_entitlement' };
  return { status: storedStatus, reason: 'stored_status' };
}

function buildCandidate(input: {
  tier: string | null | undefined;
  status: string | null | undefined;
  source: string | null | undefined;
  candidateKind: MembershipEntitlementCandidate['candidateKind'];
  now: Date;
  subscriptionStateId?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodStartedAt?: Date | string | null;
  currentPeriodEndsAt?: Date | string | null;
  trialStartedAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  canceledAt?: Date | string | null;
  pastDueAt?: Date | string | null;
  expiresAt?: Date | string | null;
  lastSyncedAt?: Date | string | null;
  adminNote?: string | null;
}): MembershipEntitlementCandidate {
  const source = normalizeMembershipEntitlementSource(input.source);
  const sourceMetadata = getMembershipEntitlementSourceMetadata(source);
  const subscriptionTier = normalizeSubscriptionTier(input.tier);
  const normalizedStatus = normalizeStatusForPeriod({
    status: input.status,
    currentPeriodEndsAt: input.currentPeriodEndsAt,
    trialEndsAt: input.trialEndsAt,
    expiresAt: input.expiresAt,
    now: input.now,
  });
  const tierPriority = getMembershipTierPriority(subscriptionTier);
  const sourcePriority = getMembershipEntitlementSourcePriority(source);
  const activePaidAccess = hasPaidTier(subscriptionTier) && isActiveStatus(normalizedStatus.status);

  return {
    source,
    sourceLabel: sourceMetadata.displayName,
    candidateKind: input.candidateKind,
    subscriptionStateId: input.subscriptionStateId ?? null,
    providerCustomerId: input.providerCustomerId ?? null,
    providerSubscriptionId: input.providerSubscriptionId ?? null,
    subscriptionTier,
    subscriptionStatus: normalizedStatus.status,
    currentPeriodStartedAt: input.currentPeriodStartedAt ?? null,
    currentPeriodEndsAt: input.currentPeriodEndsAt ?? null,
    trialStartedAt: input.trialStartedAt ?? null,
    trialEndsAt: input.trialEndsAt ?? null,
    canceledAt: input.canceledAt ?? null,
    pastDueAt: input.pastDueAt ?? null,
    expiresAt: input.expiresAt ?? null,
    lastSyncedAt: input.lastSyncedAt ?? null,
    adminNote: input.adminNote ?? null,
    activePaidAccess,
    tierPriority,
    sourcePriority,
    statusReason: normalizedStatus.reason,
  };
}

function compareCandidates(left: MembershipEntitlementCandidate, right: MembershipEntitlementCandidate) {
  if (left.activePaidAccess !== right.activePaidAccess) return left.activePaidAccess ? 1 : -1;
  if (left.tierPriority !== right.tierPriority) return left.tierPriority - right.tierPriority;
  if (left.sourcePriority !== right.sourcePriority) return left.sourcePriority - right.sourcePriority;
  if (left.candidateKind !== right.candidateKind) return left.candidateKind === 'subscription_state' ? 1 : -1;
  return 0;
}

function summarizeCandidate(candidate: MembershipEntitlementCandidate): MembershipEntitlementCandidateSummary {
  return {
    source: candidate.source,
    sourceLabel: candidate.sourceLabel,
    candidateKind: candidate.candidateKind,
    subscriptionTier: candidate.subscriptionTier,
    subscriptionStatus: candidate.subscriptionStatus,
    activePaidAccess: candidate.activePaidAccess,
    statusReason: candidate.statusReason,
    currentPeriodEndsAt: candidate.currentPeriodEndsAt ?? null,
    trialEndsAt: candidate.trialEndsAt ?? null,
    expiresAt: candidate.expiresAt ?? null,
    providerCustomerId: candidate.providerCustomerId ?? null,
    providerSubscriptionId: candidate.providerSubscriptionId ?? null,
  };
}

function resolveAppStateRecommendation(input: {
  selected: MembershipEntitlementCandidate;
  appStateDiffersFromAccessState: boolean;
}): MembershipEntitlementResolution['reconciliation']['appStateRecommendation'] {
  if (!input.appStateDiffersFromAccessState) return 'in_sync';
  if (input.selected.candidateKind === 'subscription_state') return 'sync_user_app_state_from_subscription_state';
  return 'keep_user_app_state_fallback';
}

export function resolveMembershipEntitlement(
  user: MembershipEntitlementUserRow,
  options: { now?: Date } = {},
): MembershipEntitlementResolution {
  const now = options.now ?? new Date();
  const appState = {
    subscriptionTier: normalizeSubscriptionTier(user.subscriptionTier),
    subscriptionStatus: normalizeSubscriptionStatus(user.subscriptionStatus),
    subscriptionStatusUpdatedAt: user.subscriptionStatusUpdatedAt ?? null,
  };

  const userCandidate = buildCandidate({
    tier: appState.subscriptionTier,
    status: appState.subscriptionStatus,
    source: user.subscriptionState?.provider ?? 'manual_admin',
    candidateKind: 'user_app_state',
    now,
  });

  const candidates = [userCandidate];
  const state = user.subscriptionState;
  if (state) {
    candidates.push(buildCandidate({
      tier: state.tier,
      status: state.status,
      source: state.provider ?? 'manual_admin',
      candidateKind: 'subscription_state',
      now,
      subscriptionStateId: state.id,
      providerCustomerId: state.externalCustomerId ?? null,
      providerSubscriptionId: state.externalSubscriptionId ?? null,
      currentPeriodStartedAt: state.currentPeriodStartedAt ?? null,
      currentPeriodEndsAt: state.currentPeriodEndsAt ?? null,
      trialStartedAt: state.trialStartedAt ?? null,
      trialEndsAt: state.trialEndsAt ?? null,
      canceledAt: state.canceledAt ?? null,
      pastDueAt: state.pastDueAt ?? null,
      expiresAt: state.expiresAt ?? null,
      lastSyncedAt: state.lastSyncedAt ?? null,
      adminNote: state.adminNote ?? null,
    }));
  }

  const selected = [...candidates].sort(compareCandidates).at(-1) ?? userCandidate;
  const sourceMetadata = getMembershipEntitlementSourceMetadata(selected.source);
  const appStateDiffersFromAccessState = appState.subscriptionTier !== selected.subscriptionTier
    || appState.subscriptionStatus !== selected.subscriptionStatus;
  const reason = selected.activePaidAccess
    ? selected.candidateKind === 'subscription_state' ? 'subscription_state_selected' : 'user_app_state_selected'
    : 'free_or_inactive';
  const activeCandidateCount = candidates.filter((candidate) => candidate.activePaidAccess).length;

  return {
    userId: user.id,
    appState,
    accessState: {
      subscriptionTier: selected.subscriptionTier,
      subscriptionStatus: selected.subscriptionStatus,
    },
    source: selected.source,
    sourceLabel: selected.sourceLabel,
    provider: {
      source: selected.source,
      billingProvider: sourceMetadata.billingProvider,
      nativeStore: sourceMetadata.nativeStore,
      channel: sourceMetadata.channel,
    },
    activePaidAccess: selected.activePaidAccess,
    candidates,
    selectedCandidateKind: selected.candidateKind,
    reconciliation: {
      usedSubscriptionState: selected.candidateKind === 'subscription_state',
      usedUserAppStateFallback: selected.candidateKind === 'user_app_state',
      appStateDiffersFromAccessState,
      reason,
      selectionRule: selected.activePaidAccess ? 'active_paid_higher_tier_source_priority' : 'free_or_inactive_fallback',
      appStateRecommendation: resolveAppStateRecommendation({ selected, appStateDiffersFromAccessState }),
      candidateCount: candidates.length,
      activeCandidateCount,
    },
  };
}

export function serializeMembershipEntitlement(
  entitlement: MembershipEntitlementResolution,
): MembershipEntitlementSerialized {
  const selected = entitlement.candidates.find((candidate) => (
    candidate.candidateKind === entitlement.selectedCandidateKind
    && candidate.subscriptionTier === entitlement.accessState.subscriptionTier
    && candidate.subscriptionStatus === entitlement.accessState.subscriptionStatus
    && candidate.source === entitlement.source
  ));

  if (!selected) {
    throw new Error('membership_entitlement_selected_candidate_missing');
  }

  return {
    source: entitlement.source,
    sourceLabel: entitlement.sourceLabel,
    provider: entitlement.provider,
    accessState: entitlement.accessState,
    activePaidAccess: entitlement.activePaidAccess,
    selectedCandidateKind: entitlement.selectedCandidateKind,
    selectedCandidate: summarizeCandidate(selected),
    candidates: entitlement.candidates.map(summarizeCandidate),
    reconciliation: entitlement.reconciliation,
  };
}

export async function loadMembershipEntitlementForUser(
  client: MembershipEntitlementClient,
  userId: string,
  options: { now?: Date } = {},
): Promise<MembershipEntitlementResolution | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: membershipEntitlementUserSelect,
  });
  return user ? resolveMembershipEntitlement(user, options) : null;
}

export async function loadMembershipAccessStateForUser(
  client: MembershipEntitlementClient,
  userId: string,
  options: { now?: Date } = {},
): Promise<MembershipEntitlementAccessState> {
  const entitlement = await loadMembershipEntitlementForUser(client, userId, options);
  return entitlement?.accessState ?? { subscriptionTier: 'free', subscriptionStatus: 'none' };
}

export function membershipEntitlementAsAiAssistUser(
  userId: string,
  entitlement: MembershipEntitlementResolution | null,
) {
  return {
    id: userId,
    subscriptionTier: entitlement?.accessState.subscriptionTier ?? 'free',
    subscriptionStatus: entitlement?.accessState.subscriptionStatus ?? 'none',
  };
}
