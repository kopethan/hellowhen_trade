'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PlaceDto } from '@hellowhen/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { WebIcon } from '../../components/WebIcon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlansFeatureGate } from './PlansFeatureGate';
import { resolvePlaceVisual, useResolvedPlaceVisualTheme, type PlaceVisualThemeMode } from './placeVisuals';

type PlacesManageClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
};

type PlaceFilterState = {
  mode: 'all' | 'local' | 'remote';
  category: string;
  status: 'all' | 'active' | 'draft';
};

const defaultPlaceFilters: PlaceFilterState = {
  mode: 'all',
  category: 'all',
  status: 'all',
};

function nextAuthHref(path: string) {
  return `/auth?next=${encodeURIComponent(path)}`;
}

function uniquePlaceValues(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right));
}

function placeMeta(place: PlaceDto, onlineLabel: string, inPersonLabel: string) {
  return [
    place.mode === 'remote' ? onlineLabel : inPersonLabel,
    place.category,
    place.mode === 'remote' ? place.onlineLabel || place.onlineUrl : place.areaLabel || place.addressPublicText,
  ].filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

function placeUsedInPlansCount(place: PlaceDto) {
  const value = Number((place as PlaceDto & { usedInPlansCount?: number }).usedInPlansCount ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function placeLanguageBadge(place: PlaceDto) {
  if (!place.displayLanguage?.languageCode || place.displayLanguage.source === 'exact') return null;
  return place.displayLanguage.languageCode.toUpperCase();
}

function placeMatchesQuery(place: PlaceDto, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    place.title,
    place.description,
    place.category,
    place.areaLabel,
    place.formattedAddress,
    place.addressPublicText,
    place.onlineLabel,
    place.onlineUrl,
    ...(place.tags ?? []),
  ].filter(Boolean).join(' ').toLowerCase().includes(needle);
}

function PlaceManageCard({ place, onArchive, archiving, themeMode }: { place: PlaceDto; onArchive: (place: PlaceDto) => void; archiving?: boolean; themeMode: PlaceVisualThemeMode }) {
  const { t } = useWebTranslation();
  const meta = placeMeta(place, t('places.list.badges.online'), t('places.list.badges.offline'));
  const placeVisual = resolvePlaceVisual({ media: place.media?.[0] ?? null, staticMap: place.staticMap ?? null, themeMode });
  const usedInPlansCount = placeUsedInPlansCount(place);
  const isLocked = usedInPlansCount > 0;
  return (
    <article className="place-manage-card">
      <div className="place-manage-card__main">
        <div className="place-manage-card__media" aria-hidden="true">
          {placeVisual.url ? <img src={placeVisual.url} alt="" loading="lazy" className={placeVisual.kind === 'static_map' ? 'is-static-map' : undefined} /> : <WebIcon name="location-on" size={28} decorative />}
        </div>
        <div className="place-manage-card__copy">
          <div className="place-manage-card__top">
            <span className="semantic-badge place">{t('places.list.badges.mine')}</span>
            <span className="semantic-badge muted">{place.mode === 'remote' ? t('places.list.badges.online') : t('places.list.badges.offline')}</span>
            {placeLanguageBadge(place) ? <span className="semantic-badge instruction">{placeLanguageBadge(place)}</span> : null}
            {isLocked ? <span className="semantic-badge warning">{usedInPlansCount === 1 ? t('places.list.usage.one') : t('places.list.usage.many', { count: usedInPlansCount })}</span> : null}
          </div>
          <div className="place-manage-card__body">
            <h3>{place.title}</h3>
            <p>{place.description || t('places.list.fallback.description')}</p>
            <small>{meta || t('places.list.notice.title')}</small>
            {isLocked ? <small className="place-manage-card__locked-note">{t('places.list.usage.lockedNote')}</small> : null}
          </div>
        </div>
      </div>
      <div className="place-manage-card__actions" aria-label={t('places.list.usage.manageAccessibility', { title: place.title })}>
        {isLocked ? (
          <button type="button" className="button secondary compact" disabled title={t('places.list.usage.editLockedTitle')}>{t('places.list.usage.editLocked')}</button>
        ) : (
          <Link className="button secondary compact" href={`/places/${place.id}/edit`}>{t('places.list.actions.edit')}</Link>
        )}
        <button type="button" className="button danger compact" disabled={archiving} onClick={() => onArchive(place)}>{archiving ? t('places.list.actions.deleting') : t('places.list.actions.delete')}</button>
      </div>
    </article>
  );
}

export function PlacesManageClient({ plansEnabled }: PlacesManageClientProps) {
  const router = useRouter();
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const [places, setPlaces] = useState<PlaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<PlaceFilterState>({ ...defaultPlaceFilters });
  const [archivingPlaceId, setArchivingPlaceId] = useState<string | null>(null);
  const [deleteDialogPlace, setDeleteDialogPlace] = useState<PlaceDto | null>(null);

  const createPlaceHref = auth.isAuthenticated ? '/places/new' : nextAuthHref('/places/new');
  const themeMode = useResolvedPlaceVisualTheme();

  const loadPlaces = useCallback(async () => {
    if (!auth.hydrated) return;
    if (!auth.isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.places.mine({ take: 100 });
      setPlaces((response.places ?? []).filter((place) => place.status !== 'archived'));
    } catch (caughtError) {
      setPlaces([]);
      setError(getFriendlyApiErrorMessage(caughtError, t('places.list.errors.load')));
    } finally {
      setLoading(false);
    }
  }, [auth.hydrated, auth.isAuthenticated, t]);

  useEffect(() => {
    void loadPlaces();
  }, [loadPlaces]);

  const sortedPlaces = useMemo(() => [...places].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()), [places]);
  const categoryOptions = useMemo(() => uniquePlaceValues(sortedPlaces.map((place) => place.category)), [sortedPlaces]);
  const activeFilterCount = Number(filters.mode !== 'all') + Number(filters.category !== 'all') + Number(filters.status !== 'all');
  const hasSearchOrFilters = Boolean(query.trim() || activeFilterCount);
  const visiblePlaces = useMemo(() => sortedPlaces.filter((place) => {
    if (!placeMatchesQuery(place, query)) return false;
    if (filters.mode !== 'all' && place.mode !== filters.mode) return false;
    if (filters.category !== 'all' && place.category !== filters.category) return false;
    if (filters.status !== 'all' && place.status !== filters.status) return false;
    return true;
  }), [filters, query, sortedPlaces]);

  function goBackFromPlaces() {
    if (typeof window !== 'undefined' && document.referrer) {
      try {
        if (new URL(document.referrer).origin === window.location.origin) {
          router.back();
          return;
        }
      } catch {
        // Fall through to the stable Plans destination.
      }
    }
    router.push('/plans');
  }

  function resetPlaceFilters() {
    setQuery('');
    setFilters({ ...defaultPlaceFilters });
  }

  async function archivePlace(place: PlaceDto) {
    setArchivingPlaceId(place.id);
    setError('');
    setMessage('');
    try {
      await api.places.archive(place.id);
      setPlaces((current) => current.filter((item) => item.id !== place.id));
      setMessage(t('places.list.messages.removed', { title: place.title }));
      setDeleteDialogPlace(null);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('places.list.errors.delete')));
    } finally {
      setArchivingPlaceId(null);
    }
  }

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page web-app-page inventory-library-page places-library-page">
        <header className="inventory-library-header">
          <div className="inventory-library-header__title">
            <button type="button" className="web-back-button inventory-library-back" aria-label={t('navigation.goBack')} onClick={goBackFromPlaces}>
              <WebIcon name="back" size={21} decorative />
            </button>
            <h1>{t('places.list.headers.places')}</h1>
          </div>
          <div className="inventory-library-header__actions">
            <button
              type="button"
              className={searchOpen || query ? 'inventory-library-action is-active' : 'inventory-library-action'}
              aria-label={t('places.list.filters.searchMine')}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((current) => !current)}
              disabled={!places.length && !query}
            >
              <WebIcon name="search" size={20} decorative />
            </button>
            <button
              type="button"
              className={filtersOpen || activeFilterCount ? 'inventory-library-action is-active' : 'inventory-library-action'}
              aria-label={t('places.list.filters.openFilters')}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((current) => !current)}
              disabled={!places.length}
            >
              <WebIcon name="filter" size={20} decorative />
              {activeFilterCount ? <span className="inventory-library-action__badge">{activeFilterCount}</span> : null}
            </button>
            <Link href={createPlaceHref} className="inventory-library-action inventory-library-action--create" aria-label={t('places.list.actions.create')}>
              <WebIcon name="add" size={23} decorative />
            </Link>
          </div>
        </header>

        <nav className="inventory-library-segments" aria-label={`${t('places.list.headers.places')} ${t('common.librarySegments.mine')} / ${t('common.librarySegments.explore')}`}>
          <span className="is-active" aria-current="page">{t('common.librarySegments.mine')}</span>
          <Link href="/explore?type=place">{t('common.librarySegments.explore')}</Link>
        </nav>

        {searchOpen ? (
          <label className="inventory-library-search">
            <WebIcon name="search" size={18} decorative />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('places.list.filters.searchMine')} type="search" />
            {query ? <button type="button" onClick={() => setQuery('')} aria-label={t('places.list.filters.clearSearch')}>×</button> : null}
          </label>
        ) : null}

        {filtersOpen ? (
          <section className="inventory-library-filter-panel" aria-label={t('places.list.filters.openFilters')}>
            <div className="inventory-library-filter-panel__header">
              <div>
                <strong>{t('places.list.filters.title')}</strong>
                <p>{t('places.list.filters.mineBody')}</p>
              </div>
              <button type="button" className="ghost-button" onClick={() => setFilters({ ...defaultPlaceFilters })} disabled={!activeFilterCount}>{t('places.list.filters.reset')}</button>
            </div>
            <div className="inventory-library-filter-grid">
              <label>
                <span>{t('places.list.filters.mode')}</span>
                <select value={filters.mode} onChange={(event) => setFilters((current) => ({ ...current, mode: event.target.value as PlaceFilterState['mode'] }))}>
                  <option value="all">{t('places.list.filters.allModes')}</option>
                  <option value="local">{t('places.list.filters.offline')}</option>
                  <option value="remote">{t('places.list.filters.online')}</option>
                </select>
              </label>
              <label>
                <span>{t('places.list.filters.category')}</span>
                <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
                  <option value="all">{t('places.list.filters.allCategories')}</option>
                  {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label>
                <span>{t('places.list.filters.status')}</span>
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as PlaceFilterState['status'] }))}>
                  <option value="all">{t('places.list.filters.allStatuses')}</option>
                  <option value="active">{t('places.list.filters.active')}</option>
                  <option value="draft">{t('places.list.filters.draft')}</option>
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {!auth.hydrated ? <section className="mobile-card"><p className="meta">{t('common.states.loading')}</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft places-library-auth">
            <h3>{t('plans.create.intro.loginRequired')}</h3>
            <p>{t('places.list.authBody')}</p>
            <Link className="button primary" href={nextAuthHref('/places')}>{t('plans.create.intro.login')}</Link>
          </section>
        ) : null}

        {auth.isAuthenticated ? (
          <>
            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            {loading ? <section className="mobile-card"><p className="meta">{t('places.list.loading')}</p></section> : null}
            {!loading && sortedPlaces.length === 0 ? (
              <section className="places-library-empty">
                <span className="places-library-empty__icon"><WebIcon name="location-on" size={28} decorative /></span>
                <strong>{t('places.list.empty.mineTitle')}</strong>
                <p>{t('places.list.empty.mineBody')}</p>
                <Link className="places-library-empty__action" href={createPlaceHref}>{t('places.list.actions.create')}</Link>
              </section>
            ) : null}
            {!loading && sortedPlaces.length > 0 && visiblePlaces.length === 0 ? (
              <section className="places-library-empty places-library-empty--filtered">
                <span className="places-library-empty__icon"><WebIcon name="search" size={26} decorative /></span>
                <strong>{t('places.list.empty.filteredTitle')}</strong>
                <p>{t('places.list.empty.filteredMineBody')}</p>
                {hasSearchOrFilters ? <button type="button" className="places-library-empty__action" onClick={resetPlaceFilters}>{t('places.list.filters.clearAll')}</button> : null}
              </section>
            ) : null}
            {!loading && visiblePlaces.length > 0 ? (
              <>
                <section className="place-manage-note places-library-note">
                  <strong>{t('places.list.notice.title')}</strong>
                  <span>{t('places.list.notice.body')}</span>
                </section>
                <section className="place-manage-list" aria-label={t('places.list.messages.title')}>
                  {visiblePlaces.map((place) => (
                    <PlaceManageCard
                      key={place.id}
                      place={place}
                      onArchive={setDeleteDialogPlace}
                      archiving={archivingPlaceId === place.id}
                      themeMode={themeMode}
                    />
                  ))}
                </section>
              </>
            ) : null}
          </>
        ) : null}
        <ConfirmDialog
          open={Boolean(deleteDialogPlace)}
          eyebrow={t('places.list.notice.title')}
          title={t('places.list.confirmDelete.title')}
          body={t('places.list.confirmDelete.body')}
          variant="danger"
          confirmLabel={t('places.list.confirmDelete.confirm')}
          loading={Boolean(deleteDialogPlace && archivingPlaceId === deleteDialogPlace.id)}
          onCancel={() => {
            if (archivingPlaceId) return;
            setDeleteDialogPlace(null);
          }}
          onConfirm={async () => {
            if (!deleteDialogPlace) return;
            await archivePlace(deleteDialogPlace);
          }}
        />
      </main>
    </PlansFeatureGate>
  );
}
