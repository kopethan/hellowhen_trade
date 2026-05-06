import { z } from 'zod';

export const updateSettingsRequestSchema = z.object({
  appearance: z.enum(['system', 'light', 'dark']).optional(),
  accent: z.enum(['teal', 'blue', 'purple', 'orange']).optional(),
  language: z.string().min(2).max(12).optional(),
  notificationsEnabled: z.boolean().optional()
});

export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;

export type AppSettings = {
  appearance: 'system' | 'light' | 'dark';
  accent: 'teal' | 'blue' | 'purple' | 'orange';
  language: string;
  notificationsEnabled: boolean;
};
