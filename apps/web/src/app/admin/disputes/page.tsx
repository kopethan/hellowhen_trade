'use client';

import { useState } from 'react';
import { formatWebDateTime } from '../../../lib/webFormat';

type LoginResponse = { accessToken: string } | { requiresTwoFactor: true; challengeToken: string; message?: string };
type DisputeTrade = { id: string; title: string; status: string; amountCents?: number; currency?: string; ownerId: string; providerId?: string | null; disputedAt?: string | null; disputedById?: string | null; disputeTicketId?: string | null; payment?: { buyerId: string; sellerId?: string | null; amountCents?: number; currency?: string; status: string } | null; owner?: { email?: string; profile?: { displayName?: string | null } | null }; provider?: { email?: string; profile?: { displayName?: string | null } | null } | null };
type SupportTicket = { id: string; relatedTradeId?: string | null; subject: string; status: string; priority: string; category: string; updatedAt: string; user?: { email?: string; profile?: { displayName?: string | null } | null } | null };
type DisputesResponse = { trades: DisputeTrade[]; supportTickets: SupportTicket[] };

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function isTwoFactorRequired(value: LoginResponse): value is Extract<LoginResponse, { requiresTwoFactor: true }> {
  return 'requiresTwoFactor' in value && value.requiresTwoFactor === true;
}

function personLabel(user?: { email?: string; profile?: { displayName?: string | null } | null } | null) {
  return user?.profile?.displayName || user?.email || 'Unknown member';
}

export default function AdminDisputesPage() {
  const [email, setEmail] = useState('admin@hellowhen.app');
  const [password, setPassword] = useState('password123');
  const [token, setToken] = useState('');
  const [trades, setTrades] = useState<DisputeTrade[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function login() {
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error('Login failed');
      const data = await response.json() as LoginResponse;
      if (isTwoFactorRequired(data)) throw new Error(data.message || 'This admin account requires two-step verification.');
      setToken(data.accessToken);
      setMessage('Admin logged in. Load disputed trades to review open issues.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Login failed'); }
    finally { setLoading(false); }
  }

  async function loadDisputes() {
    if (!token) { setMessage('Log in as admin first.'); return; }
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/trades/disputes`, { headers });
      if (!response.ok) throw new Error('Could not load disputes.');
      const data = await response.json() as DisputesResponse;
      setTrades(data.trades);
      setTickets(data.supportTickets);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load disputes'); }
    finally { setLoading(false); }
  }

  async function resolve(tradeId: string, action: 'refund_payer' | 'release_seller' | 'mark_resolved') {
    if (!token) return;
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/trades/${tradeId}/dispute`, { method: 'PATCH', headers, body: JSON.stringify({ action, note }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not resolve dispute.');
      }
      setNote('');
      setMessage('Dispute action saved.');
      await loadDisputes();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not resolve dispute'); }
    finally { setLoading(false); }
  }

  return (
    <main className="admin-console">
      <section className="admin-console__hero app-card">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Trade disputes</h1>
          <p>Review reported trades, linked support tickets, and admin notes.</p>
        </div>
        <div className="admin-console__login-grid">
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Admin email" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
          <button type="button" onClick={login} disabled={loading}>Log in</button>
          <button type="button" onClick={loadDisputes} disabled={loading || !token}>Load disputes</button>
        </div>
        {message ? <p className="notice-box info">{message}</p> : null}
      </section>

      <section className="admin-payout-layout">
        <div className="admin-payout-list">
          {trades.length === 0 ? <div className="app-card"><strong>No disputed trades loaded.</strong><p>Reported trades will appear here.</p></div> : null}
          {trades.map((trade) => {
            const ticket = tickets.find((item) => item.relatedTradeId === trade.id || item.id === trade.disputeTicketId);
            return (
              <article key={trade.id} className="app-card admin-action-card">
                <div className="status-row"><span className="semantic-badge danger">{trade.status}</span></div>
                <h2>{trade.title}</h2>
                <p>Owner: {personLabel(trade.owner)} · Provider: {personLabel(trade.provider)}</p>
                <p className="meta">Disputed {formatWebDateTime(trade.disputedAt)}</p>
                {ticket ? <p className="notice-box warning">Ticket: {ticket.subject} · {ticket.priority} · {ticket.status}</p> : null}
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal resolution note" rows={3} />
                <div className="admin-action-grid">
                  <button type="button" onClick={() => void resolve(trade.id, 'refund_payer')} disabled={loading}>Resolve for owner</button>
                  <button type="button" onClick={() => void resolve(trade.id, 'release_seller')} disabled={loading}>Resolve for provider</button>
                  <button type="button" onClick={() => void resolve(trade.id, 'mark_resolved')} disabled={loading}>Close only</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
