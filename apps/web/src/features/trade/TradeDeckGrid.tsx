import type { TradeDto } from '@hellowhen/contracts';
import { TradeStackDeck } from './TradeStackDeck';
import { useWebTranslation } from '../../providers/WebI18nProvider';

export function TradeDeckGrid({ trades }: { trades: TradeDto[] }) {
  const { t } = useWebTranslation();
  return (
    <div className="trade-deck-grid" aria-label={t('trade.filters.controls')}>
      {trades.map((trade) => (
        <TradeStackDeck key={trade.id} trade={trade} />
      ))}
    </div>
  );
}
