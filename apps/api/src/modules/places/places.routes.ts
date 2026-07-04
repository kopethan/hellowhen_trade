import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  buildMissingOfflineProviderAddressMessage,
  buildMissingOnlineDestinationMessage,
  evaluatePlusGate,
  getMissingOfflineProviderAddressFields,
  getMissingOnlineDestinationFields,
  getOnlinePlaceProviderMetadata,
  normalizeContentLanguageOrder,
  normalizeOnlinePlaceUrl,
  PLACE_OFFLINE_MODE,
  PLACE_ONLINE_MODE,
  type ContentLanguageCode,
} from '@hellowhen/shared';
import {
  PLAN_PLACE_MEDIA_LIMITS,
  createPlaceRequestSchema,
  listPlacesQuerySchema,
  updatePlaceRequestSchema,
} from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { attachUploadedMediaToEntity, withMedia, type MediaVisibility } from '../media/media.helpers.js';
import { stripAnonymousPublicProfileMedia } from '../users/publicUser.js';
import { applyInventoryDisplayLanguage, syncInventoryTranslations, withInventoryTranslations, withOneInventoryTranslation } from '../inventoryTranslations.js';
import { usersHaveBlockBetween } from '../users/userBlocks.js';
import { loadMembershipAccessStateForUser } from '../subscriptions/membershipEntitlements.js';
import { plusConfigSnapshot } from '../subscriptions/plus.routes.js';
import { googlePlacesRoutes } from './googlePlaces.routes.js';
import { buildPlaceStaticMapResult } from './placeStaticMap.js';
import { createRandomPlaceStaticMapTemplateAssignment, isPlaceStaticMapTemplateFamily } from './placeStaticMapTemplates.js';

export const placesRoutes = Router();

const userSummarySelect = {
  id: true,
  trustTier: true,
  profile: { select: { displayName: true, handle: true, avatarUrl: true, countryCode: true } },
} as const;

function createPlaceRequestError(code: string, publicMessage: string, statusCode = 400) {
  return Object.assign(new Error(publicMessage), { code, publicMessage, statusCode });
}

function cleanTags(value: string[] | undefined) {
  return Array.from(new Set(value ?? [])).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function hasLocalStaticMapCandidate(input: { mode?: string | null; latitude?: number | null; longitude?: number | null }) {
  if (input.mode === PLACE_ONLINE_MODE) return false;
  return typeof input.latitude === 'number' && typeof input.longitude === 'number';
}

function normalizedOnlineUrl(value?: string | null) {
  return normalizeOnlinePlaceUrl(value) ?? null;
}

function onlineProviderFor(value?: string | null) {
  return getOnlinePlaceProviderMetadata(value);
}

function assertReusablePlaceAddressPolicy(input: ReturnType<typeof createPlaceRequestSchema.parse> | ReturnType<typeof updatePlaceRequestSchema.parse>) {
  const mode = input.mode ?? PLACE_OFFLINE_MODE;
  if (mode === PLACE_ONLINE_MODE) {
    const missing = getMissingOnlineDestinationFields(input);
    if (missing.length > 0) {
      throw createPlaceRequestError('missing_online_place_destination', buildMissingOnlineDestinationMessage(missing));
    }
    return;
  }

  const missing = getMissingOfflineProviderAddressFields(input);
  if (missing.length > 0) {
    throw createPlaceRequestError('missing_offline_provider_address', buildMissingOfflineProviderAddressMessage(missing));
  }
}

function mergePlaceUpdateForAddressPolicy(existing: any, input: ReturnType<typeof updatePlaceRequestSchema.parse>) {
  const nextMode = input.mode ?? existing.mode ?? PLACE_OFFLINE_MODE;
  if (nextMode === PLACE_ONLINE_MODE) {
    return {
      mode: nextMode,
      onlineLabel: input.onlineLabel ?? existing.onlineLabel ?? null,
      onlineUrl: input.onlineUrl ?? existing.onlineUrl ?? null,
    };
  }

  return {
    mode: nextMode,
    googlePlaceId: input.googlePlaceId ?? existing.googlePlaceId ?? null,
    googlePlaceName: input.googlePlaceName ?? existing.googlePlaceName ?? null,
    formattedAddress: input.formattedAddress ?? existing.formattedAddress ?? null,
    googleMapsUri: input.googleMapsUri ?? existing.googleMapsUri ?? null,
    latitude: input.latitude ?? existing.latitude ?? null,
    longitude: input.longitude ?? existing.longitude ?? null,
    locationSource: input.locationSource ?? existing.locationSource ?? null,
    addressValidationStatus: input.addressValidationStatus ?? existing.addressValidationStatus ?? null,
  };
}

function placeStaticMapTemplateCreateData(input: ReturnType<typeof createPlaceRequestSchema.parse>, canChooseTemplate: boolean) {
  if (input.staticMapTemplateFamily) {
    if (!canChooseTemplate) {
      throw createPlaceRequestError('plus_template_required', 'Manual Place map templates are available with Plus customization.', 403);
    }
    if (!isPlaceStaticMapTemplateFamily(input.staticMapTemplateFamily)) return {};
    return {
      staticMapTemplateFamily: input.staticMapTemplateFamily,
      staticMapTemplateSeed: `manual:${input.staticMapTemplateFamily}`,
    };
  }
  if (input.staticMapTemplateFamily === null) return { staticMapTemplateFamily: null, staticMapTemplateSeed: null };
  if (input.mediaIds?.length) return {};
  if (!hasLocalStaticMapCandidate(input)) return {};
  return createRandomPlaceStaticMapTemplateAssignment('place');
}

function placeStaticMapTemplateUpdateData(input: ReturnType<typeof updatePlaceRequestSchema.parse>, canChooseTemplate: boolean) {
  if (input.staticMapTemplateFamily === undefined) return {};
  if (input.staticMapTemplateFamily === null) return { staticMapTemplateFamily: null, staticMapTemplateSeed: null };
  if (!canChooseTemplate) {
    throw createPlaceRequestError('plus_template_required', 'Manual Place map templates are available with Plus customization.', 403);
  }
  if (!isPlaceStaticMapTemplateFamily(input.staticMapTemplateFamily)) return {};
  return {
    staticMapTemplateFamily: input.staticMapTemplateFamily,
    staticMapTemplateSeed: `manual:${input.staticMapTemplateFamily}`,
  };
}

function placeInclude() {
  return { owner: { select: userSummarySelect } } satisfies Prisma.PlaceInclude;
}

function placeSearchWhere(input: ReturnType<typeof listPlacesQuerySchema.parse>): Prisma.PlaceWhereInput {
  return {
    ...(input.q ? {
      OR: [
        { title: { contains: input.q, mode: 'insensitive' as const } },
        { description: { contains: input.q, mode: 'insensitive' as const } },
        { areaLabel: { contains: input.q, mode: 'insensitive' as const } },
        { addressPublicText: { contains: input.q, mode: 'insensitive' as const } },
        { formattedAddress: { contains: input.q, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(input.mode ? { mode: input.mode as any } : {}),
    ...(input.category ? { category: input.category } : {}),
  };
}

function libraryVisibilityWhere(): Prisma.PlaceWhereInput {
  return { OR: [{ ownerId: null }, { owner: { trustTier: { not: 'restricted' as any } } }] };
}

function normalizeRouteLanguage(value?: string | null): ContentLanguageCode | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'system') return null;
  const base = normalized.replace('_', '-').split('-')[0];
  return base === 'fr' || base === 'en' || base === 'es' ? base : null;
}

function languageFromAcceptLanguage(value: unknown): ContentLanguageCode | null {
  if (typeof value !== 'string') return null;
  for (const candidate of value.split(',').map((entry) => entry.split(';')[0]?.trim()).filter(Boolean)) {
    const language = normalizeRouteLanguage(candidate);
    if (language) return language;
  }
  return null;
}

async function resolveContentLanguagePreferences(viewerId: string | undefined, acceptLanguageHeader: unknown) {
  const settings = viewerId
    ? await prisma.userSettings.findUnique({ where: { userId: viewerId }, select: { language: true, contentLanguageOrder: true } })
    : null;
  const language = normalizeRouteLanguage(settings?.language) ?? languageFromAcceptLanguage(acceptLanguageHeader) ?? 'en';
  return {
    language,
    contentLanguageOrder: normalizeContentLanguageOrder({
      viewerLanguage: language,
      preferredLanguages: Array.isArray(settings?.contentLanguageOrder) ? settings.contentLanguageOrder as string[] : null,
      defaultLanguage: 'en',
    }),
  };
}

function canManageLibraryPlace(actor: { role: string } | null | undefined) {
  return actor?.role === 'admin';
}

async function loadActor(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
}

async function placeMembershipGate(actor: { id: string; role: string } | null) {
  if (!actor) return evaluatePlusGate(plusConfigSnapshot(), null as any);
  const accessState = await loadMembershipAccessStateForUser(prisma as any, actor.id);
  return evaluatePlusGate(plusConfigSnapshot(), accessState as any);
}

async function placeMediaLimitFor(actor: { id: string; role: string } | null, source: string) {
  if (source === 'hellowhen_library') return PLAN_PLACE_MEDIA_LIMITS.adminLibrary;
  const gate = await placeMembershipGate(actor);
  return gate.hasPlusAccess ? PLAN_PLACE_MEDIA_LIMITS.plus : PLAN_PLACE_MEDIA_LIMITS.free;
}

async function canChoosePlaceStaticMapTemplate(actor: { id: string; role: string } | null, source: string) {
  if (source === 'hellowhen_library') return Boolean(actor && canManageLibraryPlace(actor));
  const gate = await placeMembershipGate(actor);
  return Boolean(gate.entitlements.customization);
}

function normalizeCreateInput(input: ReturnType<typeof createPlaceRequestSchema.parse>, actor: { role: string }) {
  const source = input.source ?? 'user';
  if (source === 'hellowhen_library') {
    if (!canManageLibraryPlace(actor)) {
      throw createPlaceRequestError('library_place_admin_required', 'Only admins can create Hellowhen library places.', 403);
    }
    return {
      source,
      ownerId: null,
      visibility: input.visibility ?? 'library',
      status: input.status ?? 'active',
    };
  }

  if (input.visibility === 'library') {
    throw createPlaceRequestError('library_visibility_admin_required', 'Only Hellowhen library places can use library visibility.', 403);
  }

  return {
    source: 'user',
    ownerId: undefined,
    visibility: input.visibility ?? 'private',
    status: input.status ?? 'active',
  };
}

function normalizeUpdateInput(input: ReturnType<typeof updatePlaceRequestSchema.parse>, existing: { source: string }, actor: { role: string }) {
  if (existing.source === 'hellowhen_library' && !canManageLibraryPlace(actor)) {
    throw createPlaceRequestError('library_place_admin_required', 'Only admins can update Hellowhen library places.', 403);
  }

  if (existing.source !== 'hellowhen_library' && input.visibility === 'library') {
    throw createPlaceRequestError('library_visibility_admin_required', 'Only Hellowhen library places can use library visibility.', 403);
  }

  return {
    visibility: input.visibility,
    status: input.status,
  };
}

function createPlaceData(ownerId: string, input: ReturnType<typeof createPlaceRequestSchema.parse>, normalized: ReturnType<typeof normalizeCreateInput>, staticMapTemplateData: Record<string, unknown>) {
  const mode = input.mode ?? PLACE_OFFLINE_MODE;
  const isOnline = mode === PLACE_ONLINE_MODE;
  return {
    ownerId: normalized.source === 'user' ? ownerId : normalized.ownerId,
    source: normalized.source as any,
    status: normalized.status as any,
    visibility: normalized.visibility as any,
    mode,
    title: input.title,
    description: input.description ?? null,
    defaultLanguage: input.defaultLanguage ?? 'en',
    category: input.category ?? null,
    tags: cleanTags(input.tags),
    areaLabel: isOnline ? null : input.areaLabel ?? null,
    addressPublicText: isOnline ? null : input.formattedAddress ?? null,
    addressPrivateText: isOnline ? null : input.addressPrivateText ?? null,
    googlePlaceId: isOnline ? null : input.googlePlaceId ?? null,
    googlePlaceName: isOnline ? null : input.googlePlaceName ?? null,
    formattedAddress: isOnline ? null : input.formattedAddress ?? null,
    googleMapsUri: isOnline ? null : input.googleMapsUri ?? null,
    latitude: isOnline ? null : input.latitude ?? null,
    longitude: isOnline ? null : input.longitude ?? null,
    locationSource: isOnline ? null : input.locationSource ?? null,
    addressValidationStatus: isOnline ? null : input.addressValidationStatus ?? null,
    onlineLabel: isOnline ? input.onlineLabel ?? null : null,
    onlineUrl: isOnline ? normalizedOnlineUrl(input.onlineUrl) : null,
    defaultDurationMinutes: input.defaultDurationMinutes ?? null,
    defaultNote: input.defaultNote ?? null,
    defaultMeetingInstructions: input.defaultMeetingInstructions ?? null,
    ...staticMapTemplateData,
  };
}

function updatePlaceData(input: ReturnType<typeof updatePlaceRequestSchema.parse>, normalized: ReturnType<typeof normalizeUpdateInput>, staticMapTemplateData: Record<string, unknown>): Prisma.PlaceUpdateInput {
  const status = normalized.status;
  const switchesToOnline = input.mode === PLACE_ONLINE_MODE;
  const data = { ...staticMapTemplateData } as Prisma.PlaceUpdateInput;

  if (input.mode !== undefined) data.mode = input.mode as any;
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description ?? null;
  if (input.defaultLanguage !== undefined) data.defaultLanguage = input.defaultLanguage ?? 'en';
  if (input.category !== undefined) data.category = input.category ?? null;
  if (input.tags !== undefined) data.tags = cleanTags(input.tags);

  if (switchesToOnline) {
    data.areaLabel = null;
    data.addressPublicText = null;
    data.addressPrivateText = null;
    data.googlePlaceId = null;
    data.googlePlaceName = null;
    data.formattedAddress = null;
    data.googleMapsUri = null;
    data.latitude = null;
    data.longitude = null;
    data.locationSource = null;
    data.addressValidationStatus = null;
  } else {
    if (input.areaLabel !== undefined) data.areaLabel = input.areaLabel ?? null;
    if (input.formattedAddress !== undefined) data.addressPublicText = input.formattedAddress ?? null;
    if (input.addressPrivateText !== undefined) data.addressPrivateText = input.addressPrivateText ?? null;
    if (input.googlePlaceId !== undefined) data.googlePlaceId = input.googlePlaceId ?? null;
    if (input.googlePlaceName !== undefined) data.googlePlaceName = input.googlePlaceName ?? null;
    if (input.formattedAddress !== undefined) data.formattedAddress = input.formattedAddress ?? null;
    if (input.googleMapsUri !== undefined) data.googleMapsUri = input.googleMapsUri ?? null;
    if (input.latitude !== undefined) data.latitude = input.latitude ?? null;
    if (input.longitude !== undefined) data.longitude = input.longitude ?? null;
    if (input.locationSource !== undefined) data.locationSource = input.locationSource ?? null;
    if (input.addressValidationStatus !== undefined) data.addressValidationStatus = input.addressValidationStatus ?? null;
  }

  if (input.mode === PLACE_OFFLINE_MODE) {
    data.onlineLabel = null;
    data.onlineUrl = null;
  } else {
    if (input.onlineLabel !== undefined) data.onlineLabel = input.onlineLabel ?? null;
    if (input.onlineUrl !== undefined) data.onlineUrl = normalizedOnlineUrl(input.onlineUrl);
  }
  if (input.defaultDurationMinutes !== undefined) data.defaultDurationMinutes = input.defaultDurationMinutes ?? null;
  if (input.defaultNote !== undefined) data.defaultNote = input.defaultNote ?? null;
  if (input.defaultMeetingInstructions !== undefined) data.defaultMeetingInstructions = input.defaultMeetingInstructions ?? null;
  if (normalized.visibility !== undefined) data.visibility = normalized.visibility as any;
  if (status !== undefined) {
    data.status = status as any;
    data.archivedAt = status === 'archived' ? new Date() : null;
  }

  return data;
}

function isArchiveOnlyPlaceUpdate(input: ReturnType<typeof updatePlaceRequestSchema.parse>) {
  const keys = Object.keys(input);
  return keys.length === 1 && input.status === 'archived';
}

async function loadPlaceUsageCounts(placeIds: string[]) {
  const ids = Array.from(new Set(placeIds.filter(Boolean)));
  if (!ids.length) return new Map<string, number>();
  const rows = await prisma.planPlace.groupBy({
    by: ['placeId'],
    where: { placeId: { in: ids } },
    _count: { _all: true },
  } as any);
  return new Map((rows as any[]).map((row) => [row.placeId, row._count?._all ?? 0]));
}

async function placeUsedInPlansCount(placeId: string) {
  const counts = await loadPlaceUsageCounts([placeId]);
  return counts.get(placeId) ?? 0;
}

function cleanPlaceForViewer(place: any, viewerId?: string | null, actorRole?: string | null, surface: 'detail' | 'list' | 'preview' = 'detail') {
  const isOwner = Boolean(viewerId && place.ownerId === viewerId);
  const isAdmin = actorRole === 'admin';
  const canSeePrivateDetails = isOwner || isAdmin;
  const owner = place.owner ? { ...place.owner, trustTier: undefined } : place.owner;
  const cleaned = {
    ...place,
    owner,
    mode: place.mode ?? 'local',
    source: place.source ?? 'user',
    visibility: place.visibility ?? (place.source === 'hellowhen_library' ? 'library' : 'private'),
    addressPrivateText: canSeePrivateDetails ? place.addressPrivateText ?? null : null,
    defaultMeetingInstructions: canSeePrivateDetails ? place.defaultMeetingInstructions ?? null : null,
    usedInPlansCount: canSeePrivateDetails ? place.usedInPlansCount ?? 0 : undefined,
  };
  const onlineProvider = cleaned.mode === PLACE_ONLINE_MODE ? onlineProviderFor(cleaned.onlineUrl) : null;
  const staticMapResult = buildPlaceStaticMapResult(cleaned, { viewerId, surface });
  return { ...cleaned, onlineProvider, staticMap: staticMapResult.staticMap, staticMapStatus: staticMapResult.staticMapStatus };
}

async function decoratePlaces(
  places: any[],
  viewerId?: string | null,
  visibility: MediaVisibility = 'owner',
  actorRole?: string | null,
  languagePreferences?: { language: ContentLanguageCode; contentLanguageOrder: ContentLanguageCode[] },
) {
  const withTranslations = await withInventoryTranslations(prisma, 'place', places);
  const displayReadyPlaces = applyInventoryDisplayLanguage(withTranslations, languagePreferences?.language, languagePreferences?.contentLanguageOrder);
  const withPlaceMedia = await withMedia('place' as any, displayReadyPlaces, visibility);
  const usageCounts = await loadPlaceUsageCounts(withPlaceMedia.map((place: any) => place.id));
  return withPlaceMedia.map((place: any) => cleanPlaceForViewer({ ...place, usedInPlansCount: usageCounts.get(place.id) ?? 0 }, viewerId ?? null, actorRole ?? null, 'list'));
}

async function decoratePlace(
  place: any,
  viewerId?: string | null,
  visibility: MediaVisibility = 'owner',
  actorRole?: string | null,
  languagePreferences?: { language: ContentLanguageCode; contentLanguageOrder: ContentLanguageCode[] },
) {
  const withTranslations = await withOneInventoryTranslation(prisma, 'place', place);
  const [displayReadyPlace] = applyInventoryDisplayLanguage([withTranslations], languagePreferences?.language, languagePreferences?.contentLanguageOrder);
  const [withPlaceMedia] = await withMedia('place' as any, [displayReadyPlace], visibility);
  const usageCounts = await loadPlaceUsageCounts([withPlaceMedia.id]);
  return cleanPlaceForViewer({ ...withPlaceMedia, usedInPlansCount: usageCounts.get(withPlaceMedia.id) ?? 0 }, viewerId ?? null, actorRole ?? null, 'detail');
}

placesRoutes.use('/google', googlePlacesRoutes);

async function loadVisiblePlace(placeId: string, viewerId?: string | null) {
  const place = await prisma.place.findFirst({
    where: {
      id: placeId,
      OR: [
        ...(viewerId ? [{ ownerId: viewerId }] : []),
        { status: 'active' as any, visibility: 'public' as any },
        { status: 'active' as any, source: 'hellowhen_library' as any, visibility: 'library' as any },
      ],
    },
    include: placeInclude(),
  });
  if (!place) return null;
  const owner = place.owner as any;
  const isOwner = Boolean(viewerId && place.ownerId === viewerId);
  if (!isOwner && owner?.trustTier === 'restricted') return null;
  if (!isOwner && viewerId && place.ownerId && await usersHaveBlockBetween(viewerId, place.ownerId)) return null;
  return place;
}

placesRoutes.get('/mine', requireAuth, asyncRoute(async (req, res) => {
  const input = listPlacesQuerySchema.parse(req.query ?? {});
  const places = await prisma.place.findMany({
    where: {
      ownerId: req.user!.id,
      source: 'user' as any,
      status: input.status ?? { in: ['draft', 'active'] as any },
      ...placeSearchWhere(input),
    },
    include: placeInclude(),
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: input.take ?? 100,
  });
  const languagePreferences = await resolveContentLanguagePreferences(req.user!.id, req.headers['accept-language']);
  res.json({ places: await decoratePlaces(places, req.user!.id, 'owner', null, languagePreferences) });
}));

placesRoutes.get('/library', optionalAuth, asyncRoute(async (req, res) => {
  const input = listPlacesQuerySchema.parse(req.query ?? {});
  const places = await prisma.place.findMany({
    where: {
      source: 'hellowhen_library' as any,
      visibility: 'library' as any,
      status: 'active' as any,
      AND: [placeSearchWhere(input), libraryVisibilityWhere()],
    },
    include: placeInclude(),
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: input.take ?? 100,
  });
  const visibility = req.user?.id ? 'public' : 'public_anonymous';
  const languagePreferences = await resolveContentLanguagePreferences(req.user?.id, req.headers['accept-language']);
  const decorated = await decoratePlaces(places, req.user?.id ?? null, visibility, null, languagePreferences);
  res.json(stripAnonymousPublicProfileMedia({ places: decorated }, req.user?.id));
}));

placesRoutes.post('/', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createPlaceRequestSchema.parse(req.body ?? {});
  const actor = await loadActor(req.user!.id);
  if (!actor) return res.status(401).json({ error: 'unauthorized' });
  const normalized = normalizeCreateInput(input, actor);
  const [mediaLimit, canChooseTemplate] = await Promise.all([
    placeMediaLimitFor(actor, normalized.source),
    canChoosePlaceStaticMapTemplate(actor, normalized.source),
  ]);
  assertReusablePlaceAddressPolicy(input);
  const staticMapTemplateData = placeStaticMapTemplateCreateData(input, canChooseTemplate);
  const place = await prisma.place.create({ data: createPlaceData(req.user!.id, input, normalized, staticMapTemplateData) as any, include: placeInclude() });
  await syncInventoryTranslations(prisma, 'place', place.id, req.user!.id, (place as any).defaultLanguage ?? input.defaultLanguage ?? 'en', input.translations ?? []);
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'place' as any, place.id, { maxImages: mediaLimit });
  const created = await prisma.place.findUnique({ where: { id: place.id }, include: placeInclude() });
  const languagePreferences = await resolveContentLanguagePreferences(req.user!.id, req.headers['accept-language']);
  res.status(201).json({ place: await decoratePlace(created, req.user!.id, 'owner', actor.role, languagePreferences) });
}));

placesRoutes.get('/:placeId', optionalAuth, asyncRoute(async (req, res) => {
  const placeId = req.params.placeId;
  if (!placeId) return res.status(400).json({ error: 'missing_place_id' });
  const place = await loadVisiblePlace(placeId, req.user?.id ?? null);
  if (!place) return res.status(404).json({ error: 'not_found' });
  const actor = req.user?.id ? await loadActor(req.user.id) : null;
  const isOwner = Boolean(req.user?.id && place.ownerId === req.user.id);
  const visibility = isOwner ? 'owner' : req.user?.id ? 'public' : 'public_anonymous';
  const languagePreferences = await resolveContentLanguagePreferences(req.user?.id, req.headers['accept-language']);
  const decorated = await decoratePlace(place, req.user?.id ?? null, visibility, actor?.role ?? null, languagePreferences);
  res.json(stripAnonymousPublicProfileMedia({ place: decorated }, req.user?.id));
}));

placesRoutes.patch('/:placeId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updatePlaceRequestSchema.parse(req.body ?? {});
  const actor = await loadActor(req.user!.id);
  if (!actor) return res.status(401).json({ error: 'unauthorized' });
  const existing = await prisma.place.findFirst({
    where: {
      id: req.params.placeId,
      OR: [
        { ownerId: req.user!.id, source: 'user' as any },
        ...(canManageLibraryPlace(actor) ? [{ source: 'hellowhen_library' as any }] : []),
      ],
    },
    include: placeInclude(),
  });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const usedInPlansCount = await placeUsedInPlansCount(existing.id);
  if (existing.source === 'user' && usedInPlansCount > 0 && !isArchiveOnlyPlaceUpdate(input)) {
    return res.status(409).json({
      error: 'place_locked_by_plan',
      message: 'This Place is already used in a Plan. Archive it or create a new Place to change the details.',
      usedInPlansCount,
    });
  }
  const normalized = normalizeUpdateInput(input, existing as any, actor);
  const [mediaLimit, canChooseTemplate] = await Promise.all([
    placeMediaLimitFor(actor, existing.source),
    canChoosePlaceStaticMapTemplate(actor, existing.source),
  ]);
  if (!isArchiveOnlyPlaceUpdate(input)) {
    assertReusablePlaceAddressPolicy(mergePlaceUpdateForAddressPolicy(existing, input));
  }
  const staticMapTemplateData = placeStaticMapTemplateUpdateData(input, canChooseTemplate);
  const updated = await prisma.place.update({ where: { id: existing.id }, data: updatePlaceData(input, normalized, staticMapTemplateData) as any, include: placeInclude() });
  await syncInventoryTranslations(prisma, 'place', updated.id, req.user!.id, (updated as any).defaultLanguage ?? input.defaultLanguage ?? 'en', input.translations);
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'place' as any, updated.id, { maxImages: mediaLimit, syncSelection: input.mediaIds !== undefined });
  const refreshed = await prisma.place.findUnique({ where: { id: updated.id }, include: placeInclude() });
  const languagePreferences = await resolveContentLanguagePreferences(req.user!.id, req.headers['accept-language']);
  res.json({ place: await decoratePlace(refreshed, req.user!.id, 'owner', actor.role, languagePreferences) });
}));

placesRoutes.delete('/:placeId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const actor = await loadActor(req.user!.id);
  if (!actor) return res.status(401).json({ error: 'unauthorized' });
  const existing = await prisma.place.findFirst({
    where: {
      id: req.params.placeId,
      OR: [
        { ownerId: req.user!.id, source: 'user' as any },
        ...(canManageLibraryPlace(actor) ? [{ source: 'hellowhen_library' as any }] : []),
      ],
    },
    include: placeInclude(),
  });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const archived = await prisma.place.update({ where: { id: existing.id }, data: { status: 'archived' as any, archivedAt: new Date() }, include: placeInclude() });
  const languagePreferences = await resolveContentLanguagePreferences(req.user!.id, req.headers['accept-language']);
  res.json({ place: await decoratePlace(archived, req.user!.id, 'owner', actor.role, languagePreferences) });
}));
