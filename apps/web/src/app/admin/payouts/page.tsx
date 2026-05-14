'use client';

import { useMemo, useState } from 'react';
import type { AdminPayoutAction, AdminPayoutStatusFilter, PayoutRequestDto, PayoutRequestStatus, UserTrustTier } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { adminSessionRequiredMessage, useAdminSessionToken } from '../../../features/admin/adminSession';
import { formatWebDateTime, formatWebMoney } from '../../../lib/webFormat';

type AdminUser = {
  id: string;
  email: string;
  trustTier?: UserTrustTier;
  emailVerifiedAt?: string | null;
  profile?: { displayName?: string | null; handle?: string | null } | null;
  wallet?: { availableBalanceCents: number; heldBalanceCents: number; pendingPayoutCents: number; currency: string } | null;
};
type StripeConnectAccount = {
  id: string;
  stripeAccountId: string;
  status: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  disabledReason?: string | null;
  defaultCurrency?: string | null;
  country?: string | null;
  lastSyncedAt?: string | null;
};
type AdminPayoutEvent = {
  id: string;
  action: string;
  note?: string | null;
  previousStatus?: PayoutRequestStatus | null;
  nextStatus?: PayoutRequestStatus | null;
  createdAt: string;
  admin?: { email?: string; profile?: { displayName?: string | null } | null } | null;
};
type ProviderAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  status: string;
  accountType?: string | null;
  defaultCurrency?: string | null;
  country?: string | null;
  lastSyncedAt?: string | null;
};
type ProviderTransaction = {
  id: string;
  provider: string;
  providerTransactionId: string;
  type: string;
  status: string;
  amountCents: number;
  currency: string;
  payoutRequestId?: string | null;
  rawProviderStatus?: unknown;
  createdAt: string;
};
type ProviderEvent = {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  processingStatus?: string;
  status?: string;
  providerAccountId?: string | null;
  error?: string | null;
  createdAt: string;
};
type AdminPayout = PayoutRequestDto & { user?: AdminUser; stripeConnectAccount?: StripeConnectAccount | null; providerAccount?: ProviderAccount | null; providerTransactions?: ProviderTransaction[]; adminEvents?: AdminPayoutEvent[] };
type LedgerEntry = { id: string; type: string; balanceType: string; amountCents: number; currency: string; description?: string | null; createdAt: string };
type SupportTicket = { id: string; subject: string; status: string; priority: string; category: string; updatedAt: string; _count?: { messages: number } };
type StripeEvent = { id: string; stripeEventId: string; type: string; processingStatus: string; stripeAccountId?: string | null; objectId?: string | null; error?: string | null; createdAt: string };
type Limits = { trustTier: string; effectiveTrustTier: string; weeklyPayoutCapCents: number; weeklyRequestedPayoutGrossCents: number; minimumPayoutCents: number; payoutsEnabled: boolean };
type PayoutsResponse = { payouts: AdminPayout[]; summary?: { byStatus?: Array<{ status: PayoutRequestStatus; _count: { _all: number }; _sum: { grossAmountCents?: number | null; platformFeeCents?: number | null; netAmountCents?: number | null } }> } };
type DetailResponse = { payout: AdminPayout; ledgerEntries: LedgerEntry[]; supportTickets: SupportTicket[]; stripeEvents: StripeEvent[]; providerEvents?: ProviderEvent[]; providerTransactions?: ProviderTransaction[]; userLimits?: Limits };
type MoneySafetyAdmin = { config: { launchMode: string; moneyProvider?: string; moneyProviderEnvironment?: string; moneyProviderSandboxOnly?: boolean; policyVersion: string; realMoneyEnabled: boolean; providerTransfersEnabled?: boolean; stripeTransfersEnabled: boolean; requiresManualPayoutReview: boolean; productionSwitchEnabled: boolean; privateBetaAllowlistCount: number }; metrics?: { acknowledgementCount?: number; walletCount?: number; walletAggregate?: { _sum?: { availableBalanceCents?: number | null; heldBalanceCents?: number | null; pendingPayoutCents?: number | null } }; payoutsByStatus?: Array<{ status: string; _count: { _all: number } }> } };

const statuses: AdminPayoutStatusFilter[] = ['all', 'requested', 'approved', 'paid', 'rejected', 'cancelled', 'draft'];
const trustTiers: UserTrustTier[] = ['new', 'email_verified', 'stripe_verified', 'trusted', 'restricted'];
const actions: Array<{ action: AdminPayoutAction; label: string; tone: string; hint: string }> = [
  { action: 'approve', label: 'Approve', tone: 'success', hint: 'Move request to approved for payout processing.' },
  { action: 'pause', label: 'Pause', tone: 'warning', hint: 'Keep the payout requested while issues are reviewed.' },
  { action: 'retry', label: 'Retry', tone: 'info', hint: 'Clear failure details and mark for another processing attempt.' },
  { action: 'mark_paid', label: 'Mark paid', tone: 'success', hint: 'Record that the payout was completed outside this console.' },
  { action: 'reject', label: 'Reject + return balance', tone: 'danger', hint: 'Reject and return gross payout-eligible earnings to the wallet.' },
  { action: 'cancel', label: 'Cancel + return balance', tone: 'admin', hint: 'Cancel and return gross payout-eligible earnings to the wallet.' },
];

function statusTone(status: string) {
  if (status === 'paid') return 'success';
  if (status === 'approved') return 'info';
  if (status === 'requested') return 'warning';
  if (status === 'rejected' || status === 'cancelled') return 'danger';
  return 'admin';
}

function userLabel(user?: AdminUser) {
  return user?.profile?.displayName || user?.email || 'Unknown user';
}

function gross(payout: AdminPayout) {
  return payout.grossAmountCents && payout.grossAmountCents > 0 ? payout.grossAmountCents : payout.amountCents;
}

export default function AdminPayoutsPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [status, setStatus] = useState<AdminPayoutStatusFilter>('requested');
  const [items, setItems] = useState<AdminPayout[]>([]);
  const [summary, setSummary] = useState<PayoutsResponse['summary'] | null>(null);
  const [moneySafety, setMoneySafety] = useState<MoneySafetyAdmin | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [note, setNote] = useState('');
  const [scaToken, setScaToken] = useState('');
  const [trustTier, setTrustTier] = useState<UserTrustTier>('new');
  const [trustNote, setTrustNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const selectedPayout = detail?.payout ?? items.find((item) => item.id === selectedId) ?? null;


  async function loadPayouts(nextStatus = status) {
    if (!token) { setMessage(adminSessionRequiredMessage()); return; }
    setLoading(true);
    setMessage(null);
    try {
      const query = nextStatus === 'all' ? '' : `?status=${nextStatus}`;
      const [response, safetyResponse] = await Promise.all([fetch(`${apiBase}/admin/payouts${query}`, { headers }), fetch(`${apiBase}/admin/money-safety`, { headers })]);
      if (!response.ok) throw new Error('Could not load payouts. Make sure this account has admin role and 2FA requirements are satisfied.');
      const data = await response.json() as PayoutsResponse;
      if (safetyResponse.ok) setMoneySafety(await safetyResponse.json() as MoneySafetyAdmin);
      setItems(data.payouts);
      setSummary(data.summary ?? null);
      if (!selectedId && data.payouts[0]) void loadDetail(data.payouts[0].id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load payouts');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(payoutId: string) {
    if (!token) { setMessage(adminSessionRequiredMessage()); return; }
    setSelectedId(payoutId);
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/payouts/${payoutId}`, { headers });
      if (!response.ok) throw new Error('Could not load payout detail.');
      const data = await response.json() as DetailResponse;
      setDetail(data);
      setTrustTier(data.payout.user?.trustTier ?? 'new');
      setTrustNote('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load payout detail');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: AdminPayoutAction) {
    if (!token || !detail) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/payouts/${detail.payout.id}/action`, { method: 'PATCH', headers, body: JSON.stringify({ action, note, scaToken: scaToken.trim() || undefined }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? `Could not run payout action: ${action}`);
      }
      setNote('');
      setScaToken('');
      setMessage(`Payout action saved: ${action}.`);
      await loadPayouts(status);
      await loadDetail(detail.payout.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update payout');
    } finally {
      setLoading(false);
    }
  }

  async function syncProviderPayout() {
    if (!token || !detail) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/payouts/${detail.payout.id}/provider-sync`, { method: 'POST', headers, body: JSON.stringify({ scaToken: scaToken.trim() || undefined }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? 'Could not sync provider payout.');
      }
      setMessage('Provider payout status synced.');
      await loadPayouts(status);
      await loadDetail(detail.payout.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sync provider payout');
    } finally {
      setLoading(false);
    }
  }


  async function updateTrustTier() {
    if (!token || !selectedPayout?.user?.id) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/users/${selectedPayout.user.id}/trust-tier`, { method: 'PATCH', headers, body: JSON.stringify({ trustTier, note: trustNote }) });
      if (!response.ok) throw new Error('Could not update trust tier.');
      setMessage(`Trust tier updated to ${trustTier}.`);
      if (selectedPayout.id) await loadDetail(selectedPayout.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update trust tier');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-console">
      <div className="card admin-console__hero">
        <div>
          <span className="semantic-badge admin">Admin payouts</span>
          <h1>Payout console</h1>
          <p className="notice-box admin">Review payout requests, provider sandbox status, related support tickets, ledger entries, and admin audit notes before real-money launch.</p>
        </div>
        <p className="notice-box info">Internal tools use your signed-in admin app session. Standalone admin login is not exposed.</p>
        <div className="form-row">
          <select value={status} onChange={(event) => { const next = event.target.value as AdminPayoutStatusFilter; setStatus(next); void loadPayouts(next); }}>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button className="secondary" onClick={() => { void loadPayouts(); }} disabled={loading}>Load payout queue</button>
        </div>
        {message ? <p className="notice-box info">{message}</p> : null}
      </div>

      {moneySafety ? (
        <div className="admin-metric-grid">
          <article className="admin-metric-card">
            <span className="semantic-badge admin">Launch mode</span>
            <strong>{moneySafety.config.launchMode}</strong>
            <p>Policy {moneySafety.config.policyVersion} · {moneySafety.metrics?.acknowledgementCount ?? 0} acknowledgements</p>
          </article>
          <article className="admin-metric-card">
            <span className={`semantic-badge ${moneySafety.config.realMoneyEnabled ? 'danger' : 'success'}`}>Production money</span>
            <strong>{moneySafety.config.realMoneyEnabled ? 'On' : 'Off'}</strong>
            <p>Provider {moneySafety.config.moneyProvider ?? 'none'} · transfers {moneySafety.config.providerTransfersEnabled ? 'enabled' : 'disabled'} · production switch {moneySafety.config.productionSwitchEnabled ? 'on' : 'off'}</p>
          </article>
          <article className="admin-metric-card">
            <span className="semantic-badge warning">Manual review</span>
            <strong>{moneySafety.config.requiresManualPayoutReview ? 'Required' : 'Optional'}</strong>
            <p>Beta allowlist: {moneySafety.config.privateBetaAllowlistCount} users</p>
          </article>
          <article className="admin-metric-card">
            <span className="semantic-badge money">Wallet exposure</span>
            <strong>{formatWebMoney((moneySafety.metrics?.walletAggregate?._sum?.availableBalanceCents ?? 0) + (moneySafety.metrics?.walletAggregate?._sum?.heldBalanceCents ?? 0) + (moneySafety.metrics?.walletAggregate?._sum?.pendingPayoutCents ?? 0), 'eur')}</strong>
            <p>{moneySafety.metrics?.walletCount ?? 0} wallets tracked</p>
          </article>
        </div>
      ) : null}

      {summary?.byStatus?.length ? (
        <div className="admin-metric-grid">
          {summary.byStatus.map((row) => (
            <article key={row.status} className="admin-metric-card">
              <span className={`semantic-badge ${statusTone(row.status)}`}>{row.status}</span>
              <strong>{row._count._all}</strong>
              <p>{formatWebMoney(row._sum.netAmountCents ?? 0, items[0]?.currency ?? 'eur')} net / {formatWebMoney(row._sum.platformFeeCents ?? 0, items[0]?.currency ?? 'eur')} fees</p>
            </article>
          ))}
        </div>
      ) : null}

      <div className="admin-payout-layout">
        <div className="card admin-payout-list">
          <div className="status-row"><span className="semantic-badge money">Queue</span><span className="meta">{items.length} loaded</span></div>
          {items.map((item) => (
            <button key={item.id} className={item.id === selectedId ? 'admin-payout-row is-active' : 'admin-payout-row'} onClick={() => { void loadDetail(item.id); }}>
              <span><strong>{formatWebMoney(gross(item), item.currency)}</strong><small>{userLabel(item.user)}</small></span>
              <span><em className={`semantic-badge ${statusTone(item.status)}`}>{item.status}</em><small>{formatWebDateTime(item.requestedAt)}</small></span>
            </button>
          ))}
          {items.length === 0 ? <p>No payout requests loaded for this filter.</p> : null}
        </div>

        <div className="admin-payout-detail">
          {selectedPayout ? (
            <>
              <div className="card">
                <div className="status-row"><span className={`semantic-badge ${statusTone(selectedPayout.status)}`}>{selectedPayout.status}</span><span className="semantic-badge money">{selectedPayout.platformFeeRateBps / 100}% fee</span></div>
                <h2>{userLabel(selectedPayout.user)}</h2>
                <div className="admin-money-strip">
                  <span><small>Gross</small><strong>{formatWebMoney(gross(selectedPayout), selectedPayout.currency)}</strong></span>
                  <span><small>Platform fee</small><strong>-{formatWebMoney(selectedPayout.platformFeeCents, selectedPayout.currency)}</strong></span>
                  <span><small>Net payout</small><strong>{formatWebMoney(selectedPayout.netAmountCents, selectedPayout.currency)}</strong></span>
                </div>
                <p className="meta">Requested {formatWebDateTime(selectedPayout.requestedAt)} · Reviewed {formatWebDateTime(selectedPayout.reviewedAt)} · Paid {formatWebDateTime(selectedPayout.paidAt)}</p>
                {selectedPayout.provider ? <p className="notice-box info">Provider: {selectedPayout.provider} · status {selectedPayout.providerExternalStatus ?? 'not synced'} · transfer {selectedPayout.providerTransferId ?? selectedPayout.providerPayoutId ?? 'not created'}</p> : null}
                {selectedPayout.providerFailureMessage ? <p className="notice-box danger">{selectedPayout.providerFailureCode ? `${selectedPayout.providerFailureCode}: ` : ''}{selectedPayout.providerFailureMessage}</p> : null}
                {selectedPayout.stripeExternalStatus ? <p className="notice-box info">Stripe/external status: {selectedPayout.stripeExternalStatus}</p> : null}
                {selectedPayout.stripeFailureMessage ? <p className="notice-box danger">{selectedPayout.stripeFailureCode ? `${selectedPayout.stripeFailureCode}: ` : ''}{selectedPayout.stripeFailureMessage}</p> : null}
              </div>

              <div className="card admin-action-card">
                <span className="semantic-badge admin">Decision</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Admin note, reason, support ticket reference, or provider event context" />
                <input value={scaToken} onChange={(event) => setScaToken(event.target.value)} placeholder="Optional provider SCA token for sandbox payout calls" />
                <div className="admin-action-grid">
                  {actions.map((item) => <button key={item.action} className={item.tone} onClick={() => { void runAction(item.action); }} disabled={loading} title={item.hint}>{item.label}</button>)}
                  <button className="secondary" onClick={() => { void syncProviderPayout(); }} disabled={loading || !selectedPayout.providerTransferId}>Sync provider payout</button>
                </div>
                <p className="meta">Reject/cancel returns the gross payout-eligible earnings to the user wallet. Approve/retry can create an Airwallex sandbox payout transfer when provider payouts are enabled. Mark paid only when the payout is truly completed or simulated in test mode.</p>
              </div>

              <div className="admin-detail-grid">
                <div className="card">
                  <span className="semantic-badge trade">User risk</span>
                  <p>Trust tier: <strong>{selectedPayout.user?.trustTier ?? 'unknown'}</strong></p>
                  <p>Email verified: <strong>{selectedPayout.user?.emailVerifiedAt ? 'yes' : 'no'}</strong></p>
                  <p>Wallet pending payout: <strong>{formatWebMoney(selectedPayout.user?.wallet?.pendingPayoutCents ?? 0, selectedPayout.user?.wallet?.currency ?? selectedPayout.currency)}</strong></p>
                  {detail?.userLimits ? <p>Weekly cap: <strong>{formatWebMoney(detail.userLimits.weeklyRequestedPayoutGrossCents, selectedPayout.currency)} / {formatWebMoney(detail.userLimits.weeklyPayoutCapCents, selectedPayout.currency)}</strong></p> : null}
                  <div className="admin-trust-controls">
                    <select value={trustTier} onChange={(event) => setTrustTier(event.target.value as UserTrustTier)}>
                      {trustTiers.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <input value={trustNote} onChange={(event) => setTrustNote(event.target.value)} placeholder="Trust tier note" />
                    <button className="secondary" onClick={() => { void updateTrustTier(); }} disabled={loading || !selectedPayout.user?.id}>Update tier</button>
                  </div>
                </div>
                <div className="card">
                  <span className="semantic-badge money">Money provider</span>
                  {selectedPayout.providerAccount ? <><p>Provider: <strong>{selectedPayout.providerAccount.provider}</strong></p><p>Status: <strong>{selectedPayout.providerAccount.status}</strong></p><p>Account: <code>{selectedPayout.providerAccount.providerAccountId}</code></p><p>Currency: <strong>{selectedPayout.providerAccount.defaultCurrency ?? selectedPayout.currency}</strong></p></> : <p>No provider account attached. This may be a demo or legacy Stripe payout.</p>}
                </div>
                <div className="card">
                  <span className="semantic-badge admin">Stripe Connect fallback</span>
                  {selectedPayout.stripeConnectAccount ? <><p>Status: <strong>{selectedPayout.stripeConnectAccount.status}</strong></p><p>Payouts enabled: <strong>{selectedPayout.stripeConnectAccount.payoutsEnabled ? 'yes' : 'no'}</strong></p><p>Account: <code>{selectedPayout.stripeConnectAccount.stripeAccountId}</code></p>{selectedPayout.stripeConnectAccount.disabledReason ? <p className="notice-box warning">{selectedPayout.stripeConnectAccount.disabledReason}</p> : null}</> : <p>No Stripe Connect account attached. Stripe remains a disabled fallback/reference.</p>}
                </div>
              </div>

              <div className="admin-detail-grid">
                <div className="card admin-table-card">
                  <span className="semantic-badge money">Ledger</span>
                  <table><tbody>{detail?.ledgerEntries?.map((entry) => <tr key={entry.id}><td>{entry.type}</td><td>{entry.balanceType}</td><td>{formatWebMoney(entry.amountCents, entry.currency)}</td><td>{formatWebDateTime(entry.createdAt)}</td></tr>)}</tbody></table>
                  {!detail?.ledgerEntries?.length ? <p>No ledger entries loaded.</p> : null}
                </div>
                <div className="card admin-table-card">
                  <span className="semantic-badge warning">Support</span>
                  <table><tbody>{detail?.supportTickets?.map((ticket) => <tr key={ticket.id}><td>{ticket.subject}</td><td>{ticket.status}</td><td>{ticket.priority}</td><td>{formatWebDateTime(ticket.updatedAt)}</td></tr>)}</tbody></table>
                  {!detail?.supportTickets?.length ? <p>No recent support tickets for this user.</p> : null}
                </div>
              </div>

              <div className="admin-detail-grid">
                <div className="card admin-table-card">
                  <span className="semantic-badge admin">Audit trail</span>
                  <table><tbody>{selectedPayout.adminEvents?.map((event) => <tr key={event.id}><td>{event.action}</td><td>{event.previousStatus ?? '—'} → {event.nextStatus ?? '—'}</td><td>{event.admin?.profile?.displayName ?? event.admin?.email ?? 'Admin'}</td><td>{formatWebDateTime(event.createdAt)}</td></tr>)}</tbody></table>
                  {!selectedPayout.adminEvents?.length ? <p>No admin actions yet.</p> : null}
                </div>
                <div className="card admin-table-card">
                  <span className="semantic-badge money">Provider transactions</span>
                  <table><tbody>{detail?.providerTransactions?.map((transaction) => <tr key={transaction.id}><td>{transaction.provider}</td><td>{transaction.type}</td><td>{transaction.status}</td><td>{formatWebMoney(transaction.amountCents, transaction.currency)}</td><td>{formatWebDateTime(transaction.createdAt)}</td></tr>)}</tbody></table>
                  {!detail?.providerTransactions?.length ? <p>No matching provider transactions loaded.</p> : null}
                </div>
              </div>

              <div className="admin-detail-grid">
                <div className="card admin-table-card">
                  <span className="semantic-badge info">Provider events</span>
                  <table><tbody>{detail?.providerEvents?.map((event) => <tr key={event.id}><td>{event.provider}</td><td>{event.eventType}</td><td>{event.processingStatus ?? event.status ?? 'received'}</td><td>{event.providerAccountId ?? '—'}</td><td>{formatWebDateTime(event.createdAt)}</td></tr>)}</tbody></table>
                  {!detail?.providerEvents?.length ? <p>No matching provider events loaded.</p> : null}
                </div>
                <div className="card admin-table-card">
                  <span className="semantic-badge info">Stripe events</span>
                  <table><tbody>{detail?.stripeEvents?.map((event) => <tr key={event.id}><td>{event.type}</td><td>{event.processingStatus ?? 'received'}</td><td>{event.objectId ?? event.stripeAccountId ?? '—'}</td><td>{formatWebDateTime(event.createdAt)}</td></tr>)}</tbody></table>
                  {!detail?.stripeEvents?.length ? <p>No matching Stripe events loaded.</p> : null}
                </div>
              </div>
            </>
          ) : <div className="card"><p>Select a payout request to review.</p></div>}
        </div>
      </div>
    </section>
  );
}
