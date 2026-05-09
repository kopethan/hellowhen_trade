'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import type { ProposalMessageDto, TradeDto, TradeProposalDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useWebAuth } from '../../providers/WebAuthProvider';

function normalizeProposals(value: unknown): TradeProposalDto[] {
  if (Array.isArray(value)) return value as TradeProposalDto[];
  if (value && typeof value === 'object' && Array.isArray((value as { proposals?: unknown[] }).proposals)) return (value as { proposals: TradeProposalDto[] }).proposals;
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) return (value as { items: TradeProposalDto[] }).items;
  return [];
}

function normalizeMessages(value: unknown): ProposalMessageDto[] {
  if (Array.isArray(value)) return value as ProposalMessageDto[];
  if (value && typeof value === 'object' && Array.isArray((value as { messages?: unknown[] }).messages)) return (value as { messages: ProposalMessageDto[] }).messages;
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) return (value as { items: ProposalMessageDto[] }).items;
  return [];
}

function personName(proposal: TradeProposalDto) {
  return proposal.applicant?.profile?.displayName ?? proposal.applicant?.profile?.handle ?? 'Applicant';
}

function messageSender(message: ProposalMessageDto) {
  return message.sender?.profile?.displayName ?? message.sender?.profile?.handle ?? 'Message';
}

export function TradeProposalPanel({ trade }: { trade: TradeDto }) {
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
        setSelectedProposalId((current) => current ?? nextProposals.find((proposal) => proposal.status === 'accepted')?.id ?? nextProposals[0]?.id ?? null);
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
    let mounted = true;
    async function loadMessages() {
      try {
        const response = await api.proposals.messages(selectedProposal.id);
        if (!mounted) return;
        const liveMessages = normalizeMessages(response);
        setMessages(liveMessages.length ? liveMessages : selectedProposal.messages ?? []);
      } catch {
        if (mounted) setMessages(selectedProposal.messages ?? []);
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
      const proposal = await api.trades.createProposal(trade.id, { message }) as TradeProposalDto;
      setProposals((current) => [proposal, ...current.filter((item) => item.id !== proposal.id)]);
      setSelectedProposalId(proposal.id);
      setProposalMessage('');
      setNotice('Proposal sent. The creator can review it from this trade detail page.');
    } catch {
      setNotice('Could not send the proposal yet. Check that you are signed in and the API is running.');
    } finally {
      setLoading(false);
    }
  }

  async function updateProposalStatus(proposalId: string, status: 'accepted' | 'declined') {
    setLoading(true);
    setNotice(null);
    try {
      const updated = await api.proposals.updateStatus(proposalId, { status }) as TradeProposalDto;
      setProposals((current) => current.map((proposal) => proposal.id === proposalId ? { ...proposal, ...updated } : proposal));
      setSelectedProposalId(proposalId);
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
      const nextMessage = await api.proposals.sendMessage(selectedProposal.id, { body }) as ProposalMessageDto;
      setMessages((current) => [...current, nextMessage]);
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
        <h2>Proposals</h2>
        <p>Checking your account access...</p>
      </section>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="trade-social-section">
        <h2>Ask to trade</h2>
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
          <h2>{isOwner ? 'Proposals' : ownProposal ? 'Your proposal' : 'Ask to trade'}</h2>
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
                  <span className="semantic-badge proposal">{proposal.status}</span>
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
          <strong>No proposals yet</strong>
          <span>When someone asks to trade, the request will appear here.</span>
        </div>
      ) : null}

      {selectedProposal && canShowConversation ? (
        <div className="conversation-panel">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">Conversation</p>
              <h3>{selectedProposal.status === 'accepted' ? 'Accepted trade conversation' : 'Proposal conversation'}</h3>
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
          <form className="conversation-reply" onSubmit={sendReply}>
            <label className="sr-only" htmlFor="proposal-reply">Reply</label>
            <textarea id="proposal-reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply privately..." rows={3} />
            <button type="submit" disabled={loading || !reply.trim()}>Send</button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
