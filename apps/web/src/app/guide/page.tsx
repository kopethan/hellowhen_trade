import Link from 'next/link';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { publicPageMetadata } from '../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Hellowhen - Guides',
  description: 'Replay the App, Plans, or Trade guides anytime.',
  pathname: '/guide',
});

type GuideCard = {
  title: string;
  body: string;
  badge: string;
  action: string;
  icon: WebIconName;
  href: string;
};

const guideCards: GuideCard[] = [
  {
    title: 'App guide',
    body: 'Replay the global app guide for navigation, Me, public feeds, and safety basics.',
    badge: 'App',
    action: 'Replay app guide',
    icon: 'help',
    href: '/onboarding-guide?guide=global&replay=1&next=/guide',
  },
  {
    title: 'Plans guide',
    body: 'Learn how plans, places, joining, creating, and safety work.',
    badge: 'Plans',
    action: 'Open Plans guide',
    icon: 'plan',
    href: '/onboarding-guide?guide=plans&replay=1&next=/plans',
  },
  {
    title: 'Trade guide',
    body: 'Learn trade cards, needs/offers, proposals, and safe agreements.',
    badge: 'Trade',
    action: 'Open Trade guide',
    icon: 'trade',
    href: '/onboarding-guide?guide=trade&replay=1&next=/trades',
  },
];

export default function GuideHubPage() {
  return (
    <main className="guide-hub-page" aria-labelledby="guide-hub-title">
      <section className="guide-hub-hero">
        <span className="semantic-badge instruction">Guide library</span>
        <h1 id="guide-hub-title">Guides</h1>
        <p>Replay the App, Plans, or Trade guides anytime. Public feeds stay open, and guides are always available here.</p>
      </section>

      <section className="guide-hub-grid" aria-label="Guide choices">
        {guideCards.map((card) => (
          <Link key={card.title} href={card.href} className="guide-hub-card">
            <span className="guide-hub-card__icon" aria-hidden="true">
              <WebIcon name={card.icon} size={24} decorative />
            </span>
            <span className="guide-hub-card__copy">
              <span className="semantic-badge instruction">{card.badge}</span>
              <strong>{card.title}</strong>
              <span>{card.body}</span>
              <span className="guide-hub-card__action">{card.action}</span>
            </span>
            <WebIcon name="arrow-right" size={18} decorative />
          </Link>
        ))}
      </section>
    </main>
  );
}
