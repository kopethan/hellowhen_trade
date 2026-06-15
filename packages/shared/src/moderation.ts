export const MODERATION_PROVIDERS = ['none', 'mock', 'openai', 'aws_rekognition', 'google_vision', 'azure_content_safety', 'human_review'] as const;
export const MODERATION_EXTERNAL_PROVIDERS = ['openai', 'aws_rekognition', 'google_vision', 'azure_content_safety', 'human_review'] as const;

export type ModerationProviderName = typeof MODERATION_PROVIDERS[number];
export type ModerationScanType = 'text' | 'image' | 'combined';
export type ModerationProviderStatus = 'skipped' | 'completed' | 'failed';
export type ModerationSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type ModerationSuggestedAction = 'allow' | 'review' | 'limit' | 'reject' | 'remove' | 'no_action';
export type ModerationCaseStatus = 'pending' | 'approved' | 'rejected' | 'needs_review' | 'limited' | 'removed' | 'skipped' | 'failed';
export type ModerationTextFailMode = 'allow_with_case' | 'hold_pending' | 'reject';
export type ModerationTextReviewDecisionStatus = 'approved' | 'needs_review' | 'rejected' | 'skipped' | 'provider_failed';
export type ModerationTextReviewContentAction = 'allow' | 'hold_pending' | 'reject' | 'none';
export type ModerationProviderResultLike = {
  status: ModerationProviderStatus;
  highestSeverity?: ModerationSeverity;
  suggestedAction?: ModerationSuggestedAction;
  reason?: string;
};
export type ModerationTextReviewDecision = {
  status: ModerationTextReviewDecisionStatus;
  contentAction: ModerationTextReviewContentAction;
  caseStatus: ModerationCaseStatus;
  highestSeverity: ModerationSeverity;
  suggestedAction: ModerationSuggestedAction;
  reason?: string;
};
export type ModerationFeatureFlags = {
  enabled: boolean;
  provider: ModerationProviderName;
  textEnabled: boolean;
  imageEnabled: boolean;
  privateMessageScanEnabled: boolean;
  storeRawProviderResult: boolean;
  providerTimeoutMs?: number;
  providerMaxRetries?: number;
  textReviewOnCreateEnabled?: boolean;
  textReviewOnEditEnabled?: boolean;
  textReviewPublicMessagesEnabled?: boolean;
  textReviewProfileEnabled?: boolean;
  textReviewPrivateMessagesEnabled?: boolean;
  textReviewEnforcementEnabled?: boolean;
  textFailMode?: ModerationTextFailMode;
};

export function normalizeModerationProvider(value: string | undefined | null): ModerationProviderName {
  const normalized = String(value ?? 'none').trim().toLowerCase();
  return (MODERATION_PROVIDERS as readonly string[]).includes(normalized) ? normalized as ModerationProviderName : 'none';
}

export function isExternalModerationProvider(provider: ModerationProviderName) {
  return (MODERATION_EXTERNAL_PROVIDERS as readonly string[]).includes(provider);
}

export function shouldRunModerationProvider(flags: ModerationFeatureFlags, scanType: ModerationScanType) {
  if (!flags.enabled || flags.provider === 'none') return false;
  if (scanType === 'text') return flags.textEnabled;
  if (scanType === 'image') return flags.imageEnabled;
  return flags.textEnabled || flags.imageEnabled;
}

export function createSkippedModerationResult(provider: ModerationProviderName, scanType: ModerationScanType, reason: string) {
  return {
    provider,
    scanType,
    status: 'skipped' as const,
    labels: [],
    highestSeverity: 'none' as const,
    suggestedAction: 'no_action' as const,
    reason,
    attemptCount: 1,
    retriable: false,
  };
}

export function createFailedModerationResult(provider: ModerationProviderName, scanType: ModerationScanType, input: {
  reason: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
  attemptCount?: number;
  retriable?: boolean;
}) {
  return {
    provider,
    scanType,
    status: 'failed' as const,
    labels: [],
    highestSeverity: 'none' as const,
    suggestedAction: 'review' as const,
    reason: input.reason,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    durationMs: input.durationMs,
    attemptCount: input.attemptCount ?? 1,
    retriable: input.retriable ?? true,
  };
}

export function highestModerationSeverity(severities: ModerationSeverity[]) {
  const order: Record<ModerationSeverity, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return severities.reduce<ModerationSeverity>((highest, next) => order[next] > order[highest] ? next : highest, 'none');
}

export function suggestedActionForSeverity(severity: ModerationSeverity): ModerationSuggestedAction {
  if (severity === 'critical') return 'remove';
  if (severity === 'high') return 'reject';
  if (severity === 'medium') return 'review';
  if (severity === 'low') return 'allow';
  return 'allow';
}

export function normalizeModerationTextFailMode(value: string | undefined | null): ModerationTextFailMode {
  const normalized = String(value ?? 'allow_with_case').trim().toLowerCase();
  if (normalized === 'hold_pending' || normalized === 'reject') return normalized;
  return 'allow_with_case';
}

function contentActionForProviderFailure(failMode: ModerationTextFailMode): ModerationTextReviewContentAction {
  if (failMode === 'reject') return 'reject';
  if (failMode === 'hold_pending') return 'hold_pending';
  return 'allow';
}

export function textReviewDecisionForProviderResult(result: ModerationProviderResultLike, failMode: ModerationTextFailMode = 'allow_with_case'): ModerationTextReviewDecision {
  const highestSeverity = result.highestSeverity ?? 'none';
  const suggestedAction = result.suggestedAction ?? suggestedActionForSeverity(highestSeverity);

  if (result.status === 'skipped') {
    return {
      status: 'skipped',
      contentAction: 'none',
      caseStatus: 'skipped',
      highestSeverity,
      suggestedAction,
      reason: result.reason ?? 'Text moderation scan was skipped.',
    };
  }

  if (result.status === 'failed') {
    const contentAction = contentActionForProviderFailure(failMode);
    return {
      status: 'provider_failed',
      contentAction,
      caseStatus: 'failed',
      highestSeverity,
      suggestedAction,
      reason: result.reason ?? 'Text moderation provider failed.',
    };
  }

  if (suggestedAction === 'reject' || suggestedAction === 'remove' || highestSeverity === 'high' || highestSeverity === 'critical') {
    return {
      status: 'rejected',
      contentAction: 'reject',
      caseStatus: 'needs_review',
      highestSeverity,
      suggestedAction,
      reason: result.reason ?? 'Text moderation found high-risk content.',
    };
  }

  if (suggestedAction === 'review' || suggestedAction === 'limit' || highestSeverity === 'medium') {
    return {
      status: 'needs_review',
      contentAction: 'hold_pending',
      caseStatus: 'needs_review',
      highestSeverity,
      suggestedAction,
      reason: result.reason ?? 'Text moderation found content that needs review.',
    };
  }

  return {
    status: 'approved',
    contentAction: 'allow',
    caseStatus: 'approved',
    highestSeverity,
    suggestedAction,
    reason: result.reason ?? 'Text moderation approved this content.',
  };
}
