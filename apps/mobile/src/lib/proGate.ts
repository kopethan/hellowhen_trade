import {
  evaluateProGate,
  normalizeProAccessState,
  type ProAccessState,
  type ProGateState,
  type ProSubscriptionSnapshot,
} from '@hellowhen/shared';
import { betaFeatures } from './betaFeatures';

export type MobileProGateInput = Partial<ProAccessState> | ProSubscriptionSnapshot | null | undefined;

function isSubscriptionSnapshot(value: MobileProGateInput): value is ProSubscriptionSnapshot {
  return Boolean(value && typeof value === 'object' && 'state' in value && 'access' in value);
}

export function resolveMobileProAccessState(input?: MobileProGateInput): ProAccessState {
  if (isSubscriptionSnapshot(input)) return normalizeProAccessState(input.state);
  return normalizeProAccessState(input);
}

export function getMobileProGate(input?: MobileProGateInput): ProGateState {
  return evaluateProGate(betaFeatures.proSubscriptionFeatures, resolveMobileProAccessState(input));
}

export function hasMobileProAccess(input?: MobileProGateInput): boolean {
  return getMobileProGate(input).hasProAccess;
}

export function shouldShowMobileProSurface(input?: MobileProGateInput): boolean {
  const gate = getMobileProGate(input);
  return gate.canSeeProSurfaces;
}

export function formatMobileProMonthlyPrice(gate = getMobileProGate()) {
  const locale = gate.price.currency.toLowerCase() === 'eur' ? 'fr-FR' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: gate.price.currency.toUpperCase() }).format(gate.price.monthlyCents / 100);
  } catch {
    return `${(gate.price.monthlyCents / 100).toFixed(2)} ${gate.price.currency.toUpperCase()}`;
  }
}
