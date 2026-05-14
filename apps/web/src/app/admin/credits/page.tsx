'use client';

import { useMemo, useState } from 'react';
import type { CreditPurchaseDto, CreditPurchaseStatus } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { adminSessionRequiredMessage, useAdminSessionToken } from '../../../features/admin/adminSession';
import { formatWebDateTime, formatWebMoney } from '../../../lib/webFormat';

type AdminPurchaseItem = CreditPurchaseDto & { user?: { email?: string; profile?: { displayName?: string | null } | null } };
type PurchasesResponse = { purchases: AdminPurchaseItem[] };

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
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [status, setStatus] = useState<CreditPurchaseStatus | 'all'>('all');
  const [items, setItems] = useState<AdminPurchaseItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadPurchases() {
    if (!token) { setMessage(adminSessionRequiredMessage()); return; }
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
        <p className="notice-box info">Internal tools use your signed-in admin app session. Standalone admin login is not exposed.</p>
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
