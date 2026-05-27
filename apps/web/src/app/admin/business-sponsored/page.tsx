'use client';

import { useMemo, useState } from 'react';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime } from '../../../lib/webFormat';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type PlacementStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'paused' | 'archived';
type PlacementSurface = 'trades_feed' | 'starter_library' | 'needs_list' | 'offers_list' | 'business_profile';
type PlacementTargetType = 'need' | 'offer' | 'inventory_template';
type PlacementAction = 'approve' | 'reject' | 'pause' | 'archive' | 'restore';

type AdminUserPreview = {
  id: string;
  email: string;
  profile?: { displayName?: string | null; handle?: string | null } | null;
};

type BusinessSponsoredPlacement = {
  id: string;
  businessProfileId: string;
  targetType: PlacementTargetType;
  targetId: string;
  surface: PlacementSurface;
  status: PlacementStatus;
  label: string;
  priority: number;
  startsAt?: string | null;
  endsAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  businessProfile?: { id: string; displayName: string; handle?: string | null; type?: string; status?: string } | null;
  createdBy?: AdminUserPreview | null;
  reviewer?: AdminUserPreview | null;
  target?: { id: string; title?: string | null; description?: string | null; status?: string | null; kind?: string | null; category?: string | null } | null;
};

type SponsoredResponse = {
  summary?: Record<string, number>;
  placements?: BusinessSponsoredPlacement[];
  recentAuditLogs?: Array<{ id: string; action: string; reason?: string | null; targetId?: string | null; createdAt: string; admin?: AdminUserPreview | null }>;
};

const statusFilters: Array<PlacementStatus | 'all'> = ['all', 'draft', 'pending_review', 'approved', 'rejected', 'paused', 'archived'];
const surfaceFilters: Array<PlacementSurface | 'all'> = ['all', 'trades_feed', 'starter_library', 'needs_list', 'offers_list', 'business_profile'];
const targetTypeFilters: Array<PlacementTargetType | 'all'> = ['all', 'need', 'offer', 'inventory_template'];
const actionOptions: Array<{ value: PlacementAction; label: string; danger?: boolean }> = [
  { value: 'approve', label: 'Approve' },
  { value: 'restore', label: 'Restore approved' },
  { value: 'pause', label: 'Pause', danger: true },
  { value: 'reject', label: 'Reject', danger: true },
  { value: 'archive', label: 'Archive', danger: true },
];

function personLabel(user?: AdminUserPreview | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}

function countValue(value: unknown) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

function dateValue(value: string | Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function statusTone(value?: string) {
  if (value === 'approved') return 'success';
  if (value === 'pending_review' || value === 'paused') return 'warning';
  if (value === 'rejected' || value === 'archived') return 'danger';
  return 'admin';
}

function displayValue(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'not set';
}

export default function AdminBusinessSponsoredPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [placements, setPlacements] = useState<BusinessSponsoredPlacement[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState<SponsoredResponse['recentAuditLogs']>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PlacementStatus | 'all'>('pending_review');
  const [surface, setSurface] = useState<PlacementSurface | 'all'>('all');
  const [targetType, setTargetType] = useState<PlacementTargetType | 'all'>('all');
  const [actionForms, setActionForms] = useState<Record<string, { action: PlacementAction; note: string }>>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setPlacements([]);
    setSummary(null);
    setRecentAuditLogs([]);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function defaultAction(placement: BusinessSponsoredPlacement): PlacementAction {
    if (placement.status === 'approved') return 'pause';
    if (placement.status === 'paused' || placement.status === 'archived' || placement.status === 'rejected') return 'restore';
    return 'approve';
  }

  function updateActionForm(placement: BusinessSponsoredPlacement, patch: Partial<{ action: PlacementAction; note: string }>) {
    setActionForms((current) => ({ ...current, [placement.id]: { action: defaultAction(placement), note: '', ...(current[placement.id] ?? {}), ...patch } }));
  }

  async function loadPlacements() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status !== 'all') params.set('status', status);
      if (surface !== 'all') params.set('surface', surface);
      if (targetType !== 'all') params.set('targetType', targetType);
      const response = await fetch(`${apiBase}/admin/business-sponsored-placements${params.toString() ? `?${params}` : ''}`, { headers });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || 'Could not load Business sponsored placements. Make sure Business sponsored-content flags are enabled for internal testing.');
      }
      const data = await response.json() as SponsoredResponse;
      const nextPlacements = data.placements ?? [];
      setPlacements(nextPlacements);
      setSummary(data.summary ?? null);
      setRecentAuditLogs(data.recentAuditLogs ?? []);
      setActionForms((current) => {
        const next = { ...current };
        for (const placement of nextPlacements) if (!next[placement.id]) next[placement.id] = { action: defaultAction(placement), note: '' };
        return next;
      });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Business sponsored placements.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitAction(placement: BusinessSponsoredPlacement) {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    const form = actionForms[placement.id] ?? { action: defaultAction(placement), note: '' };
    if (form.note.trim().length < 3) {
      setNotice({ tone: 'warning', body: 'Add a review note before changing a sponsored placement.' });
      return;
    }
    setSavingId(placement.id);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/business-sponsored-placements/${placement.id}/action`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: form.action, note: form.note.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || 'Could not update sponsored placement.');
      }
      setNotice({ tone: 'success', body: 'Sponsored placement action saved.' });
      updateActionForm(placement, { note: '' });
      await loadPlacements();
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not update sponsored placement.' });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="admin-console">
      <section className="admin-console__hero app-card">
        <div className="status-row">
          <span className="semantic-badge admin">Business sponsored placements</span>
          <span className="semantic-badge warning">Hidden feature</span>
        </div>
        <div>
          <p className="eyebrow">First-party sponsorship review</p>
          <h1>Sponsored placement review</h1>
          <p>Review where approved Business-owned Needs, Offers, or library items may appear later. This is not an external ad SDK and does not track impressions, clicks, budgets, credits, or money.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Keep this page internal until Business accounts and sponsored content are explicitly launched. Private proposals, support, reports, account, security, and admin pages must remain ad-free.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        <div className="admin-filter-row">
          <label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, label, target ID" /></label>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as PlacementStatus | 'all')}>{statusFilters.map((item) => <option key={item} value={item}>{displayValue(item)}</option>)}</select></label>
          <label>Surface<select value={surface} onChange={(event) => setSurface(event.target.value as PlacementSurface | 'all')}>{surfaceFilters.map((item) => <option key={item} value={item}>{displayValue(item)}</option>)}</select></label>
          <label>Target<select value={targetType} onChange={(event) => setTargetType(event.target.value as PlacementTargetType | 'all')}>{targetTypeFilters.map((item) => <option key={item} value={item}>{displayValue(item)}</option>)}</select></label>
          <button type="button" onClick={() => { void loadPlacements(); }} disabled={loading || !token}>{loading ? 'Loading…' : 'Load placements'}</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      {summary ? (
        <section className="admin-metric-grid">
          <article className="admin-metric-card"><p>Total</p><strong>{countValue(summary.total)}</strong><span className="meta">All matching placement records</span></article>
          <article className="admin-metric-card"><p>Pending review</p><strong>{countValue(summary.pendingReview)}</strong><span className="meta">Need admin decision</span></article>
          <article className="admin-metric-card"><p>Approved</p><strong>{countValue(summary.approved)}</strong><span className="meta">Eligible for future discovery surfaces</span></article>
          <article className="admin-metric-card"><p>Paused/archived</p><strong>{countValue((summary.paused ?? 0) + (summary.archived ?? 0))}</strong><span className="meta">Not eligible to render</span></article>
        </section>
      ) : null}

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge success">Safe boundary</span></div>
          <h2>No tracking or money</h2>
          <p>This model stores placement intent only: surface, label, priority, optional dates, target item, and admin review status. It intentionally avoids ad provider IDs, impression/click counters, campaign budgets, wallet balances, credits, tokens, or payout logic.</p>
        </article>
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge warning">Approval rule</span></div>
          <h2>Target must already be approved</h2>
          <p>Approving a placement requires a verified Business profile and an active Business-owned Need, Offer, or library item. If the target is closed, archived, hidden, rejected, or unverified, approval is blocked.</p>
        </article>
      </section>

      <section className="admin-content-list">
        {placements.map((placement) => {
          const form = actionForms[placement.id] ?? { action: defaultAction(placement), note: '' };
          return (
            <article key={placement.id} className="app-card admin-action-card">
              <div className="status-row">
                <span className={`semantic-badge ${statusTone(placement.status)}`}>{displayValue(placement.status)}</span>
                <span className="semantic-badge admin">{displayValue(placement.surface)}</span>
                <span className="semantic-badge info">{displayValue(placement.targetType)}</span>
              </div>
              <h2>{placement.target?.title || placement.label || 'Sponsored placement'}</h2>
              <p>{placement.target?.description || `Target ${placement.targetType}: ${placement.targetId}`}</p>
              <div className="admin-money-strip">
                <span><small>Business</small><strong>{placement.businessProfile?.displayName || placement.businessProfileId}</strong></span>
                <span><small>Label</small><strong>{placement.label}</strong></span>
                <span><small>Priority</small><strong>{countValue(placement.priority)}</strong></span>
                <span><small>Target status</small><strong>{placement.target?.status || 'not eligible'}</strong></span>
              </div>
              <p className="meta">Created by {personLabel(placement.createdBy)} · {formatWebDateTime(dateValue(placement.createdAt))}</p>
              <p className="meta">Reviewed by {personLabel(placement.reviewer)} {placement.reviewedAt ? `· ${formatWebDateTime(dateValue(placement.reviewedAt))}` : '· not reviewed'}{placement.reviewNote ? ` · Note: ${placement.reviewNote}` : ''}</p>
              <p className="meta">Window: {placement.startsAt ? formatWebDateTime(dateValue(placement.startsAt)) : 'no start'} → {placement.endsAt ? formatWebDateTime(dateValue(placement.endsAt)) : 'no end'}</p>
              <div className="admin-filter-row">
                <label>Action<select value={form.action} onChange={(event) => updateActionForm(placement, { action: event.target.value as PlacementAction })}>{actionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="admin-wide-field">Required note<textarea value={form.note} onChange={(event) => updateActionForm(placement, { note: event.target.value })} placeholder="Explain why this sponsored placement action is safe." /></label>
                <button type="button" onClick={() => { void submitAction(placement); }} disabled={savingId === placement.id || !token}>{savingId === placement.id ? 'Saving…' : 'Save action'}</button>
              </div>
            </article>
          );
        })}
        {!loading && placements.length === 0 ? <article className="app-card admin-action-card"><h2>No sponsored placements loaded</h2><p>Load placements after enabling Business sponsored-content flags in an internal environment.</p></article> : null}
      </section>

      <section className="app-card admin-action-card">
        <div className="status-row"><span className="semantic-badge admin">Recent sponsored audit</span></div>
        <h2>Latest sponsored placement decisions</h2>
        <div className="admin-audit-list">
          {(recentAuditLogs ?? []).map((log) => (
            <article key={log.id} className="admin-audit-row">
              <span>
                <strong>{log.action}</strong>
                <small>{log.targetId || 'Sponsored placement'} · {personLabel(log.admin)} · {formatWebDateTime(dateValue(log.createdAt))}</small>
                {log.reason ? <small>Note: {log.reason}</small> : null}
              </span>
            </article>
          ))}
          {recentAuditLogs?.length === 0 ? <p>No sponsored placement audit entries in the latest result.</p> : null}
        </div>
      </section>
    </main>
  );
}
