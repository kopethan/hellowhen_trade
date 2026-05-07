'use client';

import { useMemo, useState } from 'react';
import type { SupportTicketCategory, SupportTicketDto, SupportTicketPriority, SupportTicketStatus } from '@hellowhen/contracts';

type LoginResponse = { accessToken: string };
type AdminTicketItem = SupportTicketDto & { user?: { email?: string; profile?: { displayName?: string | null } | null }; _count?: { messages: number } };
type TicketsResponse = { tickets: AdminTicketItem[] };
type TicketResponse = { ticket: AdminTicketItem };

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const statuses: Array<SupportTicketStatus | 'all'> = ['all', 'open', 'in_review', 'waiting_for_user', 'resolved', 'closed'];
const categories: Array<SupportTicketCategory | 'all'> = ['all', 'general_feedback', 'trade_issue', 'credits_issue', 'media_issue', 'bug_report', 'account_issue', 'safety_concern'];
const priorities: Array<SupportTicketPriority | 'all'> = ['all', 'low', 'normal', 'high', 'urgent'];

function labelize(value: string) { return value.replaceAll('_', ' '); }
function statusTone(status: SupportTicketStatus | 'all') {
  if (status === 'resolved') return 'success';
  if (status === 'waiting_for_user') return 'instruction';
  if (status === 'in_review') return 'warning';
  if (status === 'closed') return 'admin';
  if (status === 'open') return 'info';
  return 'info';
}
function priorityTone(priority: SupportTicketPriority | 'all') {
  if (priority === 'urgent') return 'danger';
  if (priority === 'high') return 'warning';
  if (priority === 'low') return 'admin';
  return 'info';
}
function categoryTone(category: SupportTicketCategory | 'all') {
  if (category === 'trade_issue') return 'trade';
  if (category === 'credits_issue') return 'credits';
  if (category === 'media_issue') return 'warning';
  if (category === 'safety_concern') return 'danger';
  if (category === 'bug_report') return 'instruction';
  return 'info';
}

export default function AdminSupportPage() {
  const [email, setEmail] = useState('admin@hellowhen.app');
  const [password, setPassword] = useState('password123');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<SupportTicketStatus | 'all'>('open');
  const [category, setCategory] = useState<SupportTicketCategory | 'all'>('all');
  const [priority, setPriority] = useState<SupportTicketPriority | 'all'>('all');
  const [tickets, setTickets] = useState<AdminTicketItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<AdminTicketItem | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [internal, setInternal] = useState(false);
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
      setMessage('Admin logged in. Load support tickets to handle feedback and problems.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Login failed'); }
    finally { setLoading(false); }
  }

  function queryString() {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (category !== 'all') params.set('category', category);
    if (priority !== 'all') params.set('priority', priority);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  async function loadTickets() {
    if (!token) { setMessage('Log in as admin first.'); return; }
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/support/tickets${queryString()}`, { headers });
      if (!response.ok) throw new Error('Could not load support tickets. Make sure this account has admin role.');
      const data = await response.json() as TicketsResponse;
      setTickets(data.tickets);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load tickets'); }
    finally { setLoading(false); }
  }

  async function openTicket(ticketId: string) {
    if (!token) return;
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/support/tickets/${ticketId}`, { headers });
      if (!response.ok) throw new Error('Could not open support ticket');
      const data = await response.json() as TicketResponse;
      setSelectedTicket(data.ticket);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open ticket'); }
    finally { setLoading(false); }
  }

  async function updateTicket(nextStatus: SupportTicketStatus, nextPriority = selectedTicket?.priority ?? 'normal') {
    if (!token || !selectedTicket) return;
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/support/tickets/${selectedTicket.id}`, { method: 'PATCH', headers, body: JSON.stringify({ status: nextStatus, priority: nextPriority }) });
      if (!response.ok) throw new Error('Could not update support ticket');
      const data = await response.json() as TicketResponse;
      setSelectedTicket(data.ticket);
      await loadTickets();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update ticket'); }
    finally { setLoading(false); }
  }

  async function sendReply() {
    if (!token || !selectedTicket || !replyBody.trim()) return;
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/support/tickets/${selectedTicket.id}/messages`, { method: 'POST', headers, body: JSON.stringify({ body: replyBody.trim(), internal, status: internal ? selectedTicket.status : 'waiting_for_user' }) });
      if (!response.ok) throw new Error('Could not send support reply');
      setReplyBody('');
      await openTicket(selectedTicket.id);
      await loadTickets();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not send reply'); }
    finally { setLoading(false); }
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <span className="semantic-badge instruction">Support Admin</span>
        <h1>Feedback & support tickets</h1>
        <p className="notice-box info">Handle user feedback, trade issues, credit questions, image/content issues, bug reports, account problems, and safety concerns. This is separate from proposal conversations.</p>
        <div className="form-row">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Admin email" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
          </div>
          <button onClick={() => { void login(); }} disabled={loading}>{token ? 'Logged in' : 'Login'}</button>
        </div>
        <div className="form-row" style={{ marginTop: 12, gridTemplateColumns: '1fr 1fr 1fr auto' }}>
          <select value={status} onChange={(event) => setStatus(event.target.value as SupportTicketStatus | 'all')}>{statuses.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
          <select value={category} onChange={(event) => setCategory(event.target.value as SupportTicketCategory | 'all')}>{categories.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
          <select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicketPriority | 'all')}>{priorities.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
          <button className="secondary" onClick={() => { void loadTickets(); }} disabled={loading}>Load tickets</button>
        </div>
        {message ? <p className="notice-box info">{message}</p> : null}
      </div>
      <div className="support-layout">
        <div className="card">
          <h2>Tickets</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {tickets.map((ticket) => <button key={ticket.id} className="support-ticket-button" onClick={() => { void openTicket(ticket.id); }}><span className={`semantic-badge ${statusTone(ticket.status)}`}>{labelize(ticket.status)}</span><span className={`semantic-badge ${categoryTone(ticket.category)}`}>{labelize(ticket.category)}</span><strong>{ticket.subject}</strong><span className="meta">{ticket.user?.profile?.displayName ?? ticket.user?.email ?? ticket.userId} · {ticket._count?.messages ?? ticket.messages?.length ?? 0} messages · {new Date(ticket.updatedAt).toLocaleString()}</span></button>)}
            {tickets.length === 0 ? <p>No support tickets loaded yet.</p> : null}
          </div>
        </div>
        <div className="card">
          {selectedTicket ? <>
            <div className="status-row"><span className={`semantic-badge ${statusTone(selectedTicket.status)}`}>{labelize(selectedTicket.status)}</span><span className={`semantic-badge ${categoryTone(selectedTicket.category)}`}>{labelize(selectedTicket.category)}</span><span className={`semantic-badge ${priorityTone(selectedTicket.priority)}`}>{selectedTicket.priority}</span></div>
            <h2>{selectedTicket.subject}</h2>
            <p className="meta">User: {selectedTicket.user?.profile?.displayName ?? selectedTicket.user?.email ?? selectedTicket.userId}</p>
            <p>{selectedTicket.message}</p>
            <div className="status-row">{selectedTicket.relatedTradeId ? <span className="semantic-badge trade">Trade {selectedTicket.relatedTradeId}</span> : null}{selectedTicket.relatedProposalId ? <span className="semantic-badge proposal">Proposal {selectedTicket.relatedProposalId}</span> : null}{selectedTicket.relatedMediaId ? <span className="semantic-badge warning">Media {selectedTicket.relatedMediaId}</span> : null}</div>
            <div className="support-thread">{selectedTicket.messages?.map((item) => <article key={item.id} className={`support-message ${item.senderRole === 'admin' ? 'admin' : 'user'}`}><div className="status-row"><span className={`semantic-badge ${item.senderRole === 'admin' ? 'admin' : 'info'}`}>{item.senderRole === 'admin' ? 'Hellowhen support' : (item.sender?.profile?.displayName ?? item.sender?.email ?? 'User')}</span>{item.internal ? <span className="semantic-badge warning">internal</span> : null}</div><p>{item.body}</p><p className="meta">{new Date(item.createdAt).toLocaleString()}</p></article>)}</div>
            <div className="cta-row"><button className="warning" onClick={() => { void updateTicket('in_review'); }} disabled={loading}>Mark in review</button><button className="secondary" onClick={() => { void updateTicket('waiting_for_user'); }} disabled={loading}>Waiting for user</button><button className="success" onClick={() => { void updateTicket('resolved'); }} disabled={loading}>Resolve</button><button className="danger" onClick={() => { void updateTicket('closed'); }} disabled={loading}>Close</button></div>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}><textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="Reply to the user or add an internal note" rows={5} /><label className="meta"><input style={{ width: 'auto', marginRight: 8 }} type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> Internal admin note only</label><button onClick={() => { void sendReply(); }} disabled={loading || !replyBody.trim()}>{internal ? 'Add internal note' : 'Send public reply'}</button></div>
          </> : <p>Select a ticket to read the full conversation.</p>}
        </div>
      </div>
    </section>
  );
}
