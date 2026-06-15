import type {
  ModerationFeatureFlags,
  ModerationProviderLabel,
  ModerationProviderName,
  ModerationProviderPayload,
  ModerationProviderResult,
  ModerationScanType,
  ModerationSeverity,
} from '@hellowhen/contracts';
import { moderationProviderPayloadSchema, moderationProviderResultSchema } from '@hellowhen/contracts';
import { createFailedModerationResult, createSkippedModerationResult, highestModerationSeverity, shouldRunModerationProvider, suggestedActionForSeverity } from '@hellowhen/shared';
import { env } from '../../config/env.js';

export type ModerationProviderAdapter = {
  name: ModerationProviderName;
  scanText?(payload: ModerationProviderPayload): Promise<ModerationProviderResult>;
  scanImage?(payload: ModerationProviderPayload): Promise<ModerationProviderResult>;
  scanCombined?(payload: ModerationProviderPayload): Promise<ModerationProviderResult>;
};

type ScanAttemptOptions = {
  timeoutMs: number;
  maxRetries: number;
};

class ModerationProviderTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Moderation provider scan timed out after ${timeoutMs}ms.`);
    this.name = 'ModerationProviderTimeoutError';
  }
}

export function getModerationFeatureFlags(): ModerationFeatureFlags {
  return {
    enabled: env.moderationEnabled,
    provider: env.moderationProvider,
    textEnabled: env.moderationTextEnabled,
    imageEnabled: env.moderationImageEnabled,
    privateMessageScanEnabled: env.moderationPrivateMessageScanEnabled,
    storeRawProviderResult: env.moderationStoreRawProviderResult,
    providerTimeoutMs: env.moderationProviderTimeoutMs,
    providerMaxRetries: env.moderationProviderMaxRetries,
    textReviewOnCreateEnabled: env.aiTextReviewOnCreateEnabled,
    textReviewOnEditEnabled: env.aiTextReviewOnEditEnabled,
    textReviewPublicMessagesEnabled: env.aiTextReviewPublicMessagesEnabled,
    textReviewProfileEnabled: env.aiTextReviewProfileEnabled,
    textReviewPrivateMessagesEnabled: env.aiTextReviewPrivateMessagesEnabled,
    textReviewEnforcementEnabled: env.aiTextReviewEnforcementEnabled,
    textFailMode: env.moderationTextFailMode,
  };
}

function createNoopModerationProvider(name: ModerationProviderName, reason: string): ModerationProviderAdapter {
  async function scan(payload: ModerationProviderPayload) {
    return createSkippedModerationResult(name, payload.scanType, reason);
  }
  return {
    name,
    scanText: scan,
    scanImage: scan,
    scanCombined: scan,
  };
}

function keywordLabel(text: string, category: ModerationProviderLabel['category'], severity: ModerationSeverity, keywords: string[]): ModerationProviderLabel | null {
  const normalized = text.toLowerCase();
  const sourceLabel = keywords.find((keyword) => normalized.includes(keyword));
  if (!sourceLabel) return null;
  return { category, severity, confidence: severity === 'high' || severity === 'critical' ? 0.92 : 0.74, sourceLabel };
}

function buildMockLabels(payload: ModerationProviderPayload): ModerationProviderLabel[] {
  const textParts = [payload.text?.title, payload.text?.description, payload.text?.message, payload.image?.temporaryUrl, payload.image?.mimeType].filter(Boolean).join(' ');
  const labels = [
    keywordLabel(textParts, 'adult', 'high', ['adult', 'nude', 'nudity', 'porn', 'sexual']),
    keywordLabel(textParts, 'violence', 'high', ['violence', 'blood', 'gore', 'weapon']),
    keywordLabel(textParts, 'hate_or_harassment', 'high', ['hate', 'harass', 'slur']),
    keywordLabel(textParts, 'self_harm', 'critical', ['self-harm', 'suicide', 'kill myself']),
    keywordLabel(textParts, 'illegal_or_regulated', 'medium', ['drug', 'cocaine', 'fake id', 'counterfeit']),
    keywordLabel(textParts, 'spam_or_scam', 'medium', ['scam', 'phishing', 'free money', 'guaranteed profit']),
    keywordLabel(textParts, 'personal_data', 'medium', ['passport', 'bank card', 'credit card', 'social security']),
  ].filter(Boolean) as ModerationProviderLabel[];

  if (payload.scanType === 'image' && payload.image?.mimeType && !payload.image.mimeType.toLowerCase().startsWith('image/')) {
    labels.push({ category: 'unknown', severity: 'medium', confidence: 0.86, sourceLabel: 'unsupported_image_mime_type' });
  }

  if (!labels.length) labels.push({ category: 'safe', severity: 'none', confidence: 0.99, sourceLabel: 'mock_safe' });
  return labels;
}

function createMockModerationProvider(): ModerationProviderAdapter {
  async function scan(payload: ModerationProviderPayload): Promise<ModerationProviderResult> {
    const labels = buildMockLabels(payload);
    const highestSeverity = highestModerationSeverity(labels.map((label) => label.severity));
    return moderationProviderResultSchema.parse({
      provider: 'mock',
      scanType: payload.scanType,
      status: 'completed',
      labels,
      highestSeverity,
      suggestedAction: suggestedActionForSeverity(highestSeverity),
      reason: highestSeverity === 'none' ? 'Mock moderation found no risky labels.' : 'Mock moderation matched deterministic safety keywords.',
      providerRequestId: `mock_${Date.now()}`,
      attemptCount: 1,
      retriable: false,
      raw: {
        mock: true,
        contentType: payload.contentType,
        visibility: payload.visibility,
        labelCount: labels.length,
      },
    });
  }

  return {
    name: 'mock',
    scanText: scan,
    scanImage: scan,
    scanCombined: scan,
  };
}


function textForOpenAiModeration(payload: ModerationProviderPayload) {
  const parts = [
    `Content type: ${payload.contentType}`,
    `Visibility: ${payload.visibility}`,
    payload.context?.country ? `Country: ${payload.context.country}` : null,
    payload.context?.appArea ? `App area: ${payload.context.appArea}` : null,
    payload.text?.locale ? `Locale: ${payload.text.locale}` : null,
    payload.text?.title ? `Title:\n${payload.text.title}` : null,
    payload.text?.description ? `Description:\n${payload.text.description}` : null,
    payload.text?.message ? `Message:\n${payload.text.message}` : null,
  ].filter(Boolean);

  return parts.join('\n\n').slice(0, 8000);
}

type OpenAiModerationCategoryResult = {
  flagged?: boolean;
  categories?: Record<string, boolean>;
  category_scores?: Record<string, number>;
};

type OpenAiModerationResponse = {
  id?: string;
  model?: string;
  results?: OpenAiModerationCategoryResult[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

function openAiCategoryToModerationCategory(sourceLabel: string): ModerationProviderLabel['category'] {
  if (sourceLabel.startsWith('sexual')) return sourceLabel.includes('minors') ? 'sexual' : 'adult';
  if (sourceLabel.startsWith('harassment') || sourceLabel.startsWith('hate')) return 'hate_or_harassment';
  if (sourceLabel.startsWith('self-harm')) return 'self_harm';
  if (sourceLabel.startsWith('violence')) return 'violence';
  if (sourceLabel.startsWith('illicit')) return 'illegal_or_regulated';
  return 'unknown';
}

function openAiSeverityForCategory(sourceLabel: string, score: number, flagged: boolean): ModerationSeverity {
  if (sourceLabel === 'sexual/minors' || sourceLabel === 'self-harm/instructions' || sourceLabel === 'self-harm/intent') return flagged || score >= 0.5 ? 'critical' : 'high';
  if (sourceLabel === 'violence/graphic' || sourceLabel === 'illicit/violent') return flagged || score >= 0.5 ? 'high' : 'medium';
  if (flagged) return score >= 0.92 ? 'critical' : 'high';
  if (score >= 0.85) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function buildOpenAiLabels(result: OpenAiModerationCategoryResult): ModerationProviderLabel[] {
  const categories = result.categories ?? {};
  const scores = result.category_scores ?? {};
  const labels = Object.entries(scores)
    .filter(([sourceLabel, score]) => Boolean(categories[sourceLabel]) || score >= 0.35)
    .map(([sourceLabel, score]) => ({
      category: openAiCategoryToModerationCategory(sourceLabel),
      severity: openAiSeverityForCategory(sourceLabel, Number(score), Boolean(categories[sourceLabel])),
      confidence: Math.max(0, Math.min(1, Number(score))),
      sourceLabel,
    } satisfies ModerationProviderLabel));

  if (!labels.length) labels.push({ category: 'safe', severity: 'none', confidence: 0.99, sourceLabel: 'openai_safe' });
  return labels;
}

function openAiModerationEndpoint() {
  return env.moderationProviderEndpoint.trim() || 'https://api.openai.com/v1/moderations';
}

function createOpenAiModerationProvider(): ModerationProviderAdapter {
  async function scanText(payload: ModerationProviderPayload): Promise<ModerationProviderResult> {
    if (!env.moderationProviderApiKey) {
      return createFailedModerationResult('openai', payload.scanType, {
        reason: 'OpenAI moderation provider is configured but MODERATION_PROVIDER_API_KEY is missing.',
        errorCode: 'missing_provider_api_key',
        errorMessage: 'Set MODERATION_PROVIDER_API_KEY to an OpenAI API key before enabling MODERATION_PROVIDER=openai.',
        retriable: false,
      });
    }

    const input = textForOpenAiModeration(payload);
    if (!input.trim()) return createSkippedModerationResult('openai', payload.scanType, 'OpenAI text moderation skipped because no text input was present.');

    const response = await fetch(openAiModerationEndpoint(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.moderationProviderApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.openaiModerationModel,
        input,
      }),
    });

    let body: OpenAiModerationResponse | null = null;
    try {
      body = await response.json() as OpenAiModerationResponse;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const message = body?.error?.message || `OpenAI moderation request failed with status ${response.status}.`;
      if (response.status === 429 || response.status >= 500) throw new Error(message);
      return createFailedModerationResult('openai', payload.scanType, {
        reason: 'OpenAI moderation request failed.',
        errorCode: body?.error?.code || body?.error?.type || `http_${response.status}`,
        errorMessage: message,
        retriable: false,
      });
    }

    const firstResult = body?.results?.[0];
    if (!firstResult) {
      return createFailedModerationResult('openai', payload.scanType, {
        reason: 'OpenAI moderation response did not include a result.',
        errorCode: 'missing_provider_result',
        errorMessage: 'No first moderation result was returned by OpenAI.',
        retriable: true,
      });
    }

    const labels = buildOpenAiLabels(firstResult);
    const highestSeverity = highestModerationSeverity(labels.map((label) => label.severity));

    return moderationProviderResultSchema.parse({
      provider: 'openai',
      scanType: payload.scanType,
      status: 'completed',
      labels,
      highestSeverity,
      suggestedAction: suggestedActionForSeverity(highestSeverity),
      reason: firstResult.flagged ? 'OpenAI moderation flagged text for safety review.' : 'OpenAI moderation did not flag this text.',
      providerRequestId: body?.id,
      retriable: false,
      raw: {
        model: body?.model,
        flagged: Boolean(firstResult.flagged),
        categories: firstResult.categories ?? {},
        category_scores: firstResult.category_scores ?? {},
      },
    });
  }

  return {
    name: 'openai',
    scanText,
  };
}

function createUnimplementedExternalProvider(name: ModerationProviderName): ModerationProviderAdapter {
  async function scan(payload: ModerationProviderPayload) {
    return createFailedModerationResult(name, payload.scanType, {
      reason: 'Moderation provider adapter exists, but this external provider is not implemented or connected yet.',
      errorCode: 'provider_not_implemented',
      errorMessage: `${name} is reserved for a later provider-specific integration patch.`,
      retriable: false,
    });
  }

  return {
    name,
    scanText: scan,
    scanImage: scan,
    scanCombined: scan,
  };
}

export function getModerationProviderAdapter(provider: ModerationProviderName = env.moderationProvider): ModerationProviderAdapter {
  if (provider === 'mock') return createMockModerationProvider();
  if (provider === 'openai') return createOpenAiModerationProvider();
  if (provider === 'none') return createNoopModerationProvider('none', 'No moderation provider is configured.');
  return createUnimplementedExternalProvider(provider);
}

function getScanFunction(adapter: ModerationProviderAdapter, scanType: ModerationScanType) {
  if (scanType === 'text') return adapter.scanText?.bind(adapter);
  if (scanType === 'image') return adapter.scanImage?.bind(adapter);
  return adapter.scanCombined?.bind(adapter) ?? adapter.scanText?.bind(adapter) ?? adapter.scanImage?.bind(adapter);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ModerationProviderTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeProviderResult(result: ModerationProviderResult, input: { provider: ModerationProviderName; scanType: ModerationScanType; durationMs: number; attemptCount: number }) {
  return moderationProviderResultSchema.parse({
    ...result,
    provider: result.provider ?? input.provider,
    scanType: result.scanType ?? input.scanType,
    durationMs: result.durationMs ?? input.durationMs,
    attemptCount: result.attemptCount ?? input.attemptCount,
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown moderation provider error.');
}

async function runProviderScanWithRetry(adapter: ModerationProviderAdapter, payload: ModerationProviderPayload, options: ScanAttemptOptions): Promise<ModerationProviderResult> {
  const scan = getScanFunction(adapter, payload.scanType);
  if (!scan) {
    return createFailedModerationResult(adapter.name, payload.scanType, {
      reason: 'Configured moderation provider does not support this scan type.',
      errorCode: 'scan_type_not_supported',
      errorMessage: `${adapter.name} does not support ${payload.scanType} scans in this adapter.`,
      retriable: false,
    });
  }

  const startedAt = Date.now();
  let lastError: unknown;
  const maxAttempts = Math.max(1, options.maxRetries + 1);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await withTimeout(scan(payload), options.timeoutMs);
      return normalizeProviderResult(result, { provider: adapter.name, scanType: payload.scanType, durationMs: Date.now() - startedAt, attemptCount: attempt });
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt >= maxAttempts;
      if (isLastAttempt) break;
    }
  }

  const timedOut = lastError instanceof ModerationProviderTimeoutError;
  return createFailedModerationResult(adapter.name, payload.scanType, {
    reason: timedOut ? 'Moderation provider scan timed out.' : 'Moderation provider scan failed after retry handling.',
    errorCode: timedOut ? 'provider_timeout' : 'provider_scan_failed',
    errorMessage: errorMessage(lastError),
    durationMs: Date.now() - startedAt,
    attemptCount: maxAttempts,
    retriable: true,
  });
}

export async function scanWithConfiguredModerationProvider(payload: ModerationProviderPayload): Promise<ModerationProviderResult> {
  const parsedPayload = moderationProviderPayloadSchema.parse(payload);
  const flags = getModerationFeatureFlags();
  const adapter = getModerationProviderAdapter(flags.provider);

  if (!shouldRunModerationProvider(flags, parsedPayload.scanType)) {
    return moderationProviderResultSchema.parse(createSkippedModerationResult(adapter.name, parsedPayload.scanType, 'Moderation provider scan is disabled by feature flags.'));
  }

  return runProviderScanWithRetry(adapter, parsedPayload, {
    timeoutMs: flags.providerTimeoutMs ?? 10000,
    maxRetries: flags.providerMaxRetries ?? 0,
  });
}
