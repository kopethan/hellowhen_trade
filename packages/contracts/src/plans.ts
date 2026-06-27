import { z } from 'zod';
import { mediaAssetSchema } from './media.js';
import { discoveryLanguageSchema, inventoryTranslationSchema, tradeExchangeModeSchema } from './trade.js';

export const planStatusSchema = z.enum(['draft', 'open', 'full', 'started', 'completed', 'cancelled', 'expired', 'hidden']);
export const planPublicStatusSchema = z.enum(['open', 'full', 'started']);
export const planJoinApprovalModeSchema = z.enum(['owner_approval', 'automatic']);
export const planParticipantStatusSchema = z.enum(['pending', 'accepted', 'declined', 'cancelled', 'left', 'removed']);
export const planPlaceModeSchema = z.enum(['local', 'remote']);
export const placeSourceSchema = z.enum(['user', 'hellowhen_library']);
export const placeStatusSchema = z.enum(['draft', 'active', 'archived', 'hidden']);
export const placeVisibilitySchema = z.enum(['private', 'public', 'library']);
export const planPlaceSourceSchema = z.enum(['custom', 'my_place', 'hellowhen_library']);

export const PLAN_PLACE_MEDIA_LIMITS = {
  free: 1,
  plus: 5,
  adminLibrary: 6,
} as const;

export const planOwnerParticipantActionSchema = z.enum(['accepted', 'declined', 'removed']);
export const planSelfParticipantActionSchema = z.enum(['cancelled', 'left']);

const planTagSchema = z.array(z.string().trim().min(1).max(32)).max(8).optional();
const placeTagSchema = z.array(z.string().trim().min(1).max(32)).max(8).optional();
const placeMediaIdsSchema = z.array(z.string()).max(PLAN_PLACE_MEDIA_LIMITS.adminLibrary).optional();
const placeTranslationInputSchema = z.object({
  languageCode: discoveryLanguageSchema,
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(2000),
});
const placeTranslationsInputSchema = z.array(placeTranslationInputSchema).max(4).optional();
const planPlaceMediaIdsSchema = z.array(z.string()).max(PLAN_PLACE_MEDIA_LIMITS.plus).optional();

const reusablePlaceInputBaseSchema = z.object({
  mode: planPlaceModeSchema.optional(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(2000).optional(),
  defaultLanguage: discoveryLanguageSchema.optional(),
  translations: placeTranslationsInputSchema,
  category: z.string().trim().min(1).max(80).optional(),
  tags: placeTagSchema,
  areaLabel: z.string().trim().min(1).max(160).optional(),
  addressPublicText: z.string().trim().min(1).max(240).optional(),
  addressPrivateText: z.string().trim().min(1).max(240).optional(),
  onlineLabel: z.string().trim().min(1).max(120).optional(),
  onlineUrl: z.string().trim().url().max(500).optional(),
  defaultDurationMinutes: z.number().int().min(5).max(24 * 60).optional(),
  defaultNote: z.string().trim().min(1).max(1000).optional(),
  defaultMeetingInstructions: z.string().trim().min(1).max(1000).optional(),
  mediaIds: placeMediaIdsSchema,
});

export const createPlaceRequestSchema = reusablePlaceInputBaseSchema.extend({
  source: placeSourceSchema.optional(),
  visibility: placeVisibilitySchema.optional(),
  status: z.enum(['draft', 'active']).optional(),
});

export const updatePlaceRequestSchema = reusablePlaceInputBaseSchema.partial().extend({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  visibility: placeVisibilitySchema.optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Update at least one place field.',
});

export const listPlacesQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  source: placeSourceSchema.optional(),
  status: placeStatusSchema.optional(),
  mode: planPlaceModeSchema.optional(),
  category: z.string().trim().min(1).max(80).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

const planPlaceInputBaseSchema = z.object({
  placeId: z.string().trim().min(1).max(120).optional(),
  mode: planPlaceModeSchema.optional(),
  title: z.string().trim().min(3).max(120).optional(),
  note: z.string().trim().min(1).max(1000).optional(),
  addressPublicText: z.string().trim().min(1).max(240).optional(),
  addressPrivateText: z.string().trim().min(1).max(240).optional(),
  onlineLabel: z.string().trim().min(1).max(120).optional(),
  onlineUrl: z.string().trim().url().max(500).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  order: z.number().int().min(0).max(50).optional(),
  mediaIds: planPlaceMediaIdsSchema,
});

function hasPlaceIdOrTitle(value: { placeId?: string; title?: string }) {
  return Boolean(value.placeId || value.title);
}

export const planPlaceInputSchema = planPlaceInputBaseSchema.refine(hasPlaceIdOrTitle, {
  message: 'Choose a saved place or enter a place title.',
  path: ['title'],
}).refine((value) => {
  if (!value.startsAt || !value.endsAt) return true;
  return new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime();
}, { message: 'Place end time must be after the start time.', path: ['endsAt'] });

export const createPlanRequestSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  tags: planTagSchema,
  mode: tradeExchangeModeSchema.optional(),
  locationLabel: z.string().trim().min(1).max(160).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  maxParticipants: z.number().int().min(1).max(100).optional(),
  joinApprovalMode: planJoinApprovalModeSchema.optional().default('automatic'),
  status: z.enum(['draft', 'open']).optional().default('open'),
  mediaIds: z.array(z.string()).max(5).optional(),
  places: z.array(planPlaceInputSchema).max(12).optional(),
}).refine((value) => {
  if (!value.endsAt) return true;
  return new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime();
}, { message: 'Plan end time must be after the start time.', path: ['endsAt'] });

export const updatePlanRequestSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  tags: planTagSchema,
  mode: tradeExchangeModeSchema.nullable().optional(),
  locationLabel: z.string().trim().min(1).max(160).nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  maxParticipants: z.number().int().min(1).max(100).nullable().optional(),
  joinApprovalMode: planJoinApprovalModeSchema.optional(),
  status: z.enum(['draft', 'open', 'cancelled']).optional(),
  mediaIds: z.array(z.string()).max(5).optional(),
}).refine((value) => {
  if (!value.startsAt || value.endsAt === undefined || value.endsAt === null) return true;
  return new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime();
}, { message: 'Plan end time must be after the start time.', path: ['endsAt'] });

export const createPlanPlaceRequestSchema = planPlaceInputSchema;
export const updatePlanPlaceRequestSchema = planPlaceInputBaseSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'Update at least one place field.',
}).refine((value) => {
  if (value.placeId === undefined && value.title === undefined) return true;
  return hasPlaceIdOrTitle(value);
}, {
  message: 'Choose a saved place or enter a place title.',
  path: ['title'],
}).refine((value) => {
  if (!value.startsAt || !value.endsAt) return true;
  return new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime();
}, { message: 'Place end time must be after the start time.', path: ['endsAt'] });

export const listPlansQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  mode: tradeExchangeModeSchema.optional(),
  status: planPublicStatusSchema.optional(),
  city: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

export const createPlanJoinRequestSchema = z.object({
  message: z.string().trim().min(3).max(1000).optional(),
});

export const updatePlanParticipantRequestSchema = z.object({
  status: planOwnerParticipantActionSchema,
});

export const updateMyPlanParticipantRequestSchema = z.object({
  status: planSelfParticipantActionSchema,
});

export const createPlanPublicMessageRequestSchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const updatePlanPublicMessageRequestSchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const listPlanPublicMessagesQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
  before: z.string().datetime().optional(),
});

const publicUserSummarySchema = z.object({
  id: z.string(),
  profile: z.object({
    displayName: z.string().nullable().optional(),
    handle: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    countryCode: z.string().nullable().optional(),
  }).nullable().optional(),
}).passthrough();

export const placeSchema = z.object({
  id: z.string(),
  ownerId: z.string().nullable().optional(),
  source: placeSourceSchema,
  status: placeStatusSchema,
  visibility: placeVisibilitySchema,
  mode: planPlaceModeSchema.default('local'),
  title: z.string(),
  description: z.string().nullable().optional(),
  defaultLanguage: discoveryLanguageSchema.optional().default('en'),
  translations: z.array(inventoryTranslationSchema).optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  areaLabel: z.string().nullable().optional(),
  addressPublicText: z.string().nullable().optional(),
  addressPrivateText: z.string().nullable().optional(),
  onlineLabel: z.string().nullable().optional(),
  onlineUrl: z.string().nullable().optional(),
  defaultDurationMinutes: z.number().int().nullable().optional(),
  defaultNote: z.string().nullable().optional(),
  defaultMeetingInstructions: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable().optional(),
  owner: publicUserSummarySchema.nullable().optional(),
  media: z.array(mediaAssetSchema).optional(),
}).passthrough();

export const planPlaceSchema = z.object({
  id: z.string(),
  planId: z.string(),
  placeId: z.string().nullable().optional(),
  source: planPlaceSourceSchema.optional(),
  order: z.number().int(),
  mode: planPlaceModeSchema.default('local'),
  title: z.string(),
  note: z.string().nullable().optional(),
  addressPublicText: z.string().nullable().optional(),
  addressPrivateText: z.string().nullable().optional(),
  onlineLabel: z.string().nullable().optional(),
  onlineUrl: z.string().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sourcePlace: placeSchema.nullable().optional(),
  media: z.array(mediaAssetSchema).optional(),
}).passthrough();

export const planParticipantSchema = z.object({
  id: z.string(),
  planId: z.string(),
  userId: z.string(),
  message: z.string().nullable().optional(),
  status: planParticipantStatusSchema,
  decidedAt: z.string().nullable().optional(),
  decidedById: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  user: publicUserSummarySchema.nullable().optional(),
}).passthrough();

export const planPublicMessageStatusSchema = z.enum(['visible', 'hidden', 'deleted']);
export const planPublicMessageSchema = z.object({
  id: z.string(),
  planId: z.string(),
  authorId: z.string(),
  body: z.string(),
  status: planPublicMessageStatusSchema.optional().default('visible'),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  editedAt: z.string().nullable().optional(),
  editCount: z.number().int().optional().default(0),
  deletedAt: z.string().nullable().optional(),
  hiddenAt: z.string().nullable().optional(),
  author: publicUserSummarySchema.optional(),
}).passthrough();

export const planPublicMessagesResponseSchema = z.object({ messages: z.array(planPublicMessageSchema) });
export const planPublicMessageResponseSchema = z.object({ message: planPublicMessageSchema });

export const planSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  mode: tradeExchangeModeSchema.nullable().optional(),
  locationLabel: z.string().nullable().optional(),
  startsAt: z.string(),
  endsAt: z.string().nullable().optional(),
  maxParticipants: z.number().int().nullable().optional(),
  joinApprovalMode: planJoinApprovalModeSchema,
  status: planStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  cancelledAt: z.string().nullable().optional(),
  owner: publicUserSummarySchema.nullable().optional(),
  places: z.array(planPlaceSchema).optional(),
  media: z.array(mediaAssetSchema).optional(),
  participants: z.array(planParticipantSchema).optional(),
  participantCount: z.number().int().optional(),
  pendingRequestCount: z.number().int().optional(),
  myParticipantStatus: planParticipantStatusSchema.nullable().optional(),
  canSeePrivatePlaceDetails: z.boolean().optional(),
}).passthrough();

export const placesResponseSchema = z.object({ places: z.array(placeSchema) });
export const placeResponseSchema = z.object({ place: placeSchema });
export const plansResponseSchema = z.object({ plans: z.array(planSchema) });
export const planResponseSchema = z.object({ plan: planSchema });
export const planParticipantResponseSchema = z.object({ participant: planParticipantSchema });
export const planParticipantsResponseSchema = z.object({ participants: z.array(planParticipantSchema) });

export type PlanStatus = z.infer<typeof planStatusSchema>;
export type PlanJoinApprovalMode = z.infer<typeof planJoinApprovalModeSchema>;
export type PlanParticipantStatus = z.infer<typeof planParticipantStatusSchema>;
export type PlanPlaceMode = z.infer<typeof planPlaceModeSchema>;
export type PlaceSource = z.infer<typeof placeSourceSchema>;
export type PlaceStatus = z.infer<typeof placeStatusSchema>;
export type PlaceVisibility = z.infer<typeof placeVisibilitySchema>;
export type PlanPlaceSource = z.infer<typeof planPlaceSourceSchema>;
export type CreatePlaceRequest = z.infer<typeof createPlaceRequestSchema>;
export type UpdatePlaceRequest = z.infer<typeof updatePlaceRequestSchema>;
export type ListPlacesQuery = z.infer<typeof listPlacesQuerySchema>;
export type CreatePlanRequest = z.infer<typeof createPlanRequestSchema>;
export type UpdatePlanRequest = z.infer<typeof updatePlanRequestSchema>;
export type CreatePlanPlaceRequest = z.infer<typeof createPlanPlaceRequestSchema>;
export type UpdatePlanPlaceRequest = z.infer<typeof updatePlanPlaceRequestSchema>;
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;
export type CreatePlanJoinRequest = z.infer<typeof createPlanJoinRequestSchema>;
export type UpdatePlanParticipantRequest = z.infer<typeof updatePlanParticipantRequestSchema>;
export type UpdateMyPlanParticipantRequest = z.infer<typeof updateMyPlanParticipantRequestSchema>;
export type CreatePlanPublicMessageRequest = z.infer<typeof createPlanPublicMessageRequestSchema>;
export type UpdatePlanPublicMessageRequest = z.infer<typeof updatePlanPublicMessageRequestSchema>;
export type ListPlanPublicMessagesQuery = z.infer<typeof listPlanPublicMessagesQuerySchema>;
export type PlaceDto = z.infer<typeof placeSchema>;
export type PlanDto = z.infer<typeof planSchema>;
export type PlanPlaceDto = z.infer<typeof planPlaceSchema>;
export type PlanParticipantDto = z.infer<typeof planParticipantSchema>;
export type PlanPublicMessageStatus = z.infer<typeof planPublicMessageStatusSchema>;
export type PlanPublicMessageDto = z.infer<typeof planPublicMessageSchema>;
export type PlaceResponse = z.infer<typeof placeResponseSchema>;
export type PlacesResponse = z.infer<typeof placesResponseSchema>;
export type PlanResponse = z.infer<typeof planResponseSchema>;
export type PlansResponse = z.infer<typeof plansResponseSchema>;
export type PlanParticipantResponse = z.infer<typeof planParticipantResponseSchema>;
export type PlanParticipantsResponse = z.infer<typeof planParticipantsResponseSchema>;
export type PlanPublicMessagesResponse = z.infer<typeof planPublicMessagesResponseSchema>;
export type PlanPublicMessageResponse = z.infer<typeof planPublicMessageResponseSchema>;
