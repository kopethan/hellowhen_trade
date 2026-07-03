'use client';

import Link from 'next/link';
import type { MediaAssetDto, PlacePresenceVerificationResponse, PlanDto, PlanJoinApprovalMode, PlanParticipantDto, PlanPlaceDto, PlanStatus } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { ReportContentButton } from '../../components/ReportContentButton';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { buildPublicPlanUrl, copyTextToClipboard } from '../../lib/publicUrls';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { UserIdentityLink } from '../users/UserIdentityLink';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { planDateTime, planMediaSrc, planMetadata, planOwnerName, planParticipantStatusLabel, planStatusLabel } from './plansPresentation';
import { resolvePlaceVisual, useResolvedPlaceVisualTheme } from './placeVisuals';
import { ContentLanguageDetailControls, useContentLanguageDetailSelection } from '../inventory/ContentLanguageDetailControls';

type ActionState = {
  loading: boolean;
  message: string;
  error: string;
};

function participantName(participant: PlanParticipantDto) {
  return participant.user?.profile?.displayName || participant.user?.profile?.handle || 'Hellowhen user';
}

function ParticipantRow({ participant, ownerControls, onRemove }: { participant: PlanParticipantDto; ownerControls: boolean; onRemove: (participantId: string) => void }) {
  const name = participantName(participant);
  return (
    <article className="plan-participant-row plan-participant-row--social">
      <div className="plan-participant-row__avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>
      <div className="plan-participant-row__body">
        <strong>{name}</strong>
        <p className="meta">{planParticipantStatusLabel(participant.status)}</p>
        {participant.message ? <p>{participant.message}</p> : null}
      </div>
      {ownerControls && participant.status === 'accepted' ? (
        <button type="button" className="button secondary compact" onClick={() => onRemove(participant.id)}>Remove</button>
      ) : null}
    </article>
  );
}

function PlanPlaceImage({ media }: { media?: MediaAssetDto | null }) {
  const imageSrc = planMediaSrc(media);
  if (!imageSrc) return <WebIcon name="calendar" size={28} decorative />;
  return <img src={imageSrc} alt="" loading="lazy" />;
}

function planPlaceDisplayMedia(place: PlanPlaceDto) {
  return place.media?.[0] ?? place.sourcePlace?.media?.[0] ?? null;
}

function detailStatusTone(status: PlanStatus) {
  if (status === 'open' || status === 'started') return 'success';
  if (status === 'cancelled' || status === 'expired' || status === 'hidden') return 'danger';
  return 'neutral';
}

function planModeLabel(plan: PlanDto) {
  if (plan.mode === 'remote') return 'Online';
  if (plan.mode === 'hybrid') return 'Local/Online';
  return 'Local';
}

function planVisibilityLabel(plan: PlanDto) {
  return plan.status === 'hidden' ? 'Hidden' : 'Public';
}

function planJoinModeLabel(mode: PlanJoinApprovalMode) {
  return mode === 'owner_approval' ? 'Approval needed' : 'Free join';
}

function planJoinActionCopy(plan: PlanDto) {
  if (plan.status === 'full') return 'This plan is full right now.';
  if (plan.status === 'started') return 'This plan has already started.';
  if (plan.status !== 'open') return `This plan is ${planStatusLabel(plan.status).toLowerCase()}.`;
  return plan.joinApprovalMode === 'automatic' ? 'Free join is open. You can leave later.' : 'Send your interest to join this plan.';
}

function participantStateCopy(status: PlanDto['myParticipantStatus']) {
  if (status === 'pending') return 'Your join request is waiting for the owner.';
  if (status === 'left') return 'You left this plan.';
  if (status === 'removed') return 'The owner removed you from this plan.';
  if (status === 'declined') return 'The owner declined this request.';
  if (status === 'cancelled') return 'Your join request was cancelled.';
  return status ? `Your status: ${planParticipantStatusLabel(status)}` : '';
}

function canJoinFromParticipantStatus(status: PlanDto['myParticipantStatus']) {
  return !status || status === 'left' || status === 'cancelled' || status === 'declined';
}

function planPlaceModeDisplay(place: PlanPlaceDto) {
  return place.mode === 'remote' ? 'Online' : 'Local';
}

function planPlaceSourceLabel(place: PlanPlaceDto) {
  if (place.source === 'hellowhen_library') return 'Library place';
  if (place.source === 'my_place') return 'My place';
  return 'Custom stop';
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

function planPlaceLocation(place: PlanPlaceDto): PlanPlaceLocationDisplay | null {
  if (place.mode === 'remote') {
    const value = place.onlineUrl || place.onlineLabel || '';
    if (!value) return null;
    return {
      kind: 'remote',
      label: place.onlineLabel && place.onlineUrl ? place.onlineLabel : 'Online place',
      value,
      href: place.onlineUrl || undefined,
      actionLabel: place.onlineUrl ? 'Open link' : undefined,
    };
  }

  const value = place.addressPublicText || place.sourcePlace?.addressPublicText || place.sourcePlace?.areaLabel || '';
  if (!value) return null;
  return {
    kind: 'local',
    label: 'Offline address',
    value,
    href: buildMapsSearchUrl(value),
    actionLabel: 'Open in Maps',
  };
}

type PlanPlacePresenceNotice = {
  tone: 'success' | 'warning' | 'info';
  title: string;
  body: string;
};

function isOfflinePlanPlace(place: PlanPlaceDto) {
  return place.mode !== 'remote';
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

function buildPlanRouteMapsLink(places: PlanPlaceDto[]): PlanRouteMapsLink | null {
  const offlineQueries = places.map(planPlaceMapsQuery).filter((value): value is string => Boolean(value));
  if (!offlineQueries.length) return null;
  const includedQueries = offlineQueries.slice(0, GOOGLE_MAPS_MAX_ROUTE_STOPS);
  const skippedOnlineCount = places.filter((place) => place.mode === 'remote').length;
  const truncatedCount = Math.max(offlineQueries.length - includedQueries.length, 0);
  const bodyParts = [
    includedQueries.length > 1 ? `${includedQueries.length} offline stops` : '1 offline stop',
    skippedOnlineCount ? `${skippedOnlineCount} online ${skippedOnlineCount === 1 ? 'place is' : 'places are'} skipped` : '',
    truncatedCount ? `${truncatedCount} later ${truncatedCount === 1 ? 'stop is' : 'stops are'} skipped` : '',
  ].filter(Boolean);
  return {
    href: buildGoogleMapsDirectionsUrl(includedQueries),
    label: includedQueries.length > 1 ? 'Open route in Google Maps' : 'Open in Google Maps',
    body: bodyParts.join(' · '),
    stopCount: includedQueries.length,
    totalStopCount: offlineQueries.length,
    skippedOnlineCount,
  };
}

function formatPresenceDistance(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (value < 1000) return `${Math.round(value)}m away`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}km away`;
}

function presenceNoticeFromVerificationResponse(response: PlacePresenceVerificationResponse): PlanPlacePresenceNotice {
  const distanceLabel = formatPresenceDistance(response.distanceMeters ?? response.verification.distanceMeters);
  if (response.accepted) {
    return {
      tone: 'success',
      title: response.alreadyVerified ? 'Already verified here' : 'Verified at this place',
      body: distanceLabel ? `Your browser location was accepted · ${distanceLabel}.` : 'Your browser location was accepted for this offline place.',
    };
  }
  if (response.verification.rejectionReason === 'gps_accuracy_too_low') {
    return {
      tone: 'warning',
      title: 'Location accuracy too low',
      body: 'Move closer to the place, step outside if possible, and try again with a stronger location signal.',
    };
  }
  if (response.verification.rejectionReason === 'too_far_from_place') {
    return {
      tone: 'warning',
      title: 'Too far from this place',
      body: distanceLabel ? `Your device seems ${distanceLabel}. Move closer and try again.` : 'Move closer to the selected offline place and try again.',
    };
  }
  if (response.verification.rejectionReason === 'mock_location_detected') {
    return {
      tone: 'warning',
      title: 'Mock location detected',
      body: 'Turn off mock location tools and try again from your real device location.',
    };
  }
  if (response.verification.rejectionReason === 'location_timestamp_stale' || response.verification.rejectionReason === 'location_timestamp_future') {
    return {
      tone: 'warning',
      title: 'Location check expired',
      body: 'Refresh this device location and try again. We only accept fresh browser location checks.',
    };
  }
  if (response.verification.rejectionReason === 'suspicious_location_jump') {
    return {
      tone: 'warning',
      title: 'Location jump looks unusual',
      body: 'Wait a bit before verifying again. This protects offline trust stats from impossible travel patterns.',
    };
  }
  return {
    tone: 'warning',
    title: 'Could not verify presence',
    body: 'Try again when this device has a stronger location signal.',
  };
}

function webVerificationPlatform() {
  if (typeof navigator === 'undefined') return 'web';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile_web' : 'web';
}

function getBrowserLocationErrorMessage(cause: unknown) {
  const apiMessage = getFriendlyApiErrorMessage(cause, '');
  if (apiMessage) return apiMessage;
  const geolocationError = cause && typeof cause === 'object' && 'code' in cause ? cause as { code?: number } : null;
  if (geolocationError?.code === 1) return 'Allow location access only when you want to verify that you are at this place.';
  if (geolocationError?.code === 2) return 'This device could not provide a usable location. Try again with a stronger signal.';
  if (geolocationError?.code === 3) return 'Location check timed out. Move closer, wait a moment, and try again.';
  return 'This browser could not confirm your location. Try again from a phone or another device.';
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

function PlanRouteDesktopPreview({ places, planStartsAt }: { places: PlanPlaceDto[]; planStartsAt: string }) {
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

  const location = planPlaceLocation(preview.place);
  const previewDescription = planPlaceDescription(preview.place);

  return (
    <aside className="plan-route-desktop-preview" aria-label="Route visual preview">
      <div className="plan-route-desktop-preview__media">
        {preview.visual.url ? (
          preview.visual.kind === 'media' && preview.displayMedia ? <PlanPlaceImage media={preview.displayMedia} /> : <img src={preview.visual.url} alt="" loading="lazy" className="is-static-map" />
        ) : (
          <WebIcon name="location-on" size={34} decorative />
        )}
      </div>
      <div className="plan-route-desktop-preview__copy">
        <p className="eyebrow">Route preview</p>
        <h3>{preview.place.title}</h3>
        <p>{planPlaceTimeRange(preview.place, planStartsAt)}</p>
        {location ? <small>{location.value}</small> : null}
        {previewDescription ? <span>{previewDescription}</span> : null}
      </div>
      <div className="plan-route-desktop-preview__stops" aria-label="Plan route stops">
        {places.map((place, index) => (
          <div key={`route-preview-stop-${place.id}`} className={`plan-route-desktop-preview__stop${place.id === preview.place.id ? ' is-active' : ''}`}>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <strong>{place.title}</strong>
              <small>{planPlaceTimeRange(place, planStartsAt)} · {planPlaceModeDisplay(place)}</small>
            </div>
          </div>
        ))}
      </div>
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
  const displayMedia = planPlaceDisplayMedia(place);
  const themeMode = useResolvedPlaceVisualTheme();
  const placeVisual = resolvePlaceVisual({ media: displayMedia, staticMap: place.staticMap ?? place.sourcePlace?.staticMap ?? null, themeMode });
  const placeTime = planPlaceTimeRange(place, planStartsAt);
  const description = planPlaceDescription(place);
  const languageSelection = useContentLanguageDetailSelection({
    displayLanguage: place.displayLanguage ?? place.sourcePlace?.displayLanguage ?? null,
    fallbackTitle: place.title,
    fallbackDescription: description,
  });
  const location = planPlaceLocation(place);
  const [locationCopyNotice, setLocationCopyNotice] = useState('');
  const hasVerificationCoordinates = Boolean(planPlaceVerificationCoordinates(place));
  const showPresenceVerification = isOfflinePlanPlace(place) && (canVerifyPresence || presenceNotice || hasVerificationCoordinates);
  const verificationDisabled = isVerifyingPresence || !hasVerificationCoordinates;

  async function copyLocationValue(value: string) {
    const copied = await copyTextToClipboard(value);
    setLocationCopyNotice(copied ? 'Copied.' : 'Could not copy.');
  }

  return (
    <article className="plan-route-stop">
      <div className="plan-route-stop__index" aria-hidden="true">{index + 1}</div>
      <div className="plan-route-stop__body">
        <div className="plan-route-stop__topline">
          <span>{placeTime}</span>
          <span>{planPlaceModeDisplay(place)}</span>
          <span>{planPlaceSourceLabel(place)}</span>
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
                      {location.kind === 'local' ? 'Copy address' : 'Copy link'}
                    </button>
                  </div>
                  {locationCopyNotice ? <p className="plan-route-stop__location-notice" role="status">{locationCopyNotice}</p> : null}
                </div>
              </details>
            ) : null}
            {languageSelection.description ? <p className="plan-route-stop__description">{languageSelection.description}</p> : null}
            {placeVisual.url ? (
              <div className="plan-route-stop__media">
                {placeVisual.kind === 'media' && displayMedia ? <PlanPlaceImage media={displayMedia} /> : <img src={placeVisual.url} alt="" loading="lazy" className="is-static-map" />}
              </div>
            ) : null}
            {showPresenceVerification ? (
              <div className={`plan-route-stop__presence plan-route-stop__presence--${presenceNotice?.tone ?? 'info'}`}>
                <div className="plan-route-stop__presence-copy">
                  <strong>{presenceNotice?.title ?? (hasVerificationCoordinates ? 'GPS verification' : 'GPS unavailable')}</strong>
                  <p>{presenceNotice?.body ?? (hasVerificationCoordinates ? 'Use this device location when you reach this place. Mobile web usually works best.' : 'Google-confirmed map position needed before browser location verification can work.')}</p>
                </div>
                {hasVerificationCoordinates ? (
                  <button
                    type="button"
                    className="plan-route-stop__presence-button"
                    disabled={verificationDisabled}
                    onClick={() => onVerifyPresence(place)}
                  >
                    <WebIcon name="location-on" size={14} decorative />
                    <span>{isVerifyingPresence ? 'Checking...' : 'Verify here'}</span>
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
  const currentParticipantStatus = plan?.myParticipantStatus ?? null;
  const canJoin = Boolean(auth.hydrated && auth.isAuthenticated && plan && !isOwner && plan.status === 'open' && canJoinFromParticipantStatus(currentParticipantStatus));
  const canLeave = Boolean(!isOwner && currentParticipantStatus === 'accepted');
  const canVerifyPresence = Boolean(auth.hydrated && auth.isAuthenticated && plan && (isOwner || currentParticipantStatus === 'accepted'));
  const canCancelPlan = Boolean(isOwner && plan && plan.status !== 'cancelled');
  const participantCopy = !isOwner ? participantStateCopy(currentParticipantStatus) : '';
  const showReportActions = Boolean(auth.hydrated && auth.isAuthenticated && plan && !isOwner);
  const places = plan?.places ?? [];
  const routeMapsLink = buildPlanRouteMapsLink(places);
  const joinedCount = plan?.participantCount ?? 0;
  const placeCount = places.length;
  const capacityLabel = plan?.maxParticipants ? `${joinedCount}/${plan.maxParticipants}` : String(joinedCount);

  async function loadPlan() {
    setLoading(true);
    setError('');
    try {
      const response = await api.plans.get(planId);
      setPlan(response.plan);
    } catch (loadError) {
      setPlan(null);
      setError(getFriendlyApiErrorMessage(loadError, 'Could not load Plan.'));
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
      setAction({ loading: false, message: 'You joined this Plan.', error: '' });
      await loadPlan();
    } catch (joinError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(joinError, 'Could not join this Plan.') });
    }
  }

  async function leavePlan() {
    setAction({ loading: true, message: '', error: '' });
    try {
      await api.plans.leave(planId);
      setAction({ loading: false, message: 'You left this Plan.', error: '' });
      await loadPlan();
    } catch (statusError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(statusError, 'Could not leave this Plan.') });
    }
  }

  async function removeParticipant(participantId: string) {
    setAction({ loading: true, message: '', error: '' });
    try {
      await api.plans.updateJoinRequest(planId, participantId, { status: 'removed' });
      setAction({ loading: false, message: 'Participant removed.', error: '' });
      await Promise.all([loadPlan(), loadJoinRequests()]);
    } catch (statusError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(statusError, 'Could not remove participant.') });
    }
  }

  async function sharePlan() {
    if (!plan) return;
    const url = buildPublicPlanUrl(plan.id);
    const shareData = { title: plan.title, text: `Open this Plan on Hellowhen: ${plan.title}`, url };
    const webNavigator = typeof navigator !== 'undefined' ? navigator as Navigator & { share?: (data: typeof shareData) => Promise<void> } : null;

    setShareLoading(true);
    setShareNotice('');
    try {
      if (webNavigator?.share) {
        await webNavigator.share(shareData);
        setShareNotice('Share sheet opened.');
        return;
      }

      const copied = await copyTextToClipboard(url);
      setShareNotice(copied ? 'Plan link copied.' : 'Could not copy the Plan link.');
    } catch (cause) {
      const aborted = typeof DOMException !== 'undefined' && cause instanceof DOMException && cause.name === 'AbortError';
      if (!aborted) {
        const copied = await copyTextToClipboard(url);
        setShareNotice(copied ? 'Plan link copied.' : 'Could not copy the Plan link.');
      }
    } finally {
      setShareLoading(false);
    }
  }

  async function cancelPlan() {
    if (!plan || !canCancelPlan) return;
    const confirmed = window.confirm('Cancel this Plan? People will no longer be able to join, but the Plan will remain visible with a Cancelled status.');
    if (!confirmed) return;

    setAction({ loading: true, message: '', error: '' });
    try {
      const response = await api.plans.update(plan.id, { status: 'cancelled' });
      setPlan(response.plan);
      setAction({ loading: false, message: 'Plan cancelled. It remains visible with a Cancelled status.', error: '' });
    } catch (cancelError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(cancelError, 'Could not cancel this Plan.') });
    }
  }

  async function verifyPlanPlacePresence(place: PlanPlaceDto) {
    if (!plan || verifyingPlaceId) return;
    if (!auth.isAuthenticated) {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'info', title: 'Log in to verify', body: 'Log in first, then use this device location when you reach this offline place.' },
      }));
      return;
    }
    if (!isOwner && currentParticipantStatus !== 'accepted') {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'info', title: 'Join this Plan first', body: 'Presence verification is only available to the owner or joined participants.' },
      }));
      return;
    }
    if (!isOfflinePlanPlace(place)) return;
    if (!planPlaceVerificationCoordinates(place)) {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'warning', title: 'Map position needed', body: 'This offline place needs a Google-confirmed map position before browser location verification can work.' },
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
      setPresenceNotices((current) => ({ ...current, [place.id]: presenceNoticeFromVerificationResponse(response) }));
    } catch (caughtError) {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'warning', title: 'Verification failed', body: getBrowserLocationErrorMessage(caughtError) },
      }));
    } finally {
      setVerifyingPlaceId(null);
    }
  }

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="plan-detail-page plan-detail-page--web">
        <header className="plan-detail-toolbar" aria-label="Plan navigation">
          <Link href="/plans" className="plan-detail-back-link">
            <WebIcon name="back" size={17} decorative />
            <span>Plan</span>
          </Link>
          <div className="plan-detail-toolbar__actions">
            <PlansInternalBadge plansVisible={plansVisible} />
            {plan ? (
              <button type="button" className="plan-detail-icon-button" onClick={() => void sharePlan()} disabled={shareLoading}>
                <WebIcon name="share" size={17} decorative />
                <span>{shareLoading ? 'Sharing...' : 'Share'}</span>
              </button>
            ) : null}
          </div>
        </header>

        {loading ? <section className="plan-social-section"><p className="meta">Loading Plan...</p></section> : null}
        {error ? <section className="plan-social-section plan-social-section--soft"><p>{error}</p></section> : null}

        {plan ? (
          <>
            <section className="plan-detail-hero-social">
              <div className="status-row plan-detail-status-row">
                <span className={`semantic-badge ${detailStatusTone(plan.status)}`}>{planStatusLabel(plan.status)}</span>
                <span className="semantic-badge trade">Plan</span>
              </div>
              <h1>{plan.title}</h1>
              {plan.description ? <p className="plan-detail-hero-description">{plan.description}</p> : null}
              <div className="plan-detail-owner-row">
                <span className="meta">Starts {planDateTime(plan.startsAt)}</span>
                <span className="meta">·</span>
                <span className="meta">Posted by</span>
                <UserIdentityLink
                  user={plan.owner}
                  userId={plan.ownerId}
                  variant="chip"
                  avatarSize="sm"
                  statusText="Owner"
                  showHandle={false}
                  disabled={!plan.owner}
                />
              </div>
              <div className="plan-detail-chip-row" aria-label="Plan summary">
                <span className={`semantic-badge ${detailStatusTone(plan.status)}`}>{planStatusLabel(plan.status)}</span>
                <span className="semantic-badge instruction">{planJoinModeLabel(plan.joinApprovalMode)}</span>
                <span className="semantic-badge neutral">{placeCount} {placeCount === 1 ? 'place' : 'places'}</span>
                <span className="semantic-badge neutral">{planModeLabel(plan)}</span>
              </div>
              {shareNotice ? <p className="plan-share-notice" role="status" aria-live="polite">{shareNotice}</p> : null}
            </section>

            <section className="plan-social-section trade-thread-split-section trade-thread-split-section--clean plan-discussion-entry-section" aria-labelledby="plan-conversations-title">
              <div className="plan-section-heading trade-thread-section-heading trade-thread-section-heading--clean">
                <div>
                  <p className="eyebrow">Discussion</p>
                  <h2 id="plan-conversations-title">Public discussion</h2>
                </div>
              </div>
              <div className="trade-thread-action-grid trade-thread-action-grid--simple trade-thread-action-grid--clean">
                <Link href={`/plans/${plan.id}/discussion`} className="trade-thread-action-card trade-thread-action-card--public" aria-label="Open public discussion">
                  <span className="trade-thread-action-card__icon trade-thread-action-card__icon--public"><WebIcon name="activity" size={20} decorative /></span>
                  <span className="trade-thread-action-card__body">
                    <strong>Public discussion</strong>
                    <small>Ask visible questions about joining, timing, places, or plan details.</small>
                  </span>
                  <span className="trade-thread-action-card__cta">Open<WebIcon name="arrow-right" size={14} decorative /></span>
                </Link>
              </div>
            </section>

            <section className="plan-social-section plan-route-section plan-route-section--desktop-split">
              <div className="plan-section-heading plan-section-heading--with-action">
                <div>
                  <p className="eyebrow">Route</p>
                  <h2>Places and times</h2>
                </div>
                {routeMapsLink ? (
                  <a className="plan-route-maps-action" href={routeMapsLink.href} target="_blank" rel="noreferrer">
                    <WebIcon name="location-on" size={15} decorative />
                    <span>{routeMapsLink.label}</span>
                  </a>
                ) : null}
              </div>
              {routeMapsLink ? <p className="plan-route-maps-hint">{routeMapsLink.body}</p> : null}
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
                  {places.length === 0 ? <p className="meta">No places added yet.</p> : null}
                </div>
                <PlanRouteDesktopPreview places={places} planStartsAt={plan.startsAt} />
              </div>
            </section>

            <section className="plan-social-section">
              <div className="plan-section-heading">
                <p className="eyebrow">Details</p>
                <h2>Plan info</h2>
              </div>
              <dl className="plan-detail-list">
                <PlanDetailItem label="Status" value={planStatusLabel(plan.status)} />
                <PlanDetailItem label="Visibility" value={planVisibilityLabel(plan)} />
                <PlanDetailItem label="Join mode" value={planJoinModeLabel(plan.joinApprovalMode)} />
                <PlanDetailItem label="Time" value={planMetadata(plan)} />
                <PlanDetailItem label="Place mode" value={planModeLabel(plan)} />
                <PlanDetailItem label="Created" value={planDateTime(plan.createdAt)} />
              </dl>
            </section>

            <section className="plan-social-section">
              <div className="plan-section-heading">
                <p className="eyebrow">Owner</p>
                <h2>Posted by {planOwnerName(plan)}</h2>
              </div>
              <div className="plan-owner-row">
                <UserIdentityLink
                  user={plan.owner}
                  userId={plan.ownerId}
                  variant="row"
                  avatarSize="md"
                  statusText="Plan owner"
                  disabled={!plan.owner}
                />
                {showReportActions ? <ReportContentButton targetType="plan" targetId={plan.id} /> : null}
              </div>
            </section>

            <section className="plan-social-section plan-actions-section">
              <div className="plan-section-heading">
                <p className="eyebrow">Actions</p>
                <h2>{isOwner ? 'Manage this Plan' : canLeave ? 'You joined this Plan' : 'Join this Plan'}</h2>
                <p>{isOwner && plan ? 'Share this Plan or cancel it. Plan content editing is locked after publishing.' : plan ? planJoinActionCopy(plan) : ''}</p>
              </div>
              <div className="plan-detail-actions plan-detail-actions--social">
                {isOwner ? (
                  <div className="plan-action-status plan-action-status--owner">
                    <span className="semantic-badge trade">Owner</span>
                    <strong>Manage Plan</strong>
                    <p className="meta">You can share this Plan or cancel it. Editing places and times is locked after publishing.</p>
                  </div>
                ) : null}
                {isOwner ? (
                  <button type="button" className="button secondary" onClick={() => void sharePlan()} disabled={shareLoading}>
                    {shareLoading ? 'Sharing...' : 'Share Plan'}
                  </button>
                ) : null}
                {canCancelPlan ? (
                  <button type="button" className="button danger" disabled={action.loading} onClick={() => void cancelPlan()}>
                    {action.loading ? 'Cancelling...' : 'Cancel Plan'}
                  </button>
                ) : null}
                {isOwner && plan.status === 'cancelled' ? (
                  <div className="plan-action-status plan-action-status--joined">
                    <span className="semantic-badge danger">Cancelled</span>
                    <strong>This Plan is cancelled</strong>
                    <p className="meta">It remains visible for context, but people can no longer join.</p>
                  </div>
                ) : null}
                {!auth.isAuthenticated ? <Link className="button primary" href={`/auth?next=/plans/${plan.id}`}>Log in to join</Link> : null}
                {canJoin ? (
                  <div className="plan-action-primary">
                    <button type="button" className="button primary" disabled={action.loading} onClick={joinPlan}>{action.loading ? 'Joining...' : 'Join Plan'}</button>
                    <p className="meta">{plan.joinApprovalMode === 'automatic' ? 'Free join · leave anytime.' : 'Join request · owner review.'}</p>
                  </div>
                ) : null}
                {canLeave ? (
                  <div className="plan-action-status plan-action-status--joined">
                    <span className="semantic-badge success">Joined</span>
                    <strong>You joined this Plan</strong>
                    <p className="meta">You can leave if this Plan is no longer useful.</p>
                  </div>
                ) : null}
                {canLeave ? <button type="button" className="button secondary" disabled={action.loading} onClick={leavePlan}>Leave Plan</button> : null}
              </div>
              {!isOwner && auth.isAuthenticated && participantCopy && !canLeave ? <p className="plan-action-note meta">{participantCopy}</p> : null}
              {action.message ? <p className="success-message">{action.message}</p> : null}
              {action.error ? <p className="form-error">{action.error}</p> : null}
            </section>

            <section className="plan-social-section">
              <div className="plan-section-heading">
                <p className="eyebrow">People</p>
                <h2>{capacityLabel} joined</h2>
              </div>
              <div className="plan-participant-list">
                {visibleParticipants.map((participant) => <ParticipantRow key={participant.id} participant={participant} ownerControls={isOwner} onRemove={removeParticipant} />)}
                {visibleParticipants.length === 0 ? <p className="meta">No participants yet.</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
