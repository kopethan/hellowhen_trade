'use client';

import { useMemo, useState } from 'react';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime } from '../../../lib/webFormat';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type CampaignStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'paused' | 'archived' | 'completed';
type OpportunityType = 'collaboration' | 'creator_request' | 'service_request' | 'community' | 'research' | 'other';
type CampaignAction = 'approve' | 'reject' | 'pause' | 'archive' | 'restore' | 'complete';

type AdminUserPreview = {
  id: string;
  email: string;
  profile?: { displayName?: string | null; handle?: string | null } | null;
};

type BusinessCampaignItem = {
  id: string;
  targetType: 'need' | 'offer' | 'inventory_template';
  targetId: string;
  note?: string | null;
  sortOrder?: number;
  target?: { id: string; title?: string | null; description?: string | null; status?: string | null; kind?: string | null; category?: string | null } | null;
};

type BusinessCampaign = {
  id: string;
  businessProfileId: string;
  opportunityType: OpportunityType;
  status: CampaignStatus;
  title: string;
  summary?: string | null;
  description: string;
  eligibility?: string | null;
  deliverables?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  businessProfile?: { id: string; displayName: string; handle?: string | null; type?: string; status?: string } | null;
  createdBy?: AdminUserPreview | null;
  reviewer?: AdminUserPreview | null;
  items?: BusinessCampaignItem[];
  _count?: { items?: number; applications?: number };
};

type CampaignResponse = {
  summary?: Record<string, number>;
  campaigns?: BusinessCampaign[];
  recentAuditLogs?: Array<{ id: string; action: string; reason?: string | null; targetId?: string | null; createdAt: string; admin?: AdminUserPreview | null }>;
};

const statusFilters: Array<CampaignStatus | 'all'> = ['all', 'draft', 'pending_review', 'approved', 'rejected', 'paused', 'archived', 'completed'];
const opportunityFilters: Array<OpportunityType | 'all'> = ['all', 'collaboration', 'creator_request', 'service_request', 'community', 'research', 'other'];
const actionOptions: Array<{ value: CampaignAction; label: string; danger?: boolean }> = [
  { value: 'approve', label: 'Approve' },
  { value: 'restore', label: 'Restore approved' },
  { value: 'pause', label: 'Pause', danger: true },
  { value: 'complete', label: 'Mark completed' },
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
  if (value === 'approved' || value === 'completed') return 'success';
  if (value === 'pending_review' || value === 'paused') return 'warning';
  if (value === 'rejected' || value === 'archived') return 'danger';
  return 'admin';
}

function displayValue(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'not set';
}

export default function AdminBusinessCampaignsPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [campaigns, setCampaigns] = useState<BusinessCampaign[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState<CampaignResponse['recentAuditLogs']>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CampaignStatus | 'all'>('pending_review');
  const [opportunityType, setOpportunityType] = useState<OpportunityType | 'all'>('all');
  const [actionForms, setActionForms] = useState<Record<string, { action: CampaignAction; note: string }>>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setCampaigns([]);
    setSummary(null);
    setRecentAuditLogs([]);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function defaultAction(campaign: BusinessCampaign): CampaignAction {
    if (campaign.status === 'approved') return 'pause';
    if (campaign.status === 'paused' || campaign.status === 'archived' || campaign.status === 'rejected') return 'restore';
    if (campaign.status === 'completed') return 'archive';
    return 'approve';
  }

  function updateActionForm(campaign: BusinessCampaign, patch: Partial<{ action: CampaignAction; note: string }>) {
    setActionForms((current) => ({ ...current, [campaign.id]: { action: defaultAction(campaign), note: '', ...(current[campaign.id] ?? {}), ...patch } }));
  }

  async function loadCampaigns() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status !== 'all') params.set('status', status);
      if (opportunityType !== 'all') params.set('opportunityType', opportunityType);
      const response = await fetch(`${apiBase}/admin/business-campaigns${params.toString() ? `?${params}` : ''}`, { headers });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || 'Could not load Business campaigns. Make sure Business campaign flags are enabled for internal testing.');
      }
      const data = await response.json() as CampaignResponse;
      const nextCampaigns = data.campaigns ?? [];
      setCampaigns(nextCampaigns);
      setSummary(data.summary ?? null);
      setRecentAuditLogs(data.recentAuditLogs ?? []);
      setActionForms((current) => {
        const next = { ...current };
        for (const campaign of nextCampaigns) if (!next[campaign.id]) next[campaign.id] = { action: defaultAction(campaign), note: '' };
        return next;
      });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Business campaigns.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitAction(campaign: BusinessCampaign) {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    const form = actionForms[campaign.id] ?? { action: defaultAction(campaign), note: '' };
    if (form.note.trim().length < 3) {
      setNotice({ tone: 'warning', body: 'Add a review note before changing a Business campaign.' });
      return;
    }
    setSavingId(campaign.id);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/business-campaigns/${campaign.id}/action`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: form.action, note: form.note.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || 'Could not update Business campaign.');
      }
      setNotice({ tone: 'success', body: 'Business campaign action saved.' });
      updateActionForm(campaign, { note: '' });
      await loadCampaigns();
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not update Business campaign.' });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="admin-console">
      <section className="admin-console__hero app-card">
        <div className="status-row">
          <span className="semantic-badge admin">Business campaigns</span>
          <span className="semantic-badge warning">Hidden feature</span>
        </div>
        <div>
          <p className="eyebrow">Opportunity review skeleton</p>
          <h1>Campaign / opportunity review</h1>
          <p>Review future Business opportunities that group already-approved Business Needs, Offers, or library items. This is intentionally money-free: no budgets, credits, tokens, tickets, checks, wallet balances, payouts, or provider settlement logic.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Keep this internal until Business campaigns are deliberately launched. Do not use “paid job” language or public discovery surfaces while money is disabled.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        <div className="admin-filter-row">
          <label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, title, brief" /></label>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as CampaignStatus | 'all')}>{statusFilters.map((item) => <option key={item} value={item}>{displayValue(item)}</option>)}</select></label>
          <label>Type<select value={opportunityType} onChange={(event) => setOpportunityType(event.target.value as OpportunityType | 'all')}>{opportunityFilters.map((item) => <option key={item} value={item}>{displayValue(item)}</option>)}</select></label>
          <button type="button" onClick={() => { void loadCampaigns(); }} disabled={loading || !token}>{loading ? 'Loading…' : 'Load campaigns'}</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      {summary ? (
        <section className="admin-metric-grid">
          <article className="admin-metric-card"><p>Total</p><strong>{countValue(summary.total)}</strong><span className="meta">All matching campaign records</span></article>
          <article className="admin-metric-card"><p>Pending review</p><strong>{countValue(summary.pendingReview)}</strong><span className="meta">Need admin decision</span></article>
          <article className="admin-metric-card"><p>Approved</p><strong>{countValue(summary.approved)}</strong><span className="meta">Eligible for future Business discovery</span></article>
          <article className="admin-metric-card"><p>Paused/archived</p><strong>{countValue((summary.paused ?? 0) + (summary.archived ?? 0))}</strong><span className="meta">Not eligible to render</span></article>
        </section>
      ) : null}

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge success">Safe boundary</span></div>
          <h2>No budgets or payouts</h2>
          <p>Campaigns only group reviewed Business-owned items. They do not store balances, ad spend, credits, payout promises, contracts, invoices, or provider IDs.</p>
        </article>
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge warning">Approval rule</span></div>
          <h2>Needs verified Business + approved items</h2>
          <p>Approving a campaign requires a verified Business profile and at least one active, admin-approved Business Need, Offer, or library item.</p>
        </article>
      </section>

      <section className="admin-content-list">
        {campaigns.map((campaign) => {
          const form = actionForms[campaign.id] ?? { action: defaultAction(campaign), note: '' };
          return (
            <article key={campaign.id} className="app-card admin-action-card">
              <div className="status-row">
                <span className={`semantic-badge ${statusTone(campaign.status)}`}>{displayValue(campaign.status)}</span>
                <span className="semantic-badge admin">{displayValue(campaign.opportunityType)}</span>
                <span className="semantic-badge info">{campaign._count?.items ?? campaign.items?.length ?? 0} item(s)</span>
                <span className="semantic-badge neutral">{campaign._count?.applications ?? 0} application(s)</span>
              </div>
              <h2>{campaign.title}</h2>
              {campaign.summary ? <p className="meta">{campaign.summary}</p> : null}
              <p>{campaign.description}</p>
              <div className="admin-money-strip">
                <span><small>Business</small><strong>{campaign.businessProfile?.displayName || campaign.businessProfileId}</strong></span>
                <span><small>Profile status</small><strong>{campaign.businessProfile?.status || 'unknown'}</strong></span>
                <span><small>Created by</small><strong>{personLabel(campaign.createdBy)}</strong></span>
                <span><small>Updated</small><strong>{formatWebDateTime(dateValue(campaign.updatedAt))}</strong></span>
              </div>
              {campaign.eligibility ? <p className="meta">Eligibility: {campaign.eligibility}</p> : null}
              {campaign.deliverables ? <p className="meta">Deliverables: {campaign.deliverables}</p> : null}
              {(campaign.items ?? []).length ? (
                <div className="admin-audit-list">
                  {(campaign.items ?? []).map((item) => (
                    <div key={item.id} className="notice-box info">
                      <strong>{displayValue(item.targetType)} · {item.target?.title || item.targetId}</strong>
                      <p className="meta">Target status: {item.target?.status || 'not eligible'}{item.note ? ` · ${item.note}` : ''}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="notice-box warning">This campaign has no eligible item attached yet.</p>}
              <p className="meta">Reviewed by {personLabel(campaign.reviewer)} {campaign.reviewedAt ? `· ${formatWebDateTime(dateValue(campaign.reviewedAt))}` : '· not reviewed'}{campaign.reviewNote ? ` · Note: ${campaign.reviewNote}` : ''}</p>
              <div className="admin-filter-row">
                <label>Action<select value={form.action} onChange={(event) => updateActionForm(campaign, { action: event.target.value as CampaignAction })}>{actionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="admin-wide-field">Required note<textarea value={form.note} onChange={(event) => updateActionForm(campaign, { note: event.target.value })} placeholder="Explain why this campaign action is safe." /></label>
                <button type="button" onClick={() => { void submitAction(campaign); }} disabled={savingId === campaign.id || !token}>{savingId === campaign.id ? 'Saving…' : 'Save action'}</button>
              </div>
            </article>
          );
        })}
        {!loading && campaigns.length === 0 ? <article className="app-card admin-action-card"><h2>No Business campaigns loaded</h2><p>Load campaigns after enabling Business campaign flags in an internal environment.</p></article> : null}
      </section>

      <section className="app-card admin-action-card">
        <div className="status-row"><span className="semantic-badge admin">Recent campaign audit</span></div>
        <h2>Latest campaign decisions</h2>
        <div className="admin-audit-list">
          {(recentAuditLogs ?? []).map((log) => (
            <div key={log.id} className="notice-box info">
              <strong>{displayValue(log.action)}</strong>
              <p className="meta">{personLabel(log.admin)} · {formatWebDateTime(dateValue(log.createdAt))}{log.reason ? ` · ${log.reason}` : ''}</p>
            </div>
          ))}
          {!recentAuditLogs?.length ? <p className="meta">No campaign audit records loaded.</p> : null}
        </div>
      </section>
    </main>
  );
}
