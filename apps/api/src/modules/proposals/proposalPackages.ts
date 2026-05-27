import type { Prisma } from '@prisma/client';
import {
  evaluateTradePackageDraft,
  getProTradePackageEntitlements,
  normalizeTradePackageIds,
  normalizeTradePackageKind,
  type ProAccessState,
  type TradePackageItemRef,
  type TradePackageKind,
} from '@hellowhen/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

type ProposalPackageInput = {
  packageKind?: string | null;
  mainNeedId?: string | null;
  mainOfferId?: string | null;
  supportingNeedIds?: readonly string[] | null;
  supportingOfferIds?: readonly string[] | null;
  proposedNeedId?: string | null;
  proposedOfferId?: string | null;
};

type TradeForProposalPackage = {
  id: string;
  postType?: string | null;
  needId?: string | null;
  offerId?: string | null;
};

export type ResolvedProposalPackage = {
  packageKind: TradePackageKind;
  proposedNeedId: string | null;
  proposedOfferId: string | null;
  items: TradePackageItemRef[];
};

function hasIds(values?: readonly string[] | null) {
  return normalizeTradePackageIds(values).length > 0;
}

export function hasProposalPackageInput(input: ProposalPackageInput) {
  return normalizeTradePackageKind(input.packageKind) !== 'standard'
    || Boolean(input.mainNeedId)
    || Boolean(input.mainOfferId)
    || hasIds(input.supportingNeedIds)
    || hasIds(input.supportingOfferIds);
}

function proposalPackageEntitlements() {
  return getProTradePackageEntitlements({
    enabled: env.proTradePackagesEnabled,
    requiresProAccess: true,
    maxSupportingNeeds: env.proTradePackageMaxSupportingNeeds,
    maxSupportingOffers: env.proTradePackageMaxSupportingOffers,
  });
}

async function loadProAccessState(userId: string): Promise<ProAccessState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { professionalStatus: true, subscriptionTier: true, subscriptionStatus: true },
  });

  return {
    professionalStatus: user?.professionalStatus ?? 'none',
    subscriptionTier: user?.subscriptionTier ?? 'free',
    subscriptionStatus: user?.subscriptionStatus ?? 'none',
  } as ProAccessState;
}

function throwPackageError(code: string, details?: unknown): never {
  throw Object.assign(new Error(code), { code, details });
}

function expectedPackageKindForTrade(trade: TradeForProposalPackage): TradePackageKind | null {
  if (trade.postType === 'open_need') return 'main_need_multi_offer';
  if (trade.postType === 'open_offer') return 'main_offer_multi_need';
  return null;
}

async function assertApplicantOwnsActiveOffers(actorId: string, offerIds: string[]) {
  if (!offerIds.length) return;
  const offers = await prisma.offer.findMany({ where: { id: { in: offerIds }, ownerId: actorId }, select: { id: true, status: true } });
  const activeIds = new Set(offers.filter((offer) => offer.status === 'active').map((offer) => offer.id));
  if (offerIds.some((id) => !activeIds.has(id))) {
    throwPackageError('INVALID_PROPOSAL_PACKAGE_OFFER', { offerIds });
  }
}

async function assertApplicantOwnsActiveNeeds(actorId: string, needIds: string[]) {
  if (!needIds.length) return;
  const needs = await prisma.need.findMany({ where: { id: { in: needIds }, ownerId: actorId }, select: { id: true, status: true } });
  const activeIds = new Set(needs.filter((need) => need.status === 'active').map((need) => need.id));
  if (needIds.some((id) => !activeIds.has(id))) {
    throwPackageError('INVALID_PROPOSAL_PACKAGE_NEED', { needIds });
  }
}

export async function resolveProposalPackagePayload(input: ProposalPackageInput, actorId: string, trade: TradeForProposalPackage): Promise<ResolvedProposalPackage | null> {
  if (!hasProposalPackageInput(input)) return null;

  const expectedKind = expectedPackageKindForTrade(trade);
  if (!expectedKind) throwPackageError('PROPOSAL_PACKAGE_UNSUPPORTED_TRADE_TYPE');

  const requestedKind = normalizeTradePackageKind(input.packageKind ?? expectedKind);
  if (requestedKind !== expectedKind) {
    throwPackageError('PROPOSAL_PACKAGE_KIND_MISMATCH', { expectedKind, requestedKind });
  }

  const proAccessState = await loadProAccessState(actorId);
  const entitlements = proposalPackageEntitlements();
  const supportingOfferIds = requestedKind === 'main_need_multi_offer'
    ? normalizeTradePackageIds(input.supportingOfferIds?.length ? input.supportingOfferIds : input.proposedOfferId ? [input.proposedOfferId] : [])
    : [];
  const supportingNeedIds = requestedKind === 'main_offer_multi_need'
    ? normalizeTradePackageIds(input.supportingNeedIds?.length ? input.supportingNeedIds : input.proposedNeedId ? [input.proposedNeedId] : [])
    : [];
  const mainNeedId = requestedKind === 'main_need_multi_offer' ? trade.needId ?? input.mainNeedId ?? null : null;
  const mainOfferId = requestedKind === 'main_offer_multi_need' ? trade.offerId ?? input.mainOfferId ?? null : null;

  const evaluation = evaluateTradePackageDraft({
    kind: requestedKind,
    mainNeedId,
    mainOfferId,
    supportingNeedIds,
    supportingOfferIds,
  }, { entitlements, proAccessState });

  if (!evaluation.canUsePackages) {
    if (evaluation.blockers.includes('trade_packages_disabled')) throwPackageError('PRO_TRADE_PACKAGES_DISABLED', evaluation.blockers);
    if (evaluation.blockers.includes('pro_access_required')) throwPackageError('PRO_ACCESS_REQUIRED', evaluation.blockers);
    throwPackageError('INVALID_PROPOSAL_PACKAGE', evaluation.blockers);
  }

  await Promise.all([
    assertApplicantOwnsActiveOffers(actorId, supportingOfferIds),
    assertApplicantOwnsActiveNeeds(actorId, supportingNeedIds),
  ]);

  return {
    packageKind: requestedKind,
    proposedNeedId: requestedKind === 'main_offer_multi_need' ? supportingNeedIds[0] ?? null : null,
    proposedOfferId: requestedKind === 'main_need_multi_offer' ? supportingOfferIds[0] ?? null : null,
    items: evaluation.items,
  };
}

export function toProposalPackageItemCreateManyRows(proposalId: string, items: TradePackageItemRef[]): Prisma.TradeProposalPackageItemCreateManyInput[] {
  return items.map((item) => ({
    proposalId,
    kind: item.kind,
    role: item.role,
    needId: item.kind === 'need' ? item.id : null,
    offerId: item.kind === 'offer' ? item.id : null,
    sortOrder: item.sortOrder,
  }));
}
