'use client';

import Link from 'next/link';
import type { MediaAssetDto, PlacePresenceVerificationResponse, PlanDto, PlanJoinApprovalMode, PlanParticipantDto, PlanPlaceDto, PlanStatus } from '@hellowhen/contracts';
import { effectivePlanJoinClosesAt, isPlanJoinClosed } from '@hellowhen/shared';
import { useEffect, useMemo, useState } from 'react';
import { ReportContentButton } from '../../components/ReportContentButton';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { buildPublicPlanUrl, copyTextToClipboard } from '../../lib/publicUrls';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { UserIdentityLink } from '../users/UserIdentityLink';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { planDateTime, planMediaSrc, planOwnerName, planRangeLabel } from './plansPresentation';
import { resolvePlaceVisual, useResolvedPlaceVisualTheme } from './placeVisuals';
import { ContentLanguageDetailControls, useContentLanguageDetailSelection } from '../inventory/ContentLanguageDetailControls';

type ActionState = {
  loading: boolean;
  message: string;
  error: string;
};

type WebTranslate = ReturnType<typeof useWebTranslation>['t'];

function isPlanUnavailableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: number; body?: { error?: string } };
  return candidate.status === 404 || candidate.status === 410 || candidate.body?.error === 'not_found' || candidate.body?.error === 'plan_deleted';
}

function participantName(participant: PlanParticipantDto, t: WebTranslate) {
  return participant.user?.profile?.displayName || participant.user?.profile?.handle || t('plans.detail.people.memberFallback');
}

function ParticipantRow({ participant, ownerControls, onRemove }: { participant: PlanParticipantDto; ownerControls: boolean; onRemove: (participantId: string) => void }) {
  const { t } = useWebTranslation();
  const name = participantName(participant, t);
  return (
    <article className="plan-participant-row plan-participant-row--social">
      <div className="plan-participant-row__avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>
      <div className="plan-participant-row__body">
        <strong>{name}</strong>
        <p className="meta">{t(`plans.participantStatus.${participant.status}`)}</p>
        {participant.message ? <p>{participant.message}</p> : null}
      </div>
      {ownerControls && participant.status === 'accepted' ? (
        <button type="button" className="button secondary compact" onClick={() => onRemove(participant.id)}>{t('plans.detail.actions.removeParticipant')}</button>
      ) : null}
    </article>
  );
}

function PlanPlaceImage({ media }: { media?: MediaAssetDto | null }) {
  const imageSrc = planMediaSrc(media);
  if (!imageSrc) return <WebIcon name="calendar" size={28} decorative />;
  return <img src={imageSrc} alt="" loading="lazy" decoding="async" />;
}

function planPlaceDisplayMedia(place: PlanPlaceDto) {
  return place.media?.[0] ?? place.sourcePlace?.media?.[0] ?? null;
}

type PlanDetailPresentationState = PlanStatus | 'join_closed';

function planTimeValue(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function acceptedParticipantCount(plan: PlanDto) {
  return plan.participantCount ?? plan.participants?.filter((participant) => participant.status === 'accepted').length ?? 0;
}

function planDetailPresentationState(plan: PlanDto, now = new Date()): PlanDetailPresentationState {
  if (plan.status === 'cancelled' || plan.status === 'draft' || plan.status === 'expired' || plan.status === 'hidden') return plan.status;
  if (plan.status === 'completed') return 'completed';

  const nowTime = now.getTime();
  const startsAt = planTimeValue(plan.startsAt);
  const endsAt = planTimeValue(plan.endsAt ?? plan.startsAt);
  if (Number.isFinite(nowTime) && endsAt !== null && nowTime >= endsAt) return 'completed';
  if (plan.status === 'started') return 'started';
  if (Number.isFinite(nowTime) && startsAt !== null && nowTime >= startsAt) return 'started';
  if (isPlanJoinClosed(plan, now)) return 'join_closed';

  const participantCount = acceptedParticipantCount(plan);
  if (plan.status === 'full' || (plan.maxParticipants && participantCount >= plan.maxParticipants)) return 'full';
  return 'open';
}

function detailStatusTone(status: PlanDetailPresentationState) {
  if (status === 'open') return 'success';
  if (status === 'full') return 'warning';
  if (status === 'join_closed' || status === 'expired') return 'time';
  if (status === 'started') return 'plan';
  if (status === 'cancelled' || status === 'hidden') return 'danger';
  return 'neutral';
}

function planModeLabel(plan: PlanDto, t: WebTranslate) {
  if (plan.mode === 'remote') return t('plans.detail.values.online');
  if (plan.mode === 'hybrid') return t('plans.detail.values.hybrid');
  return t('plans.detail.values.local');
}

function planVisibilityLabel(plan: PlanDto, t: WebTranslate) {
  if (plan.status === 'cancelled') return t('plans.detail.actions.cancelledTitle');
  return plan.status === 'hidden' ? t('plans.detail.values.hidden') : t('plans.detail.values.public');
}

function planJoinModeLabel(mode: PlanJoinApprovalMode, t: WebTranslate) {
  return mode === 'owner_approval' ? t('plans.detail.values.approvalNeeded') : t('plans.detail.values.freeJoin');
}

function planJoinClosesLabel(plan: PlanDto, t: WebTranslate) {
  const deadline = effectivePlanJoinClosesAt(plan);
  if (!Number.isFinite(deadline.getTime())) return t('plans.detail.values.notSet');
  const startsAt = new Date(plan.startsAt);
  const deadlineLabel = planDateTime(deadline.toISOString());
  if (Number.isFinite(startsAt.getTime()) && deadline.getTime() === startsAt.getTime()) return t('plans.detail.values.whenPlanStarts', { date: deadlineLabel });
  return deadlineLabel;
}

function planCapacityLabel(plan: PlanDto, t: WebTranslate) {
  const joined = acceptedParticipantCount(plan);
  if (!plan.maxParticipants) return t('plans.detail.values.capacityUnlimitedJoined', { count: joined });
  return t('plans.detail.values.capacityLimitedJoined', { joined, max: plan.maxParticipants });
}

function planJoinActionCopy(plan: PlanDto, presentationState: PlanDetailPresentationState, t: WebTranslate) {
  if (presentationState === 'join_closed') return t('plans.detail.actions.joinClosed');
  if (presentationState === 'full') return t('plans.detail.actions.full');
  if (presentationState === 'started') return t('plans.detail.actions.started');
  if (presentationState === 'completed') return t('plans.detail.actions.completed');
  if (presentationState !== 'open') return t('plans.detail.actions.statusUnavailable', { status: t(`plans.status.${presentationState}`) });
  return plan.joinApprovalMode === 'automatic' ? t('plans.detail.actions.freeJoinOpen') : t('plans.detail.actions.requestJoinOpen');
}

function participantStateCopy(status: PlanDto['myParticipantStatus'], t: WebTranslate) {
  if (status === 'pending') return t('plans.detail.participantState.pending');
  if (status === 'left') return t('plans.detail.participantState.left');
  if (status === 'removed') return t('plans.detail.participantState.removed');
  if (status === 'declined') return t('plans.detail.participantState.declined');
  if (status === 'cancelled') return t('plans.detail.participantState.cancelled');
  return status ? t('plans.detail.participantState.other', { status: t(`plans.participantStatus.${status}`) }) : '';
}

function canJoinFromParticipantStatus(status: PlanDto['myParticipantStatus']) {
  return !status || status === 'left' || status === 'cancelled' || status === 'declined';
}

function planPlaceModeDisplay(place: PlanPlaceDto, t: WebTranslate) {
  const kind = place.kind ?? 'place';
  if (kind === 'pause') return t('plans.detail.customStop.pause');
  if (kind === 'free_time') return t('plans.detail.customStop.freeTime');
  if (kind === 'meeting_point') return t('plans.detail.customStop.meetingPoint');
  if (kind === 'custom') return t('plans.detail.customStop.custom');
  return place.mode === 'remote' ? t('plans.detail.values.online') : t('plans.detail.values.local');
}

function planRouteUnitLabel(places: PlanPlaceDto[], t: WebTranslate) {
  const hasCustomStops = places.some((place) => (place.kind ?? 'place') !== 'place');
  if (hasCustomStops) return places.length === 1 ? t('plans.row.stopOne', { count: places.length }) : t('plans.row.stopMany', { count: places.length });
  return places.length === 1 ? t('plans.row.placeOne', { count: places.length }) : t('plans.row.placeMany', { count: places.length });
}

function planPlaceSourceLabel(place: PlanPlaceDto, t: WebTranslate) {
  if (place.source === 'hellowhen_library') return t('plans.detail.placeSource.library');
  if (place.source === 'my_place') return t('plans.detail.placeSource.mine');
  return t('plans.detail.placeSource.custom');
}

function planPlaceTimeRange(place: PlanPlaceDto, planStartsAt: string) {
  const start = planDateTime(place.startsAt ?? planStartsAt);
  const end = place.endsAt ? planDateTime(place.endsAt) : '';
  return end && end !== start ? `${start} → ${end}` : start;
}

function planPlaceDescription(place: PlanPlaceDto) {
  return place.sourcePlace?.description?.trim() || '';
}

// Keep the free Google Maps URL conservative for mobile browsers: origin + 3 waypoints + destination.
const GOOGLE_MAPS_MAX_ROUTE_STOPS = 5;

function buildMapsSearchUrl(value: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}

function buildGoogleMapsDirectionsUrl(queries: string[]) {
  const origin = queries[0];
  if (queries.length <= 1 || !origin) return buildMapsSearchUrl(origin ?? '');
  const destination = queries[queries.length - 1];
  if (!destination) return buildMapsSearchUrl(origin);
  const waypoints = queries.slice(1, -1);
  const params = [
    'api=1',
    `origin=${encodeURIComponent(origin)}`,
    `destination=${encodeURIComponent(destination)}`,
  ];
  if (waypoints.length) params.push(`waypoints=${encodeURIComponent(waypoints.join('|'))}`);
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

type PlanRouteMapsLink = {
  href: string;
  label: string;
  body: string;
  stopCount: number;
  totalStopCount: number;
  skippedOnlineCount: number;
};

type PlanPlaceLocationDisplay = {
  kind: 'local' | 'remote';
  label: string;
  value: string;
  href?: string;
  actionLabel?: string;
};

function planPlaceLocation(place: PlanPlaceDto, t: WebTranslate): PlanPlaceLocationDisplay | null {
  if ((place.kind ?? 'place') !== 'place') return null;
  if (place.mode === 'remote') {
    const value = place.onlineUrl || place.onlineLabel || '';
    if (!value) return null;
    return {
      kind: 'remote',
      label: place.onlineLabel && place.onlineUrl ? place.onlineLabel : t('plans.detail.location.onlinePlace'),
      value,
      href: place.onlineUrl || undefined,
      actionLabel: place.onlineUrl ? t('plans.detail.location.openLink') : undefined,
    };
  }

  const value = place.addressPublicText || place.sourcePlace?.addressPublicText || place.sourcePlace?.areaLabel || '';
  if (!value) return null;
  return {
    kind: 'local',
    label: t('plans.detail.location.offlineAddress'),
    value,
    href: buildMapsSearchUrl(value),
    actionLabel: t('plans.detail.location.openMaps'),
  };
}

type PlanPlacePresenceNotice = {
  tone: 'success' | 'warning' | 'info';
  title: string;
  body: string;
};

function isOfflinePlanPlace(place: PlanPlaceDto) {
  return (place.kind ?? 'place') === 'place' && place.mode !== 'remote';
}

function planPlaceStaticMapStatus(place: PlanPlaceDto) {
  return place.staticMapStatus ?? place.sourcePlace?.staticMapStatus ?? null;
}

function planPlaceMapPausedCopy(place: PlanPlaceDto, t: WebTranslate) {
  const status = planPlaceStaticMapStatus(place);
  if (!isOfflinePlanPlace(place) || !status || status.state !== 'unavailable') return null;
  if (status.reason !== 'hard_limit' && status.reason !== 'soft_limit') return null;
  return {
    title: status.reason === 'hard_limit' ? t('plans.detail.route.mapPreviewPaused') : t('plans.detail.route.mapPreviewLimited'),
    body: status.message || t('plans.detail.route.mapPreviewBody'),
  };
}

function planPlaceVerificationCoordinates(place: PlanPlaceDto) {
  const latitude = typeof place.latitude === 'number' ? place.latitude : place.sourcePlace?.latitude;
  const longitude = typeof place.longitude === 'number' ? place.longitude : place.sourcePlace?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { latitude, longitude };
}

function planPlaceMapsQuery(place: PlanPlaceDto) {
  if (!isOfflinePlanPlace(place)) return null;
  const coordinates = planPlaceVerificationCoordinates(place);
  if (coordinates) return `${coordinates.latitude},${coordinates.longitude}`;
  return place.addressPublicText || place.sourcePlace?.addressPublicText || place.sourcePlace?.areaLabel || null;
}

function buildPlanRouteMapsLink(places: PlanPlaceDto[], t: WebTranslate): PlanRouteMapsLink | null {
  const offlineQueries = places.map(planPlaceMapsQuery).filter((value): value is string => Boolean(value));
  if (!offlineQueries.length) return null;
  const includedQueries = offlineQueries.slice(0, GOOGLE_MAPS_MAX_ROUTE_STOPS);
  const skippedOnlineCount = places.filter((place) => (place.kind ?? 'place') === 'place' && place.mode === 'remote').length;
  const truncatedCount = Math.max(offlineQueries.length - includedQueries.length, 0);
  const bodyParts = [
    includedQueries.length === 1 ? t('plans.detail.route.offlineStopOne', { count: 1 }) : t('plans.detail.route.offlineStopMany', { count: includedQueries.length }),
    skippedOnlineCount ? (skippedOnlineCount === 1 ? t('plans.detail.route.skippedOnlineOne', { count: skippedOnlineCount }) : t('plans.detail.route.skippedOnlineMany', { count: skippedOnlineCount })) : '',
    truncatedCount ? (truncatedCount === 1 ? t('plans.detail.route.skippedLaterOne', { count: truncatedCount }) : t('plans.detail.route.skippedLaterMany', { count: truncatedCount })) : '',
  ].filter(Boolean);
  return {
    href: buildGoogleMapsDirectionsUrl(includedQueries),
    label: includedQueries.length > 1 ? t('plans.detail.route.openRoute') : t('plans.detail.route.openSingle'),
    body: bodyParts.join(' · '),
    stopCount: includedQueries.length,
    totalStopCount: offlineQueries.length,
    skippedOnlineCount,
  };
}

function formatPresenceDistance(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (value < 1000) return `${Math.round(value)} m`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} km`;
}

function presenceNoticeFromVerificationResponse(response: PlacePresenceVerificationResponse, t: WebTranslate): PlanPlacePresenceNotice {
  const distanceLabel = formatPresenceDistance(response.distanceMeters ?? response.verification.distanceMeters);
  if (response.accepted) {
    return {
      tone: 'success',
      title: response.alreadyVerified ? t('plans.detail.presence.alreadyVerifiedTitle') : t('plans.detail.presence.verifiedTitle'),
      body: distanceLabel ? t('plans.detail.presence.acceptedWithDistance', { distance: distanceLabel }) : t('plans.detail.presence.acceptedBody'),
    };
  }
  if (response.verification.rejectionReason === 'gps_accuracy_too_low') {
    return { tone: 'warning', title: t('plans.detail.presence.lowAccuracyTitle'), body: t('plans.detail.presence.lowAccuracyBody') };
  }
  if (response.verification.rejectionReason === 'too_far_from_place') {
    return {
      tone: 'warning',
      title: t('plans.detail.presence.tooFarTitle'),
      body: distanceLabel ? t('plans.detail.presence.tooFarWithDistance', { distance: distanceLabel }) : t('plans.detail.presence.tooFarBody'),
    };
  }
  if (response.verification.rejectionReason === 'mock_location_detected') {
    return { tone: 'warning', title: t('plans.detail.presence.mockTitle'), body: t('plans.detail.presence.mockBody') };
  }
  if (response.verification.rejectionReason === 'location_timestamp_stale' || response.verification.rejectionReason === 'location_timestamp_future') {
    return { tone: 'warning', title: t('plans.detail.presence.expiredTitle'), body: t('plans.detail.presence.expiredBody') };
  }
  if (response.verification.rejectionReason === 'suspicious_location_jump') {
    return { tone: 'warning', title: t('plans.detail.presence.jumpTitle'), body: t('plans.detail.presence.jumpBody') };
  }
  return { tone: 'warning', title: t('plans.detail.presence.failedTitle'), body: t('plans.detail.presence.failedBody') };
}

function webVerificationPlatform() {
  if (typeof navigator === 'undefined') return 'web';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile_web' : 'web';
}

function getBrowserLocationErrorMessage(cause: unknown, t: WebTranslate) {
  const apiMessage = getFriendlyApiErrorMessage(cause, '');
  if (apiMessage) return apiMessage;
  const geolocationError = cause && typeof cause === 'object' && 'code' in cause ? cause as { code?: number } : null;
  if (geolocationError?.code === 1) return t('plans.detail.presence.permissionBody');
  if (geolocationError?.code === 2) return t('plans.detail.presence.deviceUnavailableBody');
  if (geolocationError?.code === 3) return t('plans.detail.presence.timeoutBody');
  return t('plans.detail.presence.browserUnavailableBody');
}

function getCurrentBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocation_unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
  });
}

function PlanDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="plan-detail-list-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PlanRoutePreview({ places, planStartsAt, routeMapsLink }: { places: PlanPlaceDto[]; planStartsAt: string; routeMapsLink: PlanRouteMapsLink | null }) {
  const { t } = useWebTranslation();
  const themeMode = useResolvedPlaceVisualTheme();
  const preview = useMemo(() => {
    const entries = places.map((place) => {
      const displayMedia = planPlaceDisplayMedia(place);
      const visual = resolvePlaceVisual({ media: displayMedia, staticMap: place.staticMap ?? place.sourcePlace?.staticMap ?? null, themeMode });
      return { place, displayMedia, visual };
    });

    return entries.find((entry) => entry.visual.url) ?? entries[0] ?? null;
  }, [places, themeMode]);

  if (!preview) return null;

  const location = planPlaceLocation(preview.place, t);
  const previewDescription = planPlaceDescription(preview.place);
  const previewTitle = routeMapsLink ? (routeMapsLink.totalStopCount > 1 ? t('plans.detail.route.previewRoute') : t('plans.detail.route.previewLocation')) : t('plans.detail.route.previewPlace');
  const previewBody = routeMapsLink?.body ?? (places.length === 1 ? t('plans.detail.route.previewBodyOne') : t('plans.detail.route.previewBodyMany', { count: places.length }));

  return (
    <aside className="plan-route-preview" aria-label={previewTitle}>
      <div className="plan-route-preview__media">
        {preview.visual.url ? (
          preview.visual.kind === 'media' && preview.displayMedia ? <PlanPlaceImage media={preview.displayMedia} /> : <img src={preview.visual.url} alt="" loading="lazy" decoding="async" className="is-static-map" />
        ) : (
          <WebIcon name="location-on" size={34} decorative />
        )}
      </div>
      <div className="plan-route-preview__copy">
        <p className="eyebrow">{previewTitle}</p>
        <h3>{preview.place.title}</h3>
        <p>{previewBody}</p>
        {location ? <small>{location.value}</small> : null}
        {previewDescription ? <span>{previewDescription}</span> : null}
        {routeMapsLink ? (
          <a className="plan-route-preview__action" href={routeMapsLink.href} target="_blank" rel="noreferrer">
            <WebIcon name="location-on" size={15} decorative />
            <span>{routeMapsLink.label}</span>
          </a>
        ) : null}
      </div>
      {places.length > 1 ? (
        <div className="plan-route-preview__stops" aria-label={t('plans.detail.route.stopsAccessibility')}>
          {places.map((place, index) => (
            <div key={`route-preview-stop-${place.id}`} className={`plan-route-preview__stop${place.id === preview.place.id ? ' is-active' : ''}`}>
              <span aria-hidden="true">{index + 1}</span>
              <div>
                <strong>{place.title}</strong>
                <small>{planPlaceTimeRange(place, planStartsAt)} · {planPlaceModeDisplay(place, t)}</small>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function PlanPlaceCard({
  place,
  index,
  planStartsAt,
  showReport,
  canVerifyPresence,
  isVerifyingPresence,
  presenceNotice,
  onVerifyPresence,
}: {
  place: PlanPlaceDto;
  index: number;
  planStartsAt: string;
  showReport: boolean;
  canVerifyPresence: boolean;
  isVerifyingPresence: boolean;
  presenceNotice?: PlanPlacePresenceNotice;
  onVerifyPresence: (place: PlanPlaceDto) => void;
}) {
  const { t } = useWebTranslation();
  const displayMedia = planPlaceDisplayMedia(place);
  const themeMode = useResolvedPlaceVisualTheme();
  const isPlaceStop = (place.kind ?? 'place') === 'place';
  const placeVisual = resolvePlaceVisual({ media: displayMedia, staticMap: isPlaceStop ? place.staticMap ?? place.sourcePlace?.staticMap ?? null : null, themeMode });
  const placeTime = planPlaceTimeRange(place, planStartsAt);
  const description = planPlaceDescription(place);
  const languageSelection = useContentLanguageDetailSelection({
    displayLanguage: place.displayLanguage ?? place.sourcePlace?.displayLanguage ?? null,
    fallbackTitle: place.title,
    fallbackDescription: description,
  });
  const location = planPlaceLocation(place, t);
  const mapPausedCopy = !placeVisual.url ? planPlaceMapPausedCopy(place, t) : null;
  const [locationCopyNotice, setLocationCopyNotice] = useState('');
  const hasVerificationCoordinates = Boolean(planPlaceVerificationCoordinates(place));
  const showPresenceVerification = isOfflinePlanPlace(place) && (canVerifyPresence || presenceNotice || hasVerificationCoordinates);
  const verificationDisabled = isVerifyingPresence || !hasVerificationCoordinates;

  async function copyLocationValue(value: string) {
    const copied = await copyTextToClipboard(value);
    setLocationCopyNotice(copied ? t('plans.detail.location.copied') : t('plans.detail.location.copyFailed'));
  }

  return (
    <article className="plan-route-stop">
      <div className="plan-route-stop__index" aria-hidden="true">{index + 1}</div>
      <div className="plan-route-stop__body">
        <div className="plan-route-stop__topline">
          <span>{placeTime}</span>
          <span>{planPlaceModeDisplay(place, t)}</span>
          <span>{planPlaceSourceLabel(place, t)}</span>
        </div>
        <div className="plan-route-stop__content">
          <div className="plan-route-stop__copy">
            <h4>{languageSelection.title}</h4>
            <ContentLanguageDetailControls displayLanguage={place.displayLanguage ?? place.sourcePlace?.displayLanguage ?? null} selectedLanguage={languageSelection.selectedLanguage} onSelectLanguage={languageSelection.setSelectedLanguage} />
            {location ? (
              <details className={`plan-route-stop__location plan-route-stop__location--${location.kind}`}>
                <summary className="plan-route-stop__location-summary">
                  <span className="plan-route-stop__location-icon" aria-hidden="true">
                    <WebIcon name={location.kind === 'local' ? 'location-on' : 'plan'} size={17} decorative />
                  </span>
                  <span className="plan-route-stop__location-copy">
                    <span>{location.label}</span>
                    <span className="plan-route-stop__location-value">{location.value}</span>
                  </span>
                  <span className="plan-route-stop__location-chevron" aria-hidden="true">
                    <WebIcon name="arrow-right" size={13} decorative />
                  </span>
                </summary>
                <div className="plan-route-stop__location-panel">
                  <div className="plan-route-stop__location-actions">
                    {location.href && location.actionLabel ? (
                      <a className="plan-route-stop__location-action" href={location.href} target="_blank" rel="noreferrer">
                        {location.actionLabel}
                        <WebIcon name="arrow-right" size={13} decorative />
                      </a>
                    ) : null}
                    <button type="button" className="plan-route-stop__location-action" onClick={() => { void copyLocationValue(location.value); }}>
                      {location.kind === 'local' ? t('plans.detail.location.copyAddress') : t('plans.detail.location.copyLink')}
                    </button>
                  </div>
                  {locationCopyNotice ? <p className="plan-route-stop__location-notice" role="status">{locationCopyNotice}</p> : null}
                </div>
              </details>
            ) : null}
            {languageSelection.description ? <p className="plan-route-stop__description">{languageSelection.description}</p> : null}
            {placeVisual.url ? (
              <div className="plan-route-stop__media">
                {placeVisual.kind === 'media' && displayMedia ? <PlanPlaceImage media={displayMedia} /> : <img src={placeVisual.url} alt="" loading="lazy" decoding="async" className="is-static-map" />}
              </div>
            ) : null}
            {mapPausedCopy ? (
              <div className="plan-route-stop__map-paused">
                <div>
                  <strong>{mapPausedCopy.title}</strong>
                  <p>{mapPausedCopy.body}</p>
                </div>
                {location?.href ? (
                  <a href={location.href} target="_blank" rel="noreferrer">
                    {t('plans.detail.route.openGoogleMaps')}
                    <WebIcon name="arrow-right" size={13} decorative />
                  </a>
                ) : null}
              </div>
            ) : null}
            {showPresenceVerification ? (
              <div className={`plan-route-stop__presence plan-route-stop__presence--${presenceNotice?.tone ?? 'info'}`}>
                <div className="plan-route-stop__presence-copy">
                  <strong>{presenceNotice?.title ?? (hasVerificationCoordinates ? t('plans.detail.presence.title') : t('plans.detail.presence.unavailableTitle'))}</strong>
                  <p>{presenceNotice?.body ?? (hasVerificationCoordinates ? t('plans.detail.presence.readyBody') : t('plans.detail.presence.unavailableBody'))}</p>
                </div>
                {hasVerificationCoordinates ? (
                  <button
                    type="button"
                    className="plan-route-stop__presence-button"
                    disabled={verificationDisabled}
                    onClick={() => onVerifyPresence(place)}
                  >
                    <WebIcon name="location-on" size={14} decorative />
                    <span>{isVerifyingPresence ? t('plans.detail.presence.checking') : t('plans.detail.presence.verify')}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            {showReport ? <ReportContentButton targetType="plan_place" targetId={place.id} /> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

type PlanDetailClientProps = {
  planId: string;
  plansEnabled?: boolean;
  plansVisible?: boolean;
};

export function PlanDetailClient({ planId, plansEnabled, plansVisible }: PlanDetailClientProps) {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [joinRequests, setJoinRequests] = useState<PlanParticipantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<ActionState>({ loading: false, message: '', error: '' });
  const [shareNotice, setShareNotice] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [verifyingPlaceId, setVerifyingPlaceId] = useState<string | null>(null);
  const [presenceNotices, setPresenceNotices] = useState<Record<string, PlanPlacePresenceNotice>>({});

  const isOwner = Boolean(auth.user?.id && plan?.ownerId === auth.user.id);
  const isCancelled = plan?.status === 'cancelled';
  const currentParticipantStatus = plan?.myParticipantStatus ?? null;
  const presentationState = plan ? planDetailPresentationState(plan) : null;
  const canJoin = Boolean(auth.hydrated && auth.isAuthenticated && plan && !isOwner && presentationState === 'open' && canJoinFromParticipantStatus(currentParticipantStatus));
  const canLeave = Boolean(!isCancelled && presentationState !== 'completed' && !isOwner && currentParticipantStatus === 'accepted');
  const canVerifyPresence = Boolean(!isCancelled && auth.hydrated && auth.isAuthenticated && plan && presentationState !== 'completed' && ['open', 'full', 'started'].includes(plan.status) && (isOwner || currentParticipantStatus === 'accepted'));
  const canRemovePlan = Boolean(isOwner && plan && plan.status !== 'cancelled' && plan.status !== 'hidden');
  const canEditPlan = Boolean(isOwner && plan?.ownerCanEdit);
  const participantCopy = !isOwner ? participantStateCopy(currentParticipantStatus, t) : '';
  const showReportActions = Boolean(auth.hydrated && auth.isAuthenticated && plan && !isOwner);
  const places = useMemo(() => [...(plan?.places ?? [])].sort((left, right) => left.order - right.order), [plan?.places]);
  const routeMapsLink = buildPlanRouteMapsLink(places, t);
  const shouldShowRoutePreview = Boolean(routeMapsLink && routeMapsLink.totalStopCount >= 2);
  const joinedCount = plan?.participantCount ?? 0;
  const hasAffectedParticipants = Boolean(plan?.participants?.some((participant) => participant.status === 'accepted' || participant.status === 'pending'));
  const routeUnitLabel = planRouteUnitLabel(places, t);
  const planStatusDisplay = presentationState === 'join_closed' ? t('plans.status.joinClosed') : (presentationState ? t(`plans.status.${presentationState}`) : '');
  const capacityLabel = plan?.maxParticipants ? `${joinedCount}/${plan.maxParticipants}` : String(joinedCount);

  async function loadPlan() {
    setLoading(true);
    setError('');
    try {
      const response = await api.plans.get(planId);
      setPlan(response.plan);
    } catch (loadError) {
      setPlan(null);
      setError(getFriendlyApiErrorMessage(loadError, t('plans.detail.errors.loadBody')));
    } finally {
      setLoading(false);
    }
  }

  async function loadJoinRequests() {
    if (!isOwner) return;
    try {
      const response = await api.plans.joinRequests(planId);
      setJoinRequests(response.participants ?? []);
    } catch {
      setJoinRequests([]);
    }
  }

  useEffect(() => {
    if (!auth.hydrated) return;
    void loadPlan();
  }, [auth.hydrated, planId]);

  useEffect(() => {
    void loadJoinRequests();
  }, [isOwner, planId]);

  const visibleParticipants = useMemo(() => {
    const source = isOwner ? joinRequests : plan?.participants ?? [];
    return [...source].filter((participant) => participant.status === 'accepted').sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }, [isOwner, joinRequests, plan?.participants]);

  async function joinPlan() {
    if (!auth.isAuthenticated) return;
    setAction({ loading: true, message: '', error: '' });
    try {
      await api.plans.join(planId, {});
      setAction({ loading: false, message: t('plans.detail.feedback.joined'), error: '' });
      await loadPlan();
    } catch (joinError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(joinError, t('plans.detail.errors.join')) });
    }
  }

  async function leavePlan() {
    setAction({ loading: true, message: '', error: '' });
    try {
      await api.plans.leave(planId);
      setAction({ loading: false, message: t('plans.detail.feedback.left'), error: '' });
      await loadPlan();
    } catch (statusError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(statusError, t('plans.detail.errors.leave')) });
    }
  }

  async function removeParticipant(participantId: string) {
    setAction({ loading: true, message: '', error: '' });
    try {
      await api.plans.updateJoinRequest(planId, participantId, { status: 'removed' });
      setAction({ loading: false, message: t('plans.detail.feedback.participantRemoved'), error: '' });
      await Promise.all([loadPlan(), loadJoinRequests()]);
    } catch (statusError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(statusError, t('plans.detail.errors.removeParticipant')) });
    }
  }

  async function sharePlan() {
    if (!plan) return;
    setShareLoading(true);
    setShareNotice('');
    try {
      let currentPlan: PlanDto;
      try {
        const response = await api.plans.get(plan.id);
        currentPlan = response.plan;
        setPlan(currentPlan);
      } catch (cause) {
        const message = getFriendlyApiErrorMessage(cause, t('plans.detail.errors.shareAvailability'));
        if (isPlanUnavailableError(cause)) {
          setPlan(null);
          setError(message);
        } else {
          setShareNotice(message);
        }
        return;
      }

      const url = buildPublicPlanUrl(currentPlan.id);
      const shareData = { title: currentPlan.title, text: t('plans.detail.share.text', { title: currentPlan.title }), url };
      const webNavigator = typeof navigator !== 'undefined' ? navigator as Navigator & { share?: (data: typeof shareData) => Promise<void> } : null;

      try {
        if (webNavigator?.share) {
          await webNavigator.share(shareData);
          setShareNotice(t('plans.detail.feedback.shareOpened'));
          return;
        }

        const copied = await copyTextToClipboard(url);
        setShareNotice(copied ? t('plans.detail.feedback.linkCopied') : t('plans.detail.feedback.linkCopyFailed'));
      } catch (cause) {
        const aborted = typeof DOMException !== 'undefined' && cause instanceof DOMException && cause.name === 'AbortError';
        if (!aborted) {
          const copied = await copyTextToClipboard(url);
          setShareNotice(copied ? t('plans.detail.feedback.linkCopied') : t('plans.detail.feedback.linkCopyFailed'));
        }
      }
    } finally {
      setShareLoading(false);
    }
  }

  async function removePlan() {
    if (!plan || !canRemovePlan) return;
    const body = hasAffectedParticipants ? t('plans.detail.confirm.removeParticipantsBody') : t('plans.detail.confirm.removeBody');
    const confirmed = window.confirm(`${t('plans.detail.confirm.removeTitle')}\n\n${body}`);
    if (!confirmed) return;

    setAction({ loading: true, message: '', error: '' });
    try {
      const response = await api.plans.remove(plan.id);
      setPlan(response.plan);
      setAction({ loading: false, message: t('plans.detail.feedback.removed'), error: '' });
    } catch (removeError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(removeError, t('plans.detail.errors.remove')) });
    }
  }

  async function restorePlan() {
    if (!plan || !isOwner || !isCancelled) return;
    setAction({ loading: true, message: '', error: '' });
    try {
      const response = await api.plans.restore(plan.id);
      setPlan(response.plan);
      setAction({ loading: false, message: t('plans.detail.feedback.restored'), error: '' });
    } catch (restoreError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(restoreError, t('plans.detail.errors.restore')) });
    }
  }

  async function verifyPlanPlacePresence(place: PlanPlaceDto) {
    if (!plan || verifyingPlaceId) return;
    if (!auth.isAuthenticated) {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'info', title: t('plans.detail.presence.loginTitle'), body: t('plans.detail.presence.loginBody') },
      }));
      return;
    }
    if (!isOwner && currentParticipantStatus !== 'accepted') {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'info', title: t('plans.detail.presence.joinFirstTitle'), body: t('plans.detail.presence.joinFirstBody') },
      }));
      return;
    }
    if (!isOfflinePlanPlace(place)) return;
    if (!planPlaceVerificationCoordinates(place)) {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'warning', title: t('plans.detail.presence.mapPositionTitle'), body: t('plans.detail.presence.mapPositionBody') },
      }));
      return;
    }

    setVerifyingPlaceId(place.id);
    setAction((current) => ({ ...current, error: '' }));
    try {
      const position = await getCurrentBrowserPosition();
      const response = await api.plans.verifyPlacePresence(plan.id, place.id, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: typeof position.coords.accuracy === 'number' ? position.coords.accuracy : undefined,
        locationCapturedAt: new Date(position.timestamp).toISOString(),
        platform: webVerificationPlatform(),
      });
      setPresenceNotices((current) => ({ ...current, [place.id]: presenceNoticeFromVerificationResponse(response, t) }));
    } catch (caughtError) {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'warning', title: t('plans.detail.presence.failedTitle'), body: getBrowserLocationErrorMessage(caughtError, t) },
      }));
    } finally {
      setVerifyingPlaceId(null);
    }
  }

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="plan-detail-page plan-detail-page--web">
        <header className="plan-detail-toolbar" aria-label={t('plans.detail.navigation')}>
          <Link href="/plans" className="plan-detail-back-link">
            <WebIcon name="back" size={17} decorative />
            <span>{t('plans.detail.headerTitle')}</span>
          </Link>
          <div className="plan-detail-toolbar__actions">
            <PlansInternalBadge plansVisible={plansVisible} />
            {plan && !isCancelled ? (
              <button type="button" className="plan-detail-icon-button" onClick={() => void sharePlan()} disabled={shareLoading}>
                <WebIcon name="share" size={17} decorative />
                <span>{shareLoading ? t('plans.detail.actions.sharing') : t('plans.detail.actions.share')}</span>
              </button>
            ) : null}
          </div>
        </header>

        {loading ? <section className="plan-social-section"><p className="meta">{t('plans.detail.loading')}</p></section> : null}
        {error ? <section className="plan-social-section plan-social-section--soft"><p>{error}</p></section> : null}

        {plan ? (
          <>
            <section className="plan-detail-hero-social">
              <div className="status-row plan-detail-status-row">
                <span className={`semantic-badge ${detailStatusTone(presentationState ?? plan.status)}`}>{isCancelled && isOwner ? t('plans.detail.actions.cancelledTitle') : planStatusDisplay}</span>
                <span className="semantic-badge trade">{t('plans.detail.headerTitle')}</span>
              </div>
              <h1>{plan.title}</h1>
              {plan.description ? <p className="plan-detail-hero-description">{plan.description}</p> : null}
              <div className="plan-detail-owner-row">
                <span className="meta">{t('plans.detail.hero.starts', { date: planDateTime(plan.startsAt) })}</span>
                <span className="meta">·</span>
                <span className="meta">{t('plans.detail.hero.postedBy')}</span>
                <UserIdentityLink
                  user={plan.owner}
                  userId={plan.ownerId}
                  variant="chip"
                  avatarSize="sm"
                  statusText={t('plans.detail.values.owner')}
                  showHandle={false}
                  disabled={!plan.owner}
                />
              </div>
              <div className="plan-detail-chip-row" aria-label={t('plans.detail.summaryAccessibility')}>
                <span className={`semantic-badge ${detailStatusTone(presentationState ?? plan.status)}`}>{isCancelled && isOwner ? t('plans.detail.actions.cancelledTitle') : planStatusDisplay}</span>
                <span className="semantic-badge instruction">{planJoinModeLabel(plan.joinApprovalMode, t)}</span>
                <span className="semantic-badge neutral">{routeUnitLabel}</span>
                <span className="semantic-badge neutral">{planModeLabel(plan, t)}</span>
              </div>
              {shareNotice ? <p className="plan-share-notice" role="status" aria-live="polite">{shareNotice}</p> : null}
            </section>

            <section className="plan-social-section trade-thread-split-section trade-thread-split-section--clean plan-discussion-entry-section" aria-labelledby="plan-conversations-title">
              <div className="plan-section-heading trade-thread-section-heading trade-thread-section-heading--clean">
                <div>
                  <p className="eyebrow">{t('plans.detail.sections.discussion')}</p>
                  <h2 id="plan-conversations-title">{isCancelled && isOwner ? t('plans.detail.discussion.history') : t('plans.detail.sections.discussion')}</h2>
                </div>
              </div>
              <div className="trade-thread-action-grid trade-thread-action-grid--simple trade-thread-action-grid--clean">
                <Link href={`/plans/${plan.id}/discussion`} className="trade-thread-action-card trade-thread-action-card--public" aria-label={t('plans.detail.discussion.openAccessibility')}>
                  <span className="trade-thread-action-card__icon trade-thread-action-card__icon--public"><WebIcon name="activity" size={20} decorative /></span>
                  <span className="trade-thread-action-card__body">
                    <strong>{isCancelled && isOwner ? t('plans.detail.discussion.history') : t('plans.detail.sections.discussion')}</strong>
                    <small>{isCancelled ? t('plans.detail.discussion.cancelledBody') : t('plans.detail.discussion.body')}</small>
                  </span>
                  <span className="trade-thread-action-card__cta">{t('plans.detail.discussion.open')}<WebIcon name="arrow-right" size={14} decorative /></span>
                </Link>
              </div>
            </section>

            <section className="plan-social-section plan-route-section plan-route-section--list">
              <div className="plan-section-heading">
                <div>
                  <p className="eyebrow">{t('plans.detail.sections.route')}</p>
                  <h2>{places.some((place) => (place.kind ?? 'place') !== 'place') ? t('plans.detail.route.stopsAndTimes') : t('plans.detail.route.placesAndTimes')}</h2>
                </div>
              </div>
              <div className="plan-route-shell">
                <div className="plan-route-list">
                  {places.map((place, index) => (
                    <PlanPlaceCard
                      key={place.id}
                      place={place}
                      index={index}
                      planStartsAt={plan.startsAt}
                      showReport={showReportActions}
                      canVerifyPresence={canVerifyPresence}
                      isVerifyingPresence={verifyingPlaceId === place.id}
                      presenceNotice={presenceNotices[place.id]}
                      onVerifyPresence={(nextPlace) => { void verifyPlanPlacePresence(nextPlace); }}
                    />
                  ))}
                  {places.length === 0 ? <p className="meta">{t('plans.detail.route.emptyBody')}</p> : null}
                </div>
                {shouldShowRoutePreview ? <PlanRoutePreview places={places.filter(isOfflinePlanPlace)} planStartsAt={plan.startsAt} routeMapsLink={routeMapsLink} /> : null}
              </div>
            </section>

            <section className="plan-social-section">
              <div className="plan-section-heading">
                <p className="eyebrow">{t('plans.detail.sections.details')}</p>
                <h2>{t('plans.detail.infoTitle')}</h2>
              </div>
              <dl className="plan-detail-list">
                <PlanDetailItem label={t('plans.detail.fields.status')} value={isCancelled && isOwner ? t('plans.detail.actions.cancelledTitle') : planStatusDisplay} />
                <PlanDetailItem label={t('plans.detail.fields.visibility')} value={planVisibilityLabel(plan, t)} />
                <PlanDetailItem label={t('plans.detail.fields.joinMode')} value={planJoinModeLabel(plan.joinApprovalMode, t)} />
                <PlanDetailItem label={t('plans.detail.fields.joinCloses')} value={planJoinClosesLabel(plan, t)} />
                <PlanDetailItem label={t('plans.detail.fields.capacity')} value={planCapacityLabel(plan, t)} />
                <PlanDetailItem label={t('plans.detail.fields.time')} value={planRangeLabel(plan)} />
                <PlanDetailItem label={t('plans.detail.fields.format')} value={planModeLabel(plan, t)} />
                <PlanDetailItem label={t('plans.detail.fields.created')} value={planDateTime(plan.createdAt)} />
              </dl>
            </section>

            <section className="plan-social-section">
              <div className="plan-section-heading">
                <p className="eyebrow">{t('plans.detail.sections.owner')}</p>
                <h2>{t('plans.detail.hero.postedBy')} {planOwnerName(plan)}</h2>
              </div>
              <div className="plan-owner-row">
                <UserIdentityLink
                  user={plan.owner}
                  userId={plan.ownerId}
                  variant="row"
                  avatarSize="md"
                  statusText={t('plans.detail.owner.planOwner')}
                  disabled={!plan.owner}
                />
                {showReportActions ? <ReportContentButton targetType="plan" targetId={plan.id} /> : null}
              </div>
            </section>

            <section className="plan-social-section plan-actions-section">
              <div className="plan-section-heading">
                <p className="eyebrow">{t('plans.detail.sections.actions')}</p>
                <h2>{isCancelled && isOwner ? t('plans.detail.actions.cancelledTitle') : isOwner ? t('plans.detail.actions.manageTitle') : canLeave ? t('plans.detail.actions.joinedTitle') : presentationState === 'join_closed' ? t('plans.status.joinClosed') : t('plans.detail.actions.join')}</h2>
                <p>{isCancelled && isOwner ? t('plans.detail.actions.cancelledLongBody') : isOwner && plan ? t('plans.detail.actions.ownerBody') : plan ? planJoinActionCopy(plan, presentationState ?? plan.status, t) : ''}</p>
              </div>
              <div className="plan-detail-actions plan-detail-actions--social">
                {isOwner ? (
                  <div className="plan-action-status plan-action-status--owner">
                    <span className="semantic-badge trade">{t('plans.detail.values.owner')}</span>
                    <strong>{t('plans.detail.actions.manageTitle')}</strong>
                    <p className="meta">{isCancelled ? t('plans.detail.actions.manageCancelledBody') : t('plans.detail.actions.manageBody')}</p>
                  </div>
                ) : null}
                {isOwner && !isCancelled && !canEditPlan ? (
                  <div className="plan-action-status">
                    <span className="semantic-badge neutral">{t('plans.detail.actions.editingLocked')}</span>
                    <p className="meta">{t('plans.create.edit.locked')}</p>
                  </div>
                ) : null}
                {canEditPlan ? (
                  <Link className="button primary" href={`/plans/${plan.id}/edit`}>{t('plans.detail.actions.edit')}</Link>
                ) : null}
                {isOwner && !isCancelled ? (
                  <button type="button" className="button secondary" onClick={() => void sharePlan()} disabled={shareLoading}>
                    {shareLoading ? t('plans.detail.actions.sharing') : t('plans.detail.actions.share')}
                  </button>
                ) : null}
                {canRemovePlan ? (
                  <button type="button" className="button danger" disabled={action.loading} onClick={() => void removePlan()}>
                    {action.loading ? t('plans.detail.actions.removing') : t('plans.detail.actions.remove')}
                  </button>
                ) : null}
                {isOwner && isCancelled ? (
                  <button type="button" className="button secondary" disabled={action.loading} onClick={() => void restorePlan()}>
                    {action.loading ? t('plans.detail.actions.restoring') : t('plans.detail.actions.restore')}
                  </button>
                ) : null}
                {isCancelled ? (
                  <div className="plan-action-status plan-action-status--cancelled">
                    <span className="semantic-badge danger">{t('plans.detail.actions.cancelledTitle')}</span>
                    <strong>{t('plans.detail.actions.cancelledTitle')}</strong>
                    <p className="meta">{t('plans.detail.actions.cancelledLongBody')}</p>
                  </div>
                ) : null}
                {!auth.isAuthenticated && presentationState === 'open' ? <Link className="button primary" href={`/auth?next=/plans/${plan.id}`}>{t('plans.detail.actions.loginTitle')}</Link> : null}
                {canJoin ? (
                  <div className="plan-action-primary">
                    <button type="button" className="button primary" disabled={action.loading} onClick={joinPlan}>{action.loading ? t('plans.detail.actions.joining') : t('plans.detail.actions.join')}</button>
                    <p className="meta">{plan.joinApprovalMode === 'automatic' ? t('plans.detail.actions.freeJoinFootnote') : t('plans.detail.actions.requestJoinFootnote')}</p>
                  </div>
                ) : null}
                {canLeave ? (
                  <div className="plan-action-status plan-action-status--joined">
                    <span className="semantic-badge success">{t('plans.participantStatus.accepted')}</span>
                    <strong>{t('plans.detail.actions.joinedTitle')}</strong>
                    <p className="meta">{t('plans.detail.actions.joinedBody')}</p>
                  </div>
                ) : null}
                {canLeave ? <button type="button" className="button secondary" disabled={action.loading} onClick={leavePlan}>{t('plans.detail.actions.leave')}</button> : null}
              </div>
              {!isCancelled && !isOwner && auth.isAuthenticated && participantCopy && !canLeave ? <p className="plan-action-note meta">{participantCopy}</p> : null}
              {action.message ? <p className="success-message">{action.message}</p> : null}
              {action.error ? <p className="form-error">{action.error}</p> : null}
            </section>

            <section className="plan-social-section">
              <div className="plan-section-heading">
                <p className="eyebrow">{t('plans.detail.sections.joinedPeople')}</p>
                <h2>{t('plans.detail.people.joinedHeading', { capacity: capacityLabel })}</h2>
              </div>
              <div className="plan-participant-list">
                {visibleParticipants.map((participant) => <ParticipantRow key={participant.id} participant={participant} ownerControls={isOwner && !isCancelled} onRemove={removeParticipant} />)}
                {visibleParticipants.length === 0 ? <p className="meta">{t('plans.detail.people.empty')}</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
