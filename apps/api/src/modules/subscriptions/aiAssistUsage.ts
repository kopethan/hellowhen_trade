import {
  AI_ASSIST_QUOTA_COUNTED_STATUSES,
  buildAiAssistPeriodKey,
  buildAiAssistQuotaSnapshot,
  getPlusAiAssistQuotaForPlan,
  normalizeSubscriptionStatus,
  normalizeSubscriptionTier,
  type AiAssistTaskType,
  type AiAssistUsageStatus,
  type PlusSubscriptionFeatureFlags,
} from '@hellowhen/shared';

type AiAssistUsageClient = {
  aiAssistUsage?: {
    count: (args: unknown) => Promise<number>;
    create: (args: unknown) => Promise<unknown>;
  };
};

type AiAssistUserState = {
  id: string;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
};

export class AiAssistQuotaError extends Error {
  statusCode = 429;
  code = 'ai_assist_quota_exceeded';

  constructor(public readonly quota: AiAssistQuotaSummary) {
    super('AI assist quota exceeded for this monthly period.');
  }
}

export type AiAssistQuotaSummary = ReturnType<typeof buildAiAssistQuotaSnapshot> & {
  aiAssistEnabled: boolean;
  planTier: ReturnType<typeof normalizeSubscriptionTier>;
  subscriptionStatus: ReturnType<typeof normalizeSubscriptionStatus>;
};

export type RecordAiAssistUsageInput = {
  user: AiAssistUserState;
  taskType: AiAssistTaskType;
  status?: AiAssistUsageStatus;
  inputHash?: string | null;
  metadata?: unknown;
  errorCode?: string | null;
  requestedAt?: Date;
  completedAt?: Date | null;
  periodKey?: string;
};

export function normalizeAiAssistPeriodKey(value?: string | null, fallbackDate = new Date()) {
  const raw = String(value ?? '').trim();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : buildAiAssistPeriodKey(fallbackDate);
}

export async function getAiAssistUsageSummary(
  client: AiAssistUsageClient,
  user: AiAssistUserState,
  config: Pick<PlusSubscriptionFeatureFlags, 'aiAssistEnabled' | 'freeMonthlyAiAssistQuota' | 'plusMonthlyAiAssistQuota'>,
  periodKey = buildAiAssistPeriodKey(),
): Promise<AiAssistQuotaSummary> {
  const planTier = normalizeSubscriptionTier(user.subscriptionTier);
  const subscriptionStatus = normalizeSubscriptionStatus(user.subscriptionStatus);
  const quota = getPlusAiAssistQuotaForPlan({ subscriptionTier: planTier, subscriptionStatus }, config);
  const used = client.aiAssistUsage ? await client.aiAssistUsage.count({
    where: {
      userId: user.id,
      periodKey,
      status: { in: [...AI_ASSIST_QUOTA_COUNTED_STATUSES] },
    },
  }) : 0;

  return {
    ...buildAiAssistQuotaSnapshot({ used, quota, periodKey }),
    aiAssistEnabled: config.aiAssistEnabled,
    planTier,
    subscriptionStatus,
  };
}

export async function assertAiAssistQuotaAvailable(
  client: AiAssistUsageClient,
  user: AiAssistUserState,
  config: Pick<PlusSubscriptionFeatureFlags, 'aiAssistEnabled' | 'freeMonthlyAiAssistQuota' | 'plusMonthlyAiAssistQuota'>,
  periodKey = buildAiAssistPeriodKey(),
) {
  const summary = await getAiAssistUsageSummary(client, user, config, periodKey);
  if (summary.remaining <= 0) throw new AiAssistQuotaError(summary);
  return summary;
}

export async function recordAiAssistUsage(
  client: AiAssistUsageClient,
  config: Pick<PlusSubscriptionFeatureFlags, 'aiAssistEnabled' | 'freeMonthlyAiAssistQuota' | 'plusMonthlyAiAssistQuota'>,
  input: RecordAiAssistUsageInput,
) {
  if (!client.aiAssistUsage) return null;
  const requestedAt = input.requestedAt ?? new Date();
  const periodKey = input.periodKey ?? buildAiAssistPeriodKey(requestedAt);
  const summary = await getAiAssistUsageSummary(client, input.user, config, periodKey);
  const status = input.status ?? 'completed';
  const completedAt = input.completedAt === undefined
    ? status === 'completed' ? new Date() : null
    : input.completedAt;

  return client.aiAssistUsage.create({
    data: {
      userId: input.user.id,
      periodKey,
      taskType: input.taskType,
      status,
      planTierAtUse: summary.planTier,
      quotaLimitAtUse: summary.quota,
      inputHash: input.inputHash ?? null,
      metadata: input.metadata === undefined ? undefined : input.metadata,
      errorCode: input.errorCode ?? null,
      requestedAt,
      completedAt,
    },
  });
}
