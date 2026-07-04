'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime } from '../../../lib/webFormat';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type PlanStatusFilter = 'all' | 'draft' | 'open' | 'full' | 'started' | 'completed' | 'cancelled' | 'expired' | 'hidden';
type PlanAction = 'hide' | 'restore' | 'cancel' | 'mark_reviewed';
type PlanMessageAction = 'hide' | 'restore' | 'mark_reviewed';
type PlanMessageStatusFilter = 'all' | 'visible' | 'hidden' | 'deleted';
type PlanMode = 'all' | 'local' | 'remote' | 'hybrid';

type AdminUser = {
  id: string;
  email?: string | null;
  role?: string | null;
  trustTier?: string | null;
  profile?: { displayName?: string | null; handle?: string | null; avatarUrl?: string | null } | null;
};

type AdminPlanReport = {
  id: string;
  reason: string;
  status: string;
  details?: string | null;
  targetType: string;
  targetId: string;
  createdAt?: string | null;
  reporter?: AdminUser | null;
};

type AdminPlanPublicMessage = {
  id: string;
  planId: string;
  authorId: string;
  body: string;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  editedAt?: string | null;
  hiddenAt?: string | null;
  deletedAt?: string | null;
  moderationNote?: string | null;
  author?: AdminUser | null;
  hiddenBy?: AdminUser | null;
  reports?: AdminPlanReport[];
  reportsCount?: number;
  latestReportReason?: string | null;
  latestReportStatus?: string | null;
};


type AdminPlacePresenceVerification = {
  id: string;
  userId: string;
  planId: string;
  planPlaceId: string;
  sourcePlaceId?: string | null;
  source?: string | null;
  status: string;
  latitudeRounded?: number | null;
  longitudeRounded?: number | null;
  accuracyMeters?: number | null;
  distanceMeters?: number | null;
  maxDistanceMeters?: number | null;
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  createdAt?: string | null;
  user?: AdminUser | null;
  planPlace?: { id: string; title: string; mode?: string | null; addressPublicText?: string | null; formattedAddress?: string | null; onlineLabel?: string | null } | null;
};

type AdminPlan = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  status: string;
  visibility?: string;
  publicDiscoverable?: boolean;
  category?: string | null;
  mode?: string | null;
  locationLabel?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  cancelledAt?: string | null;
  owner?: AdminUser | null;
  places?: Array<{ id: string; title: string; mode?: string | null; startsAt?: string | null; sourcePlace?: { id?: string; title?: string; source?: string; status?: string; owner?: AdminUser | null } | null }>;
  participants?: Array<{ id: string; status: string; message?: string | null; createdAt?: string | null; user?: AdminUser | null }>;
  publicMessages?: AdminPlanPublicMessage[];
  recentReports?: AdminPlanReport[];
  placeCount?: number;
  participantCount?: number;
  publicCommentCount?: number;
  reportsCount?: number;
};

const statusOptions: PlanStatusFilter[] = ['all', 'draft', 'open', 'full', 'started', 'completed', 'cancelled', 'expired', 'hidden'];
const modeOptions: PlanMode[] = ['all', 'local', 'remote', 'hybrid'];
const detailActions: PlanAction[] = ['hide', 'restore', 'cancel', 'mark_reviewed'];
const discussionStatusOptions: PlanMessageStatusFilter[] = ['all', 'visible', 'hidden', 'deleted'];
const discussionActions: PlanMessageAction[] = ['hide', 'restore', 'mark_reviewed'];

function labelize(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'unknown';
}

function personLabel(user?: AdminUser | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}

function statusTone(status?: string | null) {
  if (status === 'open' || status === 'completed') return 'success';
  if (status === 'full' || status === 'started') return 'warning';
  if (status === 'cancelled' || status === 'hidden' || status === 'expired') return 'danger';
  return 'admin';
}

function visibilityTone(visibility?: string | null) {
  if (visibility === 'public') return 'success';
  if (visibility === 'hidden') return 'danger';
  return 'admin';
}

function actionLabel(action: PlanAction) {
  if (action === 'mark_reviewed') return 'Mark reviewed';
  return labelize(action).replace(/^./, (value) => value.toUpperCase());
}

function actionDescription(action: PlanAction) {
  if (action === 'hide') return 'Hide removes this Plan from public discovery while keeping audit history and user data.';
  if (action === 'restore') return 'Restore reopens this Plan to public discovery when safe.';
  if (action === 'cancel') return 'Cancel closes join actions and leaves the Plan readable with a Cancelled state.';
  return 'Mark reviewed only writes an audit entry without changing the Plan.';
}

function messageActionLabel(action: PlanMessageAction) {
  if (action === 'mark_reviewed') return 'Mark reviewed';
  return action === 'hide' ? 'Hide comment' : 'Restore comment';
}

function messageActionDescription(action: PlanMessageAction) {
  if (action === 'hide') return 'Hide this Plan discussion comment and resolve linked open reports.';
  if (action === 'restore') return 'Restore this comment to the public Plan discussion and resolve linked open reports.';
  return 'Write an audit entry without changing the comment.';
}

function messageTone(status?: string | null) {
  if (status === 'visible') return 'success';
  if (status === 'hidden' || status === 'deleted') return 'danger';
  return 'admin';
}


function verificationTone(status?: string | null) {
  if (status === 'verified') return 'success';
  if (status === 'rejected') return 'danger';
  return 'admin';
}

function metersLabel(value?: number | null) {
  return typeof value === 'number' ? `${Math.round(value)}m` : 'Not measured';
}

function dateLabel(value?: string | null) {
  return value ? formatWebDateTime(value) : 'Not set';
}

function countLabel(value?: number | null) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

function planMeta(plan: AdminPlan) {
  return [
    labelize(plan.category),
    labelize(plan.mode),
    plan.locationLabel,
    `${countLabel(plan.placeCount)} places`,
    `${countLabel(plan.participantCount)} participants`,
    `${countLabel(plan.publicCommentCount)} comments`,
    `${countLabel(plan.reportsCount)} reports`,
  ].filter((item) => item && item !== 'unknown').join(' · ');
}

export default function AdminPlansPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<AdminPlan | null>(null);
  const [status, setStatus] = useState<PlanStatusFilter>('all');
  const [mode, setMode] = useState<PlanMode>('all');
  const [query, setQuery] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [note, setNote] = useState('');
  const [discussionStatus, setDiscussionStatus] = useState<PlanMessageStatusFilter>('all');
  const [discussionNote, setDiscussionNote] = useState('');
  const [discussionMessages, setDiscussionMessages] = useState<AdminPlanPublicMessage[]>([]);
  const [presenceChecks, setPresenceChecks] = useState<AdminPlacePresenceVerification[]>([]);
  const [presenceStatus, setPresenceStatus] = useState<'all' | 'verified' | 'rejected'>('all');
  const [presenceNote, setPresenceNote] = useState('');
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setPlans([]);
    setSelectedPlan(null);
    setDiscussionMessages([]);
    setPresenceChecks([]);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function queryString() {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (mode !== 'all') params.set('mode', mode);
    if (query.trim()) params.set('q', query.trim());
    if (ownerId.trim()) params.set('ownerId', ownerId.trim());
    const text = params.toString();
    return text ? `?${text}` : '';
  }

  async function loadPlans() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/plans${queryString()}`, { headers });
      if (!response.ok) throw new Error('Could not load Plans. Make sure this account has admin role and satisfies 2FA requirements.');
      const data = await response.json() as { plans: AdminPlan[] };
      setPlans(data.plans);
      if (selectedPlan) setSelectedPlan(data.plans.find((plan) => plan.id === selectedPlan.id) ?? null);
      setNotice({ tone: 'success', body: `Loaded ${data.plans.length} Plan${data.plans.length === 1 ? '' : 's'}. Select one to review details and actions.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Plans.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadPlanDetail(planId: string) {
    if (!token) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/plans/${planId}`, { headers });
      if (!response.ok) throw new Error('Could not load Plan detail.');
      const data = await response.json() as { plan: AdminPlan };
      setSelectedPlan(data.plan);
      setDiscussionMessages(data.plan.publicMessages ?? []);
      setPlans((current) => current.map((plan) => plan.id === data.plan.id ? data.plan : plan));
      void loadPresenceChecks(data.plan.id);
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Plan detail.' });
    } finally {
      setLoading(false);
    }
  }

  async function applyAction(action: PlanAction) {
    if (!token || !selectedPlan) return;
    if (action !== 'mark_reviewed' && !note.trim()) {
      setNotice({ tone: 'warning', body: 'Add an internal note before hiding, restoring, or cancelling a Plan.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/plans/${selectedPlan.id}/action`, { method: 'PATCH', headers, body: JSON.stringify({ action, note: note.trim() || undefined }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not apply Plan action.');
      }
      const data = await response.json() as { plan: AdminPlan };
      setSelectedPlan(data.plan);
      setDiscussionMessages(data.plan.publicMessages ?? []);
      setPlans((current) => current.map((plan) => plan.id === data.plan.id ? data.plan : plan));
      setNote('');
      setNotice({ tone: 'success', body: `Plan action saved: ${labelize(action)}.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not apply Plan action.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadDiscussionMessages() {
    if (!token || !selectedPlan) return;
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (discussionStatus !== 'all') params.set('status', discussionStatus);
      const response = await fetch(`${apiBase}/admin/plans/${selectedPlan.id}/public-messages${params.toString() ? `?${params.toString()}` : ''}`, { headers });
      if (!response.ok) throw new Error('Could not load Plan discussion comments.');
      const data = await response.json() as { messages: AdminPlanPublicMessage[] };
      setDiscussionMessages(data.messages);
      setSelectedPlan((current) => current ? { ...current, publicMessages: data.messages.slice(0, 20), publicCommentCount: data.messages.length } : current);
      setNotice({ tone: 'success', body: `Loaded ${data.messages.length} Plan discussion comment${data.messages.length === 1 ? '' : 's'}.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Plan discussion comments.' });
    } finally {
      setLoading(false);
    }
  }


  async function loadPresenceChecks(planId = selectedPlan?.id) {
    if (!token || !planId) return;
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams({ planId });
      if (presenceStatus !== 'all') params.set('status', presenceStatus);
      const response = await fetch(`${apiBase}/admin/place-verifications?${params.toString()}`, { headers });
      if (!response.ok) throw new Error('Could not load Plan presence checks.');
      const data = await response.json() as { verifications: AdminPlacePresenceVerification[] };
      setPresenceChecks(data.verifications);
      setNotice({ tone: 'success', body: `Loaded ${data.verifications.length} presence check${data.verifications.length === 1 ? '' : 's'} for this Plan.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Plan presence checks.' });
    } finally {
      setLoading(false);
    }
  }

  async function markPresenceCheckReviewed(verificationId: string) {
    if (!token) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/place-verifications/${verificationId}/action`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'mark_reviewed', note: presenceNote.trim() || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not mark presence check reviewed.');
      }
      const data = await response.json() as { verification: AdminPlacePresenceVerification };
      setPresenceChecks((current) => current.map((item) => item.id === data.verification.id ? data.verification : item));
      setNotice({ tone: 'success', body: 'Presence check review audit saved.' });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not mark presence check reviewed.' });
    } finally {
      setLoading(false);
    }
  }

  async function applyDiscussionAction(messageId: string, action: PlanMessageAction) {
    if (!token || !selectedPlan) return;
    if (action === 'hide' && !discussionNote.trim()) {
      setNotice({ tone: 'warning', body: 'Add an internal note before hiding a Plan discussion comment.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/plans/${selectedPlan.id}/public-messages/${messageId}/action`, { method: 'PATCH', headers, body: JSON.stringify({ action, note: discussionNote.trim() || undefined }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not apply comment moderation action.');
      }
      const data = await response.json() as { message: AdminPlanPublicMessage };
      setDiscussionMessages((current) => current.map((message) => message.id === data.message.id ? data.message : message));
      setSelectedPlan((current) => current ? { ...current, publicMessages: (current.publicMessages ?? []).map((message) => message.id === data.message.id ? data.message : message) } : current);
      if (action !== 'mark_reviewed') setDiscussionNote('');
      setNotice({ tone: 'success', body: `Comment action saved: ${messageActionLabel(action)}.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not apply comment moderation action.' });
    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="admin-console">
      <section className="app-card admin-console__hero">
        <div className="status-row">
          <span className="semantic-badge admin">Plans admin</span>
          <Link className="button secondary" href="/admin">Back to admin</Link>
        </div>
        <div>
          <p className="eyebrow">Plan moderation</p>
          <h1>All Plans</h1>
          <p>Review public Plan activity, owner details, places, participants, comments, reports, and safe admin actions without deleting user data.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Internal tools use your signed-in admin app session. Standalone admin login is not exposed.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Search</span><span className="semantic-badge admin">No deletes</span></div>
          <h2>Plan queue</h2>
          <div className="admin-trust-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, description, owner" />
            <select value={status} onChange={(event) => setStatus(event.target.value as PlanStatusFilter)}>
              {statusOptions.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
            <select value={mode} onChange={(event) => setMode(event.target.value as PlanMode)}>
              {modeOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'all modes' : labelize(item)}</option>)}
            </select>
            <input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} placeholder="Owner ID optional" />
            <button type="button" onClick={() => { void loadPlans(); }} disabled={loading || !token}>Load Plans</button>
          </div>
          <div className="admin-user-list">
            {plans.map((plan) => (
              <button type="button" key={plan.id} className={selectedPlan?.id === plan.id ? 'admin-user-row is-active' : 'admin-user-row'} onClick={() => { void loadPlanDetail(plan.id); }}>
                <span>
                  <strong>{plan.title}</strong>
                  <small>{personLabel(plan.owner)} · {planMeta(plan)}</small>
                  <small>{dateLabel(plan.createdAt)} · {plan.id}</small>
                </span>
                <span className="status-row">
                  <em className={`semantic-badge ${statusTone(plan.status)}`}>{labelize(plan.status)}</em>
                  <em className={`semantic-badge ${visibilityTone(plan.visibility)}`}>{labelize(plan.visibility)}</em>
                </span>
              </button>
            ))}
            {plans.length === 0 ? <p>{loading ? 'Loading Plans…' : 'Load Plans to review public Plan activity.'}</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge warning">Detail</span>{selectedPlan ? <span className={`semantic-badge ${statusTone(selectedPlan.status)}`}>{labelize(selectedPlan.status)}</span> : null}</div>
          <h2>{selectedPlan ? selectedPlan.title : 'Select a Plan'}</h2>
          {selectedPlan ? (
            <>
              <p>{selectedPlan.description}</p>
              <div className="admin-money-strip">
                <span><small>Owner</small><strong>{personLabel(selectedPlan.owner)}</strong></span>
                <span><small>Visibility</small><strong>{labelize(selectedPlan.visibility)}</strong></span>
                <span><small>Starts</small><strong>{dateLabel(selectedPlan.startsAt)}</strong></span>
                <span><small>Places</small><strong>{countLabel(selectedPlan.placeCount)}</strong></span>
                <span><small>Participants</small><strong>{countLabel(selectedPlan.participantCount)}</strong></span>
                <span><small>Comments</small><strong>{countLabel(selectedPlan.publicCommentCount)}</strong></span>
                <span><small>Reports</small><strong>{countLabel(selectedPlan.reportsCount)}</strong></span>
              </div>
              <div className="cta-row">
                <Link className="button secondary" href={`/plans/${selectedPlan.id}`}>Open Plan</Link>
                <Link className="button secondary" href={`/plans/${selectedPlan.id}/discussion`}>View public discussion</Link>
                <Link className="button secondary" href={`/admin/users?userId=${encodeURIComponent(selectedPlan.ownerId)}`}>View owner</Link>
              </div>
              <label>
                Internal note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required for hide, restore, or cancel actions." rows={4} />
              </label>
              <div className="admin-section-grid">
                {detailActions.map((action) => (
                  <button key={action} type="button" className={action === 'hide' || action === 'cancel' ? 'danger' : action === 'restore' ? 'secondary' : 'ghost'} onClick={() => { void applyAction(action); }} disabled={loading || !token}>
                    {actionLabel(action)}
                    <small>{actionDescription(action)}</small>
                  </button>
                ))}
              </div>
            </>
          ) : <p>Choose a Plan from the queue to see owner, status, visibility, places, participants, comments, reports, and moderation actions.</p>}
        </article>
      </section>

      {selectedPlan ? (
        <section className="admin-detail-grid">
          <article className="app-card admin-action-card">
            <div className="status-row"><span className="semantic-badge info">Places</span></div>
            <h2>Plan places</h2>
            <div className="admin-audit-list">
              {(selectedPlan.places ?? []).map((place) => (
                <article key={place.id} className="admin-audit-row">
                  <span>
                    <strong>{place.title}</strong>
                    <small>{labelize(place.mode)} · {dateLabel(place.startsAt)}</small>
                    {place.sourcePlace ? <small>Source: {place.sourcePlace.title ?? place.sourcePlace.id} · {labelize(place.sourcePlace.source)} · {labelize(place.sourcePlace.status)}</small> : null}
                  </span>
                </article>
              ))}
              {(selectedPlan.places ?? []).length === 0 ? <p>No places attached to this Plan.</p> : null}
            </div>
          </article>

          <article className="app-card admin-action-card">
            <div className="status-row"><span className="semantic-badge info">Participants</span></div>
            <h2>Participant requests</h2>
            <div className="admin-audit-list">
              {(selectedPlan.participants ?? []).map((participant) => (
                <article key={participant.id} className="admin-audit-row">
                  <span>
                    <strong>{personLabel(participant.user)}</strong>
                    <small>{labelize(participant.status)} · {dateLabel(participant.createdAt)}</small>
                    {participant.message ? <small>{participant.message}</small> : null}
                  </span>
                  <em className={`semantic-badge ${participant.status === 'accepted' ? 'success' : participant.status === 'pending' ? 'warning' : 'admin'}`}>{labelize(participant.status)}</em>
                </article>
              ))}
              {(selectedPlan.participants ?? []).length === 0 ? <p>No participants yet.</p> : null}
            </div>
          </article>
        </section>
      ) : null}

      {selectedPlan ? (
        <section className="admin-detail-grid">
          <article className="app-card admin-action-card">
            <div className="status-row"><span className="semantic-badge warning">Presence checks</span><span className="semantic-badge admin">Admin only</span></div>
            <h2>Offline presence verification history</h2>
            <p>Review GPS presence attempts for this Plan. Exact rounded coordinates and rejection reasons stay admin-only and are never shown on public profiles.</p>
            <div className="admin-trust-controls">
              <select value={presenceStatus} onChange={(event) => setPresenceStatus(event.target.value as 'all' | 'verified' | 'rejected')}>
                <option value="all">all checks</option>
                <option value="verified">verified only</option>
                <option value="rejected">rejected only</option>
              </select>
              <button type="button" className="secondary" onClick={() => { void loadPresenceChecks(); }} disabled={loading || !token}>Load presence checks</button>
            </div>
            <label>
              Presence review note
              <textarea value={presenceNote} onChange={(event) => setPresenceNote(event.target.value)} placeholder="Optional internal note for suspicious/rejected checks." rows={3} />
            </label>
            <div className="admin-audit-list">
              {presenceChecks.map((check) => (
                <article key={check.id} className="admin-audit-row">
                  <span>
                    <strong>{personLabel(check.user)} · {check.planPlace?.title ?? check.planPlaceId}</strong>
                    <small>{labelize(check.status)} · created {dateLabel(check.createdAt)} · verified {dateLabel(check.verifiedAt)}</small>
                    <small>Distance {metersLabel(check.distanceMeters)} / max {metersLabel(check.maxDistanceMeters)} · accuracy {metersLabel(check.accuracyMeters)}</small>
                    {typeof check.latitudeRounded === 'number' && typeof check.longitudeRounded === 'number' ? <small>Rounded coordinates: {check.latitudeRounded.toFixed(4)}, {check.longitudeRounded.toFixed(4)}</small> : null}
                    {check.rejectionReason ? <small>Rejection: {labelize(check.rejectionReason)}</small> : null}
                    <small>ID: {check.id}</small>
                  </span>
                  <span className="status-row">
                    <em className={`semantic-badge ${verificationTone(check.status)}`}>{labelize(check.status)}</em>
                    <button type="button" className="ghost" onClick={() => { void markPresenceCheckReviewed(check.id); }} disabled={loading || !token}>Mark reviewed</button>
                  </span>
                </article>
              ))}
              {presenceChecks.length === 0 ? <p>No loaded presence checks yet. Use Load presence checks to inspect accepted and rejected GPS verification attempts for this Plan.</p> : null}
            </div>
          </article>

          <article className="app-card admin-action-card">
            <div className="status-row"><span className="semantic-badge info">Privacy rule</span></div>
            <h2>Public profile safety</h2>
            <p>Public profiles only show aggregate offline presence counters. Plan titles, place names, addresses, coordinates, rejection history, and admin review notes stay private/admin-only.</p>
          </article>
        </section>
      ) : null}

      {selectedPlan ? (
        <section className="admin-detail-grid">
          <article className="app-card admin-action-card">
            <div className="status-row"><span className="semantic-badge admin">Public discussion</span><span className="semantic-badge warning">Comment moderation</span></div>
            <h2>Plan discussion comments</h2>
            <p>Review Plan public comments, authors, report reasons, hidden state, and moderation notes. Hiding keeps the audit trail and resolves linked open reports.</p>
            <div className="admin-trust-controls">
              <select value={discussionStatus} onChange={(event) => setDiscussionStatus(event.target.value as PlanMessageStatusFilter)}>
                {discussionStatusOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'all comments' : labelize(item)}</option>)}
              </select>
              <button type="button" className="secondary" onClick={() => { void loadDiscussionMessages(); }} disabled={loading || !token}>Load comments</button>
            </div>
            <label>
              Comment moderation note
              <textarea value={discussionNote} onChange={(event) => setDiscussionNote(event.target.value)} placeholder="Required when hiding a comment. Optional for restore/review." rows={3} />
            </label>
            <div className="admin-audit-list">
              {discussionMessages.map((message) => (
                <article key={message.id} className="admin-audit-row">
                  <span>
                    <strong>{personLabel(message.author)}</strong>
                    <small>{labelize(message.status)} · {dateLabel(message.createdAt)} · {message.id}</small>
                    <small>{message.body || 'Deleted message'}</small>
                    {message.moderationNote ? <small>Moderation note: {message.moderationNote}</small> : null}
                    {message.hiddenAt ? <small>Hidden {dateLabel(message.hiddenAt)} by {personLabel(message.hiddenBy)}</small> : null}
                    {message.reportsCount ? <small>Reports: {message.reportsCount} · latest {labelize(message.latestReportReason)} · {labelize(message.latestReportStatus)}</small> : null}
                    {(message.reports ?? []).map((report) => (
                      <small key={report.id}>Report: {labelize(report.reason)} · {labelize(report.status)} · {personLabel(report.reporter)} · {report.details || 'No details'}</small>
                    ))}
                  </span>
                  <span className="status-row">
                    <em className={`semantic-badge ${messageTone(message.status)}`}>{labelize(message.status)}</em>
                    {discussionActions.map((action) => (
                      <button key={action} type="button" className={action === 'hide' ? 'danger' : action === 'restore' ? 'secondary' : 'ghost'} onClick={() => { void applyDiscussionAction(message.id, action); }} disabled={loading || !token || message.status === 'deleted'} title={messageActionDescription(action)}>
                        {messageActionLabel(action)}
                      </button>
                    ))}
                  </span>
                </article>
              ))}
              {discussionMessages.length === 0 ? <p>No loaded public comments yet. Use Load comments to review the full Plan discussion queue.</p> : null}
            </div>
          </article>

          <article className="app-card admin-action-card">
            <div className="status-row"><span className="semantic-badge danger">Reports</span></div>
            <h2>Recent Plan reports</h2>
            <div className="admin-audit-list">
              {(selectedPlan.recentReports ?? []).map((report) => (
                <article key={report.id} className="admin-audit-row">
                  <span>
                    <strong>{labelize(report.reason)} · {labelize(report.targetType)}</strong>
                    <small>{labelize(report.status)} · {personLabel(report.reporter)} · {dateLabel(report.createdAt)}</small>
                    {report.details ? <small>{report.details}</small> : null}
                  </span>
                  <Link className="button secondary" href={`/admin/reports?targetType=${encodeURIComponent(report.targetType)}`}>Open reports</Link>
                </article>
              ))}
              {(selectedPlan.recentReports ?? []).length === 0 ? <p>No recent reports linked to this Plan, its places, or visible public messages.</p> : null}
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
