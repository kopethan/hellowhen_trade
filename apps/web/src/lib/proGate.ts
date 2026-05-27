import {
  evaluateProGate,
  normalizeProAccessState,
  type ProAccessState,
  type ProGateState,
  type ProSubscriptionSnapshot,
} from '@hellowhen/shared';
import { betaFeatures } from './betaFeatures';

export type WebProGateInput = Partial<ProAccessState> | ProSubscriptionSnapshot | null | undefined;

function isSubscriptionSnapshot(value: WebProGateInput): value is ProSubscriptionSnapshot {
  return Boolean(value && typeof value === 'object' && 'state' in value && 'access' in value);
}

export function resolveWebProAccessState(input?: WebProGateInput): ProAccessState {
  if (isSubscriptionSnapshot(input)) return normalizeProAccessState(input.state);
  return normalizeProAccessState(input);
}

export function getWebProGate(input?: WebProGateInput): ProGateState {
  return evaluateProGate(betaFeatures.proSubscriptionFeatures, resolveWebProAccessState(input));
}

export function hasWebProAccess(input?: WebProGateInput): boolean {
  return getWebProGate(input).hasProAccess;
}

export function shouldShowWebProSurface(input?: WebProGateInput): boolean {
  const gate = getWebProGate(input);
  return gate.canSeeProSurfaces;
}

export function formatWebProMonthlyPrice(gate = getWebProGate()) {
  const locale = gate.price.currency.toLowerCase() === 'eur' ? 'fr-FR' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: gate.price.currency.toUpperCase() }).format(gate.price.monthlyCents / 100);
  } catch {
    return `${(gate.price.monthlyCents / 100).toFixed(2)} ${gate.price.currency.toUpperCase()}`;
  }
}
