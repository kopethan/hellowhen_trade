import type { SupportedLanguage } from './languages';

export const localeForLanguage: Record<SupportedLanguage, string> = {
  en: 'en-US',
  fr: 'fr-FR',
};

const DEFAULT_TIME_ZONE = 'UTC';

function toValidDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getLocaleForLanguage(language: SupportedLanguage) {
  return localeForLanguage[language] ?? localeForLanguage.en;
}

export function formatLocalizedDate(value: string | null | undefined, language: SupportedLanguage, fallback = '—') {
  const date = toValidDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: DEFAULT_TIME_ZONE,
    }).format(date);
  } catch {
    return value ?? fallback;
  }
}

export function formatLocalizedShortDate(value: string | null | undefined, language: SupportedLanguage, fallback = '—') {
  const date = toValidDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
      month: 'short',
      day: 'numeric',
      timeZone: DEFAULT_TIME_ZONE,
    }).format(date);
  } catch {
    return value ?? fallback;
  }
}

export function formatLocalizedDateTime(value: string | null | undefined, language: SupportedLanguage, fallback = '—') {
  const date = toValidDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: DEFAULT_TIME_ZONE,
    }).format(date);
  } catch {
    return value ?? fallback;
  }
}

export function formatLocalizedMoney(cents = 0, currency = 'eur', language: SupportedLanguage = 'en') {
  try {
    return new Intl.NumberFormat(getLocaleForLanguage(language), {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
