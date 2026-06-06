'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { InventoryItemType, InventoryTemplateDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { InventoryEmptyState } from '../../components/InventoryEmptyState';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { formatInventoryDate, getInventoryMetadata, getInventoryTags, inventoryStatusLabel, itemTypeLabel, itemTypePluralLabel, kindLabel, kindPluralLabel, mediaSrc, modeLabel, normalizeInventoryList, sideClassName, sideLabel, type InventoryI18n, type InventoryItem, type InventoryKind } from './inventoryPresentation';

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

const ITEM_TYPE_FILTERS: ItemTypeFilter[] = ['all', 'service', 'goods', 'other'];

const ITEM_TYPE_ORDER: InventoryItemType[] = ['service', 'goods', 'other'];

function InventoryCard({ item, kind, i18n }: { item: InventoryItem; kind: InventoryKind; i18n: InventoryI18n }) {
  const metadata = getInventoryMetadata(item, i18n);
  const tags = getInventoryTags(item);
  const image = item.media?.[0];

  return (
    <Link href={`/${kind === 'need' ? 'needs' : 'offers'}/${item.id}`} className="inventory-card inventory-card--owner" aria-label={`${i18n.t?.('common.actions.open') ?? 'Open'} ${item.title}`}>
      <div className="inventory-card__media" aria-hidden="true">
        {image ? <img src={mediaSrc(image)} alt="" loading="lazy" /> : <WebIcon name={kind === 'need' ? 'need' : 'offer'} size={38} decorative />}
      </div>
      <div className="inventory-card__body">
        <div className="status-row">
          <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind, i18n)}</span>
          <span className="semantic-badge instruction">{inventoryStatusLabel(item.status, i18n)}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        {metadata ? <p className="meta">{metadata}</p> : null}
        <div className="inventory-card__footer">
          <span>{formatInventoryDate(item.expiresAt, i18n)}</span>
          <strong>{i18n.t?.('media.labels.image') ?? 'image'} × {item.media?.length ?? 0}</strong>
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

function templateMetadata(template: InventoryTemplateDto, i18n: InventoryI18n) {
  const timing = template.kind === 'need' ? template.timing : template.availability;
  return [itemTypeLabel(template.itemType, i18n), template.category, timing, modeLabel(template.mode, i18n), template.locationLabel]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' · ');
}

function templateTags(template: InventoryTemplateDto) {
  return template.kind === 'offer' ? [...(template.includes ?? []), ...(template.tags ?? [])] : template.tags ?? [];
}

function templateSearchText(template: InventoryTemplateDto, i18n: InventoryI18n) {
  return [template.title, template.description, template.category, templateMetadata(template, i18n), ...templateTags(template)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function templateSourceLabel(template: InventoryTemplateDto, i18n: InventoryI18n) {
  if (template.businessProfile?.displayName) return template.businessProfile.displayName;
  if (template.sourceType === 'brand') return i18n.t?.('inventory.sourceLabels.brandLibrary') ?? 'Brand library';
  if (template.sourceType === 'business') return i18n.t?.('inventory.sourceLabels.companyLibrary') ?? 'Company library';
  if (template.sourceType === 'partner') return i18n.t?.('inventory.sourceLabels.partnerLibrary') ?? 'Partner library';
  return i18n.t?.('inventory.sourceLabels.hellowhenStarter') ?? 'Hellowhen starter';
}

function groupTemplates(templates: InventoryTemplateDto[], i18n: InventoryI18n): TemplateSection[] {
  return ITEM_TYPE_ORDER.map((itemType) => ({
    key: itemType,
    label: itemTypePluralLabel(itemType, i18n),
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
  i18n,
}: {
  template: InventoryTemplateDto;
  kind: InventoryKind;
  disabled: boolean;
  cloning: boolean;
  onUse: (template: InventoryTemplateDto) => void;
  i18n: InventoryI18n;
}) {
  const metadata = templateMetadata(template, i18n);
  const tags = templateTags(template);
  const label = kindLabel(kind, i18n);
  const image = template.media?.[0] ?? null;
  const imageCount = template.media?.length ?? 0;
  const isDisabled = disabled || cloning;
  const actionLabel = cloning
    ? (i18n.t?.('common.states.saving') ?? 'Saving...')
    : kind === 'need'
      ? (i18n.t?.('inventory.actions.useThisNeed') ?? `Use this ${label}`)
      : (i18n.t?.('inventory.actions.useThisOffer') ?? `Use this ${label}`);

  function handleUse() {
    if (isDisabled) return;
    onUse(template);
  }

  return (
    <article
      className={`inventory-template-card${isDisabled ? ' is-disabled' : ''}`}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      aria-label={actionLabel}
      onClick={handleUse}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleUse();
      }}
    >
      <div className="inventory-template-card__media" aria-hidden="true">
        {image ? <img src={mediaSrc(image)} alt="" loading="lazy" /> : <WebIcon name={kind === 'need' ? 'need' : 'offer'} size={34} decorative />}
      </div>
      <div className="inventory-template-card__body">
        <div className="status-row">
          <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind, i18n)}</span>
          <span className="semantic-badge instruction">{templateSourceLabel(template, i18n)}</span>
        </div>
        <h3>{template.title}</h3>
        <p>{template.description}</p>
        {metadata ? <p className="meta">{metadata}</p> : null}
        {tags.length ? (
          <div className="tag-row inventory-card__tags">
            {tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        ) : null}
        {imageCount > 0 ? (
          <div className="inventory-template-card__footer">
            <strong>{i18n.t?.('media.labels.image') ?? 'image'} × {imageCount}</strong>
          </div>
        ) : null}
        <button type="button" className="button secondary inventory-template-card__button" disabled={isDisabled} onClick={(event) => { event.stopPropagation(); handleUse(); }}>
          {actionLabel}
        </button>
      </div>
      <span className="inventory-template-card__chevron" aria-hidden="true">›</span>
    </article>
  );
}

export function InventoryListClient({ kind }: InventoryListClientProps) {
  const auth = useWebAuth();
  const searchParams = useSearchParams();
  const { t, language } = useWebTranslation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [templates, setTemplates] = useState<InventoryTemplateDto[]>([]);
  const [query, setQuery] = useState('');
  const [sourceTab, setSourceTab] = useState<SourceTab>(() => searchParams.get('source') === 'starter' ? 'starter' : 'mine');
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
  const i18n = useMemo(() => ({ t, language }), [language, t]);

  useEffect(() => {
    if (searchParams.get('source') === 'starter') {
      setSourceTab('starter');
    }
  }, [searchParams]);

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
        const response = await api.inventoryTemplates.list({ kind, language, countryCode: auth.user?.profile?.countryCode ?? undefined, take: 100 });
        if (!mounted) return;
        setTemplates(normalizeTemplateList(response));
        setTemplateError('');
      } catch (loadError) {
        if (!mounted) return;
        setTemplates([]);
        setTemplateError(getFriendlyApiErrorMessage(loadError, t('inventory.errors.starterLibraryCouldNotLoad')));
      } finally {
        if (mounted) setTemplateLoading(false);
      }
    }
    void loadTemplates();
    return () => { mounted = false; };
  }, [auth.user?.profile?.countryCode, kind, language, t]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.title, item.description, item.category, getInventoryMetadata(item, i18n), ...getInventoryTags(item)].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [i18n, items, query]);

  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesType = itemTypeFilter === 'all' || (template.itemType ?? 'service') === itemTypeFilter;
      const matchesSearch = !needle || templateSearchText(template, i18n).includes(needle);
      return matchesType && matchesSearch;
    });
  }, [i18n, itemTypeFilter, query, templates]);

  const templateSections = useMemo(() => groupTemplates(filteredTemplates, i18n), [filteredTemplates, i18n]);

  async function handleUseTemplate(template: InventoryTemplateDto) {
    setNotice('');
    setActionError('');
    setCreatedHref('');

    if (!auth.isAuthenticated) {
      setActionError(t('inventory.signedOut.starterBody', { items: kind === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase() }));
      return;
    }

    try {
      setCloningTemplateId(template.id);
      const response = await api.inventoryTemplates.clone(template.id, { status: 'active' });
      const created = createdItemFromCloneResponse(response, kind);
      if (!created) throw new Error(kind === 'need' ? t('inventory.errors.starterSavedUnreadableNeed') : t('inventory.errors.starterSavedUnreadableOffer'));
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSourceTab('mine');
      setQuery('');
      setNotice(t('inventory.messages.starterSavedToMine', { title: created.title, collection: kind === 'need' ? t('inventory.labels.myNeeds') : t('inventory.labels.myOffers') }));
      setCreatedHref(`/${kind === 'need' ? 'needs' : 'offers'}/${created.id}`);
      setUsingFallback(false);
    } catch (cloneError) {
      setActionError(getFriendlyApiErrorMessage(cloneError, kind === 'need' ? t('inventory.errors.couldNotSaveStarterNeed') : t('inventory.errors.couldNotSaveStarterOffer')));
    } finally {
      setCloningTemplateId('');
    }
  }

  const plural = kind === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase();
  const singular = kindLabel(kind, i18n).toLowerCase();
  const newHref = kind === 'need' ? '/needs/new' : '/offers/new';
  const isStarterTab = sourceTab === 'starter';
  const activeLoading = isStarterTab ? templateLoading : loading;
  const visibleCount = isStarterTab ? filteredTemplates.length : filteredItems.length;

  return (
    <section className="mobile-page">
      <div className="inventory-source-tabs" role="tablist" aria-label={`${kindPluralLabel(kind, i18n)} source`}>
        <button type="button" role="tab" aria-selected={!isStarterTab} className={!isStarterTab ? 'is-active' : ''} onClick={() => { setSourceTab('mine'); setQuery(''); }}>
          {kind === 'need' ? t('inventory.labels.myNeeds') : t('inventory.labels.myOffers')}
        </button>
        <button type="button" role="tab" aria-selected={isStarterTab} className={isStarterTab ? 'is-active' : ''} onClick={() => { setSourceTab('starter'); setQuery(''); }}>
          {kind === 'need' ? t('inventory.labels.starterNeeds') : t('inventory.labels.starterOffers')}
        </button>
      </div>

      <div className="inventory-controls">
        <label className="trade-search-field">
          <span className="sr-only">{t('common.actions.search')}</span>
          <WebIcon name="search" size={17} decorative className="trade-search-field__icon" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isStarterTab ? `${t('common.actions.search')} ${t('inventory.labels.starterLibrary').toLowerCase()}` : `${t('common.actions.search')} ${plural}`} type="search" />
        </label>
        <Link href={newHref} className="trade-create-pill" aria-label={`${t('common.actions.create')} ${singular}`}>
          <WebIcon name="add" size={21} decorative />
        </Link>
      </div>

      {isStarterTab ? (
        <div className="inventory-type-filters" aria-label={t('inventory.labels.type')}>
          {ITEM_TYPE_FILTERS.map((filter) => (
            <button key={filter} type="button" className={itemTypeFilter === filter ? 'is-active' : ''} onClick={() => setItemTypeFilter(filter)}>
              {itemTypePluralLabel(filter, i18n)}
            </button>
          ))}
        </div>
      ) : null}

      <section className="feed-status-row" aria-live="polite">
        <p>{activeLoading ? t('inventory.messages.loadingItems', { items: plural }) : isStarterTab ? t('inventory.messages.visibleStarterItems', { count: visibleCount, items: plural }) : t('inventory.messages.visibleItems', { count: visibleCount, items: plural })}</p>
        {!auth.hydrated || activeLoading ? <span className="semantic-badge instruction">{t('inventory.labels.checkingSession')}</span> : isStarterTab ? <span className="semantic-badge success">{t('inventory.labels.starterLibrary')}</span> : usingFallback ? <span className="semantic-badge instruction">{t('inventory.labels.demoInventory')}</span> : auth.isAuthenticated ? <span className="semantic-badge success">{t('inventory.labels.liveInventory')}</span> : <span className="semantic-badge instruction">{t('inventory.labels.accountNeeded')}</span>}
      </section>

      {notice ? <p className="notice-box success inventory-library-notice">{notice} {createdHref ? <Link href={createdHref}>{t('inventory.messages.openIt')}</Link> : null}</p> : null}
      {actionError ? <p className="notice-box danger inventory-library-notice">{actionError}</p> : null}
      {isStarterTab && templateError ? <p className="notice-box danger inventory-library-notice">{templateError}</p> : null}

      {!auth.isAuthenticated && auth.hydrated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
          <h3>{isStarterTab ? t('inventory.signedOut.starterTitle', { items: plural }) : t('inventory.signedOut.mineTitle', { items: plural })}</h3>
          <p>{isStarterTab ? t('inventory.signedOut.starterBody', { items: plural }) : demoDataEnabled ? t('inventory.signedOut.mineDemoBody', { items: plural }) : t('inventory.signedOut.mineBody', { items: plural })}</p>
          <Link href={`/auth?next=${encodeURIComponent(`/${kind === 'need' ? 'needs' : 'offers'}`)}`} className="button">{t('auth.actions.signIn')}</Link>
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
                      i18n={i18n}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <InventoryEmptyState
            title={query.trim() ? t('inventory.empty.noStarterMatches') : t('inventory.empty.noStarterKind', { items: plural })}
            body={query.trim() ? t('inventory.empty.searchOrFilterBody') : t('inventory.empty.starterSeedBody', { items: plural })}
            href={newHref}
            actionLabel={kind === 'need' ? t('inventory.actions.createNeedManual') : t('inventory.actions.createOfferManual')}
          />
        )
      ) : loading ? (
        <InventoryListSkeleton />
      ) : filteredItems.length ? (
        <div className="inventory-list">
          {filteredItems.map((item) => <InventoryCard key={item.id} item={item} kind={kind} i18n={i18n} />)}
        </div>
      ) : (
        <InventoryEmptyState
          title={kind === 'need' ? t('inventory.empty.createFirstNeed') : t('inventory.empty.createFirstOffer')}
          body={kind === 'need'
            ? t('inventory.empty.needBody')
            : t('inventory.empty.offerBody')}
          href={newHref}
          actionLabel={kind === 'need' ? t('inventory.actions.createNeed') : t('inventory.actions.createOffer')}
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
