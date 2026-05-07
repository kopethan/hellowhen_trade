import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { loginRequestSchema, registerRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { signAccessToken } from '../../lib/tokens.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRoutes = Router();

authRoutes.post('/register', asyncRoute(async (req, res) => {
  const input = registerRequestSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      profile: {
        create: {
          displayName: input.displayName ?? null
        }
      },
      settings: {
        create: {}
      },
      wallet: {
        create: {
          purchasedAvailableCredits: 100
        }
      }
    },
    include: {
      profile: true,
      wallet: true
    }
  });

  await prisma.creditLedgerEntry.create({
    data: {
      userId: user.id,
      walletId: user.wallet!.id,
      type: 'test_credit_grant',
      balanceType: 'purchased',
      amount: 100,
      description: 'Patch 1 fake starting credits'
    }
  });

  res.status(201).json({
    accessToken: signAccessToken({ sub: user.id, email: user.email }),
    user
  });
}));

authRoutes.post('/login', asyncRoute(async (req, res) => {
  const input = loginRequestSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, include: { profile: true } });

  if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  res.json({
    accessToken: signAccessToken({ sub: user.id, email: user.email }),
    user
  });
}));

authRoutes.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { profile: true, settings: true, wallet: true }
  });

  res.json({ user });
}));
