'use client';

import { useMemo, useState } from 'react';
import type { MediaAssetDto, MediaAssetStatus } from '@hellowhen/contracts';

type LoginResponse = { accessToken: string };
type AdminMediaItem = MediaAssetDto & { owner?: { email?: string; profile?: { displayName?: string | null } | null } };
type MediaResponse = { media: AdminMediaItem[] };

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const statuses: Array<MediaAssetStatus | 'all'> = ['all', 'active', 'pending_review', 'flagged', 'removed'];
function statusTone(status: MediaAssetStatus | 'all') {
  if (status === 'active') return 'success';
  if (status === 'pending_review') return 'warning';
  if (status === 'flagged') return 'danger';
  if (status === 'removed') return 'admin';
  return 'info';
}

function imageUrl(url: string) {
  return url.startsWith('http') ? url : `${apiBase.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
}

function entityLabel(item: AdminMediaItem) {
  if (!item.entityType) return 'unattached';
  return item.entityId ? `${item.entityType} · ${item.entityId}` : item.entityType;
}

export default function AdminMediaPage() {
  const [email, setEmail] = useState('admin@hellowhen.app');
  const [password, setPassword] = useState('password123');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<MediaAssetStatus | 'all'>('active');
  const [items, setItems] = useState<AdminMediaItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  async function login() {
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error('Login failed');
      const data = await response.json() as LoginResponse;
      setToken(data.accessToken);
      setMessage('Admin logged in. Load media to review uploads.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Login failed'); }
    finally { setLoading(false); }
  }

  async function loadMedia() {
    if (!token) { setMessage('Log in as admin first.'); return; }
    setLoading(true); setMessage(null);
    try {
      const query = status === 'all' ? '' : `?status=${status}`;
      const response = await fetch(`${apiBase}/admin/media${query}`, { headers });
      if (!response.ok) throw new Error('Could not load admin media. Make sure this account has admin role.');
      const data = await response.json() as MediaResponse;
      setItems(data.media);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load media'); }
    finally { setLoading(false); }
  }

  async function updateStatus(mediaId: string, nextStatus: MediaAssetStatus) {
    if (!token) return;
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/media/${mediaId}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: nextStatus }) });
      if (!response.ok) throw new Error('Could not update media status');
      await loadMedia();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update media'); }
    finally { setLoading(false); }
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <span className="semantic-badge admin">Admin Review</span>
        <h1>Uploaded images</h1>
        <p className="notice-box admin">Basic dev admin space for reviewing need, offer, and trade images. Admin colors are slate; warning means pending review; danger means flagged or removed action.</p>
        <div className="form-row">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Admin email" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
          </div>
          <button onClick={() => { void login(); }} disabled={loading}>{token ? 'Logged in' : 'Login'}</button>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <select value={status} onChange={(event) => setStatus(event.target.value as MediaAssetStatus | 'all')}>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button className="secondary" onClick={() => { void loadMedia(); }} disabled={loading}>Load media</button>
        </div>
        {message ? <p className="notice-box info">{message}</p> : null}
      </div>
      <div className="media-grid">
        {items.map((item) => (
          <article className="card media-card" key={item.id}>
            <img src={imageUrl(item.url)} alt={item.filename} />
            <div className="status-row"><span className={`semantic-badge ${statusTone(item.status)}`}>{item.status.replace('_', ' ')}</span><span className="semantic-badge admin">{item.entityType ?? 'unattached'}</span></div>
            <h2>{item.filename}</h2>
            <p className="meta">Owner: {item.owner?.profile?.displayName ?? item.owner?.email ?? item.ownerId}</p>
            <p className="meta">Entity: {entityLabel(item)}</p>
            <div className="cta-row">
              <button className="success" onClick={() => { void updateStatus(item.id, 'active'); }}>Approve</button>
              <button className="warning" onClick={() => { void updateStatus(item.id, 'flagged'); }}>Flag</button>
              <button className="danger" onClick={() => { void updateStatus(item.id, 'removed'); }}>Remove</button>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 ? <div className="card"><p>No media loaded yet.</p></div> : null}
    </section>
  );
}
