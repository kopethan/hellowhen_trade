import { notFound } from 'next/navigation';
import { formatCredits } from '@zizilia/shared';
import { mockTrades } from '../../../lib/mockData';

export default async function TradeDetailPage({ params }: { params: Promise<{ tradeId: string }> }) {
  const { tradeId } = await params;
  const trade = mockTrades.find((item) => item.id === tradeId);
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
