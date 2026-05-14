'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import type { NeedDto, OfferDto, ProposalMessageDto, TradeDto, TradeProposalDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { getStatusLabel, getTradePostType, getTradeProposalCopy, type TradeI18n } from './tradePresentation';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { UserIdentityLink } from '../users/UserIdentityLink';
import { useWebTranslation } from '../../providers/WebI18nProvider';

type ProposalStatusResponse = { proposal?: TradeProposalDto; trade?: TradeDto };
type ProposalMessageResponse = { message?: ProposalMessageDto; proposal?: TradeProposalDto };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isProposal(value: unknown): value is TradeProposalDto {
  return isRecord(value) && typeof value.id === 'string' && typeof value.tradeId === 'string' && typeof value.applicantId === 'string' && typeof value.message === 'string';
}

function isProposalMessage(value: unknown): value is ProposalMessageDto {
  return isRecord(value) && typeof value.id === 'string' && typeof value.proposalId === 'string' && typeof value.senderId === 'string' && typeof value.body === 'string';
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

function normalizeProposalStatusResponse(value: unknown): ProposalStatusResponse {
  if (!isRecord(value)) return {};
  const proposal = normalizeProposal(value);
  const trade = isRecord(value.trade) && typeof value.trade.id === 'string' ? value.trade as TradeDto : undefined;
  return { proposal: proposal ?? undefined, trade };
}

function normalizeMessages(value: unknown): ProposalMessageDto[] {
  if (Array.isArray(value)) return value.filter(isProposalMessage);
  if (isRecord(value) && Array.isArray(value.messages)) return value.messages.filter(isProposalMessage);
  if (isRecord(value) && Array.isArray(value.items)) return value.items.filter(isProposalMessage);
  return [];
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

function normalizeProposalMessageResponse(value: unknown): ProposalMessageResponse {
  if (!isRecord(value)) return {};
  const response = value as { message?: unknown };
  if (isProposalMessage(value)) return { message: value };
  const message = isProposalMessage(response.message) ? response.message : undefined;
  const proposal = normalizeProposal(value);
  return { message, proposal: proposal ?? undefined };
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

function proposalApplicantStatus(proposal: TradeProposalDto, i18n?: TradeI18n) {
  const sideItem = proposalSideItem(proposal);
  if (sideItem?.kind === 'offer') return i18n?.t?.('trade.proposals.offerProposal') ?? 'Offer proposal';
  if (sideItem?.kind === 'need') return i18n?.t?.('trade.proposals.needProposal') ?? 'Need proposal';
  return i18n?.t?.('trade.proposals.tradeRequest') ?? 'Trade request';
}

function messageSenderStatus(message: ProposalMessageDto, currentUserId?: string | null, i18n?: TradeI18n) {
  if (message.senderId === currentUserId) return i18n?.t?.('trade.labels.you') ?? 'You';
  return i18n?.t?.('trade.labels.privateMessage') ?? 'Private message';
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


function proposalSideItem(proposal: TradeProposalDto): { kind: 'need'; item: NeedDto } | { kind: 'offer'; item: OfferDto } | null {
  if (proposal.proposedOffer) return { kind: 'offer', item: proposal.proposedOffer };
  if (proposal.proposedNeed) return { kind: 'need', item: proposal.proposedNeed };
  return null;
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

export function TradeProposalPanel({ trade, onTradeChange }: { trade: TradeDto; onTradeChange?: (trade: TradeDto) => void }) {
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
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ProposalMessageDto[]>([]);
  const [proposalMessage, setProposalMessage] = useState('');
  const [proposalNeeds, setProposalNeeds] = useState<NeedDto[]>([]);
  const [proposalOffers, setProposalOffers] = useState<OfferDto[]>([]);
  const [proposedNeedId, setProposedNeedId] = useState('');
  const [proposedOfferId, setProposedOfferId] = useState('');
  const [sideLoading, setSideLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedProposal = useMemo(() => proposals.find((proposal) => proposal.id === selectedProposalId) ?? proposals.find((proposal) => proposal.status === 'accepted') ?? proposals[0] ?? null, [proposals, selectedProposalId]);
  const ownProposal = useMemo(() => proposals.find((proposal) => proposal.applicantId === auth.user?.id), [auth.user?.id, proposals]);
  const activeProposalNeeds = useMemo(() => proposalNeeds.filter((need) => need.status === 'active'), [proposalNeeds]);
  const activeProposalOffers = useMemo(() => proposalOffers.filter((offer) => offer.status === 'active'), [proposalOffers]);
  const selectedNeed = useMemo(() => activeProposalNeeds.find((need) => need.id === proposedNeedId) ?? null, [activeProposalNeeds, proposedNeedId]);
  const selectedOffer = useMemo(() => activeProposalOffers.find((offer) => offer.id === proposedOfferId) ?? null, [activeProposalOffers, proposedOfferId]);
  const hasRequiredSide = requiredProposalSide === 'need' ? Boolean(selectedNeed) : requiredProposalSide === 'offer' ? Boolean(selectedOffer) : true;
  const canShowConversation = Boolean(selectedProposal && (selectedProposal.status === 'accepted' || isOwner || selectedProposal.applicantId === auth.user?.id));
  const canReplyToSelectedProposal = Boolean(selectedProposal && canShowConversation && !['declined', 'withdrawn'].includes(selectedProposal.status));


  useEffect(() => {
    if (proposalNeedIdFromUrl) {
      setProposedNeedId(proposalNeedIdFromUrl);
      setProposedOfferId('');
    } else if (proposalOfferIdFromUrl) {
      setProposedOfferId(proposalOfferIdFromUrl);
      setProposedNeedId('');
    }
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
        setProposals(nextProposals);
        setSelectedProposalId((current) => current && nextProposals.some((proposal) => proposal.id === current) ? current : nextProposals.find((proposal) => proposal.status === 'accepted')?.id ?? nextProposals[0]?.id ?? null);
      } catch {
        if (mounted) setNotice(t('trade.proposals.proposalAccessPrivate'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadProposals();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, trade.id]);


  useEffect(() => {
    if (!auth.isAuthenticated || isOwner || ownProposal || trade.status !== 'active') return;
    let mounted = true;
    async function loadProposalInventory() {
      setSideLoading(true);
      try {
        if (requiredProposalSide === 'offer') {
          const response = await api.offers.mine();
          const offers = normalizeOffers(response);
          if (!mounted) return;
          setProposalNeeds([]);
          setProposedNeedId('');
          setProposalOffers(offers);
          setProposedOfferId((current) => current && offers.some((offer) => offer.id === current && offer.status === 'active') ? current : '');
        } else if (requiredProposalSide === 'need') {
          const response = await api.needs.mine();
          const needs = normalizeNeeds(response);
          if (!mounted) return;
          setProposalOffers([]);
          setProposedOfferId('');
          setProposalNeeds(needs);
          setProposedNeedId((current) => current && needs.some((need) => need.id === current && need.status === 'active') ? current : '');
        } else {
          const [needsResponse, offersResponse] = await Promise.all([api.needs.mine(), api.offers.mine()]);
          const needs = normalizeNeeds(needsResponse);
          const offers = normalizeOffers(offersResponse);
          if (!mounted) return;
          setProposalNeeds(needs);
          setProposalOffers(offers);
          setProposedNeedId((current) => current && needs.some((need) => need.id === current && need.status === 'active') ? current : '');
          setProposedOfferId((current) => current && offers.some((offer) => offer.id === current && offer.status === 'active') ? current : '');
        }
      } catch {
        if (mounted) setNotice(t('trade.errors.couldNotLoadInventory'));
      } finally {
        if (mounted) setSideLoading(false);
      }
    }
    void loadProposalInventory();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, isOwner, ownProposal, proposalNeedIdFromUrl, proposalOfferIdFromUrl, requiredProposalSide, trade.status]);

  useEffect(() => {
    if (!selectedProposal || !auth.isAuthenticated || !canShowConversation) {
      setMessages([]);
      return;
    }
    const activeProposal = selectedProposal;
    let mounted = true;
    async function loadMessages() {
      try {
        const response = await api.proposals.messages(activeProposal.id);
        if (!mounted) return;
        const liveMessages = normalizeMessages(response);
        setMessages(liveMessages.length ? liveMessages : activeProposal.messages ?? []);
      } catch {
        if (mounted) setMessages(activeProposal.messages ?? []);
      }
    }
    void loadMessages();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, canShowConversation, selectedProposal]);

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = proposalMessage.trim();
    if (message.length < 3 || !hasRequiredSide) return;
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
      setSelectedProposalId(proposal.id);
      setProposalMessage('');
      setNotice(t('trade.proposals.proposalSent'));
    } catch (error) {
      const existingProposal = proposalFromError(error);
      if (existingProposal) {
        setProposals((current) => upsertProposal(current, existingProposal));
        setSelectedProposalId(existingProposal.id);
        setProposalMessage('');
      }
      setNotice(existingProposal ? t('trade.proposals.proposalAlreadyOpen') : t('trade.errors.couldNotSendProposal'));
    } finally {
      setLoading(false);
    }
  }

  async function updateProposalStatus(proposalId: string, status: 'accepted' | 'declined') {
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.proposals.updateStatus(proposalId, { status });
      const { proposal: updated, trade: nextTrade } = normalizeProposalStatusResponse(response);
      if (!updated) throw new Error('missing_proposal_response');
      setProposals((current) => {
        const withUpdated = upsertProposal(current, updated);
        if (status !== 'accepted') return withUpdated;
        return withUpdated.map((proposal) => proposal.id === updated.id ? proposal : proposal.status === 'pending' ? { ...proposal, status: 'declined' as const } : proposal);
      });
      if (nextTrade) onTradeChange?.(nextTrade);
      setSelectedProposalId(proposalId);
      setNotice(status === 'accepted' ? t('trade.proposals.proposalAccepted') : t('trade.proposals.proposalDeclined'));
      const refreshed = normalizeProposals(await api.trades.proposals(trade.id));
      if (refreshed.length) setProposals(refreshed);
    } catch {
      setNotice(t('trade.errors.couldNotUpdateProposal'));
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProposal) return;
    const body = reply.trim();
    if (!body) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.proposals.sendMessage(selectedProposal.id, { body });
      const { message: nextMessage, proposal: updatedProposal } = normalizeProposalMessageResponse(response);
      if (!nextMessage) throw new Error('missing_message_response');
      setMessages((current) => [...current, nextMessage]);
      if (updatedProposal) {
        const proposalMessages = updatedProposal.messages ?? [...(selectedProposal.messages ?? []), nextMessage];
        setProposals((current) => upsertProposal(current, { ...updatedProposal, messages: proposalMessages }));
      }
      setReply('');
    } catch {
      setNotice(t('trade.errors.couldNotSendMessage'));
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
          <h2 className="icon-heading"><WebIcon name="proposal" size={21} decorative /> {isOwner ? t('trade.proposals.title') : ownProposal ? t('trade.proposals.yourProposal') : proposalCopy.actionTitle}</h2>
        </div>
        {loading ? <span className="semantic-badge instruction">{t('trade.detail.updated')}</span> : null}
      </div>

      {notice ? <p className="notice-box info">{notice}</p> : null}

      {!isOwner && !ownProposal ? (
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

          {requiredProposalSide !== 'need' ? (
            <ProposalPickerShortcut
              side="offer"
              title={requiredProposalSide === 'offer' ? t('trade.proposals.chooseOfferToPropose') : t('trade.proposals.attachOfferToProposal')}
              count={activeProposalOffers.length}
              item={selectedOffer}
              emptyText={requiredProposalSide === 'offer' ? t('trade.proposals.createOfferFirst') : t('trade.proposals.createOfferOptional')}
              href={proposalChooseHref(trade.id, 'offer', '', proposedOfferId)}
              i18n={i18n}
            />
          ) : null}

          {requiredProposalSide !== 'offer' ? (
            <ProposalPickerShortcut
              side="need"
              title={requiredProposalSide === 'need' ? t('trade.proposals.chooseNeedToPropose') : t('trade.proposals.attachNeedToProposal')}
              count={activeProposalNeeds.length}
              item={selectedNeed}
              emptyText={requiredProposalSide === 'need' ? t('trade.proposals.createNeedFirst') : t('trade.proposals.createNeedOptional')}
              href={proposalChooseHref(trade.id, 'need', proposedNeedId, '')}
              i18n={i18n}
            />
          ) : null}

          <label className="field-label proposal-message-field">
            {t('trade.labels.message')}
            <textarea value={proposalMessage} onChange={(event) => setProposalMessage(event.target.value)} placeholder={proposalCopy.placeholder} rows={4} />
          </label>
          <button type="submit" disabled={loading || sideLoading || proposalMessage.trim().length < 3 || !hasRequiredSide}>{proposalCopy.actionButton}</button>
        </form>
      ) : null}

      {proposals.length ? (
        <div className="proposal-list">
          {proposals.map((proposal) => {
            const active = selectedProposal?.id === proposal.id;
            const sideItem = proposalSideItem(proposal);
            return (
              <article key={proposal.id} className={active ? 'proposal-card proposal-card--active' : 'proposal-card'}>
                <div className="proposal-card__header">
                  <UserIdentityLink
                    user={proposal.applicant}
                    userId={proposal.applicantId}
                    variant="compact"
                    avatarSize="sm"
                    statusText={proposalApplicantStatus(proposal, i18n)}
                    showHandle={false}
                    ariaLabel={t('profile.actions.openApplicantProfile')}
                  />
                  <span className="semantic-badge proposal"><WebIcon name={proposalStatusIcon(proposal.status)} size={14} decorative /> {getStatusLabel(proposal.status, i18n)}</span>
                </div>
                <button type="button" className="proposal-card__main" onClick={() => setSelectedProposalId(proposal.id)}>
                  {sideItem ? <ProposalSidePreview kind={sideItem.kind} item={sideItem.item} compact i18n={i18n} /> : null}
                  <span className="proposal-card__message">{proposal.message}</span>
                </button>
                {isOwner && proposal.status === 'pending' ? (
                  <div className="proposal-card__actions">
                    <button type="button" className="success" onClick={() => void updateProposalStatus(proposal.id, 'accepted')}>{t('trade.proposals.accept')}</button>
                    <button type="button" className="secondary" onClick={() => void updateProposalStatus(proposal.id, 'declined')}>{t('trade.proposals.decline')}</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : isOwner && !notice ? (
        <div className="proposal-empty-state">
          <WebIcon name="proposal" size={30} decorative />
          <strong>{t('trade.proposals.noProposals')}</strong>
          <span>{proposalCopy.ownerEmpty}</span>
        </div>
      ) : null}

      {selectedProposal && canShowConversation ? (
        <div className="conversation-panel">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">{t('trade.labels.conversation')}</p>
              <h3 className="icon-heading"><WebIcon name={proposalStatusIcon(selectedProposal.status)} size={18} decorative /> {selectedProposal.status === 'accepted' ? t('trade.proposals.acceptedTradeConversation') : t('trade.proposals.proposalConversation')}</h3>
            </div>
          </div>
          <div className="message-list">
            {(() => {
              const sideItem = proposalSideItem(selectedProposal);
              return (
                <article className="message-bubble message-bubble--proposal">
                  <UserIdentityLink
                    user={selectedProposal.applicant}
                    userId={selectedProposal.applicantId}
                    variant="compact"
                    avatarSize="sm"
                    statusText={t('trade.labels.proposalMessage')}
                    showHandle={false}
                    className="message-bubble__identity"
                  />
                  {sideItem ? <ProposalSidePreview kind={sideItem.kind} item={sideItem.item} compact i18n={i18n} /> : null}
                  <p>{selectedProposal.message}</p>
                </article>
              );
            })()}
            {messages.map((message) => (
              <article key={message.id} className="message-bubble">
                <UserIdentityLink
                  user={message.sender}
                  userId={message.senderId}
                  variant="compact"
                  avatarSize="sm"
                  statusText={messageSenderStatus(message, auth.user?.id, i18n)}
                  showHandle={false}
                  className="message-bubble__identity"
                />
                <p>{message.body}</p>
              </article>
            ))}
          </div>
          {canReplyToSelectedProposal ? (
            <form className="conversation-reply" onSubmit={sendReply}>
              <label className="sr-only" htmlFor="proposal-reply">{t('trade.proposals.reply')}</label>
              <textarea id="proposal-reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder={t('trade.proposals.replyPrivately')} rows={3} />
              <button type="submit" disabled={loading || !reply.trim()}>{t('trade.proposals.send')}</button>
            </form>
          ) : (
            <p className="meta">{t('trade.proposals.closedConversation')}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
