'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { type SavedCollectionDto, type SavedItemDto, type SavedItemType, type SavedLibrarySort } from '@hellowhen/contracts';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { formatDateTime } from './accountPresentation';

type SavedFilter = 'all' | SavedItemType;
type CollectionEditorMode = 'create' | 'edit';

type SavedTab = {
  value: SavedFilter;
  labelKey: string;
};

type SavedLibraryClientProps = {
  initialCollectionId?: string;
};

const savedTabs: SavedTab[] = [
  { value: 'all', labelKey: 'account.saved.filters.all' },
  { value: 'trade', labelKey: 'account.saved.filters.trades' },
  { value: 'need', labelKey: 'account.saved.filters.needs' },
  { value: 'offer', labelKey: 'account.saved.filters.offers' },
  { value: 'user', labelKey: 'account.saved.filters.people' },
];

const savedSortOptions: { value: SavedLibrarySort; labelKey: string }[] = [
  { value: 'newest', labelKey: 'account.saved.sort.newest' },
  { value: 'oldest', labelKey: 'account.saved.sort.oldest' },
];

function itemTargetId(item: SavedItemDto) {
  return item.tradeId ?? item.needId ?? item.offerId ?? item.targetUserId ?? '';
}

function itemIsUnavailable(item: SavedItemDto) {
  return !itemTargetId(item);
}

function itemHref(item: SavedItemDto) {
  switch (item.itemType) {
    case 'trade':
      return item.tradeId ? `/trades/${item.tradeId}` : '';
    case 'need':
      return item.needId ? `/needs/${item.needId}` : '';
    case 'offer':
      return item.offerId ? `/offers/${item.offerId}` : '';
    case 'user':
      return item.targetUserId ? `/users/${item.targetUserId}` : '';
  }
}

function itemTitle(item: SavedItemDto, t: (key: string) => string) {
  switch (item.itemType) {
    case 'trade':
      return item.trade?.title ?? t('account.saved.unavailable.trade');
    case 'need':
      return item.need?.title ?? t('account.saved.unavailable.need');
    case 'offer':
      return item.offer?.title ?? t('account.saved.unavailable.offer');
    case 'user': {
      const profile = item.targetUser?.profile;
      return profile?.displayName ?? (profile?.handle ? `@${profile.handle}` : t('account.saved.unavailable.user'));
    }
  }
}

function itemBody(item: SavedItemDto, t: (key: string) => string) {
  switch (item.itemType) {
    case 'trade':
      return item.trade?.description || item.trade?.status || t('account.saved.itemBodies.trade');
    case 'need':
      return item.need?.description || t('account.saved.itemBodies.need');
    case 'offer':
      return item.offer?.description || t('account.saved.itemBodies.offer');
    case 'user': {
      const profile = item.targetUser?.profile;
      if (profile?.handle) return `@${profile.handle}`;
      if (profile?.countryCode) return profile.countryCode;
      return t('account.saved.itemBodies.user');
    }
  }
}

function itemTypeClass(itemType: SavedItemType) {
  if (itemType === 'need') return 'semantic-badge need';
  if (itemType === 'offer') return 'semantic-badge offer';
  if (itemType === 'trade') return 'semantic-badge trade';
  return 'semantic-badge instruction';
}

function collectionItemCount(collection: SavedCollectionDto) {
  return Array.isArray(collection.items) ? collection.items.length : 0;
}

function collectionHasSavedItem(collection: SavedCollectionDto, savedItemId: string) {
  return (collection.items ?? []).some((item) => item.savedItemId === savedItemId);
}

export function SavedLibraryClient({ initialCollectionId }: SavedLibraryClientProps = {}) {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [filter, setFilter] = useState<SavedFilter>('all');
  const [sort, setSort] = useState<SavedLibrarySort>('newest');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(initialCollectionId ?? null);
  const [items, setItems] = useState<SavedItemDto[]>([]);
  const [collections, setCollections] = useState<SavedCollectionDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [collectionBusyId, setCollectionBusyId] = useState<string | null>(null);
  const [managingItem, setManagingItem] = useState<SavedItemDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [collectionEditorMode, setCollectionEditorMode] = useState<CollectionEditorMode | null>(null);
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionTitleError, setCollectionTitleError] = useState<string | null>(null);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId],
  );

  async function load({ append = false, cursor }: { append?: boolean; cursor?: string } = {}) {
    if (!auth.hydrated || !auth.isAuthenticated) {
      setLoading(false);
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [savedResponse, collectionsResponse] = await Promise.all([
        api.saved.list({
          take: 50,
          sort,
          ...(filter !== 'all' ? { itemType: filter } : {}),
          ...(selectedCollectionId && betaFeatures.savedCollectionsEnabled ? { collectionId: selectedCollectionId } : {}),
          ...(query ? { q: query } : {}),
          ...(cursor ? { cursor } : {}),
        }),
        betaFeatures.savedCollectionsEnabled ? api.saved.collections() : Promise.resolve({ collections: [] }),
      ]);
      setItems((current) => append ? [...current, ...(savedResponse.items ?? [])] : (savedResponse.items ?? []));
      setNextCursor(savedResponse.nextCursor ?? null);
      const nextCollections = collectionsResponse.collections ?? [];
      setCollections(nextCollections);
      setSelectedCollectionId((current) => (current && !nextCollections.some((collection) => collection.id === current) ? null : current));
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, t('account.saved.loadError')));
      if (!append) {
        setItems([]);
        setNextCursor(null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => { void load(); }, [auth.hydrated, auth.isAuthenticated, filter, selectedCollectionId, query, sort]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(searchInput.trim());
    setNextCursor(null);
  }

  function clearSearch() {
    setSearchInput('');
    setQuery('');
    setNextCursor(null);
  }

  function updateSort(nextSort: SavedLibrarySort) {
    setSort(nextSort);
    setNextCursor(null);
  }

  function openCreateCollection() {
    if (!betaFeatures.savedCollectionsEnabled) return;
    setMessage(null);
    setError(null);
    setCollectionTitleError(null);
    setCollectionTitle('');
    setCollectionDescription('');
    setCollectionEditorMode('create');
  }

  function openEditCollection(collection: SavedCollectionDto) {
    if (!betaFeatures.savedCollectionsEnabled) return;
    setMessage(null);
    setError(null);
    setCollectionTitleError(null);
    setCollectionTitle(collection.title);
    setCollectionDescription(collection.description ?? '');
    setCollectionEditorMode('edit');
  }

  function closeCollectionEditor() {
    setCollectionEditorMode(null);
    setCollectionTitle('');
    setCollectionDescription('');
    setCollectionTitleError(null);
  }

  async function saveCollection(event?: FormEvent<HTMLFormElement>) {
    if (!betaFeatures.savedCollectionsEnabled) return;
    event?.preventDefault();
    const title = collectionTitle.trim();
    const description = collectionDescription.trim();
    if (!title) {
      setCollectionTitleError(t('account.saved.collections.titleRequired'));
      return;
    }

    setCollectionTitleError(null);
    setCollectionBusyId('collection-save');
    setError(null);
    try {
      if (collectionEditorMode === 'edit' && selectedCollection) {
        const response = await api.saved.updateCollection(selectedCollection.id, { title, description: description || null });
        setCollections((current) => current.map((collection) => collection.id === response.collection.id ? response.collection : collection));
        setMessage(t('account.saved.collections.updated', { title: response.collection.title }));
      } else {
        const response = await api.saved.createCollection({ title, description: description || undefined });
        setCollections((current) => [response.collection, ...current.filter((collection) => collection.id !== response.collection.id)]);
        setSelectedCollectionId(response.collection.id);
        setMessage(t('account.saved.collections.created', { title: response.collection.title }));
      }
      closeCollectionEditor();
      void load();
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, t('account.saved.collections.saveError')));
    } finally {
      setCollectionBusyId(null);
    }
  }

  async function deleteCollection(collection: SavedCollectionDto) {
    if (!betaFeatures.savedCollectionsEnabled) return;
    const confirmed = window.confirm(t('account.saved.collections.deleteConfirm', { title: collection.title }));
    if (!confirmed) return;

    setCollectionBusyId(`delete-${collection.id}`);
    setError(null);
    try {
      await api.saved.removeCollection(collection.id);
      setCollections((current) => current.filter((entry) => entry.id !== collection.id));
      if (selectedCollectionId === collection.id) setSelectedCollectionId(null);
      setManagingItem(null);
      setMessage(t('account.saved.collections.deleted', { title: collection.title }));
      void load();
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, t('account.saved.collections.deleteError')));
    } finally {
      setCollectionBusyId(null);
    }
  }

  async function removeSavedItem(savedItemId: string) {
    setUpdatingId(savedItemId);
    setError(null);
    try {
      await api.saved.remove(savedItemId);
      setItems((current) => current.filter((item) => item.id !== savedItemId));
      setCollections((current) => current.map((collection) => ({
        ...collection,
        items: collection.items?.filter((item) => item.savedItemId !== savedItemId),
      })));
      setManagingItem((current) => current?.id === savedItemId ? null : current);
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, t('account.saved.removeError')));
    } finally {
      setUpdatingId(null);
    }
  }

  async function addItemToCollection(collection: SavedCollectionDto, item: SavedItemDto) {
    if (!betaFeatures.savedCollectionsEnabled) return;
    setCollectionBusyId(`item-${collection.id}-${item.id}`);
    setError(null);
    try {
      await api.saved.addCollectionItem(collection.id, { savedItemId: item.id });
      setMessage(t('account.saved.collections.itemAdded', { title: itemTitle(item, t), collection: collection.title }));
      await load();
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, t('account.saved.collections.itemAddError')));
    } finally {
      setCollectionBusyId(null);
    }
  }

  async function removeItemFromCollection(collection: SavedCollectionDto, item: SavedItemDto) {
    if (!betaFeatures.savedCollectionsEnabled) return;
    setCollectionBusyId(`item-${collection.id}-${item.id}`);
    setError(null);
    try {
      await api.saved.removeCollectionItem(collection.id, item.id);
      setMessage(t('account.saved.collections.itemRemoved', { title: itemTitle(item, t), collection: collection.title }));
      if (selectedCollectionId === collection.id) {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      }
      await load();
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, t('account.saved.collections.itemRemoveError')));
    } finally {
      setCollectionBusyId(null);
    }
  }

  if (!auth.hydrated || loading) {
    return <section className="mobile-card mobile-card--soft"><p>{t('account.saved.loading')}</p></section>;
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
        <h3>{t('account.saved.signedOutTitle')}</h3>
        <p>{t('account.saved.signedOutBody')}</p>
        <Link href="/auth?next=/account/saved" className="button primary">{t('common.actions.loginOrRegister')}</Link>
      </section>
    );
  }

  const hasItems = items.length > 0;
  const hasCollections = collections.length > 0;
  const searchActive = Boolean(query);
  const plusPublic = betaFeatures.plusSubscriptionFeatures.plusPublic;
  const collectionsEnabled = betaFeatures.savedCollectionsEnabled;
  const collectionEditorTitle = collectionEditorMode === 'edit' ? t('account.saved.collections.editTitle') : t('account.saved.collections.createTitle');

  return (
    <div className="saved-library-panel">
      <section className="saved-library-summary-card">
        <div className="saved-library-summary-card__icon" aria-hidden="true">
          <WebIcon name="save" size={24} decorative />
        </div>
        <div>
          <span className="semantic-badge proposal">{t('account.saved.privateBadge')}</span>
          <h3>{t('account.saved.summaryTitle')}</h3>
          <p>{t('account.saved.summaryBody')}</p>
        </div>
      </section>

      <section className="saved-library-plus-card">
        <span className="semantic-badge success">{t('account.saved.plus.badge')}</span>
        <div>
          <h3>{t('account.saved.plus.title')}</h3>
          <p>{t('account.saved.plus.body')}</p>
        </div>
        {plusPublic ? <Link href="/account/plans" className="button secondary">{t('account.saved.plus.action')}</Link> : <span className="saved-library-plus-card__note">{t('account.saved.plus.comingSoon')}</span>}
      </section>

      <section className="saved-library-toolbar" aria-label={t('account.saved.filtersLabel')}>
        <div className="saved-library-toolbar__header">
          <div>
            <strong>{t('account.saved.collections.title')}</strong>
            <span>{t('account.saved.collections.manageBody')}</span>
          </div>
          {collectionsEnabled ? <button type="button" className="button secondary" onClick={openCreateCollection}>{t('account.saved.collections.create')}</button> : null}
        </div>

        <form className="saved-library-search-form" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="saved-library-search">{t('account.saved.search.label')}</label>
          <div className="saved-library-search-form__input">
            <WebIcon name="search" size={17} decorative />
            <input
              id="saved-library-search"
              value={searchInput}
              maxLength={80}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('account.saved.search.placeholder')}
            />
          </div>
          <button type="submit" className="button secondary">{t('common.actions.search')}</button>
          {searchInput || query ? <button type="button" className="ghost-button" onClick={clearSearch}>{t('account.saved.search.clear')}</button> : null}
        </form>

        <div className="saved-library-sort-row" aria-label={t('account.saved.sort.label')}>
          <span>{t('account.saved.sort.label')}</span>
          <div>
            {savedSortOptions.map((option) => (
              <button key={option.value} type="button" className={sort === option.value ? 'is-active' : ''} aria-pressed={sort === option.value} onClick={() => updateSort(option.value)}>
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="saved-library-tabs" role="tablist" aria-label={t('account.saved.filtersLabel')}>
          {savedTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={filter === tab.value ? 'is-active' : ''}
              aria-pressed={filter === tab.value}
              onClick={() => { setFilter(tab.value); setNextCursor(null); }}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {collectionsEnabled ? <div className="saved-library-collections-strip" aria-label={t('account.saved.collectionsLabel')}>
          <button
            type="button"
            className={!selectedCollectionId ? 'is-active' : ''}
            aria-pressed={!selectedCollectionId}
            onClick={() => { setSelectedCollectionId(null); setNextCursor(null); }}
          >
            <span>{t('account.saved.collections.allSaved')}</span>
          </button>
          {collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              className={selectedCollectionId === collection.id ? 'is-active' : ''}
              aria-pressed={selectedCollectionId === collection.id}
              onClick={() => { setSelectedCollectionId(collection.id); setNextCursor(null); }}
            >
              <span>{collection.title}</span>
              <strong>{collectionItemCount(collection)}</strong>
            </button>
          ))}
        </div> : null}
      </section>

      {collectionsEnabled && collectionEditorMode ? (
        <form className="saved-library-collection-editor" onSubmit={(event) => { void saveCollection(event); }}>
          <div className="saved-library-collection-editor__header">
            <span className="semantic-badge instruction">{t('account.saved.collections.collection')}</span>
            <h3>{collectionEditorTitle}</h3>
            <p>{t('account.saved.collections.editorBody')}</p>
          </div>
          <label>
            <span>{t('account.saved.collections.titleLabel')}</span>
            <input value={collectionTitle} maxLength={80} onChange={(event) => setCollectionTitle(event.target.value)} placeholder={t('account.saved.collections.titlePlaceholder')} />
          </label>
          {collectionTitleError ? <p className="field-error">{collectionTitleError}</p> : null}
          <label>
            <span>{t('account.saved.collections.descriptionLabel')}</span>
            <textarea value={collectionDescription} maxLength={240} onChange={(event) => setCollectionDescription(event.target.value)} placeholder={t('account.saved.collections.descriptionPlaceholder')} rows={3} />
          </label>
          <div className="saved-library-collection-editor__actions">
            <button type="button" className="button secondary" onClick={closeCollectionEditor}>{t('common.actions.cancel')}</button>
            <button type="submit" className="button primary" disabled={collectionBusyId === 'collection-save'}>{collectionBusyId === 'collection-save' ? t('common.states.working') : t('common.actions.save')}</button>
          </div>
        </form>
      ) : null}

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {collectionsEnabled && !selectedCollection && hasCollections ? (
        <section className="saved-library-collection-overview">
          <div className="saved-library-collection-overview__header">
            <div>
              <span className="semantic-badge instruction">{t('account.saved.collections.title')}</span>
              <h3>{t('account.saved.collections.overviewTitle')}</h3>
              <p>{t('account.saved.collections.overviewBody')}</p>
            </div>
            {collectionsEnabled ? <button type="button" className="ghost-button" onClick={openCreateCollection}>{t('account.saved.collections.create')}</button> : null}
          </div>
          <div className="saved-library-collection-grid">
            {collections.slice(0, 6).map((collection) => (
              <button key={collection.id} type="button" className="saved-library-collection-card" onClick={() => { setSelectedCollectionId(collection.id); setNextCursor(null); }}>
                <strong>{collection.title}</strong>
                <span>{collection.description || t('account.saved.collections.defaultBody')}</span>
                <small>{t('account.saved.collections.itemCount', { count: collectionItemCount(collection) })}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {collectionsEnabled && selectedCollection ? (
        <section className="saved-library-selected-collection">
          <span className="semantic-badge instruction">{t('account.saved.collections.collection')}</span>
          <div>
            <h3>{selectedCollection.title}</h3>
            <p>{selectedCollection.description || t('account.saved.collections.defaultBody')}</p>
          </div>
          <div className="saved-library-selected-collection__actions">
            <button type="button" className="ghost-button" onClick={() => openEditCollection(selectedCollection)}>{t('common.actions.edit')}</button>
            <button type="button" className="ghost-button danger" disabled={collectionBusyId === `delete-${selectedCollection.id}`} onClick={() => { void deleteCollection(selectedCollection); }}>
              {collectionBusyId === `delete-${selectedCollection.id}` ? t('common.states.working') : t('account.saved.collections.delete')}
            </button>
          </div>
        </section>
      ) : null}

      {collectionsEnabled && managingItem ? (
        <section className="saved-library-item-collections-manager">
          <div className="saved-library-item-collections-manager__header">
            <div>
              <span className={itemTypeClass(managingItem.itemType)}>{t(`account.saved.types.${managingItem.itemType}`)}</span>
              <h3>{t('account.saved.collections.manageItemTitle', { title: itemTitle(managingItem, t) })}</h3>
              <p>{t('account.saved.collections.manageItemBody')}</p>
            </div>
            <button type="button" className="ghost-button" onClick={() => setManagingItem(null)}>{t('common.actions.close')}</button>
          </div>
          {collectionsEnabled && !hasCollections ? (
            <p>{t('account.saved.collections.createFirst')}</p>
          ) : (
            <div className="saved-library-collection-membership-list">
              {collections.map((collection) => {
                const inCollection = collectionHasSavedItem(collection, managingItem.id);
                const busyKey = `item-${collection.id}-${managingItem.id}`;
                return (
                  <div key={collection.id} className="saved-library-collection-membership-row">
                    <div>
                      <strong>{collection.title}</strong>
                      <span>{collection.description || t('account.saved.collections.defaultBody')}</span>
                    </div>
                    <button
                      type="button"
                      className={inCollection ? 'ghost-button danger' : 'button secondary'}
                      disabled={collectionBusyId === busyKey}
                      onClick={() => { void (inCollection ? removeItemFromCollection(collection, managingItem) : addItemToCollection(collection, managingItem)); }}
                    >
                      {collectionBusyId === busyKey ? t('common.states.working') : (inCollection ? t('account.saved.collections.removeFromCollection') : t('account.saved.collections.addToCollection'))}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <p className="saved-library-result-summary">
        {searchActive ? t('account.saved.search.resultsFor', { count: items.length, query }) : t('account.saved.resultSummary', { count: items.length })}
      </p>

      {!hasItems ? (
        <section className="saved-library-empty-state">
          <WebIcon name="save" size={32} decorative />
          <h3>{searchActive ? t('account.saved.search.noResultsTitle') : (selectedCollection ? t('account.saved.emptyCollectionTitle') : t('account.saved.emptyTitle'))}</h3>
          <p>{searchActive ? t('account.saved.search.noResultsBody') : (selectedCollection ? t('account.saved.emptyCollectionBody') : t('account.saved.emptyBody'))}</p>
          <Link href="/trades" className="button primary">{t('account.saved.browseTrades')}</Link>
        </section>
      ) : (
        <div className="saved-library-list">
          {items.map((item) => {
            const href = itemHref(item);
            const targetId = itemTargetId(item);
            return (
              <article key={item.id} className={`saved-library-card${itemIsUnavailable(item) ? ' saved-library-card--unavailable' : ''}`}>
                <div className="saved-library-card__main">
                  <span className={itemTypeClass(item.itemType)}>{t(`account.saved.types.${item.itemType}`)}</span>
                  <h3>{itemTitle(item, t)}</h3>
                  <p>{itemBody(item, t)}</p>
                  <div className="saved-library-card__meta">
                    <span>{t('account.saved.savedAt', { date: formatDateTime(item.createdAt, language) })}</span>
                    {targetId ? <span>{t('account.saved.targetId', { id: targetId.slice(0, 8) })}</span> : <span>{t('account.saved.unavailable.badge')}</span>}
                  </div>
                  {item.collections?.length ? (
                    <div className="saved-library-card__collections" aria-label={t('account.saved.collectionsLabel')}>
                      {item.collections.map((collection) => <span key={collection.id}>{collection.title}</span>)}
                    </div>
                  ) : null}
                </div>
                <div className="saved-library-card__actions">
                  {href ? <Link href={href} className="button secondary">{t('common.actions.open')}</Link> : <span className="saved-library-unavailable-chip">{t('account.saved.unavailable.badge')}</span>}
                  {collectionsEnabled ? <button className="button secondary" type="button" onClick={() => setManagingItem(item)}>{t('account.saved.collections.manage')}</button> : null}
                  <button className="ghost-button" type="button" disabled={updatingId === item.id} onClick={() => { void removeSavedItem(item.id); }}>
                    {updatingId === item.id ? t('common.states.working') : t('common.actions.remove')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {nextCursor ? (
        <button className="button secondary full" type="button" disabled={loadingMore} onClick={() => { void load({ append: true, cursor: nextCursor }); }}>
          {loadingMore ? t('common.states.loading') : t('account.saved.loadMore')}
        </button>
      ) : null}

      {collectionsEnabled && !hasCollections ? (
        <section className="mobile-card mobile-card--soft saved-library-collections-preview">
          <span className="semantic-badge instruction">{t('account.saved.collections.title')}</span>
          <h3>{t('account.saved.collections.emptyTitle')}</h3>
          <p>{t('account.saved.collections.emptyBody')}</p>
          {collectionsEnabled ? <button type="button" className="button secondary" onClick={openCreateCollection}>{t('account.saved.collections.create')}</button> : null}
        </section>
      ) : null}
    </div>
  );
}
