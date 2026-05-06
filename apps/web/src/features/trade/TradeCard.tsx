import Link from 'next/link';
import type { TradeDto } from '@zizilia/contracts';
import { formatCredits, truncateText } from '@zizilia/shared';

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
