'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import type { PlanDto, PlanPublicMessageDto } from '@hellowhen/contracts';
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
import { planMetadata } from './plansPresentation';

function isPlanPublicMessage(value: unknown): value is PlanPublicMessageDto {
  return isRecord(value) && typeof value.id === 'string' && typeof value.planId === 'string' && typeof value.authorId === 'string' && typeof value.body === 'string';
}

function normalizePlan(value: unknown): PlanDto | null {
  if (isRecord(value) && typeof value.id === 'string') return value as PlanDto;
  if (isRecord(value) && isRecord(value.plan) && typeof value.plan.id === 'string') return value.plan as PlanDto;
  return null;
}

function planContextMeta(plan: PlanDto | null, count: number, t: ReturnType<typeof useWebTranslation>['t']) {
  const countLabel = count === 1 ? t('plans.discussion.meta.commentOne', { count }) : t('plans.discussion.meta.commentMany', { count });
  if (!plan) return countLabel;
  const placeCount = plan.places?.length ?? 0;
  const placeLabel = placeCount === 1 ? t('plans.row.placeOne', { count: placeCount }) : t('plans.row.placeMany', { count: placeCount });
  const metadata = planMetadata(plan);
  return [t(`plans.status.${plan.status}`), placeLabel, metadata, countLabel].filter(Boolean).join(' · ');
}

export function PlanPublicDiscussionClient({ planId }: { planId: string }) {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [view, setView] = useState<PublicDiscussionView>('messages');
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<PlanPublicMessageDto | null>(null);
  const [messages, setMessages] = useState<PlanPublicMessageDto[]>([]);
  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<PublicDiscussionNotice | null>(null);

  const discussionClosed = plan?.status === 'cancelled';
  const canWrite = auth.isAuthenticated && auth.user?.trustTier !== 'restricted' && !discussionClosed;
  const trimmedBody = body.trim();
  const trimmedEditingBody = editingBody.trim();
  const composerReady = trimmedBody.length > 0;
  const composerDisabled = sending || !composerReady;
  const planHeadline = plan?.title || t('plans.discussion.guide.header');
  const planContextLabel = t('plans.discussion.context');
  const planMeta = planContextMeta(plan, messages.length, t);

  const groupedMessages = useMemo(() => groupPublicDiscussionMessages(messages), [messages]);

  useEffect(() => {
    resizePublicDiscussionComposer(composerTextareaRef.current);
  }, [body]);

  async function loadMessages(options?: { quiet?: boolean }) {
    if (!options?.quiet) setLoading(true);
    try {
      const response = await api.plans.publicMessages(planId, { take: 80 });
      const nextMessages = normalizePublicDiscussionMessages(response, isPlanPublicMessage);
      setMessages(nextMessages);
      if (!options?.quiet) setNotice(null);
    } catch (cause) {
      if (!options?.quiet) setNotice({ tone: 'warning', body: getFriendlyApiErrorMessage(cause, t('plans.discussion.errors.load')) });
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }

  async function loadPlanContext() {
    try {
      const response = await api.plans.get(planId);
      setPlan(normalizePlan(response));
    } catch {
      setPlan(null);
    }
  }

  useEffect(() => {
    if (!auth.hydrated) return;
    void loadMessages();
    void loadPlanContext();
  }, [auth.hydrated, auth.isAuthenticated, planId]);

  useEffect(() => {
    if (!auth.hydrated) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void loadMessages({ quiet: true });
    }, PUBLIC_DISCUSSION_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [auth.hydrated, planId]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || trimmedBody.length < 1) return;
    setSending(true);
    setNotice(null);
    try {
      const response = await api.plans.sendPublicMessage(planId, { body: trimmedBody });
      const message = normalizePublicDiscussionMessage(response, isPlanPublicMessage);
      if (message) setMessages((current) => mergePublicDiscussionMessages(current, [message]));
      setBody('');
      window.requestAnimationFrame(() => resizePublicDiscussionComposer(composerTextareaRef.current));
    } catch (cause) {
      setNotice({ tone: 'danger', body: getFriendlyApiErrorMessage(cause, t('plans.discussion.errors.send')) });
    } finally {
      setSending(false);
    }
  }

  function beginEdit(message: PlanPublicMessageDto) {
    if (!canWrite) return;
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
    if (!canWrite || !editingId || trimmedEditingBody.length < 1) return;
    setSending(true);
    setNotice(null);
    try {
      const response = await api.plans.updatePublicMessage(planId, editingId, { body: trimmedEditingBody });
      const message = normalizePublicDiscussionMessage(response, isPlanPublicMessage);
      if (message) setMessages((current) => mergePublicDiscussionMessages(current, [message]));
      cancelEdit();
    } catch (cause) {
      setNotice({ tone: 'danger', body: getFriendlyApiErrorMessage(cause, t('plans.discussion.errors.update')) });
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(message: PlanPublicMessageDto) {
    setSending(true);
    setNotice(null);
    try {
      const response = await api.plans.deletePublicMessage(planId, message.id);
      const nextMessage = normalizePublicDiscussionMessage(response, isPlanPublicMessage);
      if (nextMessage) setMessages((current) => mergePublicDiscussionMessages(current, [nextMessage]));
      setOpenMenuId(null);
      setDeleteConfirmTarget(null);
    } catch (cause) {
      setNotice({ tone: 'danger', body: getFriendlyApiErrorMessage(cause, t('plans.discussion.errors.delete')) });
    } finally {
      setSending(false);
    }
  }

  function requestDeleteMessage(message: PlanPublicMessageDto) {
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

  function focusComposerWithReply(message: PlanPublicMessageDto) {
    if (!canWrite) return;
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
    return <PublicDiscussionLoadingShell label={t('common.states.loading')} title={t('plans.discussion.title')} />;
  }

  if (view === 'menu') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only public-discussion-page--menu">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title={t('plans.discussion.options')} onBack={closeSubpage} />
        <WebOptionPickerPanel className="web-thread-options-picker">
          <WebOptionPickerCard
            href={`/plans/${planId}`}
            iconName="plan"
            title={t('plans.discussion.menu.details')}
            description={t('plans.discussion.menu.detailsHelper')}
          />
          <WebOptionPickerCard
            iconName="help"
            title={t('plans.discussion.menu.guide')}
            description={t('plans.discussion.menu.guideHelper')}
            onClick={() => setView('guide')}
          />
          <WebOptionPickerDangerCard
            iconName="report-flag"
            title={t('plans.discussion.menu.reportPlan')}
            description={t('plans.discussion.menu.reportPlanHelper')}
            onClick={() => setView('report-thread')}
          />
        </WebOptionPickerPanel>
      </article>
    );
  }

  if (view === 'guide') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title={t('plans.discussion.guide.title')} onBack={() => setView('menu')} />
        <section className="web-thread-info-page web-thread-guide-page">
          <ul className="web-thread-guide-list web-thread-guide-list--cards">
            <PublicDiscussionGuideCard iconName="help">{t('plans.discussion.guide.publicBody')}</PublicDiscussionGuideCard>
            <PublicDiscussionGuideCard iconName="plan">{t('plans.discussion.guide.questionsBody')}</PublicDiscussionGuideCard>
            <PublicDiscussionGuideCard iconName="proposal">{t('plans.discussion.guide.body')}</PublicDiscussionGuideCard>
            <PublicDiscussionGuideCard iconName="warning" warning>{t('plans.discussion.guide.safetyBody')}</PublicDiscussionGuideCard>
          </ul>
        </section>
      </article>
    );
  }

  if (view === 'report-thread') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title={t('plans.discussion.menu.reportPlanTitle')} onBack={() => setView('menu')} />
        <section className="web-thread-info-page">
          <ReportContentButton targetType="plan" targetId={planId} labelKey="report.content" helperKey="report.helper.content" initialOpen />
        </section>
      </article>
    );
  }

  if (view === 'report-message' && reportMessageId) {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title={t('plans.discussion.actions.report')} onBack={closeSubpage} />
        <section className="web-thread-info-page">
          <ReportContentButton targetType="public_message" targetId={reportMessageId} labelKey="report.publicMessage" helperKey="report.helper.publicMessage" initialOpen />
        </section>
      </article>
    );
  }

  return (
    <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only public-discussion-page--thread-shell public-discussion-page--plan-thread">
      <PublicDiscussionHeader
        backHref={`/plans/${planId}`}
        backLabel={t('common.actions.back')}
        title={t('plans.discussion.title')}
        menuLabel={t('plans.discussion.options')}
        onMenu={() => setView('menu')}
      />

      <PublicDiscussionContextStrip
        href={`/plans/${planId}`}
        ariaLabel={t('plans.discussion.viewPlan')}
        eyebrow={planContextLabel}
        title={planHeadline}
        meta={planMeta}
        variant="plan"
      />

      {deleteConfirmTarget ? (
        <PublicDiscussionDeleteConfirm
          titleId="delete-plan-public-message-title"
          badge={t('plans.discussion.actions.delete')}
          title={t('plans.discussion.confirmDelete.title')}
          body={t('plans.discussion.confirmDelete.body')}
          cancelLabel={t('common.actions.cancel')}
          deleteLabel={t('plans.discussion.actions.delete')}
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
              unknownDate: t('plans.discussion.unknownDate'),
              you: t('plans.discussion.you'),
              messageActions: t('plans.discussion.actions.title'),
              reply: t('plans.discussion.actions.reply'),
              reportMessage: t('plans.discussion.actions.report'),
              edited: (date) => t('plans.discussion.editedAt', { time: date }),
              messageDeleted: t('plans.discussion.feedback.deleted'),
              save: t('common.actions.save'),
              cancel: t('common.actions.cancel'),
              edit: t('common.actions.edit'),
              deleteMessage: t('plans.discussion.actions.delete'),
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
          <p className="public-discussion-empty-text">{t('plans.discussion.empty.title')}</p>
        )}
      </section>

      {discussionClosed ? (
        <p className="notice-box warning public-discussion-bottom-notice">{t('plans.discussion.cancelled.body')}</p>
      ) : canWrite ? (
        <PublicDiscussionComposer
          id="plan-public-discussion-message"
          ready={composerReady}
          sending={sending}
          disabled={composerDisabled}
          value={body}
          label={t('plans.discussion.composer.label')}
          placeholder={t('plans.discussion.composer.placeholder')}
          sendLabel={t('common.actions.send')}
          sendingLabel={t('common.states.sending')}
          textareaRef={composerTextareaRef}
          onSubmit={submitMessage}
          onChange={setBody}
        />
      ) : !auth.isAuthenticated ? (
        <div className="notice-box warning public-discussion-bottom-notice public-discussion-bottom-notice--auth">
          <span>{t('plans.discussion.auth.loginBody')}</span>
          <Link className="button secondary compact" href={`/auth?next=${encodeURIComponent(`/plans/${planId}/discussion`)}`}>{t('plans.discussion.auth.login')}</Link>
        </div>
      ) : (
        <p className="notice-box warning public-discussion-bottom-notice">{t('plans.discussion.auth.restricted')}</p>
      )}
    </article>
  );
}
