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
import { PlanDtoPreviewDeck } from './PlanPreviewDeck';
import { planDateTime, planMediaSrc, planMetadata, planOwnerName, planParticipantStatusLabel, planPlaceModeLabel } from './plansPresentation';

type ActionState = {
  loading: boolean;
  message: string;
  error: string;
};

function ParticipantRow({ participant, ownerControls, onRemove }: { participant: PlanParticipantDto; ownerControls: boolean; onRemove: (participantId: string) => void }) {
  const name = participant.user?.profile?.displayName || participant.user?.profile?.handle || 'Hellowhen user';
  return (
    <article className="plan-participant-row">
      <div>
        <strong>{name}</strong>
        <p className="meta">{planParticipantStatusLabel(participant.status)}</p>
        {participant.message ? <p>{participant.message}</p> : null}
      </div>
      {ownerControls && participant.status === 'accepted' ? (
        <button type="button" className="button secondary" onClick={() => onRemove(participant.id)}>Remove</button>
      ) : null}
    </article>
  );
}

function PlanPlaceImage({ media }: { media?: MediaAssetDto | null }) {
  const imageSrc = planMediaSrc(media);
  if (!imageSrc) return <WebIcon name="trade" size={30} decorative />;
  return <img src={imageSrc} alt="" loading="lazy" />;
}

function PlanPlaceCard({ place, index, planStartsAt, showReport }: { place: PlanPlaceDto; index: number; planStartsAt: string; showReport: boolean }) {
  const media = place.media?.[0] ?? null;
  return (
    <article className="plan-place-card plan-place-card--detail">
      <div className="plan-place-card__media" aria-hidden="true">
        <PlanPlaceImage media={media} />
      </div>
      <div className="plan-place-card__body">
        <div className="status-row">
          <span className="semantic-badge instruction">Place {index + 1}</span>
          <span className="semantic-badge neutral">{planPlaceModeLabel(place.mode)}</span>
        </div>
        <h4>{place.title}</h4>
        <p className="meta">{planDateTime(place.startsAt ?? planStartsAt)}</p>
        {place.addressPublicText ? <p className="meta">{place.mode === 'remote' ? 'Link / online location' : 'Address'}: {place.addressPublicText}</p> : null}
        {place.note ? <p>{place.note}</p> : null}
        {media ? <img className="plan-place-card__full-image" src={planMediaSrc(media)} alt={media.filename ?? `${place.title} image`} loading="lazy" /> : null}
        {showReport ? <ReportContentButton targetType="plan_place" targetId={place.id} /> : null}
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

  const isOwner = Boolean(auth.user?.id && plan?.ownerId === auth.user.id);
  const canJoin = Boolean(auth.hydrated && auth.isAuthenticated && plan && !isOwner && !['accepted', 'pending', 'removed'].includes(plan.myParticipantStatus ?? ''));
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

  const visibleParticipants = useMemo(() => {
    const source = isOwner ? joinRequests : plan?.participants ?? [];
    return [...source].filter((participant) => participant.status === 'accepted').sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }, [isOwner, joinRequests, plan?.participants]);

  async function joinPlan() {
    if (!auth.isAuthenticated) return;
    setAction({ loading: true, message: '', error: '' });
    try {
      await api.plans.requestJoin(planId, {});
      setAction({ loading: false, message: 'You joined this Plan.', error: '' });
      await loadPlan();
    } catch (joinError) {
      setAction({ loading: false, message: '', error: getFriendlyApiErrorMessage(joinError, 'Could not join this Plan.') });
    }
  }

  async function leavePlan() {
    setAction({ loading: true, message: '', error: '' });
    try {
      await api.plans.updateMyJoinRequest(planId, { status: 'left' });
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

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page">
        <section className="page-intro">
          <div>
            <PlansInternalBadge plansVisible={plansVisible} />
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
                {plan.myParticipantStatus === 'accepted' ? <span className="semantic-badge success">Joined</span> : null}
              </div>
              <h3>{plan.title}</h3>
              <p>{plan.description}</p>
              <p className="meta">By {planOwnerName(plan)} · {planMetadata(plan)}</p>
              <div className="plan-stat-grid">
                <span><strong>{plan.participantCount ?? 0}</strong> joined</span>
                <span><strong>{plan.places?.length ?? 0}</strong> places</span>
              </div>
              {isOwner ? (
                <div className="cta-row">
                  <Link className="button secondary" href={`/plans/${plan.id}/edit`}>Edit Plan</Link>
                </div>
              ) : null}
              {showReportActions ? <ReportContentButton targetType="plan" targetId={plan.id} /> : null}
            </section>

            <section className="mobile-card plan-form__preview">
              <h3>Feed deck preview</h3>
              <PlanDtoPreviewDeck plan={plan} />
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
                <p><Link href={`/auth?next=/plans/${plan.id}`}>Log in</Link> to join this internal Plan.</p>
              ) : null}
              {isOwner ? <p className="meta">You own this Plan. People can join instantly while this hidden flow is enabled.</p> : null}
              {canJoin ? <button type="button" className="button primary full" disabled={action.loading} onClick={joinPlan}>{action.loading ? 'Joining...' : 'Join Plan'}</button> : null}
              {canLeave ? <button type="button" className="button secondary full" disabled={action.loading} onClick={leavePlan}>Leave Plan</button> : null}
              {plan.myParticipantStatus && !canLeave && !canJoin && !isOwner ? <p className="meta">Your status: {planParticipantStatusLabel(plan.myParticipantStatus)}</p> : null}
              {action.message ? <p className="success-message">{action.message}</p> : null}
              {action.error ? <p className="form-error">{action.error}</p> : null}
            </section>

            <section className="mobile-card">
              <h3>Participants</h3>
              <div className="mobile-list">
                {visibleParticipants.map((participant) => <ParticipantRow key={participant.id} participant={participant} ownerControls={isOwner} onRemove={removeParticipant} />)}
                {visibleParticipants.length === 0 ? <p className="meta">No participants yet.</p> : null}
              </div>
            </section>

            <section className="mobile-card mobile-card--soft">
              <h3>Safety and support</h3>
              <p>Plans are hidden, 18+, and internal while testing. Use report or support if a Plan or place looks unsafe.</p>
              <Link className="button secondary" href="/account/support">Contact support</Link>
            </section>
          </>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
