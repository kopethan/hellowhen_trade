import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/tokens.js';
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

function tokenIssuedBeforeRevocation(payload: AccessTokenPayload, revokedAt: Date | null | undefined) {
  if (!revokedAt) return false;
  const issuedAtMs = typeof payload.iat === 'number' ? payload.iat * 1000 : 0;
  return issuedAtMs > 0 && issuedAtMs < revokedAt.getTime();
}

async function resolveTokenUser(token: string) {
  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, sessionRevokedAt: true },
  });
  if (!user) return null;
  if (tokenIssuedBeforeRevocation(payload, user.sessionRevokedAt)) return null;

  if (payload.sid) {
    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true, createdAt: true },
    });
    if (!session || session.userId !== user.id) return null;
    if (session.revokedAt || session.expiresAt < new Date()) return null;
    if (user.sessionRevokedAt && session.createdAt < user.sessionRevokedAt) return null;
  }

  return { id: user.id, email: user.email, sessionId: payload.sid };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) return next();
  resolveTokenUser(token)
    .then((user) => {
      if (user) req.user = user;
      return next();
    })
    .catch(() => {
      // Keep public reads public even with an expired, invalid, or revoked token.
      return next();
    });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  resolveTokenUser(token)
    .then((user) => {
      if (!user) return res.status(401).json({ error: 'unauthorized' });
      req.user = user;
      return next();
    })
    .catch(() => res.status(401).json({ error: 'unauthorized' }));
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

export function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  prisma.user.findUnique({ where: { id: req.user.id }, select: { trustTier: true } })
    .then((user) => {
      if (!user) return res.status(401).json({ error: 'unauthorized' });
      if (user.trustTier === 'restricted') {
        return res.status(403).json({
          error: 'account_restricted',
          message: 'This account is restricted. Contact support if you think this is a mistake.',
        });
      }
      return next();
    })
    .catch(next);
}
