import { z } from 'zod';
import { mediaAssetSchema } from './media.js';
import { tradeExchangeModeSchema } from './trade.js';
export const planStatusSchema = z.enum(['draft', 'open', 'full', 'started', 'completed', 'cancelled', 'expired', 'hidden']);
export const planPublicStatusSchema = z.enum(['open', 'full', 'started']);
export const planJoinApprovalModeSchema = z.enum(['owner_approval', 'automatic']);
export const planParticipantStatusSchema = z.enum(['pending', 'accepted', 'declined', 'cancelled', 'left', 'removed']);
export const planPlaceModeSchema = z.enum(['local', 'remote']);
export const planOwnerParticipantActionSchema = z.enum(['accepted', 'declined', 'removed']);
export const planSelfParticipantActionSchema = z.enum(['cancelled', 'left']);
const planTagSchema = z.array(z.string().trim().min(1).max(32)).max(8).optional();
const planPlaceInputBaseSchema = z.object({
    mode: planPlaceModeSchema.optional(),
    title: z.string().trim().min(3).max(120),
    note: z.string().trim().min(1).max(1000).optional(),
    addressPublicText: z.string().trim().min(1).max(240).optional(),
    addressPrivateText: z.string().trim().min(1).max(240).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    order: z.number().int().min(0).max(50).optional(),
    mediaIds: z.array(z.string()).max(5).optional(),
});
export const planPlaceInputSchema = planPlaceInputBaseSchema.refine((value) => {
    if (!value.startsAt || !value.endsAt)
        return true;
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
    if (!value.endsAt)
        return true;
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
    if (!value.startsAt || value.endsAt === undefined || value.endsAt === null)
        return true;
    return new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime();
}, { message: 'Plan end time must be after the start time.', path: ['endsAt'] });
export const createPlanPlaceRequestSchema = planPlaceInputSchema;
export const updatePlanPlaceRequestSchema = planPlaceInputBaseSchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'Update at least one place field.',
}).refine((value) => {
    if (!value.startsAt || !value.endsAt)
        return true;
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
const publicUserSummarySchema = z.object({
    id: z.string(),
    profile: z.object({
        displayName: z.string().nullable().optional(),
        handle: z.string().nullable().optional(),
        avatarUrl: z.string().nullable().optional(),
        countryCode: z.string().nullable().optional(),
    }).nullable().optional(),
}).passthrough();
export const planPlaceSchema = z.object({
    id: z.string(),
    planId: z.string(),
    order: z.number().int(),
    mode: planPlaceModeSchema.default('local'),
    title: z.string(),
    note: z.string().nullable().optional(),
    addressPublicText: z.string().nullable().optional(),
    addressPrivateText: z.string().nullable().optional(),
    startsAt: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
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
export const plansResponseSchema = z.object({ plans: z.array(planSchema) });
export const planResponseSchema = z.object({ plan: planSchema });
export const planParticipantResponseSchema = z.object({ participant: planParticipantSchema });
export const planParticipantsResponseSchema = z.object({ participants: z.array(planParticipantSchema) });
//# sourceMappingURL=plans.js.map