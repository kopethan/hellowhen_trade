import type { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';

type ContentClassificationTargetType =
  | 'need'
  | 'offer'
  | 'trade'
  | 'profile'
  | 'business_template'
  | 'business_need'
  | 'business_offer'
  | 'business_campaign';

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

type ContentClassificationClient = Pick<Prisma.TransactionClient, 'contentClassification'>;

type ContentReviewGateClassification = {
  status?: string | null;
  categoryMismatch?: boolean | null;
  safetyCategory?: string | null;
  safetySeverity?: string | null;
  suggestedAction?: string | null;
  reason?: string | null;
};

export type ContentReviewGateDecision = {
  shouldGate: boolean;
  suggestedAction: ContentSuggestedAction;
  reason: string | null;
  reasons: string[];
};

export type ContentClassificationInput = {
  targetType: ContentClassificationTargetType;
  targetId: string;
  title?: string | null;
  description?: string | null;
  userCategory?: string | null;
  tags?: readonly string[] | null;
  extraText?: readonly (string | null | undefined)[];
};

type SafetyRule = {
  category: Exclude<ContentSafetyCategory, 'safe' | 'unknown'>;
  severity: ContentSafetySeverity;
  action: ContentSuggestedAction;
  terms: readonly string[];
};

type DomainRule = {
  category: ContentDomainCategory;
  aliases: readonly string[];
  terms: readonly string[];
};

type TagRule = {
  tag: string;
  terms: readonly string[];
};

const safetyRules: readonly SafetyRule[] = [
  {
    category: 'sexual',
    severity: 'high',
    action: 'review',
    terms: ['sex', 'sexual', 'porn', 'nude', 'nudes', 'erotic', 'escort', 'onlyfans', 'fetish', 'xxx'],
  },
  {
    category: 'adult',
    severity: 'medium',
    action: 'review',
    terms: ['adult content', '18+', 'nsfw', 'strip', 'boudoir', 'lingerie shoot'],
  },
  {
    category: 'violence',
    severity: 'high',
    action: 'review',
    terms: ['weapon', 'gun', 'knife', 'fight', 'assault', 'attack', 'blood', 'explosive', 'bomb'],
  },
  {
    category: 'hate_or_harassment',
    severity: 'high',
    action: 'review',
    terms: ['hate speech', 'harass', 'harassment', 'bully', 'threaten', 'racist', 'slur'],
  },
  {
    category: 'self_harm',
    severity: 'critical',
    action: 'review',
    terms: ['self harm', 'suicide', 'kill myself', 'cutting myself', 'hurt myself'],
  },
  {
    category: 'illegal_or_regulated',
    severity: 'high',
    action: 'review',
    terms: ['drugs', 'cocaine', 'weed delivery', 'fake id', 'passport fake', 'stolen', 'weapon sale', 'crypto investment', 'loan shark'],
  },
  {
    category: 'spam_or_scam',
    severity: 'medium',
    action: 'review',
    terms: ['get rich quick', 'guaranteed profit', 'investment opportunity', 'telegram only', 'whatsapp only', 'pay outside', 'wire transfer', 'gift card', 'limited time offer', 'click here'],
  },
];

const domainRules: readonly DomainRule[] = [
  {
    category: 'design',
    aliases: ['design', 'graphic design', 'branding', 'ux', 'ui'],
    terms: ['logo', 'brand identity', 'visual identity', 'poster', 'flyer', 'figma', 'ui', 'ux', 'wireframe', 'mockup', 'design system', 'icon'],
  },
  {
    category: 'development',
    aliases: ['development', 'dev', 'software', 'coding', 'programming', 'web development'],
    terms: ['react', 'next.js', 'nextjs', 'typescript', 'javascript', 'api', 'bug', 'website', 'web app', 'frontend', 'backend', 'database', 'prisma', 'node.js', 'expo'],
  },
  {
    category: 'photography_video',
    aliases: ['photography', 'video', 'photo', 'photography video'],
    terms: ['portrait photo', 'portrait photos', 'product photo', 'photoshoot', 'photo shoot', 'photography', 'video editing', 'videography', 'reels', 'camera', 'headshot'],
  },
  {
    category: 'writing_copywriting',
    aliases: ['writing', 'copywriting', 'copy', 'content writing'],
    terms: ['copywriting', 'landing page copy', 'blog post', 'article', 'headline', 'caption', 'proofread', 'editing text', 'resume', 'cv', 'cover letter'],
  },
  {
    category: 'translation_language',
    aliases: ['translation', 'language', 'languages', 'french english', 'french-english'],
    terms: ['translate', 'translation', 'french', 'english', 'français', 'anglais', 'language exchange', 'grammar', 'proofread french', 'proofread english'],
  },
  {
    category: 'marketing_social',
    aliases: ['marketing', 'social media', 'growth', 'instagram'],
    terms: ['instagram', 'tiktok', 'social post', 'social media', 'marketing', 'newsletter', 'seo', 'ads', 'campaign', 'content calendar', 'community management'],
  },
  {
    category: 'business_startup',
    aliases: ['business', 'startup', 'founder'],
    terms: ['pitch deck', 'business plan', 'startup', 'founder', 'investor', 'market research', 'pricing', 'sales deck', 'landing page strategy'],
  },
  {
    category: 'education_tutoring',
    aliases: ['education', 'tutoring', 'teaching', 'lesson'],
    terms: ['tutor', 'tutoring', 'lesson', 'homework', 'study', 'exam', 'teach me', 'course', 'workshop', 'mentor'],
  },
  {
    category: 'local_help',
    aliases: ['local help', 'errands', 'local'],
    terms: ['move apartment', 'moving help', 'errand', 'pickup', 'delivery help', 'local help', 'carry', 'assemble', 'queue', 'repair help'],
  },
  {
    category: 'events_community',
    aliases: ['events', 'community', 'meetup'],
    terms: ['event', 'meetup', 'community', 'workshop', 'conference', 'party', 'networking', 'volunteer', 'festival'],
  },
  {
    category: 'creative_art',
    aliases: ['creative', 'art', 'music'],
    terms: ['illustration', 'drawing', 'painting', 'music', 'song', 'voiceover', 'creative', 'artwork', 'animation', 'comic'],
  },
  {
    category: 'health_wellness',
    aliases: ['health', 'wellness', 'fitness'],
    terms: ['fitness', 'yoga', 'meditation', 'wellness', 'nutrition', 'workout', 'mental health', 'coach'],
  },
  {
    category: 'home_practical',
    aliases: ['home', 'practical', 'cleaning', 'diy'],
    terms: ['cleaning', 'organizing', 'home', 'garden', 'cook', 'cooking', 'diy', 'furniture', 'pet sitting', 'babysitting'],
  },
];

const tagRules: readonly TagRule[] = [
  { tag: 'React', terms: ['react', 'react.js', 'reactjs'] },
  { tag: 'Next.js', terms: ['next.js', 'nextjs'] },
  { tag: 'TypeScript', terms: ['typescript'] },
  { tag: 'API', terms: ['api', 'backend endpoint', 'endpoint'] },
  { tag: 'logo', terms: ['logo'] },
  { tag: 'landing page', terms: ['landing page'] },
  { tag: 'portrait photos', terms: ['portrait photo', 'portrait photos', 'headshot'] },
  { tag: 'product photos', terms: ['product photo', 'product photos'] },
  { tag: 'French-English', terms: ['french english', 'french-english', 'français anglais', 'anglais français'] },
  { tag: 'Instagram', terms: ['instagram'] },
  { tag: 'portfolio', terms: ['portfolio'] },
  { tag: 'copywriting', terms: ['copywriting', 'copy', 'headline'] },
  { tag: 'CV', terms: ['cv', 'resume'] },
  { tag: 'pitch deck', terms: ['pitch deck'] },
  { tag: 'Figma', terms: ['figma'] },
  { tag: 'SEO', terms: ['seo'] },
  { tag: 'translation', terms: ['translate', 'translation'] },
];

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesTerm(text: string, term: string) {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  if (/^[a-z0-9+#.]+$/i.test(normalizedTerm)) {
    return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}($|\\s)`, 'i').test(text);
  }
  return text.includes(normalizedTerm);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unique(values: readonly string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function buildCombinedText(input: ContentClassificationInput) {
  return [
    input.title,
    input.description,
    input.userCategory,
    ...(input.tags ?? []),
    ...(input.extraText ?? []),
  ].map((value) => value ?? '').join(' ');
}

function classifySafety(text: string) {
  const matches = safetyRules
    .map((rule) => ({ rule, terms: rule.terms.filter((term) => includesTerm(text, term)) }))
    .filter((match) => match.terms.length > 0);

  if (!text) {
    return {
      safetyCategory: 'unknown' as const,
      safetySeverity: 'low' as const,
      suggestedAction: 'review' as const,
      adultRelated: false,
      childSafe: false,
      spamOrScamRisk: false,
      regulatedRisk: false,
      matches: [] as string[],
    };
  }

  if (!matches.length) {
    return {
      safetyCategory: 'safe' as const,
      safetySeverity: 'none' as const,
      suggestedAction: 'allow' as const,
      adultRelated: false,
      childSafe: true,
      spamOrScamRisk: false,
      regulatedRisk: false,
      matches: [] as string[],
    };
  }

  const severityRank: Record<ContentSafetySeverity, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  const strongest = matches.reduce((best, current) => severityRank[current.rule.severity] > severityRank[best.rule.severity] ? current : best);
  const categories = new Set(matches.map((match) => match.rule.category));
  const hideCandidate = strongest.rule.severity === 'critical' || (strongest.rule.severity === 'high' && strongest.rule.category === 'hate_or_harassment');

  return {
    safetyCategory: strongest.rule.category,
    safetySeverity: strongest.rule.severity,
    suggestedAction: hideCandidate ? 'hide' as const : strongest.rule.action,
    adultRelated: categories.has('adult') || categories.has('sexual'),
    childSafe: false,
    spamOrScamRisk: categories.has('spam_or_scam'),
    regulatedRisk: categories.has('illegal_or_regulated'),
    matches: unique(matches.flatMap((match) => match.terms)).slice(0, 10),
  };
}

function scoreDomain(text: string) {
  const scored = domainRules.map((rule) => {
    const termMatches = rule.terms.filter((term) => includesTerm(text, term));
    const aliasMatches = rule.aliases.filter((alias) => includesTerm(text, alias));
    return { rule, score: termMatches.length * 2 + aliasMatches.length, matches: unique([...termMatches, ...aliasMatches]) };
  }).filter((item) => item.score > 0);

  if (!scored.length) {
    return { systemCategory: 'other' as ContentDomainCategory, categoryConfidence: 0.25, matches: [] as string[] };
  }

  scored.sort((left, right) => right.score - left.score);
  const best = scored[0]!;
  const runnerUp = scored[1];
  const gap = best.score - (runnerUp?.score ?? 0);
  const confidence = Math.min(0.95, Math.max(0.45, 0.45 + best.score * 0.08 + gap * 0.04));

  return { systemCategory: best.rule.category, categoryConfidence: Number(confidence.toFixed(2)), matches: best.matches.slice(0, 8) };
}

function inferCategoryFromUserCategory(userCategory?: string | null) {
  const text = normalizeText(userCategory ?? '');
  if (!text) return null;
  for (const rule of domainRules) {
    if (rule.category === text) return rule.category;
    if (rule.aliases.some((alias) => normalizeText(alias) === text || includesTerm(text, alias))) return rule.category;
    if (rule.terms.some((term) => normalizeText(term) === text)) return rule.category;
  }
  return null;
}

function classifyTags(text: string, existingTags: readonly string[] | null | undefined) {
  const suggestedTags = unique(tagRules
    .filter((rule) => rule.terms.some((term) => includesTerm(text, term)))
    .map((rule) => rule.tag));
  const existing = new Set((existingTags ?? []).map((tag) => normalizeText(tag)));
  const suggestedNewTags = suggestedTags.filter((tag) => !existing.has(normalizeText(tag))).slice(0, 12);
  return { suggestedTags: suggestedTags.slice(0, 12), suggestedNewTags };
}

function buildReason(parts: readonly string[]) {
  const reason = parts.filter(Boolean).join(' ');
  return reason.length > 1000 ? `${reason.slice(0, 997)}...` : reason;
}

export function classifyContentRules(input: ContentClassificationInput) {
  const rawText = buildCombinedText(input);
  const normalizedText = normalizeText(rawText);
  const safety = classifySafety(normalizedText);
  const domain = scoreDomain(normalizedText);
  const tags = classifyTags(normalizedText, input.tags);
  const userCategoryMatch = inferCategoryFromUserCategory(input.userCategory);
  const categoryMismatch = Boolean(
    input.userCategory
      && domain.systemCategory !== 'other'
      && domain.categoryConfidence >= 0.55
      && userCategoryMatch
      && userCategoryMatch !== domain.systemCategory,
  );

  const reason = buildReason([
    safety.matches.length
      ? `Safety rule signals: ${safety.matches.join(', ')}.`
      : 'No safety risk keywords matched.',
    domain.matches.length
      ? `Domain signals suggest ${domain.systemCategory.replaceAll('_', ' ')}: ${domain.matches.join(', ')}.`
      : 'No strong domain signals matched; defaulted to other.',
    tags.suggestedTags.length ? `Suggested tags: ${tags.suggestedTags.join(', ')}.` : '',
    categoryMismatch ? `User category appears to differ from the rule-based category suggestion.` : '',
  ]);

  return {
    userCategory: input.userCategory?.trim() || null,
    systemCategory: domain.systemCategory,
    categoryConfidence: domain.categoryConfidence,
    categoryMismatch,
    suggestedTags: tags.suggestedTags,
    suggestedNewTags: tags.suggestedNewTags,
    safetyCategory: safety.safetyCategory,
    safetySeverity: safety.safetySeverity,
    adultRelated: safety.adultRelated,
    childSafe: safety.childSafe,
    spamOrScamRisk: safety.spamOrScamRisk,
    regulatedRisk: safety.regulatedRisk,
    suggestedAction: safety.suggestedAction,
    reason,
  };
}

export function shouldRunContentClassification() {
  return env.contentIntelligenceEnabled && env.contentClassificationEnabled;
}

export function shouldRunContentReviewGate() {
  return shouldRunContentClassification() && env.contentReviewGateEnabled && env.autoModerationActionsEnabled;
}

const contentSafetySeverityRank: Record<ContentSafetySeverity, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

function normalizeSuggestedAction(value?: string | null): ContentSuggestedAction {
  return value === 'hide' || value === 'review' || value === 'allow' ? value : 'review';
}

function normalizeSafetySeverity(value?: string | null): ContentSafetySeverity {
  return value === 'none' || value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : 'low';
}

export function buildContentReviewGateDecision(classification: ContentReviewGateClassification | null | undefined): ContentReviewGateDecision {
  if (!classification || !shouldRunContentReviewGate()) {
    return { shouldGate: false, suggestedAction: 'allow', reason: null, reasons: [] };
  }

  const reasons: string[] = [];
  const safetySeverity = normalizeSafetySeverity(classification.safetySeverity);
  const suggestedAction = normalizeSuggestedAction(classification.suggestedAction);

  if (env.contentReviewGateHighRiskEnabled && contentSafetySeverityRank[safetySeverity] >= contentSafetySeverityRank.high) {
    reasons.push(`Safety severity is ${safetySeverity}${classification.safetyCategory ? ` (${classification.safetyCategory})` : ''}.`);
  }

  if (env.contentReviewGateSuggestedHideEnabled && suggestedAction === 'hide') {
    reasons.push('Rule-based classifier suggested hiding this content pending admin review.');
  }

  if (env.contentReviewGateCategoryMismatchEnabled && classification.categoryMismatch) {
    reasons.push('User-selected category differs from the rule-based category suggestion.');
  }

  if (env.contentReviewGateClassifierFailureEnabled && classification.status === 'failed') {
    reasons.push('Rule-based classifier failed, so the content requires manual review before public discovery.');
  }

  const reason = buildReason([
    ...reasons,
    classification.reason ? `Classifier reason: ${classification.reason}` : '',
  ]);

  return {
    shouldGate: reasons.length > 0,
    suggestedAction: suggestedAction === 'allow' && reasons.length > 0 ? 'review' : suggestedAction,
    reason: reasons.length > 0 ? reason : null,
    reasons,
  };
}

export async function classifyContentRulesIfEnabled(client: ContentClassificationClient, input: ContentClassificationInput) {
  if (!shouldRunContentClassification()) return null;

  try {
    const result = classifyContentRules(input);
    return await client.contentClassification.upsert({
      where: { targetType_targetId_source: { targetType: input.targetType, targetId: input.targetId, source: 'rules' } },
      create: {
        targetType: input.targetType,
        targetId: input.targetId,
        source: 'rules',
        status: 'completed',
        ...result,
      },
      update: {
        status: 'completed',
        userCategory: result.userCategory,
        systemCategory: result.systemCategory,
        categoryConfidence: result.categoryConfidence,
        categoryMismatch: result.categoryMismatch,
        suggestedTags: result.suggestedTags,
        suggestedNewTags: result.suggestedNewTags,
        safetyCategory: result.safetyCategory,
        safetySeverity: result.safetySeverity,
        adultRelated: result.adultRelated,
        childSafe: result.childSafe,
        spamOrScamRisk: result.spamOrScamRisk,
        regulatedRisk: result.regulatedRisk,
        suggestedAction: result.suggestedAction,
        reason: result.reason,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Rule-based content classification failed.';
    try {
      return await client.contentClassification.upsert({
        where: { targetType_targetId_source: { targetType: input.targetType, targetId: input.targetId, source: 'rules' } },
        create: {
          targetType: input.targetType,
          targetId: input.targetId,
          source: 'rules',
          status: 'failed',
          userCategory: input.userCategory?.trim() || null,
          safetyCategory: 'unknown',
          safetySeverity: 'low',
          childSafe: false,
          suggestedAction: 'review',
          reason,
        },
        update: {
          status: 'failed',
          userCategory: input.userCategory?.trim() || null,
          safetyCategory: 'unknown',
          safetySeverity: 'low',
          childSafe: false,
          suggestedAction: 'review',
          reason,
        },
      });
    } catch (storeError) {
      console.warn('Content classification failed and could not be stored', storeError);
      return null;
    }
  }
}
