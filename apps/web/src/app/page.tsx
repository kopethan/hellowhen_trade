import { PublicLandingPage } from '../features/landing/PublicLandingPage';
import { publicPageMetadata } from '../lib/seo';

export const metadata = publicPageMetadata({ pathname: '/' });

export default function HomePage() {
  return <PublicLandingPage />;
}
