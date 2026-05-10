'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import type { ProposalMessageDto, TradeDto, TradeProposalDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { api } from '../../lib/api';
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

export function TradeProposalPanel({ trade, onTradeChange }: { trade: TradeDto; onTradeChange?: (trade: TradeDto) => void }) {
  const auth = useWebAuth();
  const isOwner = auth.user?.id === trade.ownerId;
  const [proposals, setProposals] = useState<TradeProposalDto[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ProposalMessageDto[]>([]);
  const [proposalMessage, setProposalMessage] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedProposal = useMemo(() => proposals.find((proposal) => proposal.id === selectedProposalId) ?? proposals.find((proposal) => proposal.status === 'accepted') ?? proposals[0] ?? null, [proposals, selectedProposalId]);
  const ownProposal = useMemo(() => proposals.find((proposal) => proposal.applicantId === auth.user?.id), [auth.user?.id, proposals]);
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
    if (message.length < 3) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.trades.createProposal(trade.id, { message });
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
        <h2><WebIcon name="proposal" size={21} decorative /> Ask to trade</h2>
        <p>Proposal messages are private between the creator and applicant, but they live here on the Trade Detail page.</p>
        <Link href="/auth" className="button primary full">Sign in to send a proposal</Link>
      </section>
    );
  }

  return (
    <section className="trade-social-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">Private thread</p>
          <h2 className="icon-heading"><WebIcon name="proposal" size={21} decorative /> {isOwner ? 'Proposals' : ownProposal ? 'Your proposal' : 'Ask to trade'}</h2>
        </div>
        {loading ? <span className="semantic-badge instruction">Updating</span> : null}
      </div>

      {notice ? <p className="notice-box info">{notice}</p> : null}

      {!isOwner && !ownProposal ? (
        <form className="proposal-composer" onSubmit={submitProposal}>
          <label className="field-label">
            Message
            <textarea value={proposalMessage} onChange={(event) => setProposalMessage(event.target.value)} placeholder="Write a short note about how you can trade..." rows={4} />
          </label>
          <button type="submit" disabled={loading || proposalMessage.trim().length < 3}>Send proposal</button>
        </form>
      ) : null}

      {proposals.length ? (
        <div className="proposal-list">
          {proposals.map((proposal) => {
            const active = selectedProposal?.id === proposal.id;
            return (
              <article key={proposal.id} className={active ? 'proposal-card proposal-card--active' : 'proposal-card'}>
                <button type="button" className="proposal-card__main" onClick={() => setSelectedProposalId(proposal.id)}>
                  <span className="semantic-badge proposal"><WebIcon name={proposalStatusIcon(proposal.status)} size={14} decorative /> {proposal.status}</span>
                  <strong>{isOwner ? personName(proposal) : proposal.status === 'accepted' ? 'Accepted' : 'Proposal sent'}</strong>
                  <span>{proposal.message}</span>
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
          <span>When someone asks to trade, the request will appear here.</span>
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
            <article className="message-bubble message-bubble--proposal">
              <strong>{personName(selectedProposal)}</strong>
              <p>{selectedProposal.message}</p>
            </article>
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
