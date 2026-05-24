import { Router } from 'express';
import { usageHeartbeatRequestSchema, type UsageArea } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth } from '../../middleware/auth.js';
import { cleanupUsageMonitoringData } from './usageRetention.js';
const usageHeartbeatClient = (prisma as any).usageHeartbeat as {
  upsert?: (args: unknown) => Promise<unknown>;
  deleteMany?: (args: unknown) => Promise<unknown>;
} | undefined;

export const usageRoutes = Router();

function normalizeRouteSegment(segment: string, previousSegment?: string) {
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
  return '[id]';
}

function sanitizeRoutePattern(value: string) {
  const raw = value.trim().split(/[?#]/)[0] || '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const segments = path.split('/').map((segment, index, all) => normalizeRouteSegment(segment, all[index - 1]));
  const normalized = segments.join('/').replace(/\/+/g, '/');
  return normalized.length > 140 ? normalized.slice(0, 140) : normalized;
}

function deriveArea(routePattern: string, fallback: UsageArea): UsageArea {
  if (routePattern === '/admin' || routePattern.startsWith('/admin/')) return 'admin';
  if (/^\/trades\/\[tradeId\]\/proposals\//.test(routePattern)) return 'proposal_thread';
  if (/^\/trades\/\[tradeId\]$/.test(routePattern)) return 'trade_detail';
  if (routePattern === '/trades' || routePattern.startsWith('/trades/')) return 'trades';
  if (routePattern === '/needs' || routePattern.startsWith('/needs/')) return 'needs';
  if (routePattern === '/offers' || routePattern.startsWith('/offers/')) return 'offers';
  if (routePattern === '/account' || routePattern.startsWith('/account/') || routePattern === '/settings' || routePattern === '/me' || routePattern === '/wallet' || routePattern === '/support') return 'account';
  return fallback;
}

usageRoutes.post('/heartbeat', optionalAuth, asyncRoute(async (req, res) => {
  if (!usageHeartbeatClient?.upsert) return res.status(204).send();

  const input = usageHeartbeatRequestSchema.parse(req.body ?? {});
  const routePattern = sanitizeRoutePattern(input.routePattern);
  const appArea = deriveArea(routePattern, input.area);
  const clientId = input.clientId || (req.user?.sessionId ? `session:${req.user.sessionId}` : req.user ? `user:${req.user.id}` : null);

  if (!req.user && !clientId) return res.status(401).json({ error: 'unauthorized' });

  const now = new Date();
  await usageHeartbeatClient.upsert({
    where: { clientId },
    create: {
      userId: req.user?.id ?? null,
      sessionId: req.user?.sessionId ?? null,
      clientId,
      appArea,
      routePattern,
      lastSeenAt: now,
    },
    update: {
      userId: req.user?.id ?? null,
      sessionId: req.user?.sessionId ?? null,
      appArea,
      routePattern,
      lastSeenAt: now,
    },
  });

  await cleanupUsageMonitoringData(prisma, now);

  return res.status(204).send();
}));
