'use client';

import Link from 'next/link';
import type { NeedDto, OfferDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { MobilePage, PageIntro } from '../../components/MobilePage';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { getInventoryMetadata, mediaSrc, normalizeInventoryList } from '../inventory/inventoryPresentation';

type Side = 'need' | 'offer';
type Inventory = NeedDto | OfferDto;
type LoadState = 'idle' | 'loading' | 'live' | 'demo';

type TradeSideChoosePageProps = {
  side: Side;
  currentNeedId?: string;
  currentOfferId?: string;
};

function isSelectable(item: Inventory) {
  return item.status === 'active' || item.status === 'draft';
}

function itemSearchText(item: Inventory) {
  return [item.title, item.description, item.category, getInventoryMetadata(item), ...(item.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
}

function createTradeHref(next: { needId?: string; offerId?: string }) {
  const params = new URLSearchParams();
  if (next.needId) params.set('needId', next.needId);
  if (next.offerId) params.set('offerId', next.offerId);
  const query = params.toString();
  return `/trades/create${query ? `?${query}` : ''}`;
}

function choosePageHref(side: Side, next: { needId?: string; offerId?: string }) {
  const params = new URLSearchParams();
  if (next.needId) params.set('needId', next.needId);
  if (next.offerId) params.set('offerId', next.offerId);
  const query = params.toString();
  return `/trades/create/choose-${side}${query ? `?${query}` : ''}`;
}

function newItemHref(side: Side, next: { needId?: string; offerId?: string }) {
  const params = new URLSearchParams();
  if (next.needId) params.set('needId', next.needId);
  if (next.offerId) params.set('offerId', next.offerId);
  const query = params.toString();
  return `/trades/create/choose-${side}/new${query ? `?${query}` : ''}`;
}

function selectHref(side: Side, itemId: string, currentNeedId?: string, currentOfferId?: string) {
  return side === 'need'
    ? createTradeHref({ needId: itemId, offerId: currentOfferId })
    : createTradeHref({ needId: currentNeedId, offerId: itemId });
}

function selectedIdForSide(side: Side, currentNeedId?: string, currentOfferId?: string) {
  return side === 'need' ? currentNeedId : currentOfferId;
}

function ChooseOption({ item, side, active, href }: { item: Inventory; side: Side; active: boolean; href: string }) {
  const image = item.media?.[0] ?? null;
  return (
    <Link href={href} className={active ? 'trade-side-option is-active' : 'trade-side-option'}>
      <span className="trade-side-option__media" aria-hidden="true">
        {image ? <img src={mediaSrc(image)} alt="" loading="lazy" /> : <WebIcon name={side === 'need' ? 'need' : 'offer'} size={24} decorative />}
      </span>
      <span className="trade-side-option__body">
        <span className="trade-side-option__top"><strong>{item.title}</strong><em>{item.status}</em></span>
        <span>{getInventoryMetadata(item) || item.description}</span>
      </span>
    </Link>
  );
}

export function TradeSideChoosePage({ side, currentNeedId = '', currentOfferId = '' }: TradeSideChoosePageProps) {
  const auth = useWebAuth();
  const demoDataEnabled = isWebDemoDataEnabled();
  const [items, setItems] = useState<Inventory[]>(() => demoDataEnabled ? (side === 'need' ? mockNeeds : mockOffers) : []);
  const [query, setQuery] = useState('');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [notice, setNotice] = useState('');
  const label = side === 'need' ? 'Need' : 'Offer';
  const lowerLabel = label.toLowerCase();
  const selectedId = selectedIdForSide(side, currentNeedId, currentOfferId) ?? '';
  const backHref = createTradeHref({ needId: currentNeedId, offerId: currentOfferId });
  const createHref = newItemHref(side, { needId: currentNeedId, offerId: currentOfferId });

  useEffect(() => {
    if (!auth.hydrated) return;
    let mounted = true;
    async function loadItems() {
      setLoadState('loading');
      if (!auth.isAuthenticated) {
        setItems(demoDataEnabled ? (side === 'need' ? mockNeeds : mockOffers) : []);
        setLoadState(demoDataEnabled ? 'demo' : 'idle');
        return;
      }
      try {
        const response = side === 'need' ? await api.needs.mine() : await api.offers.mine();
        if (!mounted) return;
        setItems(normalizeInventoryList(response, side) as Inventory[]);
        setLoadState('live');
      } catch {
        if (!mounted) return;
        setItems(demoDataEnabled ? (side === 'need' ? mockNeeds : mockOffers) : []);
        setLoadState(demoDataEnabled ? 'demo' : 'idle');
        setNotice(demoDataEnabled ? `Using demo ${lowerLabel}s because your live inventory could not be loaded.` : `Your saved ${lowerLabel}s could not be loaded. Check your connection and try again.`);
      }
    }
    void loadItems();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated, demoDataEnabled, lowerLabel, side]);

  const selectableItems = useMemo(() => items.filter(isSelectable), [items]);
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return selectableItems;
    return selectableItems.filter((item) => itemSearchText(item).includes(needle));
  }, [query, selectableItems]);

  return (
    <MobilePage className="trade-side-choose-page">
      <PageIntro
        eyebrow="Create trade"
        title={`Choose a ${lowerLabel}`}
        body={`Pick a saved ${lowerLabel} for this trade, or create a new one without losing your current selection.`}
        action={<Link href={backHref} className="button secondary">Back</Link>}
      />

      {!auth.hydrated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">Loading</span>
          <h3>Checking your account...</h3>
        </section>
      ) : !auth.isAuthenticated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">Signed out</span>
          <h3>Sign in to choose live {lowerLabel}s</h3>
          <p>Demo inventory may appear, but creating a live trade needs your account.</p>
          <Link href={`/auth?next=${encodeURIComponent(choosePageHref(side, { needId: currentNeedId, offerId: currentOfferId }))}`} className="button">Sign in</Link>
        </section>
      ) : null}

      <section className="mobile-card trade-side-choose-panel">
        <div className="trade-side-choose-panel__top">
          <span className={`semantic-badge ${side === 'need' ? 'need' : 'offer'}`}><WebIcon name={side === 'need' ? 'need' : 'offer'} size={14} decorative /> {label}</span>
          <span className="semantic-badge instruction">{loadState === 'loading' ? 'Loading' : loadState === 'live' ? 'Live inventory' : loadState === 'demo' ? 'Demo inventory' : `${selectableItems.length} available`}</span>
        </div>

        <label className="trade-search-field trade-side-choose-search">
          <span className="sr-only">Search saved {lowerLabel}s</span>
          <WebIcon name="search" size={17} decorative className="trade-search-field__icon" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search saved ${lowerLabel}s`} type="search" autoFocus />
        </label>

        <Link href={createHref} className="trade-side-create-link">
          <span><WebIcon name="add" size={18} decorative /></span>
          <strong>Create a new {lowerLabel}</strong>
          <small>Save it, then return to Create Trade with it selected.</small>
        </Link>

        {notice ? <p className="form-message form-message--success">{notice}</p> : null}

        {filteredItems.length ? (
          <div className="trade-side-option-list trade-side-option-list--page">
            {filteredItems.map((item) => (
              <ChooseOption
                key={item.id}
                item={item}
                side={side}
                active={item.id === selectedId}
                href={selectHref(side, item.id, currentNeedId, currentOfferId)}
              />
            ))}
          </div>
        ) : (
          <div className="trade-side-empty-state trade-side-empty-state--page">
            <strong>{query.trim() ? 'No matches found' : `No saved ${lowerLabel}s yet`}</strong>
            <span>{query.trim() ? 'Try a different search, or create a new saved item.' : `Create a ${lowerLabel} first, then use it in this trade.`}</span>
            <Link href={createHref} className="button secondary"><WebIcon name="add" size={16} decorative /> Create {label}</Link>
          </div>
        )}
      </section>
    </MobilePage>
  );
}
