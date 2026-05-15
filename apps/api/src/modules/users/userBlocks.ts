import { prisma } from '../../lib/prisma.js';

export async function usersHaveBlockBetween(firstUserId: string, secondUserId?: string | null) {
  if (!secondUserId || firstUserId === secondUserId) return false;
  const count = await prisma.userBlock.count({
    where: {
      OR: [
        { blockerId: firstUserId, blockedId: secondUserId },
        { blockerId: secondUserId, blockedId: firstUserId },
      ],
    },
  });
  return count > 0;
}

export async function userBlockState(viewerId: string, profileUserId: string) {
  if (viewerId === profileUserId) return { isBlockedByMe: false, isBlockingMe: false };
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: profileUserId },
        { blockerId: profileUserId, blockedId: viewerId },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  return {
    isBlockedByMe: blocks.some((block) => block.blockerId === viewerId && block.blockedId === profileUserId),
    isBlockingMe: blocks.some((block) => block.blockerId === profileUserId && block.blockedId === viewerId),
  };
}
