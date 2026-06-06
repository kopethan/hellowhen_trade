import { Router } from 'express';
import { createOfferRequestSchema, updateOfferRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { buildContentReviewGateDecision, classifyContentRulesIfEnabled } from '../content-intelligence/contentIntelligence.classifier.js';
import { attachUploadedMediaToEntity, withMedia, withOneMedia } from '../media/media.helpers.js';
import { inventoryTranslationExtraText, syncInventoryTranslations, withInventoryTranslations, withOneInventoryTranslation } from '../inventoryTranslations.js';
import { resolvePlusPreviewThemeForCreate, resolvePlusPreviewThemeForUpdate, userCanUsePlusCustomization } from '../subscriptions/plusCustomization.js';

export const offersRoutes = Router();
offersRoutes.use(requireAuth);

const activeLinkedTradeStatuses = ['active', 'funded', 'in_progress', 'submitted', 'disputed'] as const;

function activeLinkedTradeWhere(offerId: string) {
  return { offerId, status: { in: [...activeLinkedTradeStatuses] } };
}

async function loadActiveLinkedTrades(offerId: string) {
  const [activeTradeCount, activeTrades] = await Promise.all([
    prisma.trade.count({ where: activeLinkedTradeWhere(offerId) }),
    prisma.trade.findMany({
      where: activeLinkedTradeWhere(offerId),
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 3
    })
  ]);
  return { activeTradeCount, activeTrades };
}

function linkedOfferBlockedPayload(activeTradeCount: number, activeTrades: Array<{ id: string; title: string; status: string }>, action: 'edit' | 'delete') {
  return {
    error: 'offer_in_active_trade',
    message: `This offer is used by an active trade. Close or delete that trade before ${action === 'edit' ? 'editing' : 'deleting'} this offer.`,
    activeTradeCount,
    activeTrades
  };
}

function cleanList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : undefined;
}

function buildOfferUpdateData(input: ReturnType<typeof updateOfferRequestSchema.parse>) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.defaultLanguage !== undefined ? { defaultLanguage: input.defaultLanguage } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
    ...(input.itemType !== undefined ? { itemType: input.itemType } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.availability !== undefined ? { availability: input.availability } : {}),
    ...(input.availabilityPreset !== undefined ? { availabilityPreset: input.availabilityPreset } : {}),
    ...(input.availabilityStartAt !== undefined ? { availabilityStartAt: input.availabilityStartAt ? new Date(input.availabilityStartAt) : null } : {}),
    ...(input.availabilityEndAt !== undefined ? { availabilityEndAt: input.availabilityEndAt ? new Date(input.availabilityEndAt) : null } : {}),
    ...(input.typicalDurationPreset !== undefined ? { typicalDurationPreset: input.typicalDurationPreset } : {}),
    ...(input.typicalDurationMinutes !== undefined ? { typicalDurationMinutes: input.typicalDurationMinutes } : {}),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.locationLabel !== undefined ? { locationLabel: input.locationLabel } : {}),
    ...(input.includes !== undefined ? { includes: cleanList(input.includes) ?? [] } : {}),
    ...(input.tags !== undefined ? { tags: cleanList(input.tags) ?? [] } : {})
  };
}

offersRoutes.get('/mine', asyncRoute(async (req, res) => {
  const offers = await prisma.offer.findMany({ where: { ownerId: req.user!.id, businessProfileId: null }, orderBy: { createdAt: 'desc' } });
  const withTranslations = await withInventoryTranslations(prisma, 'offer', offers);
  res.json({ offers: await withMedia('offer', withTranslations) });
}));

offersRoutes.get('/:offerId', asyncRoute(async (req, res) => {
  const offer = await prisma.offer.findFirst({ where: { id: req.params.offerId, ownerId: req.user!.id, businessProfileId: null } });
  if (!offer) return res.status(404).json({ error: 'not_found' });
  const withTranslations = await withOneInventoryTranslation(prisma, 'offer', offer);
  res.json({ offer: await withOneMedia('offer', withTranslations) });
}));

offersRoutes.get('/:offerId/delete-impact', asyncRoute(async (req, res) => {
  const existing = await prisma.offer.findFirst({ where: { id: req.params.offerId, ownerId: req.user!.id, businessProfileId: null } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const [linkedTradeCount, active] = await Promise.all([
    prisma.trade.count({ where: { offerId: existing.id } }),
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

offersRoutes.post('/', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createOfferRequestSchema.parse(req.body);
  const [previewTheme, canCustomizeMedia] = await Promise.all([
    resolvePlusPreviewThemeForCreate(req.user!.id, input.previewTheme),
    userCanUsePlusCustomization(req.user!.id),
  ]);
  if (input.status && ['pending_review', 'rejected'].includes(input.status)) return res.status(400).json({ error: 'invalid_offer_status', message: 'Review-only statuses are available only through Business review flows.' });
  let offer = await prisma.offer.create({
    data: {
      ownerId: req.user!.id,
      title: input.title,
      description: input.description,
      defaultLanguage: input.defaultLanguage ?? 'en',
      itemType: input.itemType ?? 'service',
      category: input.category ?? null,
      availability: input.availability ?? null,
      availabilityPreset: input.availabilityPreset ?? null,
      availabilityStartAt: input.availabilityStartAt ? new Date(input.availabilityStartAt) : null,
      availabilityEndAt: input.availabilityEndAt ? new Date(input.availabilityEndAt) : null,
      typicalDurationPreset: input.typicalDurationPreset ?? null,
      typicalDurationMinutes: input.typicalDurationMinutes ?? null,
      mode: input.mode ?? null,
      locationLabel: input.locationLabel ?? null,
      includes: input.includes ?? [],
      tags: input.tags ?? [],
      status: input.status ?? 'draft',
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      previewTheme
    }
  });
  await syncInventoryTranslations(prisma, 'offer', offer.id, req.user!.id, offer.defaultLanguage, input.translations ?? []);
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'offer', offer.id, {
    coverMediaId: input.coverMediaId,
    enableOrderAndCover: canCustomizeMedia,
  });
  const classification = await classifyContentRulesIfEnabled(prisma, {
    targetType: 'offer',
    targetId: offer.id,
    title: offer.title,
    description: offer.description,
    userCategory: offer.category,
    tags: offer.tags,
    extraText: [offer.availability, offer.availabilityPreset, offer.typicalDurationPreset, offer.mode, offer.locationLabel, offer.itemType, ...offer.includes, ...inventoryTranslationExtraText(input.translations)],
  });
  const gateDecision = buildContentReviewGateDecision(classification);
  if (gateDecision.shouldGate && offer.status === 'active') {
    offer = await prisma.offer.update({ where: { id: offer.id }, data: { status: 'pending_review' } });
  }
  const withTranslations = await withOneInventoryTranslation(prisma, 'offer', offer);
  res.status(201).json({ offer: await withOneMedia('offer', withTranslations) });
}));

offersRoutes.patch('/:offerId', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updateOfferRequestSchema.parse(req.body);
  if (input.status && ['pending_review', 'rejected'].includes(input.status)) return res.status(400).json({ error: 'invalid_offer_status', message: 'Review-only statuses are available only through Business review flows.' });
  const existing = await prisma.offer.findFirst({ where: { id: req.params.offerId, ownerId: req.user!.id, businessProfileId: null } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const active = await loadActiveLinkedTrades(existing.id);
  if (active.activeTradeCount > 0) {
    return res.status(409).json(linkedOfferBlockedPayload(active.activeTradeCount, active.activeTrades, 'edit'));
  }
  const [previewTheme, canCustomizeMedia] = await Promise.all([
    resolvePlusPreviewThemeForUpdate(req.user!.id, input.previewTheme),
    userCanUsePlusCustomization(req.user!.id),
  ]);
  let offer = await prisma.offer.update({ where: { id: existing.id }, data: { ...buildOfferUpdateData(input), ...(previewTheme !== undefined ? { previewTheme } : {}) } });
  await syncInventoryTranslations(prisma, 'offer', offer.id, req.user!.id, offer.defaultLanguage, input.translations);
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'offer', offer.id, {
    coverMediaId: input.coverMediaId,
    enableOrderAndCover: canCustomizeMedia,
    syncSelection: input.mediaIds !== undefined,
  });
  const classification = await classifyContentRulesIfEnabled(prisma, {
    targetType: 'offer',
    targetId: offer.id,
    title: offer.title,
    description: offer.description,
    userCategory: offer.category,
    tags: offer.tags,
    extraText: [offer.availability, offer.availabilityPreset, offer.typicalDurationPreset, offer.mode, offer.locationLabel, offer.itemType, ...offer.includes, ...inventoryTranslationExtraText(input.translations)],
  });
  const gateDecision = buildContentReviewGateDecision(classification);
  if (gateDecision.shouldGate && offer.status === 'active') {
    offer = await prisma.offer.update({ where: { id: offer.id }, data: { status: 'pending_review' } });
  }
  const withTranslations = await withOneInventoryTranslation(prisma, 'offer', offer);
  res.json({ offer: await withOneMedia('offer', withTranslations) });
}));

offersRoutes.delete('/:offerId', requireActiveAccount, asyncRoute(async (req, res) => {
  const existing = await prisma.offer.findFirst({ where: { id: req.params.offerId, ownerId: req.user!.id, businessProfileId: null } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const active = await loadActiveLinkedTrades(existing.id);
  if (active.activeTradeCount > 0) {
    return res.status(409).json(linkedOfferBlockedPayload(active.activeTradeCount, active.activeTrades, 'delete'));
  }

  await prisma.$transaction([
    prisma.trade.updateMany({ where: { offerId: existing.id }, data: { offerId: null } }),
    prisma.inventoryTranslation.deleteMany({ where: { targetType: 'offer', targetId: existing.id } }),
    prisma.mediaAsset.updateMany({ where: { entityType: 'offer', entityId: existing.id, status: { not: 'removed' } }, data: { status: 'removed' } }),
    prisma.offer.delete({ where: { id: existing.id } })
  ]);
  res.status(204).send();
}));
