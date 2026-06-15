'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminModerationCaseActionRequest, AdminModerationCaseActionResponse, AdminModerationCaseDto, AdminModerationCasesResponse, ModerationCaseSource, ModerationCaseStatus, ModerationContentType } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';
import { formatWebDateTime } from '../../../lib/webFormat';

type Notice = { tone: 'info' | 'warning' | 'danger' | 'success'; body: string };
type StatusFilter = ModerationCaseStatus | 'all';
type CaseAction = AdminModerationCaseActionRequest['action'];

const statusFilters: StatusFilter[] = ['needs_review', 'pending', 'limited', 'removed', 'rejected', 'failed', 'approved', 'skipped', 'all'];
const contentTypeFilters: Array<ModerationContentType | 'all'> = ['all', 'trade', 'need', 'offer', 'profile', 'user', 'media', 'public_message', 'message', 'proposal', 'plan', 'plan_place', 'profile_image', 'trade_image', 'need_image', 'offer_image', 'support_ticket', 'support_message'];
const sourceFilters: Array<ModerationCaseSource | 'all'> = ['all', 'report', 'upload', 'automatic', 'admin', 'backfill'];
const primaryActions: CaseAction[] = ['mark_needs_review', 'approve', 'limit', 'remove', 'restore', 'reject', 'resolve', 'add_note'];
const noteRequiredActions = new Set<CaseAction>(['approve', 'limit', 'remove', 'restore', 'reject', 'resolve', 'add_note']);

function labelize(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'unknown';
}

function personLabel(user?: { email?: string; profile?: { displayName?: string | null; handle?: string | null } | null } | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}

function statusTone(status?: string | null) {
  if (status === 'approved' || status === 'skipped') return 'success';
  if (status === 'needs_review' || status === 'pending' || status === 'limited') return 'warning';
  if (status === 'rejected' || status === 'removed' || status === 'failed') return 'danger';
  return 'admin';
}

function priorityTone(priority: number) {
  if (priority >= 80) return 'danger';
  if (priority >= 60) return 'warning';
  if (priority >= 40) return 'info';
  return 'admin';
}

function actionDescription(action: CaseAction) {
  if (action === 'mark_needs_review') return 'Move the case back into the review queue.';
  if (action === 'approve') return 'Mark the case safe/approved. Linked reports become resolved.';
  if (action === 'limit') return 'Record a limited decision without deleting content.';
  if (action === 'remove') return 'Mark removed and hide/remove the target when this target type supports it.';
  if (action === 'restore') return 'Mark approved and restore the target when this target type supports it.';
  if (action === 'reject') return 'Reject the case. Use Remove too when content should be hidden.';
  if (action === 'resolve') return 'Close the case as handled without a stronger content decision.';
  return 'Add an internal note without changing the case status.';
}

function targetHref(caseItem: AdminModerationCaseDto) {
  const url = caseItem.target?.url;
  if (!url) return null;
  return url.startsWith('/') ? url : null;
}

export default function AdminModerationQueuePage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [status, setStatus] = useState<StatusFilter>('needs_review');
  const [contentType, setContentType] = useState<ModerationContentType | 'all'>('all');
  const [source, setSource] = useState<ModerationCaseSource | 'all'>('all');
  const [query, setQuery] = useState('');
  const [cases, setCases] = useState<AdminModerationCaseDto[]>([]);
  const [selectedCase, setSelectedCase] = useState<AdminModerationCaseDto | null>(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setCases([]);
    setSelectedCase(null);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function queryString() {
    const params = new URLSearchParams();
    params.set('status', status);
    if (contentType !== 'all') params.set('contentType', contentType);
    if (source !== 'all') params.set('source', source);
    if (query.trim()) params.set('q', query.trim());
    params.set('take', '100');
    return params.toString();
  }

  async function loadCases() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/moderation/cases?${queryString()}`, { headers });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not load moderation queue.');
      }
      const data = await response.json() as AdminModerationCasesResponse;
      setCases(data.cases);
      setSelectedCase((current) => current ? data.cases.find((item) => item.id === current.id) ?? null : data.cases[0] ?? null);
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load moderation queue.' });
    } finally {
      setLoading(false);
    }
  }

  async function applyAction(action: CaseAction) {
    if (!selectedCase || !token) return;
    const trimmedNote = note.trim();
    if (noteRequiredActions.has(action) && !trimmedNote) {
      setNotice({ tone: 'warning', body: 'Add an internal note before changing a moderation case decision.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/moderation/cases/${selectedCase.id}/action`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action, note: trimmedNote || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not update moderation case.');
      }
      const data = await response.json() as AdminModerationCaseActionResponse;
      setCases((current) => current.map((item) => item.id === data.case.id ? data.case : item));
      setSelectedCase(data.case);
      setNote('');
      setNotice({ tone: 'success', body: data.targetActionApplied ? `Saved ${labelize(action)} and applied target visibility change.` : `Saved moderation action: ${labelize(action)}.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not update moderation case.' });
    } finally {
      setLoading(false);
    }
  }

  const selectedTargetHref = selectedCase ? targetHref(selectedCase) : null;

  return (
    <main className="admin-console">
      <section className="app-card admin-console__hero">
        <div className="status-row">
          <span className="semantic-badge danger">Moderation queue</span>
          <Link className="button secondary" href="/admin/safety">Safety checks</Link>
        </div>
        <div>
          <p className="eyebrow">SAFETY3</p>
          <h1>Admin moderation cases</h1>
          <p>Review provider-neutral Safety Review cases created from reports, uploads, automatic checks, or future moderation providers. Keep decisions inside Hellowhen; providers only classify content.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">This queue is internal and noindexed. Actions write to ModerationAction plus the admin audit log. Linked reports are resolved or moved to reviewing when applicable.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      <section className="admin-detail-grid admin-detail-grid--wide-left">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Queue</span><span className="semantic-badge admin">No provider required</span></div>
          <h2>Cases</h2>
          <div className="admin-trust-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search content ID, reason, report, or owner" />
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              {statusFilters.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
            <select value={contentType} onChange={(event) => setContentType(event.target.value as ModerationContentType | 'all')}>
              {contentTypeFilters.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
            <select value={source} onChange={(event) => setSource(event.target.value as ModerationCaseSource | 'all')}>
              {sourceFilters.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
            <button type="button" onClick={() => { void loadCases(); }} disabled={loading || !token}>Load cases</button>
          </div>
          <div className="admin-user-list">
            {cases.map((item) => (
              <button type="button" key={item.id} className={selectedCase?.id === item.id ? 'admin-user-row is-active' : 'admin-user-row'} onClick={() => { setSelectedCase(item); setNote(''); }}>
                <span>
                  <strong>{item.target?.label ?? `${labelize(item.contentType)} ${item.contentId}`}</strong>
                  <small>{labelize(item.contentType)} · {labelize(item.source)} · {item.contentId}</small>
                  <small>{formatWebDateTime(item.createdAt)} · owner: {personLabel(item.contentOwner)}</small>
                </span>
                <span className="status-row">
                  <em className={`semantic-badge ${statusTone(item.status)}`}>{labelize(item.status)}</em>
                  <em className={`semantic-badge ${priorityTone(item.priority)}`}>priority {item.priority}</em>
                </span>
              </button>
            ))}
            {cases.length === 0 ? <p>No moderation cases loaded yet.</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          {selectedCase ? (
            <>
              <div className="status-row">
                <span className={`semantic-badge ${statusTone(selectedCase.status)}`}>{labelize(selectedCase.status)}</span>
                <span className={`semantic-badge ${priorityTone(selectedCase.priority)}`}>priority {selectedCase.priority}</span>
              </div>
              <h2>{selectedCase.target?.label ?? `${labelize(selectedCase.contentType)} ${selectedCase.contentId}`}</h2>
              <p>{selectedCase.reason || 'No reason stored.'}</p>
              <div className="admin-money-strip">
                <span><small>Type</small><strong>{labelize(selectedCase.contentType)}</strong></span>
                <span><small>Source</small><strong>{labelize(selectedCase.source)}</strong></span>
                <span><small>Visibility</small><strong>{labelize(selectedCase.visibility)}</strong></span>
                <span><small>Results</small><strong>{selectedCase.resultCount ?? 0}</strong></span>
              </div>
              <div className="admin-audit-list">
                <article className="admin-audit-row">
                  <span>
                    <strong>Target</strong>
                    <small>{selectedCase.target ? `${labelize(selectedCase.target.type)} · ${selectedCase.target.id}` : `${labelize(selectedCase.contentType)} · ${selectedCase.contentId}`}</small>
                    <small>Owner: {personLabel(selectedCase.target?.owner ?? selectedCase.contentOwner)}</small>
                    {selectedCase.target?.status ? <small>Status: {labelize(selectedCase.target.status)}</small> : null}
                  </span>
                  {selectedTargetHref ? <Link className="button secondary" href={selectedTargetHref}>Open</Link> : null}
                </article>
                {selectedCase.report ? (
                  <article className="admin-audit-row">
                    <span>
                      <strong>Linked report</strong>
                      <small>{selectedCase.report.reason} · {labelize(selectedCase.report.status)} · {selectedCase.report.id}</small>
                      <small>Reporter: {personLabel(selectedCase.report.reporter)}</small>
                      {selectedCase.report.details ? <small>{selectedCase.report.details}</small> : null}
                    </span>
                    <Link className="button secondary" href="/admin/reports">Reports</Link>
                  </article>
                ) : null}
                {selectedCase.latestResult ? (
                  <article className="admin-audit-row">
                    <span>
                      <strong>Latest provider result</strong>
                      <small>{selectedCase.latestResult.provider} · {selectedCase.latestResult.status} · {labelize(selectedCase.latestResult.highestSeverity)} · suggested {labelize(selectedCase.latestResult.suggestedAction)}</small>
                      {selectedCase.latestResult.reason ? <small>{selectedCase.latestResult.reason}</small> : null}
                      {selectedCase.latestResult.attemptCount || selectedCase.latestResult.durationMs != null ? (
                        <small>Attempts: {selectedCase.latestResult.attemptCount ?? '—'} · Duration: {selectedCase.latestResult.durationMs != null ? `${selectedCase.latestResult.durationMs}ms` : '—'} · Retryable: {selectedCase.latestResult.retriable ? 'yes' : 'no'}</small>
                      ) : null}
                    </span>
                  </article>
                ) : <p className="notice-box admin">No provider result yet. This is expected while MODERATION_PROVIDER=none.</p>}
              </div>

              <label>
                Internal note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required before approving, limiting, removing, restoring, rejecting, resolving, or adding a note." rows={4} />
              </label>
              <div className="admin-audit-list">
                {primaryActions.map((action) => (
                  <button key={action} type="button" className="admin-audit-row" onClick={() => { void applyAction(action); }} disabled={loading || !token}>
                    <span>
                      <strong>{labelize(action)}</strong>
                      <small>{actionDescription(action)}</small>
                    </span>
                    <em className={`semantic-badge ${action === 'remove' || action === 'reject' ? 'danger' : action === 'approve' || action === 'restore' || action === 'resolve' ? 'success' : action === 'limit' || action === 'mark_needs_review' ? 'warning' : 'admin'}`}>{labelize(action)}</em>
                  </button>
                ))}
              </div>

              <h3>Recent actions</h3>
              <div className="admin-audit-list">
                {(selectedCase.recentActions ?? []).map((action) => (
                  <article key={action.id} className="admin-audit-row">
                    <span>
                      <strong>{labelize(action.action)}</strong>
                      <small>{formatWebDateTime(action.createdAt)} · {action.actorType} · {personLabel(action.actor)}</small>
                      {action.note ? <small>{action.note}</small> : null}
                    </span>
                    <em className={`semantic-badge ${statusTone(action.nextStatus ?? action.previousStatus)}`}>{labelize(action.nextStatus ?? action.previousStatus)}</em>
                  </article>
                ))}
                {(selectedCase.recentActions ?? []).length === 0 ? <p>No action history yet.</p> : null}
              </div>
            </>
          ) : <p>Select a moderation case to review.</p>}
        </article>
      </section>
    </main>
  );
}
