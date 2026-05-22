import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import {
  disableTwoFactorRequestSchema,
  forgotPasswordRequestSchema,
  googleAuthRequestSchema,
  loginRequestSchema,
  logoutRequestSchema,
  reauthenticateRequestSchema,
  refreshSessionRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  twoFactorChallengeRequestSchema,
  twoFactorCodeRequestSchema,
  verifyEmailRequestSchema,
} from '@hellowhen/contracts';
import { env, isValidEmailSender } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { signAccessToken } from '../../lib/tokens.js';
import { requireAuth, requireFreshSensitiveAction } from '../../middleware/auth.js';
import { createRateLimiter, ipAndBodyFieldRateLimitKey } from '../../middleware/rateLimit.js';
import { buildOtpAuthUrl, decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, verifyTotpCode } from './totp.js';

export const authRoutes = Router();

const STARTING_CREDITS = 100;
const RESET_TOKEN_BYTES = 32;
const REFRESH_TOKEN_BYTES = 48;
const EMAIL_VERIFICATION_TOKEN_BYTES = 32;
const TWO_FACTOR_CHALLENGE_BYTES = 32;
const POLICY_VERSION = '2026-05-14';
const ADULT_AGE_BUCKET = '18_plus';

const authMutationRateLimit = createRateLimiter({
  keyPrefix: 'auth:mutation',
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many authentication requests. Please wait and try again.',
});

const loginRateLimit = createRateLimiter({
  keyPrefix: 'auth:login',
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: ipAndBodyFieldRateLimitKey('email'),
  message: 'Too many login attempts. Please wait before trying again.',
});

const accountRecoveryRateLimit = createRateLimiter({
  keyPrefix: 'auth:recovery',
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: ipAndBodyFieldRateLimitKey('email'),
  message: 'Too many account recovery requests. Please wait before trying again.',
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicUserInclude() {
  return { profile: true, settings: true, wallet: true } as const;
}

function publicAuthUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    trustTier: user.trustTier,
    emailVerifiedAt: user.emailVerifiedAt,
    ageConfirmedAt: user.ageConfirmedAt,
    declaredAgeBucket: user.declaredAgeBucket,
    twoFactorEnabled: user.twoFactorEnabled,
    forceTwoFactor: user.forceTwoFactor,
    lastLoginAt: user.lastLoginAt,
    profile: user.profile ? {
      displayName: user.profile.displayName,
      handle: user.profile.handle,
      avatarUrl: user.profile.avatarUrl,
      bio: user.profile.bio,
      avatarMediaId: user.profile.avatarMediaId,
      countryCode: user.profile.countryCode,
      preferredCurrency: user.profile.preferredCurrency,
    } : null,
  };
}

function refreshTokenExpiresAt() {
  return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

function emailVerificationExpiresAt() {
  return new Date(Date.now() + env.emailVerificationTtlMinutes * 60 * 1000);
}

function twoFactorChallengeExpiresAt() {
  return new Date(Date.now() + env.twoFactorChallengeTtlMinutes * 60 * 1000);
}

function sensitiveActionExpiresAt() {
  return new Date(Date.now() + env.sensitiveActionTtlMinutes * 60 * 1000);
}

async function createSession(userId: string, userAgent?: string) {
  const rawRefreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const session = await prisma.session.create({
    data: {
      userId,
      refreshToken: hashToken(rawRefreshToken),
      userAgent: userAgent?.slice(0, 300) || null,
      expiresAt: refreshTokenExpiresAt(),
    }
  });
  return { session, refreshToken: rawRefreshToken };
}

function authResponse(user: any, sessionId: string, refreshToken?: string) {
  return {
    accessToken: signAccessToken({ sub: user.id, email: user.email, sid: sessionId }),
    refreshToken,
    user: publicAuthUser(user),
  };
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
  return prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() }, include: publicUserInclude() });
}

async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  if (!env.resendApiKey) return { sent: false, reason: 'resend_not_configured' };
  if (!isValidEmailSender(env.emailFrom)) {
    console.error('Email sender is invalid. Set EMAIL_FROM to a verified sender such as Hellowhen <support@mail.hellowhen.com>.');
    return { sent: false, reason: 'email_from_invalid' };
  }
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.emailFrom, to, subject, html, text })
    });
  } catch (error) {
    console.error('Resend request failed', error);
    return { sent: false, reason: 'resend_request_failed' };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('Resend email failed', response.status, body);
    return { sent: false, reason: 'resend_request_failed' };
  }
  return { sent: true };
}

async function sendPasswordResetEmail(email: string, resetUrl: string) {
  return sendEmail({
    to: email,
    subject: 'Reset your Hellowhen password',
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a"><h1>Reset your Hellowhen password</h1><p>Use this link to set a new password. It expires in ${env.passwordResetTtlMinutes} minutes.</p><p><a href="${resetUrl}" style="display:inline-block;background:#0f766e;color:white;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">Reset password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
    text: `Reset your Hellowhen password: ${resetUrl}\n\nThis link expires in ${env.passwordResetTtlMinutes} minutes.`
  });
}

async function sendVerificationEmail(email: string, verificationUrl: string) {
  return sendEmail({
    to: email,
    subject: 'Verify your Hellowhen email',
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a"><h1>Verify your email</h1><p>Verify your email before using money features or requesting higher launch limits. This link expires in ${env.emailVerificationTtlMinutes} minutes.</p><p><a href="${verificationUrl}" style="display:inline-block;background:#0f766e;color:white;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">Verify email</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
    text: `Verify your Hellowhen email: ${verificationUrl}\n\nThis link expires in ${env.emailVerificationTtlMinutes} minutes.`
  });
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

async function issueTwoFactorChallenge(userId: string) {
  await prisma.twoFactorChallenge.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  const rawToken = crypto.randomBytes(TWO_FACTOR_CHALLENGE_BYTES).toString('base64url');
  await prisma.twoFactorChallenge.create({ data: { userId, tokenHash: hashToken(rawToken), expiresAt: twoFactorChallengeExpiresAt() } });
  return rawToken;
}

function hasAdultLaunchUser(input: { ageConfirmedAt?: Date | null; declaredAgeBucket?: string | null }) {
  return Boolean(input.ageConfirmedAt && input.declaredAgeBucket === ADULT_AGE_BUCKET);
}

function adultLaunchRequiredError() {
  const error = new Error('Hellowhen Trade is 18+ for first launch. Confirm your age before continuing.');
  Object.assign(error, { statusCode: 403, code: 'age_confirmation_required', publicMessage: error.message });
  return error;
}

function accountRestrictedError() {
  const error = new Error('This account is restricted. Contact support if you think this is a mistake.');
  Object.assign(error, { statusCode: 403, code: 'account_restricted', publicMessage: error.message });
  return error;
}

function isRestrictedLaunchUser(input: { trustTier?: string | null }) {
  return input.trustTier === 'restricted';
}

async function finishLogin(userId: string, userAgent?: string) {
  const launchUser = await prisma.user.findUnique({ where: { id: userId }, select: { ageConfirmedAt: true, declaredAgeBucket: true, trustTier: true } });
  if (!launchUser || !hasAdultLaunchUser(launchUser)) throw adultLaunchRequiredError();
  if (isRestrictedLaunchUser(launchUser)) throw accountRestrictedError();
  const loggedInUser = await markLogin(userId);
  const { session, refreshToken } = await createSession(userId, userAgent);
  return authResponse(loggedInUser, session.id, refreshToken);
}

function requiresTwoFactorChallenge(user: { twoFactorEnabled: boolean }) {
  return user.twoFactorEnabled;
}


function cannotDisableTwoFactor(user: { role: 'user' | 'admin'; forceTwoFactor: boolean }) {
  return user.forceTwoFactor || (user.role === 'admin' && env.adminRequireTwoFactor);
}

async function verifyUserTwoFactor(user: { id: string; twoFactorSecretEncrypted: string | null; twoFactorLastUsedStep: number | null; twoFactorRecoveryCodes: unknown }, code: string) {
  const cleanCode = code.trim();
  const recoveryCodes = Array.isArray(user.twoFactorRecoveryCodes) ? user.twoFactorRecoveryCodes as string[] : [];
  const recoveryHash = hashRecoveryCode(cleanCode);
  const recoveryIndex = recoveryCodes.findIndex((item) => item === recoveryHash);
  if (recoveryIndex >= 0) {
    const nextCodes = recoveryCodes.filter((_, index) => index !== recoveryIndex);
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorRecoveryCodes: nextCodes } });
    return true;
  }

  if (!user.twoFactorSecretEncrypted) return false;
  const secret = decryptTotpSecret(user.twoFactorSecretEncrypted);
  const result = verifyTotpCode(secret, cleanCode, user.twoFactorLastUsedStep);
  if (!result.ok || result.step === null) return false;
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorLastUsedStep: result.step } });
  return true;
}


async function consumeTwoFactorChallenge(challengeId: string) {
  const result = await prisma.twoFactorChallenge.updateMany({
    where: { id: challengeId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return result.count === 1;
}

function freshAuthPayload() {
  return { ok: true as const, sensitiveActionExpiresAt: sensitiveActionExpiresAt().toISOString() };
}

authRoutes.post('/register', authMutationRateLimit, asyncRoute(async (req, res) => {
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
      termsAcceptedAt: new Date(),
      termsVersion: POLICY_VERSION,
      privacyVersion: POLICY_VERSION,
      ageConfirmedAt: new Date(),
      declaredAgeBucket: input.declaredAgeBucket,
      profile: { create: { displayName: input.displayName ?? null, countryCode: input.countryCode ?? null, preferredCurrency: input.preferredCurrency ?? 'eur' } },
      settings: { create: {} },
      wallet: { create: { purchasedAvailableCredits: STARTING_CREDITS, currency: input.preferredCurrency ?? 'eur' } },
      identities: { create: { provider: 'email', providerUserId: email, email } }
    },
    include: publicUserInclude()
  });

  await createStartingLedger(user.id, user.wallet!.id);
  const { session, refreshToken } = await createSession(user.id, req.headers['user-agent']);
  res.status(201).json(authResponse(user, session.id, refreshToken));
}));

authRoutes.post('/login', loginRateLimit, asyncRoute(async (req, res) => {
  const input = loginRequestSchema.parse(req.body);
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });

  if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  if (requiresTwoFactorChallenge(user)) {
    const challengeToken = await issueTwoFactorChallenge(user.id);
    return res.json({ requiresTwoFactor: true, challengeToken, message: 'Enter your authenticator app code to finish logging in.' });
  }

  res.json(await finishLogin(user.id, req.headers['user-agent']));
}));

authRoutes.post('/login/2fa', loginRateLimit, asyncRoute(async (req, res) => {
  const input = twoFactorChallengeRequestSchema.parse(req.body);
  const challenge = await prisma.twoFactorChallenge.findUnique({ where: { tokenHash: hashToken(input.challengeToken) } });
  if (!challenge || challenge.usedAt || challenge.expiresAt < new Date()) {
    return res.status(401).json({ error: 'invalid_two_factor_challenge', message: 'This two-step login challenge expired. Log in again.' });
  }

  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user || !user.twoFactorEnabled) return res.status(401).json({ error: 'invalid_two_factor_challenge', message: 'This two-step login challenge expired. Log in again.' });

  const ok = await verifyUserTwoFactor(user, input.code);
  if (!ok) {
    return res.status(401).json({ error: 'invalid_two_factor_code', message: 'That authenticator or recovery code was not accepted. Wait for a new 6-digit code, or try a saved recovery code.' });
  }

  if (!(await consumeTwoFactorChallenge(challenge.id))) {
    return res.status(401).json({ error: 'invalid_two_factor_challenge', message: 'This two-step login challenge expired. Log in again.' });
  }

  res.json(await finishLogin(user.id, req.headers['user-agent']));
}));


function hasAdultLaunchConfirmation(input: { acceptedTerms?: boolean; ageConfirmed?: boolean; declaredAgeBucket?: string }) {
  return input.acceptedTerms === true && input.ageConfirmed === true && input.declaredAgeBucket === ADULT_AGE_BUCKET;
}

authRoutes.post('/google', loginRateLimit, asyncRoute(async (req, res) => {
  if (!env.googleSignInEnabled) {
    return res.status(404).json({ error: 'google_sign_in_disabled', message: 'Google sign-in is disabled for the first Hellowhen Trade launch.' });
  }
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
      const needsAgeConfirmation = !existingByEmail.ageConfirmedAt || existingByEmail.declaredAgeBucket !== ADULT_AGE_BUCKET;
      if (needsAgeConfirmation && !hasAdultLaunchConfirmation(input)) {
        return res.status(400).json({
          error: 'age_confirmation_required',
          message: 'Confirm that you are 18 or older and accept the Terms and Privacy Policy before using Google sign-in with this Hellowhen account.'
        });
      }
      userId = existingByEmail.id;
      await prisma.userIdentity.create({ data: { userId, provider: 'google', providerUserId: googleUser.sub, email: googleUser.email } }).catch(() => null);
      await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date(),
          ...(needsAgeConfirmation ? { ageConfirmedAt: new Date(), declaredAgeBucket: ADULT_AGE_BUCKET } : {}),
        }
      });
    } else {
      if (!hasAdultLaunchConfirmation(input)) {
        return res.status(400).json({
          error: 'age_confirmation_required',
          message: 'Confirm that you are 18 or older and accept the Terms and Privacy Policy before creating a Hellowhen account with Google.'
        });
      }
      const created = await prisma.user.create({
        data: {
          email: googleUser.email,
          passwordHash: null,
          emailVerifiedAt: new Date(),
          trustTier: 'email_verified',
          trustTierUpdatedAt: new Date(),
          trustTierNote: 'Email verified by Google sign-in.',
          lastLoginAt: new Date(),
          termsAcceptedAt: new Date(),
          termsVersion: POLICY_VERSION,
          privacyVersion: POLICY_VERSION,
          ageConfirmedAt: new Date(),
          declaredAgeBucket: ADULT_AGE_BUCKET,
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
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (requiresTwoFactorChallenge(user)) {
    const challengeToken = await issueTwoFactorChallenge(user.id);
    return res.json({ requiresTwoFactor: true, challengeToken, message: 'Enter your authenticator app code to finish logging in.' });
  }

  const bootstrapped = await ensureUserBootstrap(userId, googleUser.displayName);
  if (googleUser.avatarUrl && bootstrapped?.profile && !bootstrapped.profile.avatarUrl) {
    await prisma.profile.update({ where: { userId }, data: { avatarUrl: googleUser.avatarUrl } });
  }
  res.json(await finishLogin(userId, req.headers['user-agent']));
}));

authRoutes.post('/refresh', authMutationRateLimit, asyncRoute(async (req, res) => {
  const input = refreshSessionRequestSchema.parse(req.body);
  const tokenHash = hashToken(input.refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshToken: tokenHash }, include: { user: { include: publicUserInclude() } } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return res.status(401).json({ error: 'invalid_refresh_token' });
  if (!hasAdultLaunchUser(session.user)) return res.status(403).json({ error: 'age_confirmation_required', message: 'Hellowhen Trade is 18+ for first launch. Confirm your age before continuing.' });
  if (isRestrictedLaunchUser(session.user)) return res.status(403).json({ error: 'account_restricted', message: 'This account is restricted. Contact support if you think this is a mistake.' });
  if (session.user.sessionRevokedAt && session.createdAt < session.user.sessionRevokedAt) return res.status(401).json({ error: 'session_revoked' });
  const nextRefreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const updated = await prisma.session.update({ where: { id: session.id }, data: { refreshToken: hashToken(nextRefreshToken), expiresAt: refreshTokenExpiresAt(), userAgent: req.headers['user-agent']?.slice(0, 300) || session.userAgent } });
  res.json(authResponse(session.user, updated.id, nextRefreshToken));
}));

authRoutes.post('/logout', asyncRoute(async (req, res) => {
  const input = logoutRequestSchema.parse(req.body ?? {});
  if (input.refreshToken) {
    await prisma.session.updateMany({ where: { refreshToken: hashToken(input.refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  res.json({ ok: true });
}));

authRoutes.post('/forgot-password', accountRecoveryRateLimit, asyncRoute(async (req, res) => {
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

authRoutes.post('/reset-password', authMutationRateLimit, asyncRoute(async (req, res) => {
  const input = resetPasswordRequestSchema.parse(req.body);
  const tokenHash = hashToken(input.token);
  const now = new Date();
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < now) {
    return res.status(400).json({ error: 'invalid_or_expired_reset_token', message: 'This reset link is invalid or expired. Request a new one from the login screen.' });
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const resetSucceeded = await prisma.$transaction(async (tx: any) => {
    const claimedToken = await tx.passwordResetToken.updateMany({ where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claimedToken.count !== 1) return false;

    const user = await tx.user.findUnique({ where: { id: resetToken.userId } });
    if (!user) return false;

    await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash, sessionRevokedAt: now, sensitiveActionVerifiedAt: null } });
    await tx.session.updateMany({ where: { userId: resetToken.userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.userIdentity.upsert({ where: { provider_providerUserId: { provider: 'email', providerUserId: user.email } }, update: { userId: user.id, email: user.email }, create: { userId: user.id, provider: 'email', providerUserId: user.email, email: user.email } });
    return true;
  });

  if (!resetSucceeded) {
    return res.status(400).json({ error: 'invalid_or_expired_reset_token', message: 'This reset link is invalid or expired. Request a new one from the login screen.' });
  }

  res.json({ ok: true, message: 'Password reset. You can now log in with your new password.' });
}));

authRoutes.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: publicUserInclude()
  });

  if (!user) return res.status(401).json({ error: 'unauthorized' });
  res.json({ user: publicAuthUser(user) });
}));

authRoutes.post('/verify-email/request', requireAuth, authMutationRateLimit, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (user.emailVerifiedAt) return res.json({ ok: true, message: 'Email is already verified.', emailSent: false });
  await prisma.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  const rawToken = crypto.randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString('base64url');
  await prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: emailVerificationExpiresAt() } });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerificationRequestedAt: new Date() } });
  const verificationUrl = `${env.webAppUrl.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  const emailResult = await sendVerificationEmail(user.email, verificationUrl);
  const devVerificationUrl = env.nodeEnv === 'development' && !emailResult.sent ? verificationUrl : undefined;
  res.json({ ok: true, message: 'If email delivery is configured, a verification link has been sent.', emailSent: emailResult.sent, devVerificationUrl });
}));

authRoutes.post('/verify-email/confirm', authMutationRateLimit, asyncRoute(async (req, res) => {
  const input = verifyEmailRequestSchema.parse(req.body);
  const now = new Date();
  const token = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(input.token) } });
  if (!token || token.usedAt || token.expiresAt < now) return res.status(400).json({ error: 'invalid_or_expired_verification_token', message: 'This email verification link is invalid or expired.' });

  const user = await prisma.$transaction(async (tx: any) => {
    const claimedToken = await tx.emailVerificationToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claimedToken.count !== 1) return null;

    const existingUser = await tx.user.findUnique({ where: { id: token.userId }, select: { trustTier: true } });
    if (!existingUser) return null;
    const trustUpdate = isRestrictedLaunchUser(existingUser)
      ? {}
      : { trustTier: 'email_verified' as const, trustTierUpdatedAt: now, trustTierNote: 'Email verified.' };

    return tx.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: now, ...trustUpdate },
      include: publicUserInclude()
    });
  });

  if (!user) return res.status(400).json({ error: 'invalid_or_expired_verification_token', message: 'This email verification link is invalid or expired.' });
  res.json({ ok: true, message: 'Email verified.', user: publicAuthUser(user) });
}));

authRoutes.post('/2fa/setup', requireAuth, requireFreshSensitiveAction, authMutationRateLimit, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (user.twoFactorEnabled) return res.status(409).json({ error: 'two_factor_already_enabled', message: 'Authenticator app verification is already enabled.' });
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecretEncrypted: encryptTotpSecret(secret), twoFactorConfirmedAt: null, twoFactorRecoveryCodes: [] } });
  res.json({ secret, otpauthUrl: buildOtpAuthUrl(user.email, secret), message: 'Add this secret to an authenticator app, then confirm the 6-digit code.' });
}));

authRoutes.post('/2fa/enable', requireAuth, authMutationRateLimit, asyncRoute(async (req, res) => {
  const input = twoFactorCodeRequestSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!user.twoFactorSecretEncrypted) return res.status(400).json({ error: 'two_factor_setup_required', message: 'Start two-step setup first.' });
  const secret = decryptTotpSecret(user.twoFactorSecretEncrypted);
  const result = verifyTotpCode(secret, input.code, user.twoFactorLastUsedStep);
  if (!result.ok || result.step === null) return res.status(401).json({ error: 'invalid_two_factor_code', message: 'That authenticator code was not accepted.' });
  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorConfirmedAt: new Date(), twoFactorLastUsedStep: result.step, twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode), sensitiveActionVerifiedAt: null } }),
    prisma.session.updateMany({ where: { userId: user.id, revokedAt: null, ...(req.user?.sessionId ? { id: { not: req.user.sessionId } } : {}) }, data: { revokedAt: new Date() } }),
  ]);
  res.json({ ok: true, recoveryCodes });
}));

authRoutes.post('/2fa/disable', requireAuth, authMutationRateLimit, asyncRoute(async (req, res) => {
  const input = disableTwoFactorRequestSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (cannotDisableTwoFactor(user)) {
    return res.status(403).json({ error: 'two_factor_required', message: 'This account must keep authenticator app two-step verification enabled.' });
  }
  if (user.passwordHash) {
    if (!input.password || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: 'invalid_credentials', message: 'Enter your password to disable two-step verification.' });
  }
  if (user.twoFactorEnabled) {
    if (!input.code) return res.status(401).json({ error: 'two_factor_code_required', message: 'Enter an authenticator or recovery code.' });
    const ok = await verifyUserTwoFactor(user, input.code);
    if (!ok) return res.status(401).json({ error: 'invalid_two_factor_code', message: 'That authenticator code was not accepted.' });
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecretEncrypted: null, twoFactorConfirmedAt: null, twoFactorRecoveryCodes: [], twoFactorLastUsedStep: null, sensitiveActionVerifiedAt: null } }),
    prisma.session.updateMany({ where: { userId: user.id, revokedAt: null, ...(req.user?.sessionId ? { id: { not: req.user.sessionId } } : {}) }, data: { revokedAt: new Date() } }),
  ]);
  res.json({ ok: true });
}));

authRoutes.post('/reauthenticate', requireAuth, authMutationRateLimit, asyncRoute(async (req, res) => {
  const input = reauthenticateRequestSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  let ok = false;
  if (input.password && user.passwordHash) ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok && input.code && user.twoFactorEnabled) ok = await verifyUserTwoFactor(user, input.code);
  if (!ok) return res.status(401).json({ error: 'reauthentication_failed', message: 'Fresh verification failed. Enter your password or authenticator code and try again.' });
  await prisma.user.update({ where: { id: user.id }, data: { sensitiveActionVerifiedAt: new Date() } });
  res.json(freshAuthPayload());
}));

authRoutes.get('/sessions', requireAuth, asyncRoute(async (req, res) => {
  const sessions = await prisma.session.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ sessions: sessions.map((session) => ({ id: session.id, createdAt: session.createdAt, updatedAt: session.updatedAt, expiresAt: session.expiresAt, revokedAt: session.revokedAt, userAgent: session.userAgent })) });
}));

authRoutes.delete('/sessions/:sessionId', requireAuth, asyncRoute(async (req, res) => {
  await prisma.session.updateMany({ where: { id: req.params.sessionId, userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } });
  res.json({ ok: true });
}));

authRoutes.post('/logout-all', requireAuth, asyncRoute(async (req, res) => {
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.user!.id }, data: { sessionRevokedAt: now, sensitiveActionVerifiedAt: null } }),
    prisma.session.updateMany({ where: { userId: req.user!.id, revokedAt: null }, data: { revokedAt: now } })
  ]);
  res.json({ ok: true });
}));
