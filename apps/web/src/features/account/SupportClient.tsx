'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { MediaAssetDto, SupportTicketCategory, SupportTicketDto, SupportTicketMessageDto, SupportTicketStatus } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { mediaSrc, normalizeMediaUpload } from '../inventory/inventoryPresentation';
import { formatDateTime } from './accountPresentation';

type CategoryOption = {
  value: SupportTicketCategory;
  label: string;
};

const categoryOptions: CategoryOption[] = [
  { value: 'general_feedback', label: 'General feedback' },
  { value: 'trade_issue', label: 'Trade issue' },
  { value: 'credits_issue', label: 'Trade or account issue' },
  { value: 'media_issue', label: 'Image review issue' },
  { value: 'bug_report', label: 'Bug report' },
  { value: 'account_issue', label: 'Account issue' },
  { value: 'safety_concern', label: 'Safety concern' },
];

function normalizeTickets(payload: unknown) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as SupportTicketDto[];
  if (typeof payload !== 'object') return [];
  const record = payload as { tickets?: unknown };
  return Array.isArray(record.tickets) ? record.tickets as SupportTicketDto[] : [];
}

function normalizeTicket(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { id?: unknown; ticket?: unknown };
  if (typeof record.id === 'string') return payload as SupportTicketDto;
  return record.ticket && typeof record.ticket === 'object' ? record.ticket as SupportTicketDto : null;
}

function normalizeMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { id?: unknown; message?: unknown };
  if (typeof record.id === 'string') return payload as SupportTicketMessageDto;
  return record.message && typeof record.message === 'object' ? record.message as SupportTicketMessageDto : null;
}

function statusTone(status: SupportTicketStatus) {
  if (status === 'resolved') return 'success';
  if (status === 'closed') return 'instruction';
  if (status === 'waiting_for_user') return 'warning';
  return 'proposal';
}

function categoryLabel(value: SupportTicketCategory) {
  return categoryOptions.find((option) => option.value === value)?.label ?? value.replace(/_/g, ' ');
}

function AttachmentGrid({ media }: { media?: MediaAssetDto[] }) {
  if (!media?.length) return null;
  return (
    <div className="support-attachment-grid">
      {media.map((item) => (
        <a key={item.id} href={mediaSrc(item)} target="_blank" rel="noreferrer">
          <img src={mediaSrc(item)} alt={item.filename} />
        </a>
      ))}
    </div>
  );
}

export function SupportClient() {
  const auth = useWebAuth();
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('general_feedback');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<MediaAssetDto[]>([]);
  const [reply, setReply] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<MediaAssetDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const selectedTicket = useMemo(() => tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0] ?? null, [selectedTicketId, tickets]);

  async function loadTickets() {
    if (!auth.hydrated) return;
    if (!auth.isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.support.ticketsMine();
      const nextTickets = normalizeTickets(response);
      setTickets(nextTickets);
      setSelectedTicketId((current) => current || nextTickets[0]?.id || '');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTickets(); }, [auth.hydrated, auth.isAuthenticated]);

  async function uploadAttachment(file: File, target: 'ticket' | 'reply') {
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.media.uploadImage(formData);
      const media = normalizeMediaUpload(response);
      if (!media) throw new Error('Upload completed but no image was returned.');
      if (target === 'ticket') setAttachments((current) => [...current, media].slice(0, 5));
      else setReplyAttachments((current) => [...current, media].slice(0, 5));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setUploading(false);
    }
  }

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const response = await api.support.createTicket({
        category,
        subject: subject.trim(),
        message: message.trim(),
        priority: category === 'safety_concern' ? 'high' : 'normal',
        mediaIds: attachments.map((item) => item.id),
      });
      const ticket = normalizeTicket(response);
      if (!ticket) throw new Error('Ticket was created but no ticket was returned.');
      setTickets((current) => [ticket, ...current]);
      setSelectedTicketId(ticket.id);
      setSubject('');
      setMessage('');
      setAttachments([]);
      setNotice('Support ticket created.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicket) return;
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const response = await api.support.sendMessage(selectedTicket.id, { body: reply.trim(), mediaIds: replyAttachments.map((item) => item.id) });
      const nextMessage = normalizeMessage(response);
      setTickets((current) => current.map((ticket) => ticket.id === selectedTicket.id
        ? { ...ticket, messages: nextMessage ? [...(ticket.messages ?? []), nextMessage] : ticket.messages, status: ticket.status === 'closed' ? 'open' : ticket.status }
        : ticket));
      setReply('');
      setReplyAttachments([]);
      setNotice('Reply sent.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: 'open' | 'closed') {
    if (!selectedTicket) return;
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const response = await api.support.updateStatus(selectedTicket.id, { status });
      const ticket = normalizeTicket(response);
      if (ticket) setTickets((current) => current.map((item) => item.id === ticket.id ? ticket : item));
      setNotice(status === 'closed' ? 'Ticket closed.' : 'Ticket reopened.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  if (!auth.hydrated || loading) return <section className="mobile-card mobile-card--soft"><p>Loading support...</p></section>;

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">Signed out</span>
        <h3>Sign in to contact support</h3>
        <p>Support tickets and attachments are private to your account.</p>
        <Link href="/auth" className="button primary full">Login or register</Link>
      </section>
    );
  }

  return (
    <div className="support-mobile-page">
      {notice ? <p className="notice-box success">{notice}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}

      <section className="mobile-card support-compose-card">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">New request</p>
            <h3>Create support ticket</h3>
          </div>
          <span className="semantic-badge instruction">Attachments</span>
        </div>
        <form className="form-stack" onSubmit={(event) => { void createTicket(event); }}>
          <label className="field-label">
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}>
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="field-label">
            Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" minLength={3} maxLength={140} required />
          </label>
          <label className="field-label">
            Message
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what happened." rows={5} minLength={10} maxLength={4000} required />
          </label>
          <label className="image-upload-button">
            {uploading ? 'Uploading...' : 'Attach screenshot'}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || attachments.length >= 5} onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) void uploadAttachment(file, 'ticket');
            }} />
          </label>
          <AttachmentGrid media={attachments} />
          <button type="submit" disabled={saving || uploading || !subject.trim() || !message.trim()}>{saving ? 'Creating...' : 'Create ticket'}</button>
        </form>
      </section>

      <section className="mobile-card support-thread-card">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Your tickets</p>
            <h3>Support history</h3>
          </div>
          <span className="semantic-badge proposal">{tickets.length}</span>
        </div>

        {tickets.length ? (
          <div className="support-ticket-list">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                className={selectedTicket?.id === ticket.id ? 'support-ticket-pill support-ticket-pill--active' : 'support-ticket-pill'}
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                <span>
                  <strong>{ticket.subject}</strong>
                  <small>{categoryLabel(ticket.category)} · {formatDateTime(ticket.updatedAt)}</small>
                </span>
                <em className={`semantic-badge ${statusTone(ticket.status)}`}>{ticket.status.replace(/_/g, ' ')}</em>
              </button>
            ))}
          </div>
        ) : (
          <div className="proposal-empty-state">
            <strong>No tickets yet</strong>
            <span>Create your first support ticket above.</span>
          </div>
        )}

        {selectedTicket ? (
          <div className="support-conversation-panel">
            <div className="trade-section-heading">
              <div>
                <p className="eyebrow">Selected ticket</p>
                <h3>{selectedTicket.subject}</h3>
              </div>
              <span className={`semantic-badge ${statusTone(selectedTicket.status)}`}>{selectedTicket.status.replace(/_/g, ' ')}</span>
            </div>
            <p>{selectedTicket.message}</p>
            <AttachmentGrid media={selectedTicket.media} />

            <div className="message-list">
              {(selectedTicket.messages ?? []).map((item) => (
                <article key={item.id} className={item.senderRole === 'admin' ? 'message-bubble' : 'message-bubble message-bubble--proposal'}>
                  <strong>{item.senderRole === 'admin' ? 'Support' : 'You'}</strong>
                  <p>{item.body}</p>
                  <AttachmentGrid media={item.media} />
                </article>
              ))}
            </div>

            {selectedTicket.status !== 'closed' ? (
              <form className="form-stack" onSubmit={(event) => { void sendReply(event); }}>
                <label className="field-label">
                  Reply
                  <textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Add a reply..." rows={3} maxLength={4000} />
                </label>
                <label className="image-upload-button">
                  {uploading ? 'Uploading...' : 'Attach to reply'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || replyAttachments.length >= 5} onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = '';
                    if (file) void uploadAttachment(file, 'reply');
                  }} />
                </label>
                <AttachmentGrid media={replyAttachments} />
                <button type="submit" disabled={saving || uploading || !reply.trim()}>{saving ? 'Sending...' : 'Send reply'}</button>
              </form>
            ) : null}

            <button type="button" className="secondary" disabled={saving} onClick={() => { void updateStatus(selectedTicket.status === 'closed' ? 'open' : 'closed'); }}>
              {selectedTicket.status === 'closed' ? 'Reopen ticket' : 'Close ticket'}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
