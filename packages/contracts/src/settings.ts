import { z } from 'zod';

export const updateSettingsRequestSchema = z.object({
  appearance: z.enum(['system', 'light', 'dark']).optional(),
  language: z.string().min(2).max(12).optional(),
  notificationsEnabled: z.boolean().optional()
});

export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;

export type AppSettings = {
  appearance: 'system' | 'light' | 'dark';
  language: string;
  notificationsEnabled: boolean;
};
