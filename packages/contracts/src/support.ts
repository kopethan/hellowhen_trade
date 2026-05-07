import { z } from 'zod';

export const supportTicketCategorySchema = z.enum([
  'general_feedback',
  'trade_issue',
  'credits_issue',
  'media_issue',
  'bug_report',
  'account_issue',
  'safety_concern',
]);

export const supportTicketStatusSchema = z.enum(['open', 'in_review', 'waiting_for_user', 'resolved', 'closed']);
export const supportTicketPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export const supportMessageSenderRoleSchema = z.enum(['user', 'admin', 'system']);

export const createSupportTicketRequestSchema = z.object({
  category: supportTicketCategorySchema,
  subject: z.string().min(3).max(140),
  message: z.string().min(10).max(4000),
  priority: supportTicketPrioritySchema.default('normal').optional(),
  relatedTradeId: z.string().min(1).optional(),
  relatedProposalId: z.string().min(1).optional(),
  relatedMediaId: z.string().min(1).optional(),
});

export const createSupportMessageRequestSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const updateSupportTicketStatusRequestSchema = z.object({
  status: supportTicketStatusSchema,
});

export const adminUpdateSupportTicketRequestSchema = z.object({
  status: supportTicketStatusSchema.optional(),
  priority: supportTicketPrioritySchema.optional(),
  assignedAdminId: z.string().nullable().optional(),
});

export const adminCreateSupportMessageRequestSchema = z.object({
  body: z.string().min(1).max(4000),
  internal: z.boolean().optional(),
  status: supportTicketStatusSchema.optional(),
});

export const supportUserPreviewSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  profile: z.object({ displayName: z.string().nullable().optional(), handle: z.string().nullable().optional(), avatarUrl: z.string().nullable().optional() }).nullable().optional(),
}).nullable().optional();

export const supportTicketMessageSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  senderId: z.string(),
  senderRole: supportMessageSenderRoleSchema,
  body: z.string(),
  internal: z.boolean(),
  createdAt: z.string(),
  sender: supportUserPreviewSchema.optional(),
});

export const supportTicketSchema = z.object({
  id: z.string(),
  userId: z.string(),
  category: supportTicketCategorySchema,
  subject: z.string(),
  message: z.string(),
  status: supportTicketStatusSchema,
  priority: supportTicketPrioritySchema,
  relatedTradeId: z.string().nullable().optional(),
  relatedProposalId: z.string().nullable().optional(),
  relatedMediaId: z.string().nullable().optional(),
  assignedAdminId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable().optional(),
  user: supportUserPreviewSchema.optional(),
  assignedAdmin: supportUserPreviewSchema.optional(),
  messages: z.array(supportTicketMessageSchema).optional(),
});

export type SupportTicketCategory = z.infer<typeof supportTicketCategorySchema>;
export type SupportTicketStatus = z.infer<typeof supportTicketStatusSchema>;
export type SupportTicketPriority = z.infer<typeof supportTicketPrioritySchema>;
export type SupportMessageSenderRole = z.infer<typeof supportMessageSenderRoleSchema>;
export type CreateSupportTicketRequest = z.infer<typeof createSupportTicketRequestSchema>;
export type CreateSupportMessageRequest = z.infer<typeof createSupportMessageRequestSchema>;
export type UpdateSupportTicketStatusRequest = z.infer<typeof updateSupportTicketStatusRequestSchema>;
export type AdminUpdateSupportTicketRequest = z.infer<typeof adminUpdateSupportTicketRequestSchema>;
export type AdminCreateSupportMessageRequest = z.infer<typeof adminCreateSupportMessageRequestSchema>;
export type SupportTicketDto = z.infer<typeof supportTicketSchema>;
export type SupportTicketMessageDto = z.infer<typeof supportTicketMessageSchema>;
