'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminLaunchChecklistResponse, AdminModerationSmokeResponse, AdminRuntimeQaResponse } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

function checklistTone(status?: string) {
  if (status === 'pass') return 'success';
  if (status === 'fail') return 'danger';
  return 'warning';
}

function countLabel(value?: number | null) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

export default function AdminSafetyPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [moderationSmoke, setModerationSmoke] = useState<AdminModerationSmokeResponse | null>(null);
  const [launchChecklist, setLaunchChecklist] = useState<AdminLaunchChecklistResponse | null>(null);
  const [runtimeQa, setRuntimeQa] = useState<AdminRuntimeQaResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setModerationSmoke(null);
    setLaunchChecklist(null);
    setRuntimeQa(null);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  async function loadModerationSmoke() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/moderation-smoke`, { headers });
      if (!response.ok) throw new Error('Could not load moderation smoke checks.');
      const data = await response.json() as AdminModerationSmokeResponse;
      setModerationSmoke(data);
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load moderation smoke checks.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadLaunchChecklist() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/launch-checklist`, { headers });
      if (!response.ok) throw new Error('Could not load launch checklist.');
      const data = await response.json() as AdminLaunchChecklistResponse;
      setLaunchChecklist(data);
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load launch checklist.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadRuntimeQa() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/runtime-qa`, { headers });
      if (!response.ok) throw new Error('Could not load runtime QA.');
      const data = await response.json() as AdminRuntimeQaResponse;
      setRuntimeQa(data);
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load runtime QA.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadAllChecks() {
    await Promise.all([loadLaunchChecklist(), loadRuntimeQa(), loadModerationSmoke()]);
  }

  return (
    <main className="admin-console">
      <section className="admin-console__hero app-card">
        <div className="status-row"><span className="semantic-badge success">Safety</span><span className="semantic-badge admin">One job: launch QA</span></div>
        <h1>Admin safety checks</h1>
        <p>Run launch checklist, runtime QA, and moderation smoke checks here instead of crowding the admin overview. Use these before demos, beta invites, and production config changes.</p>
        <div className="admin-console__login-grid">
          <p className="notice-box info">These checks are read-only. They verify launch gates, public visibility filters, safety queue counts, and moderation rehearsal steps.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        <div className="cta-row">
          <button type="button" onClick={() => { void loadAllChecks(); }} disabled={loading || !token}>Run all checks</button>
          <button type="button" className="secondary" onClick={() => { void loadLaunchChecklist(); }} disabled={loading || !token}>Launch checklist</button>
          <button type="button" className="secondary" onClick={() => { void loadRuntimeQa(); }} disabled={loading || !token}>Runtime QA</button>
          <button type="button" className="secondary" onClick={() => { void loadModerationSmoke(); }} disabled={loading || !token}>Moderation smoke</button>
          <Link className="button secondary" href="/admin/content">Review content</Link>
          <Link className="button secondary" href="/admin/reports">Review reports</Link>
          <Link className="button secondary" href="/admin/moderation">Moderation queue</Link>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      {launchChecklist ? (
        <section className="app-card admin-action-card">
          <div className="status-row">
            <span className={`semantic-badge ${checklistTone(launchChecklist.overallStatus)}`}>Launch checklist: {launchChecklist.overallStatus}</span>
            <span className="semantic-badge admin">{launchChecklist.summary.pass} pass · {launchChecklist.summary.warning} warning · {launchChecklist.summary.fail} fail</span>
          </div>
          <h2>Final admin launch safety checklist</h2>
          <p>Confirm admin access, safety queues, public visibility, and money gates before the first beta launch.</p>
          <div className="admin-audit-list">
            {launchChecklist.items.map((item) => (
              <article key={item.id} className="admin-audit-row">
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                  {item.action ? <small>Action: {item.action}</small> : null}
                </span>
                <em className={`semantic-badge ${checklistTone(item.status)}`}>{item.status}</em>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {runtimeQa ? (
        <section className="app-card admin-action-card">
          <div className="status-row">
            <span className={`semantic-badge ${checklistTone(runtimeQa.overallStatus)}`}>Runtime QA: {runtimeQa.overallStatus}</span>
            <span className="semantic-badge admin">{runtimeQa.summary.pass} pass · {runtimeQa.summary.warning} warning · {runtimeQa.summary.fail} fail</span>
          </div>
          <h2>Launch-mode runtime QA and moderation rehearsal</h2>
          <p>Use this pass with a real browser and Expo session to confirm auth revocation, money-off gates, public visibility filters, and safety queues.</p>
          <div className="admin-money-strip">
            <span><small>Restricted sessions</small><strong>{countLabel(runtimeQa.counts.restrictedUsersWithOpenSessions)}</strong></span>
            <span><small>Money-off public trades</small><strong>{countLabel(runtimeQa.counts.activePublicMoneyTradesWhileMoneyOff)}</strong></span>
            <span><small>Visibility leaks</small><strong>{countLabel(runtimeQa.counts.publicVisibilityLeaks)}</strong></span>
            <span><small>Safety queue items</small><strong>{countLabel(runtimeQa.counts.pendingReports + runtimeQa.counts.urgentSupportTickets + runtimeQa.counts.pendingOrFlaggedMedia)}</strong></span>
          </div>
          <div className="admin-audit-list">
            {runtimeQa.checks.map((item) => (
              <article key={item.id} className="admin-audit-row">
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                  {item.action ? <small>Action: {item.action}</small> : null}
                </span>
                <em className={`semantic-badge ${checklistTone(item.status)}`}>{item.status}</em>
              </article>
            ))}
          </div>
          <h3>Moderation rehearsal steps</h3>
          <div className="admin-audit-list">
            {runtimeQa.rehearsal.map((step) => (
              <article key={step.step} className="admin-audit-row">
                <span>
                  <strong>{step.step}. {step.label}</strong>
                  <small>Expected: {step.expected}</small>
                  {step.operatorAction ? <small>Action: {step.operatorAction}</small> : null}
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {moderationSmoke ? (
        <section className="app-card admin-action-card">
          <div className="status-row">
            <span className={`semantic-badge ${Object.values(moderationSmoke.checks).every(Boolean) ? 'success' : 'warning'}`}>Moderation smoke</span>
            <span className="semantic-badge admin">Runtime visibility</span>
          </div>
          <h2>Hidden-content and restricted-user checks</h2>
          <p>These counts verify that public discovery uses the runtime visibility filters, not only admin UI labels.</p>
          <div className="admin-money-strip">
            <span><small>Feed eligible trades</small><strong>{countLabel(moderationSmoke.counts.feedEligibleTrades)}</strong></span>
            <span><small>Feed leaks</small><strong>{countLabel(moderationSmoke.counts.feedEligibleRestrictedOwnerTrades + moderationSmoke.counts.feedEligibleClosedNeedTrades + moderationSmoke.counts.feedEligibleClosedOfferTrades)}</strong></span>
            <span><small>Stale restricted-owner rows</small><strong>{countLabel(moderationSmoke.counts.publicTradesOwnedByRestrictedUsers)}</strong></span>
            <span><small>Stale closed inventory links</small><strong>{countLabel(moderationSmoke.counts.publicTradesWithClosedNeeds + moderationSmoke.counts.publicTradesWithClosedOffers)}</strong></span>
          </div>
          <p className={`notice-box ${Object.values(moderationSmoke.checks).every(Boolean) ? 'success' : 'warning'}`}>
            {Object.values(moderationSmoke.checks).every(Boolean)
              ? 'Smoke checks passed: restricted owners and closed Need/Offer links are excluded from public discovery.'
              : 'Smoke checks found data that should be reviewed. Public filters still exclude it, but the samples should be checked in content moderation.'}
          </p>
          {moderationSmoke.samples.publicTradesOwnedByRestrictedUsers.length || moderationSmoke.samples.publicTradesWithClosedInventory.length ? (
            <div className="admin-audit-list">
              {[...moderationSmoke.samples.publicTradesOwnedByRestrictedUsers, ...moderationSmoke.samples.publicTradesWithClosedInventory].map((item) => (
                <Link key={`${item.type}:${item.id}`} href="/admin/content" className="admin-audit-row">
                  <span><strong>{item.title}</strong><small>{item.type} · {item.id} · {(item.visibilityBlockers ?? []).join(' · ') || 'review visibility'}</small></span>
                  <em className="semantic-badge warning">review</em>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
