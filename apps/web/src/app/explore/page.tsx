import { ExploreLandingClient } from '../../features/explore/ExploreLandingClient';
import { publicPageMetadata } from '../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Explore — Hellowhen Trade',
  description: 'Explore a mixed Hellowhen discovery feed of Trade, Plan, Need, Offer, and Place ideas you can adapt into your own activity.',
  pathname: '/explore',
});

export default function ExplorePage() {
  return <ExploreLandingClient />;
}
