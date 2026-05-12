'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { AdminContentActionResponse, AdminContentItemDto, AdminContentResponse } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime } from '../../../lib/webFormat';

type LoginResponse = { accessToken: string } | { requiresTwoFactor: true; challengeToken: string; message?: string };
type ContentTypeFilter = 'all' | 'trade' | 'need' | 'offer';
type ContentAction = 'hide' | 'restore' | 'close' | 'mark_reviewed';

type Notice = { tone: 'info' | 'warning' | 'danger' | 'success'; body: string };

const adminTokenKey = 'hellowhen:admin_access_token';
const contentTypes: ContentTypeFilter[] = ['all', 'trade', 'need', 'offer'];
const statusOptions = ['all', 'active', 'draft', 'closed', 'expired', 'funded', 'in_progress', 'submitted', 'disputed', 'completed', 'cancelled', 'fulfilled', 'accepted'];

function isTwoFactorRequired(value: LoginResponse): value is Extract<LoginResponse, { requiresTwoFactor: true }> {
  return 'requiresTwoFactor' in value && value.requiresTwoFactor === true;
}

function labelize(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'unknown';
}

function statusTone(value?: string | null) {
  if (value === 'active' || value === 'completed' || value === 'fulfilled' || value === 'accepted') return 'success';
  if (value === 'funded' || value === 'in_progress' || value === 'submitted') return 'warning';
  if (value === 'disputed' || value === 'cancelled') return 'danger';
  if (value === 'closed' || value === 'expired') return 'admin';
  return 'info';
}

function typeTone(type: string) {
  if (type === 'trade') return 'trade';
  if (type === 'need') return 'info';
  return 'proposal';
}

function personLabel(user?: { email?: string; profile?: { displayName?: string | null; handle?: string | null } | null } | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}

function contentMeta(item: AdminContentItemDto) {
  const parts = [
    labelize(item.category),
    labelize(item.itemType),
    labelize(item.mode),
  ].filter((part) => part && part !== 'unknown');
  if (item.type === 'trade') parts.push(`${item.proposalCount ?? 0} proposals`);
  if (item.type !== 'trade') parts.push(`${item.linkedTradeCount ?? 0} linked trades`);
  parts.push(`${item.mediaCount ?? 0} images`);
  return parts.join(' · ');
}

function actionDescription(action: ContentAction, item: AdminContentItemDto) {
  if (action === 'hide') return item.type === 'trade' ? 'Hide removes the trade from public discovery without deleting it.' : 'Hide closes this inventory item without deleting it.';
  if (action === 'restore') return 'Restore makes this item active/public again when safe.';
  if (action === 'close') return 'Close ends this item. For funded or disputed trades, use the dispute flow instead.';
  return 'Mark reviewed only writes an audit entry.';
}

export default function AdminContentModerationPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const [email, setEmail] = useState('admin@hellowhen.app');
  const [password, setPassword] = useState('password123');
  const [token, setToken] = useState('');
  const [type, setType] = useState<ContentTypeFilter>('all');
  const [status, setStatus] = useState('active');
  const [query, setQuery] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [items, setItems] = useState<AdminContentItemDto[]>([]);
  const [selectedItem, setSelectedItem] = useState<AdminContentItemDto | null>(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  useEffect(() => {
    const saved = window.localStorage.getItem(adminTokenKey);
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) window.localStorage.setItem(adminTokenKey, token);
  }, [token]);

  async function login() {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error('Login failed. Check the admin credentials.');
      const data = await response.json() as LoginResponse;
      if (isTwoFactorRequired(data)) throw new Error(data.message || 'This admin account requires two-step verification. Use an app session that already satisfies admin 2FA.');
      setToken(data.accessToken);
      window.localStorage.setItem(adminTokenKey, data.accessToken);
      setNotice({ tone: 'success', body: 'Admin logged in. Load content to moderate trades, needs, and offers.' });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Login failed.' });
    } finally {
      setLoading(false);
    }
  }

  function queryString() {
    const params = new URLSearchParams();
    params.set('type', type);
    if (status !== 'all') params.set('status', status);
    if (query.trim()) params.set('q', query.trim());
    if (ownerId.trim()) params.set('ownerId', ownerId.trim());
    const text = params.toString();
    return text ? `?${text}` : '';
  }

  async function loadContent() {
    if (!token) { setNotice({ tone: 'warning', body: 'Log in as admin first.' }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/content${queryString()}`, { headers });
      if (!response.ok) throw new Error('Could not load admin content. Make sure this account has admin role and satisfies 2FA requirements.');
      const data = await response.json() as AdminContentResponse;
      setItems(data.content);
      if (selectedItem) setSelectedItem(data.content.find((item) => item.id === selectedItem.id && item.type === selectedItem.type) ?? null);
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load content.' });
    } finally {
      setLoading(false);
    }
  }

  async function applyAction(action: ContentAction) {
    if (!token || !selectedItem) return;
    if ((action === 'hide' || action === 'restore' || action === 'close') && !note.trim()) {
      setNotice({ tone: 'warning', body: 'Add an internal note before changing content visibility or status.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/content/${selectedItem.type}/${selectedItem.id}/action`, { method: 'PATCH', headers, body: JSON.stringify({ action, note: note.trim() || undefined }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not apply moderation action.');
      }
      const data = await response.json() as AdminContentActionResponse;
      setSelectedItem(data.item);
      setItems((current) => current.map((item) => item.id === data.item.id && item.type === data.item.type ? data.item : item));
      setNote('');
      setNotice({ tone: 'success', body: `Content moderation action saved: ${labelize(action)}.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not moderate content.' });
    } finally {
      setLoading(false);
    }
  }

  function selectItem(item: AdminContentItemDto) {
    setSelectedItem(item);
    setNote('');
  }

  return (
    <main className="admin-console">
      <section className="app-card admin-console__hero">
        <div className="status-row">
          <span className="semantic-badge danger">Content moderation</span>
          <Link className="button secondary" href="/admin">Back to admin</Link>
        </div>
        <div>
          <p className="eyebrow">Phase 24.1</p>
          <h1>Trades, needs, and offers</h1>
          <p>Hide, restore, close, or mark reviewed content without deleting user data. Every action writes to the admin audit log.</p>
        </div>
        <div className="admin-console__login-grid">
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Admin email" autoComplete="username" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" autoComplete="current-password" />
          <button type="button" onClick={() => { void login(); }} disabled={loading}>{token ? 'Refresh login' : 'Log in'}</button>
          <button type="button" className="secondary" onClick={() => { setToken(''); window.localStorage.removeItem(adminTokenKey); }} disabled={!token}>Clear token</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Search</span><span className="semantic-badge admin">No deletes</span></div>
          <h2>Content queue</h2>
          <div className="admin-trust-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or description" />
            <select value={type} onChange={(event) => setType(event.target.value as ContentTypeFilter)}>
              {contentTypes.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
            <input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} placeholder="Owner ID optional" />
            <button type="button" onClick={() => { void loadContent(); }} disabled={loading || !token}>Load content</button>
          </div>
          <div className="admin-user-list">
            {items.map((item) => (
              <button type="button" key={`${item.type}:${item.id}`} className={selectedItem?.id === item.id && selectedItem.type === item.type ? 'admin-user-row is-active' : 'admin-user-row'} onClick={() => selectItem(item)}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{personLabel(item.owner)} · {contentMeta(item)}</small>
                  <small>{formatWebDateTime(item.createdAt)} · {item.id}</small>
                </span>
                <span className="status-row">
                  <em className={`semantic-badge ${statusTone(item.status)}`}>{labelize(item.status)}</em>
                  {item.publicDiscoverable === false ? <em className="semantic-badge warning">not discoverable</em> : item.publicDiscoverable === true ? <em className="semantic-badge success">discoverable</em> : null}
                </span>
              </button>
            ))}
            {items.length === 0 ? <p>No content loaded yet.</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          {selectedItem ? (
            <>
              <div className="status-row">
                <span className={`semantic-badge ${typeTone(selectedItem.type)}`}>{selectedItem.type}</span>
                <span className={`semantic-badge ${statusTone(selectedItem.status)}`}>{labelize(selectedItem.status)}</span>
                {selectedItem.type === 'trade' ? <span className={`semantic-badge ${selectedItem.isPublic ? 'success' : 'admin'}`}>{selectedItem.isPublic ? 'public' : 'hidden'}</span> : null}
                {selectedItem.publicDiscoverable === false ? <span className="semantic-badge warning">not public-discoverable</span> : selectedItem.publicDiscoverable === true ? <span className="semantic-badge success">public-discoverable</span> : null}
              </div>
              <h2>{selectedItem.title}</h2>
              <p className="meta">Owner: {personLabel(selectedItem.owner)} · {selectedItem.ownerId}</p>
              <p>{selectedItem.description}</p>
              {selectedItem.visibilityBlockers?.length ? (
                <p className="notice-box warning">Public discovery blockers: {selectedItem.visibilityBlockers.join(' · ')}</p>
              ) : null}
              <div className="admin-money-strip">
                <span><small>Images</small><strong>{selectedItem.mediaCount ?? 0}</strong></span>
                <span><small>{selectedItem.type === 'trade' ? 'Proposals' : 'Linked trades'}</small><strong>{selectedItem.type === 'trade' ? selectedItem.proposalCount ?? 0 : selectedItem.linkedTradeCount ?? 0}</strong></span>
                <span><small>Updated</small><strong>{formatWebDateTime(selectedItem.updatedAt)}</strong></span>
              </div>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal admin note. Required before visibility/status actions." rows={4} />
              <div className="admin-action-grid">
                <button type="button" className="warning" onClick={() => { void applyAction('hide'); }} disabled={loading || !token}>Hide</button>
                <button type="button" className="success" onClick={() => { void applyAction('restore'); }} disabled={loading || !token}>Restore</button>
                <button type="button" className="danger" onClick={() => { void applyAction('close'); }} disabled={loading || !token}>Close</button>
                <button type="button" className="secondary" onClick={() => { void applyAction('mark_reviewed'); }} disabled={loading || !token}>Mark reviewed</button>
                {selectedItem.type === 'trade' ? <Link className="button secondary" href={`/trades/${selectedItem.id}`}>Open trade</Link> : null}
                {selectedItem.type !== 'trade' ? <Link className="button secondary" href={`/${selectedItem.type === 'need' ? 'needs' : 'offers'}/${selectedItem.id}`}>Open item</Link> : null}
              </div>
              <p className="notice-box warning">{actionDescription('hide', selectedItem)} {actionDescription('close', selectedItem)}</p>
            </>
          ) : (
            <>
              <div className="status-row"><span className="semantic-badge admin">Select content</span></div>
              <h2>Moderation detail</h2>
              <p>Select a trade, need, or offer to change visibility/status safely. Use media moderation for image-specific actions.</p>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
