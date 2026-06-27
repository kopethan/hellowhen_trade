import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { evaluatePlusGate } from '@hellowhen/shared';
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
import { syncInventoryTranslations, withInventoryTranslations, withOneInventoryTranslation } from '../inventoryTranslations.js';
import { usersHaveBlockBetween } from '../users/userBlocks.js';
import { loadMembershipAccessStateForUser } from '../subscriptions/membershipEntitlements.js';
import { plusConfigSnapshot } from '../subscriptions/plus.routes.js';

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
      ],
    } : {}),
    ...(input.mode ? { mode: input.mode as any } : {}),
    ...(input.category ? { category: input.category } : {}),
  };
}

function libraryVisibilityWhere(): Prisma.PlaceWhereInput {
  return { OR: [{ ownerId: null }, { owner: { trustTier: { not: 'restricted' as any } } }] };
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

async function placeMediaLimitFor(actor: { id: string; role: string } | null, source: string) {
  if (source === 'hellowhen_library') return PLAN_PLACE_MEDIA_LIMITS.adminLibrary;
  if (!actor) return PLAN_PLACE_MEDIA_LIMITS.free;
  const accessState = await loadMembershipAccessStateForUser(prisma as any, actor.id);
  const gate = evaluatePlusGate(plusConfigSnapshot(), accessState as any);
  return gate.hasPlusAccess ? PLAN_PLACE_MEDIA_LIMITS.plus : PLAN_PLACE_MEDIA_LIMITS.free;
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

function createPlaceData(ownerId: string, input: ReturnType<typeof createPlaceRequestSchema.parse>, normalized: ReturnType<typeof normalizeCreateInput>) {
  return {
    ownerId: normalized.source === 'user' ? ownerId : normalized.ownerId,
    source: normalized.source as any,
    status: normalized.status as any,
    visibility: normalized.visibility as any,
    mode: input.mode ?? 'local',
    title: input.title,
    description: input.description ?? null,
    defaultLanguage: input.defaultLanguage ?? 'en',
    category: input.category ?? null,
    tags: cleanTags(input.tags),
    areaLabel: input.areaLabel ?? null,
    addressPublicText: input.addressPublicText ?? null,
    addressPrivateText: input.addressPrivateText ?? null,
    onlineLabel: input.onlineLabel ?? null,
    onlineUrl: input.onlineUrl ?? null,
    defaultDurationMinutes: input.defaultDurationMinutes ?? null,
    defaultNote: input.defaultNote ?? null,
    defaultMeetingInstructions: input.defaultMeetingInstructions ?? null,
  };
}

function updatePlaceData(input: ReturnType<typeof updatePlaceRequestSchema.parse>, normalized: ReturnType<typeof normalizeUpdateInput>) {
  const status = normalized.status;
  return {
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description ?? null } : {}),
    ...(input.defaultLanguage !== undefined ? { defaultLanguage: input.defaultLanguage ?? 'en' } : {}),
    ...(input.category !== undefined ? { category: input.category ?? null } : {}),
    ...(input.tags !== undefined ? { tags: cleanTags(input.tags) } : {}),
    ...(input.areaLabel !== undefined ? { areaLabel: input.areaLabel ?? null } : {}),
    ...(input.addressPublicText !== undefined ? { addressPublicText: input.addressPublicText ?? null } : {}),
    ...(input.addressPrivateText !== undefined ? { addressPrivateText: input.addressPrivateText ?? null } : {}),
    ...(input.onlineLabel !== undefined ? { onlineLabel: input.onlineLabel ?? null } : {}),
    ...(input.onlineUrl !== undefined ? { onlineUrl: input.onlineUrl ?? null } : {}),
    ...(input.defaultDurationMinutes !== undefined ? { defaultDurationMinutes: input.defaultDurationMinutes ?? null } : {}),
    ...(input.defaultNote !== undefined ? { defaultNote: input.defaultNote ?? null } : {}),
    ...(input.defaultMeetingInstructions !== undefined ? { defaultMeetingInstructions: input.defaultMeetingInstructions ?? null } : {}),
    ...(normalized.visibility !== undefined ? { visibility: normalized.visibility as any } : {}),
    ...(status !== undefined ? { status: status as any, archivedAt: status === 'archived' ? new Date() : null } : {}),
  };
}

function cleanPlaceForViewer(place: any, viewerId?: string | null, actorRole?: string | null) {
  const isOwner = Boolean(viewerId && place.ownerId === viewerId);
  const isAdmin = actorRole === 'admin';
  const canSeePrivateDetails = isOwner || isAdmin;
  const owner = place.owner ? { ...place.owner, trustTier: undefined } : place.owner;
  return {
    ...place,
    owner,
    mode: place.mode ?? 'local',
    source: place.source ?? 'user',
    visibility: place.visibility ?? (place.source === 'hellowhen_library' ? 'library' : 'private'),
    addressPrivateText: canSeePrivateDetails ? place.addressPrivateText ?? null : null,
    defaultMeetingInstructions: canSeePrivateDetails ? place.defaultMeetingInstructions ?? null : null,
  };
}

async function decoratePlaces(places: any[], viewerId?: string | null, visibility: MediaVisibility = 'owner', actorRole?: string | null) {
  const withTranslations = await withInventoryTranslations(prisma, 'place', places);
  const withPlaceMedia = await withMedia('place' as any, withTranslations, visibility);
  return withPlaceMedia.map((place) => cleanPlaceForViewer(place, viewerId ?? null, actorRole ?? null));
}

async function decoratePlace(place: any, viewerId?: string | null, visibility: MediaVisibility = 'owner', actorRole?: string | null) {
  const withTranslations = await withOneInventoryTranslation(prisma, 'place', place);
  const [decorated] = await decoratePlaces([withTranslations], viewerId, visibility, actorRole);
  return decorated;
}

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
  res.json({ places: await decoratePlaces(places, req.user!.id, 'owner') });
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
  const decorated = await decoratePlaces(places, req.user?.id ?? null, visibility);
  res.json(stripAnonymousPublicProfileMedia({ places: decorated }, req.user?.id));
}));

placesRoutes.post('/', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createPlaceRequestSchema.parse(req.body ?? {});
  const actor = await loadActor(req.user!.id);
  if (!actor) return res.status(401).json({ error: 'unauthorized' });
  const normalized = normalizeCreateInput(input, actor);
  const mediaLimit = await placeMediaLimitFor(actor, normalized.source);
  const place = await prisma.place.create({ data: createPlaceData(req.user!.id, input, normalized) as any, include: placeInclude() });
  await syncInventoryTranslations(prisma, 'place', place.id, req.user!.id, (place as any).defaultLanguage ?? input.defaultLanguage ?? 'en', input.translations ?? []);
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'place' as any, place.id, { maxImages: mediaLimit });
  const created = await prisma.place.findUnique({ where: { id: place.id }, include: placeInclude() });
  res.status(201).json({ place: await decoratePlace(created, req.user!.id, 'owner', actor.role) });
}));

placesRoutes.get('/:placeId', optionalAuth, asyncRoute(async (req, res) => {
  const placeId = req.params.placeId;
  if (!placeId) return res.status(400).json({ error: 'missing_place_id' });
  const place = await loadVisiblePlace(placeId, req.user?.id ?? null);
  if (!place) return res.status(404).json({ error: 'not_found' });
  const actor = req.user?.id ? await loadActor(req.user.id) : null;
  const isOwner = Boolean(req.user?.id && place.ownerId === req.user.id);
  const visibility = isOwner ? 'owner' : req.user?.id ? 'public' : 'public_anonymous';
  const decorated = await decoratePlace(place, req.user?.id ?? null, visibility, actor?.role ?? null);
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
  const normalized = normalizeUpdateInput(input, existing as any, actor);
  const mediaLimit = await placeMediaLimitFor(actor, existing.source);
  const updated = await prisma.place.update({ where: { id: existing.id }, data: updatePlaceData(input, normalized) as any, include: placeInclude() });
  await syncInventoryTranslations(prisma, 'place', updated.id, req.user!.id, (updated as any).defaultLanguage ?? input.defaultLanguage ?? 'en', input.translations);
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'place' as any, updated.id, { maxImages: mediaLimit });
  const refreshed = await prisma.place.findUnique({ where: { id: updated.id }, include: placeInclude() });
  res.json({ place: await decoratePlace(refreshed, req.user!.id, 'owner', actor.role) });
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
  res.json({ place: await decoratePlace(archived, req.user!.id, 'owner', actor.role) });
}));
