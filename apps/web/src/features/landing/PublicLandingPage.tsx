import Link from 'next/link';
import { WebIcon } from '../../components/WebIcon';

const exchangeExamples = [
  {
    title: 'Learn a skill',
    body: 'Need beginner football help, French practice, portfolio feedback, or a website review.',
  },
  {
    title: 'Offer what you can do',
    body: 'Offer photos, app testing, landing-page feedback, translation help, design, writing, or local help.',
  },
  {
    title: 'Trade without money',
    body: 'Start with service-for-service exchanges. Wallets, payouts, and paid trades stay off for the first beta.',
  },
];

const steps = [
  {
    label: '1',
    title: 'Create a Need',
    body: 'Describe what you need help with, choose a category, add images, and keep the original language clear.',
  },
  {
    label: '2',
    title: 'Create an Offer',
    body: 'Add something useful you can give back, from creative work to practical support or feedback.',
  },
  {
    label: '3',
    title: 'Publish a Trade',
    body: 'Connect a Need and an Offer, then receive private proposals from people who want to exchange.',
  },
];

const audiences = ['Freelancers', 'Creators', 'Students 18+', 'Small founders', 'Expats', 'Local communities'];

export function PublicLandingPage() {
  return (
    <main className="public-landing" aria-labelledby="public-landing-title">
      <section className="public-landing__hero">
        <nav className="public-landing__nav" aria-label="Hellowhen Trade">
          <Link href="/" className="public-landing__brand" aria-label="Hellowhen Trade home">
            <span className="public-landing__brand-mark" aria-hidden="true"><WebIcon name="trade" size={20} decorative /></span>
            <span>Hellowhen Trade</span>
          </Link>
          <div className="public-landing__nav-links">
            <Link href="/trades">Explore</Link>
            <Link href="/auth?next=/trades/create">Sign in</Link>
          </div>
        </nav>

        <div className="public-landing__hero-grid">
          <div className="public-landing__hero-copy">
            <span className="public-landing__eyebrow">18+ beta · service-for-service first</span>
            <h1 id="public-landing-title">Exchange skills, services, needs, and offers without money.</h1>
            <p>
              Hellowhen Trade helps adults create clear Needs and Offers, then turn them into simple exchanges.
              Ask for help, offer something useful back, and keep the conversation private when someone proposes a trade.
            </p>
            <div className="public-landing__actions" aria-label="Start using Hellowhen Trade">
              <Link href="/auth?next=/needs/new" className="button">Start with a Need</Link>
              <Link href="/auth?next=/offers/new" className="button secondary">Create an Offer</Link>
              <Link href="/trades" className="public-landing__text-link">Explore Trades</Link>
            </div>
          </div>

          <div className="public-landing__poster" aria-label="Example Hellowhen Trade card">
            <span className="public-landing__poster-badge">TRADE · OPEN</span>
            <div>
              <p>I need</p>
              <h2>Beginner football help</h2>
              <span>Sports / Outdoor · Local · This week</span>
            </div>
            <div className="public-landing__swap" aria-hidden="true">↔</div>
            <div>
              <p>I offer</p>
              <h2>App testing feedback</h2>
              <span>Development · Remote · 30 minutes</span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-landing__section public-landing__section--compact" aria-labelledby="public-landing-examples">
        <span className="public-landing__eyebrow">What you can exchange</span>
        <h2 id="public-landing-examples">Useful help, creative work, learning, and local support.</h2>
        <div className="public-landing__cards public-landing__cards--three">
          {exchangeExamples.map((item) => (
            <article className="public-landing__card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-landing__section public-landing__section--split" aria-labelledby="public-landing-how">
        <div>
          <span className="public-landing__eyebrow">How it works</span>
          <h2 id="public-landing-how">Needs and Offers stay reusable. Trades stay simple.</h2>
          <p>
            The important writing lives inside your Needs and Offers. A Trade simply connects them, so you do not need to rewrite
            titles and descriptions every time.
          </p>
        </div>
        <div className="public-landing__steps">
          {steps.map((step) => (
            <article className="public-landing__step" key={step.label}>
              <span>{step.label}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="public-landing__section public-landing__section--split public-landing__section--soft" aria-labelledby="public-landing-safety">
        <div>
          <span className="public-landing__eyebrow">First-launch safety</span>
          <h2 id="public-landing-safety">Built for a small, moderated beta.</h2>
          <p>
            Hellowhen Trade is for adults only. The first launch avoids real-money trades, wallets, and payouts so the community can
            test the exchange experience safely before payment features are considered.
          </p>
        </div>
        <ul className="public-landing__checklist" aria-label="Safety highlights">
          <li>Report profiles, trades, needs, and offers</li>
          <li>Admin moderation and support flows</li>
          <li>Private proposal conversations</li>
          <li>No real-money wallet or payout in first beta</li>
        </ul>
      </section>

      <section className="public-landing__section public-landing__section--compact" aria-labelledby="public-landing-audience">
        <span className="public-landing__eyebrow">Who it is for</span>
        <h2 id="public-landing-audience">People who can help each other move forward.</h2>
        <div className="public-landing__chips">
          {audiences.map((audience) => <span key={audience}>{audience}</span>)}
        </div>
      </section>

      <section className="public-landing__final" aria-labelledby="public-landing-final">
        <span className="public-landing__eyebrow">Version française</span>
        <h2 id="public-landing-final">Échangez des compétences, des services, des besoins et des offres.</h2>
        <p>
          Hellowhen Trade aide les adultes à créer des besoins et des offres clairs, puis à les transformer en échanges simples,
          sans argent pour la première bêta.
        </p>
        <div className="public-landing__actions public-landing__actions--centered">
          <Link href="/trades" className="button">Voir les Trades</Link>
          <Link href="/legal/safety" className="button secondary">Règles de sécurité</Link>
        </div>
      </section>
    </main>
  );
}
