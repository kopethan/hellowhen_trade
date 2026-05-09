'use client';

import { useMemo, useState } from 'react';
import { formatWebDateTime } from '../../../lib/webFormat';

type LoginResponse = { accessToken: string };
type ProviderSummary = { provider?: string; environment?: string; configured?: boolean; sandboxOnly?: boolean; capabilities?: string[] };
type ProviderAccount = {
  id?: string;
  provider: string;
  providerAccountId?: string;
  legacyStripeAccountId?: string;
  accountType?: string;
  status?: string;
  defaultCurrency?: string | null;
  country?: string | null;
  lastSyncedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: { email?: string; profile?: { displayName?: string | null } | null; trustTier?: string };
};
type ProviderEvent = {
  provider: string;
  providerEventId: string;
  type: string;
  processingStatus?: string;
  providerAccountId?: string | null;
  createdAt?: string;
  processedAt?: string | null;
  error?: string | null;
};
type ProviderTransaction = {
  id?: string;
  provider: string;
  providerTransactionId: string;
  type: string;
  status: string;
  amountCents: number;
  currency: string;
  tradeId?: string | null;
  payoutRequestId?: string | null;
  providerAccountId?: string | null;
  counterpartyProviderAccountId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: { email?: string; profile?: { displayName?: string | null } | null };
};

type ProviderBalance = {
  id: string;
  provider: string;
  providerAccountId?: string;
  moneyProviderAccountId: string;
  currency: string;
  availableCents: number;
  reservedCents: number;
  pendingCents: number;
  totalCents: number;
  externalUpdatedAt?: string | null;
  lastSyncedAt?: string | null;
  updatedAt?: string;
  account?: { user?: { email?: string; profile?: { displayName?: string | null } | null } };
};
type AccountsResponse = { provider: ProviderSummary; accounts: ProviderAccount[] };
type EventsResponse = { provider: ProviderSummary; events: ProviderEvent[] };
type BalancesResponse = { provider: ProviderSummary; balances: ProviderBalance[] };
type TransactionsResponse = { provider: ProviderSummary; transactions: ProviderTransaction[] };

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function statusTone(status?: string) {
  if (status === 'active' || status === 'enabled' || status === 'connected' || status === 'processed' || status === 'succeeded' || status === 'settled' || status === 'recorded') return 'success';
  if (status === 'pending' || status === 'onboarding' || status === 'received' || status === 'skipped') return 'warning';
  if (status === 'restricted' || status === 'failed' || status === 'rejected' || status === 'disabled' || status === 'reversed' || status === 'canceled') return 'danger';
  return 'admin';
}

function userLabel(account: ProviderAccount) {
  return account.user?.profile?.displayName ?? account.user?.email ?? 'Unknown user';
}

function balanceUserLabel(balance: ProviderBalance) {
  return balance.account?.user?.profile?.displayName ?? balance.account?.user?.email ?? 'Unknown user';
}

function transactionUserLabel(transaction: ProviderTransaction) {
  return transaction.user?.profile?.displayName ?? transaction.user?.email ?? 'Unknown user';
}

function formatMoney(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export default function AdminMoneyProviderPage() {
  const [email, setEmail] = useState('admin@hellowhen.app');
  const [password, setPassword] = useState('password123');
  const [token, setToken] = useState('');
  const [provider, setProvider] = useState<ProviderSummary | null>(null);
  const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
  const [events, setEvents] = useState<ProviderEvent[]>([]);
  const [balances, setBalances] = useState<ProviderBalance[]>([]);
  const [transactions, setTransactions] = useState<ProviderTransaction[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  async function login() {
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error('Login failed');
      const data = await response.json() as LoginResponse;
      setToken(data.accessToken);
      setMessage('Admin logged in. Load provider accounts and events to inspect sandbox money setup.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Login failed'); }
    finally { setLoading(false); }
  }

  async function loadMoneyProviderData() {
    if (!token) { setMessage('Log in as admin first.'); return; }
    setLoading(true); setMessage(null);
    try {
      const [accountsResponse, eventsResponse, balancesResponse, transactionsResponse] = await Promise.all([
        fetch(`${apiBase}/admin/money/provider-accounts`, { headers }),
        fetch(`${apiBase}/admin/money/provider-events`, { headers }),
        fetch(`${apiBase}/admin/money/provider-balances`, { headers }),
        fetch(`${apiBase}/admin/money/provider-transactions`, { headers }),
      ]);
      if (!accountsResponse.ok || !eventsResponse.ok || !balancesResponse.ok || !transactionsResponse.ok) throw new Error('Could not load provider data. Make sure this account has admin role.');
      const accountsData = await accountsResponse.json() as AccountsResponse;
      const eventsData = await eventsResponse.json() as EventsResponse;
      const balancesData = await balancesResponse.json() as BalancesResponse;
      const transactionsData = await transactionsResponse.json() as TransactionsResponse;
      setProvider(accountsData.provider);
      setAccounts(accountsData.accounts);
      setEvents(eventsData.events);
      setBalances(balancesData.balances);
      setTransactions(transactionsData.transactions);
      setMessage('Provider records loaded. Airwallex wallet balances, trade-money transactions, and payout transfers are sandbox reconciliation records.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load provider data'); }
    finally { setLoading(false); }
  }


  async function syncBalances(accountId?: string) {
    if (!token) { setMessage('Log in as admin first.'); return; }
    if (!accountId) { setMessage('Only provider-neutral accounts can sync balances. Legacy Stripe rows are read-only here.'); return; }
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/money/provider-accounts/${accountId}/sync-balances`, { method: 'POST', headers, body: JSON.stringify({}) });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(error?.message ?? 'Could not sync provider balances.');
      }
      setMessage('Provider balances synced. Reloading balance records.');
      await loadMoneyProviderData();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not sync provider balances'); }
    finally { setLoading(false); }
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <span className="semantic-badge admin">Money provider admin</span>
        <h1>Provider accounts</h1>
        <p className="notice-box warning">Phase 21.5 adds sandbox payout transfer records on top of connected accounts, wallet balances, and trade-money mirroring. Keep first-beta money features hidden and disabled unless you are testing Airwallex demo credentials locally.</p>
        <div className="form-row">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Admin email" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
          </div>
          <button onClick={() => { void login(); }} disabled={loading}>{token ? 'Logged in' : 'Login'}</button>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <button className="secondary" onClick={() => { void loadMoneyProviderData(); }} disabled={loading}>Load provider data</button>
        </div>
        {provider ? <p className="notice-box info">Active provider: <strong>{provider.provider}</strong> · env: <strong>{provider.environment}</strong> · configured: <strong>{String(provider.configured)}</strong> · sandbox only: <strong>{String(provider.sandboxOnly)}</strong></p> : null}
        {message ? <p className="notice-box info">{message}</p> : null}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Connected accounts</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th align="left">Provider</th><th align="left">Status</th><th align="left">User</th><th align="left">Account ID</th><th align="left">Country</th><th align="left">Currency</th><th align="left">Last sync</th><th align="left">Balances</th></tr></thead>
          <tbody>{accounts.map((account, index) => <tr key={`${account.provider}-${account.providerAccountId ?? index}`}><td>{account.provider}</td><td><span className={`semantic-badge ${statusTone(account.status)}`}>{account.status ?? 'unknown'}</span></td><td>{userLabel(account)}</td><td><code>{account.providerAccountId ?? account.legacyStripeAccountId ?? '—'}</code></td><td>{account.country ?? '—'}</td><td>{account.defaultCurrency ?? '—'}</td><td>{formatWebDateTime(account.lastSyncedAt ?? account.updatedAt ?? account.createdAt)}</td><td><button className="secondary" onClick={() => { void syncBalances(account.id); }} disabled={loading || !account.id || account.provider === 'stripe_legacy'}>Sync</button></td></tr>)}</tbody>
        </table>
        {accounts.length === 0 ? <p>No provider accounts loaded yet.</p> : null}
      </div>


      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Provider wallet balances</h2>
        <p className="notice-box info">These are provider snapshots for sandbox reconciliation only. Hellowhen's own ledger remains the product source of truth.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th align="left">Provider</th><th align="left">User</th><th align="left">Currency</th><th align="left">Available</th><th align="left">Reserved</th><th align="left">Pending</th><th align="left">Total</th><th align="left">Last sync</th></tr></thead>
          <tbody>{balances.map((balance) => <tr key={balance.id}><td>{balance.provider}</td><td>{balanceUserLabel(balance)}</td><td>{balance.currency.toUpperCase()}</td><td>{formatMoney(balance.availableCents, balance.currency)}</td><td>{formatMoney(balance.reservedCents, balance.currency)}</td><td>{formatMoney(balance.pendingCents, balance.currency)}</td><td>{formatMoney(balance.totalCents, balance.currency)}</td><td>{formatWebDateTime(balance.lastSyncedAt ?? balance.updatedAt)}</td></tr>)}</tbody>
        </table>
        {balances.length === 0 ? <p>No provider wallet balances synced yet.</p> : null}
      </div>


      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Provider money transactions</h2>
        <p className="notice-box info">These records mirror Hellowhen trade holds, releases, refunds, platform fees, and sandbox payout transfers. Airwallex API calls only run when the matching provider flags are explicitly enabled.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th align="left">Provider</th><th align="left">Status</th><th align="left">Type</th><th align="left">User</th><th align="left">Amount</th><th align="left">Trade/Payout</th><th align="left">Provider Txn</th><th align="left">Created</th></tr></thead>
          <tbody>{transactions.map((transaction) => <tr key={`${transaction.provider}-${transaction.providerTransactionId}`}><td>{transaction.provider}</td><td><span className={`semantic-badge ${statusTone(transaction.status)}`}>{transaction.status}</span></td><td>{transaction.type}</td><td>{transactionUserLabel(transaction)}</td><td>{formatMoney(transaction.amountCents, transaction.currency)}</td><td><code>{transaction.tradeId ?? transaction.payoutRequestId ?? '—'}</code></td><td><code>{transaction.providerTransactionId}</code></td><td>{formatWebDateTime(transaction.createdAt ?? transaction.updatedAt)}</td></tr>)}</tbody>
        </table>
        {transactions.length === 0 ? <p>No provider money transactions recorded yet.</p> : null}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Provider events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th align="left">Provider</th><th align="left">Status</th><th align="left">Type</th><th align="left">Event ID</th><th align="left">Account</th><th align="left">Processed</th><th align="left">Error</th></tr></thead>
          <tbody>{events.map((event) => <tr key={`${event.provider}-${event.providerEventId}`}><td>{event.provider}</td><td><span className={`semantic-badge ${statusTone(event.processingStatus)}`}>{event.processingStatus ?? 'received'}</span></td><td>{event.type}</td><td><code>{event.providerEventId}</code></td><td><code>{event.providerAccountId ?? '—'}</code></td><td>{formatWebDateTime(event.processedAt ?? event.createdAt)}</td><td>{event.error ?? '—'}</td></tr>)}</tbody>
        </table>
        {events.length === 0 ? <p>No provider events loaded yet.</p> : null}
      </div>
    </section>
  );
}
