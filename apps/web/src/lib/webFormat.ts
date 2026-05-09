const WEB_LOCALE = 'en-US';
const WEB_TIME_ZONE = 'UTC';

function toValidDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatWebDate(value?: string | null, fallback = 'No date set') {
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

export function formatWebShortDate(value?: string | null, fallback = 'No date set') {
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

export function formatWebDateTime(value?: string | null, fallback = '—') {
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

export function formatWebMoney(cents = 0, currency = 'eur') {
  try {
    return new Intl.NumberFormat(WEB_LOCALE, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
