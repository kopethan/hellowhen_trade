import { Router } from 'express';
import { updateSettingsRequestSchema, type ContentLanguageCode } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth);

const contentLanguageCodes = ['en', 'fr', 'es'] as const satisfies readonly ContentLanguageCode[];
const contentLanguageCodeSet = new Set<string>(contentLanguageCodes);
const DEFAULT_CONTENT_LANGUAGE_ORDER: ContentLanguageCode[] = ['en'];

function normalizeContentLanguageOrder(value: unknown, appLanguage?: string | null): ContentLanguageCode[] {
  const ordered: ContentLanguageCode[] = [];
  const add = (language: unknown) => {
    if (typeof language !== 'string') return;
    if (!contentLanguageCodeSet.has(language)) return;
    if (ordered.includes(language as ContentLanguageCode)) return;
    ordered.push(language as ContentLanguageCode);
  };

  if (Array.isArray(value)) {
    for (const language of value) add(language);
  }

  if (!ordered.length && appLanguage && appLanguage !== 'system') add(appLanguage);
  if (!ordered.length) {
    for (const language of DEFAULT_CONTENT_LANGUAGE_ORDER) add(language);
  }

  return ordered;
}

function serializeSettings(settings: { contentLanguageOrder?: unknown; language?: string | null } & Record<string, unknown>) {
  return {
    ...settings,
    contentLanguageOrder: normalizeContentLanguageOrder(settings.contentLanguageOrder, settings.language),
  };
}

settingsRoutes.get('/me', asyncRoute(async (req, res) => {
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, contentLanguageOrder: DEFAULT_CONTENT_LANGUAGE_ORDER },
    update: {}
  });

  res.json({ settings: serializeSettings(settings) });
}));

settingsRoutes.patch('/me', asyncRoute(async (req, res) => {
  const input = updateSettingsRequestSchema.parse(req.body);
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, contentLanguageOrder: DEFAULT_CONTENT_LANGUAGE_ORDER, ...input },
    update: input
  });

  res.json({ settings: serializeSettings(settings) });
}));
