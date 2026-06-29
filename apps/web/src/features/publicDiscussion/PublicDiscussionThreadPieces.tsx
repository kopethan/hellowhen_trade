import Link from 'next/link';
import type { FormEvent, ReactNode, RefObject } from 'react';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { formatWebDate, formatWebDateTime } from '../../lib/webFormat';
import { UserIdentityLink } from '../users/UserIdentityLink';

export const PUBLIC_DISCUSSION_REFRESH_INTERVAL_MS = 8000;
export const PUBLIC_DISCUSSION_COMPOSER_MAX_HEIGHT_PX = 144;

export type PublicDiscussionView = 'messages' | 'menu' | 'guide' | 'report-thread' | 'report-message';
export type PublicDiscussionNotice = { tone: 'info' | 'success' | 'warning' | 'danger'; body: string };

type PublicDiscussionAuthor = {
  id?: string | null;
  profile?: {
    displayName?: string | null;
    handle?: string | null;
    avatarUrl?: string | null;
  } | null;
} | null | undefined;

export type PublicDiscussionMessageBase = {
  id: string;
  authorId: string;
  body: string;
  status?: 'visible' | 'hidden' | 'deleted' | string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  author?: PublicDiscussionAuthor;
};

export type PublicDiscussionMessageGroup<TMessage extends PublicDiscussionMessageBase> = {
  message: TMessage;
  showDate: boolean;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

export function normalizePublicDiscussionMessages<TMessage extends PublicDiscussionMessageBase>(
  value: unknown,
  isMessage: (candidate: unknown) => candidate is TMessage,
): TMessage[] {
  if (Array.isArray(value)) return value.filter(isMessage);
  if (isRecord(value) && Array.isArray(value.messages)) return value.messages.filter(isMessage);
  if (isRecord(value) && Array.isArray(value.items)) return value.items.filter(isMessage);
  return [];
}

export function normalizePublicDiscussionMessage<TMessage extends PublicDiscussionMessageBase>(
  value: unknown,
  isMessage: (candidate: unknown) => candidate is TMessage,
): TMessage | null {
  if (isMessage(value)) return value;
  if (isRecord(value) && isMessage(value.message)) return value.message;
  return null;
}

export function mergePublicDiscussionMessages<TMessage extends PublicDiscussionMessageBase>(current: TMessage[], next: TMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of next) byId.set(message.id, { ...byId.get(message.id), ...message });
  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function resizePublicDiscussionComposer(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const nextHeight = Math.min(textarea.scrollHeight, PUBLIC_DISCUSSION_COMPOSER_MAX_HEIGHT_PX);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > PUBLIC_DISCUSSION_COMPOSER_MAX_HEIGHT_PX ? 'auto' : 'hidden';
}

export function publicDiscussionMessageDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export function getPublicDiscussionMessageMention(message: PublicDiscussionMessageBase) {
  const handle = message.author?.profile?.handle?.trim().replace(/^@+/, '');
  if (handle) return `@${handle}`;
  const displayName = message.author?.profile?.displayName?.trim();
  return displayName || '';
}

export function groupPublicDiscussionMessages<TMessage extends PublicDiscussionMessageBase>(messages: TMessage[]) {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const showDate = !previous || publicDiscussionMessageDateKey(previous.createdAt) !== publicDiscussionMessageDateKey(message.createdAt);
    return { message, showDate };
  });
}

export function PublicDiscussionHeader({
  backHref,
  backLabel,
  title,
  menuLabel,
  onBack,
  onMenu,
}: {
  backHref?: string;
  backLabel: string;
  title: ReactNode;
  menuLabel?: string;
  onBack?: () => void;
  onMenu?: () => void;
}) {
  const backContent = <WebIcon name="back" size={21} decorative />;
  return (
    <section className="web-thread-header">
      {backHref ? (
        <Link href={backHref} className="web-thread-header__back" aria-label={backLabel}>{backContent}</Link>
      ) : (
        <button type="button" className="web-thread-header__back" onClick={onBack} aria-label={backLabel}>{backContent}</button>
      )}
      <h2>{title}</h2>
      {onMenu ? (
        <button type="button" className="web-thread-header__menu" onClick={onMenu} aria-label={menuLabel}>
          <WebIcon name="more" size={22} decorative />
        </button>
      ) : null}
    </section>
  );
}

export function PublicDiscussionLoadingShell({ label, title }: { label: ReactNode; title: ReactNode }) {
  return (
    <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only public-discussion-page--thread-shell" aria-busy="true">
      <section className="web-thread-header web-thread-header--loading">
        <span className="semantic-badge instruction">{label}</span>
        <h2>{title}</h2>
      </section>
      <section className="web-thread-loading-list" aria-hidden="true">
        <span />
        <span />
        <span />
      </section>
    </article>
  );
}

export function PublicDiscussionSignedOutShell({
  backHref,
  backLabel,
  title,
  heading,
  body,
  actionHref,
  actionLabel,
}: {
  backHref: string;
  backLabel: string;
  title: ReactNode;
  heading: ReactNode;
  body: ReactNode;
  actionHref: string;
  actionLabel: ReactNode;
}) {
  return (
    <article className="trade-detail-page public-discussion-page public-discussion-page--messages-only public-discussion-page--thread-shell">
      <PublicDiscussionHeader backHref={backHref} backLabel={backLabel} title={title} />
      <section className="public-discussion-section public-discussion-section--empty">
        <h3>{heading}</h3>
        <p>{body}</p>
        <Link href={actionHref} className="button primary full">{actionLabel}</Link>
      </section>
    </article>
  );
}

export function PublicDiscussionContextStrip({
  href,
  ariaLabel,
  eyebrow,
  title,
  meta,
  variant,
}: {
  href: string;
  ariaLabel: string;
  eyebrow: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  variant?: 'plan';
}) {
  const classes = [
    'public-discussion-context-strip',
    variant === 'plan' ? 'public-discussion-context-strip--plan' : '',
  ].filter(Boolean).join(' ');
  return (
    <Link href={href} className={classes} aria-label={ariaLabel}>
      <span className="public-discussion-context-strip__eyebrow">{eyebrow}</span>
      <span className="public-discussion-context-strip__title">{title}</span>
      {meta ? <span className="public-discussion-context-strip__meta">{meta}</span> : null}
      <WebIcon name="arrow-right" size={18} decorative />
    </Link>
  );
}

export function PublicDiscussionDeleteConfirm({
  titleId,
  badge,
  title,
  body,
  cancelLabel,
  deleteLabel,
  workingLabel,
  sending,
  onCancel,
  onDelete,
}: {
  titleId: string;
  badge: ReactNode;
  title: ReactNode;
  body: ReactNode;
  cancelLabel: ReactNode;
  deleteLabel: ReactNode;
  workingLabel: ReactNode;
  sending: boolean;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="proposal-confirm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="proposal-confirm-modal__panel">
        <span className="semantic-badge danger"><WebIcon name="warning" size={14} decorative /> {badge}</span>
        <h2 id={titleId}>{title}</h2>
        <p>{body}</p>
        <div className="proposal-confirm-modal__actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={sending}>{cancelLabel}</button>
          <button type="button" className="danger" onClick={onDelete} disabled={sending}>{sending ? workingLabel : deleteLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function PublicDiscussionComposer({
  id,
  ready,
  sending,
  disabled,
  value,
  label,
  placeholder,
  sendLabel,
  sendingLabel,
  textareaRef,
  onSubmit,
  onChange,
}: {
  id: string;
  ready: boolean;
  sending: boolean;
  disabled: boolean;
  value: string;
  label: ReactNode;
  placeholder: string;
  sendLabel: ReactNode;
  sendingLabel: ReactNode;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: string) => void;
}) {
  return (
    <form
      className={ready
        ? 'conversation-reply public-discussion-composer public-discussion-composer--messages-only public-discussion-composer--ready'
        : 'conversation-reply public-discussion-composer public-discussion-composer--messages-only'}
      onSubmit={onSubmit}
      aria-busy={sending}
    >
      <label className="sr-only" htmlFor={id}>{label}</label>
      <div className="public-discussion-composer__field">
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            resizePublicDiscussionComposer(event.currentTarget);
          }}
          placeholder={placeholder}
          rows={1}
          disabled={sending}
        />
      </div>
      <button className="public-discussion-composer__send" type="submit" disabled={disabled}>
        {sending ? sendingLabel : sendLabel}
      </button>
    </form>
  );
}

export function PublicDiscussionMessageList<TMessage extends PublicDiscussionMessageBase>({
  groupedMessages,
  currentUserId,
  language,
  canWrite,
  sending,
  editingId,
  editingBody,
  trimmedEditingBody,
  openMenuId,
  labels,
  onSaveEdit,
  onEditingBodyChange,
  onCancelEdit,
  onToggleMenu,
  onBeginEdit,
  onRequestDelete,
  onReply,
  onReport,
}: {
  groupedMessages: PublicDiscussionMessageGroup<TMessage>[];
  currentUserId?: string | null;
  language: string;
  canWrite: boolean;
  sending: boolean;
  editingId: string | null;
  editingBody: string;
  trimmedEditingBody: string;
  openMenuId: string | null;
  labels: {
    unknownDate: string;
    you: ReactNode;
    messageActions: string;
    reply: ReactNode;
    reportMessage: ReactNode;
    edited: (date: string) => ReactNode;
    messageDeleted: ReactNode;
    save: ReactNode;
    cancel: ReactNode;
    edit: ReactNode;
    deleteMessage: ReactNode;
  };
  onSaveEdit: (event: FormEvent<HTMLFormElement>) => void;
  onEditingBodyChange: (value: string) => void;
  onCancelEdit: () => void;
  onToggleMenu: (messageId: string) => void;
  onBeginEdit: (message: TMessage) => void;
  onRequestDelete: (message: TMessage) => void;
  onReply: (message: TMessage) => void;
  onReport: (messageId: string) => void;
}) {
  return (
    <div className="public-message-list public-message-list--thread">
      {groupedMessages.map(({ message, showDate }) => {
        const ownMessage = message.authorId === currentUserId;
        const deleted = message.status === 'deleted' || Boolean(message.deletedAt);
        const menuOpen = openMenuId === message.id;
        return (
          <div key={message.id} className="public-message-group">
            {showDate ? <div className="public-message-date">{formatWebDate(message.createdAt, labels.unknownDate, language)}</div> : null}
            <article className={ownMessage ? 'public-message public-message--own' : 'public-message'}>
              <header className="public-message__header">
                <UserIdentityLink
                  user={message.author}
                  userId={message.authorId}
                  variant="compact"
                  avatarSize="sm"
                  statusText={ownMessage ? labels.you : undefined}
                  showHandle={false}
                />
                <div className="public-message__meta">
                  <time dateTime={message.createdAt}>{formatWebDateTime(message.createdAt, '—', language)}</time>
                  {!deleted && ownMessage ? (
                    <button type="button" className="public-message__menu-button" onClick={() => onToggleMenu(message.id)} aria-expanded={menuOpen} aria-label={labels.messageActions}><WebIcon name="more" size={19} decorative /></button>
                  ) : null}
                </div>
              </header>

              {editingId === message.id ? (
                <form className="public-message-edit-form" onSubmit={onSaveEdit}>
                  <textarea value={editingBody} onChange={(event) => onEditingBodyChange(event.target.value)} rows={3} />
                  <div className="trade-action-row">
                    <button type="submit" disabled={sending || trimmedEditingBody.length < 1}>{labels.save}</button>
                    <button type="button" className="secondary" onClick={onCancelEdit}>{labels.cancel}</button>
                  </div>
                </form>
              ) : (
                <p className={deleted ? 'public-message__body public-message__body--deleted' : 'public-message__body'}>{deleted ? labels.messageDeleted : message.body}</p>
              )}

              {!deleted && message.editedAt ? <p className="public-message__edited">{labels.edited(formatWebDateTime(message.editedAt, '—', language))}</p> : null}

              {!deleted && (canWrite || !ownMessage) ? (
                <footer className="public-message__footer">
                  <div className="public-message__actions" aria-label={labels.messageActions}>
                    {canWrite ? (
                      <button type="button" className="public-message__action" onClick={() => onReply(message)}>{labels.reply}</button>
                    ) : null}
                    {!ownMessage ? (
                      <button type="button" className="public-message__action public-message__action--danger" onClick={() => onReport(message.id)}>{labels.reportMessage}</button>
                    ) : null}
                  </div>
                </footer>
              ) : null}

              {menuOpen && ownMessage ? (
                <div className="public-message__menu">
                  <button type="button" className="button secondary" onClick={() => onBeginEdit(message)}>{labels.edit}</button>
                  <button type="button" className="button secondary danger-text" onClick={() => onRequestDelete(message)}>{labels.deleteMessage}</button>
                </div>
              ) : null}
            </article>
          </div>
        );
      })}
    </div>
  );
}

export function PublicDiscussionGuideCard({ iconName, children, warning }: { iconName: WebIconName; children: ReactNode; warning?: boolean }) {
  return (
    <li className={warning ? 'web-thread-guide-card--warning' : undefined}>
      <span className="web-thread-guide-card__icon" aria-hidden="true"><WebIcon name={iconName} size={20} decorative /></span>
      <p>{children}</p>
    </li>
  );
}
