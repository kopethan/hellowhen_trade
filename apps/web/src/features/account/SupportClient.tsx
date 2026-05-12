'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { MediaAssetDto, SupportTicketCategory, SupportTicketDto, SupportTicketMessageDto, SupportTicketStatus } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { mediaSrc, normalizeMediaUpload } from '../inventory/inventoryPresentation';
import { formatDateTime } from './accountPresentation';

type T = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;
type CategoryOption = { value: SupportTicketCategory; key: string };

const categoryOptions: CategoryOption[] = [
  { value: 'general_feedback', key: 'general_feedback' },
  { value: 'trade_issue', key: 'trade_issue' },
  { value: 'credits_issue', key: 'credits_issue' },
  { value: 'media_issue', key: 'media_issue' },
  { value: 'bug_report', key: 'bug_report' },
  { value: 'account_issue', key: 'account_issue' },
  { value: 'safety_concern', key: 'safety_concern' },
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

function categoryLabel(value: SupportTicketCategory, t: T) {
  const label = t(`support.categories.${value}`);
  return label === `support.categories.${value}` ? value.replace(/_/g, ' ') : label;
}

function statusLabel(value: SupportTicketStatus, t: T) {
  const label = t(`support.statuses.${value}`);
  return label === `support.statuses.${value}` ? value.replace(/_/g, ' ') : label;
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
  const { t, language } = useWebTranslation();
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
    if (!auth.isAuthenticated) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const response = await api.support.ticketsMine();
      const nextTickets = normalizeTickets(response);
      setTickets(nextTickets);
      setSelectedTicketId((current) => current || nextTickets[0]?.id || '');
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadTickets(); }, [auth.hydrated, auth.isAuthenticated]);

  async function uploadAttachment(file: File, target: 'ticket' | 'reply') {
    setUploading(true); setError('');
    try {
      const formData = new FormData(); formData.append('image', file);
      const response = await api.media.uploadImage(formData);
      const media = normalizeMediaUpload(response);
      if (!media) throw new Error(t('support.uploadMissing'));
      if (target === 'ticket') setAttachments((current) => [...current, media].slice(0, 5));
      else setReplyAttachments((current) => [...current, media].slice(0, 5));
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setUploading(false); }
  }

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setNotice(''); setError('');
    try {
      const response = await api.support.createTicket({ category, subject: subject.trim(), message: message.trim(), priority: category === 'safety_concern' ? 'high' : 'normal', mediaIds: attachments.map((item) => item.id) });
      const ticket = normalizeTicket(response);
      if (!ticket) throw new Error('Ticket was created but no ticket was returned.');
      setTickets((current) => [ticket, ...current]); setSelectedTicketId(ticket.id); setSubject(''); setMessage(''); setAttachments([]); setNotice(t('support.ticketCreated'));
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setSaving(false); }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedTicket) return; setSaving(true); setNotice(''); setError('');
    try {
      const response = await api.support.sendMessage(selectedTicket.id, { body: reply.trim(), mediaIds: replyAttachments.map((item) => item.id) });
      const nextMessage = normalizeMessage(response);
      setTickets((current) => current.map((ticket) => ticket.id === selectedTicket.id ? { ...ticket, messages: nextMessage ? [...(ticket.messages ?? []), nextMessage] : ticket.messages, status: ticket.status === 'closed' ? 'open' : ticket.status } : ticket));
      setReply(''); setReplyAttachments([]); setNotice(t('support.replySent'));
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setSaving(false); }
  }

  async function updateStatus(status: 'open' | 'closed') {
    if (!selectedTicket) return; setSaving(true); setNotice(''); setError('');
    try {
      const response = await api.support.updateStatus(selectedTicket.id, { status });
      const ticket = normalizeTicket(response);
      if (ticket) setTickets((current) => current.map((item) => item.id === ticket.id ? ticket : item));
      setNotice(status === 'closed' ? t('support.ticketClosed') : t('support.ticketReopened'));
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setSaving(false); }
  }

  if (!auth.hydrated || loading) return <section className="mobile-card mobile-card--soft"><p>{t('support.loading')}</p></section>;

  if (!auth.isAuthenticated) {
    return <section className="mobile-card mobile-card--soft"><span className="semantic-badge instruction">{t('common.states.signedOut')}</span><h3>{t('support.signedOutTitle')}</h3><p>{t('support.signedOutBody')}</p><Link href="/auth" className="button primary full">{t('common.actions.loginOrRegister')}</Link></section>;
  }

  return (
    <div className="support-mobile-page">
      {notice ? <p className="notice-box success">{notice}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}

      <section className="mobile-card support-compose-card">
        <div className="trade-section-heading"><div><p className="eyebrow">{t('support.newRequest')}</p><h3>{t('support.createTicket')}</h3></div><span className="semantic-badge instruction">{t('support.attachments')}</span></div>
        <form className="form-stack" onSubmit={(event) => { void createTicket(event); }}>
          <label className="field-label">{t('support.category')}<select value={category} onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{categoryLabel(option.value, t)}</option>)}</select></label>
          <label className="field-label">{t('support.subject')}<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={t('support.subjectPlaceholder')} minLength={3} maxLength={140} required /></label>
          <label className="field-label">{t('support.message')}<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t('support.messagePlaceholder')} rows={5} minLength={10} maxLength={4000} required /></label>
          <label className="image-upload-button">{uploading ? t('common.states.uploading') : t('support.attachScreenshot')}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || attachments.length >= 5} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void uploadAttachment(file, 'ticket'); }} /></label>
          <AttachmentGrid media={attachments} />
          <button type="submit" disabled={saving || uploading || !subject.trim() || !message.trim()}>{saving ? t('common.states.creating') : t('support.createTicketShort')}</button>
        </form>
      </section>

      <section className="mobile-card support-thread-card">
        <div className="trade-section-heading"><div><p className="eyebrow">{t('support.yourTickets')}</p><h3>{t('support.history')}</h3></div><span className="semantic-badge proposal">{tickets.length}</span></div>

        {tickets.length ? <div className="support-ticket-list">{tickets.map((ticket) => <button key={ticket.id} type="button" className={selectedTicket?.id === ticket.id ? 'support-ticket-pill support-ticket-pill--active' : 'support-ticket-pill'} onClick={() => setSelectedTicketId(ticket.id)}><span><strong>{ticket.subject}</strong><small>{categoryLabel(ticket.category, t)} · {formatDateTime(ticket.updatedAt, language)}</small></span><em className={`semantic-badge ${statusTone(ticket.status)}`}>{statusLabel(ticket.status, t)}</em></button>)}</div> : <div className="proposal-empty-state"><strong>{t('support.noTickets')}</strong><span>{t('support.noTicketsBody')}</span></div>}

        {selectedTicket ? <div className="support-conversation-panel"><div className="trade-section-heading"><div><p className="eyebrow">{t('support.selectedTicket')}</p><h3>{selectedTicket.subject}</h3></div><span className={`semantic-badge ${statusTone(selectedTicket.status)}`}>{statusLabel(selectedTicket.status, t)}</span></div><p>{selectedTicket.message}</p><AttachmentGrid media={selectedTicket.media} />
          <div className="message-list">{(selectedTicket.messages ?? []).map((item) => <article key={item.id} className={item.senderRole === 'admin' ? 'message-bubble' : 'message-bubble message-bubble--proposal'}><strong>{item.senderRole === 'admin' ? t('support.supportSender') : t('support.youSender')}</strong><p>{item.body}</p><AttachmentGrid media={item.media} /></article>)}</div>
          {selectedTicket.status !== 'closed' ? <form className="form-stack" onSubmit={(event) => { void sendReply(event); }}><label className="field-label">{t('support.reply')}<textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder={t('support.replyPlaceholder')} rows={3} maxLength={4000} /></label><label className="image-upload-button">{uploading ? t('common.states.uploading') : t('support.attachToReply')}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || replyAttachments.length >= 5} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void uploadAttachment(file, 'reply'); }} /></label><AttachmentGrid media={replyAttachments} /><button type="submit" disabled={saving || uploading || !reply.trim()}>{saving ? t('common.states.sending') : t('support.reply')}</button></form> : null}
          <button type="button" className="secondary" disabled={saving} onClick={() => { void updateStatus(selectedTicket.status === 'closed' ? 'open' : 'closed'); }}>{selectedTicket.status === 'closed' ? t('support.reopenTicket') : t('support.closeTicket')}</button>
        </div> : null}
      </section>
    </div>
  );
}
