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
import { planMetadata, planStatusLabel } from './plansPresentation';

function isPlanPublicMessage(value: unknown): value is PlanPublicMessageDto {
  return isRecord(value) && typeof value.id === 'string' && typeof value.planId === 'string' && typeof value.authorId === 'string' && typeof value.body === 'string';
}

function normalizePlan(value: unknown): PlanDto | null {
  if (isRecord(value) && typeof value.id === 'string') return value as PlanDto;
  if (isRecord(value) && isRecord(value.plan) && typeof value.plan.id === 'string') return value.plan as PlanDto;
  return null;
}

function planContextMeta(plan: PlanDto | null, count: number) {
  const countLabel = `${count} public comment${count === 1 ? '' : 's'}`;
  if (!plan) return countLabel;
  const placeCount = plan.places?.length ?? 0;
  const placeLabel = `${placeCount} ${placeCount === 1 ? 'place' : 'places'}`;
  const metadata = planMetadata(plan);
  return [planStatusLabel(plan.status), placeLabel, metadata, countLabel].filter(Boolean).join(' · ');
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

  const canWrite = auth.isAuthenticated && auth.user?.trustTier !== 'restricted';
  const trimmedBody = body.trim();
  const trimmedEditingBody = editingBody.trim();
  const composerReady = trimmedBody.length > 0;
  const composerDisabled = sending || !composerReady;
  const planHeadline = plan?.title || 'Plan discussion';
  const planContextLabel = 'Plan context';
  const planMeta = planContextMeta(plan, messages.length);

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
      if (!options?.quiet) setNotice({ tone: 'warning', body: getFriendlyApiErrorMessage(cause, 'Could not load the Plan discussion.') });
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
      setNotice({ tone: 'danger', body: getFriendlyApiErrorMessage(cause, 'Could not send this public comment. Try again.') });
    } finally {
      setSending(false);
    }
  }

  function beginEdit(message: PlanPublicMessageDto) {
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
      const response = await api.plans.updatePublicMessage(planId, editingId, { body: trimmedEditingBody });
      const message = normalizePublicDiscussionMessage(response, isPlanPublicMessage);
      if (message) setMessages((current) => mergePublicDiscussionMessages(current, [message]));
      cancelEdit();
    } catch (cause) {
      setNotice({ tone: 'danger', body: getFriendlyApiErrorMessage(cause, 'Could not update this public comment. Try again.') });
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
      setNotice({ tone: 'danger', body: getFriendlyApiErrorMessage(cause, 'Could not delete this public comment. Try again.') });
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
    return <PublicDiscussionLoadingShell label={t('common.states.loading')} title="Public discussion" />;
  }

  if (view === 'menu') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only public-discussion-page--menu">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title="Thread options" onBack={closeSubpage} />
        <WebOptionPickerPanel className="web-thread-options-picker">
          <WebOptionPickerCard
            href={`/plans/${planId}`}
            iconName="plan"
            title="See Plan"
            description="Open the full Plan detail page."
          />
          <WebOptionPickerCard
            iconName="help"
            title="See guide"
            description="How public Plan discussion works."
            onClick={() => setView('guide')}
          />
          <WebOptionPickerDangerCard
            iconName="report-flag"
            title="Report thread"
            description="Report the public discussion or Plan context to moderators."
            onClick={() => setView('report-thread')}
          />
        </WebOptionPickerPanel>
      </article>
    );
  }

  if (view === 'guide') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title="Public thread guide" onBack={() => setView('menu')} />
        <section className="web-thread-info-page web-thread-guide-page">
          <ul className="web-thread-guide-list web-thread-guide-list--cards">
            <PublicDiscussionGuideCard iconName="help">Public Plan comments are for visible questions that help everyone understand the Plan better.</PublicDiscussionGuideCard>
            <PublicDiscussionGuideCard iconName="plan">Ask about the route, timing, places, joining, and general requirements.</PublicDiscussionGuideCard>
            <PublicDiscussionGuideCard iconName="proposal">Use private or direct follow-up areas later for personal details, addresses, files, or private coordination.</PublicDiscussionGuideCard>
            <PublicDiscussionGuideCard iconName="warning" warning>Do not share passwords, payment details, private contact details, or sensitive documents in public comments.</PublicDiscussionGuideCard>
          </ul>
        </section>
      </article>
    );
  }

  if (view === 'report-thread') {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title="Report public thread" onBack={() => setView('menu')} />
        <section className="web-thread-info-page">
          <ReportContentButton targetType="plan" targetId={planId} labelKey="report.content" helperKey="report.helper.content" initialOpen />
        </section>
      </article>
    );
  }

  if (view === 'report-message' && reportMessageId) {
    return (
      <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only">
        <PublicDiscussionHeader backLabel={t('common.actions.back')} title="Report comment" onBack={closeSubpage} />
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
        title="Public discussion"
        menuLabel="Thread options"
        onMenu={() => setView('menu')}
      />

      <PublicDiscussionContextStrip
        href={`/plans/${planId}`}
        ariaLabel="View Plan"
        eyebrow={planContextLabel}
        title={planHeadline}
        meta={planMeta}
        variant="plan"
      />

      {deleteConfirmTarget ? (
        <PublicDiscussionDeleteConfirm
          titleId="delete-plan-public-message-title"
          badge="Delete comment"
          title="Delete this comment?"
          body="This cannot be undone. The public thread will keep a deleted-comment marker for moderation context."
          cancelLabel={t('common.actions.cancel')}
          deleteLabel="Delete comment"
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
              unknownDate: 'Date unknown',
              you: 'You',
              messageActions: 'Comment actions',
              reply: 'Reply',
              reportMessage: 'Report comment',
              edited: (date) => `edited ${date}`,
              messageDeleted: 'Comment deleted',
              save: t('common.actions.save'),
              cancel: t('common.actions.cancel'),
              edit: t('common.actions.edit'),
              deleteMessage: 'Delete comment',
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
          <p className="public-discussion-empty-text">No public comments yet</p>
        )}
      </section>

      {canWrite ? (
        <PublicDiscussionComposer
          id="plan-public-discussion-message"
          ready={composerReady}
          sending={sending}
          disabled={composerDisabled}
          value={body}
          label="Comment publicly on this Plan"
          placeholder="Comment publicly on this Plan..."
          sendLabel={t('common.actions.send')}
          sendingLabel={t('common.states.sending')}
          textareaRef={composerTextareaRef}
          onSubmit={submitMessage}
          onChange={setBody}
        />
      ) : !auth.isAuthenticated ? (
        <div className="notice-box warning public-discussion-bottom-notice public-discussion-bottom-notice--auth">
          <span>Log in to comment or report in this Plan discussion.</span>
          <Link className="button secondary compact" href={`/auth?next=${encodeURIComponent(`/plans/${planId}/discussion`)}`}>Log in</Link>
        </div>
      ) : (
        <p className="notice-box warning public-discussion-bottom-notice">Your account is restricted, so you cannot post public comments right now.</p>
      )}
    </article>
  );
}
