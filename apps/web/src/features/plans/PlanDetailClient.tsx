'use client';

import Link from 'next/link';
import type { MediaAssetDto, PlanDto, PlanJoinApprovalMode, PlanParticipantDto, PlanPlaceDto, PlanStatus } from '@hellowhen/contracts';
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

function planPlaceLocation(place: PlanPlaceDto) {
  if (place.mode === 'remote') {
    const label = place.onlineLabel && place.onlineUrl ? place.onlineLabel : 'Online';
    const value = place.onlineUrl || place.onlineLabel || '';
    return value ? `${label} · ${value}` : '';
  }
  const value = place.addressPublicText || place.sourcePlace?.areaLabel || '';
  return value ? `Place · ${value}` : '';
}

function PlanDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="plan-detail-list-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PlanPlaceCard({ place, index, planStartsAt, showReport }: { place: PlanPlaceDto; index: number; planStartsAt: string; showReport: boolean }) {
  const media = place.media?.[0] ?? null;
  const sourceMedia = place.sourcePlace?.media?.[0] ?? null;
  const displayMedia = media ?? sourceMedia ?? null;
  const placeTime = planPlaceTimeRange(place, planStartsAt);
  const description = planPlaceDescription(place);
  const location = planPlaceLocation(place);

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
            <h4>{place.title}</h4>
            {location ? <p className="meta">{location}</p> : null}
            {displayMedia ? (
              <div className="plan-route-stop__media">
                <PlanPlaceImage media={displayMedia} />
              </div>
            ) : null}
            {description ? <p>{description}</p> : null}
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

  const isOwner = Boolean(auth.user?.id && plan?.ownerId === auth.user.id);
  const currentParticipantStatus = plan?.myParticipantStatus ?? null;
  const canJoin = Boolean(auth.hydrated && auth.isAuthenticated && plan && !isOwner && plan.status === 'open' && canJoinFromParticipantStatus(currentParticipantStatus));
  const canLeave = Boolean(!isOwner && currentParticipantStatus === 'accepted');
  const canCancelPlan = Boolean(isOwner && plan && plan.status !== 'cancelled');
  const participantCopy = !isOwner ? participantStateCopy(currentParticipantStatus) : '';
  const showReportActions = Boolean(auth.hydrated && auth.isAuthenticated && plan && !isOwner);
  const places = plan?.places ?? [];
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

            <section className="plan-social-section plan-route-section">
              <div className="plan-section-heading">
                <p className="eyebrow">Route</p>
                <h2>Places and times</h2>
              </div>
              <div className="plan-route-list">
                {places.map((place, index) => (
                  <PlanPlaceCard key={place.id} place={place} index={index} planStartsAt={plan.startsAt} showReport={showReportActions} />
                ))}
                {places.length === 0 ? <p className="meta">No places added yet.</p> : null}
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
