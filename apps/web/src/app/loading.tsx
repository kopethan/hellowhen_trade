import { MobilePage } from '../components/MobilePage';

export default function AppLoading() {
  return (
    <MobilePage>
      <section className="mobile-card mobile-card--soft">
        <img className="app-loading-logo" src="/favicon.svg" alt="" aria-hidden="true" />
        <span className="semantic-badge info">Loading</span>
        <h2>Loading Hellowhen...</h2>
        <p>Please wait while we connect to the beta server.</p>
      </section>
    </MobilePage>
  );
}
