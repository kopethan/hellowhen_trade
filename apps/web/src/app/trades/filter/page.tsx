import { TradeFilterClient } from '../../../features/trade/TradeFilterClient';
import { publicPageMetadata } from '../../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Trade filters — Hellowhen Trade',
  description: 'Search and filter public Hellowhen Trade cards by mode, post type, images, and search words.',
  pathname: '/trades/filter',
});

export default function TradeFilterPage() {
  return <TradeFilterClient />;
}
