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
  const items: ReactNode[] = [];

  trades.forEach((trade, index) => {
    items.push(<TradeStackDeck key={`trade-${trade.id}`} trade={trade} />);

    const afterTrade = renderAfterTrade?.(index, trades.length);
    if (afterTrade) {
      items.push(<Fragment key={`after-${trade.id}-${index}`}>{afterTrade}</Fragment>);
    }
  });

  return (
    <div className="trade-deck-grid" aria-label={t('trade.filters.controls')}>
      {items}
    </div>
  );
}
