'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import type { TradePublicMessageDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReportContentButton } from '../../components/ReportContentButton';
import { WebIcon } from '../../components/WebIcon';
import { WebOptionPickerCard, WebOptionPickerDangerCard, WebOptionPickerPanel } from '../../components/WebOptionPicker';
import { api } from '../../lib/api';
import { formatWebDate, formatWebDateTime } from '../../lib/webFormat';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { UserIdentityLink } from '../users/UserIdentityLink';

const PUBLIC_DISCUSSION_REFRESH_INTERVAL_MS = 8000;
const PUBLIC_DISCUSSION_COMPOSER_MAX_HEIGHT_PX = 144;

type PublicDiscussionView = 'messages' | 'menu' | 'guide' | 'report-thread' | 'report-message';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isPublicMessage(value: unknown): value is TradePublicMessageDto {
  return isRecord(value) && typeof value.id === 'string' && typeof value.tradeId === 'string' && typeof value.authorId === 'string' && typeof value.body === 'string';
}

function normalizeMessages(value: unknown): TradePublicMessageDto[] {
  if (Array.isArray(value)) return value.filter(isPublicMessage);
  if (isRecord(value) && Array.isArray(value.messages)) return value.messages.filter(isPublicMessage);
  if (isRecord(value) && Array.isArray(value.items)) return value.items.filter(isPublicMessage);
  return [];
}

function normalizeMessage(value: unknown): TradePublicMessageDto | null {
  if (isPublicMessage(value)) return value;
  if (isRecord(value) && isPublicMessage(value.message)) return value.message;
  return null;
}

function mergeMessages(current: TradePublicMessageDto[], next: TradePublicMessageDto[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of next) byId.set(message.id, { ...byId.get(message.id), ...message });
  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}


function resizePublicDiscussionComposer(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const nextHeight = Math.min(textarea.scrollHeight, PUBLIC_DISCUSSION_COMPOSER_MAX_HEIGHT_PX);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > PUBLIC_DISCUSSION_COMPOSER_MAX_HEIGHT_PX ? 'auto' : 'hidden';
}

function messageDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export function TradePublicDiscussionClient({ tradeId }: { tradeId: string }) {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [view, setView] = useState<PublicDiscussionView>('messages');
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<TradePublicMessageDto | null>(null);
  const [messages, setMessages] = useState<TradePublicMessageDto[]>([]);
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'warning' | 'danger'; body: string } | null>(null);

  const canWrite = auth.isAuthenticated && auth.user?.trustTier !== 'restricted';
  const trimmedBody = body.trim();
  const trimmedEditingBody = editingBody.trim();

  const groupedMessages = useMemo(() => {
    return messages.map((message, index) => {
      const previous = messages[index - 1];
      const showDate = !previous || messageDateKey(previous.createdAt) !== messageDateKey(message.createdAt);
      return { message, showDate };
    });
  }, [messages]);

  useEffect(() => {
    resizePublicDiscussionComposer(composerTextareaRef.current);
  }, [body]);

  async function loadMessages(options?: { quiet?: boolean }) {
    if (!auth.isAuthenticated) {
      setLoading(false);
      return;
    }
    if (!options?.quiet) setLoading(true);
    try {
      const response = await api.trades.publicMessages(tradeId, { take: 80 });
      const nextMessages = normalizeMessages(response);
      // Replace the visible list on refresh so messages hidden by moderation disappear locally.
      setMessages(nextMessages);
      if (!options?.quiet) setNotice(null);
    } catch (cause) {
      if (!options?.quiet) setNotice({ tone: 'warning', body: getFriendlyApiErrorMessage(cause, t('trade.publicDiscussion.couldNotLoad')) });
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth.hydrated) return;
    void loadMessages();
  }, [auth.hydrated, auth.isAuthenticated, tradeId]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void loadMessages({ quiet: true });
    }, PUBLIC_DISCUSSION_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [auth.isAuthenticated, tradeId]);
  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || trimmedBody.length < 1) return;
    setSending(true);
    setNotice(null);
    try {
      const response = await api.trades.sendPublicMessage(tradeId, { body: trimmedBody });
      const message = normalizeMessage(response);
      if (message) setMessages((current) => mergeMessages(current, [message]));
      setBody('');
    } catch (cause) {
      setNotice({ tone: 'danger', body: getFriendlyApiErrorMessage(cause, t('trade.publicDiscussion.couldNotSend')) });
    } finally {
      setSending(false);
    }
  }

  function beginEdit(message: TradePublicMessageDto) {
    setEditingId(message.id);
    setEditingBody(message.body);
    setOpenMenuId(null);
    setNotice(null);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || trimmedEditingBody.length < 1) return;
    setSending(true);
    setNotice(null);
    try {
      const response = await api.trades.updatePublicMessage(tradeId, editingId, { body: trimmedEditingBody });
      const message = normalizeMessage(response);
      if (message) setMessages((current) => mergeMessages(current, [message]));
      setEditingId(null);
      setEditingBody('');
    } catch (cause) {
      setNotice({ tone: 'danger', body: getFriendlyApiErrorMessage(cause, t('trade.publicDiscussion.couldNotUpdate')) });
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(message: TradePublicMessageDto) {
    setSending(true);
    setNotice(null);
    try {
      const response = await api.trades.deletePublicMessage(tradeId, message.id);
      const nextMessage = normalizeMessage(response);
      if (nextMessage) setMessages((current) => mergeMessages(current, [nextMessage]));
      setOpenMenuId(null);
      setDeleteConfirmTarget(null);
    } catch (cause) {
      setNotice({ tone: 'danger', body: getFriendlyApiErrorMessage(cause, t('trade.publicDiscussion.couldNotDelete')) });
    } finally {
      setSending(false);
    }
  }

  function requestDeleteMessage(message: TradePublicMessageDto) {
    setDeleteConfirmTarget(message);
    setOpenMenuId(null);
  }

  function openReportMessage(messageId: string) {
    setReportMessageId(messageId);
    setOpenMenuId(null);
    setView('report-message');
  }

  function closeSubpage() {
    setView('messages');
    setReportMessageId(null);
    setOpenMenuId(null);
  }

  function openThreadMenu() {
    setView('menu');
  }

  if (!auth.hydrated || loading) {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only" aria-busy="true">
        <section className="web-thread-header web-thread-header--loading">
          <span className="semantic-badge instruction">{t('common.states.loading')}</span>
          <h2>{t('trade.publicDiscussion.title')}</h2>
        </section>
        <section className="web-thread-loading-list" aria-hidden="true">
          <span />
          <span />
          <span />
        </section>
      </article>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <section className="web-thread-header">
          <Link href={`/trades/${tradeId}`} className="web-thread-header__back" aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></Link>
          <h2>{t('trade.publicDiscussion.title')}</h2>
        </section>
        <section className="public-discussion-section public-discussion-section--empty">
          <h3>{t('trade.publicDiscussion.signedOutTitle')}</h3>
          <p>{t('trade.publicDiscussion.signedOutBody')}</p>
          <Link href={`/auth?next=${encodeURIComponent(`/trades/${tradeId}/discussion`)}`} className="button primary full">{t('report.loginAction')}</Link>
        </section>
      </article>
    );
  }

  if (view === 'menu') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only public-discussion-page--menu">
        <section className="web-thread-header">
          <button type="button" className="web-thread-header__back" onClick={closeSubpage} aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></button>
          <h2>{t('trade.publicDiscussion.menuTitle')}</h2>
        </section>
        <WebOptionPickerPanel className="web-thread-options-picker">
          <WebOptionPickerCard
            href={`/trades/${tradeId}`}
            iconName="trade"
            title={t('trade.publicDiscussion.seeDetails')}
            description={t('trade.publicDiscussion.seeDetailsBody')}
          />
          <WebOptionPickerCard
            iconName="help"
            title={t('trade.publicDiscussion.seeGuide')}
            description={t('trade.publicDiscussion.seeGuideBody')}
            onClick={() => setView('guide')}
          />
          <WebOptionPickerDangerCard
            iconName="report-flag"
            title={t('trade.publicDiscussion.reportThread')}
            description={t('trade.publicDiscussion.reportThreadBody')}
            onClick={() => setView('report-thread')}
          />
        </WebOptionPickerPanel>
      </article>
    );
  }

  if (view === 'guide') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <section className="web-thread-header">
          <button type="button" className="web-thread-header__back" onClick={() => setView('menu')} aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></button>
          <h2>{t('trade.publicDiscussion.guideTitle')}</h2>
        </section>
        <section className="web-thread-info-page web-thread-guide-page">
          <ul className="web-thread-guide-list web-thread-guide-list--cards">
            <li>
              <span className="web-thread-guide-card__icon" aria-hidden="true"><WebIcon name="help" size={20} decorative /></span>
              <p>{t('trade.publicDiscussion.guideBody')}</p>
            </li>
            <li>
              <span className="web-thread-guide-card__icon" aria-hidden="true"><WebIcon name="trade" size={20} decorative /></span>
              <p>{t('trade.publicDiscussion.guidePublic')}</p>
            </li>
            <li>
              <span className="web-thread-guide-card__icon" aria-hidden="true"><WebIcon name="proposal" size={20} decorative /></span>
              <p>{t('trade.publicDiscussion.guidePrivate')}</p>
            </li>
            <li className="web-thread-guide-card--warning">
              <span className="web-thread-guide-card__icon" aria-hidden="true"><WebIcon name="warning" size={20} decorative /></span>
              <p>{t('trade.publicDiscussion.guideSafety')}</p>
            </li>
          </ul>
        </section>
      </article>
    );
  }

  if (view === 'report-thread') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <section className="web-thread-header">
          <button type="button" className="web-thread-header__back" onClick={() => setView('menu')} aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></button>
          <h2>{t('trade.publicDiscussion.reportThread')}</h2>
        </section>
        <section className="web-thread-info-page">
          <ReportContentButton targetType="trade" targetId={tradeId} labelKey="trade.publicDiscussion.reportThread" helperKey="report.helper.trade" initialOpen />
        </section>
      </article>
    );
  }

  if (view === 'report-message' && reportMessageId) {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <section className="web-thread-header">
          <button type="button" className="web-thread-header__back" onClick={closeSubpage} aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></button>
          <h2>{t('trade.publicDiscussion.reportMessage')}</h2>
        </section>
        <section className="web-thread-info-page">
          <ReportContentButton targetType="public_message" targetId={reportMessageId} labelKey="trade.publicDiscussion.reportMessage" helperKey="report.helper.publicMessage" initialOpen />
        </section>
      </article>
    );
  }

  return (
    <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only public-discussion-page--flat">
      <section className="web-thread-header">
        <Link href={`/trades/${tradeId}`} className="web-thread-header__back" aria-label={t('common.actions.back')}><WebIcon name="back" size={21} decorative /></Link>
        <h2>{t('trade.publicDiscussion.title')}</h2>
        <button type="button" className="web-thread-header__menu" onClick={openThreadMenu} aria-label={t('trade.publicDiscussion.menuTitle')}>
          <WebIcon name="more" size={22} decorative />
        </button>
      </section>

      {deleteConfirmTarget ? (
        <div className="proposal-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-public-message-title">
          <div className="proposal-confirm-modal__panel">
            <span className="semantic-badge danger"><WebIcon name="warning" size={14} decorative /> {t('trade.publicDiscussion.deleteMessage')}</span>
            <h2 id="delete-public-message-title">{t('trade.publicDiscussion.deleteMessage')}</h2>
            <p>{t('trade.publicDiscussion.deleteConfirm')}</p>
            <div className="proposal-confirm-modal__actions">
              <button type="button" className="secondary" onClick={() => setDeleteConfirmTarget(null)} disabled={sending}>{t('common.actions.cancel')}</button>
              <button type="button" className="danger" onClick={() => void deleteMessage(deleteConfirmTarget)} disabled={sending}>{sending ? t('common.states.working') : t('trade.publicDiscussion.deleteMessage')}</button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="trade-social-section public-discussion-section public-discussion-section--messages-only">
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
        {messages.length ? (
          <div className="public-message-list public-message-list--thread">
            {groupedMessages.map(({ message, showDate }) => {
              const ownMessage = message.authorId === auth.user?.id;
              const deleted = message.status === 'deleted' || Boolean(message.deletedAt);
              const menuOpen = openMenuId === message.id;
              return (
                <div key={message.id} className="public-message-group">
                  {showDate ? <div className="public-message-date">{formatWebDate(message.createdAt, t('trade.publicDiscussion.unknownDate'), language)}</div> : null}
                  <article className={ownMessage ? 'public-message public-message--own' : 'public-message'}>
                    <header className="public-message__header">
                      <UserIdentityLink
                        user={message.author}
                        userId={message.authorId}
                        variant="compact"
                        avatarSize="sm"
                        statusText={ownMessage ? t('trade.labels.you') : undefined}
                        showHandle={false}
                      />
                      <div className="public-message__meta">
                        <time dateTime={message.createdAt}>{formatWebDateTime(message.createdAt, '—', language)}</time>
                        {!deleted ? (
                          <button type="button" className="public-message__menu-button" onClick={() => setOpenMenuId((current) => current === message.id ? null : message.id)} aria-expanded={menuOpen} aria-label={t('trade.publicDiscussion.messageActions')}><WebIcon name="more" size={19} decorative /></button>
                        ) : null}
                      </div>
                    </header>

                    {editingId === message.id ? (
                      <form className="public-message-edit-form" onSubmit={saveEdit}>
                        <textarea value={editingBody} onChange={(event) => setEditingBody(event.target.value)} rows={3} />
                        <div className="trade-action-row">
                          <button type="submit" disabled={sending || trimmedEditingBody.length < 1}>{t('common.actions.save')}</button>
                          <button type="button" className="secondary" onClick={() => { setEditingId(null); setEditingBody(''); }}>{t('common.actions.cancel')}</button>
                        </div>
                      </form>
                    ) : (
                      <p className={deleted ? 'public-message__body public-message__body--deleted' : 'public-message__body'}>{deleted ? t('trade.publicDiscussion.messageDeleted') : message.body}</p>
                    )}

                    {!deleted && message.editedAt ? <p className="public-message__edited">{t('trade.publicDiscussion.edited', { date: formatWebDateTime(message.editedAt, '—', language) })}</p> : null}

                    {menuOpen ? (
                      <div className="public-message__menu">
                        {ownMessage ? (
                          <>
                            <button type="button" className="button secondary" onClick={() => beginEdit(message)}>{t('common.actions.edit')}</button>
                            <button type="button" className="button secondary danger-text" onClick={() => requestDeleteMessage(message)}>{t('trade.publicDiscussion.deleteMessage')}</button>
                          </>
                        ) : (
                          <button type="button" className="button secondary danger-text" onClick={() => openReportMessage(message.id)}>
                            <WebIcon name="report-flag" size={16} decorative /> {t('trade.publicDiscussion.reportMessage')}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </article>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="public-discussion-empty-text">{t('trade.publicDiscussion.emptyTitle')}</p>
        )}
      </section>

      {canWrite ? (
        <form className="conversation-reply public-discussion-composer public-discussion-composer--messages-only" onSubmit={submitMessage}>
          <label className="sr-only" htmlFor="public-discussion-message">{t('trade.publicDiscussion.placeholder')}</label>
          <textarea
            id="public-discussion-message"
            ref={composerTextareaRef}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              resizePublicDiscussionComposer(event.currentTarget);
            }}
            placeholder={t('trade.publicDiscussion.placeholder')}
            rows={1}
          />
          <button type="submit" disabled={sending || trimmedBody.length < 1}>{sending ? t('common.states.sending') : t('common.actions.send')}</button>
        </form>
      ) : (
        <p className="notice-box warning public-discussion-bottom-notice">{t('trade.publicDiscussion.restricted')}</p>
      )}
    </article>
  );
}
