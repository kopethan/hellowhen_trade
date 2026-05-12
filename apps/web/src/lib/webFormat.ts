import { formatLocalizedDate, formatLocalizedDateTime, formatLocalizedMoney, formatLocalizedShortDate, getLocaleForLanguage, type SupportedLanguage } from '@hellowhen/i18n';

const WEB_LOCALE = 'en-US';
const WEB_TIME_ZONE = 'UTC';

type LocaleInput = SupportedLanguage | string | undefined | null;

function normalizeLocale(locale?: LocaleInput) {
  if (locale === 'en' || locale === 'fr') return getLocaleForLanguage(locale);
  return locale || WEB_LOCALE;
}

function toValidDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatWebDate(value?: string | null, fallback = 'No date set', language?: SupportedLanguage) {
  if (language) return formatLocalizedDate(value, language, fallback);
  const date = toValidDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat(WEB_LOCALE, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: WEB_TIME_ZONE,
    }).format(date);
  } catch {
    return value ?? fallback;
  }
}

export function formatWebShortDate(value?: string | null, fallback = 'No date set', language?: SupportedLanguage) {
  if (language) return formatLocalizedShortDate(value, language, fallback);
  const date = toValidDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat(WEB_LOCALE, {
      month: 'short',
      day: 'numeric',
      timeZone: WEB_TIME_ZONE,
    }).format(date);
  } catch {
    return value ?? fallback;
  }
}

export function formatWebDateTime(value?: string | null, fallback = '—', language?: SupportedLanguage) {
  if (language) return formatLocalizedDateTime(value, language, fallback);
  const date = toValidDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat(WEB_LOCALE, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: WEB_TIME_ZONE,
    }).format(date);
  } catch {
    return value ?? fallback;
  }
}

export function formatWebMoney(cents = 0, currency = 'eur', language?: SupportedLanguage) {
  if (language) return formatLocalizedMoney(cents, currency, language);
  try {
    return new Intl.NumberFormat(normalizeLocale(language), {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
