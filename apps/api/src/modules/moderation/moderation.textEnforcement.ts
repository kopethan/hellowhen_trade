import type { ModerationContentType, ModerationTextReviewResult } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

export type AiTextReviewRouteOutcome = {
  action: 'hold_pending' | 'reject';
  status: 202 | 409;
  error?: 'content_text_review_pending' | 'content_text_review_rejected';
  message: string;
  moderation: ReturnType<typeof summarizeAiTextReviewForResponse>;
};

export function summarizeAiTextReviewForResponse(review: ModerationTextReviewResult) {
  return {
    textReview: {
      enabled: review.enabled,
      caseId: review.caseId ?? null,
      status: review.decision.status,
      contentAction: review.decision.contentAction,
      highestSeverity: review.decision.highestSeverity,
      suggestedAction: review.decision.suggestedAction,
    },
  };
}

export function buildAiTextReviewRouteOutcome(
  review: ModerationTextReviewResult,
  options: { enforceWhen?: boolean; blockHoldPending?: boolean } = {},
): AiTextReviewRouteOutcome | null {
  if (!env.aiTextReviewEnforcementEnabled) return null;
  if (!review.enabled) return null;
  if (options.enforceWhen === false) return null;

  if (review.decision.contentAction === 'reject') {
    return {
      action: 'reject',
      status: 409,
      error: 'content_text_review_rejected',
      message: 'This content cannot be published because it may break our safety rules. Please edit it and try again.',
      moderation: summarizeAiTextReviewForResponse(review),
    };
  }

  if (review.decision.contentAction === 'hold_pending') {
    return {
      action: 'hold_pending',
      status: options.blockHoldPending ? 409 : 202,
      error: options.blockHoldPending ? 'content_text_review_pending' : undefined,
      message: options.blockHoldPending
        ? 'This content needs review before it can be published. Please edit it or try again later.'
        : 'This content needs review before it can be public.',
      moderation: summarizeAiTextReviewForResponse(review),
    };
  }

  return null;
}

export async function applyTextReviewContentActionToTarget(input: {
  contentType: ModerationContentType;
  contentId: string;
  action: 'hold_pending' | 'reject';
  actorId?: string | null;
  note?: string | null;
}) {
  const note = input.note?.trim() || 'AI text review route enforcement.';
  const now = new Date();

  if (input.contentType === 'trade') {
    const updated = await prisma.trade.updateMany({
      where: { id: input.contentId },
      data: input.action === 'reject'
        ? { isPublic: false, status: 'closed', closedAt: now }
        : { isPublic: false },
    });
    return updated.count > 0;
  }

  if (input.contentType === 'need') {
    const updated = await prisma.need.updateMany({
      where: { id: input.contentId, status: { in: ['active', 'pending_review'] } },
      data: { status: input.action === 'reject' ? 'rejected' : 'pending_review' },
    });
    return updated.count > 0;
  }

  if (input.contentType === 'offer') {
    const updated = await prisma.offer.updateMany({
      where: { id: input.contentId, status: { in: ['active', 'pending_review'] } },
      data: { status: input.action === 'reject' ? 'rejected' : 'pending_review' },
    });
    return updated.count > 0;
  }

  if (input.contentType === 'public_message') {
    const [tradeUpdated, planUpdated] = await Promise.all([
      prisma.tradePublicMessage.updateMany({
        where: { id: input.contentId, status: { not: 'deleted' } },
        data: {
          status: 'hidden',
          hiddenAt: now,
          hiddenById: null,
          moderationNote: note,
        },
      }),
      prisma.planPublicMessage.updateMany({
        where: { id: input.contentId, status: { not: 'deleted' } },
        data: {
          status: 'hidden',
          hiddenAt: now,
          hiddenById: null,
          moderationNote: note,
        },
      }),
    ]);
    return tradeUpdated.count + planUpdated.count > 0;
  }

  return false;
}

export async function applyTextReviewModerationCaseAction(input: {
  contentType: ModerationContentType;
  contentId: string;
  action: 'mark_needs_review' | 'approve' | 'reject' | 'limit' | 'remove' | 'restore' | 'resolve' | 'add_note';
  source?: string | null;
  adminId: string;
  note?: string | null;
}) {
  if (input.action === 'add_note' || input.action === 'resolve') return false;
  const automaticTextCase = input.source === 'automatic';
  if (!automaticTextCase) return false;
  const now = new Date();
  const reason = input.note?.trim() || 'Admin moderation queue text review action.';

  if (input.contentType === 'trade') {
    if (input.action === 'approve' || input.action === 'restore') {
      const updated = await prisma.trade.updateMany({
        where: { id: input.contentId },
        data: { isPublic: true, status: 'active', closedAt: null },
      });
      return updated.count > 0;
    }
    if (input.action === 'mark_needs_review' || input.action === 'limit') {
      const updated = await prisma.trade.updateMany({ where: { id: input.contentId }, data: { isPublic: false } });
      return updated.count > 0;
    }
    if (input.action === 'reject' || input.action === 'remove') {
      const updated = await prisma.trade.updateMany({ where: { id: input.contentId }, data: { isPublic: false, status: 'closed', closedAt: now } });
      return updated.count > 0;
    }
  }

  if (input.contentType === 'need') {
    if (input.action === 'approve' || input.action === 'restore') {
      const updated = await prisma.need.updateMany({ where: { id: input.contentId, status: { in: ['pending_review', 'rejected', 'closed'] } }, data: { status: 'active' } });
      return updated.count > 0;
    }
    if (input.action === 'mark_needs_review') {
      const updated = await prisma.need.updateMany({ where: { id: input.contentId, status: { in: ['active', 'rejected'] } }, data: { status: 'pending_review' } });
      return updated.count > 0;
    }
    if (input.action === 'reject') {
      const updated = await prisma.need.updateMany({ where: { id: input.contentId, status: { not: 'fulfilled' } }, data: { status: 'rejected' } });
      return updated.count > 0;
    }
    if (input.action === 'limit' || input.action === 'remove') {
      const updated = await prisma.need.updateMany({ where: { id: input.contentId, status: { notIn: ['fulfilled', 'closed'] } }, data: { status: 'closed' } });
      return updated.count > 0;
    }
  }

  if (input.contentType === 'offer') {
    if (input.action === 'approve' || input.action === 'restore') {
      const updated = await prisma.offer.updateMany({ where: { id: input.contentId, status: { in: ['pending_review', 'rejected', 'closed'] } }, data: { status: 'active' } });
      return updated.count > 0;
    }
    if (input.action === 'mark_needs_review') {
      const updated = await prisma.offer.updateMany({ where: { id: input.contentId, status: { in: ['active', 'rejected'] } }, data: { status: 'pending_review' } });
      return updated.count > 0;
    }
    if (input.action === 'reject') {
      const updated = await prisma.offer.updateMany({ where: { id: input.contentId, status: { not: 'accepted' } }, data: { status: 'rejected' } });
      return updated.count > 0;
    }
    if (input.action === 'limit' || input.action === 'remove') {
      const updated = await prisma.offer.updateMany({ where: { id: input.contentId, status: { notIn: ['accepted', 'closed'] } }, data: { status: 'closed' } });
      return updated.count > 0;
    }
  }

  if (input.contentType === 'public_message') {
    if (input.action === 'approve' || input.action === 'restore') {
      const [tradeUpdated, planUpdated] = await Promise.all([
        prisma.tradePublicMessage.updateMany({
          where: { id: input.contentId, status: { not: 'deleted' } },
          data: { status: 'visible', hiddenAt: null, hiddenById: null, moderationNote: null },
        }),
        prisma.planPublicMessage.updateMany({
          where: { id: input.contentId, status: { not: 'deleted' } },
          data: { status: 'visible', hiddenAt: null, hiddenById: null, moderationNote: null },
        }),
      ]);
      return tradeUpdated.count + planUpdated.count > 0;
    }
    if (input.action === 'mark_needs_review' || input.action === 'reject' || input.action === 'limit' || input.action === 'remove') {
      const [tradeUpdated, planUpdated] = await Promise.all([
        prisma.tradePublicMessage.updateMany({
          where: { id: input.contentId, status: { not: 'deleted' } },
          data: { status: 'hidden', hiddenAt: now, hiddenById: input.adminId, moderationNote: reason },
        }),
        prisma.planPublicMessage.updateMany({
          where: { id: input.contentId, status: { not: 'deleted' } },
          data: { status: 'hidden', hiddenAt: now, hiddenById: input.adminId, moderationNote: reason },
        }),
      ]);
      return tradeUpdated.count + planUpdated.count > 0;
    }
  }

  return false;
}
