import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { cleanupUsageMonitoringData, USAGE_MONITORING_CLEANUP_INTERVAL_MS } from '../modules/usage/usageRetention.js';
const MAX_ROUTE_PATTERN_LENGTH = 160;
const SKIPPED_PREFIXES = ['/health', '/uploads'];
const SKIPPED_EXACT = new Set(['/usage/heartbeat']);

type ApiRequestMetricClient = {
  create?: (args: unknown) => Promise<unknown>;
};

const apiRequestMetricClient = (prisma as any).apiRequestMetric as ApiRequestMetricClient | undefined;
let lastCleanupAt = 0;

function normalizeExpressSegment(segment: string) {
  if (!segment) return segment;
  if (segment.startsWith(':')) {
    const name = segment.slice(1).replace(/\?$/, '') || 'id';
    return `[${name}]`;
  }
  return segment;
}

function normalizeRawSegment(segment: string, previousSegment?: string) {
  if (!segment) return segment;
  if (/^\[[a-zA-Z]+Id\]$/.test(segment)) return segment;
  const looksLikeId = /^[a-z0-9_-]{12,}$/i.test(segment) || /^\d+$/.test(segment);
  if (!looksLikeId) return segment;
  if (previousSegment === 'trades') return '[tradeId]';
  if (previousSegment === 'proposals') return '[proposalId]';
  if (previousSegment === 'needs') return '[needId]';
  if (previousSegment === 'offers') return '[offerId]';
  if (previousSegment === 'users') return '[userId]';
  if (previousSegment === 'plans') return '[planId]';
  if (previousSegment === 'media') return '[mediaId]';
  if (previousSegment === 'reports') return '[reportId]';
  if (previousSegment === 'tickets') return '[ticketId]';
  return '[id]';
}

function normalizePattern(value: string, mode: 'express' | 'raw') {
  const raw = value.trim().split(/[?#]/)[0] || '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const segments = path.split('/').map((segment, index, all) => (
    mode === 'express' ? normalizeExpressSegment(segment) : normalizeRawSegment(segment, all[index - 1])
  ));
  const normalized = segments.join('/').replace(/\/+/g, '/') || '/';
  return normalized.length > MAX_ROUTE_PATTERN_LENGTH ? normalized.slice(0, MAX_ROUTE_PATTERN_LENGTH) : normalized;
}

function routePathToString(value: unknown) {
  if (typeof value === 'string') return value;
  if (value instanceof RegExp) return value.source;
  return '';
}

function getRoutePattern(req: Request) {
  const routePath = routePathToString(req.route?.path);
  const baseUrl = typeof req.baseUrl === 'string' ? req.baseUrl : '';
  if (routePath) return normalizePattern(`${baseUrl}${routePath}`, 'express');
  return normalizePattern(req.path || req.originalUrl || '/', 'raw');
}

function getAppArea(routePattern: string) {
  if (routePattern === '/admin' || routePattern.startsWith('/admin/')) return 'admin';
  if (routePattern === '/trades' || routePattern.startsWith('/trades/')) return 'trades';
  if (routePattern === '/proposals' || routePattern.startsWith('/proposals/')) return 'proposal_thread';
  if (routePattern === '/needs' || routePattern.startsWith('/needs/')) return 'needs';
  if (routePattern === '/offers' || routePattern.startsWith('/offers/')) return 'offers';
  if (routePattern === '/account' || routePattern.startsWith('/account/') || routePattern === '/settings' || routePattern.startsWith('/settings/') || routePattern === '/profile' || routePattern.startsWith('/profile/') || routePattern === '/users' || routePattern.startsWith('/users/')) return 'account';
  if (routePattern === '/support' || routePattern.startsWith('/support/')) return 'account';
  return 'other';
}

function shouldSkip(req: Request) {
  const path = (req.path || req.originalUrl || '/').split(/[?#]/)[0] || '/';
  if (SKIPPED_EXACT.has(path)) return true;
  return SKIPPED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function maybeCleanupOldUsageMonitoringRows(now: number) {
  if (now - lastCleanupAt < USAGE_MONITORING_CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  void cleanupUsageMonitoringData(prisma, new Date(now)).catch(() => undefined);
}

export function recordApiRequestMetric(req: Request, res: Response, next: NextFunction) {
  const createMetric = apiRequestMetricClient?.create?.bind(apiRequestMetricClient);
  if (!createMetric || shouldSkip(req)) return next();

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const finishedAt = Date.now();
    const durationMs = Math.max(0, Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000));
    const routePattern = getRoutePattern(req);
    const statusGroup = `${Math.floor(res.statusCode / 100)}xx`;

    maybeCleanupOldUsageMonitoringRows(finishedAt);

    void createMetric({
      data: {
        userId: req.user?.id ?? null,
        sessionId: req.user?.sessionId ?? null,
        method: req.method.toUpperCase().slice(0, 12),
        routePattern,
        appArea: getAppArea(routePattern),
        statusCode: res.statusCode,
        statusGroup,
        durationMs,
        createdAt: new Date(finishedAt),
      },
    }).catch(() => undefined);
  });

  return next();
}
