import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMAIL = 'test@plus.com';
const DISPLAY_NAME = 'Plus Tester';
const FALLBACK_PASSWORD = 'TestPlus123!';
const POLICY_VERSION = '2026-05-14';
const ADULT_AGE_BUCKET = '18_plus';

function productionOverrideEnabled() {
  return process.env.TEST_PLUS_ALLOW_PRODUCTION?.trim().toLowerCase() === 'true';
}

function assertSafeEnvironment() {
  if (process.env.NODE_ENV === 'production' && !productionOverrideEnabled()) {
    throw new Error('Refusing to seed the Plus test user in production. Set TEST_PLUS_ALLOW_PRODUCTION=true only if you explicitly intend to run this against that database.');
  }
}

function getPassword() {
  const password = process.env.TEST_PLUS_PASSWORD?.trim() || FALLBACK_PASSWORD;
  if (password.length < 8) {
    throw new Error('TEST_PLUS_PASSWORD must be at least 8 characters.');
  }
  return password;
}

async function resolveHandle(userId: string) {
  const base = 'plus-tester';
  const existing = await prisma.profile.findUnique({ where: { handle: base }, select: { userId: true } });
  if (!existing || existing.userId === userId) return base;

  for (let index = 1; index <= 20; index += 1) {
    const candidate = `${base}-${index}`;
    const profile = await prisma.profile.findUnique({ where: { handle: candidate }, select: { userId: true } });
    if (!profile || profile.userId === userId) return candidate;
  }

  return `${base}-${userId.slice(-6).toLowerCase()}`;
}

async function main() {
  assertSafeEnvironment();

  const now = new Date();
  const password = getPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      role: 'user',
      trustTier: 'email_verified',
      accountKind: 'individual',
      professionalStatus: 'none',
      subscriptionTier: 'plus',
      subscriptionStatus: 'active',
      subscriptionStatusUpdatedAt: now,
      trustTierUpdatedAt: now,
      trustTierNote: 'Local Plus test account.',
      emailVerifiedAt: now,
      emailVerificationRequestedAt: null,
      twoFactorEnabled: false,
      twoFactorSecretEncrypted: null,
      twoFactorConfirmedAt: null,
      twoFactorRecoveryCodes: [],
      twoFactorLastUsedStep: null,
      forceTwoFactor: false,
      sensitiveActionVerifiedAt: null,
      termsAcceptedAt: now,
      termsVersion: POLICY_VERSION,
      privacyVersion: POLICY_VERSION,
      ageConfirmedAt: now,
      declaredAgeBucket: ADULT_AGE_BUCKET,
    },
    create: {
      email: EMAIL,
      passwordHash,
      role: 'user',
      trustTier: 'email_verified',
      accountKind: 'individual',
      professionalStatus: 'none',
      subscriptionTier: 'plus',
      subscriptionStatus: 'active',
      subscriptionStatusUpdatedAt: now,
      trustTierUpdatedAt: now,
      trustTierNote: 'Local Plus test account.',
      emailVerifiedAt: now,
      termsAcceptedAt: now,
      termsVersion: POLICY_VERSION,
      privacyVersion: POLICY_VERSION,
      ageConfirmedAt: now,
      declaredAgeBucket: ADULT_AGE_BUCKET,
    },
    select: { id: true, email: true },
  });

  const handle = await resolveHandle(user.id);

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      displayName: DISPLAY_NAME,
      handle,
      bio: 'Local Plus test account for gated feature QA.',
      countryCode: 'FR',
      preferredCurrency: 'eur',
    },
    create: {
      userId: user.id,
      displayName: DISPLAY_NAME,
      handle,
      bio: 'Local Plus test account for gated feature QA.',
      countryCode: 'FR',
      preferredCurrency: 'eur',
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  await prisma.userIdentity.upsert({
    where: { provider_providerUserId: { provider: 'email', providerUserId: EMAIL } },
    update: { userId: user.id, email: EMAIL },
    create: { userId: user.id, provider: 'email', providerUserId: EMAIL, email: EMAIL },
  });

  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, currency: 'eur' },
  });

  await prisma.subscriptionState.upsert({
    where: { userId: user.id },
    update: {
      tier: 'plus',
      status: 'active',
      provider: 'manual_admin',
      currentPeriodStartedAt: now,
      currentPeriodEndsAt: null,
      trialStartedAt: null,
      trialEndsAt: null,
      canceledAt: null,
      pastDueAt: null,
      expiresAt: null,
      lastSyncedAt: now,
      adminNote: 'Local Plus test account',
    },
    create: {
      userId: user.id,
      tier: 'plus',
      status: 'active',
      provider: 'manual_admin',
      currentPeriodStartedAt: now,
      lastSyncedAt: now,
      adminNote: 'Local Plus test account',
    },
  });

  console.log(`Plus test user is ready: ${user.email}`);
  console.log(`Password source: ${process.env.TEST_PLUS_PASSWORD ? 'TEST_PLUS_PASSWORD' : 'local fallback'}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
