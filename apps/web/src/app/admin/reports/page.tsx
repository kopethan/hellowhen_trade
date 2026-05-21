'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminReportActionRequest, AdminReportsResponse, ReportDto, ReportReason, ReportStatus, ReportTargetType } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';
import { formatWebDateTime } from '../../../lib/webFormat';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type StatusFilter = ReportStatus | 'all';
type TargetFilter = ReportTargetType | 'all';
type ReasonFilter = ReportReason | 'all';
type ReportAction = AdminReportActionRequest['action'];
type LastAction = { tone: NoticeTone; title: string; body: string; details?: string[] };

const statusFilters: StatusFilter[] = ['pending', 'reviewing', 'resolved', 'dismissed', 'all'];
const targetFilters: TargetFilter[] = ['all', 'user', 'profile', 'trade', 'need', 'offer', 'proposal', 'message', 'media'];
const reasonFilters: ReasonFilter[] = ['all', 'spam', 'scam', 'harassment', 'illegal_unsafe', 'fake_profile', 'inappropriate_image', 'other'];
const bulkReportActions: ReportAction[] = ['mark_reviewing', 'resolve', 'dismiss', 'reopen'];
const noteRequiredReportActions: ReportAction[] = ['reopen', 'hide_target', 'restore_target', 'suspend_target_owner', 'unsuspend_target_owner', 'dismiss', 'resolve', 'escalate_to_support'];
const visibilityTargetTypes = new Set(['trade', 'need', 'offer', 'media', 'plan', 'plan_place']);

function labelize(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'unknown';
}

function personLabel(user?: { email?: string; profile?: { displayName?: string | null; handle?: string | null } | null } | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}

function reportTone(report: ReportDto) {
  if (report.status === 'pending') return 'danger';
  if (report.status === 'reviewing') return 'warning';
  if (report.status === 'resolved') return 'success';
  return 'admin';
}

function targetSupportsVisibilityAction(report: ReportDto) {
  return visibilityTargetTypes.has(String(report.targetType));
}

function actionNeedsNote(action: ReportAction) {
  return noteRequiredReportActions.includes(action);
}

function actionHelp(action: ReportAction) {
  if (action === 'hide_target') return 'Hides the reported trade, closes the reported need/offer, or removes the reported media, then resolves the report.';
  if (action === 'restore_target') return 'Restores the reported content/media when a previous hide or removal should be reversed, then resolves the report.';
  if (action === 'suspend_target_owner') return 'Restricts the target owner account, revokes active sessions, then resolves the report.';
  if (action === 'unsuspend_target_owner') return 'Restores the target owner to a non-restricted launch tier when a suspension should be reversed, then resolves the report.';
  if (action === 'escalate_to_support') return 'Creates a support ticket for reporter follow-up and moves the report to reviewing.';
  if (action === 'reopen') return 'Reopens a resolved or dismissed report back to pending for another review.';
  if (action === 'dismiss') return 'Dismisses the report without changing the target.';
  if (action === 'resolve') return 'Marks the report resolved after manual review.';
  return 'Moves the report to reviewing so another admin knows it is being checked.';
}

function actionResultTitle(action: ReportAction) {
  if (action === 'hide_target') return 'Target hidden or closed';
  if (action === 'restore_target') return 'Target restored';
  if (action === 'suspend_target_owner') return 'Owner suspended';
  if (action === 'unsuspend_target_owner') return 'Owner restored';
  if (action === 'escalate_to_support') return 'Report escalated to support';
  if (action === 'reopen') return 'Report reopened';
  if (action === 'dismiss') return 'Report dismissed';
  if (action === 'resolve') return 'Report resolved';
  return 'Report marked reviewing';
}

function actionResultDetails(action: ReportAction, report: ReportDto, supportTicketId?: string) {
  const details = [`Report status is now ${labelize(report.status)}.`];
  if (action === 'hide_target') details.push('The supported target was removed from public surfaces without deleting audit history.');
  if (action === 'restore_target') details.push('The supported target was restored so it can appear again when otherwise eligible.');
  if (action === 'suspend_target_owner') details.push('The owner account is restricted and active sessions were revoked.');
  if (action === 'unsuspend_target_owner') details.push('The owner account was restored to a non-restricted launch tier.');
  if (action === 'escalate_to_support' && supportTicketId) details.push(`Support ticket created: ${supportTicketId}.`);
  return details;
}

export default function AdminReportsPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [targetType, setTargetType] = useState<TargetFilter>('all');
  const [reason, setReason] = useState<ReasonFilter>('all');
  const [query, setQuery] = useState('');
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDto | null>(null);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<ReportAction>('mark_reviewing');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [loading, setLoading] = useState(false);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setReports([]);
    setSelectedReport(null);
    setSelectedReportIds([]);
    setLastAction(null);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function queryString() {
    const params = new URLSearchParams();
    params.set('status', status);
    if (targetType !== 'all') params.set('targetType', targetType);
    if (reason !== 'all') params.set('reason', reason);
    if (query.trim()) params.set('q', query.trim());
    const text = params.toString();
    return text ? `?${text}` : '';
  }

  function upsertReport(nextReport: ReportDto) {
    setSelectedReport((current) => (current?.id === nextReport.id ? nextReport : current));
    setReports((current) => current.map((item) => (item.id === nextReport.id ? nextReport : item)));
  }

  async function loadReports() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/reports${queryString()}`, { headers });
      if (!response.ok) throw new Error('Could not load reports. Make sure this account has admin role and satisfies 2FA requirements.');
      const data = await response.json() as AdminReportsResponse;
      setReports(data.reports);
      setSelectedReportIds([]);
      if (selectedReport) setSelectedReport(data.reports.find((item) => item.id === selectedReport.id) ?? null);
      setNotice({ tone: 'success', body: `Loaded ${data.reports.length} report${data.reports.length === 1 ? '' : 's'}. Select one for detail actions or select multiple for safe bulk status actions.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load reports.' });
    } finally {
      setLoading(false);
    }
  }

  async function runReportAction(reportId: string, action: ReportAction) {
    const response = await fetch(`${apiBase}/admin/reports/${reportId}/action`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action, note: note.trim() || undefined }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(body?.message || 'Could not apply report action.');
    }
    return response.json() as Promise<{ report: ReportDto; supportTicket?: { id?: string } | null }>;
  }

  async function applyAction(action: ReportAction) {
    if (!token || !selectedReport) return;
    if (actionNeedsNote(action) && !note.trim()) {
      setNotice({ tone: 'warning', body: 'Add an internal note before resolving, dismissing, reopening, restoring, escalating, hiding content, or changing user restrictions.' });
      return;
    }
    if ((action === 'hide_target' || action === 'restore_target') && !targetSupportsVisibilityAction(selectedReport)) {
      setNotice({ tone: 'warning', body: `This ${labelize(selectedReport.targetType)} report target cannot be hidden/restored directly. Use suspend owner, dismiss, resolve, or escalate to support.` });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const data = await runReportAction(selectedReport.id, action);
      upsertReport(data.report);
      setNote('');
      const supportLink = data.supportTicket?.id ? ` Open support ticket from /admin/support?ticketId=${data.supportTicket.id}.` : '';
      const details = actionResultDetails(action, data.report, data.supportTicket?.id);
      setLastAction({ tone: 'success', title: actionResultTitle(action), body: `Report action saved: ${labelize(action)}.${supportLink}`, details });
      setNotice({ tone: 'success', body: `Done: ${actionResultTitle(action)}. ${details.join(' ')}` });
    } catch (error) {
      setLastAction({ tone: 'danger', title: 'Report action failed', body: error instanceof Error ? error.message : 'Could not update report.' });
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not update report.' });
    } finally {
      setLoading(false);
    }
  }

  function toggleReportSelection(reportId: string) {
    setSelectedReportIds((current) => (current.includes(reportId) ? current.filter((id) => id !== reportId) : [...current, reportId]));
  }

  function toggleAllVisibleReports() {
    if (selectedReportIds.length === reports.length) setSelectedReportIds([]);
    else setSelectedReportIds(reports.map((report) => report.id));
  }

  async function applyBulkAction() {
    if (!token) return;
    const ids = selectedReportIds.filter((id) => reports.some((report) => report.id === id));
    if (ids.length === 0) {
      setNotice({ tone: 'warning', body: 'Select at least one report before applying a bulk action.' });
      return;
    }
    if (actionNeedsNote(bulkAction) && !note.trim()) {
      setNotice({ tone: 'warning', body: 'Add one internal note before applying this bulk report action.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    let successCount = 0;
    const errors: string[] = [];
    try {
      for (const id of ids) {
        try {
          const data = await runReportAction(id, bulkAction);
          upsertReport(data.report);
          successCount += 1;
        } catch (error) {
          errors.push(`${id}: ${error instanceof Error ? error.message : 'failed'}`);
        }
      }
      if (successCount > 0) setSelectedReportIds((current) => current.filter((id) => !ids.includes(id)));
      if (successCount > 0 && errors.length === 0) setNote('');
      const tone: NoticeTone = errors.length ? (successCount ? 'warning' : 'danger') : 'success';
      const body = `Bulk ${labelize(bulkAction)} finished: ${successCount}/${ids.length} report${ids.length === 1 ? '' : 's'} updated${errors.length ? `, ${errors.length} failed.` : '.'}`;
      setLastAction({ tone, title: 'Bulk report action finished', body, details: errors.slice(0, 4) });
      setNotice({ tone, body });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-console">
      <section className="app-card admin-console__hero">
        <div className="status-row">
          <span className="semantic-badge danger">Reports</span>
          <Link className="button secondary" href="/admin">Back to admin</Link>
        </div>
        <div>
          <p className="eyebrow">Phase 24.3</p>
          <h1>Report queue</h1>
          <p>Review reports, batch simple status changes, escalate complex cases to support, hide unsafe public content, suspend target owners, and keep every decision in the admin audit log.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Admin sessions now refresh while this browser tab is active. If actions fail after a long break, reload once and sign in again.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
        {lastAction ? (
          <div className={`notice-box ${lastAction.tone}`} role="status" aria-live="polite">
            <strong>{lastAction.title}</strong>
            <p>{lastAction.body}</p>
            {lastAction.details?.length ? <ul>{lastAction.details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}
          </div>
        ) : null}
      </section>

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Queue</span><span className="semantic-badge admin">{reports.length} loaded</span><span className="semantic-badge warning">{selectedReportIds.length} selected</span></div>
          <h2>Reported content</h2>
          <div className="admin-trust-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search details, target ID, reporter" />
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>{statusFilters.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={targetType} onChange={(event) => setTargetType(event.target.value as TargetFilter)}>{targetFilters.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={reason} onChange={(event) => setReason(event.target.value as ReasonFilter)}>{reasonFilters.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <button type="button" onClick={() => { void loadReports(); }} disabled={loading || !token}>Load reports</button>
          </div>
          <div className="admin-bulk-bar">
            <button type="button" className="secondary" onClick={toggleAllVisibleReports} disabled={loading || reports.length === 0}>{selectedReportIds.length === reports.length && reports.length > 0 ? 'Clear selection' : 'Select all loaded'}</button>
            <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as ReportAction)}>{bulkReportActions.map((action) => <option key={action} value={action}>{labelize(action)}</option>)}</select>
            <button type="button" onClick={() => { void applyBulkAction(); }} disabled={loading || !token || selectedReportIds.length === 0}>Apply to selected</button>
          </div>
          <p className="notice-box info">Bulk actions are limited to safe report status changes. Use the detail panel for hide, restore, suspend, unsuspend, and support escalation.</p>
          <div className="admin-user-list">
            {reports.map((report) => (
              <div key={report.id} className={selectedReport?.id === report.id ? 'admin-selectable-row is-active' : 'admin-selectable-row'}>
                <label className="admin-row-check" title="Select for bulk action">
                  <input type="checkbox" checked={selectedReportIds.includes(report.id)} onChange={() => toggleReportSelection(report.id)} />
                </label>
                <button type="button" className="admin-user-row" onClick={() => { setSelectedReport(report); setNote(''); }}>
                  <span>
                    <strong>{report.target?.label ?? report.targetId}</strong>
                    <small>{labelize(report.reason)} · {labelize(report.targetType)} · reporter {personLabel(report.reporter)}</small>
                    <small>{formatWebDateTime(report.createdAt)} · {report.id}</small>
                  </span>
                  <em className={`semantic-badge ${reportTone(report)}`}>{labelize(report.status)}</em>
                </button>
              </div>
            ))}
            {reports.length === 0 ? <p>No reports loaded yet.</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          {selectedReport ? (
            <>
              <div className="status-row">
                <span className={`semantic-badge ${reportTone(selectedReport)}`}>{labelize(selectedReport.status)}</span>
                <span className="semantic-badge warning">{labelize(selectedReport.reason)}</span>
                <span className="semantic-badge admin">{labelize(selectedReport.targetType)}</span>
                {!targetSupportsVisibilityAction(selectedReport) ? <span className="semantic-badge info">hide/restore not supported</span> : null}
              </div>
              <h2>{selectedReport.target?.label ?? selectedReport.targetId}</h2>
              <p className="meta">Reporter: {personLabel(selectedReport.reporter)} · Target owner: {personLabel(selectedReport.target?.owner)}</p>
              <p>{selectedReport.details || 'No reporter details were provided.'}</p>
              <div className="admin-money-strip">
                <span><small>Target status</small><strong>{labelize(selectedReport.target?.status)}</strong></span>
                <span><small>Visibility</small><strong>{selectedReport.target?.isPublic === undefined || selectedReport.target?.isPublic === null ? 'n/a' : selectedReport.target.isPublic ? 'public' : 'hidden'}</strong></span>
                <span><small>Reported</small><strong>{formatWebDateTime(selectedReport.createdAt)}</strong></span>
                <span><small>Support escalation</small><strong>{selectedReport.escalatedSupportTicketId ? 'created' : 'none'}</strong></span>
              </div>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal admin note. Required before final report decisions and most bulk actions." rows={4} />
              <div className="admin-action-grid">
                <button type="button" className="warning" onClick={() => { void applyAction('mark_reviewing'); }} disabled={loading || !token}>Mark reviewing</button>
                <button type="button" className="warning" onClick={() => { void applyAction('reopen'); }} disabled={loading || !token || selectedReport.status === 'pending'}>Reopen</button>
                <button type="button" className="success" onClick={() => { void applyAction('resolve'); }} disabled={loading || !token}>Resolve</button>
                <button type="button" className="secondary" onClick={() => { void applyAction('dismiss'); }} disabled={loading || !token}>Dismiss</button>
                <button type="button" className="warning" onClick={() => { void applyAction('escalate_to_support'); }} disabled={loading || !token || Boolean(selectedReport.escalatedSupportTicketId)}>Escalate to support</button>
                <button type="button" className="danger" onClick={() => { void applyAction('hide_target'); }} disabled={loading || !token || !targetSupportsVisibilityAction(selectedReport)}>Hide target</button>
                <button type="button" className="success" onClick={() => { void applyAction('restore_target'); }} disabled={loading || !token || !targetSupportsVisibilityAction(selectedReport)}>Restore target</button>
                <button type="button" className="danger" onClick={() => { void applyAction('suspend_target_owner'); }} disabled={loading || !token}>Suspend owner</button>
                <button type="button" className="success" onClick={() => { void applyAction('unsuspend_target_owner'); }} disabled={loading || !token}>Unsuspend owner</button>
                {selectedReport.escalatedSupportTicketId ? <Link className="button secondary" href={`/admin/support?ticketId=${selectedReport.escalatedSupportTicketId}`}>Open support ticket</Link> : null}
                {selectedReport.target?.url?.startsWith('/') ? <Link className="button secondary" href={selectedReport.target.url}>Open target</Link> : null}
                {selectedReport.target?.ownerId ? <Link className="button secondary" href={`/users/${selectedReport.target.ownerId}`}>Open owner profile</Link> : null}
              </div>
              <p className="notice-box warning">Report actions are reversible: reopen reports, restore targets, or unsuspend owners with an internal note. {targetSupportsVisibilityAction(selectedReport) ? actionHelp('hide_target') : 'This target type cannot be hidden directly; use owner restriction or support escalation if needed.'} {actionHelp('suspend_target_owner')}</p>
            </>
          ) : (
            <>
              <div className="status-row"><span className="semantic-badge admin">Select report</span></div>
              <h2>Report detail</h2>
              <p>Select a report to review reporter context, target content, and safe moderation actions. Use support/dispute flows for trade-participant conflict resolution.</p>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
