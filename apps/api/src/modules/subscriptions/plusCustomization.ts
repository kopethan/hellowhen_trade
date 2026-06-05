import { normalizePreviewCardTheme, type PreviewCardTheme, hasPlusAccess } from '@hellowhen/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

export async function userCanUsePlusCustomization(userId: string): Promise<boolean> {
  if (!env.plusEnabled || !env.plusCustomizationEnabled) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  return hasPlusAccess(user);
}

export async function resolvePlusPreviewThemeForCreate(userId: string, requestedTheme?: string | null): Promise<PreviewCardTheme> {
  if (!requestedTheme) return 'default';
  const canUse = await userCanUsePlusCustomization(userId);
  return canUse ? normalizePreviewCardTheme(requestedTheme) : 'default';
}

export async function resolvePlusPreviewThemeForUpdate(userId: string, requestedTheme?: string | null): Promise<PreviewCardTheme | undefined> {
  if (requestedTheme === undefined) return undefined;
  const canUse = await userCanUsePlusCustomization(userId);
  return canUse ? normalizePreviewCardTheme(requestedTheme) : 'default';
}
