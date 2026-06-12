import { normalizePreviewCardTheme, type PreviewCardTheme, hasPlusAccess } from '@hellowhen/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { loadMembershipAccessStateForUser } from './membershipEntitlements.js';

export async function userCanUsePlusCustomization(userId: string): Promise<boolean> {
  if (!env.plusEnabled || !env.plusCustomizationEnabled) return false;
  const accessState = await loadMembershipAccessStateForUser(prisma as any, userId);
  return hasPlusAccess(accessState);
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
