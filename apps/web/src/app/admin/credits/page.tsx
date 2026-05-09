'use client';

import { useMemo, useState } from 'react';
import type { CreditPurchaseDto, CreditPurchaseStatus } from '@hellowhen/contracts';
import { formatWebDateTime, formatWebMoney } from '../../../lib/webFormat';

type LoginResponse = { accessToken: string };
type AdminPurchaseItem = CreditPurchaseDto & { user?: { email?: string; profile?: { displayName?: string | null } | null } };
type PurchasesResponse = { purchases: AdminPurchaseItem[] };

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const statuses: Array<CreditPurchaseStatus | 'all'> = ['all', 'pending', 'paid', 'failed', 'expired'];

function statusTone(status: CreditPurchaseStatus | 'all') {
  if (status === 'paid') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'failed') return 'danger';
  if (status === 'expired') return 'admin';
  return 'info';
}

function money(amountCents: number, currency: string) {
  return formatWebMoney(amountCents, currency);
}

export default function AdminCreditsPage() {
  const [email, setEmail] = useState('admin@hellowhen.app');
  const [password, setPassword] = useState('password123');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<CreditPurchaseStatus | 'all'>('all');
  const [items, setItems] = useState<AdminPurchaseItem[]>([]);
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
      setMessage('Admin logged in. Load credit purchases to review Stripe test sessions.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Login failed'); }
    finally { setLoading(false); }
  }

  async function loadPurchases() {
    if (!token) { setMessage('Log in as admin first.'); return; }
    setLoading(true); setMessage(null);
    try {
      const query = status === 'all' ? '' : `?status=${status}`;
      const response = await fetch(`${apiBase}/admin/credits/purchases${query}`, { headers });
      if (!response.ok) throw new Error('Could not load credit purchases. Make sure this account has admin role.');
      const data = await response.json() as PurchasesResponse;
      setItems(data.purchases);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load purchases'); }
    finally { setLoading(false); }
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <span className="semantic-badge credits">Stripe Test Credits</span>
        <h1>Credit purchases</h1>
        <p className="notice-box info">Debug view for Stripe test-mode credit purchases. Paid purchases should create credit_purchase ledger entries and increase non-withdrawable purchased credits.</p>
        <div className="form-row">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Admin email" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
          </div>
          <button onClick={() => { void login(); }} disabled={loading}>{token ? 'Logged in' : 'Login'}</button>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <select value={status} onChange={(event) => setStatus(event.target.value as CreditPurchaseStatus | 'all')}>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button className="secondary" onClick={() => { void loadPurchases(); }} disabled={loading}>Load purchases</button>
        </div>
        {message ? <p className="notice-box info">{message}</p> : null}
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th align="left">Status</th><th align="left">User</th><th align="left">Credits</th><th align="left">Amount</th><th align="left">Stripe session</th><th align="left">Created</th><th align="left">Paid</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td><span className={`semantic-badge ${statusTone(item.status)}`}>{item.status}</span></td><td>{item.user?.profile?.displayName ?? item.user?.email ?? item.userId}</td><td>{item.creditAmount}</td><td>{money(item.amountCents, item.currency)}</td><td><code>{item.stripeCheckoutSessionId ?? 'pending'}</code></td><td>{formatWebDateTime(item.createdAt)}</td><td>{formatWebDateTime(item.paidAt)}</td></tr>)}</tbody>
        </table>
        {items.length === 0 ? <p>No credit purchases loaded yet.</p> : null}
      </div>
    </section>
  );
}
