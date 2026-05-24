import type { PrismaClient } from '@prisma/client';

export const USAGE_PRESENCE_RETENTION_HOURS = 72;
export const API_METRICS_RETENTION_HOURS = 72;
export const USAGE_LIVE_WINDOW_MINUTES = 5;
export const USAGE_ACTIVITY_WINDOW_MINUTES = 15;
export const USAGE_MONITORING_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export const USAGE_MONITORING_PRIVACY_NOTE = 'Operational presence, API timing, and simple usage weight only. Private messages, proposal content, request bodies, query strings, uploaded content, and raw private URLs are never stored or returned here.';

export type UsageMonitoringCleanupResult = {
  presenceRetentionHours: number;
  apiMetricsRetentionHours: number;
  presenceCutoff: Date;
  apiMetricsCutoff: Date;
  presenceCleanupAvailable: boolean;
  apiMetricsCleanupAvailable: boolean;
};

type UsageMonitoringPrisma = PrismaClient & {
  usageHeartbeat?: { deleteMany?: (args: unknown) => Promise<unknown> };
  apiRequestMetric?: { deleteMany?: (args: unknown) => Promise<unknown> };
};

export function usageMonitoringCutoff(now: Date, retentionHours: number) {
  return new Date(now.getTime() - retentionHours * 60 * 60 * 1000);
}

export function usageMonitoringWindowStart(now: Date, windowMinutes: number) {
  return new Date(now.getTime() - windowMinutes * 60 * 1000);
}

export async function cleanupUsageMonitoringData(client: PrismaClient, now = new Date()): Promise<UsageMonitoringCleanupResult> {
  const usageClient = client as UsageMonitoringPrisma;
  const presenceCutoff = usageMonitoringCutoff(now, USAGE_PRESENCE_RETENTION_HOURS);
  const apiMetricsCutoff = usageMonitoringCutoff(now, API_METRICS_RETENTION_HOURS);
  const presenceCleanupAvailable = Boolean(usageClient.usageHeartbeat?.deleteMany);
  const apiMetricsCleanupAvailable = Boolean(usageClient.apiRequestMetric?.deleteMany);

  await Promise.all([
    presenceCleanupAvailable ? usageClient.usageHeartbeat!.deleteMany!({ where: { lastSeenAt: { lt: presenceCutoff } } }) : Promise.resolve(),
    apiMetricsCleanupAvailable ? usageClient.apiRequestMetric!.deleteMany!({ where: { createdAt: { lt: apiMetricsCutoff } } }) : Promise.resolve(),
  ]);

  return {
    presenceRetentionHours: USAGE_PRESENCE_RETENTION_HOURS,
    apiMetricsRetentionHours: API_METRICS_RETENTION_HOURS,
    presenceCutoff,
    apiMetricsCutoff,
    presenceCleanupAvailable,
    apiMetricsCleanupAvailable,
  };
}
