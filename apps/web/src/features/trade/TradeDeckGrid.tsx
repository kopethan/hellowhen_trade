import type { TradeDto } from '@hellowhen/contracts';
import { TradeStackDeck } from './TradeStackDeck';

export function TradeDeckGrid({ trades }: { trades: TradeDto[] }) {
  return (
    <div className="trade-deck-grid" aria-label="Trade decks">
      {trades.map((trade) => (
        <TradeStackDeck key={trade.id} trade={trade} />
      ))}
    </div>
  );
}
