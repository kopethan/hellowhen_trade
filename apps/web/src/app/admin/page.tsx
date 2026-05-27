'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminOverviewResponse } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../lib/api';
import { formatWebDateTime } from '../../lib/webFormat';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../features/admin/adminSession';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

const adminSections = [
  { href: '/admin/library', title: 'Starter library', body: 'Create, edit, hide, or restore admin-managed starter Need and Offer templates.', tone: 'info' },
  { href: '/admin/users', title: 'Users', body: 'Search users, review launch status, suspend, restore, and force logout safely.', tone: 'warning' },
  { href: '/admin/business', title: 'Business review', body: 'Review hidden Business, brand, agency, and Enterprise profile status with mandatory notes and audit trail.', tone: 'admin' },
  { href: '/admin/business-sponsored', title: 'Sponsored placements', body: 'Review hidden first-party Business sponsored placement intent without external ad SDKs, tracking, budgets, or money.', tone: 'warning' },
  { href: '/admin/content', title: 'Content', body: 'Hide, restore, close, or mark reviewed trades, needs, and offers.', tone: 'danger' },
  { href: '/admin/reports', title: 'Report queue', body: 'Resolve, dismiss, hide targets, suspend owners, or escalate reports to support.', tone: 'danger' },
  { href: '/admin/support', title: 'Support inbox', body: 'Review tickets, reply, add internal notes, and close resolved user requests.', tone: 'info' },
  { href: '/admin/media', title: 'Media moderation', body: 'Review pending, flagged, removed, and restored uploaded images.', tone: 'warning' },
  { href: '/admin/safety', title: 'Safety checks', body: 'Run launch checklist, runtime QA, and moderation smoke checks separately from the dashboard.', tone: 'success' },
];

function personLabel(user?: { email?: string; profile?: { displayName?: string | null; handle?: string | null } | null } | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}

function countLabel(value?: number | null) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

function dateValue(value: string | Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function moneyFlagLabel(overview: AdminOverviewResponse | null) {
  const money = overview?.summary.money;
  if (!money) return 'Unknown';
  if (money.realMoneyEnabled) return 'Real money enabled';
  if (money.moneyFeaturesVisible) return 'Demo/sandbox money visible';
  return 'Money hidden';
}

export default function AdminHomePage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setOverview(null);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  async function loadOverview() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/overview`, { headers });
      if (!response.ok) throw new Error('Could not load the admin overview. Make sure this account has admin role and satisfies 2FA requirements.');
      const data = await response.json() as AdminOverviewResponse;
      setOverview(data);
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load admin overview.' });
    } finally {
      setLoading(false);
    }
  }

  const summary = overview?.summary;
  const recentAuditLogs = overview?.recentAuditLogs ?? [];

  return (
    <main className="admin-console">
      <section className="admin-console__hero app-card">
        <div className="status-row">
          <span className="semantic-badge admin">Overview</span>
          <span className={`semantic-badge ${summary?.money.realMoneyEnabled ? 'danger' : summary?.money.moneyFeaturesVisible ? 'warning' : 'success'}`}>{moneyFlagLabel(overview)}</span>
        </div>
        <div>
          <p className="eyebrow">First beta admin</p>
          <h1>Simple launch overview</h1>
          <p>Use this page only for high-level marketplace health. Open one focused admin area for user moderation, content review, reports, support, media, starter templates, or safety QA.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Internal tools use your signed-in admin app session. No standalone admin login is shown on public pages.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        <div className="cta-row">
          <button type="button" onClick={() => { void loadOverview(); }} disabled={loading || !token}>Load overview</button>
          <Link className="button secondary" href="/admin/library">Manage starter library</Link>
          <Link className="button secondary" href="/admin/users">Open users</Link>
          <Link className="button secondary" href="/admin/safety">Run safety checks</Link>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      {summary ? (
        <section className="admin-metric-grid">
          <article className="admin-metric-card"><p>Total users</p><strong>{countLabel(summary.users.total)}</strong><span className="meta">{countLabel(summary.users.new7d)} new this week · {countLabel(summary.users.restricted)} restricted</span></article>
          <article className="admin-metric-card"><p>Public trade feed</p><strong>{countLabel(summary.content.activeTrades)}</strong><span className="meta">{countLabel(summary.content.activeNeeds)} active needs · {countLabel(summary.content.activeOffers)} active offers</span></article>
          <article className="admin-metric-card"><p>Safety queue</p><strong>{countLabel(summary.reports.pending + summary.reports.reviewing + summary.support.open)}</strong><span className="meta">{countLabel(summary.reports.pending)} pending reports · {countLabel(summary.support.open)} support tickets</span></article>
          <article className="admin-metric-card"><p>Media review</p><strong>{countLabel(summary.media.pendingReview + summary.media.flagged)}</strong><span className="meta">{countLabel(summary.media.pendingReview)} pending · {countLabel(summary.media.flagged)} flagged</span></article>
        </section>
      ) : null}

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge warning">First launch gates</span></div>
          <h2>Money and Plans visibility</h2>
          <p>Money-era admin tools are intentionally absent from launch navigation. Direct API access remains behind feature gates, and Plans stay hidden behind flags.</p>
          {summary ? (
            <div className="admin-money-strip">
              <span><small>Money UI</small><strong>{summary.money.moneyFeaturesVisible ? 'Visible' : 'Hidden'}</strong></span>
              <span><small>Payout tools</small><strong>{summary.money.payoutsVisible ? 'Visible' : 'Hidden'}</strong></span>
              <span><small>Provider</small><strong>{summary.money.moneyProvider}</strong></span>
            </div>
          ) : <p>Load overview to verify launch gate status.</p>}
          <p className={`notice-box ${summary?.money.realMoneyEnabled ? 'danger' : summary?.money.moneyFeaturesVisible ? 'warning' : 'success'}`}>
            {summary?.money.realMoneyEnabled
              ? 'Real money is enabled. This is not expected for first beta launch.'
              : summary?.money.moneyFeaturesVisible
                ? 'Money tools are visible in demo/sandbox mode. Keep this only for controlled QA.'
                : 'Money, wallet, payouts, and real-money trades are hidden for first beta launch.'}
          </p>
        </article>

        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Focused tools</span></div>
          <h2>One page, one job</h2>
          <div className="admin-section-grid">
            {adminSections.map((section) => (
              <Link key={section.href} href={section.href} className="admin-section-card">
                <span className={`semantic-badge ${section.tone}`}>{section.title}</span>
                <p>{section.body}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Recent users</span></div>
          <h2>Latest signups</h2>
          <div className="admin-audit-list">
            {(overview?.recentUsers ?? []).map((user) => (
              <Link key={user.id} href="/admin/users" className="admin-audit-row">
                <span><strong>{personLabel(user)}</strong><small>{user.email} · {user.trustTier.replaceAll('_', ' ')} · {formatWebDateTime(dateValue(user.createdAt))}</small></span>
                <em className={`semantic-badge ${user.trustTier === 'restricted' ? 'danger' : 'admin'}`}>{user.role}</em>
              </Link>
            ))}
            {overview && (overview.recentUsers ?? []).length === 0 ? <p>No recent users in the latest overview.</p> : null}
            {!overview ? <p>Load overview to see recent signups.</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge warning">Recent support</span></div>
          <h2>Tickets needing attention</h2>
          <div className="admin-audit-list">
            {(overview?.recentTickets ?? []).map((ticket) => {
              const item = ticket as { id: string; subject: string; status: string; priority: string; category: string; updatedAt: string; user?: { email?: string; profile?: { displayName?: string | null } | null } | null };
              return (
                <Link key={item.id} href="/admin/support" className="admin-audit-row">
                  <span><strong>{item.subject}</strong><small>{personLabel(item.user)} · {item.category.replaceAll('_', ' ')} · {formatWebDateTime(dateValue(item.updatedAt))}</small></span>
                  <em className={`semantic-badge ${item.priority === 'urgent' || item.priority === 'high' ? 'danger' : 'info'}`}>{item.priority}</em>
                </Link>
              );
            })}
            {overview && (overview.recentTickets ?? []).length === 0 ? <p>No open support tickets in the latest queue.</p> : null}
            {!overview ? <p>Load overview to see recent support tickets.</p> : null}
          </div>
        </article>
      </section>

      <section className="app-card admin-action-card">
        <div className="status-row"><span className="semantic-badge admin">Audit trail</span></div>
        <h2>Recent admin actions</h2>
        <div className="admin-audit-list">
          {recentAuditLogs.map((log) => (
            <article key={log.id} className="admin-audit-row">
              <span>
                <strong>{log.action}</strong>
                <small>{log.targetType}{log.targetId ? ` · ${log.targetId}` : ''} · {personLabel(log.admin)} · {formatWebDateTime(dateValue(log.createdAt))}</small>
                {log.reason ? <small>Note: {log.reason}</small> : null}
              </span>
            </article>
          ))}
          {overview && recentAuditLogs.length === 0 ? <p>No admin audit log entries yet.</p> : null}
          {!overview ? <p>Load overview to see recent audit entries.</p> : null}
        </div>
      </section>
    </main>
  );
}
