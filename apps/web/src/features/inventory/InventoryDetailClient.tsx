'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { formatInventoryDate, getInventoryMetadata, getInventoryTags, kindLabel, mediaSrc, normalizeInventoryItem, sideClassName, sideLabel, type InventoryItem, type InventoryKind } from './inventoryPresentation';

type InventoryDetailClientProps = {
  kind: InventoryKind;
  itemId: string;
};

export function InventoryDetailClient({ kind, itemId }: InventoryDetailClientProps) {
  const [item, setItem] = useState<InventoryItem | null>((kind === 'need' ? mockNeeds : mockOffers).find((entry) => entry.id === itemId) ?? null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadItem() {
      setLoading(true);
      try {
        const response = kind === 'need' ? await api.needs.get(itemId) : await api.offers.get(itemId);
        if (!mounted) return;
        const liveItem = normalizeInventoryItem(response, kind);
        if (liveItem) {
          setItem(liveItem);
          setUsingFallback(false);
        }
      } catch {
        if (!mounted) return;
        const fallback = (kind === 'need' ? mockNeeds : mockOffers).find((entry) => entry.id === itemId) ?? null;
        setItem(fallback);
        setUsingFallback(Boolean(fallback));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadItem();
    return () => { mounted = false; };
  }, [itemId, kind]);

  const baseHref = kind === 'need' ? '/needs' : '/offers';
  const noun = kindLabel(kind);

  if (!item && loading) {
    return (
      <article className="trade-detail-page">
        <section className="trade-hero-section">
          <span className="semantic-badge instruction">Loading</span>
          <h2>Loading {noun.toLowerCase()}...</h2>
        </section>
      </article>
    );
  }

  if (!item) {
    return (
      <article className="trade-detail-page">
        <section className="trade-hero-section">
          <span className="semantic-badge danger">Not found</span>
          <h2>This {noun.toLowerCase()} could not be loaded.</h2>
          <p>Check that the API is running, or open an item from your {kind === 'need' ? 'Needs' : 'Offers'} tab.</p>
          <Link href={baseHref} className="button">Back to {kind === 'need' ? 'Needs' : 'Offers'}</Link>
        </section>
      </article>
    );
  }

  const metadata = getInventoryMetadata(item);
  const tags = getInventoryTags(item);
  const timingLabel = kind === 'need' && 'timing' in item
    ? item.timing ?? 'Not specified'
    : kind === 'offer' && 'availability' in item
      ? item.availability ?? 'Not specified'
      : 'Not specified';

  return (
    <article className="trade-detail-page">
      <section className="trade-hero-section">
        <div className="status-row">
          <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind)}</span>
          <span className="semantic-badge instruction">{item.status}</span>
          {usingFallback ? <span className="semantic-badge instruction">Demo detail</span> : null}
        </div>
        <h2>{item.title}</h2>
        <p>{item.description}</p>
        {metadata ? <p className="meta">{metadata}</p> : null}
        <div className="inventory-detail-actions">
          <Link href={`${baseHref}/${item.id}/edit`} className="button">Edit {noun}</Link>
          <Link href="/trades/create" className="button secondary">Use in trade</Link>
        </div>
      </section>

      {item.media?.length ? (
        <section className="trade-social-section">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">Images</p>
              <h2>{noun} references</h2>
            </div>
          </div>
          <div className="inventory-media-grid inventory-media-grid--detail">
            {item.media.map((media) => (
              <figure key={media.id}>
                <img src={mediaSrc(media)} alt={media.filename ?? item.title} />
                <figcaption><span className="semantic-badge instruction">{media.status}</span></figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : (
        <section className="trade-social-section">
          <div className="proposal-empty-state">
            <strong>No images yet</strong>
            <span>Add images in edit mode so trade decks can show richer Need/Offer cards.</span>
          </div>
        </section>
      )}

      <section className="trade-social-section trade-social-section--compact">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Details</p>
            <h2>{noun} information</h2>
          </div>
        </div>
        <dl className="trade-detail-list">
          <div><dt>Status</dt><dd>{item.status}</dd></div>
          <div><dt>Category</dt><dd>{item.category ?? 'Not specified'}</dd></div>
          <div><dt>{kind === 'need' ? 'Timing' : 'Availability'}</dt><dd>{timingLabel}</dd></div>
          <div><dt>Mode</dt><dd>{item.mode ?? 'Not specified'}</dd></div>
          <div><dt>Location</dt><dd>{item.locationLabel ?? 'Not specified'}</dd></div>
          <div><dt>Expires</dt><dd>{formatInventoryDate(item.expiresAt)}</dd></div>
        </dl>
        {tags.length ? (
          <div className="tag-row">
            {tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        ) : null}
      </section>
    </article>
  );
}
