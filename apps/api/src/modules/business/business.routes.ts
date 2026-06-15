import type { Prisma } from '@prisma/client';
import { Router, type Response } from 'express';
import {
  businessAcceptInvitationRequestSchema,
  businessCreateNeedRequestSchema,
  businessCreateOfferRequestSchema,
  businessCreateInventoryTemplateRequestSchema,
  businessInventoryTemplateArchiveRequestSchema,
  businessInventoryTemplateReviewRequestSchema,
  businessListOwnedInventoryQuerySchema,
  businessOwnedInventoryArchiveRequestSchema,
  businessOwnedInventoryReviewRequestSchema,
  businessCreateSponsoredPlacementRequestSchema,
  businessCampaignArchiveRequestSchema,
  businessCampaignItemActionRequestSchema,
  businessCampaignListQuerySchema,
  businessCampaignReviewRequestSchema,
  businessBudgetArchiveRequestSchema,
  businessBudgetListQuerySchema,
  businessBudgetReviewRequestSchema,
  businessCreateBudgetRequestSchema,
  businessUpdateBudgetRequestSchema,
  businessCreateCampaignItemRequestSchema,
  businessCreateCampaignRequestSchema,
  businessSponsoredPlacementListQuerySchema,
  businessSponsoredPlacementArchiveRequestSchema,
  businessSponsoredPlacementReviewRequestSchema,
  businessUpdateSponsoredPlacementRequestSchema,
  businessUpdateCampaignItemRequestSchema,
  businessUpdateCampaignRequestSchema,
  businessListInventoryTemplatesQuerySchema,
  businessUpdateInventoryTemplateRequestSchema,
  businessUpdateNeedRequestSchema,
  businessUpdateOfferRequestSchema,
  businessInviteMemberRequestSchema,
  businessInvitationActionRequestSchema,
  businessProviderOnboardingLinkRequestSchema,
  businessRemoveMemberRequestSchema,
  businessUpdateMemberRequestSchema,
  createBusinessProfileRequestSchema,
  requestBusinessReviewRequestSchema,
  updateBusinessProfileRequestSchema,
} from '@hellowhen/contracts';
import { getBusinessVerificationBadges } from '@hellowhen/shared';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireAuth, requireFreshSensitiveAction } from '../../middleware/auth.js';
import { requireBusinessBudgetsEnabled, requireBusinessCampaignsEnabled, requireBusinessSponsoredContentEnabled } from '../../middleware/featureGates.js';
import { getActiveMoneyProvider } from '../money/providers/moneyProviderRegistry.js';
import { MoneyProviderError } from '../money/providers/moneyProvider.types.js';
import { withMedia, withOneMedia } from '../media/media.helpers.js';
import { publicTradeVisibilityWhere, withTradeDeckMedia } from '../trades/trades.routes.js';
import { stripAnonymousPublicProfileMedia } from '../users/publicUser.js';
import { businessSlugErrorPayload, ensureBusinessSlugAvailable, normalizeBusinessProfileHandle } from './businessHandles.js';

export const businessRoutes = Router();

const INVITATION_TTL_DAYS = 30;
const teamManageRoles = new Set(['owner', 'admin']);
const templateEditRoles = new Set(['owner', 'admin', 'finance', 'member']);
const templateSubmitRoles = new Set(['owner', 'admin']);
const businessInventoryEditRoles = new Set(['owner', 'admin', 'finance', 'member']);
const businessInventorySubmitRoles = new Set(['owner', 'admin']);
const businessSponsoredPlacementEditRoles = new Set(['owner', 'admin', 'member']);
const businessSponsoredPlacementSubmitRoles = new Set(['owner', 'admin']);
const businessCampaignEditRoles = new Set(['owner', 'admin', 'member']);
const businessCampaignSubmitRoles = new Set(['owner', 'admin']);
const businessBudgetEditRoles = new Set(['owner', 'admin', 'finance']);
const businessBudgetSubmitRoles = new Set(['owner', 'admin', 'finance']);
const ownerAssignableRoles = new Set(['admin', 'finance', 'member']);
const adminAssignableRoles = new Set(['member']);

const businessInclude = {
  owner: { select: { id: true, email: true, profile: true, trustTier: true } },
  members: { include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } }, orderBy: { createdAt: 'asc' as const } },
  moneyProviderAccounts: { orderBy: { createdAt: 'desc' as const }, take: 5 },
  _count: { select: { needs: true, offers: true, trades: true, inventoryTemplates: true, sponsoredPlacements: true, campaigns: true, budgets: true } },
} as const;

const businessTeamInclude = {
  members: {
    include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.BusinessProfileInclude;

const publicBusinessProfileSelect = {
  id: true,
  ownerId: true,
  displayName: true,
  legalName: true,
  handle: true,
  type: true,
  status: true,
  description: true,
  websiteUrl: true,
  countryCode: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, trustTier: true } },
  _count: { select: { needs: true, offers: true, trades: true, inventoryTemplates: true, campaigns: true } },
} satisfies Prisma.BusinessProfileSelect;

function providerError(res: Response, error: unknown) {
  if (error instanceof MoneyProviderError) {
    return res.status(error.statusCode).json({ error: error.code, message: error.publicMessage });
  }
  throw error;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function slugifyTemplateTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54) || 'business-template';
}

function makeBusinessTemplateKey(businessProfileId: string, kind: 'need' | 'offer', title: string) {
  return `business-${businessProfileId.slice(0, 8)}-${kind}-${slugifyTemplateTitle(title)}-${Date.now().toString(36)}`;
}

function businessTemplateSourceType(profile: { type?: string | null }) {
  return profile.type === 'brand' || profile.type === 'enterprise' ? 'brand' : 'business';
}

function canEditBusinessTemplates(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && templateEditRoles.has(role));
}

function canSubmitBusinessTemplates(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && templateSubmitRoles.has(role));
}

function canEditBusinessInventory(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && businessInventoryEditRoles.has(role));
}

function canSubmitBusinessInventory(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && businessInventorySubmitRoles.has(role));
}

function canMutateBusinessTemplateProfile(profile: any) {
  return !['disabled', 'rejected', 'restricted'].includes(profile.status);
}

function normalizeTemplateNullable<T>(value: T | undefined) {
  return value === undefined ? undefined : value;
}

function cleanList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : undefined;
}

function buildBusinessNeedUpdateData(input: ReturnType<typeof businessUpdateNeedRequestSchema.parse>, existingStatus: string) {
  const data = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
    ...(input.itemType !== undefined ? { itemType: input.itemType } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.timing !== undefined ? { timing: input.timing } : {}),
    ...(input.availabilityPreset !== undefined ? { availabilityPreset: input.availabilityPreset } : {}),
    ...(input.availabilityStartAt !== undefined ? { availabilityStartAt: input.availabilityStartAt ? new Date(input.availabilityStartAt) : null } : {}),
    ...(input.availabilityEndAt !== undefined ? { availabilityEndAt: input.availabilityEndAt ? new Date(input.availabilityEndAt) : null } : {}),
    ...(input.estimatedDurationPreset !== undefined ? { estimatedDurationPreset: input.estimatedDurationPreset } : {}),
    ...(input.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: input.estimatedDurationMinutes } : {}),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.locationLabel !== undefined ? { locationLabel: input.locationLabel } : {}),
    ...(input.tags !== undefined ? { tags: cleanList(input.tags) ?? [] } : {}),
  } as Record<string, unknown>;
  const changedContent = Object.keys(data).length > 0;
  if (input.status !== undefined) data.status = input.status;
  else if (existingStatus === 'active' && changedContent) data.status = 'pending_review';
  return data;
}

function buildBusinessOfferUpdateData(input: ReturnType<typeof businessUpdateOfferRequestSchema.parse>, existingStatus: string) {
  const data = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
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
    ...(input.tags !== undefined ? { tags: cleanList(input.tags) ?? [] } : {}),
  } as Record<string, unknown>;
  const changedContent = Object.keys(data).length > 0;
  if (input.status !== undefined) data.status = input.status;
  else if (existingStatus === 'active' && changedContent) data.status = 'pending_review';
  return data;
}

const businessTemplateBusinessProfileSelect = { id: true, displayName: true, handle: true, type: true, status: true } as const;
const businessTemplateInclude = {
  businessProfile: { select: businessTemplateBusinessProfileSelect },
  _count: { select: { createdNeeds: true, createdOffers: true } },
} as const;

const businessOwnedContentProfileSelect = { id: true, displayName: true, handle: true, type: true, status: true } as const;
const businessNeedInclude = {
  businessProfile: { select: businessOwnedContentProfileSelect },
  _count: { select: { trades: true } },
} as const;
const businessOfferInclude = {
  businessProfile: { select: businessOwnedContentProfileSelect },
  _count: { select: { trades: true } },
} as const;
const businessSponsoredPlacementInclude = {
  businessProfile: { select: { id: true, displayName: true, handle: true, type: true, status: true } },
  createdBy: { select: { id: true, email: true, profile: true } },
  reviewer: { select: { id: true, email: true, profile: true } },
} as const;

function canEditBusinessSponsoredPlacements(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && businessSponsoredPlacementEditRoles.has(role));
}

function canSubmitBusinessSponsoredPlacements(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && businessSponsoredPlacementSubmitRoles.has(role));
}

function parseNullableDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function cleanSponsoredPlacementDateWindow(startsAt?: string | null, endsAt?: string | null) {
  const start = parseNullableDate(startsAt);
  const end = parseNullableDate(endsAt);
  if (start && end && end.getTime() < start.getTime()) {
    throw Object.assign(new Error('The end date must be after the start date.'), { statusCode: 400, code: 'invalid_sponsored_placement_window', publicMessage: 'The end date must be after the start date.' });
  }
  return { startsAt: start, endsAt: end };
}

function normalizeSponsoredPlacement(placement: any, target?: unknown) {
  return { ...placement, target: target ?? placement.target ?? null };
}

async function loadBusinessSponsoredPlacementTarget(businessProfileId: string, targetType: string, targetId: string) {
  if (targetType === 'need') {
    return prisma.need.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, title: true, description: true, status: true, itemType: true, category: true, timing: true, availabilityPreset: true, availabilityStartAt: true, availabilityEndAt: true, estimatedDurationPreset: true, estimatedDurationMinutes: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  if (targetType === 'offer') {
    return prisma.offer.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, title: true, description: true, status: true, itemType: true, category: true, availability: true, availabilityPreset: true, availabilityStartAt: true, availabilityEndAt: true, typicalDurationPreset: true, typicalDurationMinutes: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  if (targetType === 'inventory_template') {
    return prisma.inventoryTemplate.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, key: true, kind: true, title: true, description: true, status: true, sourceType: true, itemType: true, category: true, languageCode: true, countryCode: true, timing: true, availability: true, availabilityPreset: true, availabilityStartAt: true, availabilityEndAt: true, durationPreset: true, durationMinutes: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  return null;
}

async function hydrateBusinessSponsoredPlacements(placements: any[]) {
  return Promise.all(placements.map(async (placement) => normalizeSponsoredPlacement(placement, await loadBusinessSponsoredPlacementTarget(placement.businessProfileId, placement.targetType, placement.targetId))));
}


const businessCampaignInclude = {
  businessProfile: { select: { id: true, displayName: true, handle: true, type: true, status: true } },
  createdBy: { select: { id: true, email: true, profile: true } },
  reviewer: { select: { id: true, email: true, profile: true } },
  items: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  _count: { select: { items: true, applications: true } },
} as const;

const businessCampaignApplicationInclude = {
  applicant: { select: { id: true, email: true, profile: true, trustTier: true } },
  reviewer: { select: { id: true, email: true, profile: true } },
} as const;

function canEditBusinessCampaigns(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && businessCampaignEditRoles.has(role));
}

function canSubmitBusinessCampaigns(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && businessCampaignSubmitRoles.has(role));
}

function cleanCampaignDateWindow(startsAt?: string | null, endsAt?: string | null) {
  const start = parseNullableDate(startsAt);
  const end = parseNullableDate(endsAt);
  if (start && end && end.getTime() < start.getTime()) {
    throw Object.assign(new Error('The end date must be after the start date.'), { statusCode: 400, code: 'invalid_business_campaign_window', publicMessage: 'The end date must be after the start date.' });
  }
  return { startsAt: start, endsAt: end };
}

async function loadBusinessCampaignTarget(businessProfileId: string, targetType: string, targetId: string) {
  if (targetType === 'need') {
    return prisma.need.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, title: true, description: true, status: true, itemType: true, category: true, timing: true, availabilityPreset: true, availabilityStartAt: true, availabilityEndAt: true, estimatedDurationPreset: true, estimatedDurationMinutes: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  if (targetType === 'offer') {
    return prisma.offer.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, title: true, description: true, status: true, itemType: true, category: true, availability: true, availabilityPreset: true, availabilityStartAt: true, availabilityEndAt: true, typicalDurationPreset: true, typicalDurationMinutes: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  if (targetType === 'inventory_template') {
    return prisma.inventoryTemplate.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, key: true, kind: true, title: true, description: true, status: true, sourceType: true, itemType: true, category: true, languageCode: true, countryCode: true, timing: true, availability: true, availabilityPreset: true, availabilityStartAt: true, availabilityEndAt: true, durationPreset: true, durationMinutes: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  return null;
}

async function hydrateBusinessCampaignItems(items: any[], businessProfileId: string) {
  return Promise.all(items.map(async (item) => ({ ...item, target: await loadBusinessCampaignTarget(businessProfileId, item.targetType, item.targetId) })));
}

async function hydrateBusinessCampaign(campaign: any) {
  if (!campaign) return campaign;
  return { ...campaign, items: await hydrateBusinessCampaignItems(campaign.items ?? [], campaign.businessProfileId) };
}

async function hydrateBusinessCampaigns(campaigns: any[]) {
  return Promise.all(campaigns.map((campaign) => hydrateBusinessCampaign(campaign)));
}

function businessCampaignSearchWhere(q?: string) {
  const text = q?.trim();
  return text ? {
    OR: [
      { title: { contains: text, mode: 'insensitive' as const } },
      { summary: { contains: text, mode: 'insensitive' as const } },
      { description: { contains: text, mode: 'insensitive' as const } },
      { eligibility: { contains: text, mode: 'insensitive' as const } },
      { deliverables: { contains: text, mode: 'insensitive' as const } },
    ],
  } : {};
}


function campaignContentChanged(input: Record<string, unknown>) {
  return Object.keys(input).some((key) => key !== 'note');
}

const businessBudgetInclude = {
  businessProfile: { select: { id: true, displayName: true, handle: true, type: true, status: true } },
  campaign: { select: { id: true, title: true, status: true, opportunityType: true } },
  providerAccount: { select: { id: true, provider: true, providerAccountId: true, accountType: true, status: true, country: true, defaultCurrency: true } },
  createdBy: { select: { id: true, email: true, profile: true } },
  reviewer: { select: { id: true, email: true, profile: true } },
  ledgerEntries: { orderBy: { createdAt: 'desc' as const }, take: 25 },
} as const;

function canEditBusinessBudgets(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && businessBudgetEditRoles.has(role));
}

function canSubmitBusinessBudgets(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && businessBudgetSubmitRoles.has(role));
}

function businessBudgetSearchWhere(q?: string) {
  const text = q?.trim();
  return text ? {
    OR: [
      { purpose: { contains: text, mode: 'insensitive' as const } },
      { riskNote: { contains: text, mode: 'insensitive' as const } },
      { providerExternalId: { contains: text, mode: 'insensitive' as const } },
      { campaign: { title: { contains: text, mode: 'insensitive' as const } } },
    ],
  } : {};
}

function cleanBudgetData(input: { campaignId?: string | null; provider?: string; providerAccountId?: string | null; currency?: string; requestedAmountCents?: number; platformFeeRateBps?: number; purpose?: string | null; riskNote?: string | null; status?: string }) {
  return {
    ...(input.campaignId !== undefined ? { campaignId: input.campaignId || null } : {}),
    ...(input.provider !== undefined ? { provider: input.provider } : {}),
    ...(input.providerAccountId !== undefined ? { providerAccountId: input.providerAccountId || null } : {}),
    ...(input.currency !== undefined ? { currency: input.currency.toLowerCase() } : {}),
    ...(input.requestedAmountCents !== undefined ? { requestedAmountCents: input.requestedAmountCents } : {}),
    ...(input.platformFeeRateBps !== undefined ? { platformFeeRateBps: input.platformFeeRateBps } : {}),
    ...(input.purpose !== undefined ? { purpose: input.purpose || null } : {}),
    ...(input.riskNote !== undefined ? { riskNote: input.riskNote || null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };
}

async function validateBusinessBudgetLinks(businessProfileId: string, input: { campaignId?: string | null; provider?: string; providerAccountId?: string | null }) {
  if (input.campaignId) {
    const campaign = await (prisma as any).businessCampaign.findFirst({ where: { id: input.campaignId, businessProfileId } });
    if (!campaign) {
      throw Object.assign(new Error('Campaign not found for this Business profile.'), { statusCode: 400, code: 'invalid_business_budget_campaign', publicMessage: 'Campaign not found for this Business profile.' });
    }
  }
  if (input.providerAccountId) {
    const providerAccount = await prisma.moneyProviderAccount.findFirst({ where: { id: input.providerAccountId, businessProfileId } });
    if (!providerAccount) {
      throw Object.assign(new Error('Provider account not found for this Business profile.'), { statusCode: 400, code: 'invalid_business_budget_provider_account', publicMessage: 'Provider account not found for this Business profile.' });
    }
    if (input.provider && input.provider !== 'none' && providerAccount.provider !== input.provider) {
      throw Object.assign(new Error('Provider account does not match the selected provider.'), { statusCode: 400, code: 'business_budget_provider_mismatch', publicMessage: 'Provider account does not match the selected provider.' });
    }
  }
}

function budgetContentChanged(input: Record<string, unknown>) {
  return Object.keys(input).some((key) => key !== 'note');
}

async function ensureCampaignHasEligibleItem(client: any, businessProfileId: string, campaignId: string) {
  const items = await client.businessCampaignItem.findMany({ where: { campaignId } });
  if (!items.length) return false;
  for (const item of items) {
    const target = await loadBusinessCampaignTarget(businessProfileId, item.targetType, item.targetId);
    if (!target) return false;
  }
  return true;
}

async function syncBusinessOwnedInventoryMedia(client: unknown, ownerId: string, mediaIds: string[] | undefined, entityType: 'need' | 'offer', entityId: string) {
  const selectedIds = Array.from(new Set(mediaIds ?? []));
  const mediaClient = (client as { mediaAsset: typeof prisma.mediaAsset }).mediaAsset;

  const [selectedMedia, existingMedia] = await Promise.all([
    selectedIds.length ? mediaClient.findMany({ where: { id: { in: selectedIds }, ownerId, status: 'active' } }) : Promise.resolve([]),
    mediaClient.findMany({ where: { entityType, entityId, status: { not: 'removed' } }, select: { id: true } }),
  ]);

  if (selectedMedia.length !== selectedIds.length) {
    throw Object.assign(new Error('One or more selected images could not be attached. Upload the images again and retry.'), { statusCode: 400, code: 'invalid_media_ids', publicMessage: 'One or more selected images could not be attached. Upload the images again and retry.' });
  }

  const attachedElsewhere = selectedMedia.find((item) => item.entityType && item.entityId && (item.entityType !== entityType || item.entityId !== entityId));
  if (attachedElsewhere) {
    throw Object.assign(new Error('One or more selected images already belong to another item. Upload a new copy if you want to reuse it.'), { statusCode: 409, code: 'media_already_attached', publicMessage: 'One or more selected images already belong to another item. Upload a new copy if you want to reuse it.' });
  }

  if (selectedIds.length > 5) {
    throw Object.assign(new Error('You can attach up to 5 images. Remove one image before adding another.'), { statusCode: 400, code: 'too_many_images', publicMessage: 'You can attach up to 5 images. Remove one image before adding another.' });
  }

  const selectedIdSet = new Set(selectedIds);
  const removedIds = existingMedia.map((item) => item.id).filter((id) => !selectedIdSet.has(id));
  if (selectedIds.length) await mediaClient.updateMany({ where: { id: { in: selectedIds }, ownerId, status: 'active' }, data: { entityType, entityId } });
  if (removedIds.length) await mediaClient.updateMany({ where: { id: { in: removedIds }, entityType, entityId }, data: { entityType: null, entityId: null, status: 'removed' } });
}

async function syncBusinessTemplateMedia(client: unknown, ownerId: string, mediaIds: string[] | undefined, entityId: string) {
  const selectedIds = Array.from(new Set(mediaIds ?? []));
  const mediaClient = (client as { mediaAsset: typeof prisma.mediaAsset }).mediaAsset;

  const [selectedMedia, existingMedia] = await Promise.all([
    selectedIds.length ? mediaClient.findMany({ where: { id: { in: selectedIds }, ownerId, status: 'active' } }) : Promise.resolve([]),
    mediaClient.findMany({ where: { entityType: 'inventory_template', entityId, status: { not: 'removed' } }, select: { id: true } }),
  ]);

  if (selectedMedia.length !== selectedIds.length) {
    throw Object.assign(new Error('One or more selected images could not be attached. Upload the images again and retry.'), { statusCode: 400, code: 'invalid_media_ids', publicMessage: 'One or more selected images could not be attached. Upload the images again and retry.' });
  }

  const attachedElsewhere = selectedMedia.find((item) => item.entityType && item.entityId && (item.entityType !== 'inventory_template' || item.entityId !== entityId));
  if (attachedElsewhere) {
    throw Object.assign(new Error('One or more selected images already belong to another item. Upload a new copy if you want to reuse it.'), { statusCode: 409, code: 'media_already_attached', publicMessage: 'One or more selected images already belong to another item. Upload a new copy if you want to reuse it.' });
  }

  const selectedIdSet = new Set(selectedIds);
  const removedIds = existingMedia.map((item) => item.id).filter((id) => !selectedIdSet.has(id));
  if (selectedIds.length) await mediaClient.updateMany({ where: { id: { in: selectedIds }, ownerId, status: 'active' }, data: { entityType: 'inventory_template', entityId } });
  if (removedIds.length) await mediaClient.updateMany({ where: { id: { in: removedIds }, entityType: 'inventory_template', entityId }, data: { entityType: null, entityId: null, status: 'removed' } });
}

function normalizeProfile<T extends { _count?: unknown }>(profile: T) {
  return { ...profile, counts: profile._count };
}

function normalizeInvitation(invitation: any) {
  return {
    id: invitation.id,
    businessProfileId: invitation.businessProfileId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    note: invitation.note,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    businessProfile: invitation.businessProfile,
    invitedBy: invitation.invitedBy,
    acceptedBy: invitation.acceptedBy,
  };
}

function normalizeTeamAuditLog(entry: any) {
  return {
    id: entry.id,
    action: entry.action,
    targetUserId: entry.targetUserId,
    targetEmail: entry.targetEmail,
    note: entry.note,
    previousValue: entry.previousValue,
    nextValue: entry.nextValue,
    metadata: entry.metadata,
    createdAt: entry.createdAt,
    actor: entry.actor,
    targetUser: entry.targetUser,
  };
}

function getMyBusinessRole(profile: any, userId: string) {
  if (profile.ownerId === userId) return 'owner';
  const membership = Array.isArray(profile.members) ? profile.members.find((member: any) => member.userId === userId) : null;
  return membership?.role ?? null;
}

function canManageTeam(profile: any, userId: string) {
  const role = getMyBusinessRole(profile, userId);
  return Boolean(role && teamManageRoles.has(role));
}

function canAssignRole(actorRole: string | null, role: string) {
  if (actorRole === 'owner') return ownerAssignableRoles.has(role);
  if (actorRole === 'admin') return adminAssignableRoles.has(role);
  return false;
}

async function findAccessibleBusinessProfile(id: string, userId: string) {
  return prisma.businessProfile.findFirst({
    where: { id, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    include: businessInclude,
  });
}

async function findAccessibleTeamBusinessProfile(id: string, userId: string) {
  return prisma.businessProfile.findFirst({
    where: { id, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    include: businessTeamInclude,
  });
}

async function writeTeamAuditLog(client: unknown, input: {
  businessProfileId: string;
  actorId: string;
  action: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  note?: string | null;
  previousValue?: unknown;
  nextValue?: unknown;
  metadata?: unknown;
}) {
  const auditClient = client as { businessProfileTeamAuditLog?: { create: (args: unknown) => Promise<unknown> } };
  if (!auditClient.businessProfileTeamAuditLog) return;
  await auditClient.businessProfileTeamAuditLog.create({
    data: {
      businessProfileId: input.businessProfileId,
      actorId: input.actorId,
      action: input.action,
      targetUserId: input.targetUserId ?? null,
      targetEmail: input.targetEmail ?? null,
      note: input.note ?? null,
      previousValue: input.previousValue ?? undefined,
      nextValue: input.nextValue ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });
}


async function getPublicBusinessProfileResponse(slug: string, viewerId?: string) {
  const businessProfile = await prisma.businessProfile.findFirst({
    where: {
      handle: slug,
      status: { in: ['active', 'verified'] },
      owner: { trustTier: { not: 'restricted' } },
    },
    select: publicBusinessProfileSelect,
  });
  if (!businessProfile) return null;

  const [activeTradesCount, openNeedsCount, openOffersCount, activeTrades, openNeeds, openOffers] = await Promise.all([
    prisma.trade.count({ where: { ...publicTradeVisibilityWhere(), businessProfileId: businessProfile.id } }),
    prisma.need.count({ where: { businessProfileId: businessProfile.id, status: 'active' } }),
    prisma.offer.count({ where: { businessProfileId: businessProfile.id, status: 'active' } }),
    prisma.trade.findMany({ where: { ...publicTradeVisibilityWhere(), businessProfileId: businessProfile.id }, include: { need: true, offer: true }, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.need.findMany({ where: { businessProfileId: businessProfile.id, status: 'active' }, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.offer.findMany({ where: { businessProfileId: businessProfile.id, status: 'active' }, orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  const publicMediaVisibility = viewerId ? 'trade_public' : 'public_anonymous';
  const [activeTradesWithMedia, openNeedsWithMedia, openOffersWithMedia] = await Promise.all([
    withTradeDeckMedia(activeTrades, publicMediaVisibility),
    withMedia('need', openNeeds, publicMediaVisibility),
    withMedia('offer', openOffers, publicMediaVisibility),
  ]);

  return {
    businessProfile: {
      id: businessProfile.id,
      ownerId: businessProfile.ownerId,
      displayName: businessProfile.displayName,
      legalName: businessProfile.legalName,
      slug: businessProfile.handle,
      handle: businessProfile.handle,
      type: businessProfile.type,
      status: businessProfile.status,
      description: businessProfile.description,
      websiteUrl: businessProfile.websiteUrl,
      countryCode: businessProfile.countryCode,
      verifiedAt: businessProfile.verifiedAt,
      createdAt: businessProfile.createdAt,
      updatedAt: businessProfile.updatedAt,
      badges: getBusinessVerificationBadges({
        type: businessProfile.type,
        status: businessProfile.status,
        verifiedAt: businessProfile.verifiedAt,
      }),
      counts: businessProfile._count,
    },
    stats: {
      activeTradesCount,
      openNeedsCount,
      openOffersCount,
    },
    sections: {
      activeTrades: activeTradesWithMedia,
      openNeeds: openNeedsWithMedia,
      openOffers: openOffersWithMedia,
    },
  };
}

businessRoutes.get('/by-slug/:slug/public-profile', optionalAuth, asyncRoute(async (req, res) => {
  let slug: string;
  try {
    slug = normalizeBusinessProfileHandle(req.params.slug) ?? '';
  } catch (caughtError) {
    const payload = businessSlugErrorPayload(caughtError);
    if (payload) return res.status(payload.status).json(payload.body);
    throw caughtError;
  }
  if (!slug) return res.status(400).json({ error: 'missing_business_slug' });

  const response = await getPublicBusinessProfileResponse(slug, req.user?.id);
  if (!response) return res.status(404).json({ error: 'not_found', message: 'Business profile not found.' });
  res.json(stripAnonymousPublicProfileMedia(response, req.user?.id));
}));

businessRoutes.use(requireAuth);

businessRoutes.get('/mine', asyncRoute(async (req, res) => {
  const businessProfiles = await prisma.businessProfile.findMany({
    where: { OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
    include: businessInclude,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 100,
  });
  res.json({ businessProfiles: businessProfiles.map(normalizeProfile) });
}));

businessRoutes.get('/invitations/mine', asyncRoute(async (req, res) => {
  const now = new Date();
  const email = normalizeEmail(req.user!.email);
  const invitations = await (prisma as any).businessProfileInvitation?.findMany({
    where: { email, status: 'pending', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    include: {
      businessProfile: { select: { id: true, displayName: true, handle: true, type: true, status: true, ownerId: true } },
      invitedBy: { select: { id: true, email: true, profile: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }) ?? [];
  res.json({ invitations: invitations.map(normalizeInvitation) });
}));

businessRoutes.post('/', asyncRoute(async (req, res) => {
  const input = createBusinessProfileRequestSchema.parse(req.body);
  const handle = input.handle ? await ensureBusinessSlugAvailable(input.handle) : null;
  const businessProfile = await prisma.$transaction(async (tx) => {
    const created = await tx.businessProfile.create({
      data: {
        ownerId: req.user!.id,
        type: input.type,
        displayName: input.displayName,
        legalName: input.legalName ?? null,
        handle,
        description: input.description ?? null,
        websiteUrl: input.websiteUrl ?? null,
        countryCode: input.countryCode?.toUpperCase() ?? null,
        preferredCurrency: input.preferredCurrency.toLowerCase(),
      },
    });
    await tx.businessProfileMember.create({ data: { businessProfileId: created.id, userId: req.user!.id, role: 'owner' } });
    await writeTeamAuditLog(tx, {
      businessProfileId: created.id,
      actorId: req.user!.id,
      action: 'business_team_owner_created',
      targetUserId: req.user!.id,
      nextValue: { role: 'owner' },
    });
    return tx.businessProfile.findUniqueOrThrow({ where: { id: created.id }, include: businessInclude });
  });
  res.status(201).json({ businessProfile: normalizeProfile(businessProfile) });
}));

businessRoutes.post('/invitations/:invitationId/accept', asyncRoute(async (req, res) => {
  const input = businessAcceptInvitationRequestSchema.parse(req.body ?? {});
  const invitationId = req.params.invitationId;
  if (!invitationId) return res.status(400).json({ error: 'business_invitation_id_required' });
  const now = new Date();
  const userEmail = normalizeEmail(req.user!.email);

  const result = await prisma.$transaction(async (tx) => {
    const invitation = await (tx as any).businessProfileInvitation?.findUnique({
      where: { id: invitationId },
      include: { businessProfile: true },
    });
    if (!invitation) return { status: 404 as const };
    if (normalizeEmail(invitation.email) !== userEmail) return { status: 403 as const, error: 'business_invitation_email_mismatch' };
    if (invitation.status !== 'pending') return { status: 409 as const, error: 'business_invitation_not_pending' };
    if (invitation.expiresAt && invitation.expiresAt <= now) {
      await (tx as any).businessProfileInvitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
      return { status: 409 as const, error: 'business_invitation_expired' };
    }
    if (['disabled', 'rejected', 'restricted'].includes(invitation.businessProfile.status)) {
      return { status: 403 as const, error: 'business_profile_not_accepting_members' };
    }

    const existingMember = await tx.businessProfileMember.findUnique({
      where: { businessProfileId_userId: { businessProfileId: invitation.businessProfileId, userId: req.user!.id } },
    });
    const member = existingMember
      ? await tx.businessProfileMember.update({ where: { id: existingMember.id }, data: { role: existingMember.role === 'owner' ? 'owner' : invitation.role } })
      : await tx.businessProfileMember.create({ data: { businessProfileId: invitation.businessProfileId, userId: req.user!.id, role: invitation.role } });

    const acceptedInvitation = await (tx as any).businessProfileInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted', acceptedById: req.user!.id, acceptedAt: now },
      include: {
        businessProfile: { select: { id: true, displayName: true, handle: true, type: true, status: true, ownerId: true } },
        invitedBy: { select: { id: true, email: true, profile: true } },
        acceptedBy: { select: { id: true, email: true, profile: true } },
      },
    });
    await writeTeamAuditLog(tx, {
      businessProfileId: invitation.businessProfileId,
      actorId: req.user!.id,
      action: 'business_team_invitation_accepted',
      targetUserId: req.user!.id,
      targetEmail: invitation.email,
      note: input.note ?? null,
      previousValue: existingMember ? { role: existingMember.role } : null,
      nextValue: { role: member.role, invitationId: invitation.id },
    });
    return { status: 200 as const, invitation: acceptedInvitation, member };
  });

  if (result.status === 404) return res.status(404).json({ error: 'not_found', message: 'Business invitation not found.' });
  if (result.status === 403) return res.status(403).json({ error: result.error, message: 'You cannot accept this business invitation.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'This business invitation can no longer be accepted.' });
  res.json({ invitation: normalizeInvitation(result.invitation), member: result.member });
}));

businessRoutes.get('/:businessProfileId', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  res.json({ businessProfile: normalizeProfile(businessProfile) });
}));

businessRoutes.patch('/:businessProfileId', asyncRoute(async (req, res) => {
  const input = updateBusinessProfileRequestSchema.parse(req.body);
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const existing = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (existing.ownerId !== req.user!.id) return res.status(403).json({ error: 'business_owner_required', message: 'Only the business owner can update this profile.' });
  const handle = input.handle !== undefined
    ? input.handle
      ? await ensureBusinessSlugAvailable(input.handle, { ownerBusinessProfileId: existing.id })
      : null
    : undefined;
  const businessProfile = await prisma.businessProfile.update({
    where: { id: existing.id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.legalName !== undefined ? { legalName: input.legalName ?? null } : {}),
      ...(handle !== undefined ? { handle } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl ?? null } : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode?.toUpperCase() ?? null } : {}),
      ...(input.preferredCurrency !== undefined ? { preferredCurrency: input.preferredCurrency.toLowerCase() } : {}),
    },
    include: businessInclude,
  });
  res.json({ businessProfile: normalizeProfile(businessProfile) });
}));

businessRoutes.get('/:businessProfileId/team', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });

  const [invitations, auditLogs] = await Promise.all([
    (prisma as any).businessProfileInvitation?.findMany({
      where: { businessProfileId, status: 'pending' },
      include: {
        invitedBy: { select: { id: true, email: true, profile: true } },
        acceptedBy: { select: { id: true, email: true, profile: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }) ?? Promise.resolve([]),
    (prisma as any).businessProfileTeamAuditLog?.findMany({
      where: { businessProfileId },
      include: {
        actor: { select: { id: true, email: true, profile: true } },
        targetUser: { select: { id: true, email: true, profile: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }) ?? Promise.resolve([]),
  ]);

  res.json({
    businessProfile: { id: businessProfile.id, ownerId: businessProfile.ownerId, displayName: businessProfile.displayName, type: businessProfile.type, status: businessProfile.status },
    myRole: getMyBusinessRole(businessProfile, req.user!.id),
    canManageTeam: canManageTeam(businessProfile, req.user!.id),
    members: businessProfile.members,
    invitations: invitations.map(normalizeInvitation),
    auditLogs: auditLogs.map(normalizeTeamAuditLog),
  });
}));

businessRoutes.post('/:businessProfileId/invitations', asyncRoute(async (req, res) => {
  const input = businessInviteMemberRequestSchema.parse(req.body);
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const actorRole = getMyBusinessRole(businessProfile, req.user!.id);
  if (!canManageTeam(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_team_manager_required', message: 'Only business owners and admins can invite team members.' });
  if (!canAssignRole(actorRole, input.role)) return res.status(403).json({ error: 'business_role_not_allowed', message: 'You cannot invite a team member with this role.' });
  if (['disabled', 'rejected'].includes(businessProfile.status)) return res.status(403).json({ error: 'business_profile_not_accepting_members', message: 'This business profile cannot accept new team members.' });

  const email = normalizeEmail(input.email);
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (existingUser) {
    const existingMember = businessProfile.members.find((member: any) => member.userId === existingUser.id);
    if (existingMember) return res.status(409).json({ error: 'business_member_already_exists', message: 'This user is already a team member.' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingPending = await (tx as any).businessProfileInvitation?.findFirst({ where: { businessProfileId, email, status: 'pending' } });
    if (existingPending) return { conflict: true as const };
    const invitation = await (tx as any).businessProfileInvitation.create({
      data: {
        businessProfileId,
        email,
        role: input.role,
        note: input.note ?? null,
        invitedById: req.user!.id,
        expiresAt: addDays(new Date(), INVITATION_TTL_DAYS),
      },
      include: {
        businessProfile: { select: { id: true, displayName: true, handle: true, type: true, status: true, ownerId: true } },
        invitedBy: { select: { id: true, email: true, profile: true } },
      },
    });
    await writeTeamAuditLog(tx, {
      businessProfileId,
      actorId: req.user!.id,
      action: 'business_team_invitation_created',
      targetUserId: existingUser?.id ?? null,
      targetEmail: email,
      note: input.note ?? null,
      nextValue: { role: input.role, invitationId: invitation.id, expiresAt: invitation.expiresAt },
    });
    return { conflict: false as const, invitation };
  });

  if (result.conflict) return res.status(409).json({ error: 'business_invitation_already_pending', message: 'A pending invitation already exists for this email.' });
  res.status(201).json({ invitation: normalizeInvitation(result.invitation) });
}));

businessRoutes.patch('/:businessProfileId/invitations/:invitationId', asyncRoute(async (req, res) => {
  const input = businessInvitationActionRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const invitationId = req.params.invitationId;
  if (!businessProfileId || !invitationId) return res.status(400).json({ error: 'business_invitation_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canManageTeam(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_team_manager_required', message: 'Only business owners and admins can manage invitations.' });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).businessProfileInvitation?.findFirst({ where: { id: invitationId, businessProfileId } });
    if (!existing) return { status: 404 as const };
    if (existing.status !== 'pending') return { status: 409 as const };
    const invitation = await (tx as any).businessProfileInvitation.update({
      where: { id: existing.id },
      data: { status: input.action === 'revoke' ? 'revoked' : existing.status, revokedAt: new Date() },
      include: {
        businessProfile: { select: { id: true, displayName: true, handle: true, type: true, status: true, ownerId: true } },
        invitedBy: { select: { id: true, email: true, profile: true } },
        acceptedBy: { select: { id: true, email: true, profile: true } },
      },
    });
    await writeTeamAuditLog(tx, {
      businessProfileId,
      actorId: req.user!.id,
      action: 'business_team_invitation_revoked',
      targetEmail: existing.email,
      note: input.note ?? null,
      previousValue: { role: existing.role, status: existing.status, invitationId: existing.id },
      nextValue: { status: invitation.status, revokedAt: invitation.revokedAt },
    });
    return { status: 200 as const, invitation };
  });

  if (result.status === 404) return res.status(404).json({ error: 'not_found', message: 'Business invitation not found.' });
  if (result.status === 409) return res.status(409).json({ error: 'business_invitation_not_pending', message: 'Only pending invitations can be revoked.' });
  res.json({ invitation: normalizeInvitation(result.invitation) });
}));

businessRoutes.patch('/:businessProfileId/members/:memberId', asyncRoute(async (req, res) => {
  const input = businessUpdateMemberRequestSchema.parse(req.body);
  const businessProfileId = req.params.businessProfileId;
  const memberId = req.params.memberId;
  if (!businessProfileId || !memberId) return res.status(400).json({ error: 'business_member_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const actorRole = getMyBusinessRole(businessProfile, req.user!.id);
  if (actorRole !== 'owner') return res.status(403).json({ error: 'business_owner_required', message: 'Only the business owner can change member roles.' });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.businessProfileMember.findFirst({ where: { id: memberId, businessProfileId }, include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } } });
    if (!existing) return { status: 404 as const };
    if (existing.role === 'owner') return { status: 409 as const, error: 'business_owner_role_locked' };
    const member = await tx.businessProfileMember.update({ where: { id: existing.id }, data: { role: input.role }, include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } } });
    await writeTeamAuditLog(tx, {
      businessProfileId,
      actorId: req.user!.id,
      action: 'business_team_member_role_changed',
      targetUserId: existing.userId,
      targetEmail: existing.user.email,
      note: input.note ?? null,
      previousValue: { role: existing.role },
      nextValue: { role: member.role },
    });
    return { status: 200 as const, member };
  });

  if (result.status === 404) return res.status(404).json({ error: 'not_found', message: 'Business team member not found.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'The business owner role cannot be changed here.' });
  res.json({ member: result.member });
}));

businessRoutes.delete('/:businessProfileId/members/:memberId', asyncRoute(async (req, res) => {
  const input = businessRemoveMemberRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const memberId = req.params.memberId;
  if (!businessProfileId || !memberId) return res.status(400).json({ error: 'business_member_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const actorRole = getMyBusinessRole(businessProfile, req.user!.id);
  if (!actorRole || !teamManageRoles.has(actorRole)) return res.status(403).json({ error: 'business_team_manager_required', message: 'Only business owners and admins can remove team members.' });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.businessProfileMember.findFirst({ where: { id: memberId, businessProfileId }, include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } } });
    if (!existing) return { status: 404 as const };
    if (existing.role === 'owner' || existing.userId === req.user!.id) return { status: 409 as const, error: 'business_member_removal_locked' };
    if (actorRole === 'admin' && existing.role !== 'member') return { status: 403 as const, error: 'business_owner_required' };
    await tx.businessProfileMember.delete({ where: { id: existing.id } });
    await writeTeamAuditLog(tx, {
      businessProfileId,
      actorId: req.user!.id,
      action: 'business_team_member_removed',
      targetUserId: existing.userId,
      targetEmail: existing.user.email,
      note: input.note ?? null,
      previousValue: { role: existing.role },
      nextValue: { removed: true },
    });
    return { status: 200 as const, member: existing };
  });

  if (result.status === 404) return res.status(404).json({ error: 'not_found', message: 'Business team member not found.' });
  if (result.status === 403) return res.status(403).json({ error: result.error, message: 'Only the business owner can remove this team member.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'This business team member cannot be removed here.' });
  res.json({ removed: true, member: result.member });
}));



function businessOwnedInventorySearchWhere(q?: string) {
  const text = q?.trim();
  return text ? {
    OR: [
      { title: { contains: text, mode: 'insensitive' as const } },
      { description: { contains: text, mode: 'insensitive' as const } },
      { category: { contains: text, mode: 'insensitive' as const } },
      { locationLabel: { contains: text, mode: 'insensitive' as const } },
    ],
  } : {};
}

businessRoutes.get('/:businessProfileId/needs', asyncRoute(async (req, res) => {
  const input = businessListOwnedInventoryQuerySchema.parse(req.query);
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });

  const needs = await prisma.need.findMany({
    where: ({
      businessProfileId,
      ...(input.status !== 'all' ? { status: input.status as any } : {}),
      ...businessOwnedInventorySearchWhere(input.q),
    } as any),
    include: businessNeedInclude,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: input.take,
  });
  res.json({ businessProfile: { id: businessProfile.id, displayName: businessProfile.displayName, type: businessProfile.type, status: businessProfile.status }, myRole: getMyBusinessRole(businessProfile, req.user!.id), needs: await withMedia('need', needs, 'admin') });
}));

businessRoutes.post('/:businessProfileId/needs', asyncRoute(async (req, res) => {
  const input = businessCreateNeedRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessInventory(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_inventory_editor_required', message: 'Only business team members can create draft Needs.' });
  if (input.status === 'pending_review' && !canSubmitBusinessInventory(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_inventory_submitter_required', message: 'Only business owners and admins can submit Needs for review.' });
  if (!canMutateBusinessTemplateProfile(businessProfile)) return res.status(403).json({ error: 'business_profile_not_allowed', message: 'This Business profile cannot create Needs.' });

  const need = await prisma.$transaction(async (tx) => {
    const created = await tx.need.create({
      data: {
        ownerId: req.user!.id,
        businessProfileId: businessProfile.id,
        title: input.title,
        description: input.description,
        itemType: input.itemType ?? 'service',
        category: input.category ?? null,
        timing: input.timing ?? null,
        availabilityPreset: input.availabilityPreset ?? null,
        availabilityStartAt: input.availabilityStartAt ? new Date(input.availabilityStartAt) : null,
        availabilityEndAt: input.availabilityEndAt ? new Date(input.availabilityEndAt) : null,
        estimatedDurationPreset: input.estimatedDurationPreset ?? null,
        estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
        mode: input.mode ?? null,
        locationLabel: input.locationLabel ?? null,
        tags: input.tags ?? [],
        status: input.status as any,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      include: businessNeedInclude,
    });
    await syncBusinessOwnedInventoryMedia(tx, req.user!.id, input.mediaIds, 'need', created.id);
    await writeTeamAuditLog(tx, {
      businessProfileId: businessProfile.id,
      actorId: req.user!.id,
      action: 'business_need_created',
      note: 'Business team member created a Business-owned Need.',
      nextValue: { needId: created.id, status: created.status, title: created.title },
    });
    return created;
  });
  res.status(201).json({ need: await withOneMedia('need', need, 'admin') });
}));

businessRoutes.patch('/:businessProfileId/needs/:needId', asyncRoute(async (req, res) => {
  const input = businessUpdateNeedRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const needId = req.params.needId;
  if (!businessProfileId || !needId) return res.status(400).json({ error: 'business_need_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessInventory(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_inventory_editor_required', message: 'Only business team members can edit Business-owned Needs.' });
  if (!canMutateBusinessTemplateProfile(businessProfile)) return res.status(403).json({ error: 'business_profile_not_allowed', message: 'This Business profile cannot edit Needs.' });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.need.findFirst({ where: { id: needId, businessProfileId }, include: businessNeedInclude });
    if (!existing) return null;
    const role = getMyBusinessRole(businessProfile, req.user!.id);
    if (existing.status === 'active' && role === 'member') return { status: 403 as const, error: 'business_inventory_admin_required' };
    if (existing.status === 'pending_review' && role === 'member') return { status: 409 as const, error: 'business_inventory_under_review' };
    const updated = await tx.need.update({ where: { id: existing.id }, data: buildBusinessNeedUpdateData(input, existing.status), include: businessNeedInclude });
    if (input.mediaIds !== undefined) await syncBusinessOwnedInventoryMedia(tx, req.user!.id, input.mediaIds, 'need', updated.id);
    await writeTeamAuditLog(tx, {
      businessProfileId,
      actorId: req.user!.id,
      action: 'business_need_updated',
      previousValue: { needId: existing.id, status: existing.status, title: existing.title },
      nextValue: { needId: updated.id, status: updated.status, title: updated.title },
    });
    return { status: 200 as const, need: updated };
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business Need not found.' });
  if (result.status === 403) return res.status(403).json({ error: result.error, message: 'Only business owners/admins can edit an active Business Need.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'This Business Need is already waiting for admin review.' });
  res.json({ need: await withOneMedia('need', result.need, 'admin') });
}));

businessRoutes.post('/:businessProfileId/needs/:needId/request-review', asyncRoute(async (req, res) => {
  const input = businessOwnedInventoryReviewRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const needId = req.params.needId;
  if (!businessProfileId || !needId) return res.status(400).json({ error: 'business_need_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canSubmitBusinessInventory(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_inventory_submitter_required', message: 'Only business owners and admins can submit Needs for review.' });
  if (!canMutateBusinessTemplateProfile(businessProfile)) return res.status(403).json({ error: 'business_profile_not_allowed', message: 'This Business profile cannot submit Needs.' });
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.need.findFirst({ where: { id: needId, businessProfileId }, include: businessNeedInclude });
    if (!existing) return null;
    if (existing.status === 'active') return { status: 409 as const, error: 'business_need_already_approved' };
    const updated = await tx.need.update({ where: { id: existing.id }, data: { status: 'pending_review' as any }, include: businessNeedInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_need_submitted_for_review', note: input.note, previousValue: { needId: existing.id, status: existing.status }, nextValue: { needId: updated.id, status: updated.status } });
    return { status: 200 as const, need: updated };
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business Need not found.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'This Business Need is already approved.' });
  res.json({ need: await withOneMedia('need', result.need, 'admin') });
}));

businessRoutes.post('/:businessProfileId/needs/:needId/archive', asyncRoute(async (req, res) => {
  const input = businessOwnedInventoryArchiveRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const needId = req.params.needId;
  if (!businessProfileId || !needId) return res.status(400).json({ error: 'business_need_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canSubmitBusinessInventory(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_inventory_submitter_required', message: 'Only business owners and admins can archive Needs.' });
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.need.findFirst({ where: { id: needId, businessProfileId }, include: businessNeedInclude });
    if (!existing) return null;
    const updated = await tx.need.update({ where: { id: existing.id }, data: { status: 'closed' as any }, include: businessNeedInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_need_archived', note: input.note ?? null, previousValue: { needId: existing.id, status: existing.status }, nextValue: { needId: updated.id, status: updated.status } });
    return updated;
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business Need not found.' });
  res.json({ need: await withOneMedia('need', result, 'admin') });
}));

businessRoutes.get('/:businessProfileId/offers', asyncRoute(async (req, res) => {
  const input = businessListOwnedInventoryQuerySchema.parse(req.query);
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const offers = await prisma.offer.findMany({
    where: ({ businessProfileId, ...(input.status !== 'all' ? { status: input.status as any } : {}), ...businessOwnedInventorySearchWhere(input.q) } as any),
    include: businessOfferInclude,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: input.take,
  });
  res.json({ businessProfile: { id: businessProfile.id, displayName: businessProfile.displayName, type: businessProfile.type, status: businessProfile.status }, myRole: getMyBusinessRole(businessProfile, req.user!.id), offers: await withMedia('offer', offers, 'admin') });
}));

businessRoutes.post('/:businessProfileId/offers', asyncRoute(async (req, res) => {
  const input = businessCreateOfferRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessInventory(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_inventory_editor_required', message: 'Only business team members can create draft Offers.' });
  if (input.status === 'pending_review' && !canSubmitBusinessInventory(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_inventory_submitter_required', message: 'Only business owners and admins can submit Offers for review.' });
  if (!canMutateBusinessTemplateProfile(businessProfile)) return res.status(403).json({ error: 'business_profile_not_allowed', message: 'This Business profile cannot create Offers.' });
  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.offer.create({
      data: {
        ownerId: req.user!.id,
        businessProfileId: businessProfile.id,
        title: input.title,
        description: input.description,
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
        status: input.status as any,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      include: businessOfferInclude,
    });
    await syncBusinessOwnedInventoryMedia(tx, req.user!.id, input.mediaIds, 'offer', created.id);
    await writeTeamAuditLog(tx, { businessProfileId: businessProfile.id, actorId: req.user!.id, action: 'business_offer_created', note: 'Business team member created a Business-owned Offer.', nextValue: { offerId: created.id, status: created.status, title: created.title } });
    return created;
  });
  res.status(201).json({ offer: await withOneMedia('offer', offer, 'admin') });
}));

businessRoutes.patch('/:businessProfileId/offers/:offerId', asyncRoute(async (req, res) => {
  const input = businessUpdateOfferRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const offerId = req.params.offerId;
  if (!businessProfileId || !offerId) return res.status(400).json({ error: 'business_offer_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessInventory(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_inventory_editor_required', message: 'Only business team members can edit Business-owned Offers.' });
  if (!canMutateBusinessTemplateProfile(businessProfile)) return res.status(403).json({ error: 'business_profile_not_allowed', message: 'This Business profile cannot edit Offers.' });
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.offer.findFirst({ where: { id: offerId, businessProfileId }, include: businessOfferInclude });
    if (!existing) return null;
    const role = getMyBusinessRole(businessProfile, req.user!.id);
    if (existing.status === 'active' && role === 'member') return { status: 403 as const, error: 'business_inventory_admin_required' };
    if (existing.status === 'pending_review' && role === 'member') return { status: 409 as const, error: 'business_inventory_under_review' };
    const updated = await tx.offer.update({ where: { id: existing.id }, data: buildBusinessOfferUpdateData(input, existing.status), include: businessOfferInclude });
    if (input.mediaIds !== undefined) await syncBusinessOwnedInventoryMedia(tx, req.user!.id, input.mediaIds, 'offer', updated.id);
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_offer_updated', previousValue: { offerId: existing.id, status: existing.status, title: existing.title }, nextValue: { offerId: updated.id, status: updated.status, title: updated.title } });
    return { status: 200 as const, offer: updated };
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business Offer not found.' });
  if (result.status === 403) return res.status(403).json({ error: result.error, message: 'Only business owners/admins can edit an active Business Offer.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'This Business Offer is already waiting for admin review.' });
  res.json({ offer: await withOneMedia('offer', result.offer, 'admin') });
}));

businessRoutes.post('/:businessProfileId/offers/:offerId/request-review', asyncRoute(async (req, res) => {
  const input = businessOwnedInventoryReviewRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const offerId = req.params.offerId;
  if (!businessProfileId || !offerId) return res.status(400).json({ error: 'business_offer_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canSubmitBusinessInventory(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_inventory_submitter_required', message: 'Only business owners and admins can submit Offers for review.' });
  if (!canMutateBusinessTemplateProfile(businessProfile)) return res.status(403).json({ error: 'business_profile_not_allowed', message: 'This Business profile cannot submit Offers.' });
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.offer.findFirst({ where: { id: offerId, businessProfileId }, include: businessOfferInclude });
    if (!existing) return null;
    if (existing.status === 'active') return { status: 409 as const, error: 'business_offer_already_approved' };
    const updated = await tx.offer.update({ where: { id: existing.id }, data: { status: 'pending_review' as any }, include: businessOfferInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_offer_submitted_for_review', note: input.note, previousValue: { offerId: existing.id, status: existing.status }, nextValue: { offerId: updated.id, status: updated.status } });
    return { status: 200 as const, offer: updated };
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business Offer not found.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'This Business Offer is already approved.' });
  res.json({ offer: await withOneMedia('offer', result.offer, 'admin') });
}));

businessRoutes.post('/:businessProfileId/offers/:offerId/archive', asyncRoute(async (req, res) => {
  const input = businessOwnedInventoryArchiveRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const offerId = req.params.offerId;
  if (!businessProfileId || !offerId) return res.status(400).json({ error: 'business_offer_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canSubmitBusinessInventory(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_inventory_submitter_required', message: 'Only business owners and admins can archive Offers.' });
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.offer.findFirst({ where: { id: offerId, businessProfileId }, include: businessOfferInclude });
    if (!existing) return null;
    const updated = await tx.offer.update({ where: { id: existing.id }, data: { status: 'closed' as any }, include: businessOfferInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_offer_archived', note: input.note ?? null, previousValue: { offerId: existing.id, status: existing.status }, nextValue: { offerId: updated.id, status: updated.status } });
    return updated;
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business Offer not found.' });
  res.json({ offer: await withOneMedia('offer', result, 'admin') });
}));


businessRoutes.use('/:businessProfileId/sponsored-placements', requireBusinessSponsoredContentEnabled('Business sponsored placements'));

function businessSponsoredPlacementSearchWhere(q?: string) {
  const text = q?.trim();
  return text ? {
    OR: [
      { label: { contains: text, mode: 'insensitive' as const } },
      { reviewNote: { contains: text, mode: 'insensitive' as const } },
      { targetId: { contains: text, mode: 'insensitive' as const } },
    ],
  } : {};
}

businessRoutes.get('/:businessProfileId/sponsored-placements', asyncRoute(async (req, res) => {
  const input = businessSponsoredPlacementListQuerySchema.parse(req.query);
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });

  const placements = await (prisma as any).businessSponsoredPlacement.findMany({
    where: ({
      businessProfileId,
      ...(input.status !== 'all' ? { status: input.status } : {}),
      ...(input.surface !== 'all' ? { surface: input.surface } : {}),
      ...(input.targetType !== 'all' ? { targetType: input.targetType } : {}),
      ...businessSponsoredPlacementSearchWhere(input.q),
    } as any),
    include: businessSponsoredPlacementInclude,
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
    take: input.take,
  });

  res.json({
    businessProfile: { id: businessProfile.id, displayName: businessProfile.displayName, type: businessProfile.type, status: businessProfile.status },
    myRole: getMyBusinessRole(businessProfile, req.user!.id),
    placements: await hydrateBusinessSponsoredPlacements(placements),
  });
}));

businessRoutes.post('/:businessProfileId/sponsored-placements', asyncRoute(async (req, res) => {
  const input = businessCreateSponsoredPlacementRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessSponsoredPlacements(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_sponsored_placement_editor_required', message: 'Only business team members can draft sponsored placements.' });
  if (input.status === 'pending_review' && !canSubmitBusinessSponsoredPlacements(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_sponsored_placement_submitter_required', message: 'Only business owners and admins can submit sponsored placements for review.' });
  if (businessProfile.status !== 'verified') return res.status(409).json({ error: 'business_profile_not_verified', message: 'Verify this Business profile before creating sponsored placements.' });
  const target = await loadBusinessSponsoredPlacementTarget(businessProfile.id, input.targetType, input.targetId);
  if (!target) return res.status(400).json({ error: 'sponsored_target_not_eligible', message: 'Sponsored placement target must be an active, admin-approved Business Need, Offer, or library item.' });
  const window = cleanSponsoredPlacementDateWindow(input.startsAt, input.endsAt);

  try {
    const placement = await prisma.$transaction(async (tx) => {
      const created = await (tx as any).businessSponsoredPlacement.create({
        data: {
          businessProfileId: businessProfile.id,
          targetType: input.targetType,
          targetId: input.targetId,
          surface: input.surface,
          label: input.label ?? 'Sponsored',
          priority: input.priority ?? 0,
          startsAt: window.startsAt ?? null,
          endsAt: window.endsAt ?? null,
          status: input.status,
          createdById: req.user!.id,
          submittedAt: input.status === 'pending_review' ? new Date() : null,
        },
        include: businessSponsoredPlacementInclude,
      });
      await writeTeamAuditLog(tx, {
        businessProfileId: businessProfile.id,
        actorId: req.user!.id,
        action: input.status === 'pending_review' ? 'business_sponsored_placement_created_and_submitted' : 'business_sponsored_placement_created',
        note: input.note ?? null,
        nextValue: { placementId: created.id, status: created.status, targetType: created.targetType, targetId: created.targetId, surface: created.surface },
      });
      return created;
    });
    res.status(201).json({ placement: normalizeSponsoredPlacement(placement, target) });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'sponsored_placement_exists', message: 'This Business target already has a sponsored placement for that surface.' });
    throw error;
  }
}));

businessRoutes.patch('/:businessProfileId/sponsored-placements/:placementId', asyncRoute(async (req, res) => {
  const input = businessUpdateSponsoredPlacementRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const placementId = req.params.placementId;
  if (!businessProfileId || !placementId) return res.status(400).json({ error: 'business_sponsored_placement_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessSponsoredPlacements(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_sponsored_placement_editor_required', message: 'Only business team members can edit sponsored placements.' });
  if (businessProfile.status !== 'verified') return res.status(409).json({ error: 'business_profile_not_verified', message: 'Verify this Business profile before editing sponsored placements.' });
  const window = cleanSponsoredPlacementDateWindow(input.startsAt, input.endsAt);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).businessSponsoredPlacement.findFirst({ where: { id: placementId, businessProfileId }, include: businessSponsoredPlacementInclude });
    if (!existing) return null;
    const role = getMyBusinessRole(businessProfile, req.user!.id);
    if ((existing.status === 'approved' || existing.status === 'paused') && role === 'member') return { status: 403 as const, error: 'business_sponsored_placement_admin_required' };
    if (existing.status === 'archived') return { status: 409 as const, error: 'business_sponsored_placement_archived' };
    const nextTargetType = input.targetType ?? existing.targetType;
    const nextTargetId = input.targetId ?? existing.targetId;
    const target = await loadBusinessSponsoredPlacementTarget(businessProfileId, nextTargetType, nextTargetId);
    if (!target) return { status: 409 as const, error: 'sponsored_target_not_eligible' };
    const changedContent = Object.keys(input).some((key) => key !== 'note');
    const resetReview = changedContent && (existing.status === 'approved' || existing.status === 'rejected' || existing.status === 'paused');
    const updated = await (tx as any).businessSponsoredPlacement.update({
      where: { id: existing.id },
      data: {
        ...(input.targetType !== undefined ? { targetType: input.targetType } : {}),
        ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
        ...(input.surface !== undefined ? { surface: input.surface } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.startsAt !== undefined ? { startsAt: window.startsAt ?? null } : {}),
        ...(input.endsAt !== undefined ? { endsAt: window.endsAt ?? null } : {}),
        ...(resetReview ? { status: 'pending_review', submittedAt: new Date(), reviewedAt: null, reviewedById: null, reviewNote: null, archivedAt: null } : {}),
      },
      include: businessSponsoredPlacementInclude,
    });
    await writeTeamAuditLog(tx, {
      businessProfileId,
      actorId: req.user!.id,
      action: resetReview ? 'business_sponsored_placement_updated_and_resubmitted' : 'business_sponsored_placement_updated',
      note: input.note ?? null,
      previousValue: { placementId: existing.id, status: existing.status, targetType: existing.targetType, targetId: existing.targetId, surface: existing.surface, label: existing.label, priority: existing.priority },
      nextValue: { placementId: updated.id, status: updated.status, targetType: updated.targetType, targetId: updated.targetId, surface: updated.surface, label: updated.label, priority: updated.priority },
    });
    return { status: 200 as const, placement: updated, target };
  });

  if (!result) return res.status(404).json({ error: 'not_found', message: 'Sponsored placement not found.' });
  if (result.status === 403) return res.status(403).json({ error: result.error, message: 'Only business owners/admins can edit approved or paused sponsored placements.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: result.error === 'sponsored_target_not_eligible' ? 'Sponsored placement target must be an active, admin-approved Business Need, Offer, or library item.' : 'Archived sponsored placements cannot be edited.' });
  res.json({ placement: normalizeSponsoredPlacement(result.placement, result.target) });
}));

businessRoutes.post('/:businessProfileId/sponsored-placements/:placementId/request-review', asyncRoute(async (req, res) => {
  const input = businessSponsoredPlacementReviewRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const placementId = req.params.placementId;
  if (!businessProfileId || !placementId) return res.status(400).json({ error: 'business_sponsored_placement_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canSubmitBusinessSponsoredPlacements(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_sponsored_placement_submitter_required', message: 'Only business owners and admins can submit sponsored placements for review.' });
  if (businessProfile.status !== 'verified') return res.status(409).json({ error: 'business_profile_not_verified', message: 'Verify this Business profile before submitting sponsored placements.' });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).businessSponsoredPlacement.findFirst({ where: { id: placementId, businessProfileId }, include: businessSponsoredPlacementInclude });
    if (!existing) return null;
    if (existing.status === 'approved') return { status: 409 as const, error: 'business_sponsored_placement_already_approved' };
    if (existing.status === 'archived') return { status: 409 as const, error: 'business_sponsored_placement_archived' };
    const target = await loadBusinessSponsoredPlacementTarget(existing.businessProfileId, existing.targetType, existing.targetId);
    if (!target) return { status: 409 as const, error: 'sponsored_target_not_eligible' };
    const updated = await (tx as any).businessSponsoredPlacement.update({ where: { id: existing.id }, data: { status: 'pending_review', submittedAt: new Date(), archivedAt: null }, include: businessSponsoredPlacementInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_sponsored_placement_submitted_for_review', note: input.note, previousValue: { placementId: existing.id, status: existing.status }, nextValue: { placementId: updated.id, status: updated.status } });
    return { status: 200 as const, placement: updated, target };
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Sponsored placement not found.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: result.error === 'business_sponsored_placement_already_approved' ? 'This sponsored placement is already approved.' : result.error === 'sponsored_target_not_eligible' ? 'Sponsored placement target must be an active, admin-approved Business Need, Offer, or library item.' : 'Archived sponsored placements cannot be submitted for review.' });
  res.json({ placement: normalizeSponsoredPlacement(result.placement, result.target) });
}));

businessRoutes.post('/:businessProfileId/sponsored-placements/:placementId/archive', asyncRoute(async (req, res) => {
  const input = businessSponsoredPlacementArchiveRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const placementId = req.params.placementId;
  if (!businessProfileId || !placementId) return res.status(400).json({ error: 'business_sponsored_placement_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canSubmitBusinessSponsoredPlacements(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_sponsored_placement_submitter_required', message: 'Only business owners and admins can archive sponsored placements.' });
  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).businessSponsoredPlacement.findFirst({ where: { id: placementId, businessProfileId }, include: businessSponsoredPlacementInclude });
    if (!existing) return null;
    const updated = await (tx as any).businessSponsoredPlacement.update({ where: { id: existing.id }, data: { status: 'archived', archivedAt: new Date() }, include: businessSponsoredPlacementInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_sponsored_placement_archived', note: input.note ?? null, previousValue: { placementId: existing.id, status: existing.status }, nextValue: { placementId: updated.id, status: updated.status } });
    return updated;
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Sponsored placement not found.' });
  res.json({ placement: normalizeSponsoredPlacement(result, await loadBusinessSponsoredPlacementTarget(result.businessProfileId, result.targetType, result.targetId)) });
}));



businessRoutes.use('/:businessProfileId/campaigns', requireBusinessCampaignsEnabled('Business campaigns'));

businessRoutes.get('/:businessProfileId/campaigns', asyncRoute(async (req, res) => {
  const input = businessCampaignListQuerySchema.parse(req.query);
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const campaigns = await (prisma as any).businessCampaign.findMany({
    where: ({
      businessProfileId,
      ...(input.status !== 'all' ? { status: input.status } : {}),
      ...(input.opportunityType !== 'all' ? { opportunityType: input.opportunityType } : {}),
      ...businessCampaignSearchWhere(input.q),
    } as any),
    include: businessCampaignInclude,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: input.take,
  });
  res.json({
    businessProfile: { id: businessProfile.id, displayName: businessProfile.displayName, type: businessProfile.type, status: businessProfile.status },
    myRole: getMyBusinessRole(businessProfile, req.user!.id),
    campaigns: await hydrateBusinessCampaigns(campaigns),
  });
}));

businessRoutes.post('/:businessProfileId/campaigns', asyncRoute(async (req, res) => {
  const input = businessCreateCampaignRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessCampaigns(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_campaign_editor_required', message: 'Only business team members can draft campaigns.' });
  if (input.status === 'pending_review' && !canSubmitBusinessCampaigns(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_campaign_submitter_required', message: 'Only business owners and admins can submit campaigns for review.' });
  if (!canMutateBusinessTemplateProfile(businessProfile)) return res.status(403).json({ error: 'business_profile_not_allowed', message: 'This Business profile cannot create campaigns.' });
  if (input.status === 'pending_review' && businessProfile.status !== 'verified') return res.status(409).json({ error: 'business_profile_not_verified', message: 'Verify this Business profile before submitting campaigns.' });
  if (input.status === 'pending_review') return res.status(409).json({ error: 'business_campaign_items_required', message: 'Create the campaign as a draft, attach at least one approved Business item, then submit it for admin review.' });
  const window = cleanCampaignDateWindow(input.startsAt, input.endsAt);
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await (tx as any).businessCampaign.create({
      data: {
        businessProfileId: businessProfile.id,
        opportunityType: input.opportunityType,
        status: input.status,
        title: input.title,
        summary: input.summary ?? null,
        description: input.description,
        eligibility: input.eligibility ?? null,
        deliverables: input.deliverables ?? null,
        startsAt: window.startsAt ?? null,
        endsAt: window.endsAt ?? null,
        createdById: req.user!.id,
        submittedAt: input.status === 'pending_review' ? new Date() : null,
      },
      include: businessCampaignInclude,
    });
    await writeTeamAuditLog(tx, {
      businessProfileId: businessProfile.id,
      actorId: req.user!.id,
      action: input.status === 'pending_review' ? 'business_campaign_created_and_submitted' : 'business_campaign_created',
      note: input.note ?? null,
      nextValue: { campaignId: created.id, status: created.status, opportunityType: created.opportunityType, noMoney: true },
    });
    return created;
  });
  res.status(201).json({ campaign: await hydrateBusinessCampaign(campaign) });
}));

businessRoutes.patch('/:businessProfileId/campaigns/:campaignId', asyncRoute(async (req, res) => {
  const input = businessUpdateCampaignRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const campaignId = req.params.campaignId;
  if (!businessProfileId || !campaignId) return res.status(400).json({ error: 'business_campaign_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessCampaigns(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_campaign_editor_required', message: 'Only business team members can edit campaigns.' });
  const window = cleanCampaignDateWindow(input.startsAt, input.endsAt);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).businessCampaign.findFirst({ where: { id: campaignId, businessProfileId }, include: businessCampaignInclude });
    if (!existing) return null;
    const role = getMyBusinessRole(businessProfile, req.user!.id);
    if ((existing.status === 'approved' || existing.status === 'paused' || existing.status === 'completed') && role === 'member') return { status: 403 as const, error: 'business_campaign_admin_required' };
    if (existing.status === 'archived') return { status: 409 as const, error: 'business_campaign_archived' };
    const resetReview = campaignContentChanged(input as Record<string, unknown>) && ['approved', 'rejected', 'paused', 'completed'].includes(existing.status);
    const updated = await (tx as any).businessCampaign.update({
      where: { id: existing.id },
      data: {
        ...(input.opportunityType !== undefined ? { opportunityType: input.opportunityType } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary ?? null } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.eligibility !== undefined ? { eligibility: input.eligibility ?? null } : {}),
        ...(input.deliverables !== undefined ? { deliverables: input.deliverables ?? null } : {}),
        ...(input.startsAt !== undefined ? { startsAt: window.startsAt ?? null } : {}),
        ...(input.endsAt !== undefined ? { endsAt: window.endsAt ?? null } : {}),
        ...(resetReview ? { status: 'pending_review', submittedAt: new Date(), reviewedAt: null, reviewedById: null, reviewNote: null, archivedAt: null } : {}),
      },
      include: businessCampaignInclude,
    });
    await writeTeamAuditLog(tx, {
      businessProfileId,
      actorId: req.user!.id,
      action: resetReview ? 'business_campaign_updated_and_resubmitted' : 'business_campaign_updated',
      note: input.note ?? null,
      previousValue: { campaignId: existing.id, status: existing.status, title: existing.title, opportunityType: existing.opportunityType },
      nextValue: { campaignId: updated.id, status: updated.status, title: updated.title, opportunityType: updated.opportunityType },
    });
    return { status: 200 as const, campaign: updated };
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business campaign not found.' });
  if (result.status === 403) return res.status(403).json({ error: result.error, message: 'Only business owners/admins can edit approved, paused, or completed campaigns.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'Archived campaigns cannot be edited.' });
  res.json({ campaign: await hydrateBusinessCampaign(result.campaign) });
}));

businessRoutes.post('/:businessProfileId/campaigns/:campaignId/request-review', asyncRoute(async (req, res) => {
  const input = businessCampaignReviewRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const campaignId = req.params.campaignId;
  if (!businessProfileId || !campaignId) return res.status(400).json({ error: 'business_campaign_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canSubmitBusinessCampaigns(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_campaign_submitter_required', message: 'Only business owners and admins can submit campaigns for review.' });
  if (businessProfile.status !== 'verified') return res.status(409).json({ error: 'business_profile_not_verified', message: 'Verify this Business profile before submitting campaigns.' });
  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).businessCampaign.findFirst({ where: { id: campaignId, businessProfileId }, include: businessCampaignInclude });
    if (!existing) return null;
    if (existing.status === 'approved') return { status: 409 as const, error: 'business_campaign_already_approved' };
    if (existing.status === 'archived') return { status: 409 as const, error: 'business_campaign_archived' };
    const hasEligibleItem = await ensureCampaignHasEligibleItem(tx as any, businessProfileId, existing.id);
    if (!hasEligibleItem) return { status: 409 as const, error: 'business_campaign_items_required' };
    const updated = await (tx as any).businessCampaign.update({ where: { id: existing.id }, data: { status: 'pending_review', submittedAt: new Date(), archivedAt: null }, include: businessCampaignInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_campaign_submitted_for_review', note: input.note, previousValue: { campaignId: existing.id, status: existing.status }, nextValue: { campaignId: updated.id, status: updated.status } });
    return { status: 200 as const, campaign: updated };
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business campaign not found.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: result.error === 'business_campaign_items_required' ? 'Attach at least one active, admin-approved Business item before submitting this campaign.' : result.error === 'business_campaign_already_approved' ? 'This campaign is already approved.' : 'Archived campaigns cannot be submitted for review.' });
  res.json({ campaign: await hydrateBusinessCampaign(result.campaign) });
}));

businessRoutes.post('/:businessProfileId/campaigns/:campaignId/archive', asyncRoute(async (req, res) => {
  const input = businessCampaignArchiveRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const campaignId = req.params.campaignId;
  if (!businessProfileId || !campaignId) return res.status(400).json({ error: 'business_campaign_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canSubmitBusinessCampaigns(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_campaign_submitter_required', message: 'Only business owners and admins can archive campaigns.' });
  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).businessCampaign.findFirst({ where: { id: campaignId, businessProfileId }, include: businessCampaignInclude });
    if (!existing) return null;
    const updated = await (tx as any).businessCampaign.update({ where: { id: existing.id }, data: { status: 'archived', archivedAt: new Date() }, include: businessCampaignInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_campaign_archived', note: input.note ?? null, previousValue: { campaignId: existing.id, status: existing.status }, nextValue: { campaignId: updated.id, status: updated.status } });
    return updated;
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business campaign not found.' });
  res.json({ campaign: await hydrateBusinessCampaign(result) });
}));

businessRoutes.post('/:businessProfileId/campaigns/:campaignId/items', asyncRoute(async (req, res) => {
  const input = businessCreateCampaignItemRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const campaignId = req.params.campaignId;
  if (!businessProfileId || !campaignId) return res.status(400).json({ error: 'business_campaign_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessCampaigns(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_campaign_editor_required', message: 'Only business team members can edit campaign items.' });
  const target = await loadBusinessCampaignTarget(businessProfileId, input.targetType, input.targetId);
  if (!target) return res.status(400).json({ error: 'campaign_target_not_eligible', message: 'Campaign items must point to an active, admin-approved Business Need, Offer, or library item.' });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await (tx as any).businessCampaign.findFirst({ where: { id: campaignId, businessProfileId }, include: businessCampaignInclude });
      if (!existing) return null;
      if (existing.status === 'archived' || existing.status === 'completed') return { status: 409 as const, error: 'business_campaign_locked' };
      const item = await (tx as any).businessCampaignItem.create({ data: { campaignId: existing.id, targetType: input.targetType, targetId: input.targetId, note: input.note ?? null, sortOrder: input.sortOrder ?? 0 } });
      const resetReview = ['approved', 'rejected', 'paused'].includes(existing.status);
      const updated = resetReview ? await (tx as any).businessCampaign.update({ where: { id: existing.id }, data: { status: 'pending_review', submittedAt: new Date(), reviewedAt: null, reviewedById: null, reviewNote: null }, include: businessCampaignInclude }) : existing;
      await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: resetReview ? 'business_campaign_item_added_and_resubmitted' : 'business_campaign_item_added', note: input.note ?? null, previousValue: { campaignId: existing.id, status: existing.status }, nextValue: { campaignId: existing.id, status: updated.status, itemId: item.id, targetType: item.targetType, targetId: item.targetId } });
      return { status: 200 as const, campaign: updated };
    });
    if (!result) return res.status(404).json({ error: 'not_found', message: 'Business campaign not found.' });
    if (result.status === 409) return res.status(409).json({ error: result.error, message: 'Archived or completed campaigns cannot receive new items.' });
    res.status(201).json({ campaign: await hydrateBusinessCampaign(result.campaign) });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'campaign_item_exists', message: 'This item is already attached to the campaign.' });
    throw error;
  }
}));

businessRoutes.patch('/:businessProfileId/campaigns/:campaignId/items/:itemId', asyncRoute(async (req, res) => {
  const input = businessUpdateCampaignItemRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const campaignId = req.params.campaignId;
  const itemId = req.params.itemId;
  if (!businessProfileId || !campaignId || !itemId) return res.status(400).json({ error: 'business_campaign_item_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessCampaigns(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_campaign_editor_required', message: 'Only business team members can edit campaign items.' });
  const result = await prisma.$transaction(async (tx) => {
    const existingCampaign = await (tx as any).businessCampaign.findFirst({ where: { id: campaignId, businessProfileId }, include: businessCampaignInclude });
    if (!existingCampaign) return null;
    if (existingCampaign.status === 'archived' || existingCampaign.status === 'completed') return { status: 409 as const, error: 'business_campaign_locked' };
    const existingItem = await (tx as any).businessCampaignItem.findFirst({ where: { id: itemId, campaignId } });
    if (!existingItem) return { status: 404 as const, error: 'business_campaign_item_not_found' };
    const item = await (tx as any).businessCampaignItem.update({ where: { id: existingItem.id }, data: { ...(input.note !== undefined ? { note: input.note ?? null } : {}), ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}) } });
    const resetReview = ['approved', 'rejected', 'paused'].includes(existingCampaign.status);
    const updated = resetReview ? await (tx as any).businessCampaign.update({ where: { id: existingCampaign.id }, data: { status: 'pending_review', submittedAt: new Date(), reviewedAt: null, reviewedById: null, reviewNote: null }, include: businessCampaignInclude }) : existingCampaign;
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: resetReview ? 'business_campaign_item_updated_and_resubmitted' : 'business_campaign_item_updated', note: input.note ?? null, previousValue: { itemId: existingItem.id, note: existingItem.note, sortOrder: existingItem.sortOrder, campaignStatus: existingCampaign.status }, nextValue: { itemId: item.id, note: item.note, sortOrder: item.sortOrder, campaignStatus: updated.status } });
    return { status: 200 as const, campaign: updated };
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business campaign not found.' });
  if (result.status === 404) return res.status(404).json({ error: result.error, message: 'Campaign item not found.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'Archived or completed campaigns cannot be edited.' });
  res.json({ campaign: await hydrateBusinessCampaign(result.campaign) });
}));

businessRoutes.delete('/:businessProfileId/campaigns/:campaignId/items/:itemId', asyncRoute(async (req, res) => {
  const input = businessCampaignItemActionRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const campaignId = req.params.campaignId;
  const itemId = req.params.itemId;
  if (!businessProfileId || !campaignId || !itemId) return res.status(400).json({ error: 'business_campaign_item_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessCampaigns(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_campaign_editor_required', message: 'Only business team members can edit campaign items.' });
  const result = await prisma.$transaction(async (tx) => {
    const existingCampaign = await (tx as any).businessCampaign.findFirst({ where: { id: campaignId, businessProfileId }, include: businessCampaignInclude });
    if (!existingCampaign) return null;
    if (existingCampaign.status === 'archived' || existingCampaign.status === 'completed') return { status: 409 as const, error: 'business_campaign_locked' };
    const existingItem = await (tx as any).businessCampaignItem.findFirst({ where: { id: itemId, campaignId } });
    if (!existingItem) return { status: 404 as const, error: 'business_campaign_item_not_found' };
    await (tx as any).businessCampaignItem.delete({ where: { id: existingItem.id } });
    const resetReview = ['approved', 'rejected', 'paused'].includes(existingCampaign.status);
    const updated = resetReview ? await (tx as any).businessCampaign.update({ where: { id: existingCampaign.id }, data: { status: 'pending_review', submittedAt: new Date(), reviewedAt: null, reviewedById: null, reviewNote: null }, include: businessCampaignInclude }) : existingCampaign;
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: resetReview ? 'business_campaign_item_removed_and_resubmitted' : 'business_campaign_item_removed', note: input.note ?? null, previousValue: { itemId: existingItem.id, campaignStatus: existingCampaign.status }, nextValue: { campaignId: existingCampaign.id, campaignStatus: updated.status } });
    return { status: 200 as const, campaign: updated };
  });
  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business campaign not found.' });
  if (result.status === 404) return res.status(404).json({ error: result.error, message: 'Campaign item not found.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'Archived or completed campaigns cannot be edited.' });
  res.json({ campaign: await hydrateBusinessCampaign(result.campaign) });
}));

businessRoutes.get('/:businessProfileId/campaigns/:campaignId/applications', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  const campaignId = req.params.campaignId;
  if (!businessProfileId || !campaignId) return res.status(400).json({ error: 'business_campaign_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const campaign = await (prisma as any).businessCampaign.findFirst({ where: { id: campaignId, businessProfileId }, select: { id: true, title: true, status: true } });
  if (!campaign) return res.status(404).json({ error: 'not_found', message: 'Business campaign not found.' });
  const applications = await (prisma as any).businessCampaignApplication.findMany({ where: { campaignId }, include: businessCampaignApplicationInclude, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ campaign, applications });
}));


businessRoutes.use('/:businessProfileId/budgets', requireBusinessBudgetsEnabled('Business budget sandbox'));

businessRoutes.get('/:businessProfileId/budgets', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile || !canEditBusinessBudgets(businessProfile, req.user!.id)) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const input = businessBudgetListQuerySchema.parse(req.query);
  const budgets = await (prisma as any).businessBudget.findMany({
    where: {
      businessProfileId,
      ...(input.status !== 'all' ? { status: input.status } : {}),
      ...(input.provider !== 'all' ? { provider: input.provider } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...businessBudgetSearchWhere(input.q),
    },
    include: businessBudgetInclude,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: input.take,
  });
  res.json({ budgets });
}));

businessRoutes.post('/:businessProfileId/budgets', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile || !canEditBusinessBudgets(businessProfile, req.user!.id)) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (['disabled', 'restricted', 'rejected'].includes(businessProfile.status)) return res.status(409).json({ error: 'business_profile_not_eligible', message: 'This Business profile cannot create budget sandbox records.' });
  const input = businessCreateBudgetRequestSchema.parse(req.body ?? {});
  await validateBusinessBudgetLinks(businessProfileId, input);
  const now = new Date();
  const budget = await prisma.$transaction(async (tx) => {
    const created = await (tx as any).businessBudget.create({
      data: {
        ...cleanBudgetData(input),
        businessProfileId,
        createdById: req.user!.id,
        ...(input.status === 'pending_provider_review' || input.status === 'pending_admin_review' ? { submittedAt: now } : {}),
      },
      include: businessBudgetInclude,
    });
    if (input.requestedAmountCents && input.requestedAmountCents > 0) {
      await (tx as any).businessBudgetLedgerEntry.create({ data: { budgetId: created.id, type: 'requested', amountCents: input.requestedAmountCents, currency: (input.currency ?? 'eur').toLowerCase(), note: input.note ?? 'Initial sandbox budget request. No money moved.', createdById: req.user!.id } });
    }
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_budget.create', note: input.note ?? null, nextValue: { status: created.status, provider: created.provider, requestedAmountCents: created.requestedAmountCents, currency: created.currency, noMoneyMoved: true } });
    return (tx as any).businessBudget.findUnique({ where: { id: created.id }, include: businessBudgetInclude });
  });
  res.status(201).json({ budget });
}));

businessRoutes.patch('/:businessProfileId/budgets/:budgetId', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  const budgetId = req.params.budgetId;
  if (!businessProfileId || !budgetId) return res.status(400).json({ error: 'business_budget_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile || !canEditBusinessBudgets(businessProfile, req.user!.id)) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const input = businessUpdateBudgetRequestSchema.parse(req.body ?? {});
  await validateBusinessBudgetLinks(businessProfileId, input);
  const existing = await (prisma as any).businessBudget.findFirst({ where: { id: budgetId, businessProfileId }, include: businessBudgetInclude });
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business budget not found.' });
  if (!['draft', 'rejected', 'paused'].includes(existing.status)) return res.status(409).json({ error: 'business_budget_locked', message: 'Only draft, rejected, or paused sandbox budgets can be edited.' });
  const updateData = cleanBudgetData(input);
  if (budgetContentChanged(input) && existing.status !== 'draft') updateData.status = 'draft';
  const updated = await prisma.$transaction(async (tx) => {
    const next = await (tx as any).businessBudget.update({ where: { id: existing.id }, data: updateData, include: businessBudgetInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_budget.update', note: input.note ?? null, previousValue: { status: existing.status, provider: existing.provider, requestedAmountCents: existing.requestedAmountCents, currency: existing.currency }, nextValue: { status: next.status, provider: next.provider, requestedAmountCents: next.requestedAmountCents, currency: next.currency, noMoneyMoved: true } });
    return next;
  });
  res.json({ budget: updated });
}));

businessRoutes.post('/:businessProfileId/budgets/:budgetId/request-review', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  const budgetId = req.params.budgetId;
  if (!businessProfileId || !budgetId) return res.status(400).json({ error: 'business_budget_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile || !canSubmitBusinessBudgets(businessProfile, req.user!.id)) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const input = businessBudgetReviewRequestSchema.parse(req.body ?? {});
  const existing = await (prisma as any).businessBudget.findFirst({ where: { id: budgetId, businessProfileId }, include: businessBudgetInclude });
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business budget not found.' });
  if (!['draft', 'rejected', 'paused'].includes(existing.status)) return res.status(409).json({ error: 'business_budget_review_not_allowed', message: 'This sandbox budget cannot be submitted for review now.' });
  if (!existing.requestedAmountCents || existing.requestedAmountCents <= 0) return res.status(400).json({ error: 'business_budget_amount_required', message: 'Add a requested budget amount before review.' });
  const nextStatus = existing.provider === 'none' || !existing.providerAccountId ? 'pending_provider_review' : 'pending_admin_review';
  const updated = await prisma.$transaction(async (tx) => {
    const next = await (tx as any).businessBudget.update({ where: { id: existing.id }, data: { status: nextStatus, submittedAt: new Date(), reviewNote: null }, include: businessBudgetInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_budget.request_review', note: input.note, previousValue: { status: existing.status }, nextValue: { status: next.status, noMoneyMoved: true } });
    return next;
  });
  res.json({ budget: updated });
}));

businessRoutes.post('/:businessProfileId/budgets/:budgetId/archive', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  const budgetId = req.params.budgetId;
  if (!businessProfileId || !budgetId) return res.status(400).json({ error: 'business_budget_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile || !canSubmitBusinessBudgets(businessProfile, req.user!.id)) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const input = businessBudgetArchiveRequestSchema.parse(req.body ?? {});
  const existing = await (prisma as any).businessBudget.findFirst({ where: { id: budgetId, businessProfileId }, include: businessBudgetInclude });
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business budget not found.' });
  const updated = await prisma.$transaction(async (tx) => {
    const next = await (tx as any).businessBudget.update({ where: { id: existing.id }, data: { status: 'archived', archivedAt: new Date() }, include: businessBudgetInclude });
    await writeTeamAuditLog(tx, { businessProfileId, actorId: req.user!.id, action: 'business_budget.archive', note: input.note ?? null, previousValue: { status: existing.status }, nextValue: { status: next.status, noMoneyMoved: true } });
    return next;
  });
  res.json({ budget: updated });
}));

businessRoutes.get('/:businessProfileId/templates', asyncRoute(async (req, res) => {
  const input = businessListInventoryTemplatesQuerySchema.parse(req.query);
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });

  const q = input.q?.trim();
  const templates = await prisma.inventoryTemplate.findMany({
    where: ({
      businessProfileId,
      ...(input.kind !== 'all' ? { kind: input.kind } : {}),
      ...(input.status !== 'all' ? { status: input.status } : {}),
      ...(q ? {
        OR: [
          { key: { contains: q, mode: 'insensitive' as const } },
          { title: { contains: q, mode: 'insensitive' as const } },
          { description: { contains: q, mode: 'insensitive' as const } },
          { category: { contains: q, mode: 'insensitive' as const } },
          { locationLabel: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
    } as any),
    include: businessTemplateInclude,
    orderBy: [{ status: 'asc' }, { kind: 'asc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
    take: input.take,
  });

  res.json({ businessProfile: { id: businessProfile.id, displayName: businessProfile.displayName, type: businessProfile.type, status: businessProfile.status }, myRole: getMyBusinessRole(businessProfile, req.user!.id), templates: await withMedia('inventory_template', templates, 'admin') });
}));

businessRoutes.post('/:businessProfileId/templates', asyncRoute(async (req, res) => {
  const input = businessCreateInventoryTemplateRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessTemplates(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_template_editor_required', message: 'Only business team members can create draft library items.' });
  if (!canMutateBusinessTemplateProfile(businessProfile)) return res.status(403).json({ error: 'business_profile_not_allowed', message: 'This Business profile cannot create library items.' });

  const template = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryTemplate.create({
      data: {
        key: makeBusinessTemplateKey(businessProfile.id, input.kind, input.title),
        kind: input.kind,
        sourceType: businessTemplateSourceType(businessProfile),
        businessProfileId: businessProfile.id,
        languageCode: input.languageCode,
        countryCode: input.countryCode?.toUpperCase() ?? null,
        title: input.title,
        description: input.description,
        itemType: input.itemType,
        category: input.category ?? null,
        timing: input.kind === 'need' ? input.timing ?? null : null,
        availability: input.kind === 'offer' ? input.availability ?? null : null,
        availabilityPreset: input.availabilityPreset ?? null,
        availabilityStartAt: input.availabilityStartAt ? new Date(input.availabilityStartAt) : null,
        availabilityEndAt: input.availabilityEndAt ? new Date(input.availabilityEndAt) : null,
        durationPreset: input.durationPreset ?? null,
        durationMinutes: input.durationMinutes ?? null,
        mode: input.mode ?? null,
        locationLabel: input.locationLabel ?? null,
        tags: input.tags,
        includes: input.kind === 'offer' ? input.includes : [],
        status: 'draft' as any,
        sortOrder: input.sortOrder,
      },
      include: businessTemplateInclude,
    });
    await syncBusinessTemplateMedia(tx, req.user!.id, input.mediaIds, created.id);
    await writeTeamAuditLog(tx, {
      businessProfileId: businessProfile.id,
      actorId: req.user!.id,
      action: 'business_inventory_template_created',
      note: 'Business team member created a draft library item.',
      nextValue: { templateId: created.id, kind: created.kind, status: created.status, title: created.title },
    });
    return created;
  });

  res.status(201).json({ template: await withOneMedia('inventory_template', template, 'admin') });
}));

businessRoutes.patch('/:businessProfileId/templates/:templateId', asyncRoute(async (req, res) => {
  const input = businessUpdateInventoryTemplateRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const templateId = req.params.templateId;
  if (!businessProfileId || !templateId) return res.status(400).json({ error: 'business_template_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canEditBusinessTemplates(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_template_editor_required', message: 'Only business team members can edit draft library items.' });
  if (!canMutateBusinessTemplateProfile(businessProfile)) return res.status(403).json({ error: 'business_profile_not_allowed', message: 'This Business profile cannot edit library items.' });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryTemplate.findFirst({ where: { id: templateId, businessProfileId }, include: businessTemplateInclude });
    if (!existing) return null;
    if (existing.status === 'active' && getMyBusinessRole(businessProfile, req.user!.id) === 'member') {
      return { status: 403 as const, error: 'business_template_admin_required' };
    }
    if (existing.status === 'pending_review' && getMyBusinessRole(businessProfile, req.user!.id) === 'member') {
      return { status: 409 as const, error: 'business_template_under_review' };
    }
    const updated = await tx.inventoryTemplate.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.itemType !== undefined ? { itemType: input.itemType } : {}),
        ...(input.languageCode !== undefined ? { languageCode: input.languageCode } : {}),
        ...(input.countryCode !== undefined ? { countryCode: input.countryCode?.toUpperCase() ?? null } : {}),
        ...(input.category !== undefined ? { category: input.category ?? null } : {}),
        ...(input.mode !== undefined ? { mode: input.mode ?? null } : {}),
        ...(input.locationLabel !== undefined ? { locationLabel: input.locationLabel ?? null } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.includes !== undefined ? { includes: existing.kind === 'offer' ? input.includes : [] } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        timing: existing.kind === 'need' ? normalizeTemplateNullable(input.timing) : null,
        availability: existing.kind === 'offer' ? normalizeTemplateNullable(input.availability) : null,
        availabilityPreset: normalizeTemplateNullable(input.availabilityPreset),
        availabilityStartAt: input.availabilityStartAt === undefined ? undefined : input.availabilityStartAt ? new Date(input.availabilityStartAt) : null,
        availabilityEndAt: input.availabilityEndAt === undefined ? undefined : input.availabilityEndAt ? new Date(input.availabilityEndAt) : null,
        durationPreset: normalizeTemplateNullable(input.durationPreset),
        durationMinutes: normalizeTemplateNullable(input.durationMinutes),
        status: (existing.status === 'active' ? 'pending_review' : existing.status) as any,
      },
      include: businessTemplateInclude,
    });
    if (input.mediaIds !== undefined) await syncBusinessTemplateMedia(tx, req.user!.id, input.mediaIds, updated.id);
    await writeTeamAuditLog(tx, {
      businessProfileId,
      actorId: req.user!.id,
      action: 'business_inventory_template_updated',
      previousValue: { templateId: existing.id, status: existing.status, title: existing.title },
      nextValue: { templateId: updated.id, status: updated.status, title: updated.title },
    });
    return { status: 200 as const, template: updated };
  });

  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business library item not found.' });
  if (result.status === 403) return res.status(403).json({ error: result.error, message: 'Only business owners/admins can edit an active Business library item.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'This Business library item is already waiting for admin review.' });
  res.json({ template: await withOneMedia('inventory_template', result.template, 'admin') });
}));

businessRoutes.post('/:businessProfileId/templates/:templateId/request-review', asyncRoute(async (req, res) => {
  const input = businessInventoryTemplateReviewRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const templateId = req.params.templateId;
  if (!businessProfileId || !templateId) return res.status(400).json({ error: 'business_template_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canSubmitBusinessTemplates(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_template_submitter_required', message: 'Only business owners and admins can submit library items for review.' });
  if (!canMutateBusinessTemplateProfile(businessProfile)) return res.status(403).json({ error: 'business_profile_not_allowed', message: 'This Business profile cannot submit library items.' });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryTemplate.findFirst({ where: { id: templateId, businessProfileId }, include: businessTemplateInclude });
    if (!existing) return null;
    if (existing.status === 'active') return { status: 409 as const, error: 'business_template_already_approved' };
    const updated = await tx.inventoryTemplate.update({ where: { id: existing.id }, data: { status: 'pending_review' as any }, include: businessTemplateInclude });
    await writeTeamAuditLog(tx, {
      businessProfileId,
      actorId: req.user!.id,
      action: 'business_inventory_template_submitted_for_review',
      note: input.note,
      previousValue: { templateId: existing.id, status: existing.status },
      nextValue: { templateId: updated.id, status: updated.status },
    });
    return { status: 200 as const, template: updated };
  });

  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business library item not found.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: 'This Business library item is already approved.' });
  res.json({ template: await withOneMedia('inventory_template', result.template, 'admin') });
}));

businessRoutes.post('/:businessProfileId/templates/:templateId/archive', asyncRoute(async (req, res) => {
  const input = businessInventoryTemplateArchiveRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  const templateId = req.params.templateId;
  if (!businessProfileId || !templateId) return res.status(400).json({ error: 'business_template_id_required' });
  const businessProfile = await findAccessibleTeamBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (!canSubmitBusinessTemplates(businessProfile, req.user!.id)) return res.status(403).json({ error: 'business_template_submitter_required', message: 'Only business owners and admins can archive library items.' });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryTemplate.findFirst({ where: { id: templateId, businessProfileId }, include: businessTemplateInclude });
    if (!existing) return null;
    const updated = await tx.inventoryTemplate.update({ where: { id: existing.id }, data: { status: 'archived' as any }, include: businessTemplateInclude });
    await writeTeamAuditLog(tx, {
      businessProfileId,
      actorId: req.user!.id,
      action: 'business_inventory_template_archived',
      note: input.note ?? null,
      previousValue: { templateId: existing.id, status: existing.status },
      nextValue: { templateId: updated.id, status: updated.status },
    });
    return updated;
  });

  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business library item not found.' });
  res.json({ template: await withOneMedia('inventory_template', result, 'admin') });
}));

businessRoutes.post('/:businessProfileId/request-review', asyncRoute(async (req, res) => {
  const input = requestBusinessReviewRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const existing = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (existing.ownerId !== req.user!.id) return res.status(403).json({ error: 'business_owner_required', message: 'Only the business owner can request review.' });
  const businessProfile = await prisma.businessProfile.update({
    where: { id: existing.id },
    data: { status: 'pending_review', reviewNote: input.note ?? existing.reviewNote },
    include: businessInclude,
  });
  res.json({ businessProfile: normalizeProfile(businessProfile) });
}));

businessRoutes.get('/:businessProfileId/provider-account', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const existing = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const provider = getActiveMoneyProvider();
  const account = await provider.getConnectedAccount(req.user!.id, existing.id);
  res.json({ provider: provider.getPublicStatus(), account });
}));

businessRoutes.post('/:businessProfileId/provider-account/onboarding-link', requireFreshSensitiveAction, asyncRoute(async (req, res) => {
  const input = businessProviderOnboardingLinkRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const existing = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const provider = getActiveMoneyProvider();
  try {
    const result = await provider.createOnboardingLink({ userId: req.user!.id, businessProfileId: existing.id, accountType: input.accountType ?? (existing.type === 'brand' ? 'brand' : 'business'), refreshUrl: input.refreshUrl, returnUrl: input.returnUrl });
    res.status(201).json({ ...result, providerConfigured: provider.isConfigured() });
  } catch (error) {
    return providerError(res, error);
  }
}));

businessRoutes.post('/:businessProfileId/provider-account/sync', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const existing = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const provider = getActiveMoneyProvider();
  try {
    const account = await provider.syncConnectedAccountStatus({ userId: req.user!.id, businessProfileId: existing.id });
    res.json({ provider: provider.getPublicStatus(), account });
  } catch (error) {
    return providerError(res, error);
  }
}));
