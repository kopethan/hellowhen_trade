import { Router } from 'express';
import { createProposalMessageRequestSchema, updateProposalStatusRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { holdOwnerCreditsForProposal, proposalInclude, withOneTradeDeckMedia, withProposalTradeMedia } from '../trades/trades.routes.js';

export const proposalsRoutes = Router();
proposalsRoutes.use(requireAuth);
function canReadProposal(proposal: { applicantId: string; trade: { ownerId: string; providerId?: string | null } }, actorId: string) { return proposal.applicantId === actorId || proposal.trade.ownerId === actorId || proposal.trade.providerId === actorId; }

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
proposalsRoutes.patch('/:proposalId/status', asyncRoute(async (req, res) => {
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
proposalsRoutes.get('/:proposalId/messages', asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: { trade: true } });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (!canReadProposal(proposal, actorId)) return res.status(403).json({ error: 'forbidden' });
  const messages = await prisma.proposalMessage.findMany({ where: { proposalId: proposal.id }, include: { sender: { select: { id: true, profile: true } } }, orderBy: { createdAt: 'asc' } });
  res.json({ messages });
}));
proposalsRoutes.post('/:proposalId/messages', asyncRoute(async (req, res) => {
  const input = createProposalMessageRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const proposal = await prisma.tradeProposal.findUnique({ where: { id: req.params.proposalId }, include: { trade: true } });
  if (!proposal) return res.status(404).json({ error: 'not_found' });
  if (!canReadProposal(proposal, actorId)) return res.status(403).json({ error: 'forbidden' });
  if (['declined', 'withdrawn'].includes(proposal.status)) return res.status(409).json({ error: 'proposal_conversation_closed', message: 'This proposal conversation is closed.' });
  const message = await prisma.proposalMessage.create({ data: { proposalId: proposal.id, senderId: actorId, body: input.body }, include: { sender: { select: { id: true, profile: true } } } });
  const updatedProposal = await prisma.tradeProposal.update({ where: { id: proposal.id }, data: { updatedAt: new Date() }, include: proposalInclude });
  res.status(201).json({ message, proposal: (await withProposalTradeMedia([updatedProposal], 'owner'))[0] });
}));
