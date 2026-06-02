import { Router } from 'express';
import { createNeedRequestSchema, updateNeedRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { buildContentReviewGateDecision, classifyContentRulesIfEnabled } from '../content-intelligence/contentIntelligence.classifier.js';
import { attachUploadedMediaToEntity, withMedia, withOneMedia } from '../media/media.helpers.js';
import { inventoryTranslationExtraText, syncInventoryTranslations, withInventoryTranslations, withOneInventoryTranslation } from '../inventoryTranslations.js';

export const needsRoutes = Router();
needsRoutes.use(requireAuth);

const activeLinkedTradeStatuses = ['active', 'funded', 'in_progress', 'submitted', 'disputed'] as const;

function activeLinkedTradeWhere(needId: string) {
  return { needId, status: { in: [...activeLinkedTradeStatuses] } };
}

async function loadActiveLinkedTrades(needId: string) {
  const [activeTradeCount, activeTrades] = await Promise.all([
    prisma.trade.count({ where: activeLinkedTradeWhere(needId) }),
    prisma.trade.findMany({
      where: activeLinkedTradeWhere(needId),
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 3
    })
  ]);
  return { activeTradeCount, activeTrades };
}

function linkedNeedBlockedPayload(activeTradeCount: number, activeTrades: Array<{ id: string; title: string; status: string }>, action: 'edit' | 'delete') {
  return {
    error: 'need_in_active_trade',
    message: `This need is used by an active trade. Close or delete that trade before ${action === 'edit' ? 'editing' : 'deleting'} this need.`,
    activeTradeCount,
    activeTrades
  };
}

function cleanList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : undefined;
}

function buildNeedUpdateData(input: ReturnType<typeof updateNeedRequestSchema.parse>) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.defaultLanguage !== undefined ? { defaultLanguage: input.defaultLanguage } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
    ...(input.itemType !== undefined ? { itemType: input.itemType } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.timing !== undefined ? { timing: input.timing } : {}),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.locationLabel !== undefined ? { locationLabel: input.locationLabel } : {}),
    ...(input.tags !== undefined ? { tags: cleanList(input.tags) ?? [] } : {})
  };
}

needsRoutes.get('/mine', asyncRoute(async (req, res) => {
  const needs = await prisma.need.findMany({ where: { ownerId: req.user!.id, businessProfileId: null }, orderBy: { createdAt: 'desc' } });
  const withTranslations = await withInventoryTranslations(prisma, 'need', needs);
  res.json({ needs: await withMedia('need', withTranslations) });
}));

needsRoutes.get('/:needId', asyncRoute(async (req, res) => {
  const need = await prisma.need.findFirst({ where: { id: req.params.needId, ownerId: req.user!.id, businessProfileId: null } });
  if (!need) return res.status(404).json({ error: 'not_found' });
  const withTranslations = await withOneInventoryTranslation(prisma, 'need', need);
  res.json({ need: await withOneMedia('need', withTranslations) });
}));

needsRoutes.get('/:needId/delete-impact', asyncRoute(async (req, res) => {
  const existing = await prisma.need.findFirst({ where: { id: req.params.needId, ownerId: req.user!.id, businessProfileId: null } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const [linkedTradeCount, active] = await Promise.all([
    prisma.trade.count({ where: { needId: existing.id } }),
    loadActiveLinkedTrades(existing.id)
  ]);
  res.json({
    blocked: active.activeTradeCount > 0,
    linkedTradeCount,
    historicalTradeCount: Math.max(0, linkedTradeCount - active.activeTradeCount),
    activeTradeCount: active.activeTradeCount,
    activeTrades: active.activeTrades
  });
}));

needsRoutes.post('/', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createNeedRequestSchema.parse(req.body);
  if (input.status && ['pending_review', 'rejected'].includes(input.status)) return res.status(400).json({ error: 'invalid_need_status', message: 'Review-only statuses are available only through Business review flows.' });
  let need = await prisma.need.create({
    data: {
      ownerId: req.user!.id,
      title: input.title,
      description: input.description,
      defaultLanguage: input.defaultLanguage ?? 'en',
      itemType: input.itemType ?? 'service',
      category: input.category ?? null,
      timing: input.timing ?? null,
      mode: input.mode ?? null,
      locationLabel: input.locationLabel ?? null,
      tags: input.tags ?? [],
      status: input.status ?? 'draft',
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    }
  });
  await syncInventoryTranslations(prisma, 'need', need.id, req.user!.id, need.defaultLanguage, input.translations ?? []);
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'need', need.id);
  const classification = await classifyContentRulesIfEnabled(prisma, {
    targetType: 'need',
    targetId: need.id,
    title: need.title,
    description: need.description,
    userCategory: need.category,
    tags: need.tags,
    extraText: [need.timing, need.mode, need.locationLabel, need.itemType, ...inventoryTranslationExtraText(input.translations)],
  });
  const gateDecision = buildContentReviewGateDecision(classification);
  if (gateDecision.shouldGate && need.status === 'active') {
    need = await prisma.need.update({ where: { id: need.id }, data: { status: 'pending_review' } });
  }
  const withTranslations = await withOneInventoryTranslation(prisma, 'need', need);
  res.status(201).json({ need: await withOneMedia('need', withTranslations) });
}));

needsRoutes.patch('/:needId', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updateNeedRequestSchema.parse(req.body);
  if (input.status && ['pending_review', 'rejected'].includes(input.status)) return res.status(400).json({ error: 'invalid_need_status', message: 'Review-only statuses are available only through Business review flows.' });
  const existing = await prisma.need.findFirst({ where: { id: req.params.needId, ownerId: req.user!.id, businessProfileId: null } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const active = await loadActiveLinkedTrades(existing.id);
  if (active.activeTradeCount > 0) {
    return res.status(409).json(linkedNeedBlockedPayload(active.activeTradeCount, active.activeTrades, 'edit'));
  }
  let need = await prisma.need.update({ where: { id: existing.id }, data: buildNeedUpdateData(input) });
  await syncInventoryTranslations(prisma, 'need', need.id, req.user!.id, need.defaultLanguage, input.translations);
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'need', need.id);
  const classification = await classifyContentRulesIfEnabled(prisma, {
    targetType: 'need',
    targetId: need.id,
    title: need.title,
    description: need.description,
    userCategory: need.category,
    tags: need.tags,
    extraText: [need.timing, need.mode, need.locationLabel, need.itemType, ...inventoryTranslationExtraText(input.translations)],
  });
  const gateDecision = buildContentReviewGateDecision(classification);
  if (gateDecision.shouldGate && need.status === 'active') {
    need = await prisma.need.update({ where: { id: need.id }, data: { status: 'pending_review' } });
  }
  const withTranslations = await withOneInventoryTranslation(prisma, 'need', need);
  res.json({ need: await withOneMedia('need', withTranslations) });
}));

needsRoutes.delete('/:needId', requireActiveAccount, asyncRoute(async (req, res) => {
  const existing = await prisma.need.findFirst({ where: { id: req.params.needId, ownerId: req.user!.id, businessProfileId: null } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const active = await loadActiveLinkedTrades(existing.id);
  if (active.activeTradeCount > 0) {
    return res.status(409).json(linkedNeedBlockedPayload(active.activeTradeCount, active.activeTrades, 'delete'));
  }

  await prisma.$transaction([
    prisma.trade.updateMany({ where: { needId: existing.id }, data: { needId: null } }),
    prisma.inventoryTranslation.deleteMany({ where: { targetType: 'need', targetId: existing.id } }),
    prisma.mediaAsset.updateMany({ where: { entityType: 'need', entityId: existing.id, status: { not: 'removed' } }, data: { status: 'removed' } }),
    prisma.need.delete({ where: { id: existing.id } })
  ]);
  res.status(204).send();
}));
