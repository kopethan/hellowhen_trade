'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PlaceDto } from '@hellowhen/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { WebIcon } from '../../components/WebIcon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { planMediaSrc } from './plansPresentation';

type PlacesManageClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
};

function nextAuthHref(path: string) {
  return `/auth?next=${encodeURIComponent(path)}`;
}

function placeMeta(place: PlaceDto) {
  return [
    place.mode === 'remote' ? 'Online' : 'Offline',
    place.category,
    place.mode === 'remote' ? place.onlineLabel || place.onlineUrl : place.areaLabel || place.addressPublicText,
  ].filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

function placeUsedInPlansCount(place: PlaceDto) {
  const value = Number((place as PlaceDto & { usedInPlansCount?: number }).usedInPlansCount ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function placeUsageLabel(count: number) {
  return count === 1 ? 'Used in 1 Plan' : `Used in ${count} Plans`;
}

function PlaceManageCard({ place, onArchive, archiving }: { place: PlaceDto; onArchive: (place: PlaceDto) => void; archiving?: boolean }) {
  const meta = placeMeta(place);
  const imageSrc = planMediaSrc(place.media?.[0] ?? null);
  const usedInPlansCount = placeUsedInPlansCount(place);
  const isLocked = usedInPlansCount > 0;
  return (
    <article className="place-manage-card">
      <div className="place-manage-card__main">
        <div className="place-manage-card__media" aria-hidden="true">
          {imageSrc ? <img src={imageSrc} alt="" loading="lazy" /> : <WebIcon name="location-on" size={28} decorative />}
        </div>
        <div className="place-manage-card__copy">
          <div className="place-manage-card__top">
            <span className="semantic-badge place">My Place</span>
            <span className="semantic-badge muted">{place.mode === 'remote' ? 'Online' : 'Offline'}</span>
            {isLocked ? <span className="semantic-badge warning">{placeUsageLabel(usedInPlansCount)}</span> : null}
          </div>
          <div className="place-manage-card__body">
            <h3>{place.title}</h3>
            <p>{place.description || 'Reusable Place for future Plans.'}</p>
            <small>{meta || 'Private reusable Place'}</small>
            {isLocked ? <small className="place-manage-card__locked-note">Already used Places are locked so old Plans keep the saved details.</small> : null}
          </div>
        </div>
      </div>
      <div className="place-manage-card__actions" aria-label={`Manage ${place.title}`}>
        {isLocked ? (
          <button type="button" className="button secondary compact" disabled title="This Place is already used in a Plan.">Edit locked</button>
        ) : (
          <Link className="button secondary compact" href={`/places/${place.id}/edit`}>Edit</Link>
        )}
        <button type="button" className="button danger compact" disabled={archiving} onClick={() => onArchive(place)}>{archiving ? 'Deleting...' : 'Delete'}</button>
      </div>
    </article>
  );
}

export function PlacesManageClient({ plansEnabled, plansVisible }: PlacesManageClientProps) {
  const router = useRouter();
  const auth = useWebAuth();
  const [places, setPlaces] = useState<PlaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [archivingPlaceId, setArchivingPlaceId] = useState<string | null>(null);
  const [deleteDialogPlace, setDeleteDialogPlace] = useState<PlaceDto | null>(null);

  const createPlaceHref = auth.isAuthenticated ? '/places/new' : nextAuthHref('/places/new');

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
      setError(getFriendlyApiErrorMessage(caughtError, 'Could not load My Places.'));
    } finally {
      setLoading(false);
    }
  }, [auth.hydrated, auth.isAuthenticated]);

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
      setMessage(`${place.title} was removed from My Places.`);
      setDeleteDialogPlace(null);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, 'Could not delete Place.'));
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
            <h2>My Places</h2>
            <p>Edit saved Places or delete ones you no longer want in future Plan pickers.</p>
          </div>
          <div className="cta-row place-manage-header-actions">
            <button type="button" className="button secondary" onClick={() => router.push('/plans')}>Back to Plans</button>
            <Link className="button primary" href={createPlaceHref}>Create Place</Link>
          </div>
        </section>

        {!auth.hydrated ? <section className="mobile-card"><p className="meta">Checking session...</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <h3>Log in required</h3>
            <p>Create, edit, and delete private reusable Places after signing in.</p>
            <Link className="button primary" href={nextAuthHref('/places')}>Log in</Link>
          </section>
        ) : null}

        {auth.isAuthenticated ? (
          <>
            <section className="mobile-card mobile-card--soft place-manage-note">
              <strong>Safe delete</strong>
              <span>Deleting a Place archives it from My Places and future pickers. Places already used in Plans are locked for editing, and old Plans still show the saved snapshot.</span>
            </section>
            {message ? <p className="success-message">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            {loading ? <section className="mobile-card"><p className="meta">Loading My Places...</p></section> : null}
            {!loading && sortedPlaces.length === 0 ? (
              <section className="inventory-empty-state">
                <span className="inventory-empty-state__plus">+</span>
                <strong>No Places yet</strong>
                <span>Create reusable Places first, then pick them while creating a Plan.</span>
                <Link className="button secondary" href={createPlaceHref}>Create Place</Link>
              </section>
            ) : null}
            <section className="place-manage-list" aria-label="My Places">
              {sortedPlaces.map((place) => (
                <PlaceManageCard
                  key={place.id}
                  place={place}
                  onArchive={setDeleteDialogPlace}
                  archiving={archivingPlaceId === place.id}
                />
              ))}
            </section>
          </>
        ) : null}
        <ConfirmDialog
          open={Boolean(deleteDialogPlace)}
          eyebrow="Safe delete"
          title="Delete this Place?"
          body={deleteDialogPlace
            ? `This archives ${deleteDialogPlace.title} from My Places and future pickers. Existing Plans keep their saved Place snapshot.`
            : 'This archives the Place from My Places and future pickers. Existing Plans keep their saved Place snapshot.'}
          variant="danger"
          confirmLabel="Delete Place"
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
