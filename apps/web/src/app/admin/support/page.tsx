'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { SupportTicketCategory, SupportTicketDto, SupportTicketPriority, SupportTicketStatus } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';
import { useWebAuth } from '../../../providers/WebAuthProvider';
import { formatWebDateTime } from '../../../lib/webFormat';

type AdminTicketItem = SupportTicketDto & { user?: { email?: string; profile?: { displayName?: string | null; handle?: string | null } | null }; _count?: { messages: number } };
type TicketsResponse = { tickets: AdminTicketItem[] };
type TicketResponse = { ticket: AdminTicketItem };
type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type AssignedFilter = 'all' | 'unassigned' | 'mine';

const statuses: Array<SupportTicketStatus | 'all'> = ['all', 'open', 'in_review', 'waiting_for_user', 'resolved', 'closed'];
const categories: Array<SupportTicketCategory | 'all'> = ['all', 'general_feedback', 'trade_issue', 'credits_issue', 'media_issue', 'bug_report', 'account_issue', 'safety_concern'];
const priorities: Array<SupportTicketPriority | 'all'> = ['all', 'low', 'normal', 'high', 'urgent'];
const assignedFilters: AssignedFilter[] = ['all', 'unassigned', 'mine'];

function labelize(value?: string | null) { return value ? value.replaceAll('_', ' ') : 'unknown'; }
function personLabel(user?: { email?: string; profile?: { displayName?: string | null; handle?: string | null } | null } | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}
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
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const auth = useWebAuth();
  const { token, headers } = useAdminSessionToken();
  const currentAdminId = auth.user?.id ?? null;
  const [status, setStatus] = useState<SupportTicketStatus | 'all'>('open');
  const [category, setCategory] = useState<SupportTicketCategory | 'all'>('all');
  const [priority, setPriority] = useState<SupportTicketPriority | 'all'>('all');
  const [assigned, setAssigned] = useState<AssignedFilter>('all');
  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<AdminTicketItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<AdminTicketItem | null>(null);
  const [deepLinkTicketId, setDeepLinkTicketId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [ticketNote, setTicketNote] = useState('');
  const [internal, setInternal] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const ticketId = new URLSearchParams(window.location.search).get('ticketId');
    if (ticketId) setDeepLinkTicketId(ticketId);
  }, []);

  useEffect(() => {
    if (!token || !deepLinkTicketId) return;
    void openTicket(deepLinkTicketId);
    setDeepLinkTicketId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, deepLinkTicketId]);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setTickets([]);
    setSelectedTicket(null);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function queryString() {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (category !== 'all') params.set('category', category);
    if (priority !== 'all') params.set('priority', priority);
    if (assigned !== 'all') params.set('assigned', assigned);
    if (query.trim()) params.set('q', query.trim());
    const text = params.toString();
    return text ? `?${text}` : '';
  }

  async function loadTickets() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/support/tickets${queryString()}`, { headers });
      if (!response.ok) throw new Error('Could not load support tickets. Make sure this account has admin role and satisfies 2FA requirements.');
      const data = await response.json() as TicketsResponse;
      setTickets(data.tickets);
      if (selectedTicket) setSelectedTicket(data.tickets.find((item) => item.id === selectedTicket.id) ?? selectedTicket);
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load tickets.' });
    } finally {
      setLoading(false);
    }
  }

  async function openTicket(ticketId: string) {
    if (!token) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/support/tickets/${ticketId}`, { headers });
      if (!response.ok) throw new Error('Could not open support ticket. It may have been deleted or your admin session may need refreshing.');
      const data = await response.json() as TicketResponse;
      setSelectedTicket(data.ticket);
      setTicketNote('');
      setTickets((current) => current.some((item) => item.id === data.ticket.id) ? current.map((item) => item.id === data.ticket.id ? data.ticket : item) : [data.ticket, ...current]);
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not open ticket.' });
    } finally {
      setLoading(false);
    }
  }

  async function updateTicket(next: { status?: SupportTicketStatus; priority?: SupportTicketPriority; assignedAdminId?: string | null }) {
    if (!token || !selectedTicket) return;
    if (next.status && next.status !== selectedTicket.status && !ticketNote.trim()) {
      setNotice({ tone: 'warning', body: 'Add an internal note before changing or reopening ticket status.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/support/tickets/${selectedTicket.id}`, { method: 'PATCH', headers, body: JSON.stringify({ ...next, note: ticketNote.trim() || undefined }) });
      if (!response.ok) throw new Error('Could not update support ticket.');
      const data = await response.json() as TicketResponse;
      setSelectedTicket(data.ticket);
      setTickets((current) => current.map((item) => item.id === data.ticket.id ? data.ticket : item));
      if (next.status && next.status !== selectedTicket.status) setTicketNote('');
      setNotice({ tone: 'success', body: 'Support ticket updated and written to the admin audit log.' });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not update ticket.' });
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    if (!token || !selectedTicket || !replyBody.trim()) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: replyBody.trim(), internal, status: internal ? selectedTicket.status : 'waiting_for_user' }),
      });
      if (!response.ok) throw new Error('Could not send support reply.');
      setReplyBody('');
      await openTicket(selectedTicket.id);
      await loadTickets();
      setNotice({ tone: 'success', body: internal ? 'Internal note added.' : 'Reply sent to the user and ticket marked waiting for user.' });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not send reply.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-console">
      <section className="app-card admin-console__hero">
        <div className="status-row">
          <span className="semantic-badge instruction">Support admin</span>
          <Link className="button secondary" href="/admin">Back to admin</Link>
          <Link className="button secondary" href="/admin/reports">Report queue</Link>
        </div>
        <div>
          <p className="eyebrow">Phase 24.3</p>
          <h1>Support inbox</h1>
          <p>Handle user tickets, internal notes, report escalations, and safety follow-up without exposing internal moderation details to users.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Internal tools use your signed-in admin app session. Standalone admin login is not exposed.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Inbox</span><span className="semantic-badge admin">No deletes</span></div>
          <h2>Tickets</h2>
          <div className="admin-trust-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subject, message, user, ticket ID" />
            <select value={status} onChange={(event) => setStatus(event.target.value as SupportTicketStatus | 'all')}>{statuses.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={category} onChange={(event) => setCategory(event.target.value as SupportTicketCategory | 'all')}>{categories.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicketPriority | 'all')}>{priorities.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={assigned} onChange={(event) => setAssigned(event.target.value as AssignedFilter)}>{assignedFilters.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <button type="button" onClick={() => { void loadTickets(); }} disabled={loading || !token}>Load tickets</button>
          </div>
          <div className="admin-user-list">
            {tickets.map((ticket) => (
              <button type="button" key={ticket.id} className={selectedTicket?.id === ticket.id ? 'admin-user-row is-active' : 'admin-user-row'} onClick={() => { void openTicket(ticket.id); }}>
                <span>
                  <strong>{ticket.subject}</strong>
                  <small>{personLabel(ticket.user)} · {ticket._count?.messages ?? ticket.messages?.length ?? 0} messages · assigned {personLabel(ticket.assignedAdmin)}</small>
                  <small>{formatWebDateTime(ticket.updatedAt)} · {ticket.id}</small>
                </span>
                <em className={`semantic-badge ${statusTone(ticket.status)}`}>{labelize(ticket.status)}</em>
              </button>
            ))}
            {tickets.length === 0 ? <p>No support tickets loaded yet.</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          {selectedTicket ? (
            <>
              <div className="status-row">
                <span className={`semantic-badge ${statusTone(selectedTicket.status)}`}>{labelize(selectedTicket.status)}</span>
                <span className={`semantic-badge ${categoryTone(selectedTicket.category)}`}>{labelize(selectedTicket.category)}</span>
                <span className={`semantic-badge ${priorityTone(selectedTicket.priority)}`}>{labelize(selectedTicket.priority)}</span>
              </div>
              <h2>{selectedTicket.subject}</h2>
              <p className="meta">User: {personLabel(selectedTicket.user)} · Assigned: {personLabel(selectedTicket.assignedAdmin)} · Updated {formatWebDateTime(selectedTicket.updatedAt)}</p>
              <p>{selectedTicket.message}</p>
              <div className="status-row">
                {selectedTicket.relatedTradeId ? <Link className="semantic-badge trade" href={`/trades/${selectedTicket.relatedTradeId}`}>Trade {selectedTicket.relatedTradeId}</Link> : null}
                {selectedTicket.relatedProposalId ? <span className="semantic-badge proposal">Proposal {selectedTicket.relatedProposalId}</span> : null}
                {selectedTicket.relatedMediaId ? <span className="semantic-badge warning">Media {selectedTicket.relatedMediaId}</span> : null}
              </div>
              <textarea value={ticketNote} onChange={(event) => setTicketNote(event.target.value)} placeholder="Internal admin note. Required before changing or reopening ticket status." rows={3} />
              <div className="admin-action-grid">
                <button type="button" className="success" onClick={() => { void updateTicket({ status: 'open' }); }} disabled={loading || selectedTicket.status === 'open'}>Reopen</button>
                <button type="button" className="warning" onClick={() => { void updateTicket({ status: 'in_review' }); }} disabled={loading}>Mark in review</button>
                <button type="button" className="secondary" onClick={() => { void updateTicket({ status: 'waiting_for_user' }); }} disabled={loading}>Waiting for user</button>
                <button type="button" className="success" onClick={() => { void updateTicket({ status: 'resolved' }); }} disabled={loading}>Resolve</button>
                <button type="button" className="danger" onClick={() => { void updateTicket({ status: 'closed' }); }} disabled={loading}>Close</button>
                <button type="button" className="warning" onClick={() => { void updateTicket({ priority: 'urgent' }); }} disabled={loading}>Mark urgent</button>
                <button type="button" className="secondary" onClick={() => { void updateTicket({ priority: 'normal' }); }} disabled={loading}>Normalize priority</button>
                <button type="button" className="secondary" onClick={() => { void updateTicket({ assignedAdminId: currentAdminId }); }} disabled={loading || !currentAdminId}>Claim ticket</button>
                <button type="button" className="secondary" onClick={() => { void updateTicket({ assignedAdminId: null }); }} disabled={loading}>Unassign</button>
              </div>
              <p className="notice-box info">Status changes are reversible. Reopen resolved or closed tickets with a note instead of deleting ticket history.</p>
              <div className="support-thread">
                {selectedTicket.messages?.map((item) => (
                  <article key={item.id} className={`support-message ${item.senderRole === 'admin' ? 'admin' : 'user'}`}>
                    <div className="status-row">
                      <span className={`semantic-badge ${item.senderRole === 'admin' ? 'admin' : 'info'}`}>{item.senderRole === 'admin' ? 'Hellowhen support' : personLabel(item.sender)}</span>
                      {item.internal ? <span className="semantic-badge warning">internal note</span> : null}
                    </div>
                    <p>{item.body}</p>
                    <p className="meta">{formatWebDateTime(item.createdAt)}</p>
                  </article>
                ))}
              </div>
              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                <textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="Reply to the user or add an internal note" rows={5} />
                <label className="meta"><input style={{ width: 'auto', marginRight: 8 }} type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> Internal admin note only</label>
                <button type="button" onClick={() => { void sendReply(); }} disabled={loading || !replyBody.trim()}>{internal ? 'Add internal note' : 'Send public reply'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="status-row"><span className="semantic-badge admin">Select ticket</span></div>
              <h2>Ticket detail</h2>
              <p>Select a ticket to read the full conversation, claim it, update status/priority, reply to the user, or add an internal admin note.</p>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
