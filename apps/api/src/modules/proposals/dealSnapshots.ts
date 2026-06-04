import type { CashPromise, Need, Offer, Prisma } from '@prisma/client';

type SnapshotSource = 'trade' | 'proposal' | 'package';
type SnapshotKind = 'need' | 'offer' | 'cash_promise';
type SnapshotItem = {
  kind: SnapshotKind;
  id: string;
  ownerId: string;
  title: string;
  description: string;
  itemType: string;
  category: string | null;
  timing?: string | null;
  availability?: string | null;
  mode: string | null;
  locationLabel: string | null;
  includes?: string[];
  tags: string[];
  status: string;
  source: SnapshotSource;
  side?: 'need' | 'offer';
  amountCents?: number;
  currency?: string;
  note?: string | null;
  acknowledgementText?: string;
  sortOrder?: number;
  snapshottedAt: string;
};

function jsonSafe<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function snapshotNeed(need: Need, source: SnapshotSource, snapshottedAt: string, sortOrder?: number): SnapshotItem {
  return {
    kind: 'need',
    id: need.id,
    ownerId: need.ownerId,
    title: need.title,
    description: need.description,
    itemType: need.itemType,
    category: need.category ?? null,
    timing: need.timing ?? null,
    mode: need.mode ?? null,
    locationLabel: need.locationLabel ?? null,
    tags: need.tags ?? [],
    status: need.status,
    source,
    sortOrder,
    snapshottedAt,
  };
}

function snapshotOffer(offer: Offer, source: SnapshotSource, snapshottedAt: string, sortOrder?: number): SnapshotItem {
  return {
    kind: 'offer',
    id: offer.id,
    ownerId: offer.ownerId,
    title: offer.title,
    description: offer.description,
    itemType: offer.itemType,
    category: offer.category ?? null,
    availability: offer.availability ?? null,
    mode: offer.mode ?? null,
    locationLabel: offer.locationLabel ?? null,
    includes: offer.includes ?? [],
    tags: offer.tags ?? [],
    status: offer.status,
    source,
    sortOrder,
    snapshottedAt,
  };
}

function snapshotCashPromise(cashPromise: CashPromise, ownerId: string, applicantId: string, snapshottedAt: string): SnapshotItem {
  const giverId = cashPromise.side === 'offer' ? applicantId : ownerId;
  return {
    kind: 'cash_promise',
    id: cashPromise.id,
    ownerId: giverId,
    title: 'Cash promise',
    description: cashPromise.note ?? '',
    itemType: 'other',
    category: 'Cash promise',
    mode: null,
    locationLabel: null,
    tags: [],
    status: 'accepted',
    source: 'proposal',
    side: cashPromise.side,
    amountCents: cashPromise.amountCents,
    currency: cashPromise.currency,
    note: cashPromise.note,
    acknowledgementText: cashPromise.acknowledgementText,
    snapshottedAt,
  };
}

function pushUnique(items: SnapshotItem[], item: SnapshotItem | null | undefined) {
  if (!item) return;
  if (items.some((existing) => existing.kind === item.kind && existing.id === item.id)) return;
  items.push(item);
}

function agreementBuckets(input: { ownerId: string; applicantId: string; needs: SnapshotItem[]; offers: SnapshotItem[]; cashPromises: SnapshotItem[] }) {
  const cashGivenByOwner = input.cashPromises.filter((cash) => cash.ownerId === input.ownerId);
  const cashGivenByApplicant = input.cashPromises.filter((cash) => cash.ownerId === input.applicantId);
  return {
    ownerGives: [...input.offers.filter((offer) => offer.ownerId === input.ownerId), ...cashGivenByOwner],
    ownerReceives: [...input.needs.filter((need) => need.ownerId === input.ownerId), ...cashGivenByApplicant],
    applicantGives: [...input.offers.filter((offer) => offer.ownerId === input.applicantId), ...cashGivenByApplicant],
    applicantReceives: [...input.needs.filter((need) => need.ownerId === input.applicantId), ...cashGivenByOwner],
  };
}

export async function createAcceptedDealSnapshot(tx: Prisma.TransactionClient, proposalId: string) {
  const snapshottedAt = new Date().toISOString();
  const proposal = await tx.tradeProposal.findUnique({
    where: { id: proposalId },
    include: {
      trade: { include: { need: true, offer: true } },
      proposedNeed: true,
      proposedOffer: true,
      packageItems: { include: { need: true, offer: true }, orderBy: { sortOrder: 'asc' } },
      cashPromise: true,
    },
  });
  if (!proposal) throw Object.assign(new Error('not_found'), { code: 'NOT_FOUND' });

  const ownerId = proposal.trade.ownerId;
  const applicantId = proposal.applicantId;
  const needs: SnapshotItem[] = [];
  const offers: SnapshotItem[] = [];
  const cashPromises: SnapshotItem[] = [];

  pushUnique(needs, proposal.trade.need ? snapshotNeed(proposal.trade.need, 'trade', snapshottedAt) : null);
  pushUnique(offers, proposal.trade.offer ? snapshotOffer(proposal.trade.offer, 'trade', snapshottedAt) : null);
  pushUnique(needs, proposal.proposedNeed ? snapshotNeed(proposal.proposedNeed, 'proposal', snapshottedAt) : null);
  pushUnique(offers, proposal.proposedOffer ? snapshotOffer(proposal.proposedOffer, 'proposal', snapshottedAt) : null);

  for (const item of proposal.packageItems) {
    if (item.need) pushUnique(needs, snapshotNeed(item.need, 'package', snapshottedAt, item.sortOrder));
    if (item.offer) pushUnique(offers, snapshotOffer(item.offer, 'package', snapshottedAt, item.sortOrder));
  }
  if (proposal.cashPromise) pushUnique(cashPromises, snapshotCashPromise(proposal.cashPromise, ownerId, applicantId, snapshottedAt));

  const buckets = agreementBuckets({ ownerId, applicantId, needs, offers, cashPromises });
  const tradeSnapshot = {
    id: proposal.trade.id,
    ownerId,
    providerId: applicantId,
    needId: proposal.trade.needId,
    offerId: proposal.trade.offerId,
    title: proposal.trade.title,
    description: proposal.trade.description,
    postType: proposal.trade.postType,
    status: 'in_progress',
    amountCents: proposal.trade.amountCents,
    creditAmount: proposal.trade.creditAmount,
    currency: proposal.trade.currency,
    createdAt: proposal.trade.createdAt.toISOString(),
    acceptedAt: snapshottedAt,
  };
  const proposalSnapshot = {
    id: proposal.id,
    tradeId: proposal.tradeId,
    applicantId,
    proposedNeedId: proposal.proposedNeedId,
    proposedOfferId: proposal.proposedOfferId,
    cashPromiseId: proposal.cashPromise?.id ?? null,
    packageKind: proposal.packageKind,
    message: proposal.message,
    messageDeletedAt: proposal.messageDeletedAt?.toISOString() ?? null,
    createdAt: proposal.createdAt.toISOString(),
    acceptedAt: snapshottedAt,
  };

  return tx.acceptedDealSnapshot.upsert({
    where: { proposalId: proposal.id },
    update: {},
    create: {
      tradeId: proposal.tradeId,
      proposalId: proposal.id,
      ownerId,
      applicantId,
      tradeSnapshotJson: jsonSafe(tradeSnapshot),
      proposalSnapshotJson: jsonSafe(proposalSnapshot),
      ownerGivesJson: jsonSafe(buckets.ownerGives),
      ownerReceivesJson: jsonSafe(buckets.ownerReceives),
      applicantGivesJson: jsonSafe(buckets.applicantGives),
      applicantReceivesJson: jsonSafe(buckets.applicantReceives),
      acceptedMessage: proposal.messageDeletedAt ? null : proposal.message,
    },
  });
}
