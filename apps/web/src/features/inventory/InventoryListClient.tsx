'use client';

import Link from 'next/link';
import type { InventoryFolderDto, InventoryFolderItemDto } from '@hellowhen/contracts';
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
import { formatInventoryDate, getInventoryMetadata, getInventoryTags, inventoryStatusLabel, kindLabel, mediaSrc, normalizeInventoryList, sideClassName, sideLabel, type InventoryI18n, type InventoryItem, type InventoryKind } from './inventoryPresentation';

type InventoryListClientProps = {
  kind: InventoryKind;
};

type FolderMode = 'create' | 'edit';

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
      <span className="inventory-card__chevron" aria-hidden="true">›</span>
    </Link>
  );
}

export function InventoryListClient({ kind }: InventoryListClientProps) {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [folders, setFolders] = useState<InventoryFolderDto[]>([]);
  const [query, setQuery] = useState('');
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

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return folderScopedItems;
    return folderScopedItems.filter((item) => [item.title, item.description, item.category, getInventoryMetadata(item, i18n), ...getInventoryTags(item)].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [folderScopedItems, i18n, query]);

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

  return (
    <section className="mobile-page">
      <div className="inventory-controls">
        <label className="trade-search-field">
          <span className="sr-only">{t('common.actions.search')}</span>
          <WebIcon name="search" size={17} decorative className="trade-search-field__icon" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${t('common.actions.search')} ${plural}`} type="search" />
        </label>
        <Link href={newHref} className="trade-create-pill" aria-label={`${t('common.actions.create')} ${singular}`}>
          <WebIcon name="add" size={21} decorative />
        </Link>
      </div>

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

      <section className="feed-status-row" aria-live="polite">
        <p>{loading ? t('inventory.messages.loadingItems', { items: plural }) : t('inventory.messages.visibleItems', { count: visibleCount, items: plural })}</p>
        {!auth.hydrated || loading ? <span className="semantic-badge instruction">{t('inventory.labels.checkingSession')}</span> : usingFallback ? <span className="semantic-badge instruction">{t('inventory.labels.starterExamples')}</span> : auth.isAuthenticated ? <span className="semantic-badge success">{t('inventory.labels.liveInventory')}</span> : <span className="semantic-badge instruction">{t('inventory.labels.accountNeeded')}</span>}
      </section>

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
      ) : (
        <InventoryEmptyState
          title={selectedFolder ? t('inventory.empty.noFolderItems', { folder: selectedFolder.title }) : kind === 'need' ? t('inventory.empty.createFirstNeed') : t('inventory.empty.createFirstOffer')}
          body={selectedFolder
            ? t('inventory.empty.noFolderItemsBody', { items: plural })
            : kind === 'need'
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
