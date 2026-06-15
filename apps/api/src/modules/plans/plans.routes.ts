import { Router } from 'express';
import {
  createPlanJoinRequestSchema,
  createPlanPlaceRequestSchema,
  createPlanRequestSchema,
  listPlansQuerySchema,
  updateMyPlanParticipantRequestSchema,
  updatePlanParticipantRequestSchema,
  updatePlanPlaceRequestSchema,
  updatePlanRequestSchema,
} from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { attachUploadedMediaToEntity, withMedia } from '../media/media.helpers.js';
import { stripAnonymousPublicProfileMedia } from '../users/publicUser.js';
import { usersHaveBlockBetween } from '../users/userBlocks.js';

export const plansRoutes = Router();

const publicPlanStatuses = ['open', 'full', 'started'] as const;
const userSummarySelect = {
  id: true,
  profile: { select: { displayName: true, handle: true, avatarUrl: true, countryCode: true } },
} as const;

function cleanTags(value: string[] | undefined) {
  return Array.from(new Set(value ?? [])).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function planInclude() {
  return {
    owner: { select: userSummarySelect },
    places: { orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }] },
    participants: { include: { user: { select: userSummarySelect } }, orderBy: { createdAt: 'asc' as const } },
  };
}

async function blockedUserIdsForViewer(viewerId?: string) {
  if (!viewerId) return [];
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  return Array.from(new Set(blocks.map((block) => block.blockerId === viewerId ? block.blockedId : block.blockerId)));
}

async function syncPlanCapacityStatus(planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, status: true, maxParticipants: true } });
  if (!plan?.maxParticipants || !['open', 'full'].includes(plan.status as string)) return;
  const acceptedCount = await prisma.planParticipant.count({ where: { planId, status: 'accepted' as any } });
  if (acceptedCount >= plan.maxParticipants && plan.status === 'open') {
    await prisma.plan.update({ where: { id: planId }, data: { status: 'full' as any } });
  }
  if (acceptedCount < plan.maxParticipants && plan.status === 'full') {
    await prisma.plan.update({ where: { id: planId }, data: { status: 'open' as any } });
  }
}

async function decoratePlan(plan: any, viewerId?: string | null) {
  const publicMediaVisibility = viewerId ? 'public' : 'public_anonymous';
  const [withPlanMedia] = await withMedia('plan' as any, [plan], publicMediaVisibility);
  const places = await withMedia('plan_place' as any, plan.places ?? [], publicMediaVisibility);
  return serializePlan({ ...withPlanMedia, places }, viewerId ?? null);
}

async function decoratePlans(plans: any[], viewerId?: string | null) {
  const publicMediaVisibility = viewerId ? 'public' : 'public_anonymous';
  const planMediaMap = await withMedia('plan' as any, plans, publicMediaVisibility);
  const allPlaces = plans.flatMap((plan) => plan.places ?? []);
  const placeMedia = await withMedia('plan_place' as any, allPlaces, publicMediaVisibility);
  const placeById = new Map(placeMedia.map((place: any) => [place.id, place]));
  return planMediaMap.map((plan: any) => serializePlan({ ...plan, places: (plan.places ?? []).map((place: any) => placeById.get(place.id) ?? place) }, viewerId ?? null));
}

function serializePlan(plan: any, viewerId: string | null) {
  const isOwner = Boolean(viewerId && plan.ownerId === viewerId);
  const myParticipant = viewerId ? (plan.participants ?? []).find((participant: any) => participant.userId === viewerId) : null;
  const canSeePrivatePlaceDetails = isOwner || myParticipant?.status === 'accepted';
  const acceptedParticipants = (plan.participants ?? []).filter((participant: any) => participant.status === 'accepted');
  const pendingParticipants = (plan.participants ?? []).filter((participant: any) => participant.status === 'pending');
  const visibleParticipants = isOwner
    ? (plan.participants ?? [])
    : [...acceptedParticipants, ...(myParticipant && myParticipant.status !== 'accepted' ? [myParticipant] : [])];

  return {
    ...plan,
    places: (plan.places ?? []).map((place: any) => ({
      ...place,
      mode: place.mode ?? 'local',
      addressPrivateText: canSeePrivatePlaceDetails ? place.addressPrivateText ?? null : null,
    })),
    participants: visibleParticipants,
    participantCount: acceptedParticipants.length,
    pendingRequestCount: isOwner ? pendingParticipants.length : undefined,
    myParticipantStatus: myParticipant?.status ?? null,
    canSeePrivatePlaceDetails,
  };
}

async function loadPlanForViewer(planId: string, viewerId?: string | null) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: planInclude() });
  if (!plan) return null;
  if (!viewerId || plan.ownerId !== viewerId) {
    if (!publicPlanStatuses.includes(plan.status as any)) return null;
  }
  const isOwner = Boolean(viewerId && plan.ownerId === viewerId);
  if (!isOwner) {
    const owner = await prisma.user.findUnique({ where: { id: plan.ownerId }, select: { trustTier: true } });
    if (!owner || owner.trustTier === 'restricted') return null;
  }
  if (viewerId && plan.ownerId !== viewerId && await usersHaveBlockBetween(viewerId, plan.ownerId)) return null;
  return decoratePlan(plan, viewerId ?? null);
}

function planCreateData(ownerId: string, input: ReturnType<typeof createPlanRequestSchema.parse>) {
  return {
    ownerId,
    title: input.title,
    description: input.description,
    category: input.category ?? null,
    tags: cleanTags(input.tags),
    mode: input.mode ?? null,
    locationLabel: input.locationLabel ?? null,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    maxParticipants: input.maxParticipants ?? null,
    joinApprovalMode: input.joinApprovalMode ?? 'automatic',
    status: input.status ?? 'open',
  };
}

function planUpdateData(input: ReturnType<typeof updatePlanRequestSchema.parse>) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.tags !== undefined ? { tags: cleanTags(input.tags) } : {}),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.locationLabel !== undefined ? { locationLabel: input.locationLabel } : {}),
    ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
    ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
    ...(input.maxParticipants !== undefined ? { maxParticipants: input.maxParticipants } : {}),
    ...(input.joinApprovalMode !== undefined ? { joinApprovalMode: input.joinApprovalMode } : {}),
    ...(input.status !== undefined ? {
      status: input.status,
      cancelledAt: input.status === 'cancelled' ? new Date() : null,
    } : {}),
  };
}

function placeCreateData(planId: string, input: ReturnType<typeof createPlanPlaceRequestSchema.parse>, fallbackOrder = 0) {
  return {
    planId,
    order: input.order ?? fallbackOrder,
    mode: input.mode ?? 'local',
    title: input.title,
    note: input.note ?? null,
    addressPublicText: input.addressPublicText ?? null,
    addressPrivateText: input.addressPrivateText ?? null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
  };
}

function placeUpdateData(input: ReturnType<typeof updatePlanPlaceRequestSchema.parse>) {
  return {
    ...(input.order !== undefined ? { order: input.order } : {}),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.addressPublicText !== undefined ? { addressPublicText: input.addressPublicText } : {}),
    ...(input.addressPrivateText !== undefined ? { addressPrivateText: input.addressPrivateText } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
    ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
  };
}

plansRoutes.get('/feed', optionalAuth, asyncRoute(async (req, res) => {
  const input = listPlansQuerySchema.parse(req.query ?? {});
  const blockedOwnerIds = await blockedUserIdsForViewer(req.user?.id);
  const plans = await prisma.plan.findMany({
    where: {
      status: input.status ?? { in: [...publicPlanStatuses] },
      ...(input.q ? { OR: [{ title: { contains: input.q, mode: 'insensitive' as const } }, { description: { contains: input.q, mode: 'insensitive' as const } }] } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.city ? { locationLabel: { contains: input.city, mode: 'insensitive' as const } } : {}),
      owner: { trustTier: { not: 'restricted' } },
      ...(blockedOwnerIds.length > 0 ? { ownerId: { notIn: blockedOwnerIds } } : {}),
    },
    include: planInclude(),
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
    take: input.take ?? 50,
  });
  res.json(stripAnonymousPublicProfileMedia({ plans: await decoratePlans(plans, req.user?.id ?? null) }, req.user?.id));
}));

plansRoutes.get('/mine', requireAuth, asyncRoute(async (req, res) => {
  const plans = await prisma.plan.findMany({
    where: { ownerId: req.user!.id },
    include: planInclude(),
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });
  res.json({ plans: await decoratePlans(plans, req.user!.id) });
}));

plansRoutes.post('/', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createPlanRequestSchema.parse(req.body ?? {});
  const plan = await prisma.plan.create({ data: planCreateData(req.user!.id, input) as any });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'plan' as any, plan.id);

  for (const [index, placeInput] of (input.places ?? []).entries()) {
    const place = await prisma.planPlace.create({ data: placeCreateData(plan.id, placeInput, index) as any });
    await attachUploadedMediaToEntity(req.user!.id, placeInput.mediaIds, 'plan_place' as any, place.id);
  }

  const created = await prisma.plan.findUnique({ where: { id: plan.id }, include: planInclude() });
  res.status(201).json({ plan: await decoratePlan(created, req.user!.id) });
}));

plansRoutes.patch('/:planId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updatePlanRequestSchema.parse(req.body ?? {});
  const existing = await prisma.plan.findFirst({ where: { id: req.params.planId, ownerId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const plan = await prisma.plan.update({ where: { id: existing.id }, data: planUpdateData(input) as any });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'plan' as any, plan.id);
  if (input.maxParticipants !== undefined || input.status !== undefined) await syncPlanCapacityStatus(plan.id);
  const updated = await prisma.plan.findUnique({ where: { id: plan.id }, include: planInclude() });
  res.json({ plan: await decoratePlan(updated, req.user!.id) });
}));

plansRoutes.post('/:planId/places', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createPlanPlaceRequestSchema.parse(req.body ?? {});
  const plan = await prisma.plan.findFirst({ where: { id: req.params.planId, ownerId: req.user!.id } });
  if (!plan) return res.status(404).json({ error: 'not_found' });
  const existingCount = await prisma.planPlace.count({ where: { planId: plan.id } });
  if (existingCount >= 12) return res.status(409).json({ error: 'too_many_places', message: 'A plan can include up to 12 places for now.' });
  const place = await prisma.planPlace.create({ data: placeCreateData(plan.id, input, existingCount) as any });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'plan_place' as any, place.id);
  const updated = await prisma.plan.findUnique({ where: { id: plan.id }, include: planInclude() });
  res.status(201).json({ plan: await decoratePlan(updated, req.user!.id) });
}));

plansRoutes.patch('/:planId/places/:placeId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updatePlanPlaceRequestSchema.parse(req.body ?? {});
  const plan = await prisma.plan.findFirst({ where: { id: req.params.planId, ownerId: req.user!.id } });
  if (!plan) return res.status(404).json({ error: 'not_found' });
  const place = await prisma.planPlace.findFirst({ where: { id: req.params.placeId, planId: plan.id } });
  if (!place) return res.status(404).json({ error: 'not_found' });
  await prisma.planPlace.update({ where: { id: place.id }, data: placeUpdateData(input) as any });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'plan_place' as any, place.id);
  const updated = await prisma.plan.findUnique({ where: { id: plan.id }, include: planInclude() });
  res.json({ plan: await decoratePlan(updated, req.user!.id) });
}));

plansRoutes.post('/:planId/join-requests', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createPlanJoinRequestSchema.parse(req.body ?? {});
  const plan = await prisma.plan.findUnique({ where: { id: req.params.planId }, include: { participants: true, owner: { select: { trustTier: true } } } });
  if (!plan || !publicPlanStatuses.includes(plan.status as any) || plan.owner?.trustTier === 'restricted') return res.status(404).json({ error: 'not_found' });
  if (plan.ownerId === req.user!.id) return res.status(409).json({ error: 'owner_cannot_join', message: 'You already own this plan.' });
  if (await usersHaveBlockBetween(req.user!.id, plan.ownerId)) return res.status(403).json({ error: 'blocked_user', message: 'You cannot request to join this plan.' });
  const existing = (plan.participants ?? []).find((participant: any) => participant.userId === req.user!.id);
  if (existing?.status === 'accepted') return res.status(409).json({ error: 'already_joined', message: 'You already joined this plan.' });
  if (existing?.status === 'removed') return res.status(403).json({ error: 'participant_removed', message: 'The owner removed you from this plan.' });

  const participant = await prisma.planParticipant.upsert({
    where: { planId_userId: { planId: plan.id, userId: req.user!.id } },
    update: { message: input.message?.trim() || null, status: 'accepted' as any, decidedAt: new Date(), decidedById: plan.ownerId },
    create: { planId: plan.id, userId: req.user!.id, message: input.message?.trim() || null, status: 'accepted' as any, decidedAt: new Date(), decidedById: plan.ownerId },
    include: { user: { select: userSummarySelect } },
  });
  await syncPlanCapacityStatus(plan.id);
  res.status(201).json({ participant });
}));

plansRoutes.get('/:planId/join-requests', requireAuth, asyncRoute(async (req, res) => {
  const plan = await prisma.plan.findFirst({ where: { id: req.params.planId, ownerId: req.user!.id } });
  if (!plan) return res.status(404).json({ error: 'not_found' });
  const participants = await prisma.planParticipant.findMany({ where: { planId: plan.id }, include: { user: { select: userSummarySelect } }, orderBy: { createdAt: 'asc' } });
  res.json({ participants });
}));

plansRoutes.patch('/:planId/join-requests/:participantId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updatePlanParticipantRequestSchema.parse(req.body ?? {});
  const plan = await prisma.plan.findFirst({ where: { id: req.params.planId, ownerId: req.user!.id }, include: { participants: true } });
  if (!plan) return res.status(404).json({ error: 'not_found' });
  const participant = (plan.participants ?? []).find((item: any) => item.id === req.params.participantId);
  if (!participant) return res.status(404).json({ error: 'not_found' });
  if (input.status === 'accepted') {
    if (await usersHaveBlockBetween(req.user!.id, participant.userId)) return res.status(403).json({ error: 'blocked_user', message: 'You cannot accept this join request.' });
    const acceptedCount = (plan.participants ?? []).filter((item: any) => item.status === 'accepted').length;
    if (plan.maxParticipants && acceptedCount >= plan.maxParticipants && participant.status !== 'accepted') return res.status(409).json({ error: 'plan_full', message: 'This plan is full.' });
  }
  const updated = await prisma.planParticipant.update({
    where: { id: participant.id },
    data: { status: input.status as any, decidedAt: new Date(), decidedById: req.user!.id },
    include: { user: { select: userSummarySelect } },
  });
  if (['accepted', 'removed'].includes(input.status)) await syncPlanCapacityStatus(plan.id);
  res.json({ participant: updated });
}));

plansRoutes.patch('/:planId/my-join-request', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const planId = req.params.planId;
  if (!planId) return res.status(400).json({ error: 'missing_plan_id' });
  const input = updateMyPlanParticipantRequestSchema.parse(req.body ?? {});
  const participant = await prisma.planParticipant.findUnique({ where: { planId_userId: { planId, userId: req.user!.id } } });
  if (!participant) return res.status(404).json({ error: 'not_found' });
  if (input.status === 'cancelled' && participant.status !== 'pending') return res.status(409).json({ error: 'cannot_cancel_join_request', message: 'Only pending join requests can be cancelled.' });
  if (input.status === 'left' && participant.status !== 'accepted') return res.status(409).json({ error: 'cannot_leave_plan', message: 'Only accepted participants can leave a plan.' });
  const updated = await prisma.planParticipant.update({ where: { id: participant.id }, data: { status: input.status as any }, include: { user: { select: userSummarySelect } } });
  if (input.status === 'left') await syncPlanCapacityStatus(planId);
  res.json({ participant: updated });
}));

plansRoutes.get('/:planId', optionalAuth, asyncRoute(async (req, res) => {
  const planId = req.params.planId;
  if (!planId) return res.status(400).json({ error: 'missing_plan_id' });
  const plan = await loadPlanForViewer(planId, req.user?.id ?? null);
  if (!plan) return res.status(404).json({ error: 'not_found' });
  res.json(stripAnonymousPublicProfileMedia({ plan }, req.user?.id));
}));
