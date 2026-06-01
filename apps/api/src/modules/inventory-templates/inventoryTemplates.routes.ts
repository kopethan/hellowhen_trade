import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { cloneInventoryTemplateRequestSchema, listInventoryTemplatesQuerySchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { classifyContentRulesIfEnabled } from '../content-intelligence/contentIntelligence.classifier.js';
import { loadMediaByEntityIds, withMedia, withOneMedia } from '../media/media.helpers.js';

export const inventoryTemplatesRoutes = Router();

const businessProfileSelect = {
  id: true,
  displayName: true,
  handle: true,
  type: true,
  status: true,
} as const;

type TemplateListInput = ReturnType<typeof listInventoryTemplatesQuerySchema.parse>;
type TemplateLocalePreferences = { language: 'en' | 'fr'; countryCode?: string };

function normalizeDiscoveryLanguage(value?: string | null): 'en' | 'fr' | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'system') return null;
  const base = normalized.replace('_', '-').split('-')[0];
  return base === 'fr' || base === 'en' ? base : null;
}

function normalizeCountryCode(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function resolveLanguageFromAcceptLanguage(value: unknown): 'en' | 'fr' | null {
  if (typeof value !== 'string') return null;
  const candidates = value.split(',').map((entry) => entry.split(';')[0]?.trim()).filter(Boolean);
  for (const candidate of candidates) {
    const language = normalizeDiscoveryLanguage(candidate);
    if (language) return language;
  }
  return null;
}

function resolveTemplateLocalePreferences(
  input: TemplateListInput,
  actorPreferences: { profile?: { countryCode?: string | null } | null; settings?: { language?: string | null } | null } | null | undefined,
  acceptLanguageHeader: unknown,
): TemplateLocalePreferences {
  return {
    language: normalizeDiscoveryLanguage(input.language)
      ?? normalizeDiscoveryLanguage(actorPreferences?.settings?.language)
      ?? resolveLanguageFromAcceptLanguage(acceptLanguageHeader)
      ?? 'en',
    countryCode: normalizeCountryCode(input.countryCode) ?? normalizeCountryCode(actorPreferences?.profile?.countryCode),
  };
}

function baseTemplateWhere(input: TemplateListInput): Prisma.InventoryTemplateWhereInput {
  const and: Prisma.InventoryTemplateWhereInput[] = [{ status: 'active' }, { OR: [{ businessProfileId: null }, { businessProfile: { status: 'verified' } }] }];

  if (input.kind) and.push({ kind: input.kind });
  if (input.itemType) and.push({ itemType: input.itemType });
  if (input.sourceType) and.push({ sourceType: input.sourceType });
  if (input.businessProfileId) and.push({ businessProfileId: input.businessProfileId });

  const q = input.q?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { locationLabel: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  return { AND: and };
}

function templateLocaleWhere(preferences: TemplateLocalePreferences, fallbackLanguage?: 'en' | 'fr'): Prisma.InventoryTemplateWhereInput {
  const languageCode = fallbackLanguage ?? preferences.language;
  const countryFilter: Prisma.InventoryTemplateWhereInput = preferences.countryCode
    ? { OR: [{ countryCode: null }, { countryCode: preferences.countryCode }] }
    : { countryCode: null };
  return { AND: [{ languageCode }, countryFilter] };
}

function sortTemplatesForLocale<T extends { languageCode?: string | null; countryCode?: string | null; sortOrder?: number; itemType?: string | null; title?: string | null }>(templates: T[], preferences: TemplateLocalePreferences) {
  return [...templates].sort((left, right) => {
    const leftCountry = normalizeCountryCode(left.countryCode);
    const rightCountry = normalizeCountryCode(right.countryCode);
    const leftCountryScore = preferences.countryCode && leftCountry === preferences.countryCode ? 0 : leftCountry ? 2 : 1;
    const rightCountryScore = preferences.countryCode && rightCountry === preferences.countryCode ? 0 : rightCountry ? 2 : 1;
    if (leftCountryScore !== rightCountryScore) return leftCountryScore - rightCountryScore;
    const sortDelta = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    if (sortDelta !== 0) return sortDelta;
    const typeDelta = String(left.itemType ?? '').localeCompare(String(right.itemType ?? ''));
    if (typeDelta !== 0) return typeDelta;
    return String(left.title ?? '').localeCompare(String(right.title ?? ''));
  });
}

async function cloneTemplateMediaToInventory(actorId: string, templateId: string, entityType: 'need' | 'offer', entityId: string) {
  const templateMediaById = await loadMediaByEntityIds('inventory_template', [templateId], 'public');
  const templateMedia = templateMediaById.get(templateId) ?? [];
  if (!templateMedia.length) return;
  await prisma.mediaAsset.createMany({
    data: templateMedia.slice(0, 5).map((media) => ({
      ownerId: actorId,
      entityType,
      entityId,
      url: media.url,
      storageKey: media.storageKey,
      filename: media.filename,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      status: 'active' as const,
    })),
  });
}

async function listLocalizedTemplates(input: TemplateListInput, preferences: TemplateLocalePreferences) {
  const take = input.take ?? 80;
  const baseWhere = baseTemplateWhere(input);
  const preferred = await prisma.inventoryTemplate.findMany({
    where: { AND: [baseWhere, templateLocaleWhere(preferences)] },
    include: { businessProfile: { select: businessProfileSelect } },
    orderBy: [{ sortOrder: 'asc' }, { itemType: 'asc' }, { title: 'asc' }],
    take,
  });

  const sortedPreferred = sortTemplatesForLocale(preferred, preferences);
  if (preferences.language === 'en' || sortedPreferred.length > 0) return sortedPreferred.slice(0, take);

  const fallback = await prisma.inventoryTemplate.findMany({
    where: { AND: [baseWhere, templateLocaleWhere(preferences, 'en'), { key: { notIn: sortedPreferred.map((template) => template.key) } }] },
    include: { businessProfile: { select: businessProfileSelect } },
    orderBy: [{ sortOrder: 'asc' }, { itemType: 'asc' }, { title: 'asc' }],
    take,
  });

  return sortTemplatesForLocale(fallback, preferences).slice(0, take);
}

inventoryTemplatesRoutes.get('/', optionalAuth, asyncRoute(async (req, res) => {
  const input = listInventoryTemplatesQuerySchema.parse(req.query);
  const actorPreferences = req.user?.id
    ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { profile: { select: { countryCode: true } }, settings: { select: { language: true } } } })
    : null;
  const preferences = resolveTemplateLocalePreferences(input, actorPreferences, req.headers['accept-language']);
  const templates = await listLocalizedTemplates(input, preferences);

  res.json({ templates: await withMedia('inventory_template', templates, 'public'), language: preferences.language, countryCode: preferences.countryCode ?? null });
}));

inventoryTemplatesRoutes.get('/:templateId', asyncRoute(async (req, res) => {
  const template = await prisma.inventoryTemplate.findFirst({
    where: { id: req.params.templateId, status: 'active', OR: [{ businessProfileId: null }, { businessProfile: { status: 'verified' } }] },
    include: { businessProfile: { select: businessProfileSelect } },
  });
  if (!template) return res.status(404).json({ error: 'not_found', message: 'Starter item not found.' });
  res.json({ template: await withOneMedia('inventory_template', template, 'public') });
}));

inventoryTemplatesRoutes.post('/:templateId/clone', requireAuth, asyncRoute(async (req, res) => {
  const input = cloneInventoryTemplateRequestSchema.parse(req.body ?? {});
  const actorId = req.user!.id;
  const template = await prisma.inventoryTemplate.findFirst({
    where: { id: req.params.templateId, status: 'active', OR: [{ businessProfileId: null }, { businessProfile: { status: 'verified' } }] },
    include: { businessProfile: { select: businessProfileSelect } },
  });
  if (!template) return res.status(404).json({ error: 'not_found', message: 'Starter item not found.' });

  if (template.kind === 'need') {
    const need = await prisma.need.create({
      data: {
        ownerId: actorId,
        sourceTemplateId: template.id,
        title: template.title,
        description: template.description,
        itemType: template.itemType,
        category: template.category,
        timing: template.timing,
        mode: template.mode,
        locationLabel: template.locationLabel,
        tags: template.tags,
        status: input.status,
      },
    });
    await cloneTemplateMediaToInventory(actorId, template.id, 'need', need.id);
    await classifyContentRulesIfEnabled(prisma, {
      targetType: 'need',
      targetId: need.id,
      title: need.title,
      description: need.description,
      userCategory: need.category,
      tags: need.tags,
      extraText: [need.timing, need.mode, need.locationLabel, need.itemType],
    });
    return res.status(201).json({ template: await withOneMedia('inventory_template', template, 'public'), need: await withOneMedia('need', need) });
  }

  const offer = await prisma.offer.create({
    data: {
      ownerId: actorId,
      sourceTemplateId: template.id,
      title: template.title,
      description: template.description,
      itemType: template.itemType,
      category: template.category,
      availability: template.availability,
      mode: template.mode,
      locationLabel: template.locationLabel,
      includes: template.includes,
      tags: template.tags,
      status: input.status,
    },
  });
  await cloneTemplateMediaToInventory(actorId, template.id, 'offer', offer.id);
  await classifyContentRulesIfEnabled(prisma, {
    targetType: 'offer',
    targetId: offer.id,
    title: offer.title,
    description: offer.description,
    userCategory: offer.category,
    tags: offer.tags,
    extraText: [offer.availability, offer.mode, offer.locationLabel, offer.itemType, ...offer.includes],
  });
  return res.status(201).json({ template: await withOneMedia('inventory_template', template, 'public'), offer: await withOneMedia('offer', offer) });
}));
