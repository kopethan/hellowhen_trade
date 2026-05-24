import { z } from 'zod';

export const usageAreaSchema = z.enum(['trades', 'trade_detail', 'proposal_thread', 'needs', 'offers', 'account', 'admin', 'other']);

export const usageHeartbeatRequestSchema = z.object({
  area: usageAreaSchema,
  routePattern: z.string().trim().min(1).max(140),
  clientId: z.string().trim().min(8).max(120).optional(),
});

export type UsageArea = z.infer<typeof usageAreaSchema>;
export type UsageHeartbeatRequest = z.infer<typeof usageHeartbeatRequestSchema>;
