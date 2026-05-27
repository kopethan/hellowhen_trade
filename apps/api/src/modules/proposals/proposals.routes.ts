import { Router, type Response } from 'express';
import { createProposalMessageRequestSchema, updateProposalMessageRequestSchema, updateProposalPrivateMessageRequestSchema, updateProposalStatusRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { holdOwnerCreditsForProposal, proposalInclude, withOneTradeDeckMedia, withProposalTradeMedia } from '../trades/trades.routes.js';
import { publicUserPreviewSelect } from '../users/publicUser.js';
import { usersHaveBlockBetween } from '../users/userBlocks.js';
import { hasProposalPackageInput, resolveProposalPackagePayload, toProposalPackageItemCreateManyRows } from './proposalPackages.js';

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

async function resolveProposalSideUpdate(input: { proposedNeedId?: string | null; proposedOfferId?: string | null }, proposal: { applicantId: string; proposedNeedId?: string | null; proposedOfferId?: string | null; trade: { postType?: string | null } }) {
  const requiredSide = proposalSideRequirement(proposal.trade.postType);
  const nextNeedProvided = Object.prototype.hasOwnProperty.call(input, 'proposedNeedId');
  const nextOfferProvided = Object.prototype.hasOwnProperty.call(input, 'proposedOfferId');
  const nextNeedId = nextNeedProvided ? input.proposedNeedId ?? null : proposal.proposedNeedId ?? null;
  const nextOfferId = nextOfferProvided ? input.proposedOfferId ?? null : proposal.proposedOfferId ?? null;

  if (requiredSide === 'offer' && !nextOfferId) {
    throw Object.assign(new Error('proposal_offer_required'), { code: 'PROPOSAL_OFFER_REQUIRED' });
  }
  if (requiredSide === 'need' && !nextNeedId) {
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
proposalsRoutes.patch('/:proposalId/status', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updateProposalStatusRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: proposalInclude });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (input.status === 'withdrawn') {
    if (proposal.applicantId !== actorId) return res.status(403).json({ error: 'forbidden' });
    if (!['pending', 'declined'].includes(proposal.status)) return res.status(409).json({ error: 'invalid_proposal_status_transition' });
    const updated = await prisma.tradeProposal.update({ where: { id: proposal.id }, data: { status: 'withdrawn', respondedAt: new Date() }, include: proposalInclude });
    return res.json({ proposal: (await withProposalTradeMedia([updated], 'owner'))[0] });
  }
  if (proposal.trade.ownerId !== actorId) return res.status(403).json({ error: 'forbidden', message: 'Only the trade owner can accept or decline proposals.' });
  if (input.status === 'declined') {
    if (proposal.status !== 'pending') return res.status(409).json({ error: 'invalid_proposal_status_transition' });
    const updated = await prisma.tradeProposal.update({ where: { id: proposal.id }, data: { status: 'declined', respondedAt: new Date() }, include: proposalInclude });
    return res.json({ proposal: (await withProposalTradeMedia([updated], 'owner'))[0] });
  }
  if (input.status === 'accepted') {
    if (proposal.status !== 'pending') return res.status(409).json({ error: 'invalid_proposal_status_transition' });
    try {
      const trade = await withOneTradeDeckMedia(await holdOwnerCreditsForProposal(proposal.tradeId, proposal.id, proposal.trade.ownerId, proposal.applicantId), 'owner');
      const updated = await prisma.tradeProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalInclude });
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
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: { trade: true } });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (proposal.applicantId !== actorId) return res.status(403).json({ error: 'forbidden' });
  if (conversationLocked(proposal)) return res.status(409).json({ error: 'proposal_content_locked', message: 'This proposal is locked after an owner decision.' });

  const packageInput = hasProposalPackageInput(input);
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
      nextSide = await resolveProposalSideUpdate(input, proposal);
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
  if (!messageChanged && !sideChanged && !packageChanged && !proposal.messageDeletedAt) {
    const current = await prisma.tradeProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalInclude });
    return res.json({ proposal: (await withProposalTradeMedia([current], 'owner'))[0] });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const data: any = {
      proposedNeedId: nextSide.proposedNeedId,
      proposedOfferId: nextSide.proposedOfferId,
      packageKind,
    };
    if (typeof input.message === 'string') {
      data.message = input.message;
      data.messageEditedAt = now;
      data.messageEditCount = { increment: 1 };
      data.messageDeletedAt = null;
    }
    await tx.tradeProposal.update({ where: { id: proposal.id }, data });
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
