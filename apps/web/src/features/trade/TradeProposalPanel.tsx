'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { CASH_PROMISE_ACKNOWLEDGEMENT_TEXT, type CashPromiseInput, type NeedDto, type OfferDto, type TradeDto, type TradeProposalDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { formatWebMoney } from '../../lib/webFormat';
import { betaFeatures } from '../../lib/betaFeatures';
import { getStatusLabel, getTradePostType, getTradeProposalCopy, type TradeI18n } from './tradePresentation';
import { ProTradePackagePrototype } from './ProTradePackagePrototype';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { UserIdentityLink } from '../users/UserIdentityLink';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { ProposalAiAssistPanel } from './ProposalAiAssistPanel';

const PROPOSAL_REFRESH_INTERVAL_MS = 6000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isProposal(value: unknown): value is TradeProposalDto {
  return isRecord(value) && typeof value.id === 'string' && typeof value.tradeId === 'string' && typeof value.applicantId === 'string' && typeof value.message === 'string';
}

function isNeed(value: unknown): value is NeedDto {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.description === 'string';
}

function isOffer(value: unknown): value is OfferDto {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.description === 'string';
}

function normalizeProposals(value: unknown): TradeProposalDto[] {
  if (Array.isArray(value)) return value.filter(isProposal);
  if (isRecord(value) && Array.isArray(value.proposals)) return value.proposals.filter(isProposal);
  if (isRecord(value) && Array.isArray(value.items)) return value.items.filter(isProposal);
  return [];
}

function normalizeProposal(value: unknown): TradeProposalDto | null {
  if (isProposal(value)) return value;
  if (isRecord(value) && isProposal(value.proposal)) return value.proposal;
  return null;
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

function proposalFromError(error: unknown): TradeProposalDto | null {
  if (!isRecord(error) || !isRecord(error.body)) return null;
  return normalizeProposal(error.body);
}

function upsertProposal(list: TradeProposalDto[], proposal: TradeProposalDto) {
  const exists = list.some((item) => item.id === proposal.id);
  if (!exists) return [proposal, ...list];
  return list.map((item) => item.id === proposal.id ? { ...item, ...proposal, messages: proposal.messages ?? item.messages } : item);
}

function mergeProposalList(current: TradeProposalDto[], next: TradeProposalDto[]) {
  const currentById = new Map(current.map((proposal) => [proposal.id, proposal]));
  return next.map((proposal) => {
    const existing = currentById.get(proposal.id);
    return existing ? { ...existing, ...proposal, messages: proposal.messages ?? existing.messages } : proposal;
  });
}

function proposalApplicantStatus(proposal: TradeProposalDto, i18n?: TradeI18n) {
  if (proposal.proposedNeed && proposal.proposedOffer) return i18n?.t?.('trade.proposals.needOfferProposal') ?? 'Need + Offer proposal';
  if (proposal.proposedOffer) return i18n?.t?.('trade.proposals.offerProposal') ?? 'Offer proposal';
  if (proposal.proposedNeed) return i18n?.t?.('trade.proposals.needProposal') ?? 'Need proposal';
  return i18n?.t?.('trade.proposals.tradeRequest') ?? 'Trade request';
}

function proposalStatusIcon(status: TradeProposalDto['status']): WebIconName {
  if (status === 'accepted') return 'proposal-accepted';
  if (status === 'declined') return 'proposal-declined';
  return 'proposal';
}


function proposalSideRequirement(trade: TradeDto) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') return 'offer' as const;
  if (postType === 'open_offer') return 'need' as const;
  return null;
}

function proposalChooseHref(tradeId: string, side: 'need' | 'offer', currentNeedId?: string, currentOfferId?: string) {
  const params = new URLSearchParams();
  if (currentNeedId) params.set('proposalNeedId', currentNeedId);
  if (currentOfferId) params.set('proposalOfferId', currentOfferId);
  const query = params.toString();
  return `/trades/${tradeId}/propose/choose-${side}${query ? `?${query}` : ''}`;
}

function firstMediaUrl(item: NeedDto | OfferDto) {
  return item.media?.find((media) => typeof media.url === 'string' && media.url.length > 0)?.url ?? null;
}

function parseProposalCashAmountCents(value: string) {
  const amount = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(amount)) return Number.NaN;
  return Math.round(amount * 100);
}

function sideMeta(item: NeedDto | OfferDto, i18n?: TradeI18n) {
  const sideTiming = (item as NeedDto).timing ?? (item as OfferDto).availability;
  return [item.category, item.mode, sideTiming].filter(Boolean).join(' · ') || item.itemType || i18n?.t?.('trade.labels.savedItem') || 'Saved item';
}



function ProposalSidePreview({ kind, item, label, compact = false, i18n }: { kind: 'need' | 'offer'; item: NeedDto | OfferDto; label?: string; compact?: boolean; i18n?: TradeI18n }) {
  const mediaUrl = firstMediaUrl(item);
  const iconName: WebIconName = kind === 'offer' ? 'offer' : 'need';
  return (
    <div className={compact ? 'proposal-side-preview proposal-side-preview--compact' : 'proposal-side-preview'}>
      <div className="proposal-side-preview__media">
        {mediaUrl ? <img src={mediaUrl} alt="" /> : <WebIcon name={iconName} size={22} decorative />}
      </div>
      <div className="proposal-side-preview__body">
        <span className="proposal-side-preview__label">{label ?? (kind === 'offer' ? i18n?.t?.('trade.labels.proposedOffer') ?? 'Proposed Offer' : i18n?.t?.('trade.labels.proposedNeed') ?? 'Proposed Need')}</span>
        <strong>{item.title}</strong>
        <p>{item.description}</p>
        <em>{sideMeta(item, i18n)}</em>
      </div>
    </div>
  );
}

function ProposalPickerShortcut({ side, title, count, item, emptyText, href, i18n }: { side: 'need' | 'offer'; title: string; count: number; item: NeedDto | OfferDto | null; emptyText: string; href: string; i18n: TradeI18n }) {
  const t = i18n.t;
  return (
    <div className="proposal-side-picker">
      <div className="trade-section-heading compact">
        <div>
          <p className="eyebrow">{side === 'need' ? t?.('trade.labels.yourNeed') ?? 'Your Need' : t?.('trade.labels.yourOffer') ?? 'Your Offer'}</p>
          <h3 className="icon-heading"><WebIcon name={side} size={18} decorative /> {title}</h3>
        </div>
        <Link href={href} className="button secondary proposal-picker-link">{item ? t?.('common.actions.edit') ?? 'Edit' : t?.('trade.proposals.openPicker') ?? 'Open picker'}</Link>
      </div>
      {item ? <ProposalSidePreview kind={side} item={item} label={side === 'need' ? t?.('trade.labels.selectedNeed') : t?.('trade.labels.selectedOffer')} i18n={i18n} /> : (
        <Link href={href} className="trade-side-placeholder proposal-side-placeholder">
          <span><WebIcon name={side} size={22} decorative /></span>
          <strong>{count > 0 ? t?.('trade.proposals.chooseFromSavedItems', { count }) : emptyText}</strong>
          <small>{t?.('trade.proposals.chooseProposalItemOptionalBody')}</small>
        </Link>
      )}
    </div>
  );
}


function ProposalAttachmentLine({ kind, item, href, i18n }: { kind: 'need' | 'offer'; item: NeedDto | OfferDto; href: string; i18n: TradeI18n }) {
  const t = i18n.t ?? ((key: string) => key);
  return (
    <Link href={href} className="proposal-attachment-line">
      <WebIcon name={kind} size={17} decorative />
      <span>
        <strong>{kind === 'need' ? t('trade.labels.selectedNeed') : t('trade.labels.selectedOffer')}</strong>
        <small>{item.title}</small>
      </span>
      <WebIcon name="arrow-right" size={16} decorative />
    </Link>
  );
}

function AcceptedProposalPackage({ tradeId, proposal, i18n }: { tradeId: string; proposal: TradeProposalDto; i18n: TradeI18n }) {
  const t = i18n.t ?? ((key: string) => key);
  const sideItems: Array<{ kind: 'need'; item: NeedDto } | { kind: 'offer'; item: OfferDto }> = [];
  if (proposal.proposedOffer) sideItems.push({ kind: 'offer', item: proposal.proposedOffer });
  if (proposal.proposedNeed) sideItems.push({ kind: 'need', item: proposal.proposedNeed });
  const threadHref = `/trades/${tradeId}/proposals/${proposal.id}`;

  return (
    <article className="accepted-proposal-package">
      <div className="accepted-proposal-package__header">
        <div>
          <p className="eyebrow">{t('trade.proposals.acceptedProposalPackageEyebrow')}</p>
          <h3 className="icon-heading"><WebIcon name="proposal-accepted" size={19} decorative /> {t('trade.proposals.acceptedProposalPackageTitle')}</h3>
        </div>
        <span className="semantic-badge proposal"><WebIcon name="proposal-accepted" size={14} decorative /> {getStatusLabel(proposal.status, i18n)}</span>
      </div>
      <UserIdentityLink
        user={proposal.applicant}
        userId={proposal.applicantId}
        variant="chip"
        avatarSize="sm"
        statusText={proposalApplicantStatus(proposal, i18n)}
        showHandle={false}
      />
      <p className="accepted-proposal-package__body">{t('trade.proposals.acceptedProposalPackageBody')}</p>
      {sideItems.length || proposal.cashPromise ? (
        <div className="accepted-proposal-package__sides">
          {sideItems.map((side) => (
            <ProposalSidePreview
              key={`${side.kind}-${side.item.id}`}
              kind={side.kind}
              item={side.item}
              compact
              i18n={i18n}
            />
          ))}
          {proposal.cashPromise ? (
            <div className="proposal-side-preview proposal-side-preview--compact cash-promise-preview">
              <div className="proposal-side-preview__media"><WebIcon name="proposal" size={22} decorative /></div>
              <div className="proposal-side-preview__body">
                <span className="proposal-side-preview__label">{proposal.cashPromise.side === 'need' ? t('trade.labels.proposedNeed') : t('trade.labels.proposedOffer')}</span>
                <strong>{t('trade.cashPromise.title')} · {formatWebMoney(proposal.cashPromise.amountCents, proposal.cashPromise.currency ?? 'eur', i18n.language)}</strong>
                <p>{t('trade.cashPromise.notProcessed')}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {proposal.messageDeletedAt ? (
        <p className="accepted-proposal-package__note proposal-message-deleted">{t('trade.proposals.proposalNoteDeleted')}</p>
      ) : proposal.message ? (
        <p className="accepted-proposal-package__note"><span>{t('trade.proposals.proposalNote')}</span>{proposal.message}</p>
      ) : null}
      <p className="accepted-proposal-package__locked"><WebIcon name="proposal-accepted" size={14} decorative /> {t('trade.proposals.acceptedProposalPackageLocked')}</p>
      <Link href={threadHref} className="proposal-card__open proposal-card__open--inline">
        <WebIcon name="proposal" size={14} decorative /> {t('trade.proposals.openPrivateThread')}
      </Link>
    </article>
  );
}

export function TradeProposalPanel({ trade, variant = 'inline' }: { trade: TradeDto; variant?: 'inline' | 'page' }) {
  const auth = useWebAuth();
  const searchParams = useSearchParams();
  const { t, language } = useWebTranslation();
  const i18n = { t, language };
  const isOwner = auth.user?.id === trade.ownerId;
  const isPage = variant === 'page';
  const proposalCopy = getTradeProposalCopy(trade, i18n);
  const requiredProposalSide = proposalSideRequirement(trade);
  const proposalNeedIdFromUrl = searchParams.get('proposalNeedId') ?? '';
  const proposalOfferIdFromUrl = searchParams.get('proposalOfferId') ?? '';
  const [proposals, setProposals] = useState<TradeProposalDto[]>([]);
  const [proposalMessage, setProposalMessage] = useState('');
  const [proposalNeeds, setProposalNeeds] = useState<NeedDto[]>([]);
  const [proposalOffers, setProposalOffers] = useState<OfferDto[]>([]);
  const [proposedNeedId, setProposedNeedId] = useState('');
  const [proposedOfferId, setProposedOfferId] = useState('');
  const [packagePrototypeEnabled, setPackagePrototypeEnabled] = useState(false);
  const [supportingNeedIds, setSupportingNeedIds] = useState<string[]>([]);
  const [supportingOfferIds, setSupportingOfferIds] = useState<string[]>([]);
  const [cashPromiseSide, setCashPromiseSide] = useState<'' | 'need' | 'offer'>('');
  const [cashPromiseAmount, setCashPromiseAmount] = useState('');
  const [cashPromiseCurrency, setCashPromiseCurrency] = useState('eur');
  const [cashPromiseNote, setCashPromiseNote] = useState('');
  const [cashPromiseAcknowledged, setCashPromiseAcknowledged] = useState(false);
  const [sideLoading, setSideLoading] = useState(false);
  const [proposalFormError, setProposalFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const ownActiveProposal = useMemo(() => proposals.find((proposal) => proposal.applicantId === auth.user?.id && ['pending', 'accepted'].includes(proposal.status)), [auth.user?.id, proposals]);
  const latestOwnClosedProposal = useMemo(() => proposals.find((proposal) => proposal.applicantId === auth.user?.id && ['declined', 'withdrawn'].includes(proposal.status)), [auth.user?.id, proposals]);
  const acceptedProposal = useMemo(() => proposals.find((proposal) => proposal.status === 'accepted') ?? null, [proposals]);
  const visibleProposalList = useMemo(() => proposals.filter((proposal) => proposal.id !== acceptedProposal?.id), [acceptedProposal?.id, proposals]);
  const canSendProposal = !isOwner && trade.status === 'active' && !ownActiveProposal;
  const activeProposalNeeds = useMemo(() => proposalNeeds.filter((need) => need.status === 'active'), [proposalNeeds]);
  const activeProposalOffers = useMemo(() => proposalOffers.filter((offer) => offer.status === 'active'), [proposalOffers]);
  const selectedNeed = useMemo(() => activeProposalNeeds.find((need) => need.id === proposedNeedId) ?? null, [activeProposalNeeds, proposedNeedId]);
  const selectedOffer = useMemo(() => activeProposalOffers.find((offer) => offer.id === proposedOfferId) ?? null, [activeProposalOffers, proposedOfferId]);
  const packagePrototypeActive = packagePrototypeEnabled && betaFeatures.proTradePackageFeatures.visible && ['need', 'offer'].includes(requiredProposalSide ?? '');
  const cashPromiseAvailable = betaFeatures.cashPromiseEnabled && betaFeatures.cashPromiseVisible;
  const cashPromiseAmountCents = parseProposalCashAmountCents(cashPromiseAmount);
  const hasPackageRequiredSide = requiredProposalSide === 'offer' ? supportingOfferIds.length > 0 : requiredProposalSide === 'need' ? supportingNeedIds.length > 0 : false;
  const hasRequiredCashSide = Boolean(requiredProposalSide && cashPromiseSide === requiredProposalSide);
  const hasRequiredSide = packagePrototypeActive ? hasPackageRequiredSide : requiredProposalSide === 'need' ? Boolean(selectedNeed) || hasRequiredCashSide : requiredProposalSide === 'offer' ? Boolean(selectedOffer) || hasRequiredCashSide : true;

  useEffect(() => {
    setProposedNeedId(proposalNeedIdFromUrl);
    setProposedOfferId(proposalOfferIdFromUrl);
    if (proposalNeedIdFromUrl) setCashPromiseSide((current) => (current === 'need' ? '' : current));
    if (proposalOfferIdFromUrl) setCashPromiseSide((current) => (current === 'offer' ? '' : current));
  }, [proposalNeedIdFromUrl, proposalOfferIdFromUrl]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let mounted = true;
    async function loadProposals() {
      setLoading(true);
      setNotice(null);
      try {
        const response = await api.trades.proposals(trade.id);
        const nextProposals = normalizeProposals(response);
        if (!mounted) return;
        setProposals((current) => mergeProposalList(current, nextProposals));
      } catch {
        if (mounted) setNotice(t('trade.proposals.proposalAccessPrivate'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadProposals();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, trade.id, t]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let mounted = true;
    async function refreshProposals() {
      try {
        const response = await api.trades.proposals(trade.id);
        if (!mounted) return;
        const nextProposals = normalizeProposals(response);
        setProposals((current) => mergeProposalList(current, nextProposals));
      } catch {
        // Keep the current thread visible during short network drops. The normal
        // initial load and explicit actions still show user-facing errors.
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refreshProposals();
    }, PROPOSAL_REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [auth.isAuthenticated, trade.id]);


  useEffect(() => {
    if (!auth.isAuthenticated || !canSendProposal) return;
    let mounted = true;
    async function loadProposalInventory() {
      setSideLoading(true);
      try {
        const [needsResponse, offersResponse] = await Promise.all([api.needs.mine(), api.offers.mine()]);
        const needs = normalizeNeeds(needsResponse);
        const offers = normalizeOffers(offersResponse);
        if (!mounted) return;
        setProposalNeeds(needs);
        setProposalOffers(offers);
        setProposedNeedId((current) => current && needs.some((need) => need.id === current && need.status === 'active') ? current : '');
        setProposedOfferId((current) => current && offers.some((offer) => offer.id === current && offer.status === 'active') ? current : '');
        setSupportingNeedIds((current) => current.filter((id) => needs.some((need) => need.id === id && need.status === 'active')).slice(0, betaFeatures.proTradePackageFeatures.maxSupportingNeeds));
        setSupportingOfferIds((current) => current.filter((id) => offers.some((offer) => offer.id === id && offer.status === 'active')).slice(0, betaFeatures.proTradePackageFeatures.maxSupportingOffers));
      } catch {
        if (mounted) setNotice(t('trade.errors.couldNotLoadInventory'));
      } finally {
        if (mounted) setSideLoading(false);
      }
    }
    void loadProposalInventory();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, canSendProposal, proposalNeedIdFromUrl, proposalOfferIdFromUrl, requiredProposalSide, trade.status]);

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = proposalMessage.trim();
    setProposalFormError(null);
    if (!hasRequiredSide) {
      setProposalFormError(requiredProposalSide === 'offer' ? t('trade.proposals.chooseOfferBeforeSending') : requiredProposalSide === 'need' ? t('trade.proposals.chooseNeedBeforeSending') : t('trade.proposals.chooseProposalItem'));
      return;
    }
    if (cashPromiseSide && (!cashPromiseAvailable || !Number.isFinite(cashPromiseAmountCents) || cashPromiseAmountCents < 100 || !cashPromiseAcknowledged)) {
      setProposalFormError(!cashPromiseAvailable ? t('trade.cashPromise.hidden') : !cashPromiseAcknowledged ? t('trade.cashPromise.validationAcknowledgement') : t('trade.cashPromise.validationAmount'));
      return;
    }
    if (!message) {
      setProposalFormError(t('trade.proposals.messageRequired'));
      return;
    }
    if (message.length < 3) {
      setProposalFormError(t('trade.proposals.messageTooShort'));
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const packagePayload = packagePrototypeActive && requiredProposalSide === 'offer'
        ? {
          packageKind: 'main_need_multi_offer' as const,
          supportingOfferIds: supportingOfferIds.slice(0, betaFeatures.proTradePackageFeatures.maxSupportingOffers),
          proposedOfferId: supportingOfferIds[0],
        }
        : packagePrototypeActive && requiredProposalSide === 'need'
          ? {
            packageKind: 'main_offer_multi_need' as const,
            supportingNeedIds: supportingNeedIds.slice(0, betaFeatures.proTradePackageFeatures.maxSupportingNeeds),
            proposedNeedId: supportingNeedIds[0],
          }
          : null;
      const cashPromise = cashPromiseSide ? { side: cashPromiseSide, amountCents: cashPromiseAmountCents, currency: cashPromiseCurrency, note: cashPromiseNote.trim() || undefined, acknowledgementAccepted: true as const, acknowledgementText: CASH_PROMISE_ACKNOWLEDGEMENT_TEXT } satisfies CashPromiseInput : undefined;
      const response = await api.trades.createProposal(trade.id, {
        message,
        ...(packagePayload ?? {
          ...((requiredProposalSide === 'need' || !requiredProposalSide) && selectedNeed && cashPromiseSide !== 'need' ? { proposedNeedId: selectedNeed.id } : {}),
          ...((requiredProposalSide === 'offer' || !requiredProposalSide) && selectedOffer && cashPromiseSide !== 'offer' ? { proposedOfferId: selectedOffer.id } : {}),
          ...(cashPromise ? { cashPromise } : {}),
        }),
      });
      const proposal = normalizeProposal(response);
      if (!proposal) throw new Error('missing_proposal_response');
      setProposals((current) => upsertProposal(current, proposal));
      setProposalMessage('');
      setPackagePrototypeEnabled(false);
      setSupportingNeedIds([]);
      setSupportingOfferIds([]);
      setCashPromiseSide('');
      setCashPromiseAmount('');
      setCashPromiseNote('');
      setCashPromiseAcknowledged(false);
      setProposalFormError(null);
      setNotice(t('trade.proposals.proposalSent'));
    } catch (error) {
      const existingProposal = proposalFromError(error);
      if (existingProposal) {
        setProposals((current) => upsertProposal(current, existingProposal));
        setProposalMessage('');
        setProposalFormError(null);
      }
      setNotice(existingProposal ? t('trade.proposals.proposalAlreadyOpen') : t('trade.errors.couldNotSendProposal'));
    } finally {
      setLoading(false);
    }
  }

  if (!auth.hydrated) {
    return (
      <section className="trade-social-section">
        <h2><WebIcon name="proposal" size={21} decorative /> {t('trade.proposals.title')}</h2>
        <p>{t('auth.checkingAccess')}</p>
      </section>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="trade-social-section">
        <h2><WebIcon name="proposal" size={21} decorative /> {proposalCopy.signedOutTitle}</h2>
        <p>{proposalCopy.helper}</p>
        <Link href={`/auth?next=${encodeURIComponent(`/trades/${trade.id}`)}`} className="button primary full">{t('trade.proposals.signInToSend')}</Link>
      </section>
    );
  }

  const pageProposalList = acceptedProposal ? [acceptedProposal, ...visibleProposalList] : visibleProposalList;

  return (
    <section className={isPage ? 'trade-social-section private-proposals-section private-proposals-section--clean' : 'trade-social-section'}>
      {!isPage ? (
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">{t('trade.threadSplit.privateTitle')}</p>
            <h2 className="icon-heading"><WebIcon name="proposal" size={21} decorative /> {isOwner ? t('trade.proposals.title') : ownActiveProposal ? t('trade.proposals.yourProposal') : proposalCopy.actionTitle}</h2>
          </div>
          {loading ? <span className="semantic-badge instruction">{t('trade.detail.updated')}</span> : null}
        </div>
      ) : null}

      {!isPage && acceptedProposal ? <AcceptedProposalPackage tradeId={trade.id} proposal={acceptedProposal} i18n={i18n} /> : null}

      {!isPage && isOwner && visibleProposalList.length ? <p className="proposal-list-helper">{acceptedProposal ? t('trade.proposals.previousProposalListHint') : t('trade.proposals.proposalListHint')}</p> : null}
      {notice ? <p className="notice-box info">{notice}</p> : null}

      {latestOwnClosedProposal && canSendProposal ? <p className="notice-box info">{t('trade.proposals.canSendRevisedProposal')}</p> : null}

      {canSendProposal ? (
        <form className="proposal-composer proposal-composer--with-side" onSubmit={submitProposal}>
          {isPage ? (
            <div className="proposal-attachment-lines" aria-label={t('trade.proposals.privateAttachmentsLabel')}>
              {selectedOffer ? (
                <ProposalAttachmentLine
                  kind="offer"
                  item={selectedOffer}
                  href={proposalChooseHref(trade.id, 'offer', proposedNeedId, proposedOfferId)}
                  i18n={i18n}
                />
              ) : null}
              {selectedNeed ? (
                <ProposalAttachmentLine
                  kind="need"
                  item={selectedNeed}
                  href={proposalChooseHref(trade.id, 'need', proposedNeedId, proposedOfferId)}
                  i18n={i18n}
                />
              ) : null}
              {!selectedOffer && !selectedNeed ? (
                <p className="proposal-attachment-hint">
                  {requiredProposalSide === 'offer'
                    ? t('trade.proposals.privateAttachOfferHint')
                    : requiredProposalSide === 'need'
                      ? t('trade.proposals.privateAttachNeedHint')
                      : t('trade.proposals.privateAttachOptionalHint')}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {requiredProposalSide ? (
                <p className="proposal-side-callout">
                  <WebIcon name={requiredProposalSide === 'offer' ? 'offer' : 'need'} size={17} decorative />
                  {requiredProposalSide === 'offer'
                    ? t('trade.proposals.chooseOfferFirst')
                    : t('trade.proposals.chooseNeedFirst')}
                </p>
              ) : null}
              {!requiredProposalSide ? (
                <p className="proposal-side-callout">
                  <WebIcon name="proposal" size={17} decorative />
                  {t('trade.proposals.attachSavedItemOptionalBody')}
                </p>
              ) : null}

              <ProposalPickerShortcut
                side="offer"
                title={requiredProposalSide === 'offer' ? t('trade.proposals.chooseOfferToPropose') : t('trade.proposals.attachOfferToProposal')}
                count={activeProposalOffers.length}
                item={selectedOffer}
                emptyText={requiredProposalSide === 'offer' ? t('trade.proposals.createOfferFirst') : t('trade.proposals.createOfferOptional')}
                href={proposalChooseHref(trade.id, 'offer', proposedNeedId, proposedOfferId)}
                i18n={i18n}
              />

              <ProposalPickerShortcut
                side="need"
                title={requiredProposalSide === 'need' ? t('trade.proposals.chooseNeedToPropose') : t('trade.proposals.attachNeedToProposal')}
                count={activeProposalNeeds.length}
                item={selectedNeed}
                emptyText={requiredProposalSide === 'need' ? t('trade.proposals.createNeedFirst') : t('trade.proposals.createNeedOptional')}
                href={proposalChooseHref(trade.id, 'need', proposedNeedId, proposedOfferId)}
                i18n={i18n}
              />
            </>
          )}

          {!isPage && cashPromiseAvailable ? (
            <div className="notice-box warning proposal-cash-promise-box">
              <p className="eyebrow">{t('trade.cashPromise.title')}</p>
              <p>{t('trade.cashPromise.outsideAppBody')}</p>
              <div className="segmented-control" role="group" aria-label={t('trade.cashPromise.title')}>
                <button type="button" className={cashPromiseSide === '' ? 'is-active' : ''} onClick={() => setCashPromiseSide('')}>{t('trade.cashPromise.none')}</button>
                <button type="button" className={cashPromiseSide === 'need' ? 'is-active' : ''} onClick={() => { setCashPromiseSide('need'); setProposedNeedId(''); }}>{t('trade.labels.proposedNeed')}</button>
                <button type="button" className={cashPromiseSide === 'offer' ? 'is-active' : ''} onClick={() => { setCashPromiseSide('offer'); setProposedOfferId(''); }}>{t('trade.labels.proposedOffer')}</button>
              </div>
              {cashPromiseSide ? (
                <div className="cash-promise-fields">
                  <label className="field-label">{t('trade.cashPromise.amount')}<input inputMode="decimal" value={cashPromiseAmount} onChange={(event) => setCashPromiseAmount(event.target.value)} placeholder="25" /></label>
                  <label className="field-label">{t('trade.cashPromise.currency')}<select value={cashPromiseCurrency} onChange={(event) => setCashPromiseCurrency(event.target.value)}><option value="eur">EUR</option><option value="usd">USD</option><option value="gbp">GBP</option></select></label>
                  <label className="field-label">{t('trade.cashPromise.note')}<textarea value={cashPromiseNote} onChange={(event) => setCashPromiseNote(event.target.value)} maxLength={500} placeholder={t('trade.cashPromise.notePlaceholder')} /></label>
                  <label className="checkbox-row"><input type="checkbox" checked={cashPromiseAcknowledged} onChange={(event) => setCashPromiseAcknowledged(event.target.checked)} /> {CASH_PROMISE_ACKNOWLEDGEMENT_TEXT}</label>
                  {Number.isFinite(cashPromiseAmountCents) && cashPromiseAmountCents > 0 ? <p>{formatWebMoney(cashPromiseAmountCents, cashPromiseCurrency)} · {t('trade.cashPromise.notProcessed')}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {!isPage ? (
          <ProTradePackagePrototype
            requiredSide={requiredProposalSide}
            enabled={packagePrototypeEnabled}
            needs={activeProposalNeeds}
            offers={activeProposalOffers}
            supportingNeedIds={supportingNeedIds}
            supportingOfferIds={supportingOfferIds}
            onToggleEnabled={setPackagePrototypeEnabled}
            onSupportingNeedIdsChange={setSupportingNeedIds}
            onSupportingOfferIdsChange={setSupportingOfferIds}
          />
          ) : null}

          {!isPage ? (
          <ProposalAiAssistPanel
            message={proposalMessage}
            context={[trade.need?.title, trade.offer?.title, trade.need?.description, trade.offer?.description].filter(Boolean).join('\n')}
            disabled={loading || sideLoading}
            onApplyMessage={(nextMessage) => {
              setProposalMessage(nextMessage);
              if (proposalFormError) setProposalFormError(null);
            }}
          />
          ) : null}

          <label className={isPage ? 'field-label proposal-message-field proposal-message-field--minimal' : 'field-label proposal-message-field'}>
            {t('trade.labels.message')}
            <textarea
              value={proposalMessage}
              onChange={(event) => {
                setProposalMessage(event.target.value);
                if (proposalFormError) setProposalFormError(null);
              }}
              placeholder={proposalCopy.placeholder}
              rows={4}
              aria-describedby={proposalFormError ? 'proposal-form-error' : undefined}
              aria-invalid={Boolean(proposalFormError)}
            />
          </label>
          {proposalFormError ? <p id="proposal-form-error" className="field-error" role="alert">{proposalFormError}</p> : null}
          <button type="submit" disabled={loading || sideLoading}>{proposalCopy.actionButton}</button>
        </form>
      ) : null}

      {(isPage ? pageProposalList : visibleProposalList).length ? (
        <div className={isPage ? 'private-proposal-row-list' : 'proposal-list proposal-list--simple'}>
          {(isPage ? pageProposalList : visibleProposalList).map((proposal) => {
            const active = proposal.status === 'accepted';
            const threadHref = `/trades/${trade.id}/proposals/${proposal.id}`;
            if (isPage) {
              return (
                <Link key={proposal.id} href={threadHref} className={active ? 'private-proposal-row private-proposal-row--active' : 'private-proposal-row'}>
                  <UserIdentityLink
                    user={proposal.applicant}
                    userId={proposal.applicantId}
                    variant="compact"
                    avatarSize="sm"
                    statusText={proposalApplicantStatus(proposal, i18n)}
                    showHandle={false}
                    ariaLabel={t('trade.proposals.openPrivateThread')}
                    className="private-proposal-row__person"
                  />
                  <span className="private-proposal-row__status"><WebIcon name={proposalStatusIcon(proposal.status)} size={14} decorative /> {getStatusLabel(proposal.status, i18n)}</span>
                  <WebIcon name="arrow-right" size={16} decorative />
                </Link>
              );
            }
            return (
              <article key={proposal.id} className={active ? 'proposal-card proposal-card--active proposal-card--simple' : 'proposal-card proposal-card--simple'}>
                <div className="proposal-card__header proposal-card__header--thread">
                  <UserIdentityLink
                    user={proposal.applicant}
                    userId={proposal.applicantId}
                    href={threadHref}
                    variant="compact"
                    avatarSize="sm"
                    statusText={proposalApplicantStatus(proposal, i18n)}
                    showHandle={false}
                    ariaLabel={t('trade.proposals.openPrivateThread')}
                    className="proposal-card__thread-person"
                  />
                  <span className="semantic-badge proposal"><WebIcon name={proposalStatusIcon(proposal.status)} size={14} decorative /> {getStatusLabel(proposal.status, i18n)}</span>
                </div>
                <Link href={threadHref} className="proposal-card__open proposal-card__open--inline">
                  <WebIcon name="proposal" size={14} decorative /> {t('trade.proposals.openPrivateThread')}
                </Link>
              </article>
            );
          })}
        </div>
      ) : isOwner && !acceptedProposal && !notice ? (
        <p className={isPage ? 'private-proposal-empty-text' : 'proposal-empty-state'}>
          {isPage ? t('trade.proposals.noProposals') : (
            <>
              <WebIcon name="proposal" size={30} decorative />
              <strong>{t('trade.proposals.noProposals')}</strong>
              <span>{proposalCopy.ownerEmpty}</span>
            </>
          )}
        </p>
      ) : null}
    </section>
  );
}
