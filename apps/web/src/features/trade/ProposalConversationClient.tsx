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

type DeleteConfirmTarget =
  | { kind: "proposal-note" }
  | { kind: "message"; messageId: string };

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


function isNeed(value: unknown): value is NeedDto {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string" && typeof value.description === "string";
}

function isOffer(value: unknown): value is OfferDto {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string" && typeof value.description === "string";
}

function normalizeNeeds(value: unknown): NeedDto[] {
  if (Array.isArray(value)) return value.filter(isNeed);
  if (isRecord(value) && Array.isArray(value.needs)) return value.needs.filter(isNeed);
  if (isRecord(value) && Array.isArray(value.items)) return value.items.filter(isNeed);
  return [];
}

function normalizeOffers(value: unknown): OfferDto[] {
  if (Array.isArray(value)) return value.filter(isOffer);
  if (isRecord(value) && Array.isArray(value.offers)) return value.offers.filter(isOffer);
  if (isRecord(value) && Array.isArray(value.items)) return value.items.filter(isOffer);
  return [];
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
      message.body === nextMessage.body &&
      message.editedAt === nextMessage.editedAt &&
      message.editCount === nextMessage.editCount &&
      message.deletedAt === nextMessage.deletedAt
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
    [item.category, formatMode(item.mode, i18n), sideTiming].filter(Boolean).join(" · ") ||
    item.itemType ||
    i18n?.t?.("trade.labels.savedItem") ||
    "Saved item"
  );
}

function formatMode(
  mode: NeedDto["mode"] | OfferDto["mode"] | null | undefined,
  i18n?: TradeI18n,
) {
  if (!mode) return "";
  if (mode === "remote" || mode === "local" || mode === "hybrid") {
    return i18n?.t?.(`trade.modes.${mode}`) ?? mode;
  }
  return String(mode);
}

function compactList(values: string[] | null | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function ProposalSideDetails({
  kind,
  item,
  i18n,
}: {
  kind: "need" | "offer";
  item: NeedDto | OfferDto;
  i18n: TradeI18n;
}) {
  const timingLabel =
    kind === "need"
      ? i18n.t("trade.labels.timing")
      : i18n.t("trade.labels.availability");
  const timingValue =
    kind === "need" ? (item as NeedDto).timing : (item as OfferDto).availability;
  const includes = kind === "offer" ? compactList((item as OfferDto).includes) : [];
  const tags = compactList(item.tags);
  const media = item.media?.filter((asset) => Boolean(asset.url)) ?? [];
  const rows = [
    { label: i18n.t("trade.labels.category"), value: item.category },
    { label: i18n.t("trade.labels.mode"), value: formatMode(item.mode, i18n) },
    { label: timingLabel, value: timingValue },
    { label: i18n.t("trade.labels.location"), value: item.locationLabel },
    { label: i18n.t("trade.labels.type"), value: item.itemType },
  ].filter((row) => Boolean(row.value));

  return (
    <div className="proposal-side-details">
      <section className="proposal-side-details__section">
        <span className="proposal-side-details__label">
          {i18n.t("trade.labels.description")}
        </span>
        <p>{item.description || i18n.t("trade.labels.noDescription")}</p>
      </section>
      {rows.length ? (
        <dl className="proposal-side-details__rows">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {includes.length ? (
        <section className="proposal-side-details__section">
          <span className="proposal-side-details__label">
            {i18n.t("trade.labels.includes")}
          </span>
          <div className="proposal-side-details__chips">
            {includes.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </section>
      ) : null}
      {tags.length ? (
        <section className="proposal-side-details__section">
          <span className="proposal-side-details__label">
            {i18n.t("trade.labels.tags")}
          </span>
          <div className="proposal-side-details__chips">
            {tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        </section>
      ) : null}
      <section className="proposal-side-details__section">
        <span className="proposal-side-details__label">
          {i18n.t("trade.labels.images")}
        </span>
        {media.length ? (
          <div className="proposal-side-details__media-grid">
            {media.map((asset) => (
              <img key={asset.id} src={asset.url} alt="" />
            ))}
          </div>
        ) : (
          <p className="proposal-side-details__empty">
            {i18n.t("trade.proposals.noProposalItemImages")}
          </p>
        )}
      </section>
    </div>
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


function proposalSideRequirement(proposal: TradeProposalDto | null) {
  const postType = proposal?.trade?.postType;
  if (postType === "open_need") return "offer" as const;
  if (postType === "open_offer") return "need" as const;
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


function formatEditTrace(count: number | undefined, date: string | null | undefined, i18n: TradeI18n) {
  if (!date) return "";
  const n = Math.max(1, count ?? 1);
  return i18n.t("trade.proposals.editedCountAt", { count: n, date: formatWebDateTime(date, "-", i18n.language) });
}

function formatDeletedTrace(date: string | null | undefined, i18n: TradeI18n) {
  if (!date) return "";
  return i18n.t("trade.proposals.messageDeletedAt", { date: formatWebDateTime(date, "-", i18n.language) });
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [editingProposal, setEditingProposal] = useState(false);
  const [proposalDraft, setProposalDraft] = useState("");
  const [proposalEditError, setProposalEditError] = useState<string | null>(null);
  const [proposalNeeds, setProposalNeeds] = useState<NeedDto[]>([]);
  const [proposalOffers, setProposalOffers] = useState<OfferDto[]>([]);
  const [proposalSideChoice, setProposalSideChoice] = useState<"none" | "need" | "offer">("none");
  const [proposalDraftNeedId, setProposalDraftNeedId] = useState("");
  const [proposalDraftOfferId, setProposalDraftOfferId] = useState("");
  const [proposalSideLoading, setProposalSideLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageEditError, setMessageEditError] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] =
    useState<DeleteConfirmTarget | null>(null);
  const [proposalDetailsOpen, setProposalDetailsOpen] = useState(false);

  const sideItem = useMemo(
    () => (proposal ? proposalSideItem(proposal) : null),
    [proposal],
  );
  const sideItemId = sideItem?.item.id ?? null;
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
  const canEditProposalContent = Boolean(
    proposal && isApplicant && proposal.status === "pending" && !tradeCancelled,
  );
  const canEditOwnPrivateMessages = Boolean(
    proposal &&
      auth.isAuthenticated &&
      proposal.status === "pending" &&
      !tradeCancelled &&
      (isOwner || isApplicant || proposal.trade?.providerId === actorId),
  );
  const requiredProposalSide = proposalSideRequirement(proposal);
  const activeProposalNeeds = useMemo(() => proposalNeeds.filter((need) => need.status === "active"), [proposalNeeds]);
  const activeProposalOffers = useMemo(() => proposalOffers.filter((offer) => offer.status === "active"), [proposalOffers]);
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
  const draftNeed = useMemo(() => activeProposalNeeds.find((need) => need.id === proposalDraftNeedId) ?? null, [activeProposalNeeds, proposalDraftNeedId]);
  const draftOffer = useMemo(() => activeProposalOffers.find((offer) => offer.id === proposalDraftOfferId) ?? null, [activeProposalOffers, proposalDraftOfferId]);

  useEffect(() => {
    setProposalDetailsOpen(false);
  }, [sideItemId]);

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
    if (canEditOwnPrivateMessages) return;
    if (editingMessageId) {
      setEditingMessageId(null);
      setMessageDraft("");
      setMessageEditError(null);
    }
    if (deleteConfirmTarget?.kind === "message") setDeleteConfirmTarget(null);
  }, [canEditOwnPrivateMessages, deleteConfirmTarget, editingMessageId]);

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


  async function loadProposalSideInventory() {
    if (!auth.isAuthenticated) return;
    setProposalSideLoading(true);
    try {
      if (requiredProposalSide === "offer") {
        const response = await api.offers.mine();
        setProposalOffers(normalizeOffers(response));
        setProposalNeeds([]);
      } else if (requiredProposalSide === "need") {
        const response = await api.needs.mine();
        setProposalNeeds(normalizeNeeds(response));
        setProposalOffers([]);
      } else {
        const [needsResponse, offersResponse] = await Promise.all([api.needs.mine(), api.offers.mine()]);
        setProposalNeeds(normalizeNeeds(needsResponse));
        setProposalOffers(normalizeOffers(offersResponse));
      }
    } catch {
      setProposalEditError(t("trade.errors.couldNotLoadInventory"));
    } finally {
      setProposalSideLoading(false);
    }
  }

  function startProposalEdit() {
    if (!proposal) return;
    setProposalDraft(proposal.messageDeletedAt ? "" : proposal.message);
    setProposalDraftNeedId(proposal.proposedNeedId ?? "");
    setProposalDraftOfferId(proposal.proposedOfferId ?? "");
    setProposalSideChoice(proposal.proposedNeedId ? "need" : proposal.proposedOfferId ? "offer" : "none");
    setProposalEditError(null);
    setProposalDetailsOpen(false);
    setEditingProposal(true);
    void loadProposalSideInventory();
  }

  async function saveProposalEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proposal) return;
    const message = proposalDraft.trim();
    setProposalEditError(null);
    if (message && message.length < 3) {
      setProposalEditError(t("trade.proposals.messageTooShort"));
      return;
    }
    if (requiredProposalSide === "offer" && !proposalDraftOfferId) {
      setProposalEditError(t("trade.proposals.chooseOfferBeforeSending"));
      return;
    }
    if (requiredProposalSide === "need" && !proposalDraftNeedId) {
      setProposalEditError(t("trade.proposals.chooseNeedBeforeSending"));
      return;
    }
    if (!requiredProposalSide && proposalSideChoice === "need" && !proposalDraftNeedId) {
      setProposalEditError(t("trade.proposals.chooseNeedBeforeSending"));
      return;
    }
    if (!requiredProposalSide && proposalSideChoice === "offer" && !proposalDraftOfferId) {
      setProposalEditError(t("trade.proposals.chooseOfferBeforeSending"));
      return;
    }

    setActionLoading("proposal-edit");
    try {
      const payload: { message?: string; proposedNeedId?: string | null; proposedOfferId?: string | null } = {};
      if (message) payload.message = message;
      if (requiredProposalSide === "offer") {
        payload.proposedOfferId = proposalDraftOfferId;
        payload.proposedNeedId = null;
      } else if (requiredProposalSide === "need") {
        payload.proposedNeedId = proposalDraftNeedId;
        payload.proposedOfferId = null;
      } else if (proposalSideChoice === "need") {
        payload.proposedNeedId = proposalDraftNeedId;
        payload.proposedOfferId = null;
      } else if (proposalSideChoice === "offer") {
        payload.proposedOfferId = proposalDraftOfferId;
        payload.proposedNeedId = null;
      } else {
        payload.proposedNeedId = null;
        payload.proposedOfferId = null;
      }
      const response = await api.proposals.updateMessage(proposal.id, payload);
      const updated = normalizeProposal(response);
      if (!updated) throw new Error("missing_proposal_response");
      setProposal(updated);
      setEditingProposal(false);
      setProposalEditError(null);
      setNotice(t("trade.proposals.proposalUpdated"));
      await loadMessages({ quiet: true });
    } catch {
      setProposalEditError(t("trade.proposals.couldNotUpdateProposal"));
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteProposalNote() {
    if (!proposal) return;
    setActionLoading("proposal-delete");
    setNotice(null);
    try {
      const response = await api.proposals.deleteMessage(proposal.id);
      const updated = normalizeProposal(response);
      if (!updated) throw new Error("missing_proposal_response");
      setProposal(updated);
      setDeleteConfirmTarget(null);
      setNotice(t("trade.proposals.proposalNoteDeleted"));
      await loadMessages({ quiet: true });
    } catch {
      setNotice(t("trade.proposals.couldNotUpdateProposal"));
    } finally {
      setActionLoading(null);
    }
  }

  function startMessageEdit(message: ProposalMessageDto) {
    setEditingMessageId(message.id);
    setMessageDraft(message.body);
    setMessageEditError(null);
  }

  async function saveMessageEdit(event: FormEvent<HTMLFormElement>, messageId: string) {
    event.preventDefault();
    if (!proposal) return;
    const body = messageDraft.trim();
    setMessageEditError(null);
    if (!body) {
      setMessageEditError(t("trade.proposals.messageEditRequired"));
      return;
    }
    setActionLoading("message-edit");
    try {
      const response = await api.proposals.updatePrivateMessage(proposal.id, messageId, { body });
      const { message: updatedMessage, proposal: updatedProposal } = normalizeProposalMessageResponse(response);
      if (!updatedMessage) throw new Error("missing_message_response");
      setMessages((current) => current.map((item) => item.id === updatedMessage.id ? updatedMessage : item));
      if (updatedProposal) setProposal(updatedProposal);
      setEditingMessageId(null);
      setMessageDraft("");
      setMessageEditError(null);
    } catch {
      setMessageEditError(t("trade.proposals.couldNotUpdateMessage"));
    } finally {
      setActionLoading(null);
    }
  }

  async function deletePrivateMessage(messageId: string) {
    if (!proposal) return;
    setActionLoading("message-delete");
    try {
      const response = await api.proposals.deletePrivateMessage(proposal.id, messageId);
      const { message: updatedMessage, proposal: updatedProposal } = normalizeProposalMessageResponse(response);
      if (!updatedMessage) throw new Error("missing_message_response");
      setMessages((current) => current.map((item) => item.id === updatedMessage.id ? updatedMessage : item));
      if (updatedProposal) setProposal(updatedProposal);
      setDeleteConfirmTarget(null);
    } catch {
      setNotice(t("trade.proposals.couldNotUpdateMessage"));
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

      {deleteConfirmTarget ? (
        <div
          className="proposal-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-proposal-content-title"
        >
          <div className="proposal-confirm-modal__panel">
            <span className="semantic-badge danger">
              <WebIcon name="warning" size={14} decorative /> {deleteConfirmTarget.kind === "message" ? t("trade.proposals.deleteMessage") : t("trade.proposals.deleteProposalNote")}
            </span>
            <h2 id="delete-proposal-content-title">
              {deleteConfirmTarget.kind === "message"
                ? t("trade.proposals.deleteMessageTitle")
                : t("trade.proposals.deleteProposalNoteTitle")}
            </h2>
            <p>
              {deleteConfirmTarget.kind === "message"
                ? t("trade.proposals.deleteMessageBody")
                : t("trade.proposals.deleteProposalNoteBody")}
            </p>
            <div className="proposal-confirm-modal__actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={Boolean(actionLoading)}
              >
                {deleteConfirmTarget.kind === "message"
                  ? t("trade.proposals.keepMessage")
                  : t("trade.proposals.keepProposalNote")}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (deleteConfirmTarget.kind === "message") {
                    void deletePrivateMessage(deleteConfirmTarget.messageId);
                    return;
                  }
                  void deleteProposalNote();
                }}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "message-delete" || actionLoading === "proposal-delete"
                  ? t("common.states.working")
                  : deleteConfirmTarget.kind === "message"
                    ? t("trade.proposals.deleteMessageAction")
                    : t("trade.proposals.deleteProposalNoteAction")}
              </button>
            </div>
          </div>
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
            {editingProposal ? (
              <form className="proposal-edit-form" onSubmit={saveProposalEdit}>
                <div className="proposal-edit-form__side">
                  <span className="proposal-package-section__label">{t("trade.proposals.changeProposalItem")}</span>
                  {requiredProposalSide === "offer" ? (
                    <label className="field-label">
                      {t("trade.labels.proposedOffer")}
                      <select value={proposalDraftOfferId} onChange={(event) => setProposalDraftOfferId(event.target.value)} disabled={proposalSideLoading}>
                        <option value="">{t("trade.proposals.chooseOfferToPropose")}</option>
                        {activeProposalOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.title}</option>)}
                      </select>
                    </label>
                  ) : requiredProposalSide === "need" ? (
                    <label className="field-label">
                      {t("trade.labels.proposedNeed")}
                      <select value={proposalDraftNeedId} onChange={(event) => setProposalDraftNeedId(event.target.value)} disabled={proposalSideLoading}>
                        <option value="">{t("trade.proposals.chooseNeedToPropose")}</option>
                        {activeProposalNeeds.map((need) => <option key={need.id} value={need.id}>{need.title}</option>)}
                      </select>
                    </label>
                  ) : (
                    <div className="proposal-edit-form__optional-side">
                      <div className="proposal-edit-form__choice-row">
                        <button type="button" className={proposalSideChoice === "none" ? "secondary is-active" : "secondary"} onClick={() => setProposalSideChoice("none")}>{t("trade.proposals.noAttachedItem")}</button>
                        <button type="button" className={proposalSideChoice === "need" ? "secondary is-active" : "secondary"} onClick={() => setProposalSideChoice("need")}>{t("trade.labels.proposedNeed")}</button>
                        <button type="button" className={proposalSideChoice === "offer" ? "secondary is-active" : "secondary"} onClick={() => setProposalSideChoice("offer")}>{t("trade.labels.proposedOffer")}</button>
                      </div>
                      {proposalSideChoice === "need" ? (
                        <label className="field-label">
                          {t("trade.labels.proposedNeed")}
                          <select value={proposalDraftNeedId} onChange={(event) => setProposalDraftNeedId(event.target.value)} disabled={proposalSideLoading}>
                            <option value="">{t("trade.proposals.chooseNeedToPropose")}</option>
                            {activeProposalNeeds.map((need) => <option key={need.id} value={need.id}>{need.title}</option>)}
                          </select>
                        </label>
                      ) : null}
                      {proposalSideChoice === "offer" ? (
                        <label className="field-label">
                          {t("trade.labels.proposedOffer")}
                          <select value={proposalDraftOfferId} onChange={(event) => setProposalDraftOfferId(event.target.value)} disabled={proposalSideLoading}>
                            <option value="">{t("trade.proposals.chooseOfferToPropose")}</option>
                            {activeProposalOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.title}</option>)}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  )}
                  {requiredProposalSide === "need" && draftNeed ? <ProposalSidePreview kind="need" item={draftNeed} compact i18n={i18n} /> : null}
                  {requiredProposalSide === "offer" && draftOffer ? <ProposalSidePreview kind="offer" item={draftOffer} compact i18n={i18n} /> : null}
                  {!requiredProposalSide && proposalSideChoice === "need" && draftNeed ? <ProposalSidePreview kind="need" item={draftNeed} compact i18n={i18n} /> : null}
                  {!requiredProposalSide && proposalSideChoice === "offer" && draftOffer ? <ProposalSidePreview kind="offer" item={draftOffer} compact i18n={i18n} /> : null}
                </div>
                <label className="field-label">
                  {t("trade.labels.proposalMessage")}
                  <textarea
                    value={proposalDraft}
                    onChange={(event) => {
                      setProposalDraft(event.target.value);
                      if (proposalEditError) setProposalEditError(null);
                    }}
                    placeholder={t("trade.proposals.writeMessage")}
                    rows={3}
                  />
                </label>
                {proposalEditError ? <p className="field-error" role="alert">{proposalEditError}</p> : null}
                <div className="proposal-edit-form__actions">
                  <button type="submit" disabled={Boolean(actionLoading) || proposalSideLoading}>{t("trade.proposals.saveProposal")}</button>
                  <button type="button" className="secondary" onClick={() => { setEditingProposal(false); setProposalEditError(null); }} disabled={Boolean(actionLoading)}>{t("common.actions.cancel")}</button>
                </div>
              </form>
            ) : (
              <>
                {sideItem ? (
                  <div className="proposal-side-review">
                    <ProposalSidePreview
                      kind={sideItem.kind}
                      item={sideItem.item}
                      compact
                      i18n={i18n}
                    />
                    <button
                      type="button"
                      className="proposal-side-details-toggle"
                      onClick={() => setProposalDetailsOpen((open) => !open)}
                    >
                      {proposalDetailsOpen
                        ? t("trade.proposals.hideProposalItemDetails")
                        : t("trade.proposals.showProposalItemDetails")}
                    </button>
                    {proposalDetailsOpen ? (
                      <ProposalSideDetails
                        kind={sideItem.kind}
                        item={sideItem.item}
                        i18n={i18n}
                      />
                    ) : null}
                  </div>
                ) : null}
                {proposal.messageDeletedAt ? (
                  <p className="proposal-card__message proposal-timeline-event__note proposal-message-deleted">
                    {t("trade.proposals.proposalNoteDeleted")}
                  </p>
                ) : proposal.message ? (
                  <p className="proposal-card__message proposal-timeline-event__note">
                    {proposal.message}
                  </p>
                ) : null}
                {proposal.messageDeletedAt ? <p className="message-meta">{formatDeletedTrace(proposal.messageDeletedAt, i18n)}</p> : proposal.messageEditedAt ? <p className="message-meta">{formatEditTrace(proposal.messageEditCount, proposal.messageEditedAt, i18n)}</p> : null}
              </>
            )}
            {canEditProposalContent && !editingProposal ? (
              <div className="message-actions message-actions--proposal">
                <button type="button" className="secondary" onClick={startProposalEdit} disabled={Boolean(actionLoading)}>{proposal.messageDeletedAt ? t("trade.proposals.addProposalNote") : t("trade.proposals.editProposal")}</button>
                {!proposal.messageDeletedAt ? <button type="button" className="secondary danger-text" onClick={() => setDeleteConfirmTarget({ kind: "proposal-note" })} disabled={Boolean(actionLoading)}>{t("trade.proposals.deleteProposalNote")}</button> : null}
              </div>
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
                {editingMessageId === message.id ? (
                  <form className="message-edit-form" onSubmit={(event) => void saveMessageEdit(event, message.id)}>
                    <textarea
                      value={messageDraft}
                      onChange={(event) => {
                        setMessageDraft(event.target.value);
                        if (messageEditError) setMessageEditError(null);
                      }}
                      rows={3}
                      autoFocus
                    />
                    {messageEditError ? <p className="field-error" role="alert">{messageEditError}</p> : null}
                    <div className="message-actions">
                      <button type="submit" disabled={Boolean(actionLoading)}>{t("trade.proposals.saveMessage")}</button>
                      <button type="button" className="secondary" onClick={() => { setEditingMessageId(null); setMessageDraft(""); setMessageEditError(null); }} disabled={Boolean(actionLoading)}>{t("common.actions.cancel")}</button>
                    </div>
                  </form>
                ) : message.deletedAt ? (
                  <>
                    <p className="message-deleted">{t("trade.proposals.messageDeleted")}</p>
                    <p className="message-meta">{formatDeletedTrace(message.deletedAt, i18n)}</p>
                  </>
                ) : (
                  <>
                    <p>{message.body}</p>
                    {message.editedAt ? <p className="message-meta">{formatEditTrace(message.editCount, message.editedAt, i18n)}</p> : null}
                    {message.senderId === actorId && canEditOwnPrivateMessages ? (
                      <div className="message-actions">
                        <button type="button" className="secondary" onClick={() => startMessageEdit(message)} disabled={Boolean(actionLoading)}>{t("trade.proposals.editMessage")}</button>
                        <button type="button" className="secondary danger-text" onClick={() => setDeleteConfirmTarget({ kind: "message", messageId: message.id })} disabled={Boolean(actionLoading)}>{t("trade.proposals.deleteMessage")}</button>
                      </div>
                    ) : null}
                  </>
                )}
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
