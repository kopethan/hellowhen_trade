import type { ModerationContentType, ModerationContentVisibility, ReportReason, ReportTargetType } from '@hellowhen/contracts';
import { prisma } from '../../lib/prisma.js';

type ReportCaseInput = {
  reportId: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId?: string | null;
  reason: ReportReason;
  details?: string | null;
};

export function moderationContentTypeForReportTarget(targetType: ReportTargetType): ModerationContentType {
  if (targetType === 'user') return 'user';
  if (targetType === 'profile') return 'profile';
  if (targetType === 'trade') return 'trade';
  if (targetType === 'need') return 'need';
  if (targetType === 'offer') return 'offer';
  if (targetType === 'proposal') return 'proposal';
  if (targetType === 'message') return 'message';
  if (targetType === 'public_message') return 'public_message';
  if (targetType === 'media') return 'media';
  if (targetType === 'plan') return 'plan';
  return 'plan_place';
}

export function moderationVisibilityForReportTarget(targetType: ReportTargetType): ModerationContentVisibility {
  if (targetType === 'message' || targetType === 'proposal') return 'reported_private';
  return 'public';
}

export function moderationPriorityForReportReason(reason: ReportReason) {
  if (reason === 'illegal_unsafe') return 90;
  if (reason === 'scam' || reason === 'impersonation') return 80;
  if (reason === 'harassment') return 70;
  if (reason === 'inappropriate_image' || reason === 'fake_profile') return 60;
  if (reason === 'spam') return 40;
  return 30;
}

function reportCaseReason(input: ReportCaseInput) {
  const details = input.details?.trim();
  return details ? `User report: ${input.reason}\n\n${details}` : `User report: ${input.reason}`;
}

export async function createModerationCaseForReport(tx: any, input: ReportCaseInput) {
  const moderationCase = await tx.moderationCase.create({
    data: {
      contentType: moderationContentTypeForReportTarget(input.targetType),
      contentId: input.targetId,
      contentOwnerId: input.targetOwnerId ?? null,
      source: 'report',
      status: 'needs_review',
      priority: moderationPriorityForReportReason(input.reason),
      visibility: moderationVisibilityForReportTarget(input.targetType),
      reason: reportCaseReason(input),
    },
  });

  await tx.moderationAction.create({
    data: {
      caseId: moderationCase.id,
      action: 'case_created',
      actorType: 'user',
      actorId: input.reporterId,
      nextStatus: 'needs_review',
      note: `Report ${input.reportId} created this moderation case.`,
      metadata: {
        reportId: input.reportId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
      },
    },
  });

  return moderationCase;
}

export async function ensureReportModerationCase(report: ReportCaseInput & { moderationCaseId?: string | null }) {
  if (report.moderationCaseId) return report.moderationCaseId;
  const moderationCase = await prisma.$transaction(async (tx: any) => {
    const created = await createModerationCaseForReport(tx, report);
    await tx.report.update({ where: { id: report.reportId }, data: { moderationCaseId: created.id } });
    return created;
  });
  return moderationCase.id;
}
