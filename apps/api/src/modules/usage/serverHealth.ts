import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';

export type ServerHealthStatus = 'ok' | 'warning' | 'error';

const apiStartedAt = new Date();

function bytesToMiB(value: number) {
  return Math.round((value / 1024 / 1024) * 10) / 10;
}

function durationMsFrom(startedAt: bigint) {
  return Math.max(0, Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000));
}

async function checkDatabase(client: PrismaClient) {
  const startedAt = process.hrtime.bigint();
  try {
    await client.$queryRaw`SELECT 1`;
    return {
      status: 'ok' as const,
      responseTimeMs: durationMsFrom(startedAt),
      message: 'Database ping succeeded.',
    };
  } catch {
    return {
      status: 'error' as const,
      responseTimeMs: durationMsFrom(startedAt),
      message: 'Database ping failed.',
    };
  }
}

export async function buildAdminServerHealth(client: PrismaClient) {
  const generatedAt = new Date();
  const uptimeSeconds = Math.max(0, Math.floor(process.uptime()));
  const memory = process.memoryUsage();
  const database = await checkDatabase(client);
  const heapUsedRatio = memory.heapTotal > 0 ? memory.heapUsed / memory.heapTotal : 0;
  const apiStatus: ServerHealthStatus = heapUsedRatio >= 0.9 ? 'warning' : 'ok';
  const status: ServerHealthStatus = database.status === 'error' ? 'error' : apiStatus;

  return {
    status,
    generatedAt: generatedAt.toISOString(),
    note: 'Server health is a lightweight operational snapshot for the API process and database connectivity only. It is not a full infrastructure monitor.',
    api: {
      status: apiStatus,
      service: 'hellowhen-api',
      nodeEnv: env.nodeEnv,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      startedAt: apiStartedAt.toISOString(),
      uptimeSeconds,
      memory: {
        rssBytes: memory.rss,
        rssMiB: bytesToMiB(memory.rss),
        heapUsedBytes: memory.heapUsed,
        heapUsedMiB: bytesToMiB(memory.heapUsed),
        heapTotalBytes: memory.heapTotal,
        heapTotalMiB: bytesToMiB(memory.heapTotal),
        externalBytes: memory.external,
        externalMiB: bytesToMiB(memory.external),
        heapUsedRatio: Math.round(heapUsedRatio * 1000) / 1000,
      },
    },
    database,
    checks: [
      {
        id: 'api-process',
        label: 'API process',
        status: apiStatus,
        detail: apiStatus === 'ok' ? 'API process is responding and memory usage is within the lightweight warning threshold.' : 'API heap usage is high for the current process.',
      },
      {
        id: 'database-ping',
        label: 'Database ping',
        status: database.status,
        detail: database.message,
      },
    ],
  };
}
