import { TradeFeedClient } from '../../features/trade/TradeFeedClient';
import { publicPageMetadata } from '../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Hellowhen Trade — Discover skill and service exchanges',
  description: 'Discover Hellowhen Trade posts from adults exchanging skills, services, small help, creative work, needs, and offers without money.',
  pathname: '/trades',
});

export default function TradeFeedPage() {
  return <TradeFeedClient showHomeIntro />;
}
