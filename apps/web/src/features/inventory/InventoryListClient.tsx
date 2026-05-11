'use client';

import Link from 'next/link';
import type { InventoryItemType, InventoryTemplateDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { InventoryEmptyState } from '../../components/InventoryEmptyState';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { formatInventoryDate, getInventoryMetadata, getInventoryTags, itemTypeLabel, kindLabel, mediaSrc, normalizeInventoryList, sideClassName, sideLabel, type InventoryItem, type InventoryKind } from './inventoryPresentation';

type InventoryListClientProps = {
  kind: InventoryKind;
};

type SourceTab = 'mine' | 'starter';
type ItemTypeFilter = InventoryItemType | 'all';

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

function createdItemFromCloneResponse(value: unknown, kind: InventoryKind): InventoryItem | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { need?: unknown; offer?: unknown };
  const item = kind === 'need' ? record.need : record.offer;
  if (!item || typeof item !== 'object') return null;
  const typedItem = item as Partial<InventoryItem>;
  return typeof typedItem.id === 'string' && typeof typedItem.title === 'string' ? item as InventoryItem : null;
}

function StarterTemplateCard({
  template,
  kind,
  disabled,
  cloning,
  onUse,
}: {
  template: InventoryTemplateDto;
  kind: InventoryKind;
  disabled: boolean;
  cloning: boolean;
  onUse: (template: InventoryTemplateDto) => void;
}) {
  const metadata = templateMetadata(template);
  const tags = templateTags(template);
  const label = kindLabel(kind);

  return (
    <article className="inventory-template-card">
      <div className="inventory-template-card__media" aria-hidden="true">
        <WebIcon name={kind === 'need' ? 'need' : 'offer'} size={34} decorative />
      </div>
      <div className="inventory-template-card__body">
        <div className="status-row">
          <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind)}</span>
          <span className="semantic-badge instruction">{templateSourceLabel(template)}</span>
        </div>
        <h3>{template.title}</h3>
        <p>{template.description}</p>
        {metadata ? <p className="meta">{metadata}</p> : null}
        {tags.length ? (
          <div className="tag-row inventory-card__tags">
            {tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        ) : null}
        <button type="button" className="button secondary inventory-template-card__button" disabled={disabled || cloning} onClick={() => onUse(template)}>
          {cloning ? 'Saving...' : `Use this ${label}`}
        </button>
      </div>
    </article>
  );
}

export function InventoryListClient({ kind }: InventoryListClientProps) {
  const auth = useWebAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [templates, setTemplates] = useState<InventoryTemplateDto[]>([]);
  const [query, setQuery] = useState('');
  const [sourceTab, setSourceTab] = useState<SourceTab>('mine');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [createdHref, setCreatedHref] = useState('');
  const [cloningTemplateId, setCloningTemplateId] = useState('');
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

  useEffect(() => {
    let mounted = true;
    async function loadTemplates() {
      setTemplateLoading(true);
      try {
        const response = await api.inventoryTemplates.list({ kind, take: 100 });
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
  }, [kind]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.title, item.description, item.category, getInventoryMetadata(item), ...getInventoryTags(item)].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [items, query]);

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
    setActionError('');
    setCreatedHref('');

    if (!auth.isAuthenticated) {
      setActionError(`Sign in first, then you can save starter ${kind === 'need' ? 'needs' : 'offers'} to your account.`);
      return;
    }

    try {
      setCloningTemplateId(template.id);
      const response = await api.inventoryTemplates.clone(template.id, { status: 'active' });
      const created = createdItemFromCloneResponse(response, kind);
      if (!created) throw new Error(`Starter ${kind === 'need' ? 'Need' : 'Offer'} was saved, but the response could not be read.`);
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSourceTab('mine');
      setQuery('');
      setNotice(`${created.title} was saved to My ${kind === 'need' ? 'Needs' : 'Offers'}.`);
      setCreatedHref(`/${kind === 'need' ? 'needs' : 'offers'}/${created.id}`);
      setUsingFallback(false);
    } catch (cloneError) {
      setActionError(getFriendlyApiErrorMessage(cloneError, `Could not save this starter ${kind === 'need' ? 'Need' : 'Offer'}.`));
    } finally {
      setCloningTemplateId('');
    }
  }

  const plural = kind === 'need' ? 'needs' : 'offers';
  const singular = kindLabel(kind).toLowerCase();
  const newHref = kind === 'need' ? '/needs/new' : '/offers/new';
  const isStarterTab = sourceTab === 'starter';
  const activeLoading = isStarterTab ? templateLoading : loading;
  const visibleCount = isStarterTab ? filteredTemplates.length : filteredItems.length;

  return (
    <section className="mobile-page">
      <div className="inventory-source-tabs" role="tablist" aria-label={`${kindLabel(kind)} source`}>
        <button type="button" role="tab" aria-selected={!isStarterTab} className={!isStarterTab ? 'is-active' : ''} onClick={() => { setSourceTab('mine'); setQuery(''); }}>
          My {kindLabel(kind)}s
        </button>
        <button type="button" role="tab" aria-selected={isStarterTab} className={isStarterTab ? 'is-active' : ''} onClick={() => { setSourceTab('starter'); setQuery(''); }}>
          Starter {kindLabel(kind)}s
        </button>
      </div>

      <div className="inventory-controls">
        <label className="trade-search-field">
          <span className="sr-only">Search {plural}</span>
          <WebIcon name="search" size={17} decorative className="trade-search-field__icon" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isStarterTab ? `Search starter ${plural}` : `Search your ${plural}`} type="search" />
        </label>
        <Link href={newHref} className="trade-create-pill" aria-label={`Create ${singular}`}>
          <WebIcon name="add" size={21} decorative />
        </Link>
      </div>

      {isStarterTab ? (
        <div className="inventory-type-filters" aria-label="Starter item type filters">
          {ITEM_TYPE_FILTERS.map((filter) => (
            <button key={filter.value} type="button" className={itemTypeFilter === filter.value ? 'is-active' : ''} onClick={() => setItemTypeFilter(filter.value)}>
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}

      <section className="feed-status-row" aria-live="polite">
        <p>{activeLoading ? `Loading ${plural}...` : `${visibleCount} ${isStarterTab ? `starter ${plural}` : plural}`}</p>
        {!auth.hydrated || activeLoading ? <span className="semantic-badge instruction">Checking session</span> : isStarterTab ? <span className="semantic-badge success">Starter library</span> : usingFallback ? <span className="semantic-badge instruction">Demo inventory</span> : auth.isAuthenticated ? <span className="semantic-badge success">Live inventory</span> : <span className="semantic-badge instruction">Account needed</span>}
      </section>

      {notice ? <p className="notice-box success inventory-library-notice">{notice} {createdHref ? <Link href={createdHref}>Open it</Link> : null}</p> : null}
      {actionError ? <p className="notice-box danger inventory-library-notice">{actionError}</p> : null}
      {isStarterTab && templateError ? <p className="notice-box danger inventory-library-notice">{templateError}</p> : null}

      {!auth.isAuthenticated && auth.hydrated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">Signed out</span>
          <h3>{isStarterTab ? `Sign in to save starter ${plural}` : `Sign in to manage your real ${plural}`}</h3>
          <p>{isStarterTab ? `You can browse starter ${plural}, but saving one to your account needs login.` : demoDataEnabled ? `The demo cards below show the layout. Your saved ${plural} appear here after login.` : `Your saved ${plural} appear here after login.`}</p>
          <Link href={`/auth?next=${encodeURIComponent(`/${plural}`)}`} className="button">Sign in</Link>
        </section>
      ) : null}

      {isStarterTab ? (
        templateLoading ? (
          <InventoryListSkeleton />
        ) : templateSections.length ? (
          <div className="inventory-template-library">
            {templateSections.map((section) => (
              <section key={section.key} className="inventory-template-section">
                <div className="inventory-template-section__header">
                  <strong>{section.label}</strong>
                  <span>{section.items.length}</span>
                </div>
                <div className="inventory-list">
                  {section.items.map((template) => (
                    <StarterTemplateCard
                      key={template.id}
                      template={template}
                      kind={kind}
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
          <InventoryEmptyState
            title={query.trim() ? 'No starter matches found' : `No starter ${plural} yet`}
            body={query.trim() ? 'Try a different search or item type filter.' : `Starter ${plural} will appear here after the backend seed has been run.`}
            href={newHref}
            actionLabel={`Create ${kindLabel(kind)} manually`}
          />
        )
      ) : loading ? (
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
