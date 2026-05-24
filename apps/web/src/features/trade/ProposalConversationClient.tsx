"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import type {
  NeedDto,
  OfferDto,
  ProposalMessageDto,
  TradeDto,
  TradeProposalDto,
} from "@hellowhen/contracts";
import { useEffect, useMemo, useState } from "react";
import { WebIcon, type WebIconName } from "../../components/WebIcon";
import { api } from "../../lib/api";
import { formatWebDateTime } from "../../lib/webFormat";
import { useWebAuth } from "../../providers/WebAuthProvider";
import { useWebTranslation } from "../../providers/WebI18nProvider";
import { UserIdentityLink } from "../users/UserIdentityLink";
import { getStatusLabel, type TradeI18n } from "./tradePresentation";

const PROPOSAL_REFRESH_INTERVAL_MS = 6000;
const MESSAGE_REFRESH_INTERVAL_MS = 3000;

type ProposalStatusResponse = { proposal?: TradeProposalDto; trade?: TradeDto };
type ProposalMessageResponse = {
  message?: ProposalMessageDto;
  proposal?: TradeProposalDto;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isProposal(value: unknown): value is TradeProposalDto {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tradeId === "string" &&
    typeof value.applicantId === "string" &&
    typeof value.message === "string"
  );
}

function isProposalMessage(value: unknown): value is ProposalMessageDto {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.proposalId === "string" &&
    typeof value.senderId === "string" &&
    typeof value.body === "string"
  );
}

function normalizeProposal(value: unknown): TradeProposalDto | null {
  if (isProposal(value)) return value;
  if (isRecord(value) && isProposal(value.proposal)) return value.proposal;
  return null;
}

function normalizeProposalStatusResponse(
  value: unknown,
): ProposalStatusResponse {
  if (!isRecord(value)) return {};
  const proposal = normalizeProposal(value);
  const trade =
    isRecord(value.trade) && typeof value.trade.id === "string"
      ? (value.trade as TradeDto)
      : undefined;
  return { proposal: proposal ?? undefined, trade };
}

function normalizeMessages(value: unknown): ProposalMessageDto[] {
  if (Array.isArray(value)) return value.filter(isProposalMessage);
  if (isRecord(value) && Array.isArray(value.messages))
    return value.messages.filter(isProposalMessage);
  if (isRecord(value) && Array.isArray(value.items))
    return value.items.filter(isProposalMessage);
  return [];
}

function normalizeProposalMessageResponse(
  value: unknown,
): ProposalMessageResponse {
  if (!isRecord(value)) return {};
  const response = value as { message?: unknown };
  if (isProposalMessage(value)) return { message: value };
  const message = isProposalMessage(response.message)
    ? response.message
    : undefined;
  const proposal = normalizeProposal(value);
  return { message, proposal: proposal ?? undefined };
}

function messageListsMatch(
  current: ProposalMessageDto[],
  next: ProposalMessageDto[],
) {
  if (current.length !== next.length) return false;
  return current.every((message, index) => {
    const nextMessage = next[index];
    if (!nextMessage) return false;
    return (
      message.id === nextMessage.id &&
      message.senderId === nextMessage.senderId &&
      message.body === nextMessage.body
    );
  });
}

function proposalStatusIcon(status: TradeProposalDto["status"]): WebIconName {
  if (status === "accepted") return "proposal-accepted";
  if (status === "declined") return "proposal-declined";
  return "proposal";
}

function firstMediaUrl(item: NeedDto | OfferDto) {
  return (
    item.media?.find(
      (media) => typeof media.url === "string" && media.url.length > 0,
    )?.url ?? null
  );
}

function sideMeta(item: NeedDto | OfferDto, i18n?: TradeI18n) {
  const sideTiming =
    (item as NeedDto).timing ?? (item as OfferDto).availability;
  return (
    [item.category, item.mode, sideTiming].filter(Boolean).join(" · ") ||
    item.itemType ||
    i18n?.t?.("trade.labels.savedItem") ||
    "Saved item"
  );
}

function proposalSideItem(
  proposal: TradeProposalDto,
): { kind: "need"; item: NeedDto } | { kind: "offer"; item: OfferDto } | null {
  if (proposal.proposedOffer)
    return { kind: "offer", item: proposal.proposedOffer };
  if (proposal.proposedNeed)
    return { kind: "need", item: proposal.proposedNeed };
  return null;
}

function proposalApplicantStatus(proposal: TradeProposalDto, i18n?: TradeI18n) {
  const sideItem = proposalSideItem(proposal);
  if (sideItem?.kind === "offer")
    return i18n?.t?.("trade.proposals.offerProposal") ?? "Offer proposal";
  if (sideItem?.kind === "need")
    return i18n?.t?.("trade.proposals.needProposal") ?? "Need proposal";
  return i18n?.t?.("trade.proposals.tradeRequest") ?? "Trade request";
}

function messageSenderStatus(
  message: ProposalMessageDto,
  currentUserId?: string | null,
  i18n?: TradeI18n,
) {
  if (message.senderId === currentUserId)
    return i18n?.t?.("trade.labels.you") ?? "You";
  return i18n?.t?.("trade.labels.privateMessage") ?? "Private message";
}

function isInitialProposalConversationMessage(
  message: ProposalMessageDto,
  proposal: TradeProposalDto,
) {
  return (
    message.senderId === proposal.applicantId &&
    message.body.trim() === proposal.message.trim()
  );
}

function ProposalSidePreview({
  kind,
  item,
  label,
  compact = false,
  i18n,
}: {
  kind: "need" | "offer";
  item: NeedDto | OfferDto;
  label?: string;
  compact?: boolean;
  i18n?: TradeI18n;
}) {
  const mediaUrl = firstMediaUrl(item);
  const iconName: WebIconName = kind === "offer" ? "offer" : "need";
  return (
    <div
      className={
        compact
          ? "proposal-side-preview proposal-side-preview--compact"
          : "proposal-side-preview"
      }
    >
      <div className="proposal-side-preview__media">
        {mediaUrl ? (
          <img src={mediaUrl} alt="" />
        ) : (
          <WebIcon name={iconName} size={22} decorative />
        )}
      </div>
      <div className="proposal-side-preview__body">
        <span className="proposal-side-preview__label">
          {label ??
            (kind === "offer"
              ? (i18n?.t?.("trade.labels.proposedOffer") ?? "Proposed Offer")
              : (i18n?.t?.("trade.labels.proposedNeed") ?? "Proposed Need"))}
        </span>
        <strong>{item.title}</strong>
        <p>{item.description}</p>
        <em>{sideMeta(item, i18n)}</em>
      </div>
    </div>
  );
}

export function ProposalConversationClient({
  tradeId,
  proposalId,
}: {
  tradeId: string;
  proposalId: string;
}) {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const i18n = { t, language };
  const [proposal, setProposal] = useState<TradeProposalDto | null>(null);
  const [messages, setMessages] = useState<ProposalMessageDto[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<
    "accepted" | "declined" | "withdrawn" | "reply" | "cancel" | null
  >(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const sideItem = useMemo(
    () => (proposal ? proposalSideItem(proposal) : null),
    [proposal],
  );
  const actorId = auth.user?.id ?? null;
  const isOwner = Boolean(
    proposal?.trade?.ownerId && actorId === proposal.trade.ownerId,
  );
  const isApplicant = Boolean(
    proposal?.applicantId && actorId === proposal.applicantId,
  );
  const canActOnProposal = Boolean(
    proposal && isOwner && proposal.status === "pending",
  );
  const canWithdrawProposal = Boolean(
    proposal && isApplicant && proposal.status === "pending",
  );
  const tradeCancelled = proposal?.trade?.status === "cancelled";
  const canCancelAcceptedTrade = Boolean(
    proposal &&
    proposal.status === "accepted" &&
    ["in_progress", "submitted"].includes(proposal.trade?.status ?? "") &&
    auth.isAuthenticated &&
    (isOwner || isApplicant || proposal.trade?.providerId === actorId),
  );
  const canReply = Boolean(
    proposal &&
    auth.isAuthenticated &&
    (isOwner || isApplicant || proposal.trade?.providerId === actorId) &&
    !["declined", "withdrawn"].includes(proposal.status) &&
    !tradeCancelled,
  );
  const visibleMessages = useMemo(
    () =>
      proposal
        ? messages.filter(
            (message, index) =>
              index !== 0 ||
              !isInitialProposalConversationMessage(message, proposal),
          )
        : [],
    [messages, proposal],
  );

  async function loadProposal(options?: { quiet?: boolean }) {
    if (!auth.isAuthenticated) return;
    if (!options?.quiet) setLoading(true);
    try {
      const response = await api.proposals.get(proposalId);
      const nextProposal = normalizeProposal(response);
      if (!nextProposal || nextProposal.tradeId !== tradeId)
        throw new Error("proposal_not_found");
      setProposal(nextProposal);
      setNotice(null);
    } catch {
      if (!options?.quiet) {
        setProposal(null);
        setNotice(t("trade.proposals.proposalAccessPrivate"));
      }
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }

  async function loadMessages(options?: { quiet?: boolean }) {
    if (!auth.isAuthenticated) return;
    try {
      const response = await api.proposals.messages(proposalId);
      const nextMessages = normalizeMessages(response);
      setMessages((current) =>
        messageListsMatch(current, nextMessages) ? current : nextMessages,
      );
    } catch {
      if (!options?.quiet) setMessages([]);
    }
  }

  useEffect(() => {
    if (!auth.hydrated || !auth.isAuthenticated) {
      setLoading(false);
      return;
    }
    let mounted = true;
    async function loadInitial() {
      setLoading(true);
      try {
        const [proposalResponse, messageResponse] = await Promise.all([
          api.proposals.get(proposalId),
          api.proposals.messages(proposalId),
        ]);
        if (!mounted) return;
        const nextProposal = normalizeProposal(proposalResponse);
        if (!nextProposal || nextProposal.tradeId !== tradeId)
          throw new Error("proposal_not_found");
        setProposal(nextProposal);
        setMessages(normalizeMessages(messageResponse));
        setNotice(null);
      } catch {
        if (!mounted) return;
        setProposal(null);
        setMessages([]);
        setNotice(t("trade.proposals.proposalAccessPrivate"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadInitial();
    return () => {
      mounted = false;
    };
  }, [auth.hydrated, auth.isAuthenticated, proposalId, t, tradeId]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const proposalInterval = window.setInterval(() => {
      if (document.visibilityState !== "hidden")
        void loadProposal({ quiet: true });
    }, PROPOSAL_REFRESH_INTERVAL_MS);
    const messageInterval = window.setInterval(() => {
      if (document.visibilityState !== "hidden")
        void loadMessages({ quiet: true });
    }, MESSAGE_REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(proposalInterval);
      window.clearInterval(messageInterval);
    };
  }, [auth.isAuthenticated, proposalId, tradeId]);

  async function updateProposalStatus(
    status: "accepted" | "declined" | "withdrawn",
  ) {
    if (status === "withdrawn") setWithdrawConfirmOpen(false);
    setActionLoading(status);
    setNotice(null);
    try {
      const response = await api.proposals.updateStatus(proposalId, { status });
      const { proposal: updated } = normalizeProposalStatusResponse(response);
      if (!updated) throw new Error("missing_proposal_response");
      setProposal(updated);
      setNotice(
        status === "accepted"
          ? t("trade.proposals.proposalAccepted")
          : status === "withdrawn"
            ? t("trade.proposals.proposalWithdrawn")
            : t("trade.proposals.proposalDeclined"),
      );
      await loadMessages({ quiet: true });
    } catch {
      setNotice(t("trade.errors.couldNotUpdateProposal"));
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelAcceptedTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proposal?.trade) return;
    const reason = cancelReason.trim();
    setCancelError(null);
    if (reason.length < 3) {
      setCancelError(t("trade.proposals.cancelReasonRequired"));
      return;
    }
    setActionLoading("cancel");
    setNotice(null);
    try {
      await api.trades.updateStatus(proposal.trade.id, {
        status: "cancelled",
        cancelReason: reason,
      });
      setCancelConfirmOpen(false);
      setCancelReason("");
      setCancelError(null);
      setNotice(t("trade.proposals.tradeCancelled"));
      await loadProposal({ quiet: true });
      await loadMessages({ quiet: true });
    } catch {
      setCancelError(t("trade.proposals.couldNotCancelTrade"));
    } finally {
      setActionLoading(null);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proposal) return;
    const body = reply.trim();
    setReplyError(null);
    if (!body) {
      setReplyError(t("trade.proposals.replyRequired"));
      return;
    }
    setActionLoading("reply");
    setNotice(null);
    try {
      const response = await api.proposals.sendMessage(proposal.id, { body });
      const { message: nextMessage, proposal: updatedProposal } =
        normalizeProposalMessageResponse(response);
      if (!nextMessage) throw new Error("missing_message_response");
      setMessages((current) => [...current, nextMessage]);
      if (updatedProposal) setProposal(updatedProposal);
      setReply("");
      setReplyError(null);
    } catch {
      setNotice(t("trade.errors.couldNotSendMessage"));
    } finally {
      setActionLoading(null);
    }
  }

  if (!auth.hydrated || loading) {
    return (
      <article className="trade-detail-page proposal-conversation-page">
        <section className="trade-hero-section">
          <span className="semantic-badge instruction">
            {t("common.states.loading")}
          </span>
          <h2>{t("trade.proposals.loadingProposal")}</h2>
        </section>
      </article>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <article className="trade-detail-page proposal-conversation-page">
        <section className="trade-hero-section">
          <span className="semantic-badge proposal">
            <WebIcon name="proposal" size={14} decorative />{" "}
            {t("trade.labels.privateThread")}
          </span>
          <h2>{t("trade.proposals.privateProposalConversation")}</h2>
          <p>{t("trade.proposals.signInReady")}</p>
          <Link
            href={`/auth?next=${encodeURIComponent(`/trades/${tradeId}/proposals/${proposalId}`)}`}
            className="button primary full"
          >
            {t("trade.proposals.signInToSend")}
          </Link>
        </section>
      </article>
    );
  }

  if (!proposal) {
    return (
      <article className="trade-detail-page proposal-conversation-page">
        <section className="trade-hero-section">
          <Link href={`/trades/${tradeId}`} className="button secondary">
            ← {t("common.actions.back")}
          </Link>
          <span className="semantic-badge danger">
            {t("trade.labels.unavailable")}
          </span>
          <h2>{t("trade.proposals.privateProposalConversation")}</h2>
          <p>{notice ?? t("trade.proposals.proposalAccessPrivate")}</p>
        </section>
      </article>
    );
  }

  return (
    <article className="trade-detail-page proposal-conversation-page">
      <section className="trade-hero-section">
        <Link href={`/trades/${tradeId}`} className="button secondary">
          ← {t("common.actions.back")}
        </Link>
        <div className="status-row">
          <span className="semantic-badge proposal">
            <WebIcon
              name={proposalStatusIcon(proposal.status)}
              size={14}
              decorative
            />{" "}
            {getStatusLabel(proposal.status, i18n)}
          </span>
          <span className="semantic-badge trade">
            {proposalApplicantStatus(proposal, i18n)}
          </span>
        </div>
        <h2>
          {proposal.status === "accepted"
            ? t("trade.proposals.acceptedTradeConversation")
            : t("trade.proposals.privateProposalConversation")}
        </h2>
        <p>
          {proposal.status === "accepted"
            ? t("trade.proposals.acceptedConversationBody")
            : isOwner
              ? t("trade.proposals.ownerPendingHint")
              : t("trade.proposals.applicantPendingHint")}
        </p>
        {notice ? <p className="notice-box info">{notice}</p> : null}
      </section>

      {withdrawConfirmOpen ? (
        <div
          className="proposal-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-proposal-title"
        >
          <div className="proposal-confirm-modal__panel">
            <span className="semantic-badge danger">
              <WebIcon name="proposal-declined" size={14} decorative /> {t("trade.proposals.withdraw")}
            </span>
            <h2 id="withdraw-proposal-title">
              {t("trade.proposals.withdrawConfirmTitle")}
            </h2>
            <p>{t("trade.proposals.withdrawConfirmBody")}</p>
            <div className="proposal-confirm-modal__actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setWithdrawConfirmOpen(false)}
                disabled={Boolean(actionLoading)}
              >
                {t("trade.proposals.withdrawConfirmCancel")}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => void updateProposalStatus("withdrawn")}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "withdrawn"
                  ? t("trade.proposals.withdrawing")
                  : t("trade.proposals.withdrawConfirmAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelConfirmOpen ? (
        <div
          className="proposal-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-accepted-trade-title"
        >
          <form className="proposal-confirm-modal__panel" onSubmit={cancelAcceptedTrade}>
            <span className="semantic-badge danger">
              <WebIcon name="warning" size={14} decorative /> {t("trade.proposals.cancelAcceptedTrade")}
            </span>
            <h2 id="cancel-accepted-trade-title">
              {t("trade.proposals.cancelAcceptedTradeTitle")}
            </h2>
            <p>{t("trade.proposals.cancelAcceptedTradeBody")}</p>
            <label className="field-label">
              {t("trade.proposals.cancelReasonLabel")}
              <textarea
                value={cancelReason}
                onChange={(event) => {
                  setCancelReason(event.target.value);
                  if (cancelError) setCancelError(null);
                }}
                placeholder={t("trade.proposals.cancelReasonPlaceholder")}
                rows={3}
                aria-invalid={Boolean(cancelError)}
                aria-describedby={cancelError ? "cancel-trade-error" : undefined}
              />
            </label>
            {cancelError ? (
              <p id="cancel-trade-error" className="field-error" role="alert">
                {cancelError}
              </p>
            ) : null}
            <div className="proposal-confirm-modal__actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setCancelConfirmOpen(false);
                  setCancelError(null);
                }}
                disabled={Boolean(actionLoading)}
              >
                {t("trade.proposals.keepAcceptedTrade")}
              </button>
              <button
                type="submit"
                className="danger"
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "cancel"
                  ? t("trade.proposals.cancellingTrade")
                  : t("trade.proposals.cancelAcceptedTradeAction")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <section className="trade-social-section trade-social-section--compact conversation-panel proposal-conversation-panel">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">{t("trade.labels.privateThread")}</p>
            <h2 className="icon-heading">
              <WebIcon
                name={proposalStatusIcon(proposal.status)}
                size={21}
                decorative
              />{" "}
              {proposal.status === "accepted"
                ? t("trade.proposals.acceptedConversation")
                : t("trade.proposals.proposalConversation")}
            </h2>
          </div>
          <div className="status-row">
            <span className="semantic-badge proposal">
              <WebIcon
                name={proposalStatusIcon(proposal.status)}
                size={14}
                decorative
              />{" "}
              {getStatusLabel(proposal.status, i18n)}
            </span>
            {actionLoading === "reply" ? (
              <span className="semantic-badge instruction">
                {t("trade.proposals.sending")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="message-list proposal-conversation-list proposal-timeline-list">
          <article className="message-bubble message-bubble--proposal-package proposal-timeline-event">
            <UserIdentityLink
              user={proposal.applicant}
              userId={proposal.applicantId}
              variant="compact"
              avatarSize="sm"
              statusText={
                isApplicant
                  ? t("trade.proposals.youSentProposal")
                  : t("trade.proposals.sentProposal")
              }
              showHandle={false}
              className="message-bubble__identity"
            />
            {sideItem ? (
              <ProposalSidePreview
                kind={sideItem.kind}
                item={sideItem.item}
                compact
                i18n={i18n}
              />
            ) : null}
            <p className="proposal-card__message proposal-timeline-event__note">
              {proposal.message}
            </p>
            {proposal.status !== "pending" ? (
              <p className="proposal-timeline-event__status">
                {tradeCancelled
                  ? t("trade.proposals.tradeCancelledLocked")
                  : proposal.status === "accepted"
                    ? t("trade.proposals.proposalContentLockedAccepted")
                    : proposal.status === "withdrawn"
                      ? t("trade.proposals.proposalContentLockedWithdrawn")
                      : t("trade.proposals.proposalContentLockedDeclined")}
              </p>
            ) : null}
            {tradeCancelled ? (
              <p className="proposal-timeline-event__status proposal-timeline-event__status--danger">
                {t("trade.proposals.tradeCancelledWithReason", {
                  date: formatWebDateTime(proposal.trade?.cancelledAt, "-", language),
                  reason: proposal.trade?.cancelReason ?? t("trade.proposals.noCancelReason"),
                })}
              </p>
            ) : null}
            <div className="proposal-card__actions proposal-detail-actions">
              {canActOnProposal ? (
                <button
                  type="button"
                  className="success"
                  onClick={() => void updateProposalStatus("accepted")}
                  disabled={Boolean(actionLoading)}
                >
                  {actionLoading === "accepted"
                    ? t("trade.proposals.accepting")
                    : t("trade.proposals.accept")}
                </button>
              ) : null}
              {canActOnProposal ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void updateProposalStatus("declined")}
                  disabled={Boolean(actionLoading)}
                >
                  {actionLoading === "declined"
                    ? t("trade.proposals.declining")
                    : t("trade.proposals.decline")}
                </button>
              ) : null}
              {canWithdrawProposal ? (
                <button
                  type="button"
                  className="secondary danger-text"
                  onClick={() => setWithdrawConfirmOpen(true)}
                  disabled={Boolean(actionLoading)}
                >
                  {actionLoading === "withdrawn"
                    ? t("trade.proposals.withdrawing")
                    : t("trade.proposals.withdraw")}
                </button>
              ) : null}
              {canCancelAcceptedTrade ? (
                <button
                  type="button"
                  className="secondary danger-text"
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={Boolean(actionLoading)}
                >
                  {t("trade.proposals.cancelAcceptedTrade")}
                </button>
              ) : null}
            </div>
          </article>
          {visibleMessages.length ? (
            visibleMessages.map((message) => (
              <article
                key={message.id}
                className={
                  message.senderId === actorId
                    ? "message-bubble message-bubble--own"
                    : "message-bubble"
                }
              >
                <UserIdentityLink
                  user={message.sender}
                  userId={message.senderId}
                  variant="compact"
                  avatarSize="sm"
                  statusText={messageSenderStatus(message, actorId, i18n)}
                  showHandle={false}
                  className="message-bubble__identity"
                />
                <p>{message.body}</p>
              </article>
            ))
          ) : (
            <p className="meta proposal-timeline-empty">
              {t("trade.proposals.noMessages")}
            </p>
          )}
        </div>
        {canReply ? (
          <form className="conversation-reply" onSubmit={sendReply}>
            <label className="sr-only" htmlFor="proposal-reply">
              {t("trade.proposals.reply")}
            </label>
            <textarea
              id="proposal-reply"
              value={reply}
              onChange={(event) => {
                setReply(event.target.value);
                if (replyError) setReplyError(null);
              }}
              placeholder={t("trade.proposals.replyPrivately")}
              rows={3}
              aria-describedby={replyError ? "proposal-reply-error" : undefined}
              aria-invalid={Boolean(replyError)}
            />
            <button type="submit" disabled={Boolean(actionLoading)}>
              {t("trade.proposals.send")}
            </button>
            {replyError ? (
              <p id="proposal-reply-error" className="field-error" role="alert">
                {replyError}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="meta">
            {tradeCancelled
              ? t("trade.proposals.cancelledConversationClosed")
              : t("trade.proposals.closedConversation")}
          </p>
        )}
      </section>
    </article>
  );
}
