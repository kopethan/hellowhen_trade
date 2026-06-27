'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime } from '../../../lib/webFormat';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type PlaceStatusFilter = 'all' | 'draft' | 'active' | 'archived' | 'hidden';
type PlaceSourceFilter = 'all' | 'user' | 'hellowhen_library';
type PlaceVisibilityFilter = 'all' | 'private' | 'public' | 'library';
type PlaceModeFilter = 'all' | 'local' | 'remote';
type PlaceAction = 'hide' | 'restore' | 'remove_media' | 'mark_reviewed';

type AdminUser = {
  id: string;
  email?: string | null;
  role?: string | null;
  trustTier?: string | null;
  profile?: { displayName?: string | null; handle?: string | null; avatarUrl?: string | null } | null;
};

type AdminPlaceMedia = {
  id: string;
  url: string;
  filename: string;
  status: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
};

type AdminPlaceReport = {
  id: string;
  reason: string;
  status: string;
  details?: string | null;
  targetType: string;
  targetId: string;
  createdAt?: string | null;
  reporter?: AdminUser | null;
};

type AdminPlace = {
  id: string;
  ownerId?: string | null;
  source: string;
  status: string;
  visibility: string;
  visibilityLabel?: string;
  mode?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  areaLabel?: string | null;
  addressPublicText?: string | null;
  addressPrivateText?: string | null;
  onlineLabel?: string | null;
  onlineUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  archivedAt?: string | null;
  owner?: AdminUser | null;
  media?: AdminPlaceMedia[];
  planPlaces?: Array<{ id: string; title: string; planId: string; createdAt?: string | null; plan?: { id: string; title: string; status: string; startsAt?: string | null; owner?: AdminUser | null } | null }>;
  planUsageCount?: number;
  reportsCount?: number;
  recentReports?: AdminPlaceReport[];
};

const statusOptions: PlaceStatusFilter[] = ['all', 'draft', 'active', 'archived', 'hidden'];
const sourceOptions: PlaceSourceFilter[] = ['all', 'user', 'hellowhen_library'];
const visibilityOptions: PlaceVisibilityFilter[] = ['all', 'private', 'public', 'library'];
const modeOptions: PlaceModeFilter[] = ['all', 'local', 'remote'];
const placeActions: PlaceAction[] = ['hide', 'restore', 'mark_reviewed'];

function labelize(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'unknown';
}

function personLabel(user?: AdminUser | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Hellowhen Library';
}

function statusTone(status?: string | null) {
  if (status === 'active') return 'success';
  if (status === 'draft') return 'warning';
  if (status === 'hidden' || status === 'archived' || status === 'removed' || status === 'flagged') return 'danger';
  if (status === 'pending_review') return 'warning';
  return 'admin';
}

function visibilityTone(visibility?: string | null) {
  if (visibility === 'public' || visibility === 'library') return 'success';
  if (visibility === 'hidden' || visibility === 'archived') return 'danger';
  return 'admin';
}

function dateLabel(value?: string | null) {
  return value ? formatWebDateTime(value) : 'Not set';
}

function countLabel(value?: number | null) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

function actionLabel(action: PlaceAction) {
  if (action === 'mark_reviewed') return 'Mark reviewed';
  if (action === 'remove_media') return 'Remove image';
  return labelize(action).replace(/^./, (value) => value.toUpperCase());
}

function actionDescription(action: PlaceAction) {
  if (action === 'hide') return 'Hide this Place from pickers and public surfaces without deleting old Plan snapshots.';
  if (action === 'restore') return 'Restore this Place to active status when the content is safe again.';
  if (action === 'remove_media') return 'Remove one unsafe image attached to this Place and resolve linked media reports.';
  return 'Write an audit entry without changing this Place.';
}

function placeMeta(place: AdminPlace) {
  return [
    labelize(place.source),
    labelize(place.visibilityLabel ?? place.visibility),
    labelize(place.mode),
    place.category,
    place.areaLabel || place.onlineLabel,
    `${countLabel(place.planUsageCount)} Plan uses`,
    `${countLabel(place.media?.length)} images`,
    `${countLabel(place.reportsCount)} reports`,
  ].filter((item) => item && item !== 'unknown').join(' · ');
}

export default function AdminPlacesPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [places, setPlaces] = useState<AdminPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<AdminPlace | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [status, setStatus] = useState<PlaceStatusFilter>('all');
  const [source, setSource] = useState<PlaceSourceFilter>('all');
  const [visibility, setVisibility] = useState<PlaceVisibilityFilter>('all');
  const [mode, setMode] = useState<PlaceModeFilter>('all');
  const [query, setQuery] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setPlaces([]);
    setSelectedPlace(null);
    setSelectedMediaId('');
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function queryString() {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (source !== 'all') params.set('source', source);
    if (visibility !== 'all') params.set('visibility', visibility);
    if (mode !== 'all') params.set('mode', mode);
    if (query.trim()) params.set('q', query.trim());
    if (ownerId.trim()) params.set('ownerId', ownerId.trim());
    const text = params.toString();
    return text ? `?${text}` : '';
  }

  async function loadPlaces() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/places${queryString()}`, { headers });
      if (!response.ok) throw new Error('Could not load Places. Make sure this account has admin role and satisfies 2FA requirements.');
      const data = await response.json() as { places: AdminPlace[] };
      setPlaces(data.places);
      if (selectedPlace) setSelectedPlace(data.places.find((place) => place.id === selectedPlace.id) ?? null);
      setNotice({ tone: 'success', body: `Loaded ${data.places.length} Place${data.places.length === 1 ? '' : 's'}. Select one to review owner, images, usage, and reports.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Places.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaceDetail(placeId: string) {
    if (!token) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/places/${placeId}`, { headers });
      if (!response.ok) throw new Error('Could not load Place detail.');
      const data = await response.json() as { place: AdminPlace };
      setSelectedPlace(data.place);
      setSelectedMediaId(data.place.media?.[0]?.id ?? '');
      setPlaces((current) => current.map((place) => place.id === data.place.id ? data.place : place));
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Place detail.' });
    } finally {
      setLoading(false);
    }
  }

  async function applyAction(action: PlaceAction, mediaId?: string) {
    if (!token || !selectedPlace) return;
    if (action !== 'mark_reviewed' && !note.trim()) {
      setNotice({ tone: 'warning', body: 'Add an internal note before hiding, restoring, or removing a Place image.' });
      return;
    }
    if (action === 'remove_media' && !mediaId) {
      setNotice({ tone: 'warning', body: 'Choose a Place image before removing media.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/places/${selectedPlace.id}/action`, { method: 'PATCH', headers, body: JSON.stringify({ action, mediaId, note: note.trim() || undefined }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not apply Place action.');
      }
      const data = await response.json() as { place: AdminPlace };
      setSelectedPlace(data.place);
      setSelectedMediaId(data.place.media?.find((item) => item.status !== 'removed')?.id ?? data.place.media?.[0]?.id ?? '');
      setPlaces((current) => current.map((place) => place.id === data.place.id ? data.place : place));
      setNotice({ tone: 'success', body: `Place action saved: ${actionLabel(action)}.` });
      if (action !== 'mark_reviewed') setNote('');
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not apply Place action.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-console">
      <section className="admin-console__hero app-card">
        <div className="status-row">
          <span className="semantic-badge admin">Places admin</span>
          <span className="semantic-badge warning">Media-safe moderation</span>
        </div>
        <div>
          <p className="eyebrow">Place moderation</p>
          <h1>All Places</h1>
          <p>Review user-created Places, Hellowhen Library Places, owner details, attached images, Plan usage, and linked reports. Hide or restore Places without deleting old Plan snapshots.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Internal tools use your signed-in admin app session. Removing an unsafe image marks the media as removed and keeps audit history.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        <div className="cta-row">
          <Link className="button secondary" href="/admin">Back to admin</Link>
          <Link className="button secondary" href="/admin/media?entityType=place">Open media queue</Link>
          <Link className="button secondary" href="/admin/plans">Open Plans admin</Link>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Search</span><span className="semantic-badge admin">No hard delete</span></div>
          <h2>Place queue</h2>
          <div className="admin-trust-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, area, owner" />
            <select value={status} onChange={(event) => setStatus(event.target.value as PlaceStatusFilter)}>
              {statusOptions.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
            <select value={source} onChange={(event) => setSource(event.target.value as PlaceSourceFilter)}>
              {sourceOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'all sources' : labelize(item)}</option>)}
            </select>
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as PlaceVisibilityFilter)}>
              {visibilityOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'all visibility' : labelize(item)}</option>)}
            </select>
            <select value={mode} onChange={(event) => setMode(event.target.value as PlaceModeFilter)}>
              {modeOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'all modes' : labelize(item)}</option>)}
            </select>
            <input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} placeholder="Owner ID optional" />
            <button type="button" onClick={() => { void loadPlaces(); }} disabled={loading || !token}>Load Places</button>
          </div>
          <div className="admin-user-list">
            {places.map((place) => (
              <button type="button" key={place.id} className={selectedPlace?.id === place.id ? 'admin-user-row is-active' : 'admin-user-row'} onClick={() => { void loadPlaceDetail(place.id); }}>
                <span>
                  <strong>{place.title}</strong>
                  <small>{personLabel(place.owner)} · {placeMeta(place)}</small>
                  <small>{dateLabel(place.updatedAt)} · {place.id}</small>
                </span>
                <span className="status-row">
                  <em className={`semantic-badge ${statusTone(place.status)}`}>{labelize(place.status)}</em>
                  <em className={`semantic-badge ${visibilityTone(place.visibilityLabel ?? place.visibility)}`}>{labelize(place.visibilityLabel ?? place.visibility)}</em>
                </span>
              </button>
            ))}
            {places.length === 0 ? <p>{loading ? 'Loading Places…' : 'Load Places to review user-created Places and Hellowhen Library Places.'}</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge warning">Detail</span>{selectedPlace ? <span className={`semantic-badge ${statusTone(selectedPlace.status)}`}>{labelize(selectedPlace.status)}</span> : null}</div>
          <h2>{selectedPlace ? selectedPlace.title : 'Select a Place'}</h2>
          {selectedPlace ? (
            <>
              <p>{selectedPlace.description || 'No description provided.'}</p>
              <div className="admin-money-strip">
                <span><small>Owner</small><strong>{personLabel(selectedPlace.owner)}</strong></span>
                <span><small>Source</small><strong>{labelize(selectedPlace.source)}</strong></span>
                <span><small>Visibility</small><strong>{labelize(selectedPlace.visibilityLabel ?? selectedPlace.visibility)}</strong></span>
                <span><small>Mode</small><strong>{labelize(selectedPlace.mode)}</strong></span>
                <span><small>Plan usage</small><strong>{countLabel(selectedPlace.planUsageCount)}</strong></span>
                <span><small>Images</small><strong>{countLabel(selectedPlace.media?.length)}</strong></span>
                <span><small>Reports</small><strong>{countLabel(selectedPlace.reportsCount)}</strong></span>
              </div>
              <div className="cta-row">
                {selectedPlace.ownerId ? <Link className="button secondary" href={`/admin/users?userId=${encodeURIComponent(selectedPlace.ownerId)}`}>View owner</Link> : null}
                <Link className="button secondary" href={`/admin/media?entityType=place&entityId=${encodeURIComponent(selectedPlace.id)}`}>Review images</Link>
              </div>
              <label>
                Internal note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required for hide, restore, or image removal. Optional for mark reviewed." rows={4} />
              </label>
              <div className="admin-section-grid">
                {placeActions.map((action) => (
                  <button key={action} type="button" className={action === 'hide' ? 'danger' : action === 'restore' ? 'secondary' : 'ghost'} onClick={() => { void applyAction(action); }} disabled={loading || !token}>
                    {actionLabel(action)}
                    <small>{actionDescription(action)}</small>
                  </button>
                ))}
              </div>
            </>
          ) : <p>Choose a Place from the queue to see owner, images, Plan usage, reports, and safe moderation actions.</p>}
        </article>
      </section>

      {selectedPlace ? (
        <section className="admin-detail-grid">
          <article className="app-card admin-action-card">
            <div className="status-row"><span className="semantic-badge admin">Place images</span><span className="semantic-badge warning">Remove unsafe media only</span></div>
            <h2>Review Place images</h2>
            <p>Use Remove image only for unsafe or inappropriate Place images. It marks the media as removed and keeps the Place and old Plan snapshots intact.</p>
            <div className="admin-trust-controls">
              <select value={selectedMediaId} onChange={(event) => setSelectedMediaId(event.target.value)}>
                <option value="">Choose image</option>
                {(selectedPlace.media ?? []).map((media) => <option key={media.id} value={media.id}>{media.filename} · {labelize(media.status)}</option>)}
              </select>
              <button type="button" className="danger" onClick={() => { void applyAction('remove_media', selectedMediaId); }} disabled={loading || !token || !selectedMediaId}>Remove selected image</button>
            </div>
            <div className="admin-section-grid">
              {(selectedPlace.media ?? []).map((media) => (
                <article key={media.id} className="admin-section-card">
                  <span className={`semantic-badge ${statusTone(media.status)}`}>{labelize(media.status)}</span>
                  <img src={media.url} alt={media.filename} style={{ width: '100%', borderRadius: 16, objectFit: 'cover', maxHeight: 220 }} />
                  <p><strong>{media.filename}</strong></p>
                  <p className="meta">{media.id} · {dateLabel(media.createdAt)}</p>
                  {media.reviewNote ? <p className="notice-box warning">{media.reviewNote}</p> : null}
                  <button type="button" className="danger" onClick={() => { void applyAction('remove_media', media.id); }} disabled={loading || !token || media.status === 'removed'}>Remove image</button>
                </article>
              ))}
              {(selectedPlace.media ?? []).length === 0 ? <p>No images attached to this Place.</p> : null}
            </div>
          </article>

          <article className="app-card admin-action-card">
            <div className="status-row"><span className="semantic-badge info">Plan usage</span></div>
            <h2>Used in Plans</h2>
            <div className="admin-audit-list">
              {(selectedPlace.planPlaces ?? []).map((planPlace) => (
                <article key={planPlace.id} className="admin-audit-row">
                  <span>
                    <strong>{planPlace.title}</strong>
                    <small>{planPlace.plan ? `${planPlace.plan.title} · ${labelize(planPlace.plan.status)}` : 'Plan not loaded'} · {dateLabel(planPlace.createdAt)}</small>
                    <small>{planPlace.id}</small>
                  </span>
                  {planPlace.plan ? <Link className="button secondary" href={`/plans/${planPlace.plan.id}`}>Open Plan</Link> : null}
                </article>
              ))}
              {(selectedPlace.planPlaces ?? []).length === 0 ? <p>This Place is not used in any Plan stops yet.</p> : null}
            </div>
          </article>
        </section>
      ) : null}

      {selectedPlace ? (
        <section className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge danger">Reports</span></div>
          <h2>Linked reports</h2>
          <div className="admin-audit-list">
            {(selectedPlace.recentReports ?? []).map((report) => (
              <article key={report.id} className="admin-audit-row">
                <span>
                  <strong>{labelize(report.reason)} · {labelize(report.targetType)}</strong>
                  <small>{labelize(report.status)} · {personLabel(report.reporter)} · {dateLabel(report.createdAt)}</small>
                  {report.details ? <small>{report.details}</small> : null}
                </span>
                <Link className="button secondary" href={`/admin/reports?targetType=${encodeURIComponent(report.targetType)}`}>Open reports</Link>
              </article>
            ))}
            {(selectedPlace.recentReports ?? []).length === 0 ? <p>No reports linked to this Place, its Plan stops, or attached media.</p> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
