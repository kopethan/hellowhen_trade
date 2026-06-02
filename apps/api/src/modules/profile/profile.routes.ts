import { Router } from 'express';
import { updateProfileRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { assertUsernameChangeAllowed, buildUsernameHistoryData, ensureUsernameAvailable, normalizeProfileHandle, usernameErrorPayload } from './profileUsernames.js';

export const profileRoutes = Router();

profileRoutes.use(requireAuth);

function createProfileError(error: string, message: string, status = 400) {
  return { error, message, status };
}

function getProfilePatch(input: ReturnType<typeof updateProfileRequestSchema.parse>) {
  return {
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.handle !== undefined ? { handle: normalizeProfileHandle(input.handle) } : {}),
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    // Avatar URLs are server-managed through owned MediaAsset records.
    // Do not persist client-supplied URLs here; they can become unsafe rendered content.
    ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
    ...(input.preferredCurrency !== undefined ? { preferredCurrency: input.preferredCurrency } : {})
  };
}


async function attachAvatarMedia(userId: string, profileId: string, mediaId: string) {
  const media = await prisma.mediaAsset.findFirst({ where: { id: mediaId, ownerId: userId, status: 'active' } });
  if (!media) throw createProfileError('invalid_avatar_media', 'Upload a profile image again and retry.');

  if (media.entityType && media.entityType !== 'profile') {
    throw createProfileError('avatar_media_already_attached', 'This image already belongs to another item. Upload a new copy for your profile picture.');
  }

  if (media.entityId && media.entityId !== profileId) {
    throw createProfileError('avatar_media_already_attached', 'This image already belongs to another profile. Upload a new copy for your profile picture.');
  }

  return prisma.mediaAsset.update({ where: { id: media.id }, data: { entityType: 'profile', entityId: profileId } });
}

profileRoutes.patch('/me', asyncRoute(async (req, res) => {
  const input = updateProfileRequestSchema.parse(req.body);
  const userId = req.user!.id;

  let profile;
  try {
    const patch = getProfilePatch(input);
    const now = new Date();
    const currentProfile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true, userId: true, handle: true, handleChangedAt: true },
    });
    const wantsHandleChange = Boolean('handle' in patch && patch.handle && patch.handle !== currentProfile?.handle);
    if (wantsHandleChange && patch.handle) {
      assertUsernameChangeAllowed(currentProfile, now);
      await ensureUsernameAvailable(patch.handle, { ownerProfileId: currentProfile?.id ?? null, now });
    }

    profile = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.profile.upsert({
        where: { userId },
        create: { userId, ...patch },
        update: {
          ...patch,
          ...(wantsHandleChange ? { handleChangedAt: now, handleChangeCount: { increment: 1 } } : {}),
        },
      });
      if (wantsHandleChange && patch.handle && currentProfile) {
        await tx.usernameHistory.create({
          data: buildUsernameHistoryData({
            profileId: updated.id,
            userId,
            oldHandle: currentProfile.handle,
            newHandle: patch.handle,
            changedById: userId,
            changedByRole: 'user',
            reason: 'User changed username from profile settings.',
            now,
          }),
        });
      }
      return updated;
    });
  } catch (caughtError) {
    const payload = usernameErrorPayload(caughtError);
    if (payload) return res.status(payload.status).json(payload.body);
    throw caughtError;
  }

  if (input.removeAvatar) {
    if (profile.avatarMediaId) {
      await prisma.mediaAsset.updateMany({
        where: { id: profile.avatarMediaId, ownerId: userId, entityType: 'profile', entityId: profile.id, status: { not: 'removed' } },
        data: { status: 'removed', reviewNote: 'Removed by profile owner.', reviewedAt: new Date() }
      });
    }

    profile = await prisma.profile.update({ where: { id: profile.id }, data: { avatarUrl: null, avatarMediaId: null } });
  }

  if (input.avatarMediaId) {
    try {
      const avatarMedia = await attachAvatarMedia(userId, profile.id, input.avatarMediaId);
      profile = await prisma.profile.update({ where: { id: profile.id }, data: { avatarUrl: avatarMedia.url, avatarMediaId: avatarMedia.id } });
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) {
        const payload = error as { error: string; message: string; status: number };
        return res.status(payload.status).json({ error: payload.error, message: payload.message });
      }
      throw error;
    }
  }

  if (input.preferredCurrency) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const hasMoney = Boolean(wallet && (wallet.availableBalanceCents || wallet.heldBalanceCents || wallet.pendingPayoutCents));
    if (wallet && !hasMoney) {
      await prisma.wallet.update({ where: { id: wallet.id }, data: { currency: input.preferredCurrency } });
    } else if (!wallet) {
      await prisma.wallet.create({ data: { userId, currency: input.preferredCurrency } });
    }
  }

  res.json({ profile });
}));
