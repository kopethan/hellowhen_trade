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
  const [status, setStatus] = useState<MediaAssetStatus | 'all'>('pending_review');
  const [items, setItems] = useState<AdminMediaItem[]>([]);
  const [reviewNote, setReviewNote] = useState('');
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
    if (!reviewNote.trim()) { setMessage('Add an internal review note before flagging, removing, or restoring media.'); return; }
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${apiBase}/admin/media/${mediaId}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: nextStatus, reviewNote: reviewNote.trim() }) });
      if (!response.ok) throw new Error('Could not update media status');
      setReviewNote('');
      await loadMedia();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update media'); }
    finally { setLoading(false); }
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <span className="semantic-badge admin">Admin moderation</span>
        <h1>Uploaded images</h1>
        <p className="notice-box admin">Admin space for reviewing uploaded images. When PUBLIC_IMAGE_REVIEW_ENABLED=true, public trade, need, offer, and profile images stay pending until approval.</p>
        <p className="notice-box info">Internal tools use your signed-in admin app session. Standalone admin login is not exposed.</p>
        <div className="form-row" style={{ marginTop: 12 }}>
          <select value={status} onChange={(event) => setStatus(event.target.value as MediaAssetStatus | 'all')}>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button className="secondary" onClick={() => { void loadMedia(); }} disabled={loading}>Load media</button>
        </div>
        <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Internal review note. Required before flagging, removing, or restoring media." rows={3} style={{ marginTop: 12 }} />
        <p className="notice-box info">Media moderation is reversible: Approve/restore moves an item back to active, pending keeps it hidden from public surfaces, and every change remains in the audit log.</p>
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
              <button className="success" onClick={() => { void updateStatus(item.id, 'active'); }}>Approve</button>
              <button className="secondary" onClick={() => { void updateStatus(item.id, 'pending_review'); }}>Keep pending</button>
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
