'use client';

import { useMemo, useState } from 'react';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime } from '../../../lib/webFormat';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type BudgetStatus = 'draft' | 'pending_provider_review' | 'pending_admin_review' | 'sandbox_ready' | 'rejected' | 'paused' | 'archived';
type BudgetProvider = 'none' | 'stripe' | 'airwallex';
type BudgetAction = 'approve' | 'reject' | 'pause' | 'archive' | 'restore';

type AdminUserPreview = { id: string; email: string; profile?: { displayName?: string | null; handle?: string | null } | null };
type BusinessBudget = {
  id: string;
  businessProfileId: string;
  campaignId?: string | null;
  provider: BudgetProvider;
  providerAccountId?: string | null;
  status: BudgetStatus;
  currency: string;
  requestedAmountCents: number;
  reservedAmountCents: number;
  spentAmountCents: number;
  refundedAmountCents: number;
  platformFeeRateBps: number;
  purpose?: string | null;
  riskNote?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  businessProfile?: { id: string; displayName: string; handle?: string | null; type?: string; status?: string } | null;
  campaign?: { id: string; title: string; status: string; opportunityType: string } | null;
  providerAccount?: { id: string; provider: string; accountType: string; status: string; country?: string | null; defaultCurrency?: string | null } | null;
  createdBy?: AdminUserPreview | null;
  reviewer?: AdminUserPreview | null;
  ledgerEntries?: Array<{ id: string; type: string; amountCents: number; currency: string; note?: string | null; providerTransactionId?: string | null; createdAt: string }>;
};

type BudgetResponse = {
  summary?: Record<string, number>;
  budgets?: BusinessBudget[];
  recentAuditLogs?: Array<{ id: string; action: string; reason?: string | null; targetId?: string | null; createdAt: string; admin?: AdminUserPreview | null }>;
  noMoneyMoved?: boolean;
  sandboxOnly?: boolean;
  moneyProvider?: { provider?: string; enabled?: boolean; sandboxOnly?: boolean };
};

const statusFilters: Array<BudgetStatus | 'all'> = ['all', 'draft', 'pending_provider_review', 'pending_admin_review', 'sandbox_ready', 'rejected', 'paused', 'archived'];
const providerFilters: Array<BudgetProvider | 'all'> = ['all', 'none', 'stripe', 'airwallex'];
const actionOptions: Array<{ value: BudgetAction; label: string; danger?: boolean }> = [
  { value: 'approve', label: 'Mark sandbox-ready' },
  { value: 'restore', label: 'Restore to review' },
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

function displayValue(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'not set';
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: (currency || 'eur').toUpperCase() }).format((cents || 0) / 100);
}

function statusTone(value?: string) {
  if (value === 'sandbox_ready') return 'success';
  if (value === 'pending_provider_review' || value === 'pending_admin_review' || value === 'paused') return 'warning';
  if (value === 'rejected' || value === 'archived') return 'danger';
  return 'admin';
}

export default function AdminBusinessBudgetsPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [budgets, setBudgets] = useState<BusinessBudget[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState<BudgetResponse['recentAuditLogs']>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BudgetStatus | 'all'>('pending_admin_review');
  const [provider, setProvider] = useState<BudgetProvider | 'all'>('all');
  const [actionForms, setActionForms] = useState<Record<string, { action: BudgetAction; note: string }>>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setBudgets([]);
    setSummary(null);
    setRecentAuditLogs([]);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function defaultAction(budget: BusinessBudget): BudgetAction {
    if (budget.status === 'sandbox_ready') return 'pause';
    if (budget.status === 'paused' || budget.status === 'archived' || budget.status === 'rejected') return 'restore';
    return 'approve';
  }

  function updateActionForm(budget: BusinessBudget, patch: Partial<{ action: BudgetAction; note: string }>) {
    setActionForms((current) => ({ ...current, [budget.id]: { action: defaultAction(budget), note: '', ...(current[budget.id] ?? {}), ...patch } }));
  }

  async function loadBudgets() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status !== 'all') params.set('status', status);
      if (provider !== 'all') params.set('provider', provider);
      const response = await fetch(`${apiBase}/admin/business-budgets${params.toString() ? `?${params}` : ''}`, { headers });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || 'Could not load Business budget sandbox records. Make sure Business budget flags are enabled only for internal money-provider testing.');
      }
      const data = await response.json() as BudgetResponse;
      const nextBudgets = data.budgets ?? [];
      setBudgets(nextBudgets);
      setSummary(data.summary ?? null);
      setRecentAuditLogs(data.recentAuditLogs ?? []);
      setActionForms((current) => {
        const next = { ...current };
        for (const budget of nextBudgets) if (!next[budget.id]) next[budget.id] = { action: defaultAction(budget), note: '' };
        return next;
      });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Business budget sandbox records.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitAction(budget: BusinessBudget) {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    const form = actionForms[budget.id] ?? { action: defaultAction(budget), note: '' };
    if (form.note.trim().length < 3) {
      setNotice({ tone: 'warning', body: 'Add a review note before changing a Business budget sandbox record.' });
      return;
    }
    setSavingId(budget.id);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/business-budgets/${budget.id}/action`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: form.action, note: form.note.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || 'Could not update Business budget sandbox record.');
      }
      setNotice({ tone: 'success', body: 'Business budget sandbox action saved. No money moved.' });
      updateActionForm(budget, { note: '' });
      await loadBudgets();
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not update Business budget sandbox record.' });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="admin-console">
      <section className="admin-console__hero app-card">
        <div className="status-row"><span className="semantic-badge admin">Business budgets</span><span className="semantic-badge warning">Sandbox only</span></div>
        <div>
          <p className="eyebrow">Future provider-backed budget review</p>
          <h1>Budget sandbox</h1>
          <p>Review hidden Business budget sandbox records for a later money-provider launch. This page never moves funds and should stay internal until KYB, provider accounts, ledger reconciliation, refunds, and legal/payment terms are complete.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box warning">Approval is intentionally blocked unless a sandbox money provider and active Business provider account exist. No wallet balances, pay-ins, payouts, credits, tokens, tickets, or checks are created here.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        <div className="admin-filter-row">
          <label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, campaign, purpose" /></label>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as BudgetStatus | 'all')}>{statusFilters.map((item) => <option key={item} value={item}>{displayValue(item)}</option>)}</select></label>
          <label>Provider<select value={provider} onChange={(event) => setProvider(event.target.value as BudgetProvider | 'all')}>{providerFilters.map((item) => <option key={item} value={item}>{displayValue(item)}</option>)}</select></label>
          <button type="button" onClick={() => { void loadBudgets(); }} disabled={loading || !token}>{loading ? 'Loading…' : 'Load budgets'}</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      {summary ? (
        <section className="admin-metric-grid">
          <article className="admin-metric-card"><p>Total</p><strong>{countValue(summary.total)}</strong><span className="meta">All matching records</span></article>
          <article className="admin-metric-card"><p>Provider review</p><strong>{countValue(summary.pendingProviderReview)}</strong><span className="meta">Provider/KYB missing</span></article>
          <article className="admin-metric-card"><p>Admin review</p><strong>{countValue(summary.pendingAdminReview)}</strong><span className="meta">Ready for admin decision</span></article>
          <article className="admin-metric-card"><p>Sandbox-ready</p><strong>{countValue(summary.sandboxReady)}</strong><span className="meta">Still no money moved</span></article>
        </section>
      ) : null}

      <section className="admin-list-grid">
        {budgets.map((budget) => {
          const form = actionForms[budget.id] ?? { action: defaultAction(budget), note: '' };
          return (
            <article key={budget.id} className="app-card admin-action-card">
              <div className="status-row"><span className={`semantic-badge ${statusTone(budget.status)}`}>{displayValue(budget.status)}</span><span className="semantic-badge instruction">{budget.provider}</span></div>
              <h2>{budget.businessProfile?.displayName ?? 'Business'} budget</h2>
              <p className="meta">Requested {formatMoney(budget.requestedAmountCents, budget.currency)} · fee preview {(budget.platformFeeRateBps / 100).toFixed(2)}% · created by {personLabel(budget.createdBy)}</p>
              {budget.campaign ? <p className="meta">Campaign: {budget.campaign.title} · {displayValue(budget.campaign.status)}</p> : <p className="meta">No campaign attached.</p>}
              {budget.providerAccount ? <p className="meta">Provider account: {budget.providerAccount.provider} · {budget.providerAccount.accountType} · {budget.providerAccount.status}</p> : <p className="meta">No active provider account linked yet.</p>}
              {budget.purpose ? <p>{budget.purpose}</p> : null}
              {budget.riskNote ? <p className="notice-box warning">Risk note: {budget.riskNote}</p> : null}
              {budget.reviewNote ? <p className="notice-box info">Last review note: {budget.reviewNote}</p> : null}
              <p className="meta">Updated {formatWebDateTime(budget.updatedAt)}</p>
              <div className="admin-form-grid">
                <label>Action<select value={form.action} onChange={(event) => updateActionForm(budget, { action: event.target.value as BudgetAction })}>{actionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label>Required note<input value={form.note} onChange={(event) => updateActionForm(budget, { note: event.target.value })} placeholder="KYB/provider/admin reason" /></label>
                <button type="button" className={actionOptions.find((item) => item.value === form.action)?.danger ? 'danger' : undefined} onClick={() => { void submitAction(budget); }} disabled={savingId === budget.id || form.note.trim().length < 3}>{savingId === budget.id ? 'Saving…' : 'Save action'}</button>
              </div>
              {(budget.ledgerEntries ?? []).length ? <details><summary>Preview ledger entries</summary><ul>{budget.ledgerEntries?.map((entry) => <li key={entry.id}>{displayValue(entry.type)} · {formatMoney(entry.amountCents, entry.currency)} · {entry.note ?? 'No note'}</li>)}</ul></details> : null}
            </article>
          );
        })}
        {budgets.length === 0 ? <article className="app-card"><p className="meta">No Business budget sandbox records match this filter.</p></article> : null}
      </section>

      {recentAuditLogs?.length ? <section className="app-card"><h2>Recent budget audit</h2>{recentAuditLogs.map((entry) => <p key={entry.id} className="meta">{formatWebDateTime(entry.createdAt)} · {entry.action} · {entry.reason ?? 'No note'} · {personLabel(entry.admin)}</p>)}</section> : null}
    </main>
  );
}
