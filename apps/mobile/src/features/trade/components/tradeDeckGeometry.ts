import { getSquareStackLayoutMetrics } from '../deck/squareStackDeck.model';

export const MOBILE_TRADE_DECK_AVAILABLE_HEIGHT = 404;
export const MOBILE_TRADE_DECK_MAX_CARD_SIZE = 348;
export const MOBILE_TRADE_DECK_VIEWPORT_HORIZONTAL_INSET = 36;
export const MOBILE_TRADE_DECK_COMPACT_CARD_SIZE = 318;
export const MOBILE_DECK_FEED_GAP = 22;

export function getMobileTradeDeckCardSize(viewportWidth: number) {
  return getSquareStackLayoutMetrics({
    availableWidth: Math.max(0, viewportWidth - MOBILE_TRADE_DECK_VIEWPORT_HORIZONTAL_INSET),
    availableHeight: MOBILE_TRADE_DECK_AVAILABLE_HEIGHT,
    maxCardSize: MOBILE_TRADE_DECK_MAX_CARD_SIZE,
  }).cardSize;
}

export function shouldUseCompactTradeDeckContent(viewportWidth: number) {
  return getMobileTradeDeckCardSize(viewportWidth) <= MOBILE_TRADE_DECK_COMPACT_CARD_SIZE;
}
