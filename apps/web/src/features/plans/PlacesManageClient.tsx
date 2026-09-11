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
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { resolvePlaceVisual, useResolvedPlaceVisualTheme, type PlaceVisualThemeMode } from './placeVisuals';

type PlacesManageClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
};

function nextAuthHref(path: string) {
  return `/auth?next=${encodeURIComponent(path)}`;
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

export function PlacesManageClient({ plansEnabled, plansVisible }: PlacesManageClientProps) {
  const router = useRouter();
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const [places, setPlaces] = useState<PlaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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
      <main className="mobile-page plans-page places-manage-page">
        <section className="page-intro plan-create-intro place-create-intro">
          <div>
            <PlansInternalBadge plansVisible={plansVisible} />
            <h2>{t('places.list.messages.title')}</h2>
            <p>{t('places.list.notice.body')}</p>
          </div>
          <div className="cta-row place-manage-header-actions">
            <button type="button" className="button secondary" onClick={() => router.push('/plans')}>{t('plans.create.intro.backToPlans')}</button>
            <Link className="button primary" href={createPlaceHref}>{t('places.list.actions.create')}</Link>
          </div>
        </section>

        {!auth.hydrated ? <section className="mobile-card"><p className="meta">{t('common.states.loading')}</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <h3>{t('plans.create.intro.loginRequired')}</h3>
            <p>{t('places.list.authBody')}</p>
            <Link className="button primary" href={nextAuthHref('/places')}>{t('plans.create.intro.login')}</Link>
          </section>
        ) : null}

        {auth.isAuthenticated ? (
          <>
            <section className="mobile-card mobile-card--soft place-manage-note">
              <strong>{t('places.list.notice.title')}</strong>
              <span>{t('places.list.notice.body')}</span>
            </section>
            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            {loading ? <section className="mobile-card"><p className="meta">{t('places.list.loading')}</p></section> : null}
            {!loading && sortedPlaces.length === 0 ? (
              <section className="inventory-empty-state">
                <span className="inventory-empty-state__plus">+</span>
                <strong>{t('places.list.empty.mineTitle')}</strong>
                <span>{t('places.list.empty.mineBody')}</span>
                <Link className="button secondary" href={createPlaceHref}>{t('places.list.actions.create')}</Link>
              </section>
            ) : null}
            <section className="place-manage-list" aria-label={t('places.list.messages.title')}>
              {sortedPlaces.map((place) => (
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
