'use client';

import Link from 'next/link';
import type { MediaAssetDto, PlanDto, PlanParticipantDto, PlanPlaceDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { ReportContentButton } from '../../components/ReportContentButton';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { planDateTime, planMediaSrc, planMetadata, planOwnerName, planParticipantStatusLabel, planStatusLabel } from './plansPresentation';

type ActionState = {
  loading: boolean;
  message: string;
  error: string;
};

function ParticipantRow({ participant, ownerControls, onAction }: { participant: PlanParticipantDto; ownerControls: boolean; onAction: (participantId: string, status: 'accepted' | 'declined' | 'removed') => void }) {
  const name = participant.user?.profile?.displayName || participant.user?.profile?.handle || 'Hellowhen user';
  return (
    <article className="plan-participant-row">
      <div>
        <strong>{name}</strong>
        <p className="meta">{planParticipantStatusLabel(participant.status)}</p>
        {participant.message ? <p>{participant.message}</p> : null}
      </div>
      {ownerControls && participant.status === 'pending' ? (
        <div className="cta-row">
          <button type="button" className="button primary" onClick={() => onAction(participant.id, 'accepted')}>Accept</button>
          <button type="button" className="button secondary" onClick={() => onAction(participant.id, 'declined')}>Decline</button>
        </div>
      ) : null}
      {ownerControls && participant.status === 'accepted' ? (
        <button type="button" className="button secondary" onClick={() => onAction(participant.id, 'removed')}>Remove</button>
      ) : null}
    </article>
  );
}

function PlanMediaGallery({ media, emptyLabel }: { media?: MediaAssetDto[]; emptyLabel?: string }) {
  const visibleMedia = media ?? [];
  if (!visibleMedia.length) return emptyLabel ? <p className="meta">{emptyLabel}</p> : null;

  return (
    <div className="plan-media-gallery">
      {visibleMedia.map((item) => {
        const imageSrc = planMediaSrc(item);
        return imageSrc ? <img key={item.id} src={imageSrc} alt={item.filename ?? 'Plan image'} loading="lazy" /> : null;
      })}
    </div>
  );
}

function PlanPlaceCard({ place, index, planStartsAt, showReport }: { place: PlanPlaceDto; index: number; planStartsAt: string; showReport: boolean }) {
  const hasMedia = Boolean(place.media?.length);
  return (
    <article className="plan-place-card plan-place-card--detail">
      <div className="plan-place-card__media" aria-hidden="true">
        {hasMedia ? <img src={planMediaSrc(place.media?.[0])} alt="" loading="lazy" /> : <WebIcon name="trade" size={30} decorative />}
      </div>
      <div className="plan-place-card__body">
        <span className="semantic-badge instruction">Stop {index + 1}</span>
        <h4>{place.title}</h4>
        {place.note ? <p>{place.note}</p> : null}
        <p className="meta">{planDateTime(place.startsAt ?? planStartsAt)}</p>
        {place.addressPublicText ? <p className="meta">Public: {place.addressPublicText}</p> : null}
        {place.addressPrivateText ? <p className="meta">Private: {place.addressPrivateText}</p> : null}
        {hasMedia ? <PlanMediaGallery media={place.media} /> : null}
        {showReport ? <ReportContentButton targetType="plan_place" targetId={place.id} /> : null}
      </div>
    </article>
  );
}

export function PlanDetailClient({ planId }: { planId: string }) {
  const auth = useWebAuth();
  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [joinRequests, setJoinRequests] = useState<PlanParticipantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [action, setAction] = useState<ActionState>({ loading: false, message: '', error: '' });

  const isOwner = Boolean(auth.user?.id && plan?.ownerId === auth.user.id);
  const canRequestJoin = Boolean(auth.hydrated && auth.isAuthenticated && plan && !isOwner && !plan.myParticipantStatus);
  const canCancelPending = plan?.myParticipantStatus === 'pending';
  const canLeave = plan?.myParticipantStatus === 'accepted';
  const showReportActions = Boolean(auth.hydrated && auth.isAuthenticated && plan && !isOwner);

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

  const sortedParticipants = useMemo(() => [...(isOwner ? joinRequests : plan?.participants ?? [])].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()), [isOwner, joinRequests, plan?.participants]);

  async function requestJoin() {
    if (!auth.isAuthenticated) return;
    setAction({ loading: true, message: '', error: '' });
    try {
      await api.plans.requestJoin(planId, { message: joinMessage.trim() || undefined });
      setJoinMessage('');
      setAction({ loading: false, message: 'Join request sent.', error: '' });
      await loadPlan();
    } catch (joinError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(joinError, 'Could not request to join.') });
    }
  }

  async function updateMyStatus(status: 'cancelled' | 'left') {
    setAction({ loading: true, message: '', error: '' });
    try {
      await api.plans.updateMyJoinRequest(planId, { status });
      setAction({ loading: false, message: status === 'left' ? 'You left this Plan.' : 'Join request cancelled.', error: '' });
      await loadPlan();
    } catch (statusError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(statusError, 'Could not update your request.') });
    }
  }

  async function updateParticipant(participantId: string, status: 'accepted' | 'declined' | 'removed') {
    setAction({ loading: true, message: '', error: '' });
    try {
      await api.plans.updateJoinRequest(planId, participantId, { status });
      setAction({ loading: false, message: `Participant ${status}.`, error: '' });
      await Promise.all([loadPlan(), loadJoinRequests()]);
    } catch (statusError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(statusError, 'Could not update participant.') });
    }
  }

  return (
    <PlansFeatureGate>
      <main className="mobile-page plans-page">
        <section className="page-intro">
          <div>
            <PlansInternalBadge />
            <h2>{plan?.title ?? 'Plan'}</h2>
            <p>{plan ? planMetadata(plan) : 'Internal Plan preview.'}</p>
          </div>
          <Link className="button secondary page-intro__action" href="/plans">Plans</Link>
        </section>

        {loading ? <section className="mobile-card"><p className="meta">Loading Plan...</p></section> : null}
        {error ? <section className="mobile-card mobile-card--soft"><p>{error}</p></section> : null}

        {plan ? (
          <>
            <section className="mobile-card plan-detail-hero">
              <div className="status-row">
                <span className="semantic-badge trade">Plan</span>
                <span className="semantic-badge instruction">{planStatusLabel(plan.status)}</span>
                {plan.myParticipantStatus ? <span className="semantic-badge proposal">{planParticipantStatusLabel(plan.myParticipantStatus)}</span> : null}
              </div>
              <h2>{plan.title}</h2>
              <p>{plan.description}</p>
              <p className="meta">Posted by {planOwnerName(plan)} - starts {planDateTime(plan.startsAt)}</p>
              <PlanMediaGallery media={plan.media} emptyLabel="No Plan images attached yet." />
              <div className="plan-stat-grid">
                <span><strong>{plan.participantCount ?? 0}</strong> joined</span>
                <span><strong>{plan.pendingRequestCount ?? 0}</strong> pending</span>
                <span><strong>{plan.places?.length ?? 0}</strong> stops</span>
              </div>
              {showReportActions ? <ReportContentButton targetType="plan" targetId={plan.id} /> : null}
            </section>

            <section className="mobile-card">
              <h3>Places</h3>
              <div className="mobile-list">
                {(plan.places ?? []).map((place, index) => (
                  <PlanPlaceCard key={place.id} place={place} index={index} planStartsAt={plan.startsAt} showReport={showReportActions} />
                ))}
                {(plan.places ?? []).length === 0 ? <p className="meta">No places added yet.</p> : null}
              </div>
            </section>

            <section className="mobile-card">
              <h3>Join</h3>
              {!auth.isAuthenticated ? (
                <p><Link href={`/auth?next=/plans/${plan.id}`}>Log in</Link> to request to join this internal Plan.</p>
              ) : null}
              {isOwner ? <p className="meta">You own this Plan. Review requests below.</p> : null}
              {canRequestJoin ? (
                <div className="proposal-composer">
                  <textarea value={joinMessage} onChange={(event) => setJoinMessage(event.target.value)} maxLength={1000} placeholder="Write a short message to the owner." />
                  <button type="button" className="button primary" disabled={action.loading} onClick={requestJoin}>{action.loading ? 'Sending...' : 'Request to join'}</button>
                </div>
              ) : null}
              {canCancelPending ? <button type="button" className="button secondary" disabled={action.loading} onClick={() => updateMyStatus('cancelled')}>Cancel request</button> : null}
              {canLeave ? <button type="button" className="button secondary" disabled={action.loading} onClick={() => updateMyStatus('left')}>Leave Plan</button> : null}
              {action.message ? <p className="success-message">{action.message}</p> : null}
              {action.error ? <p className="form-error">{action.error}</p> : null}
            </section>

            <section className="mobile-card">
              <h3>{isOwner ? 'Join requests' : 'Participants'}</h3>
              <div className="mobile-list">
                {sortedParticipants.map((participant) => <ParticipantRow key={participant.id} participant={participant} ownerControls={isOwner} onAction={updateParticipant} />)}
                {sortedParticipants.length === 0 ? <p className="meta">No participants yet.</p> : null}
              </div>
            </section>

            <section className="mobile-card mobile-card--soft">
              <h3>Safety and support</h3>
              <p>Plans are internal, 18+, approval-first, and exact place details stay private until approval.</p>
              <Link className="button secondary" href="/account/support">Contact support</Link>
            </section>
          </>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
