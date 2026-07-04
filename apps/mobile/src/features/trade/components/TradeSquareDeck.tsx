import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ContinuousSquareStackDeck } from '../deck';
import type { TradeDeckItem } from '../types';
import { buildTradeSquareDeckCards, renderTradeSquareDeckCard, type TradeSquareDeckCard } from './TradeSquareDeckCards';

const MOBILE_TRADE_DECK_AVAILABLE_HEIGHT = 404;
const MOBILE_TRADE_DECK_MAX_CARD_SIZE = 348;

type TradeSquareDeckProps = {
  trade: TradeDeckItem;
  index?: number;
  total?: number;
  onOpen?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function TradeSquareDeck({ trade, index = 0, total = 1, onOpen, style }: TradeSquareDeckProps) {
  const cards = useMemo(() => buildTradeSquareDeckCards(trade, index, total), [index, total, trade]);
  const handleOpen = onOpen ?? (() => {});

  return (
    <View style={[styles.container, style]}>
      <ContinuousSquareStackDeck<TradeSquareDeckCard>
        cards={cards}
        renderCard={({ card, index: cardIndex, total: cardTotal }) => renderTradeSquareDeckCard(card, cardIndex, cardTotal, handleOpen)}
        renderWindow="visible"
        showDebugBadge={false}
        depthEffect="motionOnly"
        availableHeight={MOBILE_TRADE_DECK_AVAILABLE_HEIGHT}
        maxCardSize={MOBILE_TRADE_DECK_MAX_CARD_SIZE}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 2,
    elevation: 2,
  },
});
