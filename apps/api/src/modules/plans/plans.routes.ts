import { Router } from 'express';
import {
  PLAN_PLACE_MEDIA_LIMITS,
  createPlanJoinRequestSchema,
  createPlanPlaceRequestSchema,
  createPlacePresenceVerificationRequestSchema,
  createPlanPublicMessageRequestSchema,
  createPlanRequestSchema,
  listPlanPublicMessagesQuerySchema,
  listMyPlacePresenceVerificationsQuerySchema,
  listPlansQuerySchema,
  updateMyPlanParticipantRequestSchema,
  updatePlanParticipantRequestSchema,
  updatePlanPublicMessageRequestSchema,
  updatePlanRequestSchema,
} from '@hellowhen/contracts';
import {
  buildEstimatedPlanPlaceEndTimes,
  buildGeneratedPlanDisplay,
  findPlanStopStartGapViolation,
  buildMissingOfflineProviderAddressMessage,
  buildMissingOnlineDestinationMessage,
  getMissingOfflineProviderAddressFields,
  getMissingOnlineDestinationFields,
  getOnlinePlaceProviderMetadata,
  normalizeOnlinePlaceUrl,
  PLAN_MIN_STOP_START_GAP_MINUTES,
  PLACE_OFFLINE_MODE,
  PLACE_ONLINE_MODE,
} from '@hellowhen/shared';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { optionalAuth, requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { attachUploadedMediaToEntity, withMedia } from '../media/media.helpers.js';
import { stripAnonymousPublicProfileMedia } from '../users/publicUser.js';
import { usersHaveBlockBetween } from '../users/userBlocks.js';
import { runAiTextReview } from '../moderation/moderation.textPipeline.js';
import { applyTextReviewContentActionToTarget, buildAiTextReviewRouteOutcome } from '../moderation/moderation.textEnforcement.js';
import { buildPlaceStaticMapResult } from '../places/placeStaticMap.js';
import { createRandomPlaceStaticMapTemplateAssignment } from '../places/placeStaticMapTemplates.js';

export const plansRoutes = Router();

const placePresenceVerificationRateLimit = createRateLimiter({
  keyPrefix: 'place-presence-verification',
  windowMs: 60_000,
  max: 20,
  message: 'Too many place verification attempts. Please wait and try again.',
});

const publicPlanStatuses = ['open', 'full', 'started', 'cancelled'] as const;
const writablePlanDiscussionStatuses = ['open', 'full', 'started'] as const;
const lockedPlanInteractionStatuses = ['cancelled'] as const;
const userSummarySelect = {
  id: true,
  profile: { select: { displayName: true, handle: true, avatarUrl: true, countryCode: true } },
} as const;

function cleanTags(value: string[] | undefined) {
  return Array.from(new Set(value ?? [])).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function normalizedOnlineUrl(value?: string | null) {
  return normalizeOnlinePlaceUrl(value) ?? null;
}

function onlineProviderFor(value?: string | null) {
  return getOnlinePlaceProviderMetadata(value);
}

function planInclude() {
  return {
    owner: { select: userSummarySelect },
    places: {
      include: { sourcePlace: { include: { owner: { select: userSummarySelect } } } },
      orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
    },
    participants: { include: { user: { select: userSummarySelect } }, orderBy: { createdAt: 'asc' as const } },
  };
}

async function blockedUserIdsForViewer(viewerId?: string) {
  if (!viewerId) return [];
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  return Array.from(new Set(blocks.map((block: { blockerId: string; blockedId: string }) => block.blockerId === viewerId ? block.blockedId : block.blockerId)));
}

function normalizePlanSearchQuery(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function planSearchDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function planSearchSessionId(req: any) {
  const raw = req.headers['x-hellowhen-session-id'] ?? req.headers['x-client-session-id'] ?? req.headers['x-session-id'];
  if (Array.isArray(raw)) return raw[0]?.slice(0, 120) || null;
  return typeof raw === 'string' ? raw.slice(0, 120) : null;
}

async function logPlanSearch(req: any, input: { q?: string; status?: unknown; mode?: unknown; category?: unknown; city?: unknown }, resultCount: number) {
  const queryRaw = normalizePlanSearchQuery(input.q);
  if (!queryRaw) return;
  const queryNormalized = queryRaw.toLowerCase();
  const day = planSearchDay();
  const filtersJson = {
    status: input.status ?? null,
    mode: input.mode ?? null,
    category: input.category ?? null,
    city: input.city ?? null,
  };
  await prisma.$transaction([
    prisma.planSearchEvent.create({
      data: {
        userId: req.user?.id ?? null,
        sessionId: planSearchSessionId(req),
        queryRaw,
        queryNormalized,
        filtersJson,
        resultCount,
      },
    }),
    prisma.planSearchTermAggregate.upsert({
      where: { queryNormalized_day: { queryNormalized, day } },
      create: {
        queryNormalized,
        day,
        searchCount: 1,
        zeroResultCount: resultCount === 0 ? 1 : 0,
        resultCountSum: resultCount,
        lastResultCount: resultCount,
        lastSearchedAt: new Date(),
      },
      update: {
        searchCount: { increment: 1 },
        zeroResultCount: { increment: resultCount === 0 ? 1 : 0 },
        resultCountSum: { increment: resultCount },
        lastResultCount: resultCount,
        lastSearchedAt: new Date(),
      },
    }),
  ]).catch(() => null);
}

async function syncPlanCapacityStatus(planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, status: true, maxParticipants: true, deletedAt: true } });
  if (!plan || plan.deletedAt || !plan.maxParticipants || !['open', 'full'].includes(plan.status as string)) return;
  const acceptedCount = await prisma.planParticipant.count({ where: { planId, status: 'accepted' as any } });
  if (acceptedCount >= plan.maxParticipants && plan.status === 'open') {
    await prisma.plan.update({ where: { id: planId }, data: { status: 'full' as any } });
  }
  if (acceptedCount < plan.maxParticipants && plan.status === 'full') {
    await prisma.plan.update({ where: { id: planId }, data: { status: 'open' as any } });
  }
}

async function withPlanPlaceMediaFallback(places: any[], publicMediaVisibility: 'public' | 'public_anonymous') {
  const planPlaceMedia = await withMedia('plan_place' as any, places, publicMediaVisibility);
  const sourcePlaces = places
    .map((place) => place.sourcePlace)
    .filter((place): place is any => Boolean(place?.id));
  if (!sourcePlaces.length) return planPlaceMedia;

  const sourcePlaceMedia = await withMedia('place' as any, sourcePlaces, publicMediaVisibility);
  const sourceMediaById = new Map(sourcePlaceMedia.map((place: any) => [place.id, place.media ?? []]));
  return planPlaceMedia.map((place: any) => {
    if (place.media?.length || !place.placeId) return place;
    return { ...place, media: sourceMediaById.get(place.placeId) ?? [] };
  });
}

async function decoratePlan(plan: any, viewerId?: string | null) {
  const publicMediaVisibility = viewerId ? 'public' : 'public_anonymous';
  const [withPlanMedia] = await withMedia('plan' as any, [plan], publicMediaVisibility);
  const places = await withPlanPlaceMediaFallback(plan.places ?? [], publicMediaVisibility);
  return serializePlan({ ...withPlanMedia, places }, viewerId ?? null, 'detail');
}

async function decoratePlans(plans: any[], viewerId?: string | null) {
  const publicMediaVisibility = viewerId ? 'public' : 'public_anonymous';
  const planMediaMap = await withMedia('plan' as any, plans, publicMediaVisibility);
  const allPlaces = plans.flatMap((plan) => plan.places ?? []);
  const placeMedia = await withPlanPlaceMediaFallback(allPlaces, publicMediaVisibility);
  const placeById = new Map(placeMedia.map((place: any) => [place.id, place]));
  return planMediaMap.map((plan: any) => serializePlan({ ...plan, places: (plan.places ?? []).map((place: any) => placeById.get(place.id) ?? place) }, viewerId ?? null, 'list'));
}

function createPlanRequestError(code: string, publicMessage: string, statusCode = 400) {
  return Object.assign(new Error(publicMessage), { code, publicMessage, statusCode });
}

function isPlanInteractionLocked(status: string) {
  return lockedPlanInteractionStatuses.includes(status as any);
}

function planInteractionLockedResponse() {
  return {
    error: 'plan_cancelled',
    message: 'This Plan was cancelled. Joining, participant changes, public replies, and presence verification are closed.',
  };
}

function assertPlanInteractionUnlocked(status: string) {
  if (isPlanInteractionLocked(status)) {
    const response = planInteractionLockedResponse();
    throw createPlanRequestError(response.error, response.message, 409);
  }
}

function cleanReusablePlaceForViewer(place: any, canSeePrivateDetails: boolean, viewerId?: string | null, surface: 'detail' | 'list' | 'preview' = 'detail') {
  if (!place) return null;
  const cleaned = {
    ...place,
    mode: place.mode ?? 'local',
    source: place.source ?? 'user',
    visibility: place.visibility ?? (place.source === 'hellowhen_library' ? 'library' : 'private'),
    addressPrivateText: canSeePrivateDetails ? place.addressPrivateText ?? null : null,
    defaultMeetingInstructions: canSeePrivateDetails ? place.defaultMeetingInstructions ?? null : null,
  };
  const onlineProvider = cleaned.mode === PLACE_ONLINE_MODE ? onlineProviderFor(cleaned.onlineUrl) : null;
  const staticMapResult = buildPlaceStaticMapResult(cleaned, { viewerId, surface });
  return { ...cleaned, onlineProvider, staticMap: staticMapResult.staticMap, staticMapStatus: staticMapResult.staticMapStatus };
}

function planPlaceSourceFor(place: any) {
  if (!place?.placeId) return 'custom';
  return place.sourcePlace?.source === 'hellowhen_library' ? 'hellowhen_library' : 'my_place';
}

function serializePlan(plan: any, viewerId: string | null, surface: 'detail' | 'list' | 'preview' = 'detail') {
  const isOwner = Boolean(viewerId && plan.ownerId === viewerId);
  const myParticipant = viewerId ? (plan.participants ?? []).find((participant: any) => participant.userId === viewerId) : null;
  const canSeePrivatePlaceDetails = isOwner || myParticipant?.status === 'accepted';
  const acceptedParticipants = (plan.participants ?? []).filter((participant: any) => participant.status === 'accepted');
  const pendingParticipants = (plan.participants ?? []).filter((participant: any) => participant.status === 'pending');
  const visibleParticipants = isOwner
    ? (plan.participants ?? [])
    : [...acceptedParticipants, ...(myParticipant && myParticipant.status !== 'accepted' ? [myParticipant] : [])];
  const canSeeSourcePlace = isOwner;

  return {
    ...plan,
    places: (plan.places ?? []).map((place: any) => {
      const sourcePlace = canSeeSourcePlace ? cleanReusablePlaceForViewer(place.sourcePlace, canSeePrivatePlaceDetails, viewerId, surface) : null;
      const cleanedPlace = {
        ...place,
        source: planPlaceSourceFor(place),
        sourcePlace,
        mode: place.mode ?? 'local',
        addressPrivateText: canSeePrivatePlaceDetails ? place.addressPrivateText ?? null : null,
      };
      const onlineProvider = cleanedPlace.mode === PLACE_ONLINE_MODE ? onlineProviderFor(cleanedPlace.onlineUrl) : null;
      const staticMapResult = buildPlaceStaticMapResult(cleanedPlace, { viewerId, surface });
      return { ...cleanedPlace, onlineProvider, staticMap: staticMapResult.staticMap, staticMapStatus: staticMapResult.staticMapStatus };
    }),
    participants: visibleParticipants,
    participantCount: acceptedParticipants.length,
    pendingRequestCount: isOwner ? pendingParticipants.length : undefined,
    myParticipantStatus: myParticipant?.status ?? null,
    canSeePrivatePlaceDetails,
  };
}

async function loadPlanForViewer(planId: string, viewerId?: string | null) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: planInclude() });
  if (!plan || plan.deletedAt) return null;
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

async function loadReadablePlanForDiscussion(planId: string, actorId?: string | null) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { id: true, ownerId: true, status: true, deletedAt: true, owner: { select: { trustTier: true } } },
  });
  if (!plan || plan.deletedAt || !publicPlanStatuses.includes(plan.status as any) || plan.owner?.trustTier === 'restricted') return null;
  if (actorId && plan.ownerId !== actorId && await usersHaveBlockBetween(actorId, plan.ownerId)) return null;
  return plan;
}

async function deletedPlanKnownToActor(planId: string, actorId: string) {
  const plan = await prisma.plan.findFirst({
    where: {
      id: planId,
      deletedAt: { not: null },
      OR: [
        { ownerId: actorId },
        { participants: { some: { userId: actorId } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(plan);
}

function canWritePlanPublicDiscussion(plan: { status: string }) {
  return writablePlanDiscussionStatuses.includes(plan.status as any);
}

const verificationPlanStatuses = ['open', 'full', 'started'] as const;
const EARTH_RADIUS_METERS = 6_371_000;
const PLACE_PRESENCE_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_SECONDS_FOR_TRAVEL_SPEED_CHECK = 60;

function degreesToRadians(value: number) {
  return value * Math.PI / 180;
}

function distanceMetersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const lat1 = degreesToRadians(a.latitude);
  const lat2 = degreesToRadians(b.latitude);
  const deltaLat = degreesToRadians(b.latitude - a.latitude);
  const deltaLng = degreesToRadians(b.longitude - a.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function roundCoordinate(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function verificationCooldownStart() {
  if (!env.placePresenceVerificationCooldownHours) return null;
  return new Date(Date.now() - env.placePresenceVerificationCooldownHours * 60 * 60 * 1000);
}

function verificationResponse(verification: any, accepted: boolean, alreadyVerified = false) {
  return {
    verification,
    accepted,
    alreadyVerified,
    distanceMeters: verification.distanceMeters ?? null,
    maxDistanceMeters: verification.maxDistanceMeters ?? env.placePresenceMaxDistanceMeters,
  };
}

function parseLocationCapturedAt(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function locationTimestampRejectionReason(capturedAt: Date | null, now = new Date()) {
  if (!capturedAt) return null;
  const ageSeconds = (now.getTime() - capturedAt.getTime()) / 1000;
  if (env.placePresenceMaxLocationAgeSeconds && ageSeconds > env.placePresenceMaxLocationAgeSeconds) return 'location_timestamp_stale';
  if (env.placePresenceMaxFutureLocationSeconds && ageSeconds < -env.placePresenceMaxFutureLocationSeconds) return 'location_timestamp_future';
  return null;
}

function attemptWindowStart(now = new Date()) {
  return new Date(now.getTime() - PLACE_PRESENCE_ATTEMPT_WINDOW_MS);
}

async function enforcePresenceAttemptLimits(userId: string, now = new Date()) {
  const windowStart = attemptWindowStart(now);
  const [lastAttempt, dailyAttempts, dailyRejectedAttempts] = await Promise.all([
    (prisma as any).placePresenceVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    (prisma as any).placePresenceVerification.count({ where: { userId, createdAt: { gte: windowStart } } }),
    (prisma as any).placePresenceVerification.count({ where: { userId, status: 'rejected', createdAt: { gte: windowStart } } }),
  ]);

  if (env.placePresenceMinSecondsBetweenAttempts && lastAttempt?.createdAt) {
    const elapsedSeconds = (now.getTime() - new Date(lastAttempt.createdAt).getTime()) / 1000;
    if (elapsedSeconds < env.placePresenceMinSecondsBetweenAttempts) {
      return { error: 'place_presence_attempt_cooldown' as const, retryAfterSeconds: Math.max(1, Math.ceil(env.placePresenceMinSecondsBetweenAttempts - elapsedSeconds)) };
    }
  }

  if (dailyAttempts >= env.placePresenceMaxDailyAttempts) {
    return { error: 'place_presence_daily_limit' as const };
  }

  if (dailyRejectedAttempts >= env.placePresenceMaxDailyRejectedAttempts) {
    return { error: 'place_presence_rejected_daily_limit' as const };
  }

  return null;
}

async function suspiciousTravelRejectionReason(userId: string, input: { latitude: number; longitude: number }, now = new Date()) {
  if (!env.placePresenceMaxTravelSpeedKph) return null;
  const lastVerified = await (prisma as any).placePresenceVerification.findFirst({
    where: {
      userId,
      status: 'verified',
      latitudeRounded: { not: null },
      longitudeRounded: { not: null },
    },
    orderBy: { verifiedAt: 'desc' },
    select: { latitudeRounded: true, longitudeRounded: true, verifiedAt: true, createdAt: true },
  });
  if (typeof lastVerified?.latitudeRounded !== 'number' || typeof lastVerified?.longitudeRounded !== 'number') return null;

  const previousTime = new Date(lastVerified.verifiedAt ?? lastVerified.createdAt);
  const elapsedSeconds = Math.max(0, (now.getTime() - previousTime.getTime()) / 1000);
  if (elapsedSeconds < MIN_SECONDS_FOR_TRAVEL_SPEED_CHECK) return null;

  const distanceKm = distanceMetersBetween(input, { latitude: lastVerified.latitudeRounded, longitude: lastVerified.longitudeRounded }) / 1000;
  const speedKph = distanceKm / (elapsedSeconds / 3600);
  return speedKph > env.placePresenceMaxTravelSpeedKph ? 'suspicious_location_jump' : null;
}

async function createPlacePresenceVerificationRecord(params: {
  userId: string;
  plan: { id: string };
  place: { id: string; placeId: string | null };
  input: { latitude: number; longitude: number; accuracyMeters?: number };
  accepted: boolean;
  distanceMeters: number | null;
  rejectionReason: string | null;
}) {
  return (prisma as any).placePresenceVerification.create({
    data: {
      userId: params.userId,
      planId: params.plan.id,
      planPlaceId: params.place.id,
      sourcePlaceId: params.place.placeId ?? null,
      source: 'device_gps',
      status: params.accepted ? 'verified' : 'rejected',
      latitudeRounded: roundCoordinate(params.input.latitude),
      longitudeRounded: roundCoordinate(params.input.longitude),
      accuracyMeters: params.input.accuracyMeters ?? null,
      distanceMeters: params.distanceMeters,
      maxDistanceMeters: env.placePresenceMaxDistanceMeters,
      rejectionReason: params.rejectionReason,
      verifiedAt: params.accepted ? new Date() : null,
    },
  });
}

async function loadPlanPlaceForPresenceVerification(planId: string, planPlaceId: string, userId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      deletedAt: true,
      owner: { select: { trustTier: true } },
      places: {
        where: { id: planPlaceId },
        take: 1,
        select: {
          id: true,
          placeId: true,
          mode: true,
          title: true,
          latitude: true,
          longitude: true,
          sourcePlace: { select: { id: true, latitude: true, longitude: true } },
        },
      },
      participants: { where: { userId }, select: { userId: true, status: true } },
    },
  });

  if (!plan || plan.owner?.trustTier === 'restricted') return null;
  const participant = plan.participants[0];
  if (plan.deletedAt) {
    return plan.ownerId === userId || Boolean(participant) ? { error: 'plan_deleted' as const } : null;
  }
  if (isPlanInteractionLocked(plan.status)) return { error: 'plan_cancelled' as const };
  if (!verificationPlanStatuses.includes(plan.status as any)) return null;
  if (plan.ownerId !== userId && await usersHaveBlockBetween(userId, plan.ownerId)) return null;

  const place = plan.places[0];
  if (!place) return { error: 'place_not_found' as const };

  const canVerify = plan.ownerId === userId || participant?.status === 'accepted';
  if (!canVerify) return { error: 'not_plan_participant' as const };

  return { plan, place };
}

function placeCoordinatesForVerification(place: { latitude: number | null; longitude: number | null; sourcePlace?: { latitude: number | null; longitude: number | null } | null }) {
  const latitude = typeof place.latitude === 'number' ? place.latitude : place.sourcePlace?.latitude;
  const longitude = typeof place.longitude === 'number' ? place.longitude : place.sourcePlace?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { latitude, longitude };
}

function isCancelOnlyPlanUpdate(input: ReturnType<typeof updatePlanRequestSchema.parse>) {
  const keys = Object.keys(input);
  return keys.length === 1 && input.status === 'cancelled';
}

function planPublicDiscussionMessageSelect() {
  return {
    id: true,
    planId: true,
    authorId: true,
    body: true,
    status: true,
    editedAt: true,
    editCount: true,
    deletedAt: true,
    hiddenAt: true,
    createdAt: true,
    updatedAt: true,
    author: { select: userSummarySelect },
  } as const;
}

function dateInputToIso(value?: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function estimatePlanEndsAtFromPlaces(input: { endsAt?: string | Date | null; places?: Array<{ startsAt?: string | Date | null; endsAt?: string | Date | null }> }) {
  const explicitEndsAt = dateInputToIso(input.endsAt);
  if (explicitEndsAt) return explicitEndsAt;

  const places = input.places ?? [];
  const estimatedPlaceEndTimes = buildEstimatedPlanPlaceEndTimes(places.map((place) => dateInputToIso(place.startsAt))).filter((value): value is string => Boolean(value));
  const explicitPlaceEndTimes = places.map((place) => dateInputToIso(place.endsAt)).filter((value): value is string => Boolean(value));
  const candidates = [...estimatedPlaceEndTimes, ...explicitPlaceEndTimes];
  if (!candidates.length) return null;
  return candidates.reduce((latest, candidate) => new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest);
}

function planCreateData(ownerId: string, input: ReturnType<typeof createPlanRequestSchema.parse>) {
  const generatedPlanDisplay = buildGeneratedPlanDisplay({
    places: input.places ?? [],
    startsAt: input.startsAt,
    mode: input.mode,
    joinApprovalMode: input.joinApprovalMode,
  });
  const estimatedEndsAt = estimatePlanEndsAtFromPlaces(input);
  return {
    ownerId,
    title: input.title ?? generatedPlanDisplay.title,
    description: input.description ?? generatedPlanDisplay.description,
    category: input.category ?? null,
    tags: cleanTags(input.tags),
    mode: input.mode ?? null,
    locationLabel: input.locationLabel ?? null,
    startsAt: new Date(input.startsAt),
    endsAt: estimatedEndsAt ? new Date(estimatedEndsAt) : null,
    maxParticipants: input.maxParticipants ?? null,
    joinApprovalMode: input.joinApprovalMode ?? 'automatic',
    status: input.status ?? 'open',
  };
}

const planTimeConflictBlockingStatuses = ['draft', 'open', 'full', 'started'] as const;
// Cancelled, hidden, and soft-deleted Plans intentionally do not reserve time.
// They are history/status records only, so users can create a new overlapping Plan after cancelling or deleting the old one.
const PLAN_TIME_MIN_GAP_MINUTES = 60;
const PLAN_TIME_MIN_GAP_MS = PLAN_TIME_MIN_GAP_MINUTES * 60 * 1000;

type PlanScheduleInput = {
  startsAt: string | Date;
  endsAt?: string | Date | null;
  places?: Array<{ startsAt?: string | Date | null; endsAt?: string | Date | null }>;
};

function effectivePlanRange(input: PlanScheduleInput) {
  const startsAt = new Date(input.startsAt);
  const estimatedEndsAt = estimatePlanEndsAtFromPlaces(input);
  const rawEndsAt = estimatedEndsAt ? new Date(estimatedEndsAt) : startsAt;
  const endsAt = rawEndsAt.getTime() >= startsAt.getTime() ? rawEndsAt : startsAt;
  return { startsAt, endsAt };
}

function planRangeWithGap(input: PlanScheduleInput) {
  const range = effectivePlanRange(input);
  return {
    ...range,
    startsAtWithGap: new Date(range.startsAt.getTime() - PLAN_TIME_MIN_GAP_MS),
    endsAtWithGap: new Date(range.endsAt.getTime() + PLAN_TIME_MIN_GAP_MS),
  };
}

async function findOwnedPlanTimeConflict(ownerId: string, input: PlanScheduleInput, excludePlanId?: string) {
  const { startsAtWithGap, endsAtWithGap } = planRangeWithGap(input);
  return prisma.plan.findFirst({
    where: {
      ownerId,
      ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
      deletedAt: null,
      status: { in: [...planTimeConflictBlockingStatuses] as any },
      startsAt: { lte: endsAtWithGap },
      OR: [
        { endsAt: { gte: startsAtWithGap } },
        { endsAt: null, startsAt: { gte: startsAtWithGap } },
      ],
    },
    select: { id: true, title: true, startsAt: true, endsAt: true },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
  });
}


function findPlanRequestStopGapViolation(input: PlanScheduleInput) {
  const startsAtInRouteOrder = (input.places ?? [])
    .map((place, index) => ({ startsAt: place.startsAt ?? null, order: typeof (place as { order?: unknown }).order === 'number' ? (place as { order?: number }).order! : index }))
    .sort((left, right) => left.order - right.order)
    .map((place) => place.startsAt);
  return findPlanStopStartGapViolation(startsAtInRouteOrder);
}

function planStopGapViolationResponse(violation: NonNullable<ReturnType<typeof findPlanRequestStopGapViolation>>) {
  return {
    error: 'plan_stop_gap_too_short',
    message: `Place ${violation.currentIndex + 1} must start at least ${PLAN_MIN_STOP_START_GAP_MINUTES} minutes after Place ${violation.previousIndex + 1}.`,
    minGapMinutes: PLAN_MIN_STOP_START_GAP_MINUTES,
    previousPlaceIndex: violation.previousIndex,
    currentPlaceIndex: violation.currentIndex,
    previousStartsAt: violation.previousStartsAt,
    currentStartsAt: violation.currentStartsAt,
    earliestStartsAt: violation.earliestStartsAt,
  };
}

function planTimeConflictResponse(conflict: { id: string; title: string; startsAt: Date; endsAt: Date | null }, requested: PlanScheduleInput) {
  const requestedRange = effectivePlanRange(requested);
  return {
    error: 'plan_time_overlap',
    message: `This is too close to your existing Plan “${conflict.title}”. Keep at least ${PLAN_TIME_MIN_GAP_MINUTES} minutes between Plans.`,
    minGapMinutes: PLAN_TIME_MIN_GAP_MINUTES,
    plan: {
      id: conflict.id,
      title: conflict.title,
      startsAt: conflict.startsAt.toISOString(),
      endsAt: conflict.endsAt ? conflict.endsAt.toISOString() : null,
    },
    requested: {
      startsAt: requestedRange.startsAt.toISOString(),
      endsAt: requestedRange.endsAt.toISOString(),
    },
  };
}

function planLockedAfterCreationResponse() {
  return {
    error: 'plan_locked_after_creation',
    message: 'Plans are locked after creation. Create a new Plan if you need different places, times, or route order.',
  };
}

function planContentLockedResponse() {
  return {
    ...planLockedAfterCreationResponse(),
    message: 'Plans are locked after creation. You can cancel this Plan, or create a new Plan if the details need to change.',
  };
}

function planStopsLockedResponse() {
  return {
    ...planLockedAfterCreationResponse(),
    lockedFields: ['places', 'place_order', 'place_times', 'place_duration', 'place_location'],
  };
}

function planDeletedResponse() {
  return {
    error: 'plan_deleted',
    message: 'This Plan was deleted and is no longer available.',
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

function hasPlanPlaceStaticMapCandidate(input: { mode?: string | null; latitude?: number | null; longitude?: number | null }, reusablePlace?: any | null) {
  const mode = input.mode ?? reusablePlace?.mode ?? PLACE_OFFLINE_MODE;
  if (mode === PLACE_ONLINE_MODE) return false;
  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') return true;
  return typeof reusablePlace?.latitude === 'number' && typeof reusablePlace?.longitude === 'number';
}

function assertPlanPlaceAddressPolicy(input: any) {
  const mode = input.mode ?? PLACE_OFFLINE_MODE;
  if (mode === PLACE_ONLINE_MODE) {
    const missing = getMissingOnlineDestinationFields(input);
    if (missing.length > 0) {
      throw createPlanRequestError('missing_online_place_destination', buildMissingOnlineDestinationMessage(missing));
    }
    return;
  }

  const missing = getMissingOfflineProviderAddressFields(input);
  if (missing.length > 0) {
    throw createPlanRequestError('missing_offline_provider_address', buildMissingOfflineProviderAddressMessage(missing));
  }
}

function planPlaceStaticMapTemplateSnapshot(input: { mediaIds?: string[]; mode?: string | null; latitude?: number | null; longitude?: number | null }, reusablePlace?: any | null) {
  if (reusablePlace?.staticMapTemplateFamily) {
    return {
      staticMapTemplateFamily: reusablePlace.staticMapTemplateFamily,
      staticMapTemplateSeed: reusablePlace.staticMapTemplateSeed ?? null,
    };
  }
  if (input.mediaIds?.length) return {};
  if (!hasPlanPlaceStaticMapCandidate(input, reusablePlace)) return {};
  return createRandomPlaceStaticMapTemplateAssignment('plan_place');
}

async function loadReusablePlaceForSnapshot(placeId: string, userId: string) {
  return prisma.place.findFirst({
    where: {
      id: placeId,
      status: 'active' as any,
      OR: [
        { ownerId: userId },
        { source: 'hellowhen_library' as any, visibility: 'library' as any },
        { visibility: 'public' as any },
      ],
    },
  });
}

function planPlaceSnapshotData(planId: string, input: ReturnType<typeof createPlanPlaceRequestSchema.parse>, fallbackOrder = 0, reusablePlace?: any | null) {
  const mode = input.mode ?? reusablePlace?.mode ?? PLACE_OFFLINE_MODE;
  const isOnline = mode === PLACE_ONLINE_MODE;
  return {
    planId,
    placeId: reusablePlace?.id ?? input.placeId ?? null,
    order: input.order ?? fallbackOrder,
    mode,
    title: input.title ?? reusablePlace?.title,
    note: input.note ?? null,
    addressPublicText: isOnline ? null : input.formattedAddress ?? reusablePlace?.formattedAddress ?? null,
    addressPrivateText: isOnline ? null : input.addressPrivateText ?? reusablePlace?.addressPrivateText ?? null,
    googlePlaceId: isOnline ? null : input.googlePlaceId ?? reusablePlace?.googlePlaceId ?? null,
    googlePlaceName: isOnline ? null : input.googlePlaceName ?? reusablePlace?.googlePlaceName ?? null,
    formattedAddress: isOnline ? null : input.formattedAddress ?? reusablePlace?.formattedAddress ?? null,
    googleMapsUri: isOnline ? null : input.googleMapsUri ?? reusablePlace?.googleMapsUri ?? null,
    latitude: isOnline ? null : input.latitude ?? reusablePlace?.latitude ?? null,
    longitude: isOnline ? null : input.longitude ?? reusablePlace?.longitude ?? null,
    locationSource: isOnline ? null : input.locationSource ?? reusablePlace?.locationSource ?? null,
    addressValidationStatus: isOnline ? null : input.addressValidationStatus ?? reusablePlace?.addressValidationStatus ?? null,
    onlineLabel: isOnline ? input.onlineLabel ?? reusablePlace?.onlineLabel ?? null : null,
    onlineUrl: isOnline ? normalizedOnlineUrl(input.onlineUrl ?? reusablePlace?.onlineUrl) : null,
    ...planPlaceStaticMapTemplateSnapshot(input, reusablePlace),
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
  };
}

async function placeCreateData(planId: string, ownerId: string, input: ReturnType<typeof createPlanPlaceRequestSchema.parse>, fallbackOrder = 0) {
  const reusablePlace = input.placeId ? await loadReusablePlaceForSnapshot(input.placeId, ownerId) : null;
  if (input.placeId && !reusablePlace) {
    throw createPlanRequestError('place_not_found', 'Choose one of your places or a Hellowhen library place.', 404);
  }
  const data = planPlaceSnapshotData(planId, input, fallbackOrder, reusablePlace);
  if (!data.title) throw createPlanRequestError('missing_place_title', 'Add a place title before saving this plan place.');
  assertPlanPlaceAddressPolicy(data);
  return data;
}

async function joinPlanFreely(planId: string, userId: string, message?: string | null) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { participants: true, owner: { select: { trustTier: true } } },
  });
  if (!plan || plan.owner?.trustTier === 'restricted') {
    throw createPlanRequestError('not_found', 'Plan not found.', 404);
  }
  if (plan.deletedAt) {
    const knownParticipant = (plan.participants ?? []).some((participant: any) => participant.userId === userId);
    if (plan.ownerId === userId || knownParticipant) {
      const response = planDeletedResponse();
      throw createPlanRequestError(response.error, response.message, 410);
    }
    throw createPlanRequestError('not_found', 'Plan not found.', 404);
  }
  if (!publicPlanStatuses.includes(plan.status as any)) {
    throw createPlanRequestError('not_found', 'Plan not found.', 404);
  }
  assertPlanInteractionUnlocked(plan.status);
  if (plan.status !== 'open') {
    throw createPlanRequestError('plan_not_joinable', 'This plan is not open for joining.', 409);
  }
  if (plan.ownerId === userId) {
    throw createPlanRequestError('owner_cannot_join', 'You already own this plan.', 409);
  }
  if (await usersHaveBlockBetween(userId, plan.ownerId)) {
    throw createPlanRequestError('blocked_user', 'You cannot join this plan.', 403);
  }

  const existing = (plan.participants ?? []).find((participant: any) => participant.userId === userId);
  if (existing?.status === 'accepted') {
    throw createPlanRequestError('already_joined', 'You already joined this plan.', 409);
  }
  if (existing?.status === 'removed') {
    throw createPlanRequestError('participant_removed', 'The owner removed you from this plan.', 403);
  }

  const acceptedCount = (plan.participants ?? []).filter((participant: any) => participant.status === 'accepted').length;
  if (plan.maxParticipants && acceptedCount >= plan.maxParticipants) {
    throw createPlanRequestError('plan_full', 'This plan is full.', 409);
  }

  const participant = await prisma.planParticipant.upsert({
    where: { planId_userId: { planId: plan.id, userId } },
    update: {
      message: message?.trim() || null,
      status: 'accepted' as any,
      decidedAt: new Date(),
      decidedById: plan.ownerId,
    },
    create: {
      planId: plan.id,
      userId,
      message: message?.trim() || null,
      status: 'accepted' as any,
      decidedAt: new Date(),
      decidedById: plan.ownerId,
    },
    include: { user: { select: userSummarySelect } },
  });
  await syncPlanCapacityStatus(plan.id);
  return participant;
}

async function leaveJoinedPlan(planId: string, userId: string) {
  const participant = await prisma.planParticipant.findUnique({
    where: { planId_userId: { planId, userId } },
    include: { plan: { select: { status: true, deletedAt: true } } },
  });
  if (!participant) throw createPlanRequestError('not_found', 'You have not joined this plan.', 404);
  if (participant.plan.deletedAt) {
    const response = planDeletedResponse();
    throw createPlanRequestError(response.error, response.message, 410);
  }
  assertPlanInteractionUnlocked(participant.plan.status);
  if (participant.status !== 'accepted') {
    throw createPlanRequestError('cannot_leave_plan', 'Only joined participants can leave a plan.', 409);
  }
  const updated = await prisma.planParticipant.update({
    where: { id: participant.id },
    data: { status: 'left' as any, decidedAt: new Date(), decidedById: userId },
    include: { user: { select: userSummarySelect } },
  });
  await syncPlanCapacityStatus(planId);
  return updated;
}

plansRoutes.get('/feed', optionalAuth, asyncRoute(async (req, res) => {
  const input = listPlansQuerySchema.parse(req.query ?? {});
  const blockedOwnerIds = await blockedUserIdsForViewer(req.user?.id);
  const plans = await prisma.plan.findMany({
    where: {
      deletedAt: null,
      status: input.status ?? { in: [...publicPlanStatuses] },
      ...(input.q ? {
        OR: [
          { title: { contains: input.q, mode: 'insensitive' as const } },
          { description: { contains: input.q, mode: 'insensitive' as const } },
          { category: { contains: input.q, mode: 'insensitive' as const } },
          { locationLabel: { contains: input.q, mode: 'insensitive' as const } },
          { tags: { has: input.q } },
          { places: { some: { OR: [
            { title: { contains: input.q, mode: 'insensitive' as const } },
            { note: { contains: input.q, mode: 'insensitive' as const } },
            { addressPublicText: { contains: input.q, mode: 'insensitive' as const } },
            { onlineLabel: { contains: input.q, mode: 'insensitive' as const } },
            { onlineUrl: { contains: input.q, mode: 'insensitive' as const } },
          ] } } },
        ],
      } : {}),
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
  await logPlanSearch(req, input, plans.length);
  res.json(stripAnonymousPublicProfileMedia({ plans: await decoratePlans(plans, req.user?.id ?? null) }, req.user?.id));
}));

plansRoutes.get('/mine', requireAuth, asyncRoute(async (req, res) => {
  const plans = await prisma.plan.findMany({
    where: { ownerId: req.user!.id, deletedAt: null },
    include: planInclude(),
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });
  res.json({ plans: await decoratePlans(plans, req.user!.id) });
}));

plansRoutes.get('/joined', requireAuth, asyncRoute(async (req, res) => {
  const blockedOwnerIds = await blockedUserIdsForViewer(req.user!.id);
  const plans = await prisma.plan.findMany({
    where: {
      deletedAt: null,
      participants: { some: { userId: req.user!.id, status: 'accepted' as any } },
      status: { in: [...publicPlanStatuses] },
      owner: { trustTier: { not: 'restricted' } },
      ...(blockedOwnerIds.length > 0 ? { ownerId: { notIn: blockedOwnerIds } } : {}),
    },
    include: planInclude(),
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });
  res.json({ plans: await decoratePlans(plans, req.user!.id) });
}));

plansRoutes.post('/', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createPlanRequestSchema.parse(req.body ?? {});
  const stopGapViolation = findPlanRequestStopGapViolation(input);
  if (stopGapViolation) return res.status(400).json(planStopGapViolationResponse(stopGapViolation));
  const conflictingPlan = await findOwnedPlanTimeConflict(req.user!.id, input);
  if (conflictingPlan) return res.status(409).json(planTimeConflictResponse(conflictingPlan, input));
  const inputPlaces = input.places ?? [];
  const estimatedPlaceEndTimes = buildEstimatedPlanPlaceEndTimes(inputPlaces.map((placeInput) => placeInput.startsAt));
  const placeDataDrafts = [] as any[];
  for (const [index, placeInput] of inputPlaces.entries()) {
    const draft = await placeCreateData('__pending_plan__', req.user!.id, placeInput, index);
    if (!draft.endsAt && estimatedPlaceEndTimes[index]) draft.endsAt = new Date(estimatedPlaceEndTimes[index]!);
    placeDataDrafts.push(draft);
  }
  const plan = await prisma.plan.create({ data: planCreateData(req.user!.id, input) as any });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'plan' as any, plan.id);

  for (const [index, placeInput] of inputPlaces.entries()) {
    const place = await prisma.planPlace.create({ data: { ...placeDataDrafts[index], planId: plan.id } as any });
    await attachUploadedMediaToEntity(req.user!.id, placeInput.mediaIds, 'plan_place' as any, place.id, { maxImages: PLAN_PLACE_MEDIA_LIMITS.plus });
  }

  const created = await prisma.plan.findUnique({ where: { id: plan.id }, include: planInclude() });
  res.status(201).json({ plan: await decoratePlan(created, req.user!.id) });
}));

plansRoutes.patch('/:planId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updatePlanRequestSchema.parse(req.body ?? {});
  const existing = await prisma.plan.findFirst({ where: { id: req.params.planId, ownerId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  if (existing.deletedAt) return res.status(410).json(planDeletedResponse());
  if (!isCancelOnlyPlanUpdate(input)) {
    return res.status(409).json(planContentLockedResponse());
  }
  const plan = await prisma.plan.update({ where: { id: existing.id }, data: planUpdateData(input) as any });
  const updated = await prisma.plan.findUnique({ where: { id: plan.id }, include: planInclude() });
  res.json({ plan: await decoratePlan(updated, req.user!.id) });
}));

plansRoutes.delete('/:planId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const existing = await prisma.plan.findFirst({ where: { id: req.params.planId, ownerId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  if (existing.deletedAt) return res.status(410).json(planDeletedResponse());

  const plan = await prisma.plan.update({
    where: { id: existing.id },
    data: { status: 'hidden' as any, deletedAt: new Date(), deletedById: req.user!.id } as any,
  });
  const updated = await prisma.plan.findUnique({ where: { id: plan.id }, include: planInclude() });
  return res.json({ plan: await decoratePlan(updated, req.user!.id), ...planDeletedResponse() });
}));

plansRoutes.post('/:planId/places', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const plan = await prisma.plan.findFirst({
    where: { id: req.params.planId, ownerId: req.user!.id },
    include: { places: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
  });
  if (!plan) return res.status(404).json({ error: 'not_found' });
  if (plan.deletedAt) return res.status(410).json(planDeletedResponse());
  return res.status(409).json(planStopsLockedResponse());
}));

plansRoutes.patch('/:planId/places/:placeId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const plan = await prisma.plan.findFirst({
    where: { id: req.params.planId, ownerId: req.user!.id },
    include: { places: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
  });
  if (!plan) return res.status(404).json({ error: 'not_found' });
  if (plan.deletedAt) return res.status(410).json(planDeletedResponse());
  const place = plan.places.find((item: any) => item.id === req.params.placeId);
  if (!place) return res.status(404).json({ error: 'not_found' });
  return res.status(409).json(planStopsLockedResponse());
}));

plansRoutes.delete('/:planId/places/:placeId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const plan = await prisma.plan.findFirst({
    where: { id: req.params.planId, ownerId: req.user!.id },
    include: { places: { select: { id: true } } },
  });
  if (!plan) return res.status(404).json({ error: 'not_found' });
  if (plan.deletedAt) return res.status(410).json(planDeletedResponse());
  const place = plan.places.find((item: any) => item.id === req.params.placeId);
  if (!place) return res.status(404).json({ error: 'not_found' });
  return res.status(409).json(planStopsLockedResponse());
}));

plansRoutes.post('/:planId/places/:placeId/verify-presence', requireAuth, requireActiveAccount, placePresenceVerificationRateLimit, asyncRoute(async (req, res) => {
  if (!env.placePresenceVerificationEnabled) {
    return res.status(503).json({ error: 'place_presence_verification_disabled', message: 'Place presence verification is not enabled yet.' });
  }

  const input = createPlacePresenceVerificationRequestSchema.parse(req.body ?? {});
  const planId = req.params.planId;
  const planPlaceId = req.params.placeId;
  if (!planId || !planPlaceId) return res.status(400).json({ error: 'missing_plan_place' });

  const loaded = await loadPlanPlaceForPresenceVerification(planId, planPlaceId, req.user!.id);
  if (!loaded) return res.status(404).json({ error: 'not_found' });
  if ('error' in loaded) {
    if (loaded.error === 'plan_deleted') return res.status(410).json(planDeletedResponse());
    if (loaded.error === 'plan_cancelled') return res.status(409).json(planInteractionLockedResponse());
    if (loaded.error === 'not_plan_participant') return res.status(403).json({ error: loaded.error, message: 'Join this plan before verifying your presence at its offline places.' });
    return res.status(404).json({ error: loaded.error });
  }

  const { plan, place } = loaded;
  if (place.mode !== 'local') {
    return res.status(409).json({ error: 'not_offline_place', message: 'Only offline places can be verified with device location.' });
  }

  const target = placeCoordinatesForVerification(place);
  if (!target) {
    return res.status(409).json({ error: 'place_location_missing', message: 'This place does not have a verified location yet.' });
  }

  const cooldownStart = verificationCooldownStart();
  if (cooldownStart) {
    const existing = await (prisma as any).placePresenceVerification.findFirst({
      where: {
        userId: req.user!.id,
        planPlaceId: place.id,
        status: 'verified',
        verifiedAt: { gte: cooldownStart },
      },
      orderBy: { verifiedAt: 'desc' },
    });
    if (existing) return res.json(verificationResponse(existing, true, true));
  }

  const now = new Date();
  const attemptLimit = await enforcePresenceAttemptLimits(req.user!.id, now);
  if (attemptLimit) {
    const retryAfterSeconds = 'retryAfterSeconds' in attemptLimit ? attemptLimit.retryAfterSeconds : undefined;
    if (retryAfterSeconds) res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: attemptLimit.error,
      message: attemptLimit.error === 'place_presence_attempt_cooldown'
        ? 'Wait a moment before trying another place verification.'
        : 'Too many place verification attempts today. Please try again later.',
      retryAfterSeconds,
    });
  }

  const capturedAt = parseLocationCapturedAt(input.locationCapturedAt);
  const timestampRejectionReason = locationTimestampRejectionReason(capturedAt, now);
  const deviceTrustRejectionReason = env.placePresenceRejectMockedLocation && input.isMockedLocation ? 'mock_location_detected' : null;
  const travelRejectionReason = await suspiciousTravelRejectionReason(req.user!.id, input, capturedAt ?? now);
  const distanceMeters = distanceMetersBetween(input, target);
  const accuracyMeters = input.accuracyMeters ?? null;
  const accuracyOk = accuracyMeters === null || accuracyMeters <= env.placePresenceMaxAccuracyMeters;
  const distanceOk = distanceMeters <= env.placePresenceMaxDistanceMeters;
  const rejectionReason = deviceTrustRejectionReason
    ?? timestampRejectionReason
    ?? travelRejectionReason
    ?? (!accuracyOk ? 'gps_accuracy_too_low' : null)
    ?? (!distanceOk ? 'too_far_from_place' : null);
  const accepted = !rejectionReason;

  const verification = await createPlacePresenceVerificationRecord({
    userId: req.user!.id,
    plan,
    place,
    input,
    accepted,
    distanceMeters,
    rejectionReason,
  });

  return res.status(accepted ? 201 : 409).json(verificationResponse(verification, accepted));
}));

function serializePrivatePlacePresenceVerification(verification: any) {
  return {
    id: verification.id,
    userId: verification.userId,
    planId: verification.planId,
    planPlaceId: verification.planPlaceId,
    sourcePlaceId: verification.sourcePlaceId ?? null,
    source: verification.source,
    status: verification.status,
    distanceMeters: verification.distanceMeters ?? null,
    maxDistanceMeters: verification.maxDistanceMeters ?? null,
    rejectionReason: verification.rejectionReason ?? null,
    verifiedAt: verification.verifiedAt?.toISOString?.() ?? null,
    createdAt: verification.createdAt?.toISOString?.() ?? verification.createdAt,
    plan: verification.plan ? {
      id: verification.plan.id,
      title: verification.plan.title,
      status: verification.plan.status,
      startsAt: verification.plan.startsAt?.toISOString?.() ?? verification.plan.startsAt ?? null,
    } : null,
    planPlace: verification.planPlace ? {
      id: verification.planPlace.id,
      title: verification.planPlace.title,
      mode: verification.planPlace.mode ?? 'local',
      addressPublicText: verification.planPlace.addressPublicText ?? null,
      formattedAddress: verification.planPlace.formattedAddress ?? null,
      onlineLabel: verification.planPlace.onlineLabel ?? null,
    } : null,
  };
}

plansRoutes.get('/place-verifications/mine', requireAuth, asyncRoute(async (req, res) => {
  const input = listMyPlacePresenceVerificationsQuerySchema.parse(req.query);
  const verifications = await (prisma as any).placePresenceVerification.findMany({
    where: {
      userId: req.user!.id,
      ...(input.status && input.status !== 'all' ? { status: input.status } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: input.take ?? 50,
    include: {
      plan: { select: { id: true, title: true, status: true, startsAt: true } },
      planPlace: { select: { id: true, title: true, mode: true, addressPublicText: true, formattedAddress: true, onlineLabel: true } },
    },
  });

  res.json({ verifications: verifications.map(serializePrivatePlacePresenceVerification) });
}));

plansRoutes.get('/place-verifications/summary', requireAuth, asyncRoute(async (req, res) => {
  const [totalVerifiedCheckIns, lastVerified, verifiedPlaces, verifiedPlans] = await Promise.all([
    (prisma as any).placePresenceVerification.count({ where: { userId: req.user!.id, status: 'verified' } }),
    (prisma as any).placePresenceVerification.findFirst({ where: { userId: req.user!.id, status: 'verified' }, orderBy: { verifiedAt: 'desc' }, select: { verifiedAt: true } }),
    (prisma as any).placePresenceVerification.findMany({ where: { userId: req.user!.id, status: 'verified' }, distinct: ['planPlaceId'], select: { planPlaceId: true } }),
    (prisma as any).placePresenceVerification.findMany({ where: { userId: req.user!.id, status: 'verified' }, distinct: ['planId'], select: { planId: true } }),
  ]);

  res.json({
    summary: {
      verifiedPlacesCount: verifiedPlaces.length,
      verifiedPlansCount: verifiedPlans.length,
      totalVerifiedCheckIns,
      lastVerifiedAt: lastVerified?.verifiedAt?.toISOString?.() ?? null,
    },
  });
}));

plansRoutes.post('/:planId/join', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const planId = req.params.planId;
  if (!planId) return res.status(400).json({ error: 'missing_plan_id' });
  const input = createPlanJoinRequestSchema.parse(req.body ?? {});
  const participant = await joinPlanFreely(planId, req.user!.id, input.message);
  res.status(201).json({ participant });
}));

plansRoutes.post('/:planId/join-requests', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const planId = req.params.planId;
  if (!planId) return res.status(400).json({ error: 'missing_plan_id' });
  const input = createPlanJoinRequestSchema.parse(req.body ?? {});
  const participant = await joinPlanFreely(planId, req.user!.id, input.message);
  res.status(201).json({ participant });
}));

plansRoutes.get('/:planId/join-requests', requireAuth, asyncRoute(async (req, res) => {
  const plan = await prisma.plan.findFirst({ where: { id: req.params.planId, ownerId: req.user!.id } });
  if (!plan) return res.status(404).json({ error: 'not_found' });
  if (plan.deletedAt) return res.status(410).json(planDeletedResponse());
  const participants = await prisma.planParticipant.findMany({ where: { planId: plan.id }, include: { user: { select: userSummarySelect } }, orderBy: { createdAt: 'asc' } });
  res.json({ participants });
}));

plansRoutes.patch('/:planId/join-requests/:participantId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updatePlanParticipantRequestSchema.parse(req.body ?? {});
  const plan = await prisma.plan.findFirst({ where: { id: req.params.planId, ownerId: req.user!.id }, include: { participants: true } });
  if (!plan) return res.status(404).json({ error: 'not_found' });
  if (plan.deletedAt) return res.status(410).json(planDeletedResponse());
  if (isPlanInteractionLocked(plan.status)) return res.status(409).json(planInteractionLockedResponse());
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

plansRoutes.post('/:planId/leave', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const planId = req.params.planId;
  if (!planId) return res.status(400).json({ error: 'missing_plan_id' });
  const participant = await leaveJoinedPlan(planId, req.user!.id);
  res.json({ participant });
}));

plansRoutes.patch('/:planId/my-join-request', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const planId = req.params.planId;
  if (!planId) return res.status(400).json({ error: 'missing_plan_id' });
  const input = updateMyPlanParticipantRequestSchema.parse(req.body ?? {});
  if (input.status === 'left') {
    const participant = await leaveJoinedPlan(planId, req.user!.id);
    return res.json({ participant });
  }
  const participant = await prisma.planParticipant.findUnique({
    where: { planId_userId: { planId, userId: req.user!.id } },
    include: { plan: { select: { status: true, deletedAt: true } } },
  });
  if (!participant) return res.status(404).json({ error: 'not_found' });
  if (participant.plan.deletedAt) return res.status(410).json(planDeletedResponse());
  if (isPlanInteractionLocked(participant.plan.status)) return res.status(409).json(planInteractionLockedResponse());
  if (input.status === 'cancelled' && participant.status !== 'pending') return res.status(409).json({ error: 'cannot_cancel_join_request', message: 'Only pending join requests can be cancelled.' });
  const updated = await prisma.planParticipant.update({
    where: { id: participant.id },
    data: { status: input.status as any, decidedAt: new Date(), decidedById: req.user!.id },
    include: { user: { select: userSummarySelect } },
  });
  res.json({ participant: updated });
}));

plansRoutes.get('/:planId/public-messages', optionalAuth, asyncRoute(async (req, res) => {
  const input = listPlanPublicMessagesQuerySchema.parse(req.query);
  const actorId = req.user?.id ?? null;
  const planId = req.params.planId;
  if (!planId) return res.status(400).json({ error: 'missing_plan_id' });
  const plan = await loadReadablePlanForDiscussion(planId, actorId);
  if (!plan) return res.status(404).json({ error: 'not_found' });

  const messages = await prisma.planPublicMessage.findMany({
    where: {
      planId: plan.id,
      status: { not: 'hidden' },
      author: { trustTier: { not: 'restricted' } },
      ...(input.before ? { createdAt: { lt: new Date(input.before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: input.take,
    select: planPublicDiscussionMessageSelect(),
  });

  return res.json(stripAnonymousPublicProfileMedia({ messages: messages.reverse() }, actorId));
}));

plansRoutes.post('/:planId/public-messages', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createPlanPublicMessageRequestSchema.parse(req.body ?? {});
  const actorId = req.user!.id;
  const planId = req.params.planId;
  if (!planId) return res.status(400).json({ error: 'missing_plan_id' });
  const plan = await loadReadablePlanForDiscussion(planId, actorId);
  if (!plan) {
    if (await deletedPlanKnownToActor(planId, actorId)) return res.status(410).json(planDeletedResponse());
    return res.status(404).json({ error: 'not_found' });
  }
  if (!canWritePlanPublicDiscussion(plan)) {
    return res.status(409).json({ error: 'public_discussion_closed', message: 'Public discussion is closed for this plan.' });
  }

  let message = await prisma.planPublicMessage.create({
    data: { planId: plan.id, authorId: actorId, body: input.body },
    select: planPublicDiscussionMessageSelect(),
  });

  const textReview = await runAiTextReview({
    contentType: 'public_message',
    contentId: message.id,
    contentOwnerId: actorId,
    visibility: 'public',
    mode: 'create',
    message: input.body,
    actorId,
    appArea: 'plan_public_discussion_create',
  });
  const textReviewOutcome = buildAiTextReviewRouteOutcome(textReview);
  if (textReviewOutcome) {
    await applyTextReviewContentActionToTarget({
      contentType: 'public_message',
      contentId: message.id,
      action: textReviewOutcome.action,
      actorId,
      note: textReviewOutcome.message,
    });
    message = await prisma.planPublicMessage.findUniqueOrThrow({ where: { id: message.id }, select: planPublicDiscussionMessageSelect() });
    const body = { message, moderation: textReviewOutcome.moderation, moderationMessage: textReviewOutcome.message };
    if (textReviewOutcome.error) return res.status(textReviewOutcome.status).json({ error: textReviewOutcome.error, message: textReviewOutcome.message, publicMessage: message, moderation: textReviewOutcome.moderation });
    return res.status(textReviewOutcome.status).json(body);
  }

  return res.status(201).json({ message });
}));

plansRoutes.patch('/:planId/public-messages/:messageId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updatePlanPublicMessageRequestSchema.parse(req.body ?? {});
  const actorId = req.user!.id;
  const planId = req.params.planId;
  const messageId = req.params.messageId;
  if (!planId || !messageId) return res.status(400).json({ error: 'invalid_message_id' });
  const plan = await loadReadablePlanForDiscussion(planId, actorId);
  if (!plan) {
    if (await deletedPlanKnownToActor(planId, actorId)) return res.status(410).json(planDeletedResponse());
    return res.status(404).json({ error: 'not_found' });
  }
  if (!canWritePlanPublicDiscussion(plan)) {
    return res.status(409).json({ error: 'public_discussion_closed', message: 'Public discussion is closed for this plan.' });
  }

  const existing = await prisma.planPublicMessage.findUnique({ where: { id: messageId } });
  if (!existing || existing.planId !== plan.id || existing.status === 'hidden') return res.status(404).json({ error: 'not_found' });
  if (existing.authorId !== actorId) return res.status(403).json({ error: 'forbidden' });
  if (existing.status === 'deleted' || existing.deletedAt) {
    return res.status(409).json({ error: 'message_deleted', message: 'Deleted messages cannot be edited.' });
  }

  let message = await prisma.planPublicMessage.update({
    where: { id: existing.id },
    data: { body: input.body, status: 'visible', editedAt: new Date(), editCount: { increment: 1 }, deletedAt: null },
    select: planPublicDiscussionMessageSelect(),
  });

  const textReview = await runAiTextReview({
    contentType: 'public_message',
    contentId: message.id,
    contentOwnerId: actorId,
    visibility: 'public',
    mode: 'edit',
    message: input.body,
    actorId,
    appArea: 'plan_public_discussion_edit',
  });
  const textReviewOutcome = buildAiTextReviewRouteOutcome(textReview);
  if (textReviewOutcome) {
    await applyTextReviewContentActionToTarget({
      contentType: 'public_message',
      contentId: message.id,
      action: textReviewOutcome.action,
      actorId,
      note: textReviewOutcome.message,
    });
    message = await prisma.planPublicMessage.findUniqueOrThrow({ where: { id: message.id }, select: planPublicDiscussionMessageSelect() });
    const body = { message, moderation: textReviewOutcome.moderation, moderationMessage: textReviewOutcome.message };
    if (textReviewOutcome.error) return res.status(textReviewOutcome.status).json({ error: textReviewOutcome.error, message: textReviewOutcome.message, publicMessage: message, moderation: textReviewOutcome.moderation });
    return res.status(textReviewOutcome.status).json(body);
  }

  return res.json({ message });
}));

plansRoutes.delete('/:planId/public-messages/:messageId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const planId = req.params.planId;
  const messageId = req.params.messageId;
  if (!planId || !messageId) return res.status(400).json({ error: 'invalid_message_id' });
  const plan = await loadReadablePlanForDiscussion(planId, actorId);
  if (!plan) {
    if (await deletedPlanKnownToActor(planId, actorId)) return res.status(410).json(planDeletedResponse());
    return res.status(404).json({ error: 'not_found' });
  }

  const existing = await prisma.planPublicMessage.findUnique({ where: { id: messageId } });
  if (!existing || existing.planId !== plan.id || existing.status === 'hidden') return res.status(404).json({ error: 'not_found' });
  if (existing.authorId !== actorId) return res.status(403).json({ error: 'forbidden' });

  if (existing.status === 'deleted' || existing.deletedAt) {
    const message = await prisma.planPublicMessage.findUniqueOrThrow({ where: { id: existing.id }, select: planPublicDiscussionMessageSelect() });
    return res.json({ message });
  }

  const message = await prisma.planPublicMessage.update({
    where: { id: existing.id },
    data: { body: '', status: 'deleted', deletedAt: new Date() },
    select: planPublicDiscussionMessageSelect(),
  });
  return res.json({ message });
}));

plansRoutes.get('/:planId', optionalAuth, asyncRoute(async (req, res) => {
  const planId = req.params.planId;
  if (!planId) return res.status(400).json({ error: 'missing_plan_id' });
  const plan = await loadPlanForViewer(planId, req.user?.id ?? null);
  if (!plan) return res.status(404).json({ error: 'not_found' });
  res.json(stripAnonymousPublicProfileMedia({ plan }, req.user?.id));
}));
