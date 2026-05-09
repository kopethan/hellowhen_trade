import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { prisma } from '../lib/prisma.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; sessionId?: string };
    }
  }
}

function readBearerToken(req: Request) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, sessionId: payload.sid };
  } catch {
    // Keep public reads public even with an expired token.
  }
  return next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, sessionId: payload.sid };
    return next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export async function requireFreshSensitiveAction(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { sensitiveActionVerifiedAt: true } });
  const verifiedAt = user?.sensitiveActionVerifiedAt?.getTime() ?? 0;
  const maxAgeMs = env.sensitiveActionTtlMinutes * 60 * 1000;
  if (!verifiedAt || Date.now() - verifiedAt > maxAgeMs) {
    return res.status(403).json({ error: 'fresh_auth_required', message: 'Confirm your password or authenticator code before changing payout settings or requesting a payout.', freshAuthRequired: true });
  }
  return next();
}
