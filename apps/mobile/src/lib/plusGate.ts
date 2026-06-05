import {
  evaluatePlusGate,
  normalizePlusAccessState,
  type PlusAccessState,
  type PlusGateState,
} from '@hellowhen/shared';
import type { PlusSubscriptionSnapshotResponse } from '@hellowhen/contracts';
import { betaFeatures } from './betaFeatures';

export type MobilePlusGateInput = Partial<PlusAccessState> | PlusSubscriptionSnapshotResponse | null | undefined;

function isPlusSubscriptionSnapshot(value: MobilePlusGateInput): value is PlusSubscriptionSnapshotResponse {
  return Boolean(value && typeof value === 'object' && 'state' in value && 'access' in value && 'price' in value);
}

export function resolveMobilePlusAccessState(input?: MobilePlusGateInput): PlusAccessState {
  if (isPlusSubscriptionSnapshot(input)) return normalizePlusAccessState(input.state);
  return normalizePlusAccessState(input);
}

export function getMobilePlusGate(input?: MobilePlusGateInput): PlusGateState {
  return evaluatePlusGate(betaFeatures.plusSubscriptionFeatures, resolveMobilePlusAccessState(input));
}

export function hasMobilePlusAccess(input?: MobilePlusGateInput): boolean {
  return getMobilePlusGate(input).hasPlusAccess;
}

export function shouldShowMobilePlusSurface(input?: MobilePlusGateInput): boolean {
  return getMobilePlusGate(input).canSeePlusSurfaces;
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

export function formatMobilePlusMonthlyPrice(gate = getMobilePlusGate()) {
  return formatPrice(gate.price.monthlyCents, gate.price.monthlyCurrency);
}

export function formatMobilePlusYearlyPrice(gate = getMobilePlusGate()) {
  return formatPrice(gate.price.yearlyCents, gate.price.yearlyCurrency);
}
