import { buildGlobalMoneySafetyConfig } from './moneySafety.js';
import { getActiveMoneyProvider } from './providers/moneyProviderRegistry.js';
import type { CreateTradeHoldInput, ProviderTradeMoneyResult, RefundTradeHoldInput, ReleaseTradeHoldInput } from './providers/moneyProvider.types.js';

function skip(message: string): ProviderTradeMoneyResult {
  return { provider: getActiveMoneyProvider().provider, status: 'skipped', sandboxOnly: true, message };
}

export function providerTradeMoneyMirroringEnabled() {
  const config = buildGlobalMoneySafetyConfig();
  return Boolean(config.demoMoneyEnabled && config.providerTradeMoneyEnabled && config.moneyProvider !== 'none');
}

async function safelyMirror<T>(operation: () => Promise<T | null>, fallbackMessage: string): Promise<T | ProviderTradeMoneyResult | null> {
  if (!providerTradeMoneyMirroringEnabled()) return skip(fallbackMessage);
  try {
    return await operation();
  } catch (error) {
    const provider = getActiveMoneyProvider();
    const message = error instanceof Error ? error.message : 'Provider trade-money mirror failed.';
    console.warn(`[money-provider:${provider.provider}] ${message}`);
    return { provider: provider.provider, status: 'failed', sandboxOnly: provider.sandboxOnly, message };
  }
}

export function mirrorProviderTradeHold(input: CreateTradeHoldInput) {
  return safelyMirror(() => getActiveMoneyProvider().createTradeHold(input), 'Provider trade-money mirroring is disabled; only Hellowhen ledger hold was recorded.');
}

export function mirrorProviderTradeRelease(input: ReleaseTradeHoldInput) {
  return safelyMirror(() => getActiveMoneyProvider().releaseTradeHold(input), 'Provider trade-money release is disabled; only Hellowhen ledger release was recorded.');
}

export function mirrorProviderTradeRefund(input: RefundTradeHoldInput) {
  return safelyMirror(() => getActiveMoneyProvider().refundTradeHold(input), 'Provider trade-money refund is disabled; only Hellowhen ledger refund was recorded.');
}
