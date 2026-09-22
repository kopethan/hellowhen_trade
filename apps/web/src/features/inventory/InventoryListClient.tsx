'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { InventoryAvailabilityPreset, InventoryDurationPreset, InventoryFolderDto, InventoryFolderItemDto } from '@hellowhen/contracts';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { InventoryEmptyState } from '../../components/InventoryEmptyState';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { availabilityPresetLabel, durationPresetLabel, formatInventoryDate, getInventoryMetadata, getInventoryTags, inventoryCategoryLabel, inventoryStatusLabel, itemTypeLabel, kindLabel, mediaSrc, modeLabel, normalizeInventoryList, sideClassName, type InventoryI18n, type InventoryItem, type InventoryKind } from './inventoryPresentation';

type InventoryListClientProps = {
  kind: InventoryKind;
};

type FolderMode = 'create' | 'edit';

type InventoryFilterState = {
  itemType: string;
  category: string;
  mode: string;
  availability: string;
  duration: string;
  status: string;
};

const defaultInventoryFilters: InventoryFilterState = {
  itemType: 'all',
  category: 'all',
  mode: 'all',
  availability: 'all',
  duration: 'all',
  status: 'all',
};

function uniqueInventoryValues(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right));
}

function inventoryDuration(item: InventoryItem, kind: InventoryKind) {
  if (kind === 'need' && 'estimatedDurationPreset' in item) return item.estimatedDurationPreset ?? null;
  if (kind === 'offer' && 'typicalDurationPreset' in item) return item.typicalDurationPreset ?? null;
  return null;
}

function activeInventoryFilterCount(filters: InventoryFilterState) {
  return Object.values(filters).filter((value) => value !== 'all').length;
}

function inventoryStatusTone(status?: string | null) {
  if (status === 'active' || status === 'accepted' || status === 'fulfilled') return 'success';
  if (status === 'rejected' || status === 'closed') return 'danger';
  if (status === 'expired') return 'warning';
  return 'instruction';
}


function getFolderItemInventoryId(item: InventoryFolderItemDto, kind: InventoryKind) {
  if (kind === 'need') return item.needId ?? item.need?.id ?? null;
  return item.offerId ?? item.offer?.id ?? null;
}

function getFolderInventoryItemIds(folder: InventoryFolderDto | null | undefined, kind: InventoryKind) {
  return new Set((folder?.items ?? [])
    .map((item) => getFolderItemInventoryId(item, kind))
    .filter((itemId): itemId is string => Boolean(itemId)));
}

function findFolderItem(folder: InventoryFolderDto | null | undefined, kind: InventoryKind, inventoryItemId: string) {
  return (folder?.items ?? []).find((item) => getFolderItemInventoryId(item, kind) === inventoryItemId) ?? null;
}

function getFolderItemCount(folder: InventoryFolderDto, kind: InventoryKind) {
  return getFolderInventoryItemIds(folder, kind).size;
}

function InventoryCard({ item, kind, i18n }: { item: InventoryItem; kind: InventoryKind; i18n: InventoryI18n }) {
  const metadata = getInventoryMetadata(item, i18n);
  const tags = getInventoryTags(item);
  const image = item.media?.[0];
  const mediaCount = item.media?.length ?? 0;

  return (
    <Link href={`/${kind === 'need' ? 'needs' : 'offers'}/${item.id}`} className="inventory-card inventory-card--owner" aria-label={`${i18n.t?.('common.actions.open') ?? 'Open'} ${item.title}`}>
      <div className="inventory-card__media" aria-hidden="true">
        {image ? <img src={mediaSrc(image)} alt="" loading="lazy" /> : <WebIcon name={kind === 'need' ? 'need' : 'offer'} size={34} decorative />}
      </div>
      <div className="inventory-card__body">
        <div className="status-row inventory-card__badges">
          <span className={`semantic-badge ${sideClassName(kind)}`}>{kindLabel(kind, i18n)}</span>
          <span className={`semantic-badge ${inventoryStatusTone(item.status)}`}>{inventoryStatusLabel(item.status, i18n)}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        {metadata ? <p className="meta">{metadata}</p> : null}
        <div className="inventory-card__footer">
          <span className="inventory-card__expiry">{formatInventoryDate(item.expiresAt, i18n)}</span>
          {mediaCount ? <strong>{mediaCount} {i18n.t?.('inventory.labels.images') ?? 'images'}</strong> : null}
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
  const router = useRouter();
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [folders, setFolders] = useState<InventoryFolderDto[]>([]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<InventoryFilterState>({ ...defaultInventoryFilters });
  const [selectedFolderId, setSelectedFolderId] = useState<'all' | string>('all');
  const [folderMode, setFolderMode] = useState<FolderMode>('create');
  const [folderTitle, setFolderTitle] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [editingFolderId, setEditingFolderId] = useState('');
  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [folderActionId, setFolderActionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [notice, setNotice] = useState('');
  const [foldersError, setFoldersError] = useState('');
  const demoDataEnabled = isWebDemoDataEnabled();
  const i18n = useMemo(() => ({ t, language }), [language, t]);

  const loadInventoryFolders = useCallback(async () => {
    if (!auth.hydrated) return;

    if (!betaFeatures.inventoryFoldersEnabled) {
      setFolders([]);
      setSelectedFolderId('all');
      setFoldersError('');
      setFoldersLoading(false);
      return;
    }

    if (!auth.isAuthenticated) {
      setFolders([]);
      setSelectedFolderId('all');
      setFoldersError('');
      setFoldersLoading(false);
      return;
    }

    setFoldersLoading(true);
    try {
      const response = await api.inventoryFolders.list({ itemType: kind, includeItems: true });
      setFolders(Array.isArray(response.folders) ? response.folders : []);
      setFoldersError('');
    } catch (loadError) {
      setFoldersError(getFriendlyApiErrorMessage(loadError, t('inventory.errors.foldersCouldNotLoad')));
    } finally {
      setFoldersLoading(false);
    }
  }, [auth.hydrated, auth.isAuthenticated, kind, t]);

  useEffect(() => {
    void loadInventoryFolders();
  }, [loadInventoryFolders]);

  useEffect(() => {
    if (selectedFolderId !== 'all' && !folders.some((folder) => folder.id === selectedFolderId)) {
      setSelectedFolderId('all');
    }
  }, [folders, selectedFolderId]);

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

  const selectedFolder = useMemo(() => selectedFolderId === 'all' ? null : folders.find((folder) => folder.id === selectedFolderId) ?? null, [folders, selectedFolderId]);
  const selectedFolderItemIds = useMemo(() => getFolderInventoryItemIds(selectedFolder, kind), [kind, selectedFolder]);
  const folderScopedItems = useMemo(() => {
    if (!selectedFolder) return items;
    return items.filter((item) => selectedFolderItemIds.has(item.id));
  }, [items, selectedFolder, selectedFolderItemIds]);
  const availableItemsForSelectedFolder = useMemo(() => {
    if (!selectedFolder) return [];
    return items.filter((item) => !selectedFolderItemIds.has(item.id));
  }, [items, selectedFolder, selectedFolderItemIds]);

  const filterOptions = useMemo(() => ({
    itemTypes: uniqueInventoryValues(items.map((item) => item.itemType ?? 'service')),
    categories: uniqueInventoryValues(items.map((item) => item.category)),
    modes: uniqueInventoryValues(items.map((item) => item.mode)),
    availability: uniqueInventoryValues(items.map((item) => item.availabilityPreset)),
    durations: uniqueInventoryValues(items.map((item) => inventoryDuration(item, kind))),
    statuses: uniqueInventoryValues(items.map((item) => item.status)),
  }), [items, kind]);
  const activeFilterCount = activeInventoryFilterCount(filters);
  const hasSearchOrFilters = Boolean(query.trim() || activeFilterCount);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return folderScopedItems.filter((item) => {
      if (needle && ![item.title, item.description, item.category, getInventoryMetadata(item, i18n), ...getInventoryTags(item)].filter(Boolean).join(' ').toLowerCase().includes(needle)) return false;
      if (filters.itemType !== 'all' && (item.itemType ?? 'service') !== filters.itemType) return false;
      if (filters.category !== 'all' && item.category !== filters.category) return false;
      if (filters.mode !== 'all' && item.mode !== filters.mode) return false;
      if (filters.availability !== 'all' && item.availabilityPreset !== filters.availability) return false;
      if (filters.duration !== 'all' && inventoryDuration(item, kind) !== filters.duration) return false;
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      return true;
    });
  }, [filters, folderScopedItems, i18n, kind, query]);

  function resetLibraryFilters() {
    setQuery('');
    setFilters({ ...defaultInventoryFilters });
  }

  function goBackFromInventory() {
    if (typeof window !== 'undefined' && document.referrer) {
      try {
        if (new URL(document.referrer).origin === window.location.origin) {
          router.back();
          return;
        }
      } catch {
        // Fall through to the stable Account destination.
      }
    }
    router.push('/account');
  }

  function openCreateFolderForm() {
    setFolderMode('create');
    setEditingFolderId('');
    setFolderTitle('');
    setFolderDescription('');
    setFolderFormOpen(true);
    setFoldersError('');
  }

  function openEditFolderForm(folder: InventoryFolderDto) {
    setFolderMode('edit');
    setEditingFolderId(folder.id);
    setFolderTitle(folder.title);
    setFolderDescription(folder.description ?? '');
    setFolderFormOpen(true);
    setFoldersError('');
  }

  function closeFolderForm() {
    setFolderFormOpen(false);
    setFolderMode('create');
    setEditingFolderId('');
    setFolderTitle('');
    setFolderDescription('');
  }

  async function handleFolderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = folderTitle.trim();
    if (!title) {
      setFoldersError(t('inventory.errors.folderTitleRequired'));
      return;
    }

    try {
      setFolderActionId('folder-form');
      setFoldersError('');
      if (folderMode === 'edit' && editingFolderId) {
        await api.inventoryFolders.update(editingFolderId, { title, description: folderDescription.trim() || null });
        setNotice(t('inventory.messages.folderUpdated', { title }));
      } else {
        const response = await api.inventoryFolders.create({ title, description: folderDescription.trim() || undefined });
        setSelectedFolderId(response.folder.id);
        setNotice(t('inventory.messages.folderCreated', { title: response.folder.title }));
      }
      closeFolderForm();
      await loadInventoryFolders();
    } catch (saveError) {
      setFoldersError(getFriendlyApiErrorMessage(saveError, t('inventory.errors.folderCouldNotSave')));
    } finally {
      setFolderActionId('');
    }
  }

  async function handleDeleteFolder(folder: InventoryFolderDto) {
    const confirmed = window.confirm(t('inventory.messages.confirmDeleteFolder', { title: folder.title }));
    if (!confirmed) return;

    try {
      setFolderActionId(folder.id);
      setFoldersError('');
      await api.inventoryFolders.remove(folder.id);
      if (selectedFolderId === folder.id) setSelectedFolderId('all');
      setFolders((current) => current.filter((candidate) => candidate.id !== folder.id));
      setNotice(t('inventory.messages.folderDeleted', { title: folder.title }));
    } catch (deleteError) {
      setFoldersError(getFriendlyApiErrorMessage(deleteError, t('inventory.errors.folderCouldNotDelete')));
    } finally {
      setFolderActionId('');
    }
  }

  async function handleAddItemToSelectedFolder(item: InventoryItem) {
    if (!selectedFolder) return;
    try {
      setFolderActionId(`${selectedFolder.id}:${item.id}:add`);
      setFoldersError('');
      await api.inventoryFolders.addItem(selectedFolder.id, { itemType: kind, itemId: item.id });
      setNotice(t('inventory.messages.itemAddedToFolder', { title: item.title, folder: selectedFolder.title }));
      await loadInventoryFolders();
    } catch (addError) {
      setFoldersError(getFriendlyApiErrorMessage(addError, t('inventory.errors.folderItemCouldNotAdd')));
    } finally {
      setFolderActionId('');
    }
  }

  async function handleRemoveItemFromSelectedFolder(item: InventoryItem) {
    if (!selectedFolder) return;
    const folderItem = findFolderItem(selectedFolder, kind, item.id);
    if (!folderItem) return;

    try {
      setFolderActionId(`${selectedFolder.id}:${item.id}:remove`);
      setFoldersError('');
      await api.inventoryFolders.removeItem(selectedFolder.id, folderItem.id);
      setNotice(t('inventory.messages.itemRemovedFromFolder', { title: item.title, folder: selectedFolder.title }));
      await loadInventoryFolders();
    } catch (removeError) {
      setFoldersError(getFriendlyApiErrorMessage(removeError, t('inventory.errors.folderItemCouldNotRemove')));
    } finally {
      setFolderActionId('');
    }
  }

  const plural = kind === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase();
  const singular = kindLabel(kind, i18n).toLowerCase();
  const newHref = kind === 'need' ? '/needs/new' : '/offers/new';
  const visibleCount = filteredItems.length;

  const pageTitle = kind === 'need' ? t('inventory.labels.needs') : t('inventory.labels.offers');
  const helperCopy = kind === 'need' ? t('inventory.empty.needNativeBody') : t('inventory.empty.offerNativeBody');
  const searchLabel = kind === 'need' ? t('inventory.libraryFilters.searchMyNeeds') : t('inventory.libraryFilters.searchMyOffers');
  const filterLabel = kind === 'need' ? t('inventory.libraryFilters.filterMyNeeds') : t('inventory.libraryFilters.filterMyOffers');

  return (
    <section className={`mobile-page web-app-page inventory-library-page inventory-library-page--${kind}`}>
      <header className="inventory-library-header">
        <div className="inventory-library-header__title">
          <button type="button" className="web-back-button inventory-library-back" aria-label={t('navigation.goBack')} onClick={goBackFromInventory}>
            <WebIcon name="back" size={21} decorative />
          </button>
          <h1>{pageTitle}</h1>
        </div>
        <div className="inventory-library-header__actions">
          <button
            type="button"
            className={searchOpen || query ? 'inventory-library-action is-active' : 'inventory-library-action'}
            aria-label={searchLabel}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((current) => !current)}
            disabled={!items.length && !query}
          >
            <WebIcon name="search" size={20} decorative />
          </button>
          <button
            type="button"
            className={filtersOpen || activeFilterCount ? 'inventory-library-action is-active' : 'inventory-library-action'}
            aria-label={filterLabel}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((current) => !current)}
            disabled={!items.length}
          >
            <WebIcon name="filter" size={20} decorative />
            {activeFilterCount ? <span className="inventory-library-action__badge">{activeFilterCount}</span> : null}
          </button>
          <Link href={newHref} className="inventory-library-action inventory-library-action--create" aria-label={`${t('common.actions.create')} ${singular}`}>
            <WebIcon name="add" size={23} decorative />
          </Link>
        </div>
      </header>

      <nav className="inventory-library-segments" aria-label={`${pageTitle} ${t('common.librarySegments.mine')} / ${t('common.librarySegments.explore')}`}>
        <span className="is-active" aria-current="page">{t('common.librarySegments.mine')}</span>
        <Link href={`/explore?type=${kind}`}>{t('common.librarySegments.explore')}</Link>
      </nav>

      {searchOpen ? (
        <label className="inventory-library-search">
          <WebIcon name="search" size={18} decorative />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchLabel} type="search" />
          {query ? <button type="button" onClick={() => setQuery('')} aria-label={t('inventory.libraryFilters.clearMineSearch')}>×</button> : null}
        </label>
      ) : null}

      {filtersOpen ? (
        <section className="inventory-library-filter-panel" aria-label={filterLabel}>
          <div className="inventory-library-filter-panel__header">
            <div>
              <strong>{t('inventory.libraryFilters.title')}</strong>
              <p>{kind === 'need' ? t('inventory.libraryFilters.mineNeedsBody') : t('inventory.libraryFilters.mineOffersBody')}</p>
            </div>
            <button type="button" className="ghost-button" onClick={() => setFilters({ ...defaultInventoryFilters })} disabled={!activeFilterCount}>{t('inventory.libraryFilters.reset')}</button>
          </div>
          <div className="inventory-library-filter-grid">
            <label>
              <span>{t('inventory.libraryFilters.type')}</span>
              <select value={filters.itemType} onChange={(event) => setFilters((current) => ({ ...current, itemType: event.target.value }))}>
                <option value="all">{t('inventory.itemTypes.all')}</option>
                {filterOptions.itemTypes.map((value) => <option key={value} value={value}>{itemTypeLabel(value as 'service' | 'goods' | 'other', i18n)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('inventory.libraryFilters.category')}</span>
              <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
                <option value="all">{t('inventory.libraryFilters.allCategories')}</option>
                {filterOptions.categories.map((value) => <option key={value} value={value}>{inventoryCategoryLabel(value, i18n)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('inventory.libraryFilters.mode')}</span>
              <select value={filters.mode} onChange={(event) => setFilters((current) => ({ ...current, mode: event.target.value }))}>
                <option value="all">{t('inventory.libraryFilters.allModes')}</option>
                {filterOptions.modes.map((value) => <option key={value} value={value}>{modeLabel(value, i18n) ?? value}</option>)}
              </select>
            </label>
            <label>
              <span>{t('inventory.libraryFilters.availability')}</span>
              <select value={filters.availability} onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value }))}>
                <option value="all">{t('inventory.libraryFilters.allAvailability')}</option>
                {filterOptions.availability.map((value) => <option key={value} value={value}>{availabilityPresetLabel(value as InventoryAvailabilityPreset, i18n)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('inventory.libraryFilters.duration')}</span>
              <select value={filters.duration} onChange={(event) => setFilters((current) => ({ ...current, duration: event.target.value }))}>
                <option value="all">{t('inventory.libraryFilters.allDurations')}</option>
                {filterOptions.durations.map((value) => <option key={value} value={value}>{durationPresetLabel(value as InventoryDurationPreset, i18n)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('inventory.libraryFilters.status')}</span>
              <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="all">{t('inventory.libraryFilters.allStatuses')}</option>
                {filterOptions.statuses.map((value) => <option key={value} value={value}>{inventoryStatusLabel(value, i18n)}</option>)}
              </select>
            </label>
          </div>
        </section>
      ) : null}

      <p className="inventory-library-helper">{helperCopy}</p>

      {auth.isAuthenticated && betaFeatures.inventoryFoldersEnabled ? (
        <section className="inventory-folders-panel" aria-label={t('inventory.labels.myFolders')}>
          <div className="inventory-folders-panel__header">
            <div>
              <span className="semantic-badge instruction">{t('inventory.labels.myFolders')}</span>
              <p>{t('inventory.messages.foldersBody', { items: plural })}</p>
            </div>
            <button type="button" className="secondary inventory-folder-create-button" onClick={openCreateFolderForm}>
              <WebIcon name="add" size={16} decorative />
              {t('inventory.actions.createFolder')}
            </button>
          </div>

          <div className="inventory-folder-chips" aria-label={t('inventory.labels.folderFilter')}>
            <button type="button" className={selectedFolderId === 'all' ? 'is-active' : ''} onClick={() => setSelectedFolderId('all')}>
              <span>{t('inventory.labels.allFolders')}</span>
              <strong>{items.length}</strong>
            </button>
            {folders.map((folder) => (
              <button key={folder.id} type="button" className={selectedFolderId === folder.id ? 'is-active' : ''} onClick={() => setSelectedFolderId(folder.id)}>
                <span>{folder.title}</span>
                <strong>{getFolderItemCount(folder, kind)}</strong>
              </button>
            ))}
          </div>

          {foldersLoading ? <p className="meta inventory-folder-loading">{t('inventory.messages.foldersLoading')}</p> : null}
          {foldersError ? <p className="notice-box danger inventory-library-notice">{foldersError}</p> : null}

          {folderFormOpen ? (
            <form className="inventory-folder-form" onSubmit={handleFolderSubmit}>
              <label>
                <span>{t('inventory.labels.title')}</span>
                <input value={folderTitle} onChange={(event) => setFolderTitle(event.target.value)} maxLength={80} placeholder={t('inventory.form.folderTitlePlaceholder')} />
              </label>
              <label>
                <span>{t('inventory.labels.description')} <em>{t('inventory.labels.optional')}</em></span>
                <textarea value={folderDescription} onChange={(event) => setFolderDescription(event.target.value)} maxLength={240} placeholder={t('inventory.form.folderDescriptionPlaceholder')} />
              </label>
              <div className="inventory-folder-form__actions">
                <button type="button" className="ghost-button" onClick={closeFolderForm} disabled={folderActionId === 'folder-form'}>{t('inventory.actions.cancel')}</button>
                <button type="submit" className="secondary" disabled={folderActionId === 'folder-form'}>{folderActionId === 'folder-form' ? t('common.states.saving') : folderMode === 'edit' ? t('inventory.actions.saveFolder') : t('inventory.actions.createFolder')}</button>
              </div>
            </form>
          ) : null}

          {selectedFolder ? (
            <div className="inventory-folder-selected-card">
              <div className="inventory-folder-selected-card__header">
                <div>
                  <strong>{selectedFolder.title}</strong>
                  {selectedFolder.description ? <p>{selectedFolder.description}</p> : null}
                </div>
                <span className="semantic-badge success">{t('inventory.labels.folderItemCount', { count: selectedFolderItemIds.size })}</span>
              </div>
              <div className="inventory-folder-selected-card__actions">
                <button type="button" className="ghost-button" onClick={() => openEditFolderForm(selectedFolder)} disabled={Boolean(folderActionId)}>{t('inventory.actions.editFolder')}</button>
                <button type="button" className="ghost-button danger-button" onClick={() => { void handleDeleteFolder(selectedFolder); }} disabled={folderActionId === selectedFolder.id}>{folderActionId === selectedFolder.id ? t('common.states.working') : t('inventory.actions.deleteFolder')}</button>
              </div>
              <details className="inventory-folder-add-panel">
                <summary>{t('inventory.actions.addItemsToFolder', { items: plural })}</summary>
                {availableItemsForSelectedFolder.length ? (
                  <div className="inventory-folder-add-list">
                    {availableItemsForSelectedFolder.slice(0, 20).map((item) => (
                      <button key={item.id} type="button" onClick={() => { void handleAddItemToSelectedFolder(item); }} disabled={folderActionId === `${selectedFolder.id}:${item.id}:add`}>
                        <span>{item.title}</span>
                        <strong>{folderActionId === `${selectedFolder.id}:${item.id}:add` ? t('common.states.saving') : t('inventory.actions.addToFolder')}</strong>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="meta">{t('inventory.empty.allItemsAlreadyInFolder', { items: plural })}</p>
                )}
              </details>
            </div>
          ) : null}
        </section>
      ) : null}

      {(!auth.hydrated || loading || usingFallback || !auth.isAuthenticated) ? (
        <section className="feed-status-row inventory-library-status" aria-live="polite">
          <p>{loading ? t('inventory.messages.loadingItems', { items: plural }) : t('inventory.messages.visibleItems', { count: visibleCount, items: plural })}</p>
          {!auth.hydrated || loading ? <span className="semantic-badge instruction">{t('inventory.labels.checkingSession')}</span> : usingFallback ? <span className="semantic-badge instruction">{t('inventory.labels.starterExamples')}</span> : <span className="semantic-badge instruction">{t('inventory.labels.accountNeeded')}</span>}
        </section>
      ) : null}

      {notice ? <p className="notice-box success inventory-library-notice">{notice}</p> : null}

      {!auth.isAuthenticated && auth.hydrated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
          <h3>{t('inventory.signedOut.mineTitle', { items: plural })}</h3>
          <p>{demoDataEnabled ? t('inventory.signedOut.mineStarterBody', { items: plural }) : t('inventory.signedOut.mineBody', { items: plural })}</p>
          <Link href={`/auth?next=${encodeURIComponent(`/${kind === 'need' ? 'needs' : 'offers'}`)}`} className="button">{t('auth.actions.signIn')}</Link>
        </section>
      ) : null}

      {loading ? (
        <InventoryListSkeleton />
      ) : filteredItems.length ? (
        <div className="inventory-list">
          {filteredItems.map((item) => (
            <div className="inventory-folder-card" key={item.id}>
              <InventoryCard item={item} kind={kind} i18n={i18n} />
              {selectedFolder ? (
                <div className="inventory-folder-card__actions">
                  <button type="button" className="ghost-button" onClick={() => { void handleRemoveItemFromSelectedFolder(item); }} disabled={folderActionId === `${selectedFolder.id}:${item.id}:remove`}>
                    {folderActionId === `${selectedFolder.id}:${item.id}:remove` ? t('common.states.working') : t('inventory.actions.removeFromFolder')}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : hasSearchOrFilters && folderScopedItems.length ? (
        <section className="inventory-library-no-results">
          <strong>{t('inventory.libraryFilters.noMatchingMineTitle')}</strong>
          <p>{t('inventory.libraryFilters.noMatchingMineBody')}</p>
          <button type="button" className="button secondary" onClick={resetLibraryFilters}>{t('inventory.libraryFilters.clearAll')}</button>
        </section>
      ) : (
        <InventoryEmptyState
          title={selectedFolder ? t('inventory.empty.noFolderItems', { folder: selectedFolder.title }) : kind === 'need' ? t('inventory.empty.createFirstNeed') : t('inventory.empty.createFirstOffer')}
          body={selectedFolder
            ? t('inventory.empty.noFolderItemsBody', { items: plural })
            : helperCopy}
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
