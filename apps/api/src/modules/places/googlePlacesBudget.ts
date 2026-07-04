import { env } from '../../config/env.js';

type GooglePlacesUsageKind = 'autocomplete' | 'details';

type GooglePlacesBudgetWindow = {
  key: string;
  autocomplete: number;
  details: number;
};

export type GooglePlacesBudgetSnapshot = {
  enabled: boolean;
  monthlySoftLimit: number;
  monthlyHardLimit: number;
  monthlyAutocompleteIssued: number;
  monthlyDetailsIssued: number;
  monthlyIssued: number;
  state: 'available' | 'soft_limited' | 'hard_limited' | 'disabled';
};

export type GooglePlacesBudgetReservation =
  | { ok: true; softLimited: boolean; snapshot: GooglePlacesBudgetSnapshot }
  | { ok: false; reason: 'disabled' | 'hard_limit'; snapshot: GooglePlacesBudgetSnapshot; message: string };

let monthlyBudgetWindow: GooglePlacesBudgetWindow = { key: '', autocomplete: 0, details: 0 };

function utcMonthKey(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

function refreshBudgetWindow(now = new Date()) {
  const monthKey = utcMonthKey(now);
  if (monthlyBudgetWindow.key !== monthKey) monthlyBudgetWindow = { key: monthKey, autocomplete: 0, details: 0 };
}

function monthlyIssued() {
  return monthlyBudgetWindow.autocomplete + monthlyBudgetWindow.details;
}

export function getGooglePlacesBudgetSnapshot(now = new Date()): GooglePlacesBudgetSnapshot {
  refreshBudgetWindow(now);
  const issued = monthlyIssued();
  const monthlySoftLimit = env.googlePlacesMonthlySoftLimit;
  const monthlyHardLimit = env.googlePlacesMonthlyHardLimit;
  const disabled = monthlyHardLimit <= 0;
  const hardLimited = !disabled && issued >= monthlyHardLimit;
  const softLimited = !disabled && monthlySoftLimit > 0 && issued >= monthlySoftLimit;

  return {
    enabled: env.googlePlacesEnabled,
    monthlySoftLimit,
    monthlyHardLimit,
    monthlyAutocompleteIssued: monthlyBudgetWindow.autocomplete,
    monthlyDetailsIssued: monthlyBudgetWindow.details,
    monthlyIssued: issued,
    state: !env.googlePlacesEnabled || disabled ? 'disabled' : hardLimited ? 'hard_limited' : softLimited ? 'soft_limited' : 'available',
  };
}

export function reserveGooglePlacesBudget(kind: GooglePlacesUsageKind, estimate = 1): GooglePlacesBudgetReservation {
  refreshBudgetWindow();
  const requestCount = Math.max(1, Math.trunc(estimate));
  const monthlyHardLimit = env.googlePlacesMonthlyHardLimit;

  if (monthlyHardLimit <= 0) {
    return {
      ok: false,
      reason: 'disabled',
      snapshot: getGooglePlacesBudgetSnapshot(),
      message: 'Google place search is paused by the monthly usage guard.',
    };
  }

  if (monthlyIssued() + requestCount > monthlyHardLimit) {
    return {
      ok: false,
      reason: 'hard_limit',
      snapshot: getGooglePlacesBudgetSnapshot(),
      message: 'Offline address search is paused for this month. You can create an Online place with a valid link, or try offline addresses again after the quota resets.',
    };
  }

  if (kind === 'autocomplete') monthlyBudgetWindow.autocomplete += requestCount;
  else monthlyBudgetWindow.details += requestCount;

  const snapshot = getGooglePlacesBudgetSnapshot();
  return { ok: true, softLimited: snapshot.state === 'soft_limited', snapshot };
}
