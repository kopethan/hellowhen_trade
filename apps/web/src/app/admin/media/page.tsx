'use client';

import { useMemo, useState } from 'react';
import type { MediaAssetDto, MediaAssetStatus } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { adminSessionRequiredMessage, useAdminSessionToken } from '../../../features/admin/adminSession';

type AdminMediaItem = MediaAssetDto & { owner?: { email?: string; profile?: { displayName?: string | null } | null } };
type MediaResponse = { media: AdminMediaItem[] };

const statuses: Array<MediaAssetStatus | 'all'> = ['all', 'active', 'flagged', 'removed', 'pending_review'];
function statusTone(status: MediaAssetStatus | 'all') {
  if (status === 'active') return 'success';
  if (status === 'pending_review') return 'warning';
  if (status === 'flagged') return 'danger';
  if (status === 'removed') return 'admin';
  return 'info';
}

function imageUrl(url: string, apiBase: string) {
  return url.startsWith('http') ? url : `${apiBase.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
}

function entityLabel(item: AdminMediaItem) {
  if (!item.entityType) return 'unattached';
  return item.entityId ? `${item.entityType} · ${item.entityId}` : item.entityType;
}

export default function AdminMediaPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [status, setStatus] = useState<MediaAssetStatus | 'all'>('active');
  const [items, setItems] = useState<AdminMediaItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadMedia() {
    if (!token) { setMessage(adminSessionRequiredMessage()); return; }
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
      const reviewNote = nextStatus === 'flagged'
        ? 'Flagged during beta media moderation.'
        : nextStatus === 'removed'
          ? 'Removed during beta media moderation.'
          : undefined;
      const response = await fetch(`${apiBase}/admin/media/${mediaId}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: nextStatus, reviewNote }) });
      if (!response.ok) throw new Error('Could not update media status');
      await loadMedia();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update media'); }
    finally { setLoading(false); }
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <span className="semantic-badge admin">Admin moderation</span>
        <h1>Uploaded images</h1>
        <p className="notice-box admin">Basic dev admin space for moderating uploaded need, offer, plan, profile, and support images. First-beta uploads are active immediately; use flag or remove only after reports or a manual check.</p>
        <p className="notice-box info">Internal tools use your signed-in admin app session. Standalone admin login is not exposed.</p>
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
            <img src={imageUrl(item.url, apiBase)} alt={item.filename} />
            <div className="status-row"><span className={`semantic-badge ${statusTone(item.status)}`}>{item.status.replace('_', ' ')}</span><span className="semantic-badge admin">{item.entityType ?? 'unattached'}</span></div>
            <h2>{item.filename}</h2>
            <p className="meta">Owner: {item.owner?.profile?.displayName ?? item.owner?.email ?? item.ownerId}</p>
            <p className="meta">Entity: {entityLabel(item)}</p>
            <div className="cta-row">
              <button className="success" onClick={() => { void updateStatus(item.id, 'active'); }}>Restore</button>
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
