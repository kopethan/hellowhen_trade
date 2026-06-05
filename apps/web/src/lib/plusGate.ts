import {
  evaluatePlusGate,
  normalizePlusAccessState,
  type PlusAccessState,
  type PlusGateState,
} from '@hellowhen/shared';
import type { PlusSubscriptionSnapshotResponse } from '@hellowhen/contracts';
import { betaFeatures } from './betaFeatures';

export type WebPlusGateInput = Partial<PlusAccessState> | PlusSubscriptionSnapshotResponse | null | undefined;

function isPlusSubscriptionSnapshot(value: WebPlusGateInput): value is PlusSubscriptionSnapshotResponse {
  return Boolean(value && typeof value === 'object' && 'state' in value && 'access' in value && 'price' in value);
}

export function resolveWebPlusAccessState(input?: WebPlusGateInput): PlusAccessState {
  if (isPlusSubscriptionSnapshot(input)) return normalizePlusAccessState(input.state);
  return normalizePlusAccessState(input);
}

export function getWebPlusGate(input?: WebPlusGateInput): PlusGateState {
  return evaluatePlusGate(betaFeatures.plusSubscriptionFeatures, resolveWebPlusAccessState(input));
}

export function hasWebPlusAccess(input?: WebPlusGateInput): boolean {
  return getWebPlusGate(input).hasPlusAccess;
}

export function shouldShowWebPlusSurface(input?: WebPlusGateInput): boolean {
  return getWebPlusGate(input).canSeePlusSurfaces;
}

function formatPrice(cents: number, currency: string) {
  const normalizedCurrency = currency.toLowerCase() || 'eur';
  const locale = normalizedCurrency === 'eur' ? 'fr-FR' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: normalizedCurrency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${normalizedCurrency.toUpperCase()}`;
  }
}

export function formatWebPlusMonthlyPrice(gate = getWebPlusGate()) {
  return formatPrice(gate.price.monthlyCents, gate.price.monthlyCurrency);
}

export function formatWebPlusYearlyPrice(gate = getWebPlusGate()) {
  return formatPrice(gate.price.yearlyCents, gate.price.yearlyCurrency);
}
