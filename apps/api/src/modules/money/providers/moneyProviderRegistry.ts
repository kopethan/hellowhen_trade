import { env } from '../../../config/env.js';
import { airwallexMoneyProvider } from './airwallexMoneyProvider.js';
import type { MoneyProviderAdapter } from './moneyProvider.types.js';
import { noneMoneyProvider } from './noneMoneyProvider.js';
import { stripeMoneyProvider } from './stripeMoneyProvider.js';

const providers: Record<string, MoneyProviderAdapter> = {
  none: noneMoneyProvider,
  stripe: stripeMoneyProvider,
  airwallex: airwallexMoneyProvider,
};

export function getMoneyProvider(provider: string | undefined): MoneyProviderAdapter {
  return providers[provider ?? 'none'] ?? noneMoneyProvider;
}

export function getActiveMoneyProvider(): MoneyProviderAdapter {
  return getMoneyProvider(env.moneyProvider);
}

export function buildMoneyProviderStatus() {
  return getActiveMoneyProvider().getPublicStatus();
}
