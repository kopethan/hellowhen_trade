import type { ProAccessState } from './subscriptions.js';
import { hasProAccess } from './subscriptions.js';

export const TRADE_PACKAGE_KINDS = ['standard', 'main_need_multi_offer', 'main_offer_multi_need'] as const;
export type TradePackageKind = typeof TRADE_PACKAGE_KINDS[number];

export const TRADE_PACKAGE_ITEM_KINDS = ['need', 'offer'] as const;
export type TradePackageItemKind = typeof TRADE_PACKAGE_ITEM_KINDS[number];

export const TRADE_PACKAGE_ITEM_ROLES = ['main', 'supporting'] as const;
export type TradePackageItemRole = typeof TRADE_PACKAGE_ITEM_ROLES[number];

export type TradePackageItemRef = {
  kind: TradePackageItemKind;
  id: string;
  role: TradePackageItemRole;
  sortOrder: number;
};

export type TradePackageDraft = {
  kind?: TradePackageKind | string | null;
  mainNeedId?: string | null;
  mainOfferId?: string | null;
  supportingNeedIds?: readonly string[] | null;
  supportingOfferIds?: readonly string[] | null;
};

export type ProTradePackageEntitlements = {
  enabled: boolean;
  requiresProAccess: boolean;
  maxMainNeeds: number;
  maxMainOffers: number;
  maxSupportingNeeds: number;
  maxSupportingOffers: number;
  allowMultiNeedMultiOffer: boolean;
  allowPartialAcceptance: boolean;
  allowGroupParticipants: boolean;
};

export const PRO_TRADE_PACKAGE_ENTITLEMENT_DEFAULTS: ProTradePackageEntitlements = {
  enabled: false,
  requiresProAccess: true,
  maxMainNeeds: 1,
  maxMainOffers: 1,
  maxSupportingNeeds: 3,
  maxSupportingOffers: 3,
  allowMultiNeedMultiOffer: false,
  allowPartialAcceptance: false,
  allowGroupParticipants: false,
};

export type TradePackageAccessBlocker = 'trade_packages_disabled' | 'pro_access_required';

export type TradePackageValidationBlocker =
  | TradePackageAccessBlocker
  | 'invalid_package_kind'
  | 'main_need_required'
  | 'main_offer_required'
  | 'supporting_need_required'
  | 'supporting_offer_required'
  | 'too_many_main_needs'
  | 'too_many_main_offers'
  | 'too_many_supporting_needs'
  | 'too_many_supporting_offers'
  | 'multi_need_multi_offer_not_supported';

export type TradePackageEvaluation = {
  kind: TradePackageKind;
  enabled: boolean;
  canUsePackages: boolean;
  blockers: TradePackageValidationBlocker[];
  entitlements: ProTradePackageEntitlements;
  items: TradePackageItemRef[];
};

export function normalizeTradePackageKind(value: string | undefined | null): TradePackageKind {
  const normalized = String(value ?? 'standard').trim().toLowerCase();
  return (TRADE_PACKAGE_KINDS as readonly string[]).includes(normalized) ? normalized as TradePackageKind : 'standard';
}

export function normalizeTradePackageIds(values?: readonly string[] | null): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values ?? []) {
    const id = String(value ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

export function getProTradePackageEntitlements(overrides?: Partial<ProTradePackageEntitlements> | null): ProTradePackageEntitlements {
  return {
    ...PRO_TRADE_PACKAGE_ENTITLEMENT_DEFAULTS,
    ...overrides,
  };
}

export function getTradePackageAccessBlockers(options?: {
  entitlements?: Partial<ProTradePackageEntitlements> | null;
  proAccessState?: Partial<ProAccessState> | null;
}): TradePackageAccessBlocker[] {
  const entitlements = getProTradePackageEntitlements(options?.entitlements);
  const blockers: TradePackageAccessBlocker[] = [];

  if (!entitlements.enabled) blockers.push('trade_packages_disabled');
  if (entitlements.requiresProAccess && !hasProAccess(options?.proAccessState)) blockers.push('pro_access_required');

  return blockers;
}

export function buildTradePackageItems(draft: TradePackageDraft): TradePackageItemRef[] {
  const kind = normalizeTradePackageKind(draft.kind);
  const supportingNeedIds = normalizeTradePackageIds(draft.supportingNeedIds);
  const supportingOfferIds = normalizeTradePackageIds(draft.supportingOfferIds);
  const items: TradePackageItemRef[] = [];

  if (kind === 'main_need_multi_offer') {
    if (draft.mainNeedId) {
      items.push({ kind: 'need', id: String(draft.mainNeedId), role: 'main', sortOrder: 0 });
    }
    supportingOfferIds.forEach((id, index) => {
      items.push({ kind: 'offer', id, role: 'supporting', sortOrder: index + 1 });
    });
  }

  if (kind === 'main_offer_multi_need') {
    if (draft.mainOfferId) {
      items.push({ kind: 'offer', id: String(draft.mainOfferId), role: 'main', sortOrder: 0 });
    }
    supportingNeedIds.forEach((id, index) => {
      items.push({ kind: 'need', id, role: 'supporting', sortOrder: index + 1 });
    });
  }

  return items;
}

export function evaluateTradePackageDraft(draft: TradePackageDraft, options?: {
  entitlements?: Partial<ProTradePackageEntitlements> | null;
  proAccessState?: Partial<ProAccessState> | null;
}): TradePackageEvaluation {
  const entitlements = getProTradePackageEntitlements(options?.entitlements);
  const kind = normalizeTradePackageKind(draft.kind);
  const accessBlockers = getTradePackageAccessBlockers({ entitlements, proAccessState: options?.proAccessState });
  const blockers: TradePackageValidationBlocker[] = [...accessBlockers];
  const supportingNeedIds = normalizeTradePackageIds(draft.supportingNeedIds);
  const supportingOfferIds = normalizeTradePackageIds(draft.supportingOfferIds);
  const mainNeedCount = draft.mainNeedId ? 1 : 0;
  const mainOfferCount = draft.mainOfferId ? 1 : 0;

  if (kind === 'standard') {
    blockers.push('invalid_package_kind');
  }

  if (kind === 'main_need_multi_offer') {
    if (!draft.mainNeedId) blockers.push('main_need_required');
    if (draft.mainOfferId) blockers.push('multi_need_multi_offer_not_supported');
    if (supportingNeedIds.length > 0) blockers.push('multi_need_multi_offer_not_supported');
    if (supportingOfferIds.length === 0) blockers.push('supporting_offer_required');
  }

  if (kind === 'main_offer_multi_need') {
    if (!draft.mainOfferId) blockers.push('main_offer_required');
    if (draft.mainNeedId) blockers.push('multi_need_multi_offer_not_supported');
    if (supportingOfferIds.length > 0) blockers.push('multi_need_multi_offer_not_supported');
    if (supportingNeedIds.length === 0) blockers.push('supporting_need_required');
  }

  if (mainNeedCount > entitlements.maxMainNeeds) blockers.push('too_many_main_needs');
  if (mainOfferCount > entitlements.maxMainOffers) blockers.push('too_many_main_offers');
  if (supportingNeedIds.length > entitlements.maxSupportingNeeds) blockers.push('too_many_supporting_needs');
  if (supportingOfferIds.length > entitlements.maxSupportingOffers) blockers.push('too_many_supporting_offers');
  if (!entitlements.allowMultiNeedMultiOffer && mainNeedCount > 0 && mainOfferCount > 0) blockers.push('multi_need_multi_offer_not_supported');

  return {
    kind,
    enabled: entitlements.enabled,
    canUsePackages: blockers.length === 0,
    blockers,
    entitlements,
    items: buildTradePackageItems({
      kind,
      mainNeedId: draft.mainNeedId,
      mainOfferId: draft.mainOfferId,
      supportingNeedIds,
      supportingOfferIds,
    }),
  };
}
