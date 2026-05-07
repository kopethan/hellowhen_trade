import { notFound } from 'next/navigation';
import { formatCredits } from '@hellowhen/shared';
import { mockTrades } from '../../../lib/mockData';

export default function TradeDetailPage({ params }: { params: { tradeId: string } }) {
  const trade = mockTrades.find((item) => item.id === params.tradeId);
  if (!trade) notFound();

  return (
    <article className="card">
      <span className="badge">Public detail</span>
      <h1>{trade.title}</h1>
      <p>{trade.description}</p>
      <p className="meta">Status: {trade.status}</p>
      <p className="meta">Credits: {formatCredits(trade.creditAmount)}</p>
    </article>
  );
}
