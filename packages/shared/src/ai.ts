export const AI_PROVIDERS = ['none', 'openai', 'gemini', 'groq'] as const;
export type AiProvider = typeof AI_PROVIDERS[number];

export const AI_TASK_TYPES = [
  'support_navigation',
  'support_answer',
  'rewrite_need_title',
  'rewrite_need_description',
  'rewrite_offer_title',
  'rewrite_offer_description',
  'draft_need',
  'draft_offer',
  'draft_trade',
  'proposal_helper',
  'category_suggestions',
  'tag_suggestions',
  'trade_summary',
  'support_ticket_summary',
  'admin_summary',
  'moderation_check',
] as const;
export type AiTaskType = typeof AI_TASK_TYPES[number];

export const AI_ASSIST_SURFACES = [
  'admin_moderation',
  'need_offer_writing',
  'starter_templates',
  'safety_classification',
] as const;
export type AiAssistSurface = typeof AI_ASSIST_SURFACES[number];

export const AI_FORBIDDEN_SURFACES = [
  'private_proposal_conversation',
  'private_messages',
  'support_private_thread',
  'reports_private_queue',
  'account_security',
  'two_factor_security',
  'admin_decision_automation',
] as const;
export type AiForbiddenSurface = typeof AI_FORBIDDEN_SURFACES[number];

export type AiFeatureFlags = {
  enabled: boolean;
  provider: AiProvider;
  moderationEnabled: boolean;
  suggestionsEnabled: boolean;
  adminAssistEnabled: boolean;
  safetyClassifierEnabled: boolean;
  privateContentEnabled: boolean;
  debugPlaceholders: boolean;
};

export const AI_FEATURE_DEFAULTS: AiFeatureFlags = {
  enabled: false,
  provider: 'none',
  moderationEnabled: false,
  suggestionsEnabled: false,
  adminAssistEnabled: false,
  safetyClassifierEnabled: false,
  privateContentEnabled: false,
  debugPlaceholders: false,
};

export function normalizeAiProvider(value: string | undefined | null): AiProvider {
  const normalized = String(value ?? 'none').trim().toLowerCase();
  return (AI_PROVIDERS as readonly string[]).includes(normalized) ? normalized as AiProvider : 'none';
}

export function isAiTaskType(value: string): value is AiTaskType {
  return (AI_TASK_TYPES as readonly string[]).includes(value);
}

export function isAiAssistSurface(value: string): value is AiAssistSurface {
  return (AI_ASSIST_SURFACES as readonly string[]).includes(value);
}

export function isAiForbiddenSurface(value: string): value is AiForbiddenSurface {
  return (AI_FORBIDDEN_SURFACES as readonly string[]).includes(value);
}

export function canUseAiSurface(flags: AiFeatureFlags, surface: AiAssistSurface): boolean {
  if (!flags.enabled || flags.provider === 'none') return false;
  if (surface === 'admin_moderation') return flags.adminAssistEnabled || flags.moderationEnabled;
  if (surface === 'need_offer_writing') return flags.suggestionsEnabled;
  if (surface === 'starter_templates') return flags.adminAssistEnabled || flags.suggestionsEnabled;
  if (surface === 'safety_classification') return flags.safetyClassifierEnabled;
  return false;
}
