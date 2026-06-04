import { Router, type Response } from 'express';
import { createDealProblemReportRequestSchema, createProposalMessageRequestSchema, updateProposalMessageRequestSchema, updateProposalPrivateMessageRequestSchema, updateProposalStatusRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { holdOwnerCreditsForProposal, proposalInclude, tradeInclude, withOneTradeDeckMedia, withProposalTradeMedia } from '../trades/trades.routes.js';
import { publicUserPreviewSelect } from '../users/publicUser.js';
import { usersHaveBlockBetween } from '../users/userBlocks.js';
import { hasProposalPackageInput, resolveProposalPackagePayload, toProposalPackageItemCreateManyRows } from './proposalPackages.js';
import { notifyProposalDecision, notifyProposalMessageReceived, notifyProposalWithdrawn, notifyTradeStatusUpdated } from '../notifications/notifications.service.js';
import { validateCashPromiseInput } from '../cash-promise/cashPromise.js';

export const proposalsRoutes = Router();
proposalsRoutes.use(requireAuth);
function canReadProposal(proposal: { applicantId: string; trade: { ownerId: string; providerId?: string | null } }, actorId: string) { return proposal.applicantId === actorId || proposal.trade.ownerId === actorId || proposal.trade.providerId === actorId; }
function otherProposalMemberId(proposal: { applicantId: string; trade: { ownerId: string } }, actorId: string) { return actorId === proposal.applicantId ? proposal.trade.ownerId : proposal.applicantId; }

function proposalSideRequirement(postType?: string | null) {
  if (postType === 'open_need') return 'offer' as const;
  if (postType === 'open_offer') return 'need' as const;
  return null;
}

function inventoryUnavailable(status?: string | null) {
  return status !== 'active';
}

function conversationLocked(proposal: { status: string; trade: { status: string } }) {
  return proposal.status !== 'pending' || ['cancelled', 'closed'].includes(proposal.trade.status);
}


function participantRoleForDealProblem(proposal: { applicantId: string; trade: { ownerId: string; providerId?: string | null } }, actorId: string) {
  if (actorId === proposal.trade.ownerId) return 'owner';
  if (actorId === proposal.applicantId) return 'applicant';
  if (actorId === proposal.trade.providerId) return 'provider';
  return 'participant';
}

function truncateReportDetails(value: string) {
  const trimmed = value.trim();
  return trimmed.length <= 2000 ? trimmed : `${trimmed.slice(0, 1997)}…`;
}

function buildDealProblemReportDetails(input: {
  details: string;
  reporterRole: string;
  tradeId: string;
  tradeTitle: string;
  tradeStatus: string;
  proposalId: string;
  proposalStatus: string;
  counterpartyId: string | null;
}) {
  return truncateReportDetails([
    'Accepted deal problem report',
    '',
    `Reporter role: ${input.reporterRole}`,
    input.counterpartyId ? `Counterparty user ID: ${input.counterpartyId}` : null,
    `Trade: ${input.tradeTitle}`,
    `Trade ID: ${input.tradeId}`,
    `Trade status when reported: ${input.tradeStatus}`,
    `Proposal ID: ${input.proposalId}`,
    `Proposal status: ${input.proposalStatus}`,
    '',
    'Problem summary:',
    input.details.trim(),
    '',
    'Context: created from the private Deal workspace. Keep evidence and important details in the proposal conversation.',
  ].filter(Boolean).join('\n'));
}

async function resolveProposalSideUpdate(input: { proposedNeedId?: string | null; proposedOfferId?: string | null }, proposal: { applicantId: string; proposedNeedId?: string | null; proposedOfferId?: string | null; cashPromise?: { side: 'need' | 'offer' } | null; trade: { postType?: string | null } }, cashPromiseSide?: 'need' | 'offer' | null) {
  const requiredSide = proposalSideRequirement(proposal.trade.postType);
  const nextNeedProvided = Object.prototype.hasOwnProperty.call(input, 'proposedNeedId');
  const nextOfferProvided = Object.prototype.hasOwnProperty.call(input, 'proposedOfferId');
  const nextNeedId = nextNeedProvided ? input.proposedNeedId ?? null : proposal.proposedNeedId ?? null;
  const nextOfferId = nextOfferProvided ? input.proposedOfferId ?? null : proposal.proposedOfferId ?? null;

  const effectiveCashPromiseSide = cashPromiseSide ?? proposal.cashPromise?.side ?? null;
  if (effectiveCashPromiseSide === 'offer' && nextOfferId) {
    throw Object.assign(new Error('cash_promise_side_conflict'), { code: 'CASH_PROMISE_SIDE_CONFLICT' });
  }
  if (effectiveCashPromiseSide === 'need' && nextNeedId) {
    throw Object.assign(new Error('cash_promise_side_conflict'), { code: 'CASH_PROMISE_SIDE_CONFLICT' });
  }
  if (requiredSide === 'offer' && !nextOfferId && effectiveCashPromiseSide !== 'offer') {
    throw Object.assign(new Error('proposal_offer_required'), { code: 'PROPOSAL_OFFER_REQUIRED' });
  }
  if (requiredSide === 'need' && !nextNeedId && effectiveCashPromiseSide !== 'need') {
    throw Object.assign(new Error('proposal_need_required'), { code: 'PROPOSAL_NEED_REQUIRED' });
  }

  if (nextOfferId) {
    const offer = await prisma.offer.findFirst({ where: { id: nextOfferId, ownerId: proposal.applicantId } });
    if (!offer || inventoryUnavailable(offer.status)) {
      throw Object.assign(new Error('invalid_proposal_offer'), { code: 'INVALID_PROPOSAL_OFFER' });
    }
  }
  if (nextNeedId) {
    const need = await prisma.need.findFirst({ where: { id: nextNeedId, ownerId: proposal.applicantId } });
    if (!need || inventoryUnavailable(need.status)) {
      throw Object.assign(new Error('invalid_proposal_need'), { code: 'INVALID_PROPOSAL_NEED' });
    }
  }

  return { proposedNeedId: nextNeedId, proposedOfferId: nextOfferId };
}

function proposalSideErrorResponse(res: Response, error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'PROPOSAL_OFFER_REQUIRED') return res.status(400).json({ error: 'proposal_offer_required', message: 'Choose one of your saved Offers to propose for this Open Need.' });
  if (code === 'PROPOSAL_NEED_REQUIRED') return res.status(400).json({ error: 'proposal_need_required', message: 'Choose one of your saved Needs to propose for this Open Offer.' });
  if (code === 'INVALID_PROPOSAL_OFFER') return res.status(400).json({ error: 'invalid_proposal_offer', message: 'Choose an active Offer from your account.' });
  if (code === 'INVALID_PROPOSAL_NEED') return res.status(400).json({ error: 'invalid_proposal_need', message: 'Choose an active Need from your account.' });
  if (code === 'CASH_PROMISE_SIDE_CONFLICT') return res.status(400).json({ error: 'cash_promise_side_conflict', message: 'Cash Promise cannot be combined with a proposed Need or Offer on the same side.' });
  return null;
}

proposalsRoutes.get('/mine', asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const proposals = await prisma.tradeProposal.findMany({ where: { OR: [{ applicantId: actorId }, { trade: { ownerId: actorId } }, { trade: { providerId: actorId } }] }, include: proposalInclude, orderBy: { updatedAt: 'desc' }, take: 50 });
  res.json({ proposals: await withProposalTradeMedia(proposals, 'owner') });
}));
proposalsRoutes.get('/:proposalId', asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: proposalInclude });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (!canReadProposal(proposal, actorId)) return res.status(403).json({ error: 'forbidden' });
  res.json({ proposal: (await withProposalTradeMedia([proposal], 'owner'))[0] });
}));

proposalsRoutes.post('/:proposalId/problem-report', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createDealProblemReportRequestSchema.parse(req.body ?? {});
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: proposalInclude });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (!canReadProposal(proposal, actorId)) return res.status(403).json({ error: 'forbidden' });
  if (proposal.status !== 'accepted') return res.status(409).json({ error: 'proposal_not_accepted', message: 'Only accepted proposals can be reported from the Deal workspace.' });
  if (!['in_progress', 'submitted', 'disputed'].includes(proposal.trade.status)) return res.status(409).json({ error: 'deal_not_reportable', message: 'This deal is not open for problem reporting.' });
  if (await usersHaveBlockBetween(actorId, otherProposalMemberId(proposal, actorId))) return res.status(403).json({ error: 'user_blocked', message: 'This conversation is not available because one member has blocked the other.' });

  const counterpartyId = otherProposalMemberId(proposal, actorId);
  const reporterRole = participantRoleForDealProblem(proposal, actorId);
  const details = buildDealProblemReportDetails({
    details: input.details,
    reporterRole,
    tradeId: proposal.tradeId,
    tradeTitle: proposal.trade.title,
    tradeStatus: proposal.trade.status,
    proposalId: proposal.id,
    proposalStatus: proposal.status,
    counterpartyId,
  });
  const now = new Date();

  const result = await prisma.$transaction(async (tx: any) => {
    const existingReport = await tx.report.findFirst({
      where: { reporterId: actorId, targetType: 'proposal', targetId: proposal.id, status: { in: ['pending', 'reviewing'] } },
      include: { reporter: { select: publicUserPreviewSelect }, reviewer: { select: publicUserPreviewSelect } },
    });
    const report = existingReport
      ? await tx.report.update({
        where: { id: existingReport.id },
        data: { reason: input.reason, details, targetOwnerId: counterpartyId },
        include: { reporter: { select: publicUserPreviewSelect }, reviewer: { select: publicUserPreviewSelect } },
      })
      : await tx.report.create({
        data: { reporterId: actorId, targetType: 'proposal', targetId: proposal.id, targetOwnerId: counterpartyId, reason: input.reason, details },
        include: { reporter: { select: publicUserPreviewSelect }, reviewer: { select: publicUserPreviewSelect } },
      });

    const trade = proposal.trade.status === 'disputed'
      ? proposal.trade
      : await tx.trade.update({ where: { id: proposal.tradeId }, data: { status: 'disputed', isPublic: false, disputedById: actorId, disputedAt: now }, include: tradeInclude });
    const updatedProposal = await tx.tradeProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalInclude });
    return { report, proposal: updatedProposal, trade, duplicate: Boolean(existingReport) };
  });

  try {
    await notifyTradeStatusUpdated(prisma, { recipientIds: [proposal.trade.ownerId, proposal.trade.providerId], actorId, tradeId: proposal.tradeId, tradeTitle: proposal.trade.title, status: 'disputed', proposalId: proposal.id });
  } catch {
    // Internal notifications should not block problem reports.
  }

  return res.status(result.duplicate ? 200 : 201).json({
    report: result.report,
    duplicate: result.duplicate,
    proposal: (await withProposalTradeMedia([result.proposal], 'owner'))[0],
    trade: await withOneTradeDeckMedia(result.trade, 'owner'),
  });
}));
proposalsRoutes.patch('/:proposalId/status', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updateProposalStatusRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: proposalInclude });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (input.status === 'withdrawn') {
    if (proposal.applicantId !== actorId) return res.status(403).json({ error: 'forbidden' });
    if (!['pending', 'declined'].includes(proposal.status)) return res.status(409).json({ error: 'invalid_proposal_status_transition' });
    const updated = await prisma.tradeProposal.update({ where: { id: proposal.id }, data: { status: 'withdrawn', respondedAt: new Date() }, include: proposalInclude });
    try {
      await notifyProposalWithdrawn(prisma, { ownerId: proposal.trade.ownerId, actorId, tradeId: proposal.tradeId, proposalId: proposal.id, tradeTitle: proposal.trade.title });
    } catch {
      // Notifications should not block proposal withdrawal.
    }
    return res.json({ proposal: (await withProposalTradeMedia([updated], 'owner'))[0] });
  }
  if (proposal.trade.ownerId !== actorId) return res.status(403).json({ error: 'forbidden', message: 'Only the trade owner can accept or decline proposals.' });
  if (input.status === 'declined') {
    if (proposal.status !== 'pending') return res.status(409).json({ error: 'invalid_proposal_status_transition' });
    const updated = await prisma.tradeProposal.update({ where: { id: proposal.id }, data: { status: 'declined', respondedAt: new Date() }, include: proposalInclude });
    try {
      await notifyProposalDecision(prisma, { applicantId: proposal.applicantId, actorId, tradeId: proposal.tradeId, proposalId: proposal.id, tradeTitle: proposal.trade.title, decision: 'declined' });
    } catch {
      // Notifications should not block proposal decisions.
    }
    return res.json({ proposal: (await withProposalTradeMedia([updated], 'owner'))[0] });
  }
  if (input.status === 'accepted') {
    if (proposal.status !== 'pending') return res.status(409).json({ error: 'invalid_proposal_status_transition' });
    try {
      const trade = await withOneTradeDeckMedia(await holdOwnerCreditsForProposal(proposal.tradeId, proposal.id, proposal.trade.ownerId, proposal.applicantId), 'owner');
      const updated = await prisma.tradeProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalInclude });
      try {
        await notifyProposalDecision(prisma, { applicantId: proposal.applicantId, actorId, tradeId: proposal.tradeId, proposalId: proposal.id, tradeTitle: proposal.trade.title, decision: 'accepted' });
      } catch {
        // Notifications should not block proposal decisions.
      }
      return res.json({ proposal: (await withProposalTradeMedia([updated], 'owner'))[0], trade });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : null;
      if (code === 'INSUFFICIENT_WALLET_BALANCE') return res.status(400).json({ error: 'insufficient_wallet_balance', message: 'Not enough wallet balance to accept this proposal.' });
      if (code === 'INVALID_TRADE_STATUS_TRANSITION') return res.status(409).json({ error: 'invalid_trade_status_transition' });
      if (code === 'TRADE_ALREADY_HAS_PROVIDER') return res.status(409).json({ error: 'trade_already_has_provider', message: 'This trade already has an accepted provider.' });
      if (code === 'PROPOSAL_SIDE_REQUIRED') return res.status(409).json({ error: 'proposal_side_required', message: 'This proposal is missing the required Need or Offer side.' });
      if (code === 'PROPOSAL_SIDE_UNAVAILABLE') return res.status(409).json({ error: 'proposal_side_unavailable', message: 'The proposed Need or Offer is no longer available.' });
      if (code === 'MONEY_TRADES_DISABLED') return res.status(403).json({ error: 'money_trades_disabled', message: 'Money, wallet, and credit trades are disabled for the first beta. Create Need + Offer exchanges only.' });
      if (code === 'FORBIDDEN') return res.status(403).json({ error: 'forbidden' });
      if (code === 'NOT_FOUND') return res.status(404).json({ error: 'not_found' });
      throw error;
    }
  }
  return res.status(400).json({ error: 'unsupported_proposal_status' });
}));

proposalsRoutes.patch('/:proposalId/message', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updateProposalMessageRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const cashPromiseProvided = Object.prototype.hasOwnProperty.call(input, 'cashPromise');
  const cashPromiseDecision = validateCashPromiseInput(input.cashPromise ?? undefined, cashPromiseProvided, { allowProposal: true });
  if (cashPromiseDecision && !cashPromiseDecision.ok) {
    return res.status(cashPromiseDecision.statusCode).json(cashPromiseDecision.body);
  }
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: { trade: true, cashPromise: true } });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (proposal.applicantId !== actorId) return res.status(403).json({ error: 'forbidden' });
  if (conversationLocked(proposal)) return res.status(409).json({ error: 'proposal_content_locked', message: 'This proposal is locked after an owner decision.' });

  const packageInput = hasProposalPackageInput(input);
  const nextCashPromise = cashPromiseDecision?.ok ? cashPromiseDecision.cashPromise : null;
  if (packageInput && nextCashPromise) {
    return res.status(400).json({ error: 'cash_promise_package_conflict', message: 'Cash Promise cannot be combined with proposal packages.' });
  }
  let nextSide: { proposedNeedId: string | null; proposedOfferId: string | null };
  let packageKind: 'standard' | 'main_need_multi_offer' | 'main_offer_multi_need' = proposal.packageKind ?? 'standard';
  let packageItems: ReturnType<typeof toProposalPackageItemCreateManyRows> | null = null;
  try {
    if (packageInput) {
      const resolvedPackage = await resolveProposalPackagePayload(input, actorId, proposal.trade);
      if (!resolvedPackage) throw Object.assign(new Error('invalid_proposal_package'), { code: 'INVALID_PROPOSAL_PACKAGE' });
      nextSide = { proposedNeedId: resolvedPackage.proposedNeedId, proposedOfferId: resolvedPackage.proposedOfferId };
      packageKind = resolvedPackage.packageKind;
      packageItems = toProposalPackageItemCreateManyRows(proposal.id, resolvedPackage.items);
    } else {
      nextSide = await resolveProposalSideUpdate(input, proposal, nextCashPromise?.side);
    }
  } catch (error) {
    const response = proposalSideErrorResponse(res, error);
    if (response) return response;
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'PRO_TRADE_PACKAGES_DISABLED') return res.status(403).json({ error: 'pro_trade_packages_disabled', message: 'Pro Trade Packages are hidden and disabled.' });
    if (code === 'PRO_ACCESS_REQUIRED') return res.status(403).json({ error: 'pro_access_required', message: 'Trade Packages require verified Professional access.' });
    if (code === 'PROPOSAL_PACKAGE_UNSUPPORTED_TRADE_TYPE') return res.status(400).json({ error: 'proposal_package_unsupported_trade_type', message: 'Trade Packages are only supported for Open Need and Open Offer proposal flows.' });
    if (code === 'PROPOSAL_PACKAGE_KIND_MISMATCH') return res.status(400).json({ error: 'proposal_package_kind_mismatch', message: 'Package kind does not match this trade type.' });
    if (code === 'INVALID_PROPOSAL_PACKAGE_OFFER') return res.status(400).json({ error: 'invalid_proposal_package_offer', message: 'Choose active Offers from your account.' });
    if (code === 'INVALID_PROPOSAL_PACKAGE_NEED') return res.status(400).json({ error: 'invalid_proposal_package_need', message: 'Choose active Needs from your account.' });
    if (code === 'INVALID_PROPOSAL_PACKAGE') return res.status(400).json({ error: 'invalid_proposal_package', message: 'The proposal package is not valid.', details: (error as { details?: unknown }).details });
    throw error;
  }

  const messageChanged = typeof input.message === 'string' && input.message !== proposal.message;
  const sideChanged = nextSide.proposedNeedId !== proposal.proposedNeedId || nextSide.proposedOfferId !== proposal.proposedOfferId;
  const packageChanged = packageInput;
  const cashPromiseChanged = Boolean(nextCashPromise);
  if (!messageChanged && !sideChanged && !packageChanged && !cashPromiseChanged && !proposal.messageDeletedAt) {
    const current = await prisma.tradeProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalInclude });
    return res.json({ proposal: (await withProposalTradeMedia([current], 'owner'))[0] });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const data: any = {
      proposedNeedId: nextCashPromise?.side === 'need' ? null : nextSide.proposedNeedId,
      proposedOfferId: nextCashPromise?.side === 'offer' ? null : nextSide.proposedOfferId,
      packageKind,
    };
    if (typeof input.message === 'string') {
      data.message = input.message;
      data.messageEditedAt = now;
      data.messageEditCount = { increment: 1 };
      data.messageDeletedAt = null;
    }
    await tx.tradeProposal.update({ where: { id: proposal.id }, data });
    if (nextCashPromise) {
      await tx.cashPromise.deleteMany({ where: { proposalId: proposal.id } });
      await tx.cashPromise.create({
        data: {
          proposalId: proposal.id,
          side: nextCashPromise.side,
          amountCents: nextCashPromise.amountCents,
          currency: nextCashPromise.currency,
          note: nextCashPromise.note,
          acknowledgementText: nextCashPromise.acknowledgementText,
          acknowledgedById: actorId,
          acknowledgedAt: now,
        },
      });
    }
    if (packageItems) {
      await tx.tradeProposalPackageItem.deleteMany({ where: { proposalId: proposal.id } });
      if (packageItems.length) await tx.tradeProposalPackageItem.createMany({ data: packageItems });
    }
    if (typeof input.message === 'string') {
      const firstMessage = await tx.proposalMessage.findFirst({ where: { proposalId: proposal.id, senderId: proposal.applicantId }, orderBy: { createdAt: 'asc' } });
      if (firstMessage) {
        await tx.proposalMessage.update({ where: { id: firstMessage.id }, data: { body: input.message, editedAt: now, editCount: { increment: 1 }, deletedAt: null } });
      }
    }
    return tx.tradeProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalInclude });
  });

  res.json({ proposal: (await withProposalTradeMedia([updated], 'owner'))[0] });
}));

proposalsRoutes.delete('/:proposalId/message', requireActiveAccount, asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: { trade: true } });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (proposal.applicantId !== actorId) return res.status(403).json({ error: 'forbidden' });
  if (conversationLocked(proposal)) return res.status(409).json({ error: 'proposal_content_locked', message: 'This proposal is locked after an owner decision.' });
  if (proposal.messageDeletedAt) {
    const current = await prisma.tradeProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalInclude });
    return res.json({ proposal: (await withProposalTradeMedia([current], 'owner'))[0] });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.tradeProposal.update({ where: { id: proposal.id }, data: { message: '', messageDeletedAt: now } });
    const firstMessage = await tx.proposalMessage.findFirst({ where: { proposalId: proposal.id, senderId: proposal.applicantId }, orderBy: { createdAt: 'asc' } });
    if (firstMessage) {
      await tx.proposalMessage.update({ where: { id: firstMessage.id }, data: { body: '', deletedAt: now } });
    }
    return tx.tradeProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalInclude });
  });
  res.json({ proposal: (await withProposalTradeMedia([updated], 'owner'))[0] });
}));

proposalsRoutes.get('/:proposalId/messages', asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: { trade: true } });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (!canReadProposal(proposal, actorId)) return res.status(403).json({ error: 'forbidden' });
  const messages = await prisma.proposalMessage.findMany({ where: { proposalId: proposal.id }, include: { sender: { select: publicUserPreviewSelect } }, orderBy: { createdAt: 'asc' } });
  res.json({ messages });
}));
proposalsRoutes.post('/:proposalId/messages', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createProposalMessageRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: { trade: true } });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (!canReadProposal(proposal, actorId)) return res.status(403).json({ error: 'forbidden' });
  if (['declined', 'withdrawn'].includes(proposal.status) || ['cancelled', 'closed'].includes(proposal.trade.status)) return res.status(409).json({ error: 'proposal_conversation_closed', message: 'This proposal conversation is closed.' });
  if (await usersHaveBlockBetween(actorId, otherProposalMemberId(proposal, actorId))) return res.status(403).json({ error: 'user_blocked', message: 'This conversation is not available because one member has blocked the other.' });
  const message = await prisma.proposalMessage.create({ data: { proposalId: proposal.id, senderId: actorId, body: input.body }, include: { sender: { select: publicUserPreviewSelect } } });
  try {
    await notifyProposalMessageReceived(prisma, { recipientId: otherProposalMemberId(proposal, actorId), actorId, tradeId: proposal.tradeId, proposalId: proposal.id, tradeTitle: proposal.trade.title });
  } catch {
    // Notifications should not block private replies.
  }
  const updatedProposal = await prisma.tradeProposal.update({ where: { id: proposal.id }, data: { updatedAt: new Date() }, include: proposalInclude });
  res.status(201).json({ message, proposal: (await withProposalTradeMedia([updatedProposal], 'owner'))[0] });
}));

proposalsRoutes.patch('/:proposalId/messages/:messageId', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updateProposalPrivateMessageRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: { trade: true } });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (!canReadProposal(proposal, actorId)) return res.status(403).json({ error: 'forbidden' });
  if (conversationLocked(proposal)) return res.status(409).json({ error: 'proposal_content_locked', message: 'This proposal conversation is locked.' });
  const message = await prisma.proposalMessage.findUnique({ where: { id: req.params.messageId } });
  if (!message || message.proposalId !== proposal.id) return res.status(404).json({ error: 'not_found' });
  if (message.senderId !== actorId) return res.status(403).json({ error: 'forbidden' });
  if (message.deletedAt) return res.status(409).json({ error: 'message_deleted', message: 'Deleted messages cannot be edited.' });
  const updated = await prisma.proposalMessage.update({ where: { id: message.id }, data: { body: input.body, editedAt: new Date(), editCount: { increment: 1 } }, include: { sender: { select: publicUserPreviewSelect } } });
  const updatedProposal = await prisma.tradeProposal.update({ where: { id: proposal.id }, data: { updatedAt: new Date() }, include: proposalInclude });
  res.json({ message: updated, proposal: (await withProposalTradeMedia([updatedProposal], 'owner'))[0] });
}));

proposalsRoutes.delete('/:proposalId/messages/:messageId', requireActiveAccount, asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: { trade: true } });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (!canReadProposal(proposal, actorId)) return res.status(403).json({ error: 'forbidden' });
  if (conversationLocked(proposal)) return res.status(409).json({ error: 'proposal_content_locked', message: 'This proposal conversation is locked.' });
  const message = await prisma.proposalMessage.findUnique({ where: { id: req.params.messageId } });
  if (!message || message.proposalId !== proposal.id) return res.status(404).json({ error: 'not_found' });
  if (message.senderId !== actorId) return res.status(403).json({ error: 'forbidden' });
  if (message.deletedAt) {
    const existing = await prisma.proposalMessage.findUniqueOrThrow({ where: { id: message.id }, include: { sender: { select: publicUserPreviewSelect } } });
    return res.json({ message: existing });
  }
  const updated = await prisma.proposalMessage.update({ where: { id: message.id }, data: { body: '', deletedAt: new Date() }, include: { sender: { select: publicUserPreviewSelect } } });
  const updatedProposal = await prisma.tradeProposal.update({ where: { id: proposal.id }, data: { updatedAt: new Date() }, include: proposalInclude });
  res.json({ message: updated, proposal: (await withProposalTradeMedia([updatedProposal], 'owner'))[0] });
}));
