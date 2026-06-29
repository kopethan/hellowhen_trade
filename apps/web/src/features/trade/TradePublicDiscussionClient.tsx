'use client';

import type { FormEvent } from 'react';
import type { TradeDto, TradePublicMessageDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReportContentButton } from '../../components/ReportContentButton';
import { WebOptionPickerCard, WebOptionPickerDangerCard, WebOptionPickerPanel } from '../../components/WebOptionPicker';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import {
  PUBLIC_DISCUSSION_REFRESH_INTERVAL_MS,
  PublicDiscussionComposer,
  PublicDiscussionContextStrip,
  PublicDiscussionDeleteConfirm,
  PublicDiscussionGuideCard,
  PublicDiscussionHeader,
  PublicDiscussionLoadingShell,
  PublicDiscussionMessageList,
  PublicDiscussionSignedOutShell,
  getPublicDiscussionMessageMention,
  groupPublicDiscussionMessages,
  isRecord,
  mergePublicDiscussionMessages,
  normalizePublicDiscussionMessage,
  normalizePublicDiscussionMessages,
  resizePublicDiscussionComposer,
  type PublicDiscussionNotice,
  type PublicDiscussionView,
} from '../publicDiscussion/PublicDiscussionThreadPieces';
import { getExchangeLabel, getTradeHeadline, getTradeTimingBadge } from './tradePresentation';

function isPublicMessage(value: unknown): value is TradePublicMessageDto {
  return isRecord(value) && typeof value.id === 'string' && typeof value.tradeId === 'string' && typeof value.authorId === 'string' && typeof value.body === 'string';
}

function normalizeTrade(value: unknown): TradeDto | null {
  if (isRecord(value) && typeof value.id === 'string') return value as TradeDto;
  if (isRecord(value) && isRecord(value.trade) && typeof value.trade.id === 'string') return value.trade as TradeDto;
  return null;
}

export function TradePublicDiscussionClient({ tradeId }: { tradeId: string }) {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [view, setView] = useState<PublicDiscussionView>('messages');
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<TradePublicMessageDto | null>(null);
  const [messages, setMessages] = useState<TradePublicMessageDto[]>([]);
  const [trade, setTrade] = useState<TradeDto | null>(null);
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<PublicDiscussionNotice | null>(null);

  const canWrite = auth.isAuthenticated && auth.user?.trustTier !== 'restricted';
  const trimmedBody = body.trim();
  const trimmedEditingBody = editingBody.trim();
  const composerReady = trimmedBody.length > 0;
  const composerDisabled = sending || !composerReady;
  const tradeHeadline = trade ? getTradeHeadline(trade, { t, language }) : t('trade.publicDiscussion.tradeContext');
  const tradeContextLabel = trade ? getExchangeLabel(trade, { t, language }) : t('trade.publicDiscussion.tradeContext');
  const tradeTimingLabel = trade ? getTradeTimingBadge(trade, { t, language }) : '';

  const groupedMessages = useMemo(() => groupPublicDiscussionMessages(messages), [messages]);

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
      const nextMessages = normalizePublicDiscussionMessages(response, isPublicMessage);
      // Replace the visible list on refresh so messages hidden by moderation disappear locally.
      setMessages(nextMessages);
      if (!options?.quiet) setNotice(null);
    } catch (cause) {
      if (!options?.quiet) setNotice({ tone: 'warning', body: getFriendlyApiErrorMessage(cause, t('trade.publicDiscussion.couldNotLoad')) });
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }

  async function loadTradeContext() {
    if (!auth.isAuthenticated) {
      setTrade(null);
      return;
    }
    try {
      const response = await api.trades.get(tradeId);
      setTrade(normalizeTrade(response));
    } catch {
      // The discussion can still work if the mini trade strip cannot be loaded.
      setTrade(null);
    }
  }

  useEffect(() => {
    if (!auth.hydrated) return;
    void loadMessages();
    void loadTradeContext();
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
      const message = normalizePublicDiscussionMessage(response, isPublicMessage);
      if (message) setMessages((current) => mergePublicDiscussionMessages(current, [message]));
      setBody('');
      window.requestAnimationFrame(() => resizePublicDiscussionComposer(composerTextareaRef.current));
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

  function cancelEdit() {
    setEditingId(null);
    setEditingBody('');
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || trimmedEditingBody.length < 1) return;
    setSending(true);
    setNotice(null);
    try {
      const response = await api.trades.updatePublicMessage(tradeId, editingId, { body: trimmedEditingBody });
      const message = normalizePublicDiscussionMessage(response, isPublicMessage);
      if (message) setMessages((current) => mergePublicDiscussionMessages(current, [message]));
      cancelEdit();
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
      const nextMessage = normalizePublicDiscussionMessage(response, isPublicMessage);
      if (nextMessage) setMessages((current) => mergePublicDiscussionMessages(current, [nextMessage]));
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

  function focusComposerWithReply(message: TradePublicMessageDto) {
    const mention = getPublicDiscussionMessageMention(message);
    if (mention) {
      setBody((current) => {
        const value = current.trim();
        if (!value) return `${mention} `;
        if (value.includes(mention)) return `${value} `;
        return `${value} ${mention} `;
      });
    }
    window.requestAnimationFrame(() => {
      composerTextareaRef.current?.focus();
      resizePublicDiscussionComposer(composerTextareaRef.current);
    });
  }

  if (!auth.hydrated || loading) {
    return <PublicDiscussionLoadingShell label={t('common.states.loading')} title={t('trade.publicDiscussion.title')} />;
  }

  if (!auth.isAuthenticated) {
    return (
      <PublicDiscussionSignedOutShell
        backHref={`/trades/${tradeId}`}
        backLabel={t('common.actions.back')}
        title={t('trade.publicDiscussion.title')}
        heading={t('trade.publicDiscussion.signedOutTitle')}
        body={t('trade.publicDiscussion.signedOutBody')}
        actionHref={`/auth?next=${encodeURIComponent(`/trades/${tradeId}/discussion`)}`}
        actionLabel={t('report.loginAction')}
      />
    );
  }

  if (view === 'menu') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only public-discussion-page--menu">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title={t('trade.publicDiscussion.menuTitle')} onBack={closeSubpage} />
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
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title={t('trade.publicDiscussion.guideTitle')} onBack={() => setView('menu')} />
        <section className="web-thread-info-page web-thread-guide-page">
          <ul className="web-thread-guide-list web-thread-guide-list--cards">
            <PublicDiscussionGuideCard iconName="help">{t('trade.publicDiscussion.guideBody')}</PublicDiscussionGuideCard>
            <PublicDiscussionGuideCard iconName="trade">{t('trade.publicDiscussion.guidePublic')}</PublicDiscussionGuideCard>
            <PublicDiscussionGuideCard iconName="proposal">{t('trade.publicDiscussion.guidePrivate')}</PublicDiscussionGuideCard>
            <PublicDiscussionGuideCard iconName="warning" warning>{t('trade.publicDiscussion.guideSafety')}</PublicDiscussionGuideCard>
          </ul>
        </section>
      </article>
    );
  }

  if (view === 'report-thread') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title={t('trade.publicDiscussion.reportThread')} onBack={() => setView('menu')} />
        <section className="web-thread-info-page">
          <ReportContentButton targetType="trade" targetId={tradeId} labelKey="trade.publicDiscussion.reportThread" helperKey="report.helper.trade" initialOpen />
        </section>
      </article>
    );
  }

  if (view === 'report-message' && reportMessageId) {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title={t('trade.publicDiscussion.reportMessage')} onBack={closeSubpage} />
        <section className="web-thread-info-page">
          <ReportContentButton targetType="public_message" targetId={reportMessageId} labelKey="trade.publicDiscussion.reportMessage" helperKey="report.helper.publicMessage" initialOpen />
        </section>
      </article>
    );
  }

  return (
    <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only public-discussion-page--thread-shell">
      <PublicDiscussionHeader
        backHref={`/trades/${tradeId}`}
        backLabel={t('common.actions.back')}
        title={t('trade.publicDiscussion.title')}
        menuLabel={t('trade.publicDiscussion.menuTitle')}
        onMenu={() => setView('menu')}
      />

      <PublicDiscussionContextStrip
        href={`/trades/${tradeId}`}
        ariaLabel={t('trade.publicDiscussion.viewTrade')}
        eyebrow={tradeContextLabel}
        title={tradeHeadline}
        meta={`${tradeTimingLabel ? `${tradeTimingLabel} · ` : ''}${t('trade.publicDiscussion.messageCount', { count: messages.length })}`}
      />

      {deleteConfirmTarget ? (
        <PublicDiscussionDeleteConfirm
          titleId="delete-public-message-title"
          badge={t('trade.publicDiscussion.deleteMessage')}
          title={t('trade.publicDiscussion.deleteMessage')}
          body={t('trade.publicDiscussion.deleteConfirm')}
          cancelLabel={t('common.actions.cancel')}
          deleteLabel={t('trade.publicDiscussion.deleteMessage')}
          workingLabel={t('common.states.working')}
          sending={sending}
          onCancel={() => setDeleteConfirmTarget(null)}
          onDelete={() => void deleteMessage(deleteConfirmTarget)}
        />
      ) : null}

      <section className="trade-social-section public-discussion-section public-discussion-section--messages-only">
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
        {messages.length ? (
          <PublicDiscussionMessageList
            groupedMessages={groupedMessages}
            currentUserId={auth.user?.id}
            language={language}
            canWrite={canWrite}
            sending={sending}
            editingId={editingId}
            editingBody={editingBody}
            trimmedEditingBody={trimmedEditingBody}
            openMenuId={openMenuId}
            labels={{
              unknownDate: t('trade.publicDiscussion.unknownDate'),
              you: t('trade.labels.you'),
              messageActions: t('trade.publicDiscussion.messageActions'),
              reply: t('trade.proposals.reply'),
              reportMessage: t('trade.publicDiscussion.reportMessage'),
              edited: (date) => t('trade.publicDiscussion.edited', { date }),
              messageDeleted: t('trade.publicDiscussion.messageDeleted'),
              save: t('common.actions.save'),
              cancel: t('common.actions.cancel'),
              edit: t('common.actions.edit'),
              deleteMessage: t('trade.publicDiscussion.deleteMessage'),
            }}
            onSaveEdit={saveEdit}
            onEditingBodyChange={setEditingBody}
            onCancelEdit={cancelEdit}
            onToggleMenu={(messageId) => setOpenMenuId((current) => current === messageId ? null : messageId)}
            onBeginEdit={beginEdit}
            onRequestDelete={requestDeleteMessage}
            onReply={focusComposerWithReply}
            onReport={openReportMessage}
          />
        ) : (
          <p className="public-discussion-empty-text">{t('trade.publicDiscussion.emptyTitle')}</p>
        )}
      </section>

      {canWrite ? (
        <PublicDiscussionComposer
          id="public-discussion-message"
          ready={composerReady}
          sending={sending}
          disabled={composerDisabled}
          value={body}
          label={t('trade.publicDiscussion.placeholder')}
          placeholder={t('trade.publicDiscussion.placeholder')}
          sendLabel={t('common.actions.send')}
          sendingLabel={t('common.states.sending')}
          textareaRef={composerTextareaRef}
          onSubmit={submitMessage}
          onChange={setBody}
        />
      ) : (
        <p className="notice-box warning public-discussion-bottom-notice">{t('trade.publicDiscussion.restricted')}</p>
      )}
    </article>
  );
}
