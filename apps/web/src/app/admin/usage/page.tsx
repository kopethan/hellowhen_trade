'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime } from '../../../lib/webFormat';
import { adminRequestFailedMessage, adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type UsageWeight = 'lite' | 'medium' | 'heavy';

type ServerHealthStatus = 'ok' | 'warning' | 'error';

type ServerHealth = {
  status: ServerHealthStatus;
  generatedAt: string;
  note: string;
  api: {
    status: ServerHealthStatus;
    service: string;
    nodeEnv: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    pid: number;
    startedAt: string;
    uptimeSeconds: number;
    memory: {
      rssMiB: number;
      heapUsedMiB: number;
      heapTotalMiB: number;
      externalMiB: number;
      heapUsedRatio: number;
    };
  };
  database: {
    status: ServerHealthStatus;
    responseTimeMs: number;
    message: string;
  };
  checks: Array<{
    id: string;
    label: string;
    status: ServerHealthStatus;
    detail: string;
  }>;
};

type UsageArea = {
  area: string;
  count: number;
  liveCount: number;
  lastSeenAt: string | null;
};

type ApiAreaStat = {
  area: string;
  requests: number;
  errors: number;
  averageDurationMs: number;
  maxDurationMs: number;
};

type ApiRouteStat = {
  method: string;
  routePattern: string;
  appArea: string;
  requests: number;
  errors: number;
  averageDurationMs: number;
  maxDurationMs: number;
  lastSeenAt: string | null;
};

type ActiveUser = {
  userId: string;
  email: string;
  displayName?: string | null;
  handle?: string | null;
  currentArea: string;
  routePattern: string;
  lastSeenAt: string;
  liveNow: boolean;
  apiRequests15m?: number;
  apiErrors15m?: number;
  apiAverageDurationMs15m?: number;
  usageWeight?: UsageWeight;
  usageWeightReason?: string;
};

type AdminUsageResponse = {
  generatedAt: string;
  retentionHours: number;
  summary: {
    activeUsers5m: number;
    activeUsers15m: number;
    activeGuests5m: number;
    activeSessions15m: number;
    apiRequests15m?: number;
    apiErrors15m?: number;
    apiAverageDurationMs15m?: number;
    liteUsers15m?: number;
    mediumUsers15m?: number;
    heavyUsers15m?: number;
  };
  areas: UsageArea[];
  retention?: {
    presenceHours: number;
    apiMetricsHours: number;
    cleanup: string;
  };
  serverHealth?: ServerHealth;
  apiMetrics?: {
    available: boolean;
    windowMinutes: number;
    retentionHours: number;
    areaStats: ApiAreaStat[];
    slowestRoutes: ApiRouteStat[];
  };
  activeUsers: ActiveUser[];
  usageWeights?: {
    windowMinutes: number;
    rule: string;
    counts: Record<UsageWeight, number>;
  };
  privacy: { contentVisible: boolean; note: string };
};

function countLabel(value?: number | null) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

function durationLabel(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0 ms';
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`;
  return `${Math.round(value).toLocaleString()} ms`;
}

function errorRateLabel(errors?: number | null, requests?: number | null) {
  if (!requests) return '0%';
  return `${Math.round(((errors ?? 0) / requests) * 100)}%`;
}



function statusBadgeTone(value?: ServerHealthStatus) {
  if (value === 'error') return 'danger';
  if (value === 'warning') return 'warning';
  return 'success';
}

function statusLabel(value?: ServerHealthStatus) {
  if (value === 'error') return 'Error';
  if (value === 'warning') return 'Warning';
  return 'OK';
}

function uptimeLabel(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0m';
  const days = Math.floor(value / 86_400);
  const hours = Math.floor((value % 86_400) / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function memoryLabel(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0 MiB';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} MiB`;
}

function usageWeightBadgeTone(value?: UsageWeight) {
  if (value === 'heavy') return 'danger';
  if (value === 'medium') return 'warning';
  return 'success';
}

function usageWeightLabel(value?: UsageWeight) {
  if (value === 'heavy') return 'Heavy';
  if (value === 'medium') return 'Medium';
  return 'Lite';
}

function userLabel(user: ActiveUser) {
  return user.displayName || user.handle || user.email;
}

function areaLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function AdminUsagePage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [usage, setUsage] = useState<AdminUsageResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setUsage(null);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  async function loadUsage() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/usage`, { headers });
      if (!response.ok) throw new Error(adminRequestFailedMessage());
      const data = await response.json() as AdminUsageResponse;
      setUsage(data);
      setNotice({ tone: 'success', body: `Loaded usage and API metrics generated at ${formatWebDateTime(data.generatedAt)}.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load usage monitoring.' });
    } finally {
      setLoading(false);
    }
  }

  const apiWindowMinutes = usage?.apiMetrics?.windowMinutes ?? 15;
  const presenceRetentionHours = usage?.retention?.presenceHours ?? usage?.retentionHours ?? 72;
  const apiRetentionHours = usage?.retention?.apiMetricsHours ?? usage?.apiMetrics?.retentionHours ?? 72;

  return (
    <main className="admin-console">
      <section className="admin-console__hero app-card">
        <div className="status-row">
          <span className="semantic-badge admin">Usage</span>
          <span className="semantic-badge success">Privacy-safe</span>
        </div>
        <div>
          <p className="eyebrow">Operational presence + API health</p>
          <h1>Admin usage monitoring</h1>
          <p>This page shows operational presence and API timing only. It does not show private messages, proposal content, request bodies, or raw private URLs.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Heartbeats and API metrics are short-lived. Presence rows older than {presenceRetentionHours} hours and API metric rows older than {apiRetentionHours} hours are ignored and cleaned during heartbeat, API metric, or admin usage reads.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        <div className="cta-row">
          <button type="button" onClick={() => { void loadUsage(); }} disabled={loading || !token}>{loading ? 'Loading…' : 'Load usage'}</button>
          <button type="button" className="secondary" onClick={() => { void loadUsage(); }} disabled={loading || !token}>Refresh</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      {usage ? (
        <>
          <section className="admin-metric-grid">
            <article className="admin-metric-card"><p>Server health</p><strong>{statusLabel(usage.serverHealth?.status)}</strong><span className="meta">API + DB lightweight snapshot</span></article>
            <article className="admin-metric-card"><p>API uptime</p><strong>{uptimeLabel(usage.serverHealth?.api.uptimeSeconds)}</strong><span className="meta">Started {usage.serverHealth ? formatWebDateTime(usage.serverHealth.api.startedAt) : '—'}</span></article>
            <article className="admin-metric-card"><p>DB ping</p><strong>{durationLabel(usage.serverHealth?.database.responseTimeMs)}</strong><span className="meta">{statusLabel(usage.serverHealth?.database.status)}</span></article>
            <article className="admin-metric-card"><p>Live now</p><strong>{countLabel(usage.summary.activeUsers5m)}</strong><span className="meta">Logged-in users active in last 5 minutes</span></article>
            <article className="admin-metric-card"><p>Active last 15 minutes</p><strong>{countLabel(usage.summary.activeUsers15m)}</strong><span className="meta">Logged-in users with recent heartbeat</span></article>
            <article className="admin-metric-card"><p>API requests</p><strong>{countLabel(usage.summary.apiRequests15m)}</strong><span className="meta">Safe route-pattern requests in last {apiWindowMinutes} minutes</span></article>
            <article className="admin-metric-card"><p>API errors</p><strong>{countLabel(usage.summary.apiErrors15m)}</strong><span className="meta">HTTP 4xx/5xx · {errorRateLabel(usage.summary.apiErrors15m, usage.summary.apiRequests15m)} error rate</span></article>
            <article className="admin-metric-card"><p>Avg response</p><strong>{durationLabel(usage.summary.apiAverageDurationMs15m)}</strong><span className="meta">Average API duration in last {apiWindowMinutes} minutes</span></article>
            <article className="admin-metric-card"><p>Usage weight</p><strong>{countLabel(usage.summary.heavyUsers15m)} heavy</strong><span className="meta">{countLabel(usage.summary.mediumUsers15m)} medium · {countLabel(usage.summary.liteUsers15m)} lite</span></article>
            <article className="admin-metric-card"><p>Active sessions</p><strong>{countLabel(usage.summary.activeSessions15m)}</strong><span className="meta">Browser/session heartbeats in last 15 minutes</span></article>
          </section>

          {usage.serverHealth ? (
            <section className="admin-detail-grid admin-detail-grid--wide-left">
              <article className="app-card admin-action-card">
                <div className="status-row"><span className={`semantic-badge ${statusBadgeTone(usage.serverHealth.status)}`}>Server health</span></div>
                <h2>API process snapshot</h2>
                <div className="admin-usage-area-list">
                  <div className="admin-usage-area-row">
                    <span><strong>Process</strong><small>{usage.serverHealth.api.service} · PID {usage.serverHealth.api.pid} · {usage.serverHealth.api.nodeVersion}</small></span>
                    <em>{statusLabel(usage.serverHealth.api.status)}</em>
                  </div>
                  <div className="admin-usage-area-row">
                    <span><strong>Runtime</strong><small>{usage.serverHealth.api.nodeEnv} · {usage.serverHealth.api.platform}/{usage.serverHealth.api.arch}</small></span>
                    <em>{uptimeLabel(usage.serverHealth.api.uptimeSeconds)}</em>
                  </div>
                  <div className="admin-usage-area-row">
                    <span><strong>Memory</strong><small>Heap {memoryLabel(usage.serverHealth.api.memory.heapUsedMiB)} / {memoryLabel(usage.serverHealth.api.memory.heapTotalMiB)} · RSS {memoryLabel(usage.serverHealth.api.memory.rssMiB)}</small></span>
                    <em>{Math.round((usage.serverHealth.api.memory.heapUsedRatio ?? 0) * 100)}%</em>
                  </div>
                </div>
                <p className="notice-box info">{usage.serverHealth.note}</p>
              </article>

              <article className="app-card admin-action-card">
                <div className="status-row"><span className={`semantic-badge ${statusBadgeTone(usage.serverHealth.database.status)}`}>Database</span></div>
                <h2>Database connectivity</h2>
                <div className="admin-usage-area-list">
                  <div className="admin-usage-area-row">
                    <span><strong>Ping</strong><small>{usage.serverHealth.database.message}</small></span>
                    <em>{durationLabel(usage.serverHealth.database.responseTimeMs)}</em>
                  </div>
                  {usage.serverHealth.checks.map((check) => (
                    <div key={check.id} className="admin-usage-area-row">
                      <span><strong>{check.label}</strong><small>{check.detail}</small></span>
                      <em>{statusLabel(check.status)}</em>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          ) : null}

          <section className="admin-detail-grid admin-detail-grid--wide-left">
            <article className="app-card admin-action-card">
              <div className="status-row"><span className="semantic-badge info">Areas being used</span></div>
              <h2>Current app areas</h2>
              {usage.areas.length ? (
                <div className="admin-usage-area-list">
                  {usage.areas.map((item) => (
                    <div key={item.area} className="admin-usage-area-row">
                      <span>
                        <strong>{areaLabel(item.area)}</strong>
                        <small>{item.lastSeenAt ? `Last seen ${formatWebDateTime(item.lastSeenAt)}` : 'No recent heartbeat'}</small>
                      </span>
                      <em>{countLabel(item.liveCount)} live · {countLabel(item.count)} recent</em>
                    </div>
                  ))}
                </div>
              ) : <p className="notice-box info">No recent heartbeat rows yet. Open the web app as a logged-in user and refresh this page.</p>}
            </article>

            <article className="app-card admin-action-card">
              <div className="status-row"><span className="semantic-badge success">Privacy guardrail</span></div>
              <h2>No private content</h2>
              <p>{usage.privacy.note}</p>
              <p className="notice-box info">API monitoring stores method, safe route pattern, app area, status code, duration, optional user/session IDs, and timestamp only. It never stores request bodies, query strings, proposal messages, support text, or uploaded content.</p>
              {usage.retention ? <p className="notice-box info">Retention cleanup: {usage.retention.cleanup}</p> : null}
              {usage.usageWeights ? <p className="notice-box info">Usage weight rule: {usage.usageWeights.rule}</p> : null}
            </article>
          </section>

          <section className="admin-detail-grid admin-detail-grid--wide-left">
            <article className="app-card admin-action-card">
              <div className="status-row"><span className="semantic-badge admin">API areas</span></div>
              <h2>API area breakdown</h2>
              {usage.apiMetrics?.areaStats.length ? (
                <div className="admin-usage-area-list">
                  {usage.apiMetrics.areaStats.map((item) => (
                    <div key={item.area} className="admin-usage-area-row">
                      <span>
                        <strong>{areaLabel(item.area)}</strong>
                        <small>{countLabel(item.requests)} requests · {countLabel(item.errors)} errors · avg {durationLabel(item.averageDurationMs)}</small>
                      </span>
                      <em>max {durationLabel(item.maxDurationMs)}</em>
                    </div>
                  ))}
                </div>
              ) : <p className="notice-box info">No API metrics found in the last {apiWindowMinutes} minutes yet.</p>}
            </article>

            <article className="app-card admin-action-card">
              <div className="status-row"><span className="semantic-badge warning">Slow routes</span></div>
              <h2>Slowest safe route patterns</h2>
              {usage.apiMetrics?.slowestRoutes.length ? (
                <div className="admin-usage-area-list">
                  {usage.apiMetrics.slowestRoutes.slice(0, 6).map((item) => (
                    <div key={`${item.method}-${item.routePattern}`} className="admin-usage-area-row">
                      <span>
                        <strong>{item.method} <code>{item.routePattern}</code></strong>
                        <small>{countLabel(item.requests)} requests · {countLabel(item.errors)} errors · {areaLabel(item.appArea)}</small>
                      </span>
                      <em>avg {durationLabel(item.averageDurationMs)}</em>
                    </div>
                  ))}
                </div>
              ) : <p className="notice-box info">No slow route data yet.</p>}
            </article>
          </section>

          <section className="app-card admin-table-card">
            <div className="status-row"><span className="semantic-badge admin">Active users</span><span className="semantic-badge success">Safe drill-in</span></div>
            <h2>Active users table</h2>
            <p className="notice-box info">Drill-in links open the admin user moderation page or public profile only. They do not expose private proposal messages, support messages, request bodies, or raw private URLs.</p>
            {usage.activeUsers.length ? (
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                    <th>Area</th>
                    <th>Weight</th>
                    <th>Route pattern</th>
                    <th>API {apiWindowMinutes}m</th>
                    <th>Avg</th>
                    <th>Last active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.activeUsers.map((user) => (
                    <tr key={user.userId}>
                      <td><strong>{userLabel(user)}</strong><br /><span className="meta">{user.email}</span></td>
                      <td><span className={`semantic-badge ${user.liveNow ? 'success' : 'info'}`}>{user.liveNow ? 'Live now' : 'Recent'}</span></td>
                      <td>{areaLabel(user.currentArea)}</td>
                      <td><span className={`semantic-badge ${usageWeightBadgeTone(user.usageWeight)}`}>{usageWeightLabel(user.usageWeight)}</span><br /><span className="meta">{user.usageWeightReason ?? 'Safe recent usage signals only'}</span></td>
                      <td><code>{user.routePattern}</code></td>
                      <td>{countLabel(user.apiRequests15m)} req · {countLabel(user.apiErrors15m)} err</td>
                      <td>{durationLabel(user.apiAverageDurationMs15m)}</td>
                      <td>{formatWebDateTime(user.lastSeenAt)}</td>
                      <td>
                        <div className="admin-usage-action-links">
                          <Link className="button secondary" href={`/admin/users?userId=${encodeURIComponent(user.userId)}`}>Moderate</Link>
                          <Link className="button secondary" href={`/users/${encodeURIComponent(user.userId)}`}>Profile</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="notice-box info">No logged-in active users found in the last 15 minutes.</p>}
          </section>
        </>
      ) : null}
    </main>
  );
}
