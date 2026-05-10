'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { InventoryEmptyState } from '../../components/InventoryEmptyState';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { formatInventoryDate, getInventoryMetadata, getInventoryTags, kindLabel, mediaSrc, normalizeInventoryList, sideClassName, sideLabel, type InventoryItem, type InventoryKind } from './inventoryPresentation';

type InventoryListClientProps = {
  kind: InventoryKind;
};

function InventoryCard({ item, kind }: { item: InventoryItem; kind: InventoryKind }) {
  const metadata = getInventoryMetadata(item);
  const tags = getInventoryTags(item);
  const image = item.media?.[0];

  return (
    <Link href={`/${kind === 'need' ? 'needs' : 'offers'}/${item.id}`} className="inventory-card" aria-label={`Open ${item.title}`}>
      <div className="inventory-card__media" aria-hidden="true">
        {image ? <img src={mediaSrc(image)} alt="" loading="lazy" /> : <WebIcon name={kind === 'need' ? 'need' : 'offer'} size={38} decorative />}
      </div>
      <div className="inventory-card__body">
        <div className="status-row">
          <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind)}</span>
          <span className="semantic-badge instruction">{item.status}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        {metadata ? <p className="meta">{metadata}</p> : null}
        <div className="inventory-card__footer">
          <span>{formatInventoryDate(item.expiresAt)}</span>
          <strong>{item.media?.length ?? 0} image{(item.media?.length ?? 0) === 1 ? '' : 's'}</strong>
        </div>
        {tags.length ? (
          <div className="tag-row inventory-card__tags">
            {tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function InventoryListClient({ kind }: InventoryListClientProps) {
  const auth = useWebAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const demoDataEnabled = isWebDemoDataEnabled();

  useEffect(() => {
    let mounted = true;
    async function loadInventory() {
      if (!auth.hydrated) return;
      setLoading(true);

      if (!auth.isAuthenticated) {
        setItems(demoDataEnabled ? (kind === 'need' ? mockNeeds : mockOffers) : []);
        setUsingFallback(demoDataEnabled);
        setLoading(false);
        return;
      }

      try {
        const response = kind === 'need' ? await api.needs.mine() : await api.offers.mine();
        if (!mounted) return;
        setItems(normalizeInventoryList(response, kind));
        setUsingFallback(false);
      } catch {
        if (!mounted) return;
        setItems(demoDataEnabled ? (kind === 'need' ? mockNeeds : mockOffers) : []);
        setUsingFallback(demoDataEnabled);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadInventory();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated, demoDataEnabled, kind]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.title, item.description, item.category, getInventoryMetadata(item), ...getInventoryTags(item)].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [items, query]);

  const plural = kind === 'need' ? 'needs' : 'offers';
  const singular = kindLabel(kind).toLowerCase();
  const newHref = kind === 'need' ? '/needs/new' : '/offers/new';

  return (
    <section className="mobile-page">
      <div className="inventory-controls">
        <label className="trade-search-field">
          <span className="sr-only">Search {plural}</span>
          <WebIcon name="search" size={17} decorative className="trade-search-field__icon" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search your ${plural}`} type="search" />
        </label>
        <Link href={newHref} className="trade-create-pill" aria-label={`Create ${singular}`}>
          <WebIcon name="add" size={21} decorative />
        </Link>
      </div>

      <section className="feed-status-row" aria-live="polite">
        <p>{loading ? `Loading ${plural}...` : `${filteredItems.length} ${plural}`}</p>
        {!auth.hydrated || loading ? <span className="semantic-badge instruction">Checking session</span> : usingFallback ? <span className="semantic-badge instruction">Demo inventory</span> : auth.isAuthenticated ? <span className="semantic-badge success">Live inventory</span> : <span className="semantic-badge instruction">Account needed</span>}
      </section>

      {!auth.isAuthenticated && auth.hydrated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">Signed out</span>
          <h3>Sign in to manage your real {plural}</h3>
          <p>{demoDataEnabled ? `The demo cards below show the layout. Your saved ${plural} appear here after login.` : `Your saved ${plural} appear here after login.`}</p>
          <Link href="/auth" className="button">Sign in</Link>
        </section>
      ) : null}

      {loading ? (
        <InventoryListSkeleton />
      ) : filteredItems.length ? (
        <div className="inventory-list">
          {filteredItems.map((item) => <InventoryCard key={item.id} item={item} kind={kind} />)}
        </div>
      ) : (
        <InventoryEmptyState
          title={`Create your first ${singular}`}
          body={kind === 'need'
            ? 'Use Needs for requests like design help, video editing, tutoring, repairs, and other things you want.'
            : 'Use Offers for services, skills, small jobs, and anything you can provide.'}
          href={newHref}
          actionLabel={`Create ${kindLabel(kind)}`}
        />
      )}
    </section>
  );
}

function InventoryListSkeleton() {
  return (
    <div className="inventory-list inventory-list--skeleton" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div className="inventory-card inventory-card--skeleton" key={item}>
          <div className="inventory-card__media" />
          <div className="inventory-card__body">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}
