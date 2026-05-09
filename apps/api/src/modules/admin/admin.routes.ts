import { Router } from 'express';
import { adminBusinessProfileActionRequestSchema, adminCreateSupportMessageRequestSchema, adminListMediaQuerySchema, adminPayoutActionRequestSchema, adminPayoutStatusFilterSchema, moneyProviderWalletBalancesSyncRequestSchema, adminTradeDisputeActionRequestSchema, adminUpdateTrustTierRequestSchema, adminUpdateSupportTicketRequestSchema, supportTicketCategorySchema, supportTicketPrioritySchema, supportTicketStatusSchema, updateMediaStatusRequestSchema } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { attachUploadedMediaToEntity } from '../media/media.helpers.js';
import { buildLaunchLimits } from '../limits/launchLimits.js';
import { buildAdminMoneySafetySummary, buildGlobalMoneySafetyConfig } from '../money/moneySafety.js';
import { mirrorProviderTradeRefund, mirrorProviderTradeRelease } from '../money/tradeMoney.js';
import { buildMoneyProviderStatus, getActiveMoneyProvider, getMoneyProvider } from '../money/providers/moneyProviderRegistry.js';
import { MoneyProviderError } from '../money/providers/moneyProvider.types.js';
import { withOneSupportMessageMedia, withOneSupportTicketMedia, withSupportTicketMedia } from '../support/support.routes.js';
import { refundHeldWalletMoney, releaseHeldWalletMoney, tradeInclude, withOneTradeDeckMedia } from '../trades/trades.routes.js';

export const adminRoutes = Router();
const mediaUserSelect = { id: true, email: true, profile: true } as const;

async function withMediaEntityContext<T extends { entityType: 'need' | 'offer' | 'trade' | 'profile' | 'support_ticket' | 'support_message' | null; entityId: string | null }>(media: T[]) {
  const needIds = media.filter((item) => item.entityType === 'need' && item.entityId).map((item) => item.entityId!);
  const offerIds = media.filter((item) => item.entityType === 'offer' && item.entityId).map((item) => item.entityId!);
  const tradeIds = media.filter((item) => item.entityType === 'trade' && item.entityId).map((item) => item.entityId!);
  const profileIds = media.filter((item) => item.entityType === 'profile' && item.entityId).map((item) => item.entityId!);
  const supportTicketIds = media.filter((item) => item.entityType === 'support_ticket' && item.entityId).map((item) => item.entityId!);
  const supportMessageIds = media.filter((item) => item.entityType === 'support_message' && item.entityId).map((item) => item.entityId!);

  const [needs, offers, trades, profiles, supportTickets, supportMessages] = await Promise.all([
    needIds.length ? prisma.need.findMany({ where: { id: { in: needIds } }, select: { id: true, ownerId: true, title: true, status: true, category: true, timing: true, mode: true, locationLabel: true } }) : [],
    offerIds.length ? prisma.offer.findMany({ where: { id: { in: offerIds } }, select: { id: true, ownerId: true, title: true, status: true, category: true, availability: true, mode: true, locationLabel: true } }) : [],
    tradeIds.length ? prisma.trade.findMany({ where: { id: { in: tradeIds } }, select: { id: true, ownerId: true, title: true, status: true, needId: true, offerId: true, creditAmount: true } }) : [],
    profileIds.length ? prisma.profile.findMany({ where: { id: { in: profileIds } }, select: { id: true, userId: true, displayName: true, handle: true, avatarUrl: true, avatarMediaId: true } }) : [],
    supportTicketIds.length ? prisma.supportTicket.findMany({ where: { id: { in: supportTicketIds } }, select: { id: true, userId: true, subject: true, status: true, priority: true, category: true } }) : [],
    supportMessageIds.length ? prisma.supportTicketMessage.findMany({ where: { id: { in: supportMessageIds } }, select: { id: true, ticketId: true, senderId: true, senderRole: true, body: true, createdAt: true } }) : []
  ]);

  const needsById = new Map(needs.map((need) => [need.id, need]));
  const offersById = new Map(offers.map((offer) => [offer.id, offer]));
  const tradesById = new Map(trades.map((trade) => [trade.id, trade]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const supportTicketsById = new Map(supportTickets.map((ticket) => [ticket.id, ticket]));
  const supportMessagesById = new Map(supportMessages.map((message) => [message.id, message]));

  return media.map((item) => {
    if (item.entityType === 'need' && item.entityId) return { ...item, entity: needsById.get(item.entityId) ?? null };
    if (item.entityType === 'offer' && item.entityId) return { ...item, entity: offersById.get(item.entityId) ?? null };
    if (item.entityType === 'trade' && item.entityId) return { ...item, entity: tradesById.get(item.entityId) ?? null };
    if (item.entityType === 'profile' && item.entityId) return { ...item, entity: profilesById.get(item.entityId) ?? null };
    if (item.entityType === 'support_ticket' && item.entityId) return { ...item, entity: supportTicketsById.get(item.entityId) ?? null };
    if (item.entityType === 'support_message' && item.entityId) return { ...item, entity: supportMessagesById.get(item.entityId) ?? null };
    return { ...item, entity: null };
  });
}

adminRoutes.use(requireAuth);

adminRoutes.use(asyncRoute(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true, twoFactorEnabled: true } });
  if (user?.role !== 'admin') return res.status(403).json({ error: 'admin_required', message: 'Admin access is required.' });
  if (env.adminRequireTwoFactor && !user.twoFactorEnabled) return res.status(403).json({ error: 'admin_two_factor_required', message: 'Admin accounts must enable authenticator app two-step verification before using admin tools.' });
  return next();
}));


adminRoutes.get('/users', asyncRoute(async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, trustTier: true, trustTierUpdatedAt: true, trustTierNote: true, emailVerifiedAt: true, createdAt: true, profile: true, wallet: true },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  const usersWithLimits = await Promise.all(users.map(async (user) => ({ ...user, limits: await buildLaunchLimits(prisma, user.id) })));
  res.json({ users: usersWithLimits });
}));

adminRoutes.patch('/users/:userId/trust-tier', asyncRoute(async (req, res) => {
  const input = adminUpdateTrustTierRequestSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.params.userId },
    data: { trustTier: input.trustTier, trustTierUpdatedAt: new Date(), trustTierNote: input.note ?? null },
    select: { id: true, email: true, role: true, trustTier: true, trustTierUpdatedAt: true, trustTierNote: true, emailVerifiedAt: true, createdAt: true, profile: true, wallet: true }
  });
  res.json({ user: { ...user, limits: await buildLaunchLimits(prisma, user.id) } });
}));


adminRoutes.get('/money-safety', asyncRoute(async (_req, res) => {
  res.json(await buildAdminMoneySafetySummary(prisma));
}));


adminRoutes.get('/trades/disputes', asyncRoute(async (_req, res) => {
  const trades = await prisma.trade.findMany({
    where: { status: 'disputed' },
    include: { ...tradeInclude, proposals: { where: { status: 'accepted' }, include: { applicant: { select: { id: true, email: true, profile: true } } } } },
    orderBy: { disputedAt: 'desc' },
    take: 100,
  });
  const tickets = await prisma.supportTicket.findMany({
    where: { relatedTradeId: { in: trades.map((trade) => trade.id) } },
    include: { user: { select: { id: true, email: true, profile: true } }, assignedAdmin: { select: { id: true, email: true, profile: true } }, _count: { select: { messages: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ trades: await Promise.all(trades.map((trade) => withOneTradeDeckMedia(trade, 'owner'))), supportTickets: await withSupportTicketMedia(tickets, 'admin') });
}));

adminRoutes.patch('/trades/:tradeId/dispute', asyncRoute(async (req, res) => {
  const input = adminTradeDisputeActionRequestSchema.parse(req.body);
  const trade = await prisma.trade.findUnique({ where: { id: req.params.tradeId }, include: tradeInclude });
  if (!trade) return res.status(404).json({ error: 'not_found' });
  if (trade.status !== 'disputed') return res.status(409).json({ error: 'trade_not_disputed', message: 'Only disputed trades can be resolved through this action.' });
  const note = input.note?.trim();
  const disputePayment = trade.payment;
  const updated = await prisma.$transaction(async (tx) => {
    if (input.action === 'refund_payer') {
      await refundHeldWalletMoney(tx, trade, req.user!.id);
      return tx.trade.update({ where: { id: trade.id }, data: { status: 'cancelled', closedAt: new Date(), confirmedById: req.user!.id, confirmedAt: new Date() }, include: tradeInclude });
    }
    if (input.action === 'release_seller') {
      await releaseHeldWalletMoney(tx, trade);
      return tx.trade.update({ where: { id: trade.id }, data: { status: 'completed', closedAt: new Date(), confirmedById: req.user!.id, confirmedAt: new Date() }, include: tradeInclude });
    }
    return tx.trade.update({ where: { id: trade.id }, data: { status: 'closed', closedAt: new Date(), confirmedById: req.user!.id, confirmedAt: new Date() }, include: tradeInclude });
  });
  if (input.action === 'release_seller' && disputePayment?.status === 'held' && disputePayment.amountCents > 0 && disputePayment.sellerId) {
    await mirrorProviderTradeRelease({ tradeId: trade.id, buyerId: disputePayment.buyerId, sellerId: disputePayment.sellerId, amountCents: disputePayment.amountCents, currency: disputePayment.currency, confirmedById: req.user!.id });
  }
  if (input.action === 'refund_payer' && disputePayment && ['held', 'released'].includes(disputePayment.status) && disputePayment.amountCents > 0) {
    await mirrorProviderTradeRefund({ tradeId: trade.id, buyerId: disputePayment.buyerId, sellerId: disputePayment.sellerId, amountCents: disputePayment.amountCents, currency: disputePayment.currency, refundedById: req.user!.id, wasReleased: disputePayment.status === 'released', reason: 'admin_dispute_refund' });
  }
  if (note || trade.disputeTicketId) {
    await prisma.supportTicketMessage.create({ data: { ticketId: trade.disputeTicketId ?? '', senderId: req.user!.id, senderRole: 'admin', internal: true, body: note || `Admin resolved dispute with action: ${input.action}` } }).catch(() => null);
  }
  res.json({ trade: await withOneTradeDeckMedia(updated, 'owner') });
}));


function payoutGrossCents(payout: { amountCents: number; grossAmountCents?: number | null }) {
  return payout.grossAmountCents && payout.grossAmountCents > 0 ? payout.grossAmountCents : payout.amountCents;
}

const adminPayoutUserSelect = { id: true, email: true, profile: true, trustTier: true, trustTierUpdatedAt: true, trustTierNote: true, emailVerifiedAt: true, wallet: true } as const;
const adminPayoutEventInclude = { admin: { select: { id: true, email: true, profile: true } } } as const;
const adminPayoutInclude = {
  user: { select: adminPayoutUserSelect },
  stripeConnectAccount: true,
  providerAccount: true,
  providerTransactions: { orderBy: { createdAt: 'desc' as const }, take: 8 },
  adminEvents: { include: adminPayoutEventInclude, orderBy: { createdAt: 'desc' as const }, take: 8 },
} as const;

function appendAdminNote(current: string | null | undefined, note: string | undefined, action: string) {
  const cleanNote = note?.trim();
  const stamp = new Date().toISOString();
  const nextLine = cleanNote ? `[${stamp}] admin:${action} — ${cleanNote}` : `[${stamp}] admin:${action}`;
  return [current?.trim(), nextLine].filter(Boolean).join('\n');
}


function providerForPayout(payout: { provider?: 'none' | 'stripe' | 'airwallex' | null }) {
  return payout.provider ? getMoneyProvider(payout.provider) : getActiveMoneyProvider();
}

function shouldCreateProviderPayoutTransfer(payout: { provider?: 'none' | 'stripe' | 'airwallex' | null; providerAccountId?: string | null; netAmountCents: number }) {
  const moneySafety = buildGlobalMoneySafetyConfig();
  if (!moneySafety.providerTransfersEnabled || payout.netAmountCents <= 0) return false;
  if (!payout.provider || payout.provider === 'none') return false;
  if (payout.provider === 'airwallex') return Boolean(payout.providerAccountId);
  if (payout.provider === 'stripe') return true;
  return false;
}

async function createProviderPayoutTransferForAdmin(input: {
  payoutId: string;
  adminId: string;
  scaToken?: string | null;
}) {
  const payout = await prisma.payoutRequest.findUnique({
    where: { id: input.payoutId },
    include: { providerAccount: true, stripeConnectAccount: true },
  });
  if (!payout) return null;
  if (!shouldCreateProviderPayoutTransfer(payout)) return null;
  const provider = providerForPayout(payout);
  return provider.createPayoutTransfer({
    userId: payout.userId,
    payoutId: payout.id,
    grossAmountCents: payoutGrossCents(payout),
    platformFeeCents: payout.platformFeeCents,
    netAmountCents: payout.netAmountCents,
    currency: payout.currency,
    requestedById: input.adminId,
    scaToken: input.scaToken ?? null,
  });
}

async function syncProviderPayoutTransferForAdmin(input: { payoutId: string; scaToken?: string | null }) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: input.payoutId } });
  if (!payout) return null;
  if (!payout.provider || payout.provider === 'none') return null;
  const provider = getMoneyProvider(payout.provider);
  return provider.syncPayoutTransfer({ payoutId: payout.id, providerTransferId: payout.providerTransferId ?? undefined, scaToken: input.scaToken ?? null });
}

adminRoutes.get('/payouts', asyncRoute(async (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : 'all';
  const status = adminPayoutStatusFilterSchema.safeParse(rawStatus);
  const rawUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const where = {
    ...(status.success && status.data !== 'all' ? { status: status.data } : {}),
    ...(rawUserId ? { userId: rawUserId } : {}),
  };
  const [payouts, byStatus] = await Promise.all([
    prisma.payoutRequest.findMany({
      where,
      include: adminPayoutInclude,
      orderBy: { requestedAt: 'desc' },
      take: 100
    }),
    prisma.payoutRequest.groupBy({ by: ['status'], _count: { _all: true }, _sum: { grossAmountCents: true, platformFeeCents: true, netAmountCents: true } })
  ]);
  res.json({ payouts, summary: { byStatus } });
}));

adminRoutes.get('/payouts/:payoutId', asyncRoute(async (req, res) => {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: req.params.payoutId }, include: { ...adminPayoutInclude, adminEvents: { include: adminPayoutEventInclude, orderBy: { createdAt: 'desc' } } } });
  if (!payout) return res.status(404).json({ error: 'not_found' });
  const providerEventFilters: Array<Record<string, string>> = [];
  if (payout.providerEventId) providerEventFilters.push({ providerEventId: payout.providerEventId });
  if (payout.providerTransferId) providerEventFilters.push({ providerEventId: payout.providerTransferId });
  if (payout.providerPayoutId) providerEventFilters.push({ providerEventId: payout.providerPayoutId });
  if (payout.providerAccount?.providerAccountId) providerEventFilters.push({ providerAccountId: payout.providerAccount.providerAccountId });
  const [ledgerEntries, supportTickets, stripeEvents, providerEvents, providerTransactions, userLimits] = await Promise.all([
    prisma.creditLedgerEntry.findMany({ where: { userId: payout.userId }, orderBy: { createdAt: 'desc' }, take: 40 }),
    prisma.supportTicket.findMany({ where: { userId: payout.userId }, include: { user: { select: supportUserSelect }, assignedAdmin: { select: supportUserSelect }, _count: { select: { messages: true } } }, orderBy: { updatedAt: 'desc' }, take: 10 }),
    prisma.stripeEvent.findMany({
      where: (() => {
        const filters: Array<Record<string, string>> = [];
        if (payout.stripeEventId) filters.push({ stripeEventId: payout.stripeEventId });
        if (payout.stripePayoutId) filters.push({ objectId: payout.stripePayoutId });
        if (payout.stripeTransferId) filters.push({ objectId: payout.stripeTransferId });
        if (payout.stripeConnectAccount?.stripeAccountId) filters.push({ stripeAccountId: payout.stripeConnectAccount.stripeAccountId });
        if (payout.stripeConnectAccountId) filters.push({ stripeConnectAccountId: payout.stripeConnectAccountId });
        return filters.length ? { OR: filters } : { stripeEventId: '__none__' };
      })(),
      orderBy: { createdAt: 'desc' },
      take: 25
    }),
    prisma.moneyProviderEvent.findMany({
      where: providerEventFilters.length ? { OR: providerEventFilters } : { providerEventId: '__none__' },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.moneyProviderTransaction.findMany({
      where: { payoutRequestId: payout.id },
      include: { account: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    buildLaunchLimits(prisma, payout.userId)
  ]);
  res.json({ payout, ledgerEntries, supportTickets: await withSupportTicketMedia(supportTickets, 'admin'), stripeEvents, providerEvents, providerTransactions, userLimits });
}));

adminRoutes.patch('/payouts/:payoutId/action', asyncRoute(async (req, res) => {
  const input = adminPayoutActionRequestSchema.parse(req.body);
  const payout = await prisma.payoutRequest.findUnique({ where: { id: req.params.payoutId }, include: { user: { select: { id: true, wallet: true } }, stripeConnectAccount: true, providerAccount: true } });
  if (!payout) return res.status(404).json({ error: 'not_found' });

  const previousStatus = payout.status;
  const note = input.note?.trim();
  const now = new Date();
  const grossAmountCents = payoutGrossCents(payout);
  const safeMutable = !['paid', 'rejected', 'cancelled'].includes(previousStatus);

  let nextStatus = previousStatus;
  let data: any = { notes: appendAdminNote(payout.notes, note, input.action) };
  let ledgerDescription: string | null = null;
  let walletIncrement = 0;

  if (input.action === 'approve') {
    if (!safeMutable) return res.status(409).json({ error: 'payout_not_mutable', message: 'Only draft/requested payouts can be approved.' });
    nextStatus = 'approved';
    data = { ...data, status: nextStatus, reviewedAt: now, stripeExternalStatus: payout.stripeExternalStatus ?? 'admin_approved', providerExternalStatus: payout.providerExternalStatus ?? 'admin_approved' };
  } else if (input.action === 'pause') {
    if (previousStatus === 'paid') return res.status(409).json({ error: 'payout_paid', message: 'Paid payouts cannot be paused.' });
    nextStatus = 'requested';
    data = { ...data, status: nextStatus, reviewedAt: now, stripeExternalStatus: 'admin_paused', providerExternalStatus: 'admin_paused' };
  } else if (input.action === 'retry') {
    if (previousStatus === 'paid') return res.status(409).json({ error: 'payout_paid', message: 'Paid payouts cannot be retried.' });
    nextStatus = previousStatus === 'rejected' || previousStatus === 'cancelled' ? previousStatus : 'requested';
    data = { ...data, status: nextStatus, reviewedAt: now, stripeFailureCode: null, stripeFailureMessage: null, stripeExternalStatus: 'admin_retry_requested', providerFailureCode: null, providerFailureMessage: null, providerExternalStatus: 'admin_retry_requested' };
  } else if (input.action === 'mark_paid') {
    if (previousStatus === 'rejected' || previousStatus === 'cancelled') return res.status(409).json({ error: 'payout_closed', message: 'Rejected or cancelled payouts cannot be marked paid.' });
    nextStatus = 'paid';
    data = { ...data, status: nextStatus, reviewedAt: now, paidAt: payout.paidAt ?? now, stripeExternalStatus: payout.stripeExternalStatus ?? 'admin_marked_paid', providerExternalStatus: payout.providerExternalStatus ?? 'admin_marked_paid' };
    ledgerDescription = 'Admin marked payout as paid.';
  } else if (input.action === 'reject' || input.action === 'cancel') {
    if (previousStatus === 'paid') return res.status(409).json({ error: 'payout_paid', message: 'Paid payouts cannot be rejected or cancelled.' });
    nextStatus = input.action === 'reject' ? 'rejected' : 'cancelled';
    data = { ...data, status: nextStatus, reviewedAt: now, stripeExternalStatus: `admin_${nextStatus}`, providerExternalStatus: `admin_${nextStatus}` };
    if (previousStatus !== 'rejected' && previousStatus !== 'cancelled') {
      walletIncrement = grossAmountCents;
      ledgerDescription = input.action === 'reject' ? 'Admin rejected payout and returned gross payout-eligible earnings.' : 'Admin cancelled payout and returned gross payout-eligible earnings.';
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (walletIncrement > 0 && payout.user.wallet) {
      await tx.wallet.update({ where: { id: payout.user.wallet.id }, data: { pendingPayoutCents: { increment: walletIncrement } } });
      await tx.creditLedgerEntry.create({ data: { userId: payout.userId, walletId: payout.user.wallet.id, type: 'adjustment', balanceType: 'earned_pending', amount: 0, amountCents: walletIncrement, currency: payout.currency, description: ledgerDescription, metadata: { payoutId: payout.id, adminAction: input.action } } });
    } else if (ledgerDescription && payout.user.wallet) {
      await tx.creditLedgerEntry.create({ data: { userId: payout.userId, walletId: payout.user.wallet.id, type: 'payout_paid', balanceType: 'earned_pending', amount: 0, amountCents: 0, currency: payout.currency, description: ledgerDescription, metadata: { payoutId: payout.id, adminAction: input.action } } });
    }
    const updatedPayout = await tx.payoutRequest.update({ where: { id: payout.id }, data, include: adminPayoutInclude });
    await tx.adminPayoutEvent.create({ data: { payoutRequestId: payout.id, adminId: req.user!.id, action: input.action, note: note || null, previousStatus, nextStatus, metadata: { grossAmountCents, walletReturnedCents: walletIncrement, stripeExternalStatus: updatedPayout.stripeExternalStatus, providerExternalStatus: updatedPayout.providerExternalStatus } } });
    return updatedPayout;
  });

  let refreshed = updated;
  let providerTransfer: unknown = null;
  let providerTransferError: string | null = null;
  if ((input.action === 'approve' || input.action === 'retry') && shouldCreateProviderPayoutTransfer(updated)) {
    try {
      providerTransfer = await createProviderPayoutTransferForAdmin({ payoutId: updated.id, adminId: req.user!.id, scaToken: input.scaToken ?? null });
      refreshed = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: updated.id }, include: adminPayoutInclude });
      await prisma.adminPayoutEvent.create({ data: { payoutRequestId: updated.id, adminId: req.user!.id, action: 'provider_transfer_created', previousStatus: updated.status, nextStatus: refreshed.status, metadata: JSON.parse(JSON.stringify({ providerTransfer })) } });
    } catch (error) {
      providerTransferError = error instanceof Error ? error.message : 'Provider payout transfer failed';
      refreshed = await prisma.payoutRequest.update({ where: { id: updated.id }, data: { providerExternalStatus: 'transfer_failed', providerFailureCode: 'provider_transfer_failed', providerFailureMessage: providerTransferError, notes: appendAdminNote(updated.notes, providerTransferError, 'provider_transfer_failed') }, include: adminPayoutInclude });
      await prisma.adminPayoutEvent.create({ data: { payoutRequestId: updated.id, adminId: req.user!.id, action: 'provider_transfer_failed', previousStatus: updated.status, nextStatus: refreshed.status, metadata: { error: providerTransferError } } });
    }
  }

  res.json({ payout: refreshed, providerTransfer, providerTransferError });
}));

adminRoutes.post('/payouts/:payoutId/provider-sync', asyncRoute(async (req, res) => {
  try {
    const payoutId = req.params.payoutId;
    if (!payoutId) return res.status(400).json({ error: 'payout_id_required' });
    const result = await syncProviderPayoutTransferForAdmin({ payoutId, scaToken: typeof req.body?.scaToken === 'string' ? req.body.scaToken : null });
    const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId }, include: adminPayoutInclude });
    if (!payout) return res.status(404).json({ error: 'not_found' });
    await prisma.adminPayoutEvent.create({ data: { payoutRequestId: payout.id, adminId: req.user!.id, action: 'provider_transfer_synced', previousStatus: payout.status, nextStatus: payout.status, metadata: { result } } }).catch(() => null);
    res.json({ payout, providerTransfer: result });
  } catch (error) {
    if (error instanceof MoneyProviderError) return res.status(error.statusCode).json({ error: error.code, message: error.publicMessage });
    throw error;
  }
}));

adminRoutes.get('/stripe/connect-accounts', asyncRoute(async (_req, res) => {
  const accounts = await prisma.stripeConnectAccount.findMany({
    include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 100
  });
  res.json({ accounts });
}));

adminRoutes.get('/stripe/events', asyncRoute(async (_req, res) => {
  const events = await prisma.stripeEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ events });
}));

adminRoutes.get('/business-profiles', asyncRoute(async (_req, res) => {
  const businessProfiles = await prisma.businessProfile.findMany({
    include: {
      owner: { select: { id: true, email: true, profile: true, trustTier: true } },
      reviewer: { select: { id: true, email: true, profile: true } },
      members: { include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } }, orderBy: { createdAt: 'asc' } },
      moneyProviderAccounts: { orderBy: { createdAt: 'desc' }, take: 5 },
      _count: { select: { needs: true, offers: true, trades: true } },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 150,
  });
  const provider = buildMoneyProviderStatus();
  res.json({ provider, businessProfiles: businessProfiles.map((profile) => ({ ...profile, counts: profile._count })) });
}));

adminRoutes.patch('/business-profiles/:businessProfileId/action', asyncRoute(async (req, res) => {
  const input = adminBusinessProfileActionRequestSchema.parse(req.body);
  const existing = await prisma.businessProfile.findUnique({ where: { id: req.params.businessProfileId } });
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const statusByAction = {
    verify: 'verified',
    restrict: 'restricted',
    disable: 'disabled',
    reject: 'rejected',
    activate: 'active',
  } as const;
  const nextStatus = statusByAction[input.action];
  const updated = await prisma.businessProfile.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      reviewedAt: new Date(),
      reviewerId: req.user!.id,
      reviewNote: input.note ?? null,
      verifiedAt: input.action === 'verify' ? new Date() : input.action === 'activate' ? existing.verifiedAt : null,
    },
    include: {
      owner: { select: { id: true, email: true, profile: true, trustTier: true } },
      reviewer: { select: { id: true, email: true, profile: true } },
      members: { include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } }, orderBy: { createdAt: 'asc' } },
      moneyProviderAccounts: { orderBy: { createdAt: 'desc' }, take: 5 },
      _count: { select: { needs: true, offers: true, trades: true } },
    },
  });
  res.json({ businessProfile: { ...updated, counts: updated._count } });
}));


adminRoutes.get('/money/provider-accounts', asyncRoute(async (_req, res) => {
  const provider = buildMoneyProviderStatus();
  const [providerAccounts, legacyStripeAccounts] = await Promise.all([
    prisma.moneyProviderAccount.findMany({
      include: { user: { select: { id: true, email: true, profile: true, trustTier: true } }, businessProfile: true, balances: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.stripeConnectAccount.findMany({
      include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
  ]);
  res.json({
    provider,
    accounts: [
      ...providerAccounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        accountType: account.accountType,
        businessProfileId: account.businessProfileId,
        businessProfile: account.businessProfile,
        status: account.status,
        defaultCurrency: account.defaultCurrency,
        country: account.country,
        capabilities: account.capabilities,
        requirements: account.requirements,
        rawProviderStatus: account.rawProviderStatus,
        balances: account.balances,
        lastSyncedAt: account.lastSyncedAt,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        user: account.user,
      })),
      ...legacyStripeAccounts.map((account) => ({
        provider: 'stripe_legacy',
        providerAccountId: account.stripeAccountId,
        legacyStripeAccountId: account.stripeAccountId,
        status: account.status,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        detailsSubmitted: account.detailsSubmitted,
        defaultCurrency: account.defaultCurrency,
        country: account.country,
        lastSyncedAt: account.lastSyncedAt,
        user: account.user,
      })),
    ],
  });
}));


adminRoutes.get('/money/provider-balances', asyncRoute(async (_req, res) => {
  const provider = buildMoneyProviderStatus();
  const balances = await prisma.moneyProviderWalletBalance.findMany({
    include: { account: { include: { user: { select: { id: true, email: true, profile: true, trustTier: true } }, businessProfile: true } } },
    orderBy: [{ updatedAt: 'desc' }, { currency: 'asc' }],
    take: 250,
  });
  res.json({
    provider,
    balances: balances.map((balance) => ({
      id: balance.id,
      provider: balance.provider,
      providerAccountId: balance.account.providerAccountId,
      moneyProviderAccountId: balance.moneyProviderAccountId,
      currency: balance.currency,
      availableCents: balance.availableCents,
      reservedCents: balance.reservedCents,
      pendingCents: balance.pendingCents,
      totalCents: balance.availableCents + balance.reservedCents + balance.pendingCents,
      externalUpdatedAt: balance.externalUpdatedAt,
      lastSyncedAt: balance.lastSyncedAt,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt,
      account: {
        id: balance.account.id,
        provider: balance.account.provider,
        status: balance.account.status,
        accountType: balance.account.accountType,
        country: balance.account.country,
        defaultCurrency: balance.account.defaultCurrency,
        user: balance.account.user,
        businessProfile: balance.account.businessProfile,
      },
    })),
  });
}));

adminRoutes.post('/money/provider-accounts/:accountId/sync-balances', asyncRoute(async (req, res) => {
  const input = moneyProviderWalletBalancesSyncRequestSchema.parse(req.body ?? {});
  const account = await prisma.moneyProviderAccount.findUnique({
    where: { id: req.params.accountId },
    include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } },
  });
  if (!account) return res.status(404).json({ error: 'provider_account_not_found', message: 'Provider account was not found.' });
  const provider = getMoneyProvider(account.provider);
  try {
    const result = await provider.syncWalletBalances({ providerAccountId: account.providerAccountId, scaToken: input.scaToken });
    res.json({ provider: provider.getPublicStatus(), ...result });
  } catch (error) {
    if (error instanceof MoneyProviderError) return res.status(error.statusCode).json({ error: error.code, message: error.publicMessage });
    throw error;
  }
}));


adminRoutes.get('/money/provider-transactions', asyncRoute(async (_req, res) => {
  const provider = buildMoneyProviderStatus();
  const transactions = await prisma.moneyProviderTransaction.findMany({
    include: {
      user: { select: { id: true, email: true, profile: true, trustTier: true } },
      account: { select: { id: true, provider: true, providerAccountId: true, status: true, businessProfile: true, user: { select: { id: true, email: true, profile: true, trustTier: true } } } },
      counterpartyAccount: { select: { id: true, provider: true, providerAccountId: true, status: true, businessProfile: true, user: { select: { id: true, email: true, profile: true, trustTier: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 150,
  });
  res.json({
    provider,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      provider: transaction.provider,
      providerTransactionId: transaction.providerTransactionId,
      type: transaction.type,
      status: transaction.status,
      amountCents: transaction.amountCents,
      currency: transaction.currency,
      userId: transaction.userId,
      tradeId: transaction.tradeId,
      payoutRequestId: transaction.payoutRequestId,
      providerAccountId: transaction.account?.providerAccountId ?? null,
      counterpartyProviderAccountId: transaction.counterpartyAccount?.providerAccountId ?? null,
      rawProviderStatus: transaction.rawProviderStatus,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      user: transaction.user,
      account: transaction.account,
      counterpartyAccount: transaction.counterpartyAccount,
    })),
  });
}));

adminRoutes.get('/money/provider-events', asyncRoute(async (_req, res) => {
  const provider = buildMoneyProviderStatus();
  const [providerEvents, legacyStripeEvents] = await Promise.all([
    prisma.moneyProviderEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.stripeEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  res.json({
    provider,
    events: [
      ...providerEvents.map((event) => ({
        provider: event.provider,
        providerEventId: event.providerEventId,
        type: event.eventType,
        processingStatus: event.status,
        providerAccountId: event.providerAccountId,
        createdAt: event.createdAt,
        processedAt: event.processedAt,
        error: event.error,
        payload: event.payload,
      })),
      ...legacyStripeEvents.map((event) => ({
        provider: 'stripe_legacy',
        providerEventId: event.stripeEventId,
        type: event.type,
        processingStatus: event.processingStatus,
        providerAccountId: event.stripeAccountId,
        objectId: event.objectId,
        livemode: event.livemode,
        createdAt: event.createdAt,
        processedAt: event.processedAt,
        error: event.error,
      })),
    ],
  });
}));

adminRoutes.get('/media', asyncRoute(async (req, res) => {
  const input = adminListMediaQuerySchema.parse(req.query);
  const where = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.ownerId ? { ownerId: input.ownerId } : {})
  };
  const media = await prisma.mediaAsset.findMany({
    where,
    include: {
      owner: { select: mediaUserSelect },
      reviewer: { select: mediaUserSelect }
    },
    orderBy: { createdAt: 'desc' },
    take: input.take ?? 100
  });
  res.json({ media: await withMediaEntityContext(media) });
}));

adminRoutes.get('/media/summary', asyncRoute(async (_req, res) => {
  const [byStatus, byEntityType] = await Promise.all([
    prisma.mediaAsset.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.mediaAsset.groupBy({ by: ['entityType'], _count: { _all: true } })
  ]);

  res.json({
    byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
    byEntityType: Object.fromEntries(byEntityType.map((row) => [row.entityType ?? 'unattached', row._count._all]))
  });
}));

adminRoutes.get('/media/:mediaId', asyncRoute(async (req, res) => {
  const media = await prisma.mediaAsset.findUnique({
    where: { id: req.params.mediaId },
    include: {
      owner: { select: mediaUserSelect },
      reviewer: { select: mediaUserSelect }
    }
  });
  if (!media) return res.status(404).json({ error: 'not_found' });
  res.json({ media: (await withMediaEntityContext([media]))[0] });
}));

adminRoutes.patch('/media/:mediaId/status', asyncRoute(async (req, res) => {
  const input = updateMediaStatusRequestSchema.parse(req.body);
  const media = await prisma.mediaAsset.findUnique({ where: { id: req.params.mediaId } });
  if (!media) return res.status(404).json({ error: 'not_found' });
  const updated = await prisma.mediaAsset.update({
    where: { id: media.id },
    data: { status: input.status, reviewNote: input.reviewNote ?? null, reviewerId: req.user!.id, reviewedAt: new Date() },
    include: { owner: { select: { id: true, email: true, profile: true } }, reviewer: { select: { id: true, email: true, profile: true } } }
  });
  if (updated.entityType === 'profile' && updated.entityId && input.status === 'removed') {
    await prisma.profile.updateMany({ where: { id: updated.entityId, avatarMediaId: updated.id }, data: { avatarUrl: null, avatarMediaId: null } });
  }
  res.json({ media: (await withMediaEntityContext([updated]))[0] });
}));

adminRoutes.get('/credits/purchases', asyncRoute(async (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  const where = rawStatus && ['pending', 'paid', 'failed', 'expired'].includes(rawStatus) ? { status: rawStatus as 'pending' | 'paid' | 'failed' | 'expired' } : {};
  const purchases = await prisma.creditPurchase.findMany({
    where,
    include: { user: { select: { id: true, email: true, profile: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json({ purchases });
}));


const supportUserSelect = { id: true, email: true, profile: true } as const;
const supportTicketIncludeForAdmin = {
  user: { select: supportUserSelect },
  assignedAdmin: { select: supportUserSelect },
  messages: {
    include: { sender: { select: supportUserSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

adminRoutes.get('/support/tickets', asyncRoute(async (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  const rawCategory = typeof req.query.category === 'string' ? req.query.category : undefined;
  const rawPriority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  const status = rawStatus ? supportTicketStatusSchema.safeParse(rawStatus) : null;
  const category = rawCategory ? supportTicketCategorySchema.safeParse(rawCategory) : null;
  const priority = rawPriority ? supportTicketPrioritySchema.safeParse(rawPriority) : null;
  const where = {
    ...(status?.success ? { status: status.data } : {}),
    ...(category?.success ? { category: category.data } : {}),
    ...(priority?.success ? { priority: priority.data } : {}),
  };
  const tickets = await prisma.supportTicket.findMany({
    where,
    include: { user: { select: supportUserSelect }, assignedAdmin: { select: supportUserSelect }, _count: { select: { messages: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  res.json({ tickets: await withSupportTicketMedia(tickets, 'admin') });
}));

adminRoutes.get('/support/tickets/:ticketId', asyncRoute(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId }, include: supportTicketIncludeForAdmin });
  if (!ticket) return res.status(404).json({ error: 'not_found' });
  res.json({ ticket: await withOneSupportTicketMedia(ticket, 'admin') });
}));

adminRoutes.patch('/support/tickets/:ticketId', asyncRoute(async (req, res) => {
  const input = adminUpdateSupportTicketRequestSchema.parse(req.body);
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const status = input.status ?? existing.status;
  const updated = await prisma.supportTicket.update({
    where: { id: existing.id },
    data: {
      status,
      priority: input.priority ?? existing.priority,
      assignedAdminId: input.assignedAdminId === undefined ? existing.assignedAdminId : input.assignedAdminId,
      resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : null,
    },
    include: supportTicketIncludeForAdmin,
  });
  res.json({ ticket: await withOneSupportTicketMedia(updated, 'admin') });
}));

adminRoutes.post('/support/tickets/:ticketId/messages', asyncRoute(async (req, res) => {
  const input = adminCreateSupportMessageRequestSchema.parse(req.body);
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!ticket) return res.status(404).json({ error: 'not_found' });
  const message = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: req.user!.id,
      senderRole: 'admin',
      body: input.body,
      internal: input.internal ?? false,
    },
    include: { sender: { select: supportUserSelect } },
  });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'support_message', message.id);
  const nextStatus = input.status ?? (input.internal ? ticket.status : 'waiting_for_user');
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: nextStatus, assignedAdminId: ticket.assignedAdminId ?? req.user!.id, resolvedAt: nextStatus === 'resolved' || nextStatus === 'closed' ? new Date() : null },
  });
  res.status(201).json({ message: await withOneSupportMessageMedia(message, 'admin') });
}));
