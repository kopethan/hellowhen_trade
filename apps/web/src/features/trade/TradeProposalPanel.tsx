'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import type { NeedDto, OfferDto, ProposalMessageDto, TradeDto, TradeProposalDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { getTradePostType, getTradeProposalCopy } from './tradePresentation';
import { useWebAuth } from '../../providers/WebAuthProvider';

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

function personName(proposal: TradeProposalDto) {
  return proposal.applicant?.profile?.displayName ?? proposal.applicant?.profile?.handle ?? 'Applicant';
}

function messageSender(message: ProposalMessageDto) {
  return message.sender?.profile?.displayName ?? message.sender?.profile?.handle ?? 'Message';
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

function firstMediaUrl(item: NeedDto | OfferDto) {
  return item.media?.find((media) => typeof media.url === 'string' && media.url.length > 0)?.url ?? null;
}

function sideMeta(item: NeedDto | OfferDto) {
  const sideTiming = (item as NeedDto).timing ?? (item as OfferDto).availability;
  return [item.category, item.mode, sideTiming].filter(Boolean).join(' · ') || item.itemType || 'Saved item';
}


function proposalSideItem(proposal: TradeProposalDto): { kind: 'need'; item: NeedDto } | { kind: 'offer'; item: OfferDto } | null {
  if (proposal.proposedOffer) return { kind: 'offer', item: proposal.proposedOffer };
  if (proposal.proposedNeed) return { kind: 'need', item: proposal.proposedNeed };
  return null;
}

function ProposalSidePreview({ kind, item, label, compact = false }: { kind: 'need' | 'offer'; item: NeedDto | OfferDto; label?: string; compact?: boolean }) {
  const mediaUrl = firstMediaUrl(item);
  const iconName: WebIconName = kind === 'offer' ? 'offer' : 'need';
  return (
    <div className={compact ? 'proposal-side-preview proposal-side-preview--compact' : 'proposal-side-preview'}>
      <div className="proposal-side-preview__media">
        {mediaUrl ? <img src={mediaUrl} alt="" /> : <WebIcon name={iconName} size={22} decorative />}
      </div>
      <div className="proposal-side-preview__body">
        <span className="proposal-side-preview__label">{label ?? (kind === 'offer' ? 'Proposed Offer' : 'Proposed Need')}</span>
        <strong>{item.title}</strong>
        <p>{item.description}</p>
        <em>{sideMeta(item)}</em>
      </div>
    </div>
  );
}

export function TradeProposalPanel({ trade, onTradeChange }: { trade: TradeDto; onTradeChange?: (trade: TradeDto) => void }) {
  const auth = useWebAuth();
  const isOwner = auth.user?.id === trade.ownerId;
  const proposalCopy = getTradeProposalCopy(trade);
  const requiredProposalSide = proposalSideRequirement(trade);
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
  const activeProposalNeeds = useMemo(() => proposalNeeds.filter((need) => !['fulfilled', 'closed', 'expired'].includes(need.status)), [proposalNeeds]);
  const activeProposalOffers = useMemo(() => proposalOffers.filter((offer) => !['accepted', 'closed', 'expired'].includes(offer.status)), [proposalOffers]);
  const selectedNeed = useMemo(() => activeProposalNeeds.find((need) => need.id === proposedNeedId) ?? null, [activeProposalNeeds, proposedNeedId]);
  const selectedOffer = useMemo(() => activeProposalOffers.find((offer) => offer.id === proposedOfferId) ?? null, [activeProposalOffers, proposedOfferId]);
  const hasRequiredSide = requiredProposalSide === 'need' ? Boolean(selectedNeed) : requiredProposalSide === 'offer' ? Boolean(selectedOffer) : true;
  const canShowConversation = Boolean(selectedProposal && (selectedProposal.status === 'accepted' || isOwner || selectedProposal.applicantId === auth.user?.id));
  const canReplyToSelectedProposal = Boolean(selectedProposal && canShowConversation && !['declined', 'withdrawn'].includes(selectedProposal.status));

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
        if (mounted) setNotice('Proposal access is private. Sign in as the creator or applicant to see live proposal threads.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadProposals();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, trade.id]);


  useEffect(() => {
    if (!auth.isAuthenticated || isOwner || ownProposal || !requiredProposalSide) return;
    let mounted = true;
    async function loadProposalInventory() {
      setSideLoading(true);
      try {
        if (requiredProposalSide === 'offer') {
          const response = await api.offers.mine();
          const offers = normalizeOffers(response);
          if (!mounted) return;
          setProposalOffers(offers);
          setProposedOfferId((current) => current && offers.some((offer) => offer.id === current) ? current : offers.find((offer) => !['accepted', 'closed', 'expired'].includes(offer.status))?.id ?? '');
        } else {
          const response = await api.needs.mine();
          const needs = normalizeNeeds(response);
          if (!mounted) return;
          setProposalNeeds(needs);
          setProposedNeedId((current) => current && needs.some((need) => need.id === current) ? current : needs.find((need) => !['fulfilled', 'closed', 'expired'].includes(need.status))?.id ?? '');
        }
      } catch {
        if (mounted) setNotice(requiredProposalSide === 'offer' ? 'Could not load your saved Offers yet.' : 'Could not load your saved Needs yet.');
      } finally {
        if (mounted) setSideLoading(false);
      }
    }
    void loadProposalInventory();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, isOwner, ownProposal, requiredProposalSide]);

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
        ...(requiredProposalSide === 'need' ? { proposedNeedId: selectedNeed?.id } : {}),
        ...(requiredProposalSide === 'offer' ? { proposedOfferId: selectedOffer?.id } : {})
      });
      const proposal = normalizeProposal(response);
      if (!proposal) throw new Error('missing_proposal_response');
      setProposals((current) => upsertProposal(current, proposal));
      setSelectedProposalId(proposal.id);
      setProposalMessage('');
      setNotice('Proposal sent. The creator can review it from this trade detail page.');
    } catch (error) {
      const existingProposal = proposalFromError(error);
      if (existingProposal) {
        setProposals((current) => upsertProposal(current, existingProposal));
        setSelectedProposalId(existingProposal.id);
        setProposalMessage('');
      }
      setNotice(existingProposal ? 'You already have a proposal on this trade, so the existing private thread is open below.' : 'Could not send the proposal yet. Check that you are signed in and the API is running.');
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
      setNotice(status === 'accepted' ? 'Proposal accepted. The trade is now in progress and the accepted private conversation stays here.' : 'Proposal declined.');
      const refreshed = normalizeProposals(await api.trades.proposals(trade.id));
      if (refreshed.length) setProposals(refreshed);
    } catch {
      setNotice('Could not update the proposal status yet.');
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
      setNotice('Could not send this message yet.');
    } finally {
      setLoading(false);
    }
  }

  if (!auth.hydrated) {
    return (
      <section className="trade-social-section">
        <h2><WebIcon name="proposal" size={21} decorative /> Proposals</h2>
        <p>Checking your account access...</p>
      </section>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="trade-social-section">
        <h2><WebIcon name="proposal" size={21} decorative /> {proposalCopy.signedOutTitle}</h2>
        <p>{proposalCopy.helper}</p>
        <Link href={`/auth?next=${encodeURIComponent(`/trades/${trade.id}`)}`} className="button primary full">Sign in to send a proposal</Link>
      </section>
    );
  }

  return (
    <section className="trade-social-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">Private thread</p>
          <h2 className="icon-heading"><WebIcon name="proposal" size={21} decorative /> {isOwner ? 'Proposals' : ownProposal ? 'Your proposal' : proposalCopy.actionTitle}</h2>
        </div>
        {loading ? <span className="semantic-badge instruction">Updating</span> : null}
      </div>

      {notice ? <p className="notice-box info">{notice}</p> : null}

      {!isOwner && !ownProposal ? (
        <form className={requiredProposalSide ? 'proposal-composer proposal-composer--with-side' : 'proposal-composer'} onSubmit={submitProposal}>
          {requiredProposalSide ? (
            <p className="proposal-side-callout">
              <WebIcon name={requiredProposalSide === 'offer' ? 'offer' : 'need'} size={17} decorative />
              {requiredProposalSide === 'offer'
                ? 'Choose one of your active Offers first. This is what you are proposing for the creator’s Open Need.'
                : 'Choose one of your active Needs first. This is what you are proposing for the creator’s Open Offer.'}
            </p>
          ) : null}
          {requiredProposalSide === 'offer' ? (
            <div className="proposal-side-picker">
              <div className="trade-section-heading compact">
                <div>
                  <p className="eyebrow">Your Offer</p>
                  <h3 className="icon-heading"><WebIcon name="offer" size={18} decorative /> Choose existing Offer to propose</h3>
                </div>
                {sideLoading ? <span className="semantic-badge instruction">Loading</span> : null}
              </div>
              {activeProposalOffers.length ? (
                <div className="trade-side-option-list proposal-side-option-list">
                  {activeProposalOffers.map((offer) => {
                    const mediaUrl = firstMediaUrl(offer);
                    return (
                      <button key={offer.id} type="button" className={offer.id === proposedOfferId ? 'trade-side-option is-active' : 'trade-side-option'} onClick={() => setProposedOfferId(offer.id)}>
                        <span className="trade-side-option__media">{mediaUrl ? <img src={mediaUrl} alt="" /> : 'O'}</span>
                        <span className="trade-side-option__body">
                          <span className="trade-side-option__top"><strong>{offer.title}</strong><em>Offer</em></span>
                          <span>{sideMeta(offer)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="proposal-empty-state proposal-empty-state--compact">
                  <WebIcon name="offer" size={28} decorative />
                  <strong>No active Offers yet</strong>
                  <span>Create or save an Offer first, then come back to propose it for this Open Need.</span>
                  <Link href="/offers" className="button secondary full">Go to Offers</Link>
                </div>
              )}
            </div>
          ) : null}

          {requiredProposalSide === 'need' ? (
            <div className="proposal-side-picker">
              <div className="trade-section-heading compact">
                <div>
                  <p className="eyebrow">Your Need</p>
                  <h3 className="icon-heading"><WebIcon name="need" size={18} decorative /> Choose existing Need to propose</h3>
                </div>
                {sideLoading ? <span className="semantic-badge instruction">Loading</span> : null}
              </div>
              {activeProposalNeeds.length ? (
                <div className="trade-side-option-list proposal-side-option-list">
                  {activeProposalNeeds.map((need) => {
                    const mediaUrl = firstMediaUrl(need);
                    return (
                      <button key={need.id} type="button" className={need.id === proposedNeedId ? 'trade-side-option is-active' : 'trade-side-option'} onClick={() => setProposedNeedId(need.id)}>
                        <span className="trade-side-option__media">{mediaUrl ? <img src={mediaUrl} alt="" /> : 'N'}</span>
                        <span className="trade-side-option__body">
                          <span className="trade-side-option__top"><strong>{need.title}</strong><em>Need</em></span>
                          <span>{sideMeta(need)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="proposal-empty-state proposal-empty-state--compact">
                  <WebIcon name="need" size={28} decorative />
                  <strong>No active Needs yet</strong>
                  <span>Create or save a Need first, then come back to propose it for this Open Offer.</span>
                  <Link href="/needs" className="button secondary full">Go to Needs</Link>
                </div>
              )}
            </div>
          ) : null}

          {requiredProposalSide === 'offer' && selectedOffer ? (
            <ProposalSidePreview kind="offer" item={selectedOffer} label="Selected Offer" />
          ) : null}

          {requiredProposalSide === 'need' && selectedNeed ? (
            <ProposalSidePreview kind="need" item={selectedNeed} label="Selected Need" />
          ) : null}

          <label className="field-label proposal-message-field">
            Message
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
                <button type="button" className="proposal-card__main" onClick={() => setSelectedProposalId(proposal.id)}>
                  <span className="proposal-card__header">
                    <span className="proposal-card__person">
                      <span className="proposal-card__avatar">{personName(proposal).slice(0, 1).toUpperCase()}</span>
                      <span>
                        <strong>{isOwner ? personName(proposal) : proposal.status === 'accepted' ? 'Accepted' : 'Proposal sent'}</strong>
                        <em>{sideItem ? (sideItem.kind === 'offer' ? 'Offer proposal' : 'Need proposal') : 'Trade request'}</em>
                      </span>
                    </span>
                    <span className="semantic-badge proposal"><WebIcon name={proposalStatusIcon(proposal.status)} size={14} decorative /> {proposal.status}</span>
                  </span>
                  {sideItem ? <ProposalSidePreview kind={sideItem.kind} item={sideItem.item} compact /> : null}
                  <span className="proposal-card__message">{proposal.message}</span>
                </button>
                {isOwner && proposal.status === 'pending' ? (
                  <div className="proposal-card__actions">
                    <button type="button" className="success" onClick={() => void updateProposalStatus(proposal.id, 'accepted')}>Accept</button>
                    <button type="button" className="secondary" onClick={() => void updateProposalStatus(proposal.id, 'declined')}>Decline</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : isOwner && !notice ? (
        <div className="proposal-empty-state">
          <WebIcon name="proposal" size={30} decorative />
          <strong>No proposals yet</strong>
          <span>{proposalCopy.ownerEmpty}</span>
        </div>
      ) : null}

      {selectedProposal && canShowConversation ? (
        <div className="conversation-panel">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">Conversation</p>
              <h3 className="icon-heading"><WebIcon name={proposalStatusIcon(selectedProposal.status)} size={18} decorative /> {selectedProposal.status === 'accepted' ? 'Accepted trade conversation' : 'Proposal conversation'}</h3>
            </div>
          </div>
          <div className="message-list">
            {(() => {
              const sideItem = proposalSideItem(selectedProposal);
              return (
                <article className="message-bubble message-bubble--proposal">
                  <strong>{personName(selectedProposal)}</strong>
                  {sideItem ? <ProposalSidePreview kind={sideItem.kind} item={sideItem.item} compact /> : null}
                  <p>{selectedProposal.message}</p>
                </article>
              );
            })()}
            {messages.map((message) => (
              <article key={message.id} className="message-bubble">
                <strong>{messageSender(message)}</strong>
                <p>{message.body}</p>
              </article>
            ))}
          </div>
          {canReplyToSelectedProposal ? (
            <form className="conversation-reply" onSubmit={sendReply}>
              <label className="sr-only" htmlFor="proposal-reply">Reply</label>
              <textarea id="proposal-reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply privately..." rows={3} />
              <button type="submit" disabled={loading || !reply.trim()}>Send</button>
            </form>
          ) : (
            <p className="meta">This proposal conversation is closed.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
