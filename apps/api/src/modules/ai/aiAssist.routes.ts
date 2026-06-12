import { createHash } from 'node:crypto';
import { Router } from 'express';
import { aiAssistRequestSchema, type AiAssistSuggestion } from '@hellowhen/contracts';
import { canUseAiAssist, type AiAssistTaskType } from '@hellowhen/shared';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { assertAiAssistQuotaAvailable, getAiAssistUsageSummary, recordAiAssistUsage } from '../subscriptions/aiAssistUsage.js';
import { plusConfigSnapshot } from '../subscriptions/plus.routes.js';
import {
  loadMembershipEntitlementForUser,
  membershipEntitlementAsAiAssistUser,
} from '../subscriptions/membershipEntitlements.js';

export const aiAssistRoutes = Router();

aiAssistRoutes.use(requireAuth);

class AiAssistDisabledError extends Error {
  statusCode = 403;
  code = 'ai_assist_disabled';
  publicMessage = 'AI assist is not available yet.';

  constructor() {
    super('AI assist is disabled.');
  }
}

function ensureAiAssistEnabled() {
  const config = plusConfigSnapshot();
  if (!canUseAiAssist(config)) throw new AiAssistDisabledError();
  return config;
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function sentenceCase(value: string) {
  const compact = compactWhitespace(value);
  if (!compact) return compact;
  return compact.charAt(0).toUpperCase() + compact.slice(1);
}

function truncate(value: string, max = 180) {
  const compact = compactWhitespace(value);
  return compact.length > max ? `${compact.slice(0, max - 1).trim()}…` : compact;
}

function titleFromText(text: string, prefix: string) {
  const first = compactWhitespace(text).split(/[.!?\n]/)[0] ?? '';
  const clean = truncate(first, 72);
  return clean ? sentenceCase(clean) : prefix;
}

const CATEGORY_KEYWORDS: Array<{ category: string; tags: string[]; keywords: string[] }> = [
  { category: 'Development', tags: ['coding', 'web', 'debugging'], keywords: ['react', 'next.js', 'api', 'bug', 'code', 'website', 'app', 'typescript', 'javascript'] },
  { category: 'Design', tags: ['design', 'visual', 'brand'], keywords: ['design', 'logo', 'figma', 'ui', 'ux', 'landing page', 'brand'] },
  { category: 'Photography / Video', tags: ['photo', 'video', 'editing'], keywords: ['photo', 'camera', 'portrait', 'video', 'shoot', 'edit'] },
  { category: 'Translation / Language', tags: ['translation', 'language', 'french'], keywords: ['translate', 'translation', 'french', 'english', 'language', 'français'] },
  { category: 'Marketing / Social Media', tags: ['marketing', 'social media', 'content'], keywords: ['instagram', 'tiktok', 'marketing', 'social', 'followers', 'content'] },
  { category: 'Local Help', tags: ['local help', 'practical help', 'errand'], keywords: ['move', 'moving', 'repair', 'carry', 'local', 'errand', 'help'] },
];


function parseTranslatableText(text: string): { title?: string; description?: string; body: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object') {
      const record = parsed as { title?: unknown; description?: unknown; body?: unknown; message?: unknown };
      const title = typeof record.title === 'string' ? record.title.trim() : undefined;
      const description = typeof record.description === 'string' ? record.description.trim() : undefined;
      const body = typeof record.body === 'string' ? record.body.trim() : typeof record.message === 'string' ? record.message.trim() : '';
      return { title: title || undefined, description: description || undefined, body: body || description || title || text };
    }
  } catch {
    // Plain text is still supported for the stub provider.
  }
  return { body: text };
}

function suggestCategoryTags(text: string): AiAssistSuggestion {
  const normalized = text.toLowerCase();
  const match = CATEGORY_KEYWORDS.find((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)));
  return {
    text: match
      ? `Suggested category: ${match.category}. Suggested tags: ${match.tags.join(', ')}.`
      : 'Suggested category: Other. Suggested tags: clear request, practical exchange.',
    category: match?.category ?? 'Other',
    tags: match?.tags ?? ['clear request', 'practical exchange'],
  };
}

function buildStubSuggestion(taskType: AiAssistTaskType, text: string, input: ReturnType<typeof aiAssistRequestSchema.parse>): AiAssistSuggestion {
  const base = truncate(text, 800);
  switch (taskType) {
    case 'need_title': {
      const title = titleFromText(text, 'Clear need title');
      return { text: title, title };
    }
    case 'offer_title': {
      const title = titleFromText(text, 'Clear offer title');
      return { text: title, title };
    }
    case 'need_description':
      return {
        text: `I need ${sentenceCase(base).replace(/^I need\s+/i, '')}\n\nUseful details: timing, location or remote format, and the result I expect.`,
        description: `I need ${sentenceCase(base).replace(/^I need\s+/i, '')}\n\nUseful details: timing, location or remote format, and the result I expect.`,
      };
    case 'offer_description':
      return {
        text: `I can help with ${sentenceCase(base).replace(/^I can\s+/i, '')}\n\nIncludes: what I can deliver, when I am available, and any limits to the offer.`,
        description: `I can help with ${sentenceCase(base).replace(/^I can\s+/i, '')}\n\nIncludes: what I can deliver, when I am available, and any limits to the offer.`,
      };
    case 'proposal_message':
      return {
        text: `Hi! I’m interested in this trade. I can help with ${truncate(base, 220)}. I’m happy to confirm the scope, timing, and next steps here before we start.`,
      };
    case 'translate_text': {
      const target = input.targetLanguage ?? (input.sourceLanguage === 'fr' ? 'en' : 'fr');
      const translatable = parseTranslatableText(text);
      const prefix = `[Stub ${target.toUpperCase()} translation]`;
      return {
        text: `${prefix} ${truncate(translatable.body, 800)}`,
        title: translatable.title ? `${prefix} ${truncate(translatable.title, 100)}` : undefined,
        description: translatable.description ? `${prefix} ${truncate(translatable.description, 800)}` : undefined,
        language: target,
      };
    }
    case 'category_tags':
      return suggestCategoryTags(text);
    case 'safety_readability':
      return {
        text: 'Stub safety/readability check completed. Keep the request specific, avoid sharing passwords/payment details, and keep agreement details inside the Hellowhen chat.',
        safetyNotes: [
          'Do not share passwords, card details, or sensitive documents.',
          'Keep important agreement details inside the Hellowhen chat.',
        ],
        readabilityNotes: [
          base.length < 40 ? 'Add more concrete details so the other user understands the scope.' : 'The text has enough context for a first draft.',
        ],
      };
    default:
      return { text: base };
  }
}

function buildInputHash(input: unknown) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

aiAssistRoutes.post('/assist', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = aiAssistRequestSchema.parse(req.body);
  const config = ensureAiAssistEnabled();
  const entitlement = await loadMembershipEntitlementForUser(prisma as any, req.user!.id);
  if (!entitlement) return res.status(404).json({ error: 'not_found' });
  const user = membershipEntitlementAsAiAssistUser(req.user!.id, entitlement);

  await assertAiAssistQuotaAvailable(prisma as any, user, config);

  const suggestion = buildStubSuggestion(input.taskType, input.text, input);
  const usageRecord = await recordAiAssistUsage(prisma as any, config, {
    user,
    taskType: input.taskType,
    status: 'completed',
    inputHash: buildInputHash(input),
    metadata: {
      provider: 'stub',
      targetType: input.targetType ?? null,
      sourceLanguage: input.sourceLanguage ?? null,
      targetLanguage: input.targetLanguage ?? null,
      textLength: input.text.length,
      contextLength: input.context?.length ?? 0,
    },
  }) as { id: string; status: string; periodKey: string; taskType: string; requestedAt: Date | string; completedAt: Date | string | null } | null;

  const usage = await getAiAssistUsageSummary(prisma as any, user, config);
  if (!usageRecord) return res.status(500).json({ error: 'usage_record_failed', message: 'AI assist usage could not be recorded.' });

  return res.json({
    mode: 'stub',
    taskType: input.taskType,
    suggestion,
    usage,
    usageRecord: {
      id: usageRecord.id,
      status: usageRecord.status,
      periodKey: usageRecord.periodKey,
      taskType: usageRecord.taskType,
      requestedAt: iso(usageRecord.requestedAt),
      completedAt: iso(usageRecord.completedAt),
    },
    message: 'Stub AI assist suggestion generated. The user must review and approve before using it.',
  });
}));
