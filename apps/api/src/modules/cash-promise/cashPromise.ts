import { CASH_PROMISE_ACKNOWLEDGEMENT_TEXT, type CashPromiseInput } from '@hellowhen/contracts';
import { env } from '../../config/env.js';

export function cashPromiseDisabledPayload() {
  return {
    error: 'cash_promise_disabled',
    message: 'Cash Promise is hidden and disabled. Hellowhen does not process, hold, protect, refund, or guarantee outside-app cash.',
  };
}

export function isCashPromiseConfiguredEnabled() {
  return env.cashPromiseEnabled && env.cashPromiseVisible && env.moneyFeaturesVisible;
}

export function validateCashPromiseInput(
  cashPromise: CashPromiseInput | null | undefined,
  provided = Boolean(cashPromise),
  options: { allowTradeCreate?: boolean; allowProposal?: boolean } = {},
) {
  if (!provided) return null;
  if (!cashPromise) {
    return {
      ok: false as const,
      statusCode: 501,
      body: {
        error: 'cash_promise_foundation_only',
        message: 'Cash Promise removal/update is reserved for the dedicated Cash Promise flow.',
      },
    };
  }
  if (!isCashPromiseConfiguredEnabled()) {
    return { ok: false as const, statusCode: 403, body: cashPromiseDisabledPayload() };
  }
  if (cashPromise.amountCents > env.cashPromiseMaxAmountCents) {
    return {
      ok: false as const,
      statusCode: 409,
      body: {
        error: 'cash_promise_amount_limit',
        message: 'Cash Promise amount is above the configured safety limit.',
        maxAmountCents: env.cashPromiseMaxAmountCents,
      },
    };
  }

  if (options.allowTradeCreate || options.allowProposal) {
    return {
      ok: true as const,
      cashPromise: {
        ...cashPromise,
        currency: cashPromise.currency.trim().toLowerCase(),
        note: cashPromise.note?.trim() || null,
        acknowledgementText: cashPromise.acknowledgementText?.trim() || CASH_PROMISE_ACKNOWLEDGEMENT_TEXT,
      },
    };
  }

  return {
    ok: false as const,
    statusCode: 501,
    body: {
      error: 'cash_promise_foundation_only',
      message: 'Cash Promise foundation is present but this flow is not enabled yet.',
      acknowledgementText: cashPromise.acknowledgementText?.trim() || CASH_PROMISE_ACKNOWLEDGEMENT_TEXT,
    },
  };
}
