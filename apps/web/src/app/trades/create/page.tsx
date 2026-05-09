import { MobilePage, PageIntro } from '../../../components/MobilePage';

export default function CreateTradePage() {
  return (
    <MobilePage>
      <PageIntro
        eyebrow="Create"
        title="Choose what you need and what you offer"
        body="The full web create flow will mirror mobile: pick a saved Need or wallet money, then pick a saved Offer or wallet money."
      />
      <div className="mobile-card mobile-card--soft">
        <span className="semantic-badge need">I need</span>
        <h3>Saved Need or wallet money</h3>
        <p>Money stays inside the Need side when you need money. It is not a third trade field.</p>
      </div>
      <div className="mobile-card mobile-card--soft">
        <span className="semantic-badge offer">I offer</span>
        <h3>Saved Offer or wallet money</h3>
        <p>Money stays inside the Offer side when you offer money. Money + money trades stay blocked later.</p>
      </div>
      <button type="button" disabled>Create flow coming next</button>
    </MobilePage>
  );
}
