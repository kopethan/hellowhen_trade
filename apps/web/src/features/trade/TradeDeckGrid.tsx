import { Fragment, type ReactNode } from 'react';
import type { TradeDto } from '@hellowhen/contracts';
import { TradeStackDeck } from './TradeStackDeck';
import { useWebTranslation } from '../../providers/WebI18nProvider';

type TradeDeckGridProps = {
  trades: TradeDto[];
  renderAfterTrade?: (index: number, tradeCount: number) => ReactNode;
};

export function TradeDeckGrid({ trades, renderAfterTrade }: TradeDeckGridProps) {
  const { t } = useWebTranslation();
  return (
    <div className="trade-deck-grid" aria-label={t('trade.filters.controls')}>
      {trades.map((trade, index) => (
        <Fragment key={trade.id}>
          <TradeStackDeck trade={trade} />
          {renderAfterTrade?.(index, trades.length)}
        </Fragment>
      ))}
    </div>
  );
}
