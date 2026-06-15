import type {
  ModerationContentType,
  ModerationContentVisibility,
  ModerationTextReviewMode,
  ModerationTextReviewResult,
  ModerationTextReviewSurface,
} from '@hellowhen/contracts';
import { moderationTextReviewResultSchema } from '@hellowhen/contracts';
import { textReviewDecisionForProviderResult } from '@hellowhen/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { buildMinimalModerationPayload } from './moderation.payloads.js';
import { scanWithConfiguredModerationProvider } from './moderation.provider.js';
import { storeModerationProviderResult } from './moderation.results.js';

type TextModerationReviewInput = {
  contentType: ModerationContentType;
  contentId: string;
  contentOwnerId?: string | null;
  visibility: ModerationContentVisibility;
  mode: ModerationTextReviewMode;
  title?: string | null;
  description?: string | null;
  message?: string | null;
  locale?: 'en' | 'fr' | 'es';
  actorId?: string | null;
  appArea?: string | null;
  relatedTradeId?: string | null;
  relatedReportId?: string | null;
  priority?: number;
  reason?: string | null;
};

const publicTextContentTypes = new Set<ModerationContentType>(['trade', 'need', 'offer', 'profile', 'public_message']);
const privateTextContentTypes = new Set<ModerationContentType>(['message', 'proposal']);

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function hasReviewableText(input: Pick<TextModerationReviewInput, 'title' | 'description' | 'message'>) {
  return Boolean(clean(input.title) || clean(input.description) || clean(input.message));
}

export function textReviewSurfaceForContentType(contentType: ModerationContentType): ModerationTextReviewSurface | null {
  if (contentType === 'trade') return 'trade';
  if (contentType === 'need') return 'need';
  if (contentType === 'offer') return 'offer';
  if (contentType === 'profile' || contentType === 'user') return 'profile';
  if (contentType === 'public_message') return 'public_message';
  if (contentType === 'message' || contentType === 'proposal') return 'private_message';
  return null;
}

export function isAiTextReviewEnabledForSurface(surface: ModerationTextReviewSurface, mode: ModerationTextReviewMode) {
  if (!env.moderationEnabled || !env.moderationTextEnabled) return false;
  if (mode === 'create' && !env.aiTextReviewOnCreateEnabled) return false;
  if (mode === 'edit' && !env.aiTextReviewOnEditEnabled) return false;
  if (surface === 'public_message' && !env.aiTextReviewPublicMessagesEnabled) return false;
  if (surface === 'profile' && !env.aiTextReviewProfileEnabled) return false;
  if (surface === 'private_message' && (!env.aiTextReviewPrivateMessagesEnabled || !env.moderationPrivateMessageScanEnabled)) return false;
  return true;
}

function disabledTextReviewResult(reason: string): ModerationTextReviewResult {
  return moderationTextReviewResultSchema.parse({
    enabled: false,
    caseId: null,
    providerResult: null,
    decision: {
      status: 'skipped',
      contentAction: 'none',
      caseStatus: 'skipped',
      highestSeverity: 'none',
      suggestedAction: 'no_action',
      reason,
    },
  });
}

function defaultReason(input: TextModerationReviewInput) {
  const surface = textReviewSurfaceForContentType(input.contentType) ?? input.contentType;
  const action = input.mode === 'edit' ? 'edited' : input.mode === 'create' ? 'created' : input.mode;
  return `AI text review pipeline queued for ${action} ${surface} content.`;
}

function priorityForDecision(status: string, fallback: number) {
  if (status === 'rejected') return Math.max(fallback, 85);
  if (status === 'needs_review') return Math.max(fallback, 65);
  if (status === 'provider_failed') return Math.max(fallback, 45);
  return fallback;
}

export async function runAiTextReview(input: TextModerationReviewInput): Promise<ModerationTextReviewResult> {
  const surface = textReviewSurfaceForContentType(input.contentType);
  if (!surface) return disabledTextReviewResult('This content type is not configured for text review.');
  if (!hasReviewableText(input)) return disabledTextReviewResult('No reviewable text was provided.');
  if (!isAiTextReviewEnabledForSurface(surface, input.mode)) return disabledTextReviewResult('AI text review is disabled by feature flags.');
  if (input.visibility === 'private' && !privateTextContentTypes.has(input.contentType)) return disabledTextReviewResult('Private text review is only configured for message-like content.');
  if (input.visibility === 'public' && !publicTextContentTypes.has(input.contentType)) return disabledTextReviewResult('Public text review is only configured for public content surfaces.');

  const payload = buildMinimalModerationPayload({
    contentId: input.contentId,
    contentType: input.contentType,
    visibility: input.visibility,
    scanType: 'text',
    title: input.title,
    description: input.description,
    message: input.message,
    locale: input.locale,
    country: 'FR',
    appArea: input.appArea ?? `${surface}_text`,
    relatedTradeId: input.relatedTradeId,
    relatedReportId: input.relatedReportId,
  });

  const providerResult = await scanWithConfiguredModerationProvider(payload);
  const decision = textReviewDecisionForProviderResult(providerResult, env.moderationTextFailMode);
  const priority = priorityForDecision(decision.status, input.priority ?? 40);
  const now = new Date();
  const resolved = decision.caseStatus === 'approved' || decision.caseStatus === 'skipped';

  const moderationCase = await prisma.$transaction(async (tx: any) => {
    const existing = await tx.moderationCase.findFirst({
      where: {
        contentType: input.contentType,
        contentId: input.contentId,
        source: 'automatic',
      },
      orderBy: { createdAt: 'desc' },
    });

    const caseData = {
      contentOwnerId: input.contentOwnerId ?? null,
      visibility: input.visibility,
      status: decision.caseStatus,
      priority,
      reason: input.reason?.trim() || defaultReason(input),
      resolvedById: null,
      resolvedAt: resolved ? now : null,
    };

    const moderationCase = existing
      ? await tx.moderationCase.update({
        where: { id: existing.id },
        data: caseData,
      })
      : await tx.moderationCase.create({
        data: {
          contentType: input.contentType,
          contentId: input.contentId,
          contentOwnerId: input.contentOwnerId ?? null,
          source: 'automatic',
          status: decision.caseStatus,
          priority,
          visibility: input.visibility,
          reason: input.reason?.trim() || defaultReason(input),
          resolvedAt: resolved ? now : null,
        },
      });

    if (!existing) {
      await tx.moderationAction.create({
        data: {
          caseId: moderationCase.id,
          action: 'case_created',
          actorType: input.actorId ? 'user' : 'system',
          actorId: input.actorId ?? null,
          nextStatus: decision.caseStatus,
          note: 'AI text review case created by the provider-neutral text pipeline.',
          metadata: {
            contentType: input.contentType,
            contentId: input.contentId,
            surface,
            mode: input.mode,
            decision,
          },
        },
      });
    }

    await storeModerationProviderResult(tx, moderationCase.id, providerResult);

    await tx.moderationAction.create({
      data: {
        caseId: moderationCase.id,
        action: decision.caseStatus === 'approved'
          ? 'approve'
          : decision.caseStatus === 'skipped'
            ? 'resolve'
            : decision.caseStatus === 'failed'
              ? 'provider_scan_failed'
              : 'mark_needs_review',
        actorType: 'system',
        previousStatus: existing?.status ?? null,
        nextStatus: decision.caseStatus,
        note: decision.reason ?? 'AI text review decision recorded.',
        metadata: {
          contentType: input.contentType,
          contentId: input.contentId,
          surface,
          mode: input.mode,
          decision,
        },
      },
    });

    return moderationCase;
  });

  return moderationTextReviewResultSchema.parse({
    enabled: true,
    caseId: moderationCase.id,
    providerResult,
    decision,
  });
}
