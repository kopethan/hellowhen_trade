import Link from 'next/link';
import type { TradeDto } from '@hellowhen/contracts';
import { formatCredits, truncateText } from '@hellowhen/shared';

export function TradeCard({ trade }: { trade: TradeDto }) {
  return (
    <article className="card">
      <span className="badge">{trade.status}</span>
      <h2>{trade.title}</h2>
      <p>{truncateText(trade.description, 160)}</p>
      <p className="meta">{formatCredits(trade.creditAmount)}</p>
      <Link className="button" href={`/trades/${trade.id}`}>Open trade</Link>
    </article>
  );
}
