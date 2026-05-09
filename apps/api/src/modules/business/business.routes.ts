import { Router, type Response } from 'express';
import { businessProviderOnboardingLinkRequestSchema, createBusinessProfileRequestSchema, requestBusinessReviewRequestSchema, updateBusinessProfileRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireFreshSensitiveAction } from '../../middleware/auth.js';
import { getActiveMoneyProvider } from '../money/providers/moneyProviderRegistry.js';
import { MoneyProviderError } from '../money/providers/moneyProvider.types.js';

export const businessRoutes = Router();

businessRoutes.use(requireAuth);

const businessInclude = {
  owner: { select: { id: true, email: true, profile: true, trustTier: true } },
  members: { include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } }, orderBy: { createdAt: 'asc' as const } },
  moneyProviderAccounts: { orderBy: { createdAt: 'desc' as const }, take: 5 },
  _count: { select: { needs: true, offers: true, trades: true } },
} as const;

function providerError(res: Response, error: unknown) {
  if (error instanceof MoneyProviderError) {
    return res.status(error.statusCode).json({ error: error.code, message: error.publicMessage });
  }
  throw error;
}

function normalizeProfile<T extends { _count?: unknown }>(profile: T) {
  return { ...profile, counts: profile._count };
}

async function findAccessibleBusinessProfile(id: string, userId: string) {
  return prisma.businessProfile.findFirst({
    where: { id, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    include: businessInclude,
  });
}

businessRoutes.get('/mine', asyncRoute(async (req, res) => {
  const businessProfiles = await prisma.businessProfile.findMany({
    where: { OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
    include: businessInclude,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 100,
  });
  res.json({ businessProfiles: businessProfiles.map(normalizeProfile) });
}));

businessRoutes.post('/', asyncRoute(async (req, res) => {
  const input = createBusinessProfileRequestSchema.parse(req.body);
  const businessProfile = await prisma.$transaction(async (tx) => {
    const created = await tx.businessProfile.create({
      data: {
        ownerId: req.user!.id,
        type: input.type,
        displayName: input.displayName,
        legalName: input.legalName ?? null,
        handle: input.handle ?? null,
        description: input.description ?? null,
        websiteUrl: input.websiteUrl ?? null,
        countryCode: input.countryCode?.toUpperCase() ?? null,
        preferredCurrency: input.preferredCurrency.toLowerCase(),
      },
    });
    await tx.businessProfileMember.create({ data: { businessProfileId: created.id, userId: req.user!.id, role: 'owner' } });
    return tx.businessProfile.findUniqueOrThrow({ where: { id: created.id }, include: businessInclude });
  });
  res.status(201).json({ businessProfile: normalizeProfile(businessProfile) });
}));

businessRoutes.get('/:businessProfileId', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const businessProfile = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!businessProfile) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  res.json({ businessProfile: normalizeProfile(businessProfile) });
}));

businessRoutes.patch('/:businessProfileId', asyncRoute(async (req, res) => {
  const input = updateBusinessProfileRequestSchema.parse(req.body);
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const existing = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (existing.ownerId !== req.user!.id) return res.status(403).json({ error: 'business_owner_required', message: 'Only the business owner can update this profile.' });
  const businessProfile = await prisma.businessProfile.update({
    where: { id: existing.id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.legalName !== undefined ? { legalName: input.legalName ?? null } : {}),
      ...(input.handle !== undefined ? { handle: input.handle ?? null } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl ?? null } : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode?.toUpperCase() ?? null } : {}),
      ...(input.preferredCurrency !== undefined ? { preferredCurrency: input.preferredCurrency.toLowerCase() } : {}),
    },
    include: businessInclude,
  });
  res.json({ businessProfile: normalizeProfile(businessProfile) });
}));

businessRoutes.post('/:businessProfileId/request-review', asyncRoute(async (req, res) => {
  const input = requestBusinessReviewRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const existing = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  if (existing.ownerId !== req.user!.id) return res.status(403).json({ error: 'business_owner_required', message: 'Only the business owner can request review.' });
  const businessProfile = await prisma.businessProfile.update({
    where: { id: existing.id },
    data: { status: 'pending_review', reviewNote: input.note ?? existing.reviewNote },
    include: businessInclude,
  });
  res.json({ businessProfile: normalizeProfile(businessProfile) });
}));

businessRoutes.get('/:businessProfileId/provider-account', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const existing = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const provider = getActiveMoneyProvider();
  const account = await provider.getConnectedAccount(req.user!.id, existing.id);
  res.json({ provider: provider.getPublicStatus(), account });
}));

businessRoutes.post('/:businessProfileId/provider-account/onboarding-link', requireFreshSensitiveAction, asyncRoute(async (req, res) => {
  const input = businessProviderOnboardingLinkRequestSchema.parse(req.body ?? {});
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const existing = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const provider = getActiveMoneyProvider();
  try {
    const result = await provider.createOnboardingLink({ userId: req.user!.id, businessProfileId: existing.id, accountType: input.accountType ?? (existing.type === 'brand' ? 'brand' : 'business'), refreshUrl: input.refreshUrl, returnUrl: input.returnUrl });
    res.status(201).json({ ...result, providerConfigured: provider.isConfigured() });
  } catch (error) {
    return providerError(res, error);
  }
}));

businessRoutes.post('/:businessProfileId/provider-account/sync', asyncRoute(async (req, res) => {
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const existing = await findAccessibleBusinessProfile(businessProfileId, req.user!.id);
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const provider = getActiveMoneyProvider();
  try {
    const account = await provider.syncConnectedAccountStatus({ userId: req.user!.id, businessProfileId: existing.id });
    res.json({ provider: provider.getPublicStatus(), account });
  } catch (error) {
    return providerError(res, error);
  }
}));
