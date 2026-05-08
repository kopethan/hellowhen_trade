import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { forgotPasswordRequestSchema, googleAuthRequestSchema, loginRequestSchema, registerRequestSchema, resetPasswordRequestSchema } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { signAccessToken } from '../../lib/tokens.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRoutes = Router();

const STARTING_CREDITS = 100;
const RESET_TOKEN_BYTES = 32;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicUserInclude() {
  return { profile: true, settings: true, wallet: true } as const;
}

async function createStartingLedger(userId: string, walletId: string, description = 'Legacy demo balance created for older test accounts') {
  await prisma.creditLedgerEntry.create({
    data: {
      userId,
      walletId,
      type: 'starting_demo_credits',
      balanceType: 'purchased',
      amount: STARTING_CREDITS,
      description,
      metadata: { fakeCreditsOnly: true, purchasedCreditsAreWithdrawable: false }
    }
  });
}

async function ensureUserBootstrap(userId: string, displayName?: string | null) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: publicUserInclude() });
  if (!user) throw new Error('user_not_found');

  if (!user.profile) {
    await prisma.profile.create({ data: { userId, displayName: displayName ?? null, preferredCurrency: 'eur' } });
  } else if (displayName && !user.profile.displayName) {
    await prisma.profile.update({ where: { userId }, data: { displayName } });
  }

  if (!user.settings) await prisma.userSettings.create({ data: { userId } });
  if (!user.wallet) {
    const wallet = await prisma.wallet.create({ data: { userId, purchasedAvailableCredits: STARTING_CREDITS, currency: user.profile?.preferredCurrency ?? 'eur' } });
    await createStartingLedger(userId, wallet.id, 'Legacy demo balance created during auth bootstrap');
  }

  return prisma.user.findUnique({ where: { id: userId }, include: publicUserInclude() });
}

async function markLogin(userId: string) {
  return prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() }, include: { profile: true } });
}

function authResponse(user: NonNullable<Awaited<ReturnType<typeof markLogin>>>) {
  return {
    accessToken: signAccessToken({ sub: user.id, email: user.email }),
    user
  };
}

async function sendPasswordResetEmail(email: string, resetUrl: string) {
  if (!env.resendApiKey) return { sent: false, reason: 'resend_not_configured' };

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.emailFrom,
        to: email,
        subject: 'Reset your Hellowhen password',
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a"><h1>Reset your Hellowhen password</h1><p>Use this link to set a new password. It expires in ${env.passwordResetTtlMinutes} minutes.</p><p><a href="${resetUrl}" style="display:inline-block;background:#0f766e;color:white;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">Reset password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
        text: `Reset your Hellowhen password: ${resetUrl}\n\nThis link expires in ${env.passwordResetTtlMinutes} minutes.`
      })
    });
  } catch (error) {
    console.error('Resend password reset request failed', error);
    return { sent: false, reason: 'resend_request_failed' };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('Resend password reset failed', response.status, body);
    return { sent: false, reason: 'resend_request_failed' };
  }

  return { sent: true };
}

type GoogleTokenInfo = {
  sub?: string;
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
};

function allowedGoogleAudiences() {
  return [env.googleWebClientId, env.googleIosClientId, env.googleAndroidClientId].map((value) => value.trim()).filter(Boolean);
}

async function verifyGoogleIdToken(idToken: string) {
  const audiences = allowedGoogleAudiences();
  if (audiences.length === 0) {
    const error = new Error('google_not_configured');
    Object.assign(error, { status: 503 });
    throw error;
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    const error = new Error('invalid_google_token');
    Object.assign(error, { status: 401 });
    throw error;
  }

  const info = await response.json() as GoogleTokenInfo;
  const verified = info.email_verified === true || info.email_verified === 'true';
  if (!info.sub || !info.email || !info.aud || !verified || !audiences.includes(info.aud)) {
    const error = new Error('invalid_google_token');
    Object.assign(error, { status: 401 });
    throw error;
  }

  return { sub: info.sub, email: normalizeEmail(info.email), displayName: info.name ?? null, avatarUrl: info.picture ?? null };
}

authRoutes.post('/register', asyncRoute(async (req, res) => {
  const input = registerRequestSchema.parse(req.body);
  const email = normalizeEmail(input.email);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'email_already_exists', message: 'An account already exists with this email. Try logging in or resetting your password.' });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      lastLoginAt: new Date(),
      profile: { create: { displayName: input.displayName ?? null, countryCode: input.countryCode ?? null, preferredCurrency: input.preferredCurrency ?? 'eur' } },
      settings: { create: {} },
      wallet: { create: { purchasedAvailableCredits: STARTING_CREDITS, currency: input.preferredCurrency ?? 'eur' } },
      identities: { create: { provider: 'email', providerUserId: email, email } }
    },
    include: publicUserInclude()
  });

  await createStartingLedger(user.id, user.wallet!.id);

  res.status(201).json({ accessToken: signAccessToken({ sub: user.id, email: user.email }), user });
}));

authRoutes.post('/login', asyncRoute(async (req, res) => {
  const input = loginRequestSchema.parse(req.body);
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });

  if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const loggedInUser = await markLogin(user.id);
  res.json(authResponse(loggedInUser));
}));

authRoutes.post('/google', asyncRoute(async (req, res) => {
  const input = googleAuthRequestSchema.parse(req.body);

  let googleUser: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
  try {
    googleUser = await verifyGoogleIdToken(input.idToken);
  } catch (error) {
    if (error instanceof Error && error.message === 'google_not_configured') return res.status(503).json({ error: 'google_not_configured', message: 'Google sign-in is not configured for this Hellowhen API yet.' });
    return res.status(401).json({ error: 'invalid_google_token', message: 'Google sign-in could not be verified.' });
  }

  const existingIdentity = await prisma.userIdentity.findUnique({ where: { provider_providerUserId: { provider: 'google', providerUserId: googleUser.sub } }, include: { user: true } });
  let userId = existingIdentity?.userId;

  if (!userId) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: googleUser.email } });
    if (existingByEmail) {
      userId = existingByEmail.id;
      await prisma.userIdentity.create({ data: { userId, provider: 'google', providerUserId: googleUser.sub, email: googleUser.email } }).catch(() => null);
      await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date() } });
    } else {
      const created = await prisma.user.create({
        data: {
          email: googleUser.email,
          passwordHash: null,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          profile: { create: { displayName: googleUser.displayName, avatarUrl: googleUser.avatarUrl, preferredCurrency: 'eur' } },
          settings: { create: {} },
          wallet: { create: { purchasedAvailableCredits: STARTING_CREDITS, currency: 'eur' } },
          identities: { create: [{ provider: 'google', providerUserId: googleUser.sub, email: googleUser.email }] }
        },
        include: publicUserInclude()
      });
      await createStartingLedger(created.id, created.wallet!.id, 'Legacy demo balance for Google-created account');
      userId = created.id;
    }
  }

  if (!userId) throw new Error('auth_google_user_missing');

  const bootstrapped = await ensureUserBootstrap(userId, googleUser.displayName);
  if (googleUser.avatarUrl && bootstrapped?.profile && !bootstrapped.profile.avatarUrl) {
    await prisma.profile.update({ where: { userId }, data: { avatarUrl: googleUser.avatarUrl } });
  }
  const loggedInUser = await markLogin(userId);
  res.json(authResponse(loggedInUser));
}));

authRoutes.post('/forgot-password', asyncRoute(async (req, res) => {
  const input = forgotPasswordRequestSchema.parse(req.body);
  const email = normalizeEmail(input.email);
  const neutralMessage = 'If that email exists, we sent a password reset link.';
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return res.json({ ok: true, message: neutralMessage, emailSent: false });

  await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.passwordResetTtlMinutes * 60 * 1000);
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  const resetUrl = `${env.webAppUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const emailResult = await sendPasswordResetEmail(email, resetUrl);
  const devResetUrl = env.nodeEnv === 'development' && !emailResult.sent ? resetUrl : undefined;

  res.json({ ok: true, message: neutralMessage, emailSent: emailResult.sent, devResetUrl });
}));

authRoutes.post('/reset-password', asyncRoute(async (req, res) => {
  const input = resetPasswordRequestSchema.parse(req.body);
  const tokenHash = hashToken(input.token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ error: 'invalid_or_expired_reset_token', message: 'This reset link is invalid or expired. Request a new one from the login screen.' });
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.findUnique({ where: { id: resetToken.userId } });
  if (!user) return res.status(400).json({ error: 'invalid_or_expired_reset_token', message: 'This reset link is invalid or expired. Request a new one from the login screen.' });

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.userIdentity.upsert({ where: { provider_providerUserId: { provider: 'email', providerUserId: user.email } }, update: { userId: user.id, email: user.email }, create: { userId: user.id, provider: 'email', providerUserId: user.email, email: user.email } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } })
  ]);

  res.json({ ok: true, message: 'Password reset. You can now log in with your new password.' });
}));

authRoutes.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { profile: true, settings: true, wallet: true }
  });

  res.json({ user });
}));
