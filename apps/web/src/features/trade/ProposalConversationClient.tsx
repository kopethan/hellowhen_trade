"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import type {
  AcceptedDealSnapshotItemDto,
  NeedDto,
  OfferDto,
  ProposalMessageDto,
  TradeActionStatus,
  TradeDto,
  TradeProposalDto,
} from "@hellowhen/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { WebIcon, type WebIconName } from "../../components/WebIcon";
import { api } from "../../lib/api";
import { formatWebDateTime, formatWebMoney } from "../../lib/webFormat";
import { useWebAuth } from "../../providers/WebAuthProvider";
import { useWebTranslation } from "../../providers/WebI18nProvider";
import { UserIdentityLink } from "../users/UserIdentityLink";
import { getStatusLabel, type TradeI18n } from "./tradePresentation";

const PROPOSAL_REFRESH_INTERVAL_MS = 6000;
const MESSAGE_REFRESH_INTERVAL_MS = 3000;

type ProposalStatusResponse = { proposal?: TradeProposalDto; trade?: TradeDto };
type TradeStatusResponse = { trade?: TradeDto };
type DealProblemReportResponse = { proposal?: TradeProposalDto; trade?: TradeDto; duplicate?: boolean };
type ProposalMessageResponse = {
  message?: ProposalMessageDto;
  proposal?: TradeProposalDto;
};

type DeleteConfirmTarget =
  | { kind: "proposal-note" }
  | { kind: "message"; messageId: string };

type ProposalEditDraftSnapshot = {
  message?: string;
  needId?: string;
  offerId?: string;
  sideChoice?: "none" | "need" | "offer" | "both";
};

function proposalEditDraftKey(proposalId: string) {
  return `proposal-edit-draft:${proposalId}`;
}

function readProposalEditDraft(proposalId: string): ProposalEditDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(proposalEditDraftKey(proposalId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProposalEditDraftSnapshot;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeProposalEditDraft(proposalId: string, draft: ProposalEditDraftSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(proposalEditDraftKey(proposalId), JSON.stringify(draft));
  } catch {
    // Ignore storage failures; the picker will still work with the saved proposal.
  }
}

function clearProposalEditDraft(proposalId: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(proposalEditDraftKey(proposalId));
  } catch {
    // Ignore storage failures.
  }
}

function proposalEditChooseHref(
  side: "need" | "offer",
  tradeId: string,
  proposalId: string,
  currentNeedId?: string,
  currentOfferId?: string,
) {
  const params = new URLSearchParams();
  if (currentNeedId) params.set("proposalNeedId", currentNeedId);
  if (currentOfferId) params.set("proposalOfferId", currentOfferId);
  const query = params.toString();
  return `/trades/${tradeId}/proposals/${proposalId}/choose-${side}${query ? `?${query}` : ""}`;
}

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

function tr(i18n: TradeI18n, key: string, fallback: string, values?: Parameters<NonNullable<TradeI18n["t"]>>[1]) {
  const translated = i18n.t?.(key, values);
  return translated && translated !== key ? translated : fallback;
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
      ? tr(i18n, "trade.labels.timing", "Timing")
      : tr(i18n, "trade.labels.availability", "Availability");
  const timingValue =
    kind === "need" ? (item as NeedDto).timing : (item as OfferDto).availability;
  const includes = kind === "offer" ? compactList((item as OfferDto).includes) : [];
  const tags = compactList(item.tags);
  const media = item.media?.filter((asset) => Boolean(asset.url)) ?? [];
  const rows = [
    { label: tr(i18n, "trade.labels.category", "Category"), value: item.category },
    { label: tr(i18n, "trade.labels.mode", "Mode"), value: formatMode(item.mode, i18n) },
    { label: timingLabel, value: timingValue },
    { label: tr(i18n, "trade.labels.location", "Location"), value: item.locationLabel },
    { label: tr(i18n, "trade.labels.type", "Type"), value: item.itemType },
  ].filter((row) => Boolean(row.value));

  return (
    <div className="proposal-side-details">
      <section className="proposal-side-details__section">
        <span className="proposal-side-details__label">
          {tr(i18n, "trade.labels.description", "Description")}
        </span>
        <p>{item.description || tr(i18n, "trade.labels.noDescription", "No description yet.")}</p>
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
            {tr(i18n, "trade.labels.includes", "Includes")}
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
            {tr(i18n, "trade.labels.tags", "Tags")}
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
          {tr(i18n, "trade.labels.images", "Images")}
        </span>
        {media.length ? (
          <div className="proposal-side-details__media-grid">
            {media.map((asset) => (
              <img key={asset.id} src={asset.url} alt="" />
            ))}
          </div>
        ) : (
          <p className="proposal-side-details__empty">
            {tr(i18n, "trade.proposals.noProposalItemImages", "No images attached.")}
          </p>
        )}
      </section>
    </div>
  );
}

function proposalSideItems(
  proposal: TradeProposalDto,
): Array<{ kind: "need"; item: NeedDto } | { kind: "offer"; item: OfferDto }> {
  const items: Array<{ kind: "need"; item: NeedDto } | { kind: "offer"; item: OfferDto }> = [];
  if (proposal.proposedOffer) items.push({ kind: "offer", item: proposal.proposedOffer });
  if (proposal.proposedNeed) items.push({ kind: "need", item: proposal.proposedNeed });
  return items;
}


type DealInventoryItem = NeedDto | OfferDto;
type DealAgreementItem = DealInventoryItem | AcceptedDealSnapshotItemDto;

type DealStepState = "done" | "current" | "pending";

function uniqueDealItems<T extends DealInventoryItem>(items: Array<T | null | undefined>) {
  const seen = new Set<string>();
  return items.filter((item): item is T => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function isAcceptedDealSnapshotItem(item: DealAgreementItem): item is AcceptedDealSnapshotItemDto {
  return "kind" in item && (item.kind === "need" || item.kind === "offer" || item.kind === "cash_promise");
}

function liveCashPromiseItem(proposal: TradeProposalDto, ownerId: string | null): AcceptedDealSnapshotItemDto | null {
  const cashPromise = proposal.cashPromise;
  if (!cashPromise) return null;
  const giverId = cashPromise.side === "offer" ? proposal.applicantId : ownerId;
  if (!giverId) return null;
  return {
    kind: "cash_promise",
    id: cashPromise.id,
    ownerId: giverId,
    title: "Cash promise",
    description: cashPromise.note ?? "",
    itemType: "other",
    category: "Cash promise",
    mode: null,
    locationLabel: null,
    tags: [],
    status: "accepted",
    source: "proposal",
    side: cashPromise.side,
    amountCents: cashPromise.amountCents,
    currency: cashPromise.currency ?? "eur",
    note: cashPromise.note ?? null,
    acknowledgementText: cashPromise.acknowledgementText,
    snapshottedAt: cashPromise.createdAt,
  };
}

function dealAgreementMeta(item: DealAgreementItem, fallbackKind: "need" | "offer", i18n: TradeI18n) {
  if (isAcceptedDealSnapshotItem(item)) {
    if (item.kind === "cash_promise") {
      return [formatWebMoney(item.amountCents ?? 0, item.currency ?? "eur", i18n.language), tr(i18n, "trade.cashPromise.notProcessed", "Not processed by Hellowhen")].filter(Boolean).join(" · ");
    }
    const mode = formatMode(item.mode, i18n);
    if (item.kind === "need") {
      return [item.category, mode, item.timing, item.locationLabel].filter(Boolean).join(" · ") || item.itemType || tr(i18n, "trade.labels.needDetails", "Need details");
    }
    return [item.category, item.includes?.[0], mode, item.availability, item.locationLabel].filter(Boolean).join(" · ") || item.itemType || tr(i18n, "trade.labels.offerDetails", "Offer details");
  }
  return sideMeta(item, i18n);
}

function acceptedDealAgreement(proposal: TradeProposalDto) {
  const snapshot = proposal.acceptedDealSnapshot;
  if (snapshot) {
    return {
      ownerGives: snapshot.ownerGivesJson ?? [],
      ownerReceives: snapshot.ownerReceivesJson ?? [],
      applicantGives: snapshot.applicantGivesJson ?? [],
      applicantReceives: snapshot.applicantReceivesJson ?? [],
      acceptedMessage: snapshot.acceptedMessage ?? null,
      fromSnapshot: true,
    };
  }

  const ownerId = proposal.trade?.ownerId ?? null;
  const applicantId = proposal.applicantId;
  const needs = uniqueDealItems([proposal.trade?.need, proposal.proposedNeed]);
  const offers = uniqueDealItems([proposal.trade?.offer, proposal.proposedOffer]);
  const cashPromise = liveCashPromiseItem(proposal, ownerId);
  const ownerGivesCash = cashPromise && cashPromise.ownerId === ownerId ? [cashPromise] : [];
  const applicantGivesCash = cashPromise && cashPromise.ownerId === applicantId ? [cashPromise] : [];

  return {
    ownerGives: [...offers.filter((offer) => offer.ownerId === ownerId), ...ownerGivesCash],
    ownerReceives: [...needs.filter((need) => need.ownerId === ownerId), ...applicantGivesCash],
    applicantGives: [...offers.filter((offer) => offer.ownerId === applicantId), ...applicantGivesCash],
    applicantReceives: [...needs.filter((need) => need.ownerId === applicantId), ...ownerGivesCash],
    acceptedMessage: proposal.messageDeletedAt ? null : proposal.message,
    fromSnapshot: false,
  };
}

function dealStepState(tradeStatus: TradeDto["status"] | null | undefined, step: "accepted" | "in_progress" | "submitted" | "completed"): DealStepState {
  if (tradeStatus === "cancelled" || tradeStatus === "disputed") return step === "accepted" ? "done" : "pending";
  const stepIndex = { accepted: 0, in_progress: 1, submitted: 2, completed: 3 }[step];
  const statusIndex = tradeStatus === "completed" ? 3 : tradeStatus === "submitted" ? 2 : tradeStatus === "in_progress" ? 1 : 0;
  if (stepIndex < statusIndex) return "done";
  if (stepIndex === statusIndex) return "current";
  return "pending";
}

function DealAgreementBucket({ label, items, kind, i18n }: { label: string; items: DealAgreementItem[]; kind: "need" | "offer"; i18n: TradeI18n }) {
  return (
    <div className={`deal-agreement-bucket deal-agreement-bucket--${kind}`}>
      <span className="deal-agreement-bucket__label">{label}</span>
      {items.length ? (
        items.map((item) => (
          <div key={`${isAcceptedDealSnapshotItem(item) ? item.kind : kind}-${item.id}`} className="deal-agreement-bucket__item">
            <strong>{isAcceptedDealSnapshotItem(item) && item.kind === "cash_promise" ? tr(i18n, "trade.cashPromise.title", "Cash promise") : item.title}</strong>
            <p>{dealAgreementMeta(item, kind, i18n)}</p>
          </div>
        ))
      ) : (
        <p className="deal-agreement-bucket__empty">{tr(i18n, "trade.deal.notSet", "Not set in this proposal")}</p>
      )}
    </div>
  );
}

function DealProgressStep({ label, index, state }: { label: string; index: number; state: DealStepState }) {
  return (
    <li className={`deal-progress-step deal-progress-step--${state}`}>
      <span>{state === "done" ? "✓" : index}</span>
      <strong>{label}</strong>
    </li>
  );
}

function getDealRoleGuard(status: TradeDto["status"] | null | undefined, canMarkSubmitted: boolean, canConfirmCompleted: boolean, submittedByYou: boolean, i18n: TradeI18n) {
  if (status === "in_progress") {
    return canMarkSubmitted
      ? { label: tr(i18n, "trade.deal.yourNextStep", "Your next step"), title: tr(i18n, "trade.deal.submitterNextStepTitle", "Submit only when your side is ready"), body: tr(i18n, "trade.deal.submitterNextStepBody", "Use Mark submitted after you have delivered what you agreed in this chat."), tone: "proposal" }
      : { label: tr(i18n, "trade.deal.waitingStep", "Waiting"), title: tr(i18n, "trade.deal.waitingSubmitterTitle", "Waiting for submission"), body: tr(i18n, "trade.deal.waitingSubmitterBody", "Keep details in chat while the delivering participant prepares their side."), tone: "muted" };
  }
  if (status === "submitted") {
    return canConfirmCompleted
      ? { label: tr(i18n, "trade.deal.yourNextStep", "Your next step"), title: tr(i18n, "trade.deal.reviewerNextStepTitle", "Review before confirming"), body: tr(i18n, "trade.deal.reviewerNextStepBody", "Confirm completed only after reviewing the submitted work and checking the agreement."), tone: "proposal" }
      : submittedByYou
        ? { label: tr(i18n, "trade.deal.guardBlocked", "Guard"), title: tr(i18n, "trade.deal.submitterCannotConfirmTitle", "You cannot confirm your own submission"), body: tr(i18n, "trade.deal.submitterCannotConfirmBody", "The other participant must review and confirm completion."), tone: "warning" }
        : { label: tr(i18n, "trade.deal.waitingStep", "Waiting"), title: tr(i18n, "trade.deal.waitingReviewerTitle", "Waiting for confirmation"), body: tr(i18n, "trade.deal.waitingReviewerBody", "The reviewing participant should confirm only when everything is okay."), tone: "muted" };
  }
  if (status === "completed") {
    return { label: tr(i18n, "trade.deal.closedStep", "Closed"), title: tr(i18n, "trade.deal.completedClosedTitle", "Deal completed"), body: tr(i18n, "trade.deal.completedClosedBody", "This deal is closed. Keep the conversation available for reference."), tone: "success" };
  }
  return null;
}

function AcceptedDealWorkspace({ proposal, canMarkSubmitted, canConfirmCompleted, canReportProblem, canCancelAcceptedTrade, actionLoading, actorId, onMarkSubmitted, onConfirmCompleted, onReportProblem, onOpenCancel, i18n }: { proposal: TradeProposalDto; canMarkSubmitted: boolean; canConfirmCompleted: boolean; canReportProblem: boolean; canCancelAcceptedTrade: boolean; actionLoading: string | null; actorId: string | null; onMarkSubmitted: () => void; onConfirmCompleted: () => void; onReportProblem: () => void; onOpenCancel: () => void; i18n: TradeI18n }) {
  const trade = proposal.trade;
  const status = trade?.status ?? "in_progress";
  const agreement = acceptedDealAgreement(proposal);
  const stateBody = status === "submitted"
    ? tr(i18n, "trade.deal.submittedStateBody", "Submitted. The other participant should confirm completion only after reviewing the work.")
    : status === "completed"
      ? tr(i18n, "trade.deal.completedStateBody", "Completed. This deal is closed.")
      : status === "disputed"
        ? tr(i18n, "trade.deal.disputedStateBody", "Problem reported. Keep evidence and important details in this chat.")
        : status === "cancelled"
          ? tr(i18n, "trade.deal.cancelledStateBody", "Cancelled. This deal is closed.")
          : tr(i18n, "trade.deal.inProgressStateBody", "In progress. Keep scope, timing, and delivery details clear in this private chat.");
  const safetyItems = [
    tr(i18n, "trade.deal.safetyKeepChat", "Keep agreement details in this chat."),
    tr(i18n, "trade.deal.safetyConfirmScope", "Confirm scope, timing, and delivery format."),
    tr(i18n, "trade.deal.safetyNoSensitive", "Do not send passwords, card details, or sensitive documents."),
    tr(i18n, "trade.deal.safetyReportSuspicious", "Report suspicious behavior before completion."),
  ];
  const submittedByYou = Boolean(actorId && trade?.deliverySubmittedById === actorId);
  const roleGuard = getDealRoleGuard(status, canMarkSubmitted, canConfirmCompleted, submittedByYou, i18n);

  return (
    <section className="accepted-deal-workspace" aria-label={tr(i18n, "trade.deal.title", "Deal")}>
      <div className="accepted-deal-workspace__header">
        <span className="semantic-badge proposal"><WebIcon name="proposal-accepted" size={14} decorative /> {tr(i18n, "trade.deal.acceptedDeal", "Accepted deal")}</span>
        <span className="semantic-badge trade">{getStatusLabel(status, i18n)}</span>
        <h2>{trade?.title ?? tr(i18n, "trade.deal.title", "Deal")}</h2>
        <p>{tr(i18n, "trade.deal.privateBody", "This deal workspace is private to the accepted participants.")}</p>
      </div>

      <div className="deal-panel">
        <div className="deal-panel__heading">
          <span>{tr(i18n, "trade.deal.agreementTitle", "Accepted agreement")}</span>
          <p>{tr(i18n, "trade.deal.agreementBody", "Review what each participant agreed to give and receive.")}</p>
        </div>
        {agreement.fromSnapshot ? <p className="notice-box info"><strong>{tr(i18n, "trade.deal.snapshotTitle", "Snapshot saved")}</strong><br />{tr(i18n, "trade.deal.snapshotBody", "This agreement is frozen from the moment the proposal was accepted, so later Need or Offer edits do not change the deal.")}</p> : null}
        {agreement.acceptedMessage ? <div className="deal-accepted-message"><span>{tr(i18n, "trade.deal.acceptedMessage", "Accepted proposal message")}</span><p>{agreement.acceptedMessage}</p></div> : null}
        <div className="deal-agreement-grid">
          <DealAgreementBucket label={tr(i18n, "trade.deal.ownerGives", "Owner gives")} items={agreement.ownerGives} kind="offer" i18n={i18n} />
          <DealAgreementBucket label={tr(i18n, "trade.deal.ownerReceives", "Owner receives")} items={agreement.ownerReceives} kind="need" i18n={i18n} />
          <DealAgreementBucket label={tr(i18n, "trade.deal.applicantGives", "Applicant gives")} items={agreement.applicantGives} kind="offer" i18n={i18n} />
          <DealAgreementBucket label={tr(i18n, "trade.deal.applicantReceives", "Applicant receives")} items={agreement.applicantReceives} kind="need" i18n={i18n} />
        </div>
      </div>

      <div className="deal-panel">
        <div className="deal-panel__heading">
          <span>{tr(i18n, "trade.deal.safetyTitle", "Safety checklist")}</span>
        </div>
        <ul className="deal-safety-list">
          {safetyItems.map((item) => <li key={item}><span>✓</span>{item}</li>)}
        </ul>
      </div>

      <div className="deal-panel">
        <div className="deal-panel__heading">
          <span>{tr(i18n, "trade.deal.progressTitle", "Progress")}</span>
          <p>{stateBody}</p>
        </div>
        <ol className="deal-progress-list">
          <DealProgressStep label={tr(i18n, "trade.deal.stepAccepted", "Accepted")} index={1} state={dealStepState(status, "accepted")} />
          <DealProgressStep label={tr(i18n, "trade.deal.stepInProgress", "In progress")} index={2} state={dealStepState(status, "in_progress")} />
          <DealProgressStep label={tr(i18n, "trade.deal.stepSubmitted", "Submitted")} index={3} state={dealStepState(status, "submitted")} />
          <DealProgressStep label={tr(i18n, "trade.deal.stepCompleted", "Completed")} index={4} state={dealStepState(status, "completed")} />
        </ol>
        {status === "disputed" ? <p className="notice-box warning">{tr(i18n, "trade.deal.disputedStateBody", "Problem reported. Keep evidence and important details in this chat.")}</p> : null}
        {status === "cancelled" ? <p className="notice-box warning">{trade?.cancelReason ? tr(i18n, "trade.deal.cancelledWithReason", "Cancelled reason: {{reason}}", { reason: trade.cancelReason }) : tr(i18n, "trade.deal.cancelledStateBody", "Cancelled. This deal is closed.")}</p> : null}
      </div>

      {roleGuard ? (
        <div className="deal-panel deal-role-guard">
          <span className={`semantic-badge ${roleGuard.tone}`}>{roleGuard.label}</span>
          <strong>{roleGuard.title}</strong>
          <p>{roleGuard.body}</p>
        </div>
      ) : null}

      <div className="deal-panel deal-panel--actions">
        <div className="deal-panel__heading">
          <span>{tr(i18n, "trade.deal.safeActionsTitle", "Safe actions")}</span>
          <p>{tr(i18n, "trade.deal.safeActionsBody", "Actions are shown only when your role and the current status allow them.")}</p>
        </div>
        <div className="proposal-card__actions proposal-detail-actions">
          {canMarkSubmitted ? <button type="button" onClick={onMarkSubmitted} disabled={Boolean(actionLoading)}>{actionLoading === "submitted" ? tr(i18n, "common.states.working", "Working…") : tr(i18n, "trade.detail.markDelivered", "Mark delivered")}</button> : null}
          {canConfirmCompleted ? <button type="button" onClick={onConfirmCompleted} disabled={Boolean(actionLoading)}>{actionLoading === "completed" ? tr(i18n, "common.states.working", "Working…") : tr(i18n, "trade.detail.confirmCompleted", "Confirm completed")}</button> : null}
          {canReportProblem ? <button type="button" className="secondary danger-text" onClick={onReportProblem} disabled={Boolean(actionLoading)}>{actionLoading === "deal-report" ? tr(i18n, "common.states.working", "Working…") : tr(i18n, "trade.detail.reportProblem", "Report problem")}</button> : null}
          {canCancelAcceptedTrade ? <button type="button" className="secondary danger-text" onClick={onOpenCancel} disabled={Boolean(actionLoading)}>{tr(i18n, "trade.proposals.cancelAcceptedTrade", "Cancel accepted trade")}</button> : null}
        </div>
      </div>
    </section>
  );
}


function proposalSideRequirement(proposal: TradeProposalDto | null) {
  const postType = proposal?.trade?.postType;
  if (postType === "open_need") return "offer" as const;
  if (postType === "open_offer") return "need" as const;
  return null;
}

function proposalApplicantStatus(proposal: TradeProposalDto, i18n?: TradeI18n) {
  if (proposal.proposedNeed && proposal.proposedOffer)
    return i18n?.t?.("trade.proposals.needOfferProposal") ?? "Need + Offer proposal";
  if (proposal.proposedOffer)
    return i18n?.t?.("trade.proposals.offerProposal") ?? "Offer proposal";
  if (proposal.proposedNeed)
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
  return tr(i18n, "trade.proposals.editedCountAt", `Edited ${n} time${n === 1 ? "" : "s"} · ${formatWebDateTime(date, "-", i18n.language)}`, { count: n, date: formatWebDateTime(date, "-", i18n.language) });
}

function formatDeletedTrace(date: string | null | undefined, i18n: TradeI18n) {
  if (!date) return "";
  return tr(i18n, "trade.proposals.messageDeletedAt", `Deleted · ${formatWebDateTime(date, "-", i18n.language)}`, { date: formatWebDateTime(date, "-", i18n.language) });
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
        <strong>{isAcceptedDealSnapshotItem(item) && item.kind === "cash_promise" ? tr(i18n, "trade.cashPromise.title", "Cash promise") : item.title}</strong>
        <p>{item.description}</p>
        <em>{sideMeta(item, i18n)}</em>
      </div>
    </div>
  );
}

export function ProposalConversationClient({
  tradeId,
  proposalId,
  initialEditProposal = false,
  initialProposalNeedId = '',
  initialProposalOfferId = '',
}: {
  tradeId: string;
  proposalId: string;
  initialEditProposal?: boolean;
  initialProposalNeedId?: string;
  initialProposalOfferId?: string;
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
  const [dealConfirmAction, setDealConfirmAction] = useState<"submitted" | "completed" | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [problemReportOpen, setProblemReportOpen] = useState(false);
  const [problemSummary, setProblemSummary] = useState("");
  const [problemError, setProblemError] = useState<string | null>(null);
  const [editingProposal, setEditingProposal] = useState(false);
  const [proposalDraft, setProposalDraft] = useState("");
  const [proposalEditError, setProposalEditError] = useState<string | null>(null);
  const [proposalNeeds, setProposalNeeds] = useState<NeedDto[]>([]);
  const [proposalOffers, setProposalOffers] = useState<OfferDto[]>([]);
  const [proposalSideChoice, setProposalSideChoice] = useState<"none" | "need" | "offer" | "both">("none");
  const [proposalDraftNeedId, setProposalDraftNeedId] = useState("");
  const [proposalDraftOfferId, setProposalDraftOfferId] = useState("");
  const [proposalSideLoading, setProposalSideLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageEditError, setMessageEditError] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] =
    useState<DeleteConfirmTarget | null>(null);
  const [proposalDetailsOpen, setProposalDetailsOpen] = useState(false);
  const initialEditAppliedRef = useRef(false);

  const sideItems = useMemo(
    () => (proposal ? proposalSideItems(proposal) : []),
    [proposal],
  );
  const sideItemId = sideItems.map((side) => side.item.id).join(':') || null;
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
  const canMarkSubmitted = Boolean(proposal && proposal.status === "accepted" && proposal.trade?.status === "in_progress" && proposal.trade?.providerId === actorId);
  const canConfirmCompleted = Boolean(proposal && proposal.status === "accepted" && proposal.trade?.status === "submitted" && (isOwner || isApplicant || proposal.trade?.providerId === actorId) && proposal.trade?.deliverySubmittedById !== actorId);
  const canReportDealProblem = Boolean(proposal && proposal.status === "accepted" && ["in_progress", "submitted"].includes(proposal.trade?.status ?? "") && (isOwner || isApplicant || proposal.trade?.providerId === actorId));
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

  useEffect(() => {
    if (!initialEditProposal || initialEditAppliedRef.current) return;
    if (!proposal || !canEditProposalContent) return;
    initialEditAppliedRef.current = true;
    const storedDraft = readProposalEditDraft(proposalId);
    startProposalEdit({
      message: storedDraft?.message,
      needId: initialProposalNeedId || storedDraft?.needId || proposal.proposedNeedId || "",
      offerId: initialProposalOfferId || storedDraft?.offerId || proposal.proposedOfferId || "",
      sideChoice:
        storedDraft?.sideChoice ??
        (initialProposalNeedId && initialProposalOfferId ? "both" : initialProposalNeedId ? "need" : initialProposalOfferId ? "offer" : undefined),
    });
  }, [
    canEditProposalContent,
    initialEditProposal,
    initialProposalNeedId,
    initialProposalOfferId,
    proposal,
    proposalId,
  ]);

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

  async function updateAcceptedTradeStatus(status: TradeActionStatus) {
    if (!proposal?.trade) return;
    setActionLoading(status);
    setNotice(null);
    try {
      const response = await api.trades.updateStatus(proposal.trade.id, { status }) as TradeStatusResponse;
      if (response.trade) setProposal((current) => current ? { ...current, trade: response.trade } : current);
      setDealConfirmAction(null);
      setNotice(status === "submitted" ? t("trade.detail.deliveryMarked") : status === "completed" ? t("trade.detail.tradeConfirmed") : status === "disputed" ? t("trade.detail.tradeReported") : t("trade.detail.tradeUpdated"));
      await loadProposal({ quiet: true });
      await loadMessages({ quiet: true });
    } catch {
      setNotice(t("trade.detail.couldNotUpdate"));
    } finally {
      setActionLoading(null);
    }
  }

  async function submitDealProblemReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proposal) return;
    const details = problemSummary.trim();
    setProblemError(null);
    if (details.length < 3) {
      setProblemError(t("trade.deal.problemReportSummaryRequired"));
      return;
    }
    setActionLoading("deal-report");
    setNotice(null);
    try {
      const response = await api.proposals.reportProblem(proposal.id, { reason: "other", details }) as DealProblemReportResponse;
      if (response.proposal) setProposal(response.proposal);
      else if (response.trade) setProposal((current) => current ? { ...current, trade: response.trade } : current);
      setProblemReportOpen(false);
      setProblemSummary("");
      setProblemError(null);
      setNotice(response.duplicate ? t("trade.deal.problemReportUpdated") : t("trade.deal.problemReportSent"));
      await loadProposal({ quiet: true });
      await loadMessages({ quiet: true });
    } catch {
      setProblemError(t("trade.deal.problemReportCouldNotSend"));
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
      const [needsResponse, offersResponse] = await Promise.all([api.needs.mine(), api.offers.mine()]);
      setProposalNeeds(normalizeNeeds(needsResponse));
      setProposalOffers(normalizeOffers(offersResponse));
    } catch {
      setProposalEditError(t("trade.errors.couldNotLoadInventory"));
    } finally {
      setProposalSideLoading(false);
    }
  }

  function startProposalEdit(seed?: ProposalEditDraftSnapshot) {
    if (!proposal) return;
    const nextNeedId = seed?.needId ?? proposal.proposedNeedId ?? "";
    const nextOfferId = seed?.offerId ?? proposal.proposedOfferId ?? "";
    const nextMessage = seed?.message ?? (proposal.messageDeletedAt ? "" : proposal.message);
    const nextSideChoice =
      seed?.sideChoice ??
      (nextNeedId && nextOfferId ? "both" : nextNeedId ? "need" : nextOfferId ? "offer" : "none");
    setProposalDraft(nextMessage);
    setProposalDraftNeedId(nextNeedId);
    setProposalDraftOfferId(nextOfferId);
    setProposalSideChoice(nextSideChoice);
    setProposalEditError(null);
    setProposalDetailsOpen(false);
    setEditingProposal(true);
    void loadProposalSideInventory();
  }

  function stashProposalEditDraft() {
    writeProposalEditDraft(proposalId, {
      message: proposalDraft,
      needId: proposalDraftNeedId,
      offerId: proposalDraftOfferId,
      sideChoice: proposalSideChoice,
    });
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

    setActionLoading("proposal-edit");
    try {
      const payload: { message?: string; proposedNeedId?: string | null; proposedOfferId?: string | null } = {};
      if (message) payload.message = message;
      payload.proposedNeedId = proposalDraftNeedId || null;
      payload.proposedOfferId = proposalDraftOfferId || null;
      const response = await api.proposals.updateMessage(proposal.id, payload);
      const updated = normalizeProposal(response);
      if (!updated) throw new Error("missing_proposal_response");
      setProposal(updated);
      setEditingProposal(false);
      setProposalEditError(null);
      clearProposalEditDraft(proposal.id);
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
            ? t("trade.deal.title")
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

      {dealConfirmAction ? (
        <div className="proposal-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="deal-status-confirm-title">
          <div className="proposal-confirm-modal__panel">
            <span className="semantic-badge proposal">
              <WebIcon name="proposal-accepted" size={14} decorative /> {tr(i18n, "trade.deal.acceptedDeal", "Accepted deal")}
            </span>
            <h2 id="deal-status-confirm-title">
              {dealConfirmAction === "submitted"
                ? tr(i18n, "trade.deal.markSubmittedConfirmTitle", "Mark submitted?")
                : tr(i18n, "trade.deal.confirmCompletedConfirmTitle", "Confirm completed?")}
            </h2>
            <p>
              {dealConfirmAction === "submitted"
                ? tr(i18n, "trade.deal.markSubmittedConfirmBody", "Use this only after you have delivered your side of the accepted agreement. The other participant will review it before completion.")
                : tr(i18n, "trade.deal.confirmCompletedConfirmBody", "Confirm only after reviewing the submitted work and checking the accepted agreement. The submitter cannot confirm their own work.")}
            </p>
            <div className="proposal-confirm-modal__actions">
              <button type="button" className="secondary" onClick={() => setDealConfirmAction(null)} disabled={Boolean(actionLoading)}>
                {tr(i18n, "common.actions.cancel", "Cancel")}
              </button>
              <button type="button" onClick={() => void updateAcceptedTradeStatus(dealConfirmAction)} disabled={Boolean(actionLoading)}>
                {actionLoading
                  ? tr(i18n, "common.states.working", "Working…")
                  : dealConfirmAction === "submitted"
                    ? tr(i18n, "trade.deal.markSubmittedConfirmAction", "Mark submitted")
                    : tr(i18n, "trade.deal.confirmCompletedConfirmAction", "Confirm completed")}
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


      {problemReportOpen ? (
        <div
          className="proposal-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deal-problem-report-title"
        >
          <form className="proposal-confirm-modal__panel" onSubmit={submitDealProblemReport}>
            <span className="semantic-badge danger">
              <WebIcon name="warning" size={14} decorative /> {t("trade.deal.problemReportBadge")}
            </span>
            <h2 id="deal-problem-report-title">{t("trade.deal.problemReportTitle")}</h2>
            <p>{t("trade.deal.problemReportBody")}</p>
            <p className="notice-box warning"><strong>{t("trade.deal.problemReportEvidenceTitle")}</strong><br />{t("trade.deal.problemReportEvidenceBody")}</p>
            <label className="field-label">
              {t("trade.deal.problemReportSummaryLabel")}
              <textarea
                value={problemSummary}
                onChange={(event) => {
                  setProblemSummary(event.target.value);
                  if (problemError) setProblemError(null);
                }}
                placeholder={t("trade.deal.problemReportPlaceholder")}
                rows={4}
                aria-invalid={Boolean(problemError)}
                aria-describedby={problemError ? "deal-problem-report-error" : undefined}
              />
            </label>
            {problemError ? <p id="deal-problem-report-error" className="field-error" role="alert">{problemError}</p> : null}
            <div className="proposal-confirm-modal__actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (actionLoading) return;
                  setProblemReportOpen(false);
                  setProblemSummary("");
                  setProblemError(null);
                }}
                disabled={Boolean(actionLoading)}
              >
                {t("common.actions.cancel")}
              </button>
              <button type="submit" className="danger" disabled={Boolean(actionLoading)}>
                {actionLoading === "deal-report" ? t("common.states.working") : t("trade.deal.problemReportSubmit")}
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
        {proposal.status === "accepted" ? (
          <AcceptedDealWorkspace
            proposal={proposal}
            canMarkSubmitted={canMarkSubmitted}
            canConfirmCompleted={canConfirmCompleted}
            canReportProblem={canReportDealProblem}
            canCancelAcceptedTrade={canCancelAcceptedTrade}
            actionLoading={actionLoading}
            actorId={actorId}
            onMarkSubmitted={() => setDealConfirmAction("submitted")}
            onConfirmCompleted={() => setDealConfirmAction("completed")}
            onReportProblem={() => setProblemReportOpen(true)}
            onOpenCancel={() => setCancelConfirmOpen(true)}
            i18n={i18n}
          />
        ) : null}
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
                  <div className="proposal-edit-form__picker-grid">
                    <div className="proposal-edit-form__picker-card">
                      <div>
                        <span className="proposal-side-preview__label">{t("trade.labels.proposedOffer")}</span>
                        <strong>{draftOffer ? draftOffer.title : t("trade.proposals.noProposalItemSelected")}</strong>
                        <p>{draftOffer ? sideMeta(draftOffer, i18n) : requiredProposalSide === "offer" ? t("trade.proposals.chooseExistingOfferBody") : t("trade.proposals.optionalOfferBody")}</p>
                      </div>
                      <div className="proposal-edit-form__picker-actions">
                        <Link
                          href={proposalEditChooseHref("offer", tradeId, proposal.id, proposalDraftNeedId, proposalDraftOfferId)}
                          className="button secondary"
                          onClick={stashProposalEditDraft}
                        >
                          {draftOffer ? t("trade.proposals.changeOffer") : t("trade.proposals.chooseOffer")}
                        </Link>
                        {draftOffer && requiredProposalSide !== "offer" ? (
                          <button type="button" className="secondary danger-text" onClick={() => setProposalDraftOfferId("")}>{t("trade.proposals.removeOffer")}</button>
                        ) : null}
                      </div>
                    </div>
                    <div className="proposal-edit-form__picker-card">
                      <div>
                        <span className="proposal-side-preview__label">{t("trade.labels.proposedNeed")}</span>
                        <strong>{draftNeed ? draftNeed.title : t("trade.proposals.noProposalItemSelected")}</strong>
                        <p>{draftNeed ? sideMeta(draftNeed, i18n) : requiredProposalSide === "need" ? t("trade.proposals.chooseExistingNeedBody") : t("trade.proposals.optionalNeedBody")}</p>
                      </div>
                      <div className="proposal-edit-form__picker-actions">
                        <Link
                          href={proposalEditChooseHref("need", tradeId, proposal.id, proposalDraftNeedId, proposalDraftOfferId)}
                          className="button secondary"
                          onClick={stashProposalEditDraft}
                        >
                          {draftNeed ? t("trade.proposals.changeNeed") : t("trade.proposals.chooseNeed")}
                        </Link>
                        {draftNeed && requiredProposalSide !== "need" ? (
                          <button type="button" className="secondary danger-text" onClick={() => setProposalDraftNeedId("")}>{t("trade.proposals.removeNeed")}</button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {draftOffer ? <ProposalSidePreview kind="offer" item={draftOffer} compact i18n={i18n} /> : null}
                  {draftNeed ? <ProposalSidePreview kind="need" item={draftNeed} compact i18n={i18n} /> : null}
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
                  <button type="button" className="secondary" onClick={() => { setEditingProposal(false); setProposalEditError(null); clearProposalEditDraft(proposal.id); }} disabled={Boolean(actionLoading)}>{t("common.actions.cancel")}</button>
                </div>
              </form>
            ) : (
              <>
                {sideItems.length ? (
                  <div className="proposal-side-review">
                    {sideItems.map((side) => (
                      <ProposalSidePreview
                        key={`${side.kind}-${side.item.id}`}
                        kind={side.kind}
                        item={side.item}
                        compact
                        i18n={i18n}
                      />
                    ))}
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
                      <div className="proposal-side-details-stack">
                        {sideItems.map((side) => (
                          <ProposalSideDetails
                            key={`${side.kind}-details-${side.item.id}`}
                            kind={side.kind}
                            item={side.item}
                            i18n={i18n}
                          />
                        ))}
                      </div>
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
                <button type="button" className="secondary" onClick={() => startProposalEdit()} disabled={Boolean(actionLoading)}>{proposal.messageDeletedAt ? t("trade.proposals.addProposalNote") : t("trade.proposals.editProposal")}</button>
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
              {canCancelAcceptedTrade && proposal.status !== "accepted" ? (
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
