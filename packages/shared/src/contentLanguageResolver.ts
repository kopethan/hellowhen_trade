export const contentLanguageCodes = ['en', 'fr', 'es'] as const;
export type ContentLanguageCode = typeof contentLanguageCodes[number];

export type LocalizedContentResolutionSource = 'exact' | 'preference' | 'default' | 'fallback' | 'machine';

export type LocalizedContentTranslationLike = {
  languageCode?: string | null;
  title?: string | null;
  description?: string | null;
  source?: 'creator' | 'machine' | string | null;
};

export type LocalizedContentFallbackFields = {
  title?: string | null;
  description?: string | null;
};

export type ResolveLocalizedContentInput = {
  viewerLanguage?: string | null;
  preferredLanguages?: readonly (string | null | undefined)[] | null;
  defaultLanguage?: string | null;
  translations?: readonly LocalizedContentTranslationLike[] | null;
  fallbackFields: LocalizedContentFallbackFields;
};

export type LocalizedContentOption = {
  languageCode: ContentLanguageCode;
  title: string;
  description: string;
  source: 'creator' | 'machine';
  isOriginal: boolean;
};

export type LocalizedContentResult = {
  title: string;
  description: string;
  languageCode: ContentLanguageCode;
  source: LocalizedContentResolutionSource;
  isTranslated: boolean;
  requestedLanguages: ContentLanguageCode[];
  availableLanguages: ContentLanguageCode[];
  options: LocalizedContentOption[];
};

type Candidate = {
  languageCode: ContentLanguageCode;
  title: string;
  description: string;
  source?: string | null;
  isOriginal: boolean;
};

export function normalizeContentLanguageCode(value?: string | null): ContentLanguageCode | null {
  const normalized = value?.trim().toLowerCase().replace('_', '-').split('-')[0];
  if (normalized === 'en' || normalized === 'fr' || normalized === 'es') return normalized;
  return null;
}

function cleanText(value?: string | null) {
  return value?.trim() ?? '';
}

function addUniqueLanguage(target: ContentLanguageCode[], value?: string | null) {
  const normalized = normalizeContentLanguageCode(value);
  if (normalized && !target.includes(normalized)) target.push(normalized);
}

export function normalizeContentLanguageOrder(input: {
  viewerLanguage?: string | null;
  preferredLanguages?: readonly (string | null | undefined)[] | null;
  defaultLanguage?: string | null;
}): ContentLanguageCode[] {
  const order: ContentLanguageCode[] = [];
  addUniqueLanguage(order, input.viewerLanguage);
  for (const language of input.preferredLanguages ?? []) addUniqueLanguage(order, language ?? null);
  addUniqueLanguage(order, input.defaultLanguage);
  if (!order.length) order.push('en');
  return order;
}

function candidateFromOriginal(defaultLanguage: ContentLanguageCode, fields: LocalizedContentFallbackFields): Candidate | null {
  const title = cleanText(fields.title);
  if (!title) return null;
  return {
    languageCode: defaultLanguage,
    title,
    description: cleanText(fields.description),
    isOriginal: true,
  };
}

function candidateFromTranslation(translation: LocalizedContentTranslationLike): Candidate | null {
  const languageCode = normalizeContentLanguageCode(translation.languageCode);
  const title = cleanText(translation.title);
  if (!languageCode || !title) return null;
  return {
    languageCode,
    title,
    description: cleanText(translation.description),
    source: translation.source,
    isOriginal: false,
  };
}

function resolutionSourceFor(candidate: Candidate, language: ContentLanguageCode, input: ResolveLocalizedContentInput, requestedLanguages: ContentLanguageCode[]): LocalizedContentResolutionSource {
  if (!candidate.isOriginal && candidate.source === 'machine') return 'machine';
  const viewerLanguage = normalizeContentLanguageCode(input.viewerLanguage);
  const defaultLanguage = normalizeContentLanguageCode(input.defaultLanguage) ?? 'en';
  if (viewerLanguage && language === viewerLanguage) return 'exact';
  if (requestedLanguages.includes(language) && language !== defaultLanguage) return 'preference';
  if (language === defaultLanguage) return 'default';
  return 'fallback';
}

function optionFromCandidate(candidate: Candidate): LocalizedContentOption {
  return {
    languageCode: candidate.languageCode,
    title: candidate.title,
    description: candidate.description,
    source: candidate.source === 'machine' ? 'machine' : 'creator',
    isOriginal: candidate.isOriginal,
  };
}

function resultForCandidate(candidate: Candidate, source: LocalizedContentResolutionSource, requestedLanguages: ContentLanguageCode[], availableLanguages: ContentLanguageCode[], defaultLanguage: ContentLanguageCode, options: LocalizedContentOption[]): LocalizedContentResult {
  return {
    title: candidate.title,
    description: candidate.description,
    languageCode: candidate.languageCode,
    source,
    isTranslated: candidate.languageCode !== defaultLanguage,
    requestedLanguages,
    availableLanguages,
    options,
  };
}

export function resolveLocalizedContent(input: ResolveLocalizedContentInput): LocalizedContentResult {
  const defaultLanguage = normalizeContentLanguageCode(input.defaultLanguage) ?? 'en';
  const requestedLanguages = normalizeContentLanguageOrder({
    viewerLanguage: input.viewerLanguage,
    preferredLanguages: input.preferredLanguages,
    defaultLanguage,
  });
  const byLanguage = new Map<ContentLanguageCode, Candidate>();
  const original = candidateFromOriginal(defaultLanguage, input.fallbackFields);
  if (original) byLanguage.set(defaultLanguage, original);

  for (const translation of input.translations ?? []) {
    const candidate = candidateFromTranslation(translation);
    if (!candidate || byLanguage.has(candidate.languageCode)) continue;
    byLanguage.set(candidate.languageCode, candidate);
  }

  const availableLanguages = [...byLanguage.keys()];
  const options = availableLanguages
    .map((language) => byLanguage.get(language))
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .map(optionFromCandidate);
  for (const language of requestedLanguages) {
    const candidate = byLanguage.get(language);
    if (!candidate) continue;
    return resultForCandidate(candidate, resolutionSourceFor(candidate, language, input, requestedLanguages), requestedLanguages, availableLanguages, defaultLanguage, options);
  }

  const fallback = byLanguage.get(defaultLanguage) ?? availableLanguages.map((language) => byLanguage.get(language)).find((candidate): candidate is Candidate => Boolean(candidate));
  if (fallback) {
    return resultForCandidate(fallback, fallback.languageCode === defaultLanguage ? 'default' : 'fallback', requestedLanguages, availableLanguages, defaultLanguage, options);
  }

  return {
    title: cleanText(input.fallbackFields.title),
    description: cleanText(input.fallbackFields.description),
    languageCode: defaultLanguage,
    source: 'fallback',
    isTranslated: false,
    requestedLanguages,
    availableLanguages: [],
    options: [],
  };
}
