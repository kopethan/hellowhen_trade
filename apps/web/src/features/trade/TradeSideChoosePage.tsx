'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { InventoryItemType, InventoryTemplateDto, NeedDto, OfferDto, TradePostType } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { MobilePage, PageIntro } from '../../components/MobilePage';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { getInventoryMetadata, itemTypeLabel, mediaSrc, normalizeInventoryList } from '../inventory/inventoryPresentation';

type Side = 'need' | 'offer';
type Inventory = NeedDto | OfferDto;
type LoadState = 'idle' | 'loading' | 'live' | 'demo';
type SourceMode = 'mine' | 'starter';
type InitialSourceMode = SourceMode | '';
type ItemTypeFilter = InventoryItemType | 'all';

type TradeSideChoosePageProps = {
  side: Side;
  currentNeedId?: string;
  currentOfferId?: string;
  initialSource?: InitialSourceMode;
  postType?: TradePostType | '';
};

type TemplateSection = {
  key: InventoryItemType;
  label: string;
  items: InventoryTemplateDto[];
};

const ITEM_TYPE_FILTERS: Array<{ value: ItemTypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'service', label: 'Services' },
  { value: 'goods', label: 'Goods' },
  { value: 'other', label: 'Other' },
];

const ITEM_TYPE_ORDER: InventoryItemType[] = ['service', 'goods', 'other'];

function isSelectable(item: Inventory) {
  return item.status === 'active' || item.status === 'draft';
}

function itemSearchText(item: Inventory) {
  return [item.title, item.description, item.category, getInventoryMetadata(item), ...(item.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
}

function createTradeHref(next: { postType?: TradePostType | ''; needId?: string; offerId?: string }) {
  const params = new URLSearchParams();
  if (next.postType) params.set('postType', next.postType);
  if (next.needId && next.postType !== 'open_offer') params.set('needId', next.needId);
  if (next.offerId && next.postType !== 'open_need') params.set('offerId', next.offerId);
  const query = params.toString();
  return `/trades/create${query ? `?${query}` : ''}`;
}

function choosePageHref(side: Side, next: { postType?: TradePostType | ''; needId?: string; offerId?: string }, source?: SourceMode) {
  const params = new URLSearchParams();
  if (next.postType) params.set('postType', next.postType);
  if (next.needId && next.postType !== 'open_offer') params.set('needId', next.needId);
  if (next.offerId && next.postType !== 'open_need') params.set('offerId', next.offerId);
  if (source) params.set('source', source);
  const query = params.toString();
  return `/trades/create/choose-${side}${query ? `?${query}` : ''}`;
}

function newItemHref(side: Side, next: { postType?: TradePostType | ''; needId?: string; offerId?: string }) {
  const params = new URLSearchParams();
  if (next.postType) params.set('postType', next.postType);
  if (next.needId && next.postType !== 'open_offer') params.set('needId', next.needId);
  if (next.offerId && next.postType !== 'open_need') params.set('offerId', next.offerId);
  const query = params.toString();
  return `/trades/create/choose-${side}/new${query ? `?${query}` : ''}`;
}

function selectHref(side: Side, itemId: string, currentNeedId?: string, currentOfferId?: string, postType?: TradePostType | '') {
  return side === 'need'
    ? createTradeHref({ postType, needId: itemId, offerId: currentOfferId })
    : createTradeHref({ postType, needId: currentNeedId, offerId: itemId });
}

function selectedIdForSide(side: Side, currentNeedId?: string, currentOfferId?: string) {
  return side === 'need' ? currentNeedId : currentOfferId;
}

function normalizeTemplateList(value: unknown): InventoryTemplateDto[] {
  if (Array.isArray(value)) return value as InventoryTemplateDto[];
  if (!value || typeof value !== 'object') return [];
  const record = value as { templates?: unknown[]; items?: unknown[] };
  if (Array.isArray(record.templates)) return record.templates as InventoryTemplateDto[];
  if (Array.isArray(record.items)) return record.items as InventoryTemplateDto[];
  return [];
}

function templateMetadata(template: InventoryTemplateDto) {
  const timing = template.kind === 'need' ? template.timing : template.availability;
  return [itemTypeLabel(template.itemType), template.category, timing, template.mode, template.locationLabel]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' · ');
}

function templateTags(template: InventoryTemplateDto) {
  return template.kind === 'offer' ? [...(template.includes ?? []), ...(template.tags ?? [])] : template.tags ?? [];
}

function templateSearchText(template: InventoryTemplateDto) {
  return [template.title, template.description, template.category, templateMetadata(template), ...templateTags(template)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function templateSourceLabel(template: InventoryTemplateDto) {
  if (template.sourceType === 'business' || template.sourceType === 'brand') return template.businessProfile?.displayName ?? 'Brand library';
  if (template.sourceType === 'partner') return template.businessProfile?.displayName ?? 'Partner library';
  return 'Hellowhen starter';
}

function groupTemplates(templates: InventoryTemplateDto[]): TemplateSection[] {
  return ITEM_TYPE_ORDER.map((itemType) => ({
    key: itemType,
    label: itemType === 'service' ? 'Services' : itemTypeLabel(itemType),
    items: templates.filter((template) => (template.itemType ?? 'service') === itemType),
  })).filter((section) => section.items.length > 0);
}

function createdItemFromCloneResponse(value: unknown, side: Side): Inventory | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { need?: unknown; offer?: unknown };
  const item = side === 'need' ? record.need : record.offer;
  if (!item || typeof item !== 'object') return null;
  const typedItem = item as Partial<Inventory>;
  return typeof typedItem.id === 'string' && typeof typedItem.title === 'string' ? item as Inventory : null;
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

function StarterTemplateOption({
  template,
  side,
  disabled,
  cloning,
  onUse,
}: {
  template: InventoryTemplateDto;
  side: Side;
  disabled: boolean;
  cloning: boolean;
  onUse: (template: InventoryTemplateDto) => void;
}) {
  const metadata = templateMetadata(template);
  const tags = templateTags(template);
  const label = side === 'need' ? 'Need' : 'Offer';

  return (
    <article className="trade-side-template-option">
      <span className="trade-side-option__media" aria-hidden="true">
        <WebIcon name={side === 'need' ? 'need' : 'offer'} size={24} decorative />
      </span>
      <div className="trade-side-template-option__body">
        <div className="trade-side-option__top">
          <strong>{template.title}</strong>
          <em>{templateSourceLabel(template)}</em>
        </div>
        <p>{template.description}</p>
        {metadata ? <span>{metadata}</span> : null}
        {tags.length ? (
          <div className="tag-row trade-side-template-option__tags">
            {tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        ) : null}
        <button type="button" className="button secondary trade-side-template-option__button" disabled={disabled || cloning} onClick={() => onUse(template)}>
          {cloning ? 'Saving...' : `Use this ${label}`}
        </button>
      </div>
    </article>
  );
}

export function TradeSideChoosePage({ side, currentNeedId = '', currentOfferId = '', initialSource = '', postType = 'need_offer' }: TradeSideChoosePageProps) {
  const router = useRouter();
  const auth = useWebAuth();
  const demoDataEnabled = isWebDemoDataEnabled();
  const [sourceMode, setSourceMode] = useState<InitialSourceMode>(initialSource);
  const [items, setItems] = useState<Inventory[]>(() => demoDataEnabled ? (side === 'need' ? mockNeeds : mockOffers) : []);
  const [templates, setTemplates] = useState<InventoryTemplateDto[]>([]);
  const [query, setQuery] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [templateLoading, setTemplateLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [cloningTemplateId, setCloningTemplateId] = useState('');
  const label = side === 'need' ? 'Need' : 'Offer';
  const lowerLabel = label.toLowerCase();
  const pluralLabel = `${lowerLabel}s`;
  const selectedId = selectedIdForSide(side, currentNeedId, currentOfferId) ?? '';
  const backHref = createTradeHref({ postType, needId: currentNeedId, offerId: currentOfferId });
  const sourceChoiceHref = choosePageHref(side, { postType, needId: currentNeedId, offerId: currentOfferId });
  const createHref = newItemHref(side, { postType, needId: currentNeedId, offerId: currentOfferId });

  useEffect(() => {
    setSourceMode(initialSource);
    setQuery('');
    setNotice('');
    setTemplateError('');
  }, [initialSource, side]);

  useEffect(() => {
    if (!auth.hydrated || sourceMode !== 'mine') return;
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
      } catch (loadError) {
        if (!mounted) return;
        setItems(demoDataEnabled ? (side === 'need' ? mockNeeds : mockOffers) : []);
        setLoadState(demoDataEnabled ? 'demo' : 'idle');
        setNotice(demoDataEnabled ? `Using demo ${pluralLabel} because your live inventory could not be loaded.` : getFriendlyApiErrorMessage(loadError, `Your saved ${pluralLabel} could not be loaded. Check your connection and try again.`));
      }
    }
    void loadItems();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated, demoDataEnabled, pluralLabel, side, sourceMode]);

  useEffect(() => {
    if (sourceMode !== 'starter') return;
    let mounted = true;
    async function loadTemplates() {
      setTemplateLoading(true);
      try {
        const response = await api.inventoryTemplates.list({ kind: side, take: 100 });
        if (!mounted) return;
        setTemplates(normalizeTemplateList(response));
        setTemplateError('');
      } catch (loadError) {
        if (!mounted) return;
        setTemplates([]);
        setTemplateError(getFriendlyApiErrorMessage(loadError, 'Starter library could not be loaded.'));
      } finally {
        if (mounted) setTemplateLoading(false);
      }
    }
    void loadTemplates();
    return () => { mounted = false; };
  }, [side, sourceMode]);

  const selectableItems = useMemo(() => items.filter(isSelectable), [items]);
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return selectableItems;
    return selectableItems.filter((item) => itemSearchText(item).includes(needle));
  }, [query, selectableItems]);

  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesType = itemTypeFilter === 'all' || (template.itemType ?? 'service') === itemTypeFilter;
      const matchesSearch = !needle || templateSearchText(template).includes(needle);
      return matchesType && matchesSearch;
    });
  }, [itemTypeFilter, query, templates]);

  const templateSections = useMemo(() => groupTemplates(filteredTemplates), [filteredTemplates]);

  async function handleUseTemplate(template: InventoryTemplateDto) {
    setNotice('');
    setTemplateError('');

    if (!auth.isAuthenticated) {
      setTemplateError(`Sign in first, then you can save starter ${pluralLabel} to your account.`);
      return;
    }

    try {
      setCloningTemplateId(template.id);
      const response = await api.inventoryTemplates.clone(template.id, { status: 'active' });
      const created = createdItemFromCloneResponse(response, side);
      if (!created) throw new Error(`Starter ${label} was saved, but the response could not be read.`);
      const href = selectHref(side, created.id, currentNeedId, currentOfferId, postType);
      router.push(href);
    } catch (cloneError) {
      setTemplateError(getFriendlyApiErrorMessage(cloneError, `Could not save this starter ${label}.`));
      setCloningTemplateId('');
    }
  }

  const showSourceChoice = sourceMode !== 'mine' && sourceMode !== 'starter';

  return (
    <MobilePage className="trade-side-choose-page">
      <PageIntro
        eyebrow="Create trade"
        title={showSourceChoice ? `Choose ${lowerLabel} source` : sourceMode === 'starter' ? `Choose a starter ${lowerLabel}` : `Choose one of your ${pluralLabel}`}
        body={showSourceChoice
          ? `Start from your private ${pluralLabel}, or use a starter ${lowerLabel} from the Hellowhen Library.`
          : sourceMode === 'starter'
            ? `Pick a starter ${lowerLabel}. We save a private copy to your account, then return you to Create Trade.`
            : `Pick a saved ${lowerLabel} for this trade, or create a new one without losing your current selection.`}
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
          <h3>Sign in to choose live {pluralLabel}</h3>
          <p>You can browse the starter library, but creating a live trade needs your account.</p>
          <Link href={`/auth?next=${encodeURIComponent(choosePageHref(side, { postType, needId: currentNeedId, offerId: currentOfferId }, sourceMode || undefined))}`} className="button">Sign in</Link>
        </section>
      ) : null}

      {showSourceChoice ? (
        <section className="mobile-card trade-side-choose-panel trade-side-source-step">
          <div className="trade-side-choose-panel__top">
            <span className={`semantic-badge ${side === 'need' ? 'need' : 'offer'}`}><WebIcon name={side === 'need' ? 'need' : 'offer'} size={14} decorative /> {label}</span>
            <span className="semantic-badge instruction">Step 1 of 2</span>
          </div>
          <div className="trade-side-source-grid">
            <Link href={choosePageHref(side, { postType, needId: currentNeedId, offerId: currentOfferId }, 'mine')} className="trade-side-source-card" onClick={() => setSourceMode('mine')}>
              <span><WebIcon name={side === 'need' ? 'need' : 'offer'} size={22} decorative /></span>
              <strong>Use one of mine</strong>
              <small>Choose from your private saved {pluralLabel}.</small>
            </Link>
            <Link href={choosePageHref(side, { postType, needId: currentNeedId, offerId: currentOfferId }, 'starter')} className="trade-side-source-card" onClick={() => setSourceMode('starter')}>
              <span><WebIcon name="trade" size={22} decorative /></span>
              <strong>Use a starter</strong>
              <small>Start from Hellowhen Library, then save a private copy.</small>
            </Link>
          </div>
        </section>
      ) : null}

      {sourceMode === 'mine' ? (
        <section className="mobile-card trade-side-choose-panel">
          <div className="trade-side-choose-panel__top">
            <span className={`semantic-badge ${side === 'need' ? 'need' : 'offer'}`}><WebIcon name={side === 'need' ? 'need' : 'offer'} size={14} decorative /> My {label}s</span>
            <span className="semantic-badge instruction">{loadState === 'loading' ? 'Loading' : loadState === 'live' ? 'Live inventory' : loadState === 'demo' ? 'Demo inventory' : `${selectableItems.length} available`}</span>
          </div>
          <Link href={sourceChoiceHref} className="trade-side-source-back">Change source</Link>

          <label className="trade-search-field trade-side-choose-search">
            <span className="sr-only">Search saved {pluralLabel}</span>
            <WebIcon name="search" size={17} decorative className="trade-search-field__icon" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search saved ${pluralLabel}`} type="search" autoFocus />
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
                  href={selectHref(side, item.id, currentNeedId, currentOfferId, postType)}
                />
              ))}
            </div>
          ) : (
            <div className="trade-side-empty-state trade-side-empty-state--page">
              <strong>{query.trim() ? 'No matches found' : `No saved ${pluralLabel} yet`}</strong>
              <span>{query.trim() ? 'Try a different search, create a new saved item, or use a starter.' : `Create a ${lowerLabel} first, or start from the Hellowhen Library.`}</span>
              <div className="trade-side-empty-actions">
                <Link href={createHref} className="button secondary"><WebIcon name="add" size={16} decorative /> Create {label}</Link>
                <Link href={choosePageHref(side, { postType, needId: currentNeedId, offerId: currentOfferId }, 'starter')} className="button secondary">Use a starter</Link>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {sourceMode === 'starter' ? (
        <section className="mobile-card trade-side-choose-panel">
          <div className="trade-side-choose-panel__top">
            <span className={`semantic-badge ${side === 'need' ? 'need' : 'offer'}`}><WebIcon name={side === 'need' ? 'need' : 'offer'} size={14} decorative /> Starter {label}s</span>
            <span className="semantic-badge success">Hellowhen Library</span>
          </div>
          <Link href={sourceChoiceHref} className="trade-side-source-back">Change source</Link>

          <label className="trade-search-field trade-side-choose-search">
            <span className="sr-only">Search starter {pluralLabel}</span>
            <WebIcon name="search" size={17} decorative className="trade-search-field__icon" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search starter ${pluralLabel}`} type="search" autoFocus />
          </label>

          <div className="inventory-type-filters trade-side-template-filters" aria-label="Starter item type filters">
            {ITEM_TYPE_FILTERS.map((filter) => (
              <button key={filter.value} type="button" className={itemTypeFilter === filter.value ? 'is-active' : ''} onClick={() => setItemTypeFilter(filter.value)}>
                {filter.label}
              </button>
            ))}
          </div>

          {templateError ? <p className="notice-box danger inventory-library-notice">{templateError}</p> : null}

          {templateLoading ? (
            <div className="trade-side-empty-state trade-side-empty-state--page">
              <strong>Loading starter {pluralLabel}...</strong>
              <span>Checking the Hellowhen Library.</span>
            </div>
          ) : templateSections.length ? (
            <div className="trade-side-template-library">
              {templateSections.map((section) => (
                <section key={section.key} className="trade-side-template-section">
                  <div className="inventory-template-section__header">
                    <strong>{section.label}</strong>
                    <span>{section.items.length}</span>
                  </div>
                  <div className="trade-side-option-list trade-side-option-list--page">
                    {section.items.map((template) => (
                      <StarterTemplateOption
                        key={template.id}
                        template={template}
                        side={side}
                        disabled={!auth.isAuthenticated}
                        cloning={cloningTemplateId === template.id}
                        onUse={handleUseTemplate}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="trade-side-empty-state trade-side-empty-state--page">
              <strong>{query.trim() ? 'No starter matches found' : `No starter ${pluralLabel} yet`}</strong>
              <span>{query.trim() ? 'Try a different search or item type filter.' : `Starter ${pluralLabel} will appear here after the backend seed has been run.`}</span>
              <div className="trade-side-empty-actions">
                <Link href={createHref} className="button secondary"><WebIcon name="add" size={16} decorative /> Create {label} manually</Link>
                <Link href={choosePageHref(side, { postType, needId: currentNeedId, offerId: currentOfferId }, 'mine')} className="button secondary">Use one of mine</Link>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </MobilePage>
  );
}
