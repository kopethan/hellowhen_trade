'use client';

import { useMemo, useState } from 'react';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime } from '../../../lib/webFormat';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type BusinessProfileStatus = 'draft' | 'active' | 'pending_review' | 'verified' | 'restricted' | 'disabled' | 'rejected';
type BusinessProfileType = 'business' | 'agency' | 'brand' | 'enterprise';
type BusinessAction = 'verify' | 'restrict' | 'disable' | 'reject' | 'activate';

type AdminUserPreview = {
  id: string;
  email: string;
  trustTier?: string;
  profile?: { displayName?: string | null; handle?: string | null; avatarUrl?: string | null } | null;
};

type BusinessProfile = {
  id: string;
  type: BusinessProfileType;
  status: BusinessProfileStatus;
  displayName: string;
  legalName?: string | null;
  handle?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  countryCode?: string | null;
  preferredCurrency?: string | null;
  verifiedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: AdminUserPreview | null;
  reviewer?: AdminUserPreview | null;
  members?: Array<{ id: string; role: string; user?: AdminUserPreview | null }>;
  moneyProviderAccounts?: Array<{ id: string; provider: string; status: string; accountType: string; country?: string | null; defaultCurrency?: string | null }>;
  counts?: { needs?: number; offers?: number; trades?: number; inventoryTemplates?: number };
};

type BusinessAdminResponse = {
  provider?: { provider?: string; configured?: boolean; sandboxOnly?: boolean };
  summary?: Record<string, number>;
  businessProfiles?: BusinessProfile[];
  recentAuditLogs?: Array<{ id: string; action: string; reason?: string | null; targetId?: string | null; createdAt: string; admin?: AdminUserPreview | null }>;
};

type ActionForm = { action: BusinessAction; note: string; disablePublicContent: boolean };

const statusFilters: Array<BusinessProfileStatus | 'all'> = ['all', 'draft', 'active', 'pending_review', 'verified', 'restricted', 'disabled', 'rejected'];
const typeFilters: Array<BusinessProfileType | 'all'> = ['all', 'business', 'agency', 'brand', 'enterprise'];
const actionOptions: Array<{ value: BusinessAction; label: string; danger?: boolean }> = [
  { value: 'verify', label: 'Verify' },
  { value: 'activate', label: 'Activate / restore' },
  { value: 'restrict', label: 'Restrict', danger: true },
  { value: 'disable', label: 'Disable', danger: true },
  { value: 'reject', label: 'Reject', danger: true },
];

function personLabel(user?: AdminUserPreview | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}

function dateValue(value: string | Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function statusTone(value?: string) {
  if (value === 'verified') return 'success';
  if (value === 'pending_review' || value === 'active') return 'warning';
  if (value === 'restricted' || value === 'disabled' || value === 'rejected') return 'danger';
  return 'admin';
}

function actionNeedsContentDisableGuard(action: BusinessAction) {
  return action === 'restrict' || action === 'disable' || action === 'reject';
}

function emptyActionForm(profile: BusinessProfile): ActionForm {
  return {
    action: profile.status === 'pending_review' || profile.status === 'active' ? 'verify' : profile.status === 'disabled' || profile.status === 'restricted' || profile.status === 'rejected' ? 'activate' : 'verify',
    note: '',
    disablePublicContent: false,
  };
}

function countValue(value: unknown) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

export default function AdminBusinessPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState<BusinessAdminResponse['recentAuditLogs']>([]);
  const [provider, setProvider] = useState<BusinessAdminResponse['provider'] | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BusinessProfileStatus | 'all'>('all');
  const [type, setType] = useState<BusinessProfileType | 'all'>('all');
  const [actionForms, setActionForms] = useState<Record<string, ActionForm>>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setProfiles([]);
    setSummary(null);
    setRecentAuditLogs([]);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function updateActionForm(profile: BusinessProfile, patch: Partial<ActionForm>) {
    setActionForms((current) => {
      const base = current[profile.id] ?? emptyActionForm(profile);
      const next = { ...base, ...patch };
      if (!actionNeedsContentDisableGuard(next.action)) next.disablePublicContent = false;
      return { ...current, [profile.id]: next };
    });
  }

  async function loadProfiles() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);
      const suffix = params.toString() ? `?${params}` : '';
      const response = await fetch(`${apiBase}/admin/business-profiles${suffix}`, { headers });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || 'Could not load Business profiles. Make sure Business admin flags are enabled and this account has admin role plus 2FA if required.');
      }
      const data = await response.json() as BusinessAdminResponse;
      const nextProfiles = data.businessProfiles ?? [];
      setProfiles(nextProfiles);
      setSummary(data.summary ?? null);
      setProvider(data.provider ?? null);
      setRecentAuditLogs(data.recentAuditLogs ?? []);
      setActionForms((current) => {
        const next = { ...current };
        for (const profile of nextProfiles) if (!next[profile.id]) next[profile.id] = emptyActionForm(profile);
        return next;
      });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Business profiles.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitAction(profile: BusinessProfile) {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    const form = actionForms[profile.id] ?? emptyActionForm(profile);
    if (form.note.trim().length < 3) {
      setNotice({ tone: 'warning', body: 'Add a review note before changing a Business profile status.' });
      return;
    }
    setSavingId(profile.id);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/business-profiles/${profile.id}/action`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: form.action, note: form.note.trim(), disablePublicContent: form.disablePublicContent }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || 'Could not update Business profile.');
      }
      const data = await response.json() as { businessProfile?: BusinessProfile; contentAction?: Record<string, number> | null };
      const contentSummary = data.contentAction
        ? ` Content closed: ${countValue(data.contentAction.needsClosed)} needs, ${countValue(data.contentAction.offersClosed)} offers, ${countValue(data.contentAction.tradesClosed)} trades, ${countValue(data.contentAction.inventoryTemplatesArchived)} templates.`
        : '';
      setNotice({ tone: 'success', body: `Business profile action saved.${contentSummary}` });
      updateActionForm(data.businessProfile ?? profile, { note: '', disablePublicContent: false });
      await loadProfiles();
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not update Business profile.' });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="admin-console">
      <section className="admin-console__hero app-card">
        <div className="status-row">
          <span className="semantic-badge admin">Business review</span>
          <span className="semantic-badge warning">Hidden feature</span>
        </div>
        <div>
          <p className="eyebrow">Business / Enterprise</p>
          <h1>Business profile review</h1>
          <p>Use this hidden admin area to review organization profiles only when Business flags are enabled for internal testing. Every status action requires a note and is written to the admin audit trail.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Public Business accounts, sponsored content, campaigns, budgets, credits, and money provider onboarding remain off for the first public launch.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        <div className="admin-filter-row">
          <label>
            Search
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, owner, handle, country" />
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as BusinessProfileStatus | 'all')}>
              {statusFilters.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label>
            Type
            <select value={type} onChange={(event) => setType(event.target.value as BusinessProfileType | 'all')}>
              {typeFilters.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { void loadProfiles(); }} disabled={loading || !token}>{loading ? 'Loading…' : 'Load profiles'}</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      {summary ? (
        <section className="admin-metric-grid">
          <article className="admin-metric-card"><p>Total</p><strong>{countValue(summary.total)}</strong><span className="meta">All matching Business profiles</span></article>
          <article className="admin-metric-card"><p>Pending review</p><strong>{countValue(summary.pendingReview)}</strong><span className="meta">Need admin decision</span></article>
          <article className="admin-metric-card"><p>Verified</p><strong>{countValue(summary.verified)}</strong><span className="meta">Approved organization profiles</span></article>
          <article className="admin-metric-card"><p>Restricted/disabled</p><strong>{countValue((summary.restricted ?? 0) + (summary.disabled ?? 0))}</strong><span className="meta">Safety-limited profiles</span></article>
        </section>
      ) : null}

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Provider boundary</span></div>
          <h2>KYB / money stays separate</h2>
          <p>This page reviews the Hellowhen Business profile identity only. Stripe/Airwallex KYB, wallets, budgets, credits, tokens, payouts, and paid campaigns are separate future money-provider work.</p>
          <div className="admin-money-strip">
            <span><small>Provider</small><strong>{provider?.provider ?? 'none'}</strong></span>
            <span><small>Configured</small><strong>{provider?.configured ? 'yes' : 'no'}</strong></span>
            <span><small>Sandbox only</small><strong>{provider?.sandboxOnly ? 'yes' : 'no'}</strong></span>
          </div>
        </article>

        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge warning">Emergency action</span></div>
          <h2>Disable public Business content</h2>
          <p>When restricting, disabling, or rejecting a Business profile, admins can also close currently active Business-owned Needs, Offers, Trades, and starter templates. Use this only for unsafe, spam, impersonation, or policy-risk profiles.</p>
        </article>
      </section>

      <section className="admin-content-list">
        {profiles.map((profile) => {
          const form = actionForms[profile.id] ?? emptyActionForm(profile);
          const canDisablePublicContent = actionNeedsContentDisableGuard(form.action);
          return (
            <article key={profile.id} className="app-card admin-action-card">
              <div className="status-row">
                <span className={`semantic-badge ${statusTone(profile.status)}`}>{profile.status.replaceAll('_', ' ')}</span>
                <span className="semantic-badge admin">{profile.type}</span>
                {profile.verifiedAt ? <span className="semantic-badge success">verified {formatWebDateTime(dateValue(profile.verifiedAt))}</span> : null}
              </div>
              <h2>{profile.displayName}</h2>
              <p>{profile.description || profile.legalName || 'No Business description provided yet.'}</p>
              <div className="admin-money-strip">
                <span><small>Owner</small><strong>{personLabel(profile.owner)}</strong></span>
                <span><small>Country</small><strong>{profile.countryCode || 'not set'}</strong></span>
                <span><small>Currency</small><strong>{profile.preferredCurrency || 'eur'}</strong></span>
                <span><small>Members</small><strong>{countValue(profile.members?.length)}</strong></span>
              </div>
              <div className="admin-money-strip">
                <span><small>Needs</small><strong>{countValue(profile.counts?.needs)}</strong></span>
                <span><small>Offers</small><strong>{countValue(profile.counts?.offers)}</strong></span>
                <span><small>Trades</small><strong>{countValue(profile.counts?.trades)}</strong></span>
                <span><small>Templates</small><strong>{countValue(profile.counts?.inventoryTemplates)}</strong></span>
              </div>
              <p className="meta">Reviewed by {personLabel(profile.reviewer)} {profile.reviewedAt ? `· ${formatWebDateTime(dateValue(profile.reviewedAt))}` : '· not reviewed'}{profile.reviewNote ? ` · Note: ${profile.reviewNote}` : ''}</p>
              {profile.websiteUrl ? <p className="meta">Website: {profile.websiteUrl}</p> : null}
              <div className="admin-filter-row">
                <label>
                  Action
                  <select value={form.action} onChange={(event) => updateActionForm(profile, { action: event.target.value as BusinessAction })}>
                    {actionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="admin-checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.disablePublicContent}
                    disabled={!canDisablePublicContent}
                    onChange={(event) => updateActionForm(profile, { disablePublicContent: event.target.checked })}
                  />
                  Close active Business content too
                </label>
                <label className="admin-wide-field">
                  Required note
                  <textarea value={form.note} onChange={(event) => updateActionForm(profile, { note: event.target.value })} placeholder="Explain why this Business profile status is changing." />
                </label>
                <button type="button" onClick={() => { void submitAction(profile); }} disabled={savingId === profile.id || !token}>{savingId === profile.id ? 'Saving…' : 'Save action'}</button>
              </div>
            </article>
          );
        })}
        {!loading && profiles.length === 0 ? <article className="app-card admin-action-card"><h2>No Business profiles loaded</h2><p>Load profiles after enabling Business admin flags in a non-first-launch environment.</p></article> : null}
      </section>

      <section className="app-card admin-action-card">
        <div className="status-row"><span className="semantic-badge admin">Recent Business audit</span></div>
        <h2>Latest Business profile decisions</h2>
        <div className="admin-audit-list">
          {(recentAuditLogs ?? []).map((log) => (
            <article key={log.id} className="admin-audit-row">
              <span>
                <strong>{log.action}</strong>
                <small>{log.targetId || 'Business profile'} · {personLabel(log.admin)} · {formatWebDateTime(dateValue(log.createdAt))}</small>
                {log.reason ? <small>Note: {log.reason}</small> : null}
              </span>
            </article>
          ))}
          {recentAuditLogs?.length === 0 ? <p>No Business audit entries in the latest result.</p> : null}
        </div>
      </section>
    </main>
  );
}
