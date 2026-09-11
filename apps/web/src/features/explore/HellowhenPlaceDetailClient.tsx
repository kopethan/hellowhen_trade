'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CreatePlaceRequest, DiscoveryLanguage, PlaceDto, PlaceResponse } from '@hellowhen/contracts';
import { resolveInventoryOriginalCopy } from '@hellowhen/shared';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { planMediaSrc } from '../plans/plansPresentation';

function normalizeDiscoveryLanguage(value?: string | null): DiscoveryLanguage {
  if (value === 'fr' || value === 'es') return value;
  return 'en';
}

function buildPrivatePlaceCopyRequest(place: PlaceDto): CreatePlaceRequest {
  const mode = place.mode === 'remote' ? 'remote' : 'local';
  const original = resolveInventoryOriginalCopy(place);
  const defaultLanguage = normalizeDiscoveryLanguage(original.defaultLanguage);
  const translations: NonNullable<CreatePlaceRequest['translations']> = [];
  for (const translation of original.translations ?? []) {
    const languageCode = translation.languageCode === 'en' || translation.languageCode === 'fr' || translation.languageCode === 'es'
      ? translation.languageCode
      : null;
    const title = translation.title?.trim();
    const description = translation.description?.trim();
    if (!languageCode || languageCode === defaultLanguage || !title || !description) continue;
    translations.push({ languageCode, title, description });
  }

  return {
    source: 'user',
    visibility: 'private',
    status: 'active',
    mode,
    title: original.title,
    description: original.description?.trim() || undefined,
    defaultLanguage,
    translations,
    category: place.category ?? undefined,
    tags: place.tags ?? undefined,
    defaultDurationMinutes: place.defaultDurationMinutes ?? undefined,
    defaultNote: place.defaultNote ?? undefined,
    ...(mode === 'remote' ? {
      onlineLabel: place.onlineLabel ?? undefined,
      onlineUrl: place.onlineUrl ?? undefined,
    } : {
      areaLabel: place.areaLabel ?? undefined,
      addressPublicText: place.formattedAddress ?? place.addressPublicText ?? undefined,
      googlePlaceId: place.googlePlaceId ?? undefined,
      googlePlaceName: place.googlePlaceName ?? undefined,
      formattedAddress: place.formattedAddress ?? undefined,
      googleMapsUri: place.googleMapsUri ?? undefined,
      latitude: place.latitude ?? undefined,
      longitude: place.longitude ?? undefined,
      locationSource: place.locationSource ?? undefined,
      addressValidationStatus: place.addressValidationStatus ?? undefined,
    }),
  };
}

export function HellowhenPlaceDetailClient({ placeId }: { placeId: string }) {
  const router = useRouter();
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const [place, setPlace] = useState<PlaceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedPlace, setCopiedPlace] = useState<PlaceDto | null>(null);
  const [action, setAction] = useState<'add' | 'plan' | ''>('');
  const [actionError, setActionError] = useState('');

  const loadPlace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.places.get(placeId) as PlaceResponse;
      const next = response.place;
      if (!next || next.source !== 'hellowhen_library' || next.visibility !== 'library' || next.status !== 'active') throw new Error(t('places.list.errors.load'));
      setPlace(next);
    } catch (caughtError) {
      setPlace(null);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [placeId, t]);

  useEffect(() => { void loadPlace(); }, [loadPlace]);
  useEffect(() => { setCopiedPlace(null); setActionError(''); }, [placeId]);

  const ensureCopy = useCallback(async () => {
    if (copiedPlace) return copiedPlace;
    if (!place) throw new Error(t('places.list.errors.load'));
    const response = await api.places.create(buildPrivatePlaceCopyRequest(place)) as PlaceResponse;
    if (!response.place || response.place.source !== 'user' || response.place.visibility !== 'private') throw new Error(t('places.list.errors.load'));
    setCopiedPlace(response.place);
    return response.place;
  }, [copiedPlace, place, t]);

  function requireSignedIn() {
    if (!auth.hydrated) return false;
    if (auth.isAuthenticated) return true;
    router.push(`/auth?next=${encodeURIComponent(`/explore/places/${placeId}`)}`);
    return false;
  }

  async function addToMine() {
    if (!requireSignedIn() || copiedPlace || action) return;
    setAction('add');
    setActionError('');
    try { await ensureCopy(); } catch (caughtError) { setActionError(getFriendlyApiErrorMessage(caughtError)); } finally { setAction(''); }
  }

  async function startPlan() {
    if (!requireSignedIn() || action || !betaFeatures.plansEnabled || !betaFeatures.plansVisible) return;
    setAction('plan');
    setActionError('');
    try {
      const privatePlace = await ensureCopy();
      router.push(`/plans/new?createdPlaceId=${encodeURIComponent(privatePlace.id)}`);
    } catch (caughtError) {
      setActionError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setAction('');
    }
  }

  const images = useMemo(() => (place?.media ?? []).map((media) => ({ id: media.id, src: planMediaSrc(media, 'full') })).filter((image) => Boolean(image.src)), [place]);

  if (loading) return <main className="mobile-page web-app-page explore-detail-page"><div className="explore-discovery-state"><span className="semantic-badge instruction">{t('common.states.loading')}</span></div></main>;
  if (!place || error) {
    return (
      <main className="mobile-page web-app-page explore-detail-page">
        <div className="explore-discovery-state">
          <WebIcon name="location-on" size={28} decorative />
          <h1>{t('places.list.empty.libraryTitle')}</h1>
          <p>{error || t('places.list.errors.load')}</p>
          <button type="button" className="button secondary" onClick={() => { void loadPlace(); }}>{t('common.actions.tryAgain')}</button>
        </div>
      </main>
    );
  }

  const modeLabel = place.mode === 'remote' ? t('places.list.badges.online') : t('places.list.badges.offline');
  const publicAddress = place.addressPublicText || place.formattedAddress || place.areaLabel || '';
  const chips = [modeLabel, place.category, place.areaLabel].filter((value): value is string => Boolean(value));

  return (
    <main className="mobile-page web-app-page explore-detail-page">
      <Link href="/explore" className="explore-detail-back"><WebIcon name="back" size={17} decorative /> {t('common.actions.back')}</Link>
      <header className="explore-detail-hero">
        <span className="semantic-badge place">{t('common.exploreDiscovery.placeBadge')}</span>
        <h1>{place.title}</h1>
        {place.description ? <p>{place.description}</p> : null}
        <small>{t('places.list.badges.library')}</small>
        <div className="explore-detail-chips">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
      </header>

      <section className="explore-detail-section">
        <h2>{t('inventory.labels.details')}</h2>
        <dl className="explore-detail-list">
          <div><dt>{t('inventory.labels.category')}</dt><dd>{place.category || t('inventory.labels.notSpecified')}</dd></div>
          {place.mode !== 'remote' ? <div><dt>{t('places.editor.fields.address')}</dt><dd>{publicAddress || t('inventory.labels.notSpecified')}</dd></div> : null}
          {place.mode === 'remote' ? <div><dt>{t('places.editor.fields.onlineLabel')}</dt><dd>{place.onlineLabel || place.onlineUrl || t('inventory.labels.notSpecified')}</dd></div> : null}
          <div><dt>{t('inventory.libraryFilters.duration')}</dt><dd>{place.defaultDurationMinutes ? `${place.defaultDurationMinutes} min` : t('inventory.labels.notSpecified')}</dd></div>
        </dl>
      </section>

      {place.tags?.length ? <section className="explore-detail-section"><h2>{t('inventory.labels.tags')}</h2><div className="explore-detail-chips">{place.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section> : null}
      {place.defaultMeetingInstructions ? <section className="explore-detail-section"><h2>{t('places.editor.fields.description')}</h2><p>{place.defaultMeetingInstructions}</p></section> : null}
      {images.length ? <section className="explore-detail-section"><h2>{t('places.editor.image.title')}</h2><div className="explore-detail-images">{images.slice(0, 6).map((image, index) => <img key={image.id} src={image.src} alt={`${place.title} ${index + 1}`} loading="lazy" />)}</div></section> : null}

      <section className="explore-detail-actions">
        <p>{actionError || (copiedPlace ? t('common.exploreActions.addedHelper') : t('common.exploreActions.helper'))}</p>
        <div>
          <button type="button" className="button secondary" disabled={Boolean(copiedPlace || action)} onClick={() => { void addToMine(); }}>{copiedPlace ? t('common.exploreActions.addedPlace') : action === 'add' ? t('common.states.saving') : t('common.exploreActions.addPlace')}</button>
          {betaFeatures.plansEnabled && betaFeatures.plansVisible ? <button type="button" className="button" disabled={Boolean(action === 'add')} onClick={() => { void startPlan(); }}>{action === 'plan' ? t('common.states.creating') : t('common.exploreActions.startPlan')}</button> : null}
        </div>
      </section>
    </main>
  );
}
