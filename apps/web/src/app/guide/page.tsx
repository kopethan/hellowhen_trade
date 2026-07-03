import Link from 'next/link';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { publicPageMetadata } from '../../lib/seo';

export const metadata = publicPageMetadata({
  title: 'Hellowhen - Guide',
  description: 'Choose the App, Plans, or Trade guide.',
  pathname: '/guide',
});

type GuideCard = {
  title: string;
  body: string;
  badge: string;
  icon: WebIconName;
  href: string;
};

const guideCards: GuideCard[] = [
  {
    title: 'App guide',
    body: 'Learn how the App guide separates Trade, Plans, and Me.',
    badge: 'App',
    icon: 'help',
    href: '/onboarding-guide?guide=global&replay=1&next=/guide',
  },
  {
    title: 'Plans guide',
    body: 'See how Plans, Places, joining, creating, and safety work.',
    badge: 'Plans',
    icon: 'plan',
    href: '/onboarding-guide?guide=plans&replay=1&next=/plans',
  },
  {
    title: 'Trade guide',
    body: 'Understand Trade discovery, needs, offers, proposals, and safety.',
    badge: 'Trade',
    icon: 'trade',
    href: '/onboarding-guide?guide=trade&replay=1&next=/trades',
  },
];

export default function GuideHubPage() {
  return (
    <main className="guide-hub-page" aria-labelledby="guide-hub-title">
      <section className="guide-hub-hero">
        <span className="semantic-badge instruction">Guides</span>
        <h1 id="guide-hub-title">Choose a guide</h1>
        <p>Open the App guide for global navigation, or jump straight into Plans or Trade.</p>
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
            </span>
            <WebIcon name="arrow-right" size={18} decorative />
          </Link>
        ))}
      </section>
    </main>
  );
}
