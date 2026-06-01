import { env } from '../../config/env.js';

type PlacementSignalClassification = {
  id: string;
  targetType: string;
  targetId: string;
  source: string;
  status: string;
  systemCategory?: string | null;
  categoryConfidence?: number | null;
  categoryMismatch: boolean;
  suggestedTags: string[];
  suggestedNewTags: string[];
  safetyCategory: string;
  safetySeverity: string;
  adultRelated: boolean;
  childSafe: boolean;
  spamOrScamRisk: boolean;
  regulatedRisk: boolean;
  suggestedAction: string;
  reason?: string | null;
};

export function buildContentPlacementSignalStatus() {
  const configured = env.contentIntelligenceEnabled && env.contentClassificationEnabled && env.contentPlacementSignalsEnabled;
  let disabledReason: string | null = null;
  if (!env.contentIntelligenceEnabled || !env.contentClassificationEnabled) disabledReason = 'Content Intelligence and classification flags must be enabled before syncing placement signals.';
  else if (!env.contentPlacementSignalsEnabled) disabledReason = 'CONTENT_PLACEMENT_SIGNALS_ENABLED=false. Placement signals stay disabled for first launch.';

  return {
    configured,
    disabledReason,
    businessContextualSignalsEnabled: env.businessContextualSignalsEnabled,
    contextualAdSignalsEnabled: env.contextualAdSignalsEnabled,
  };
}

export function assertContentPlacementSignalsEnabled() {
  const status = buildContentPlacementSignalStatus();
  if (!status.configured) {
    const error = new Error(status.disabledReason ?? 'Content placement signals are disabled.') as Error & { statusCode?: number; code?: string };
    error.statusCode = 409;
    error.code = 'content_placement_signals_disabled';
    throw error;
  }
}

function safeTags(...groups: Array<string[] | null | undefined>) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const group of groups) {
    for (const raw of group ?? []) {
      const tag = raw.trim().slice(0, 40);
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
      if (tags.length >= 20) return tags;
    }
  }
  return tags;
}

function placementBlockers(classification: PlacementSignalClassification) {
  const blockers: string[] = [];
  if (!['reviewed', 'overridden'].includes(classification.status)) blockers.push('classification_not_admin_reviewed');
  if (!classification.systemCategory) blockers.push('missing_system_category');
  if (classification.systemCategory === 'other' && (classification.categoryConfidence ?? 0) < 0.75) blockers.push('low_confidence_other_category');
  if (classification.categoryMismatch) blockers.push('category_mismatch_unresolved');
  if (classification.suggestedAction !== 'allow') blockers.push(`suggested_${classification.suggestedAction}`);
  if (['high', 'critical'].includes(classification.safetySeverity)) blockers.push('high_risk_safety_severity');
  if (['adult', 'sexual', 'violence', 'hate_or_harassment', 'self_harm', 'illegal_or_regulated', 'spam_or_scam'].includes(classification.safetyCategory)) blockers.push(`unsafe_${classification.safetyCategory}`);
  if (classification.adultRelated) blockers.push('adult_related');
  if (!classification.childSafe) blockers.push('not_child_safe');
  if (classification.spamOrScamRisk) blockers.push('spam_or_scam_risk');
  if (classification.regulatedRisk) blockers.push('regulated_risk');
  return blockers;
}

export function buildContentPlacementSignalData(classification: PlacementSignalClassification, adminId: string) {
  const blockers = placementBlockers(classification);
  const safeEnough = blockers.length === 0;
  const surfaces = safeEnough ? ['contextual_discovery'] : [];
  if (safeEnough && env.businessContextualSignalsEnabled) surfaces.push('business_sponsored_matching');
  if (safeEnough && env.contextualAdSignalsEnabled) surfaces.push('contextual_ads');

  return {
    targetType: classification.targetType,
    targetId: classification.targetId,
    source: classification.source,
    status: safeEnough ? 'active' : 'disabled',
    sourceClassificationId: classification.id,
    category: classification.systemCategory ?? null,
    tags: safeTags(classification.suggestedTags, classification.suggestedNewTags),
    suggestedNewTags: safeTags(classification.suggestedNewTags),
    safetyCategory: classification.safetyCategory,
    safetySeverity: classification.safetySeverity,
    adultRelated: classification.adultRelated,
    childSafe: classification.childSafe,
    spamOrScamRisk: classification.spamOrScamRisk,
    regulatedRisk: classification.regulatedRisk,
    contextualEligible: safeEnough,
    businessPlacementEligible: safeEnough && env.businessContextualSignalsEnabled,
    adsPlacementEligible: safeEnough && env.contextualAdSignalsEnabled,
    surfaces,
    reason: safeEnough
      ? 'Admin-reviewed content classification approved for future contextual matching signals. No placement, ads, tracking, or public labels were enabled.'
      : `Placement signal disabled: ${blockers.join(', ')}`,
    approvedById: adminId,
    approvedAt: new Date(),
  };
}
