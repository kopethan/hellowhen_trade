import { getLocalizedApiErrorMessage, type ErrorMessageTranslator } from '../../lib/errors';

const TRADE_CREATE_ERROR_KEY_BY_CODE: Readonly<Record<string, string>> = {
  launch_limit_exceeded: 'trade.create.apiErrors.launchLimitExceeded',
  invalid_need: 'trade.create.apiErrors.invalidNeed',
  invalid_offer: 'trade.create.apiErrors.invalidOffer',
  need_not_available: 'trade.create.apiErrors.needNotAvailable',
  offer_not_available: 'trade.create.apiErrors.offerNotAvailable',
  duplicate_trade_pair: 'trade.create.apiErrors.duplicateTradePair',
  duplicate_open_need: 'trade.create.apiErrors.duplicateOpenNeed',
  duplicate_open_offer: 'trade.create.apiErrors.duplicateOpenOffer',
  account_restricted: 'common.messages.accountRestrictedBody',
};

export function getTradeCreateApiErrorMessage(error: unknown, t: ErrorMessageTranslator) {
  return getLocalizedApiErrorMessage(error, t, {
    errorKeyByCode: TRADE_CREATE_ERROR_KEY_BY_CODE,
    fallbackKey: 'trade.create.apiErrors.generic',
  });
}
