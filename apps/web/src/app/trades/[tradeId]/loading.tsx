export default function TradeDetailLoading() {
  return (
    <article className="trade-detail-page trade-detail-page--social trade-detail-page--loading" aria-busy="true">
      <header className="trade-detail-toolbar trade-detail-toolbar--loading" aria-label="Loading trade">
        <span className="trade-detail-back-link trade-detail-back-link--loading" aria-hidden="true">←</span>
        <span className="trade-detail-icon-button trade-detail-icon-button--loading" aria-hidden="true" />
      </header>
      <section className="trade-hero-section trade-detail-loading-hero">
        <span className="semantic-badge instruction">Loading</span>
        <h2>Opening trade…</h2>
        <div className="trade-detail-skeleton-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
      <section className="trade-social-section trade-detail-skeleton-section" aria-hidden="true">
        <span />
        <span />
        <span />
      </section>
      <section className="trade-social-section trade-detail-skeleton-section" aria-hidden="true">
        <span />
        <span />
        <span />
      </section>
      <section className="trade-social-section trade-detail-skeleton-section" aria-hidden="true">
        <span />
        <span />
      </section>
    </article>
  );
}
