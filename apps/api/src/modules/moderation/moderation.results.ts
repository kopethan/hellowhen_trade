import type { ModerationProviderResult } from '@hellowhen/contracts';
import { env } from '../../config/env.js';

type TransactionClient = {
  moderationResult: { create(input: { data: Record<string, unknown> }): Promise<unknown> };
  moderationAction: { create(input: { data: Record<string, unknown> }): Promise<unknown> };
};

export function moderationActionForProviderResult(result: ModerationProviderResult) {
  if (result.status === 'failed') return 'provider_scan_failed' as const;
  if (result.status === 'skipped') return 'provider_scan_skipped' as const;
  return 'provider_result_stored' as const;
}

export function moderationScoresForProviderResult(result: ModerationProviderResult) {
  return {
    highestSeverity: result.highestSeverity,
    suggestedAction: result.suggestedAction,
    providerRequestId: result.providerRequestId ?? null,
    durationMs: result.durationMs ?? null,
    attemptCount: result.attemptCount ?? null,
    retriable: result.retriable ?? null,
  };
}

export function moderationProviderResultMetadata(result: ModerationProviderResult) {
  return {
    provider: result.provider,
    scanType: result.scanType,
    status: result.status,
    highestSeverity: result.highestSeverity,
    suggestedAction: result.suggestedAction,
    providerRequestId: result.providerRequestId ?? null,
    durationMs: result.durationMs ?? null,
    attemptCount: result.attemptCount ?? null,
    retriable: result.retriable ?? null,
    errorCode: result.errorCode ?? null,
  };
}

export async function storeModerationProviderResult(tx: TransactionClient, caseId: string, result: ModerationProviderResult) {
  await tx.moderationResult.create({
    data: {
      caseId,
      provider: result.provider,
      scanType: result.scanType,
      status: result.status,
      labelsJson: result.labels ?? [],
      scoresJson: moderationScoresForProviderResult(result),
      highestSeverity: result.highestSeverity,
      suggestedAction: result.suggestedAction,
      reason: result.reason ?? null,
      rawJson: env.moderationStoreRawProviderResult ? (result.raw ?? null) : null,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
    },
  });

  await tx.moderationAction.create({
    data: {
      caseId,
      action: moderationActionForProviderResult(result),
      actorType: 'system',
      note: result.reason ?? 'Moderation provider result stored.',
      metadata: moderationProviderResultMetadata(result),
    },
  });
}
