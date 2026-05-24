'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import type { NeedDto, OfferDto, TradeDto, TradeProposalDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { getStatusLabel, getTradePostType, getTradeProposalCopy, type TradeI18n } from './tradePresentation';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { UserIdentityLink } from '../users/UserIdentityLink';
import { useWebTranslation } from '../../providers/WebI18nProvider';

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
      {sideItems.length ? (
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

export function TradeProposalPanel({ trade }: { trade: TradeDto }) {
  const auth = useWebAuth();
  const searchParams = useSearchParams();
  const { t, language } = useWebTranslation();
  const i18n = { t, language };
  const isOwner = auth.user?.id === trade.ownerId;
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
  const hasRequiredSide = requiredProposalSide === 'need' ? Boolean(selectedNeed) : requiredProposalSide === 'offer' ? Boolean(selectedOffer) : true;

  useEffect(() => {
    setProposedNeedId(proposalNeedIdFromUrl);
    setProposedOfferId(proposalOfferIdFromUrl);
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
      const response = await api.trades.createProposal(trade.id, {
        message,
        ...((requiredProposalSide === 'need' || !requiredProposalSide) && selectedNeed ? { proposedNeedId: selectedNeed.id } : {}),
        ...((requiredProposalSide === 'offer' || !requiredProposalSide) && selectedOffer ? { proposedOfferId: selectedOffer.id } : {})
      });
      const proposal = normalizeProposal(response);
      if (!proposal) throw new Error('missing_proposal_response');
      setProposals((current) => upsertProposal(current, proposal));
      setProposalMessage('');
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

  return (
    <section className="trade-social-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">{t('trade.labels.privateThread')}</p>
          <h2 className="icon-heading"><WebIcon name="proposal" size={21} decorative /> {isOwner ? t('trade.proposals.title') : ownActiveProposal ? t('trade.proposals.yourProposal') : proposalCopy.actionTitle}</h2>
        </div>
        {loading ? <span className="semantic-badge instruction">{t('trade.detail.updated')}</span> : null}
      </div>

      {acceptedProposal ? <AcceptedProposalPackage tradeId={trade.id} proposal={acceptedProposal} i18n={i18n} /> : null}

      {isOwner && visibleProposalList.length ? <p className="proposal-list-helper">{acceptedProposal ? t('trade.proposals.previousProposalListHint') : t('trade.proposals.proposalListHint')}</p> : null}
      {notice ? <p className="notice-box info">{notice}</p> : null}

      {latestOwnClosedProposal && canSendProposal ? <p className="notice-box info">{t('trade.proposals.canSendRevisedProposal')}</p> : null}

      {canSendProposal ? (
        <form className="proposal-composer proposal-composer--with-side" onSubmit={submitProposal}>
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

          <label className="field-label proposal-message-field">
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

      {visibleProposalList.length ? (
        <div className="proposal-list proposal-list--simple">
          {visibleProposalList.map((proposal) => {
            const active = proposal.status === 'accepted';
            const threadHref = `/trades/${trade.id}/proposals/${proposal.id}`;
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
        <div className="proposal-empty-state">
          <WebIcon name="proposal" size={30} decorative />
          <strong>{t('trade.proposals.noProposals')}</strong>
          <span>{proposalCopy.ownerEmpty}</span>
        </div>
      ) : null}
    </section>
  );
}
