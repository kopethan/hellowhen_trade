import { env } from '../../config/env.js';
import { classifyContentRules, type ContentClassificationInput } from './contentIntelligence.classifier.js';

type ContentDomainCategory =
  | 'design'
  | 'development'
  | 'photography_video'
  | 'writing_copywriting'
  | 'translation_language'
  | 'marketing_social'
  | 'business_startup'
  | 'education_tutoring'
  | 'local_help'
  | 'events_community'
  | 'creative_art'
  | 'health_wellness'
  | 'home_practical'
  | 'other';

type ContentSafetyCategory =
  | 'safe'
  | 'adult'
  | 'sexual'
  | 'violence'
  | 'hate_or_harassment'
  | 'self_harm'
  | 'illegal_or_regulated'
  | 'spam_or_scam'
  | 'unknown';

type ContentSafetySeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';
type ContentSuggestedAction = 'allow' | 'review' | 'hide';
type AiProvider = 'none' | 'openai' | 'gemini' | 'groq';

type AiContentSuggestionInput = ContentClassificationInput & {
  currentRules?: ReturnType<typeof classifyContentRules> | null;
};

type AiContentSuggestionResult = {
  userCategory: string | null;
  systemCategory: ContentDomainCategory;
  categoryConfidence: number;
  categoryMismatch: boolean;
  suggestedTags: string[];
  suggestedNewTags: string[];
  safetyCategory: ContentSafetyCategory;
  safetySeverity: ContentSafetySeverity;
  adultRelated: boolean;
  childSafe: boolean;
  spamOrScamRisk: boolean;
  regulatedRisk: boolean;
  suggestedAction: ContentSuggestedAction;
  reason: string;
};

export class ContentAiSuggestionError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'ContentAiSuggestionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const domainCategories: readonly ContentDomainCategory[] = [
  'design',
  'development',
  'photography_video',
  'writing_copywriting',
  'translation_language',
  'marketing_social',
  'business_startup',
  'education_tutoring',
  'local_help',
  'events_community',
  'creative_art',
  'health_wellness',
  'home_practical',
  'other',
];

const safetyCategories: readonly ContentSafetyCategory[] = [
  'safe',
  'adult',
  'sexual',
  'violence',
  'hate_or_harassment',
  'self_harm',
  'illegal_or_regulated',
  'spam_or_scam',
  'unknown',
];

const safetySeverities: readonly ContentSafetySeverity[] = ['none', 'low', 'medium', 'high', 'critical'];
const suggestedActions: readonly ContentSuggestedAction[] = ['allow', 'review', 'hide'];

function hasValue(value: string | undefined | null) {
  return Boolean(value?.trim());
}

export function shouldRunAiModerationSuggestions() {
  return env.contentIntelligenceEnabled
    && env.contentClassificationEnabled
    && env.aiModerationSuggestionsEnabled
    && env.aiEnabled
    && env.aiSuggestionsEnabled
    && env.aiAdminAssistEnabled
    && !env.aiPrivateContentEnabled;
}

function providerApiKey(provider: AiProvider) {
  if (provider === 'openai') return env.openaiApiKey;
  if (provider === 'gemini') return env.geminiApiKey;
  if (provider === 'groq') return env.groqApiKey;
  return '';
}

function providerModel(provider: AiProvider) {
  if (provider === 'openai') return env.openaiContentSuggestionModel;
  if (provider === 'gemini') return env.geminiContentSuggestionModel;
  if (provider === 'groq') return env.groqContentSuggestionModel;
  return 'none';
}

export function buildAiSuggestionProviderStatus() {
  const provider = env.aiProvider as AiProvider;
  const enabled = shouldRunAiModerationSuggestions();
  const hasApiKey = provider !== 'none' && hasValue(providerApiKey(provider));
  return {
    provider,
    model: providerModel(provider),
    enabled,
    configured: enabled && provider !== 'none' && hasApiKey,
    disabledReason: enabled
      ? (provider === 'none' ? 'AI_PROVIDER is none.' : (!hasApiKey ? `Missing ${provider} API key.` : null))
      : 'AI admin suggestions are disabled by feature flags.',
  };
}

function buildPrompt(input: AiContentSuggestionInput) {
  const fallbackRules = input.currentRules ?? classifyContentRules(input);
  const text = [
    input.title ? `Title: ${input.title}` : '',
    input.description ? `Description: ${input.description}` : '',
    input.userCategory ? `User category: ${input.userCategory}` : '',
    input.tags?.length ? `User tags: ${input.tags.join(', ')}` : '',
    input.extraText?.length ? `Extra text: ${input.extraText.filter(Boolean).join(' ')}` : '',
  ].filter(Boolean).join('\n');

  return [
    'You are an admin-only content classification assistant for an 18+ service/skill exchange marketplace.',
    'Return JSON only. Do not include markdown or explanatory prose outside JSON.',
    'Do not recommend bans, deletion, payment actions, public labels, or user-facing category rewrites.',
    'Only suggest stored admin-review signals.',
    `Allowed systemCategory values: ${domainCategories.join(', ')}.`,
    `Allowed safetyCategory values: ${safetyCategories.join(', ')}.`,
    `Allowed safetySeverity values: ${safetySeverities.join(', ')}.`,
    `Allowed suggestedAction values: ${suggestedActions.join(', ')}.`,
    'Return keys exactly: systemCategory, categoryConfidence, categoryMismatch, suggestedTags, suggestedNewTags, safetyCategory, safetySeverity, adultRelated, childSafe, spamOrScamRisk, regulatedRisk, suggestedAction, reason.',
    'categoryConfidence must be 0.0 to 1.0. suggestedTags and suggestedNewTags must be short arrays of strings.',
    'childSafe should be false for adult/sexual/violent/regulated/spam/scam/unknown content; remember the product itself is 18+ only.',
    '',
    `Target type: ${input.targetType}`,
    `Target id: ${input.targetId}`,
    `Rule-based baseline: ${JSON.stringify(fallbackRules)}`,
    '',
    'Content to classify:',
    text || '(empty content)',
  ].join('\n');
}

async function fetchJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = Number.isFinite(env.aiContentSuggestionTimeoutMs) ? Math.max(2000, env.aiContentSuggestionTimeoutMs) : 12000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      throw new ContentAiSuggestionError('ai_provider_error', `AI provider returned HTTP ${response.status}.`, 502);
    }
    return data;
  } catch (error) {
    if (error instanceof ContentAiSuggestionError) throw error;
    const message = error instanceof Error ? error.message : 'AI provider request failed.';
    throw new ContentAiSuggestionError('ai_provider_request_failed', message, 502);
  } finally {
    clearTimeout(timer);
  }
}

function firstJsonObject(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? value;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function openAiMessageContent(data: unknown) {
  const choice = (data as any)?.choices?.[0];
  return choice?.message?.content ?? choice?.text ?? null;
}

function geminiMessageContent(data: unknown) {
  return (data as any)?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text ?? '').join('') ?? null;
}

async function callOpenAiCompatible(provider: Extract<AiProvider, 'openai' | 'groq'>, prompt: string) {
  const apiKey = providerApiKey(provider);
  const url = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions';
  const data = await fetchJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: providerModel(provider),
      messages: [
        { role: 'system', content: 'Return only valid JSON for admin-only content classification.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });
  return firstJsonObject(openAiMessageContent(data));
}

async function callGemini(prompt: string) {
  const apiKey = providerApiKey('gemini');
  const model = encodeURIComponent(providerModel('gemini'));
  const data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });
  return firstJsonObject(geminiMessageContent(data));
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeConfidence(value: unknown, fallback: number) {
  const number = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, Number(number.toFixed(2))));
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().slice(0, 40);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 20) break;
  }
  return tags;
}

function normalizeReason(value: unknown, fallback: string) {
  const reason = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return reason.length > 1000 ? `${reason.slice(0, 997)}...` : reason;
}

function normalizeAiResult(raw: unknown, input: AiContentSuggestionInput): AiContentSuggestionResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ContentAiSuggestionError('ai_invalid_response', 'AI provider did not return a JSON object.', 502);
  }
  const data = raw as Record<string, unknown>;
  const fallback = input.currentRules ?? classifyContentRules(input);
  return {
    userCategory: input.userCategory?.trim() || null,
    systemCategory: normalizeEnum(data.systemCategory, domainCategories, fallback.systemCategory),
    categoryConfidence: normalizeConfidence(data.categoryConfidence, fallback.categoryConfidence),
    categoryMismatch: normalizeBoolean(data.categoryMismatch, fallback.categoryMismatch),
    suggestedTags: normalizeTags(data.suggestedTags).length ? normalizeTags(data.suggestedTags) : fallback.suggestedTags,
    suggestedNewTags: normalizeTags(data.suggestedNewTags).length ? normalizeTags(data.suggestedNewTags) : fallback.suggestedNewTags,
    safetyCategory: normalizeEnum(data.safetyCategory, safetyCategories, fallback.safetyCategory),
    safetySeverity: normalizeEnum(data.safetySeverity, safetySeverities, fallback.safetySeverity),
    adultRelated: normalizeBoolean(data.adultRelated, fallback.adultRelated),
    childSafe: normalizeBoolean(data.childSafe, fallback.childSafe),
    spamOrScamRisk: normalizeBoolean(data.spamOrScamRisk, fallback.spamOrScamRisk),
    regulatedRisk: normalizeBoolean(data.regulatedRisk, fallback.regulatedRisk),
    suggestedAction: normalizeEnum(data.suggestedAction, suggestedActions, fallback.suggestedAction),
    reason: normalizeReason(data.reason, 'AI provider returned an admin-only content classification suggestion.'),
  };
}

export async function classifyContentWithAiSuggestions(input: AiContentSuggestionInput): Promise<AiContentSuggestionResult> {
  const status = buildAiSuggestionProviderStatus();
  if (!status.enabled) {
    throw new ContentAiSuggestionError('ai_suggestions_disabled', status.disabledReason ?? 'AI admin suggestions are disabled.', 409);
  }
  if (!status.configured) {
    throw new ContentAiSuggestionError('ai_provider_not_configured', status.disabledReason ?? 'AI provider is not configured.', 409);
  }

  const provider = status.provider;
  const prompt = buildPrompt(input);
  const raw = provider === 'gemini'
    ? await callGemini(prompt)
    : provider === 'openai' || provider === 'groq'
      ? await callOpenAiCompatible(provider, prompt)
      : null;
  return normalizeAiResult(raw, input);
}
