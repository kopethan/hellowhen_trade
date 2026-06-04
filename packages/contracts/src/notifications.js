import { z } from 'zod';
export const inAppNotificationTypeSchema = z.enum([
    'trade_proposal_received',
    'trade_proposal_accepted',
    'trade_proposal_declined',
    'trade_proposal_withdrawn',
    'proposal_message_received',
    'support_ticket_updated',
    'content_moderation_updated',
    'trade_status_updated'
]);
const queryBooleanSchema = z.preprocess((value) => {
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
    }
    return value;
}, z.boolean());
export const listNotificationsQuerySchema = z.object({
    take: z.coerce.number().int().min(1).max(100).optional().default(50),
    unreadOnly: queryBooleanSchema.optional().default(false)
});
export const notificationMetadataSchema = z.record(z.string(), z.unknown()).nullable().optional();
export const notificationSchema = z.object({
    id: z.string(),
    type: inAppNotificationTypeSchema,
    title: z.string(),
    body: z.string(),
    targetPath: z.string().nullable().optional(),
    tradeId: z.string().nullable().optional(),
    proposalId: z.string().nullable().optional(),
    supportTicketId: z.string().nullable().optional(),
    metadata: notificationMetadataSchema,
    readAt: z.string().nullable().optional(),
    createdAt: z.string()
});
export const notificationsResponseSchema = z.object({
    notifications: z.array(notificationSchema),
    unreadCount: z.number().int().min(0)
});
export const notificationResponseSchema = z.object({ notification: notificationSchema });
export const notificationUnreadCountResponseSchema = z.object({ unreadCount: z.number().int().min(0) });
export const markAllNotificationsReadResponseSchema = z.object({ updatedCount: z.number().int().min(0), unreadCount: z.number().int().min(0) });
