'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminLaunchChecklistResponse, AdminModerationSmokeResponse, AdminOverviewResponse, AdminRuntimeQaResponse, AdminUserSummaryDto, AdminUsersResponse, UserTrustTier } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../lib/api';
import { formatWebDateTime, formatWebMoney } from '../../lib/webFormat';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../features/admin/adminSession';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

const trustTiers: Array<UserTrustTier | 'all'> = ['all', 'new', 'email_verified', 'stripe_verified', 'trusted', 'restricted'];
const roleFilters = ['all', 'user', 'admin'] as const;

function checklistTone(status?: string) {
  if (status === 'pass') return 'success';
  if (status === 'fail') return 'danger';
  return 'warning';
}

const adminSections = [
  { href: '/admin/reports', title: 'Report queue', body: 'Review user-submitted reports, hide unsafe content, and suspend target owners when needed.', tone: 'danger' },
  { href: '/admin/support', title: 'Support inbox', body: 'Review support tickets, internal notes, and user replies.', tone: 'info' },
  { href: '/admin/media', title: 'Media moderation', body: 'Flag, remove, or restore uploaded profile, need, offer, and support images.', tone: 'warning' },
  { href: '/admin/content', title: 'Content moderation', body: 'Hide, restore, close, or mark reviewed trades, needs, and offers.', tone: 'danger' },
  { href: '/admin/disputes', title: 'Trade disputes', body: 'Review reported trades and resolve service-money disputes safely.', tone: 'danger' },
  { href: '/admin/payouts', title: 'Payout review', body: 'Hidden unless payout tools are enabled for the launch mode.', tone: 'money' },
  { href: '/admin/money', title: 'Money provider', body: 'Sandbox/provider account diagnostics for future money launch.', tone: 'admin' },
  { href: '/admin/credits', title: 'Credit purchases', body: 'Legacy/demo credit purchase history while money features remain gated.', tone: 'admin' },
];

function personLabel(user?: { email?: string; profile?: { displayName?: string | null; handle?: string | null } | null } | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}

function tierTone(tier?: string) {
  if (tier === 'restricted') return 'danger';
  if (tier === 'trusted' || tier === 'stripe_verified') return 'success';
  if (tier === 'email_verified') return 'info';
  return 'admin';
}

function moneyFlagLabel(overview: AdminOverviewResponse | null) {
  const money = overview?.summary.money;
  if (!money) return 'Unknown';
  if (money.realMoneyEnabled) return 'Real money enabled';
  if (money.moneyFeaturesVisible) return 'Demo/sandbox money visible';
  return 'Money hidden';
}

function countLabel(value?: number | null) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

function dateValue(value: string | Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}


function ageConfirmationLabel(user: AdminUserSummaryDto) {
  if (!user.ageConfirmedAt) return 'Age not confirmed';
  const bucket = user.declaredAgeBucket === '18_plus' ? '18+' : user.declaredAgeBucket || 'unknown bucket';
  return `${bucket} confirmed ${formatWebDateTime(dateValue(user.ageConfirmedAt))}`;
}

function userCounts(user: AdminUserSummaryDto) {
  const counts = user._count;
  if (!counts) return 'No activity counts';
  return `${counts.trades} trades · ${counts.needs} needs · ${counts.offers} offers · ${counts.supportTickets} tickets`;
}

export default function AdminHomePage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [moderationSmoke, setModerationSmoke] = useState<AdminModerationSmokeResponse | null>(null);
  const [launchChecklist, setLaunchChecklist] = useState<AdminLaunchChecklistResponse | null>(null);
  const [runtimeQa, setRuntimeQa] = useState<AdminRuntimeQaResponse | null>(null);
  const [users, setUsers] = useState<AdminUserSummaryDto[]>([]);
  const [query, setQuery] = useState('');
  const [trustTier, setTrustTier] = useState<UserTrustTier | 'all'>('all');
  const [role, setRole] = useState<(typeof roleFilters)[number]>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUserSummaryDto | null>(null);
  const [nextTier, setNextTier] = useState<UserTrustTier>('new');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  function clearLocalSession() {
    clearAdminBrowserSession();
    setOverview(null);
    setModerationSmoke(null);
    setLaunchChecklist(null);
    setRuntimeQa(null);
    setUsers([]);
    setSelectedUser(null);
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

  async function loadUsers() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (trustTier !== 'all') params.set('trustTier', trustTier);
      if (role !== 'all') params.set('role', role);
      const suffix = params.toString() ? `?${params}` : '';
      const response = await fetch(`${apiBase}/admin/users${suffix}`, { headers });
      if (!response.ok) throw new Error('Could not load admin users.');
      const data = await response.json() as AdminUsersResponse;
      setUsers(data.users);
      if (selectedUser) {
        const updatedSelected = data.users.find((item) => item.id === selectedUser.id) ?? null;
        setSelectedUser(updatedSelected);
        if (updatedSelected) setNextTier(updatedSelected.trustTier);
      }
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load users.' });
    } finally {
      setLoading(false);
    }
  }


  async function moderateUser(action: 'suspend' | 'restore' | 'mark_reviewed' | 'force_logout', restoreTier: UserTrustTier = 'new') {
    if (!token || !selectedUser) return;
    if ((action === 'suspend' || action === 'restore') && !note.trim()) {
      setNotice({ tone: 'warning', body: 'Add an internal note before suspending or restoring a user.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/users/${selectedUser.id}/moderation`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action, trustTier: restoreTier, note: note.trim() || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not apply the user moderation action.');
      }
      const data = await response.json() as { user: AdminUserSummaryDto };
      setSelectedUser(data.user);
      setUsers((current) => current.map((item) => item.id === data.user.id ? data.user : item));
      setNextTier(data.user.trustTier);
      setNote('');
      setNotice({ tone: 'success', body: `User moderation action saved: ${action.replaceAll('_', ' ')}.` });
      void loadOverview();
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not moderate user.' });
    } finally {
      setLoading(false);
    }
  }

  async function updateTrustTier() {
    if (!token || !selectedUser) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/users/${selectedUser.id}/trust-tier`, { method: 'PATCH', headers, body: JSON.stringify({ trustTier: nextTier, note: note.trim() || undefined }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not update the user trust tier.');
      }
      const data = await response.json() as { user: AdminUserSummaryDto };
      setSelectedUser(data.user);
      setUsers((current) => current.map((item) => item.id === data.user.id ? data.user : item));
      setNote('');
      setNotice({ tone: 'success', body: 'User trust tier updated and written to the admin audit log.' });
      void loadOverview();
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not update user.' });
    } finally {
      setLoading(false);
    }
  }

  function selectUser(user: AdminUserSummaryDto) {
    setSelectedUser(user);
    setNextTier(user.trustTier);
    setNote('');
  }

  const summary = overview?.summary;
  const recentAuditLogs = overview?.recentAuditLogs ?? [];

  return (
    <main className="admin-console">
      <section className="admin-console__hero app-card">
        <div className="status-row">
          <span className="semantic-badge admin">Admin foundation</span>
          <span className={`semantic-badge ${summary?.money.realMoneyEnabled ? 'danger' : summary?.money.moneyFeaturesVisible ? 'warning' : 'success'}`}>{moneyFlagLabel(overview)}</span>
        </div>
        <div>
          <p className="eyebrow">Phase 24.6</p>
          <h1>Launch admin dashboard</h1>
          <p>One safe entry point for launch health, runtime QA, user limits, support queues, content moderation, and audit history. Keep money tools gated until the launch mode explicitly enables them.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Internal tools use your signed-in admin app session. No standalone admin login is shown on public pages.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        <div className="cta-row">
          <button type="button" onClick={() => { void loadOverview(); void loadUsers(); void loadModerationSmoke(); void loadLaunchChecklist(); void loadRuntimeQa(); }} disabled={loading || !token}>Load dashboard</button>
          <button type="button" className="secondary" onClick={() => { void loadLaunchChecklist(); }} disabled={loading || !token}>Run launch checklist</button>
          <button type="button" className="secondary" onClick={() => { void loadRuntimeQa(); }} disabled={loading || !token}>Run runtime QA</button>
          <button type="button" className="secondary" onClick={() => { void loadModerationSmoke(); }} disabled={loading || !token}>Run moderation smoke</button>
          <Link className="button secondary" href="/admin/support">Open support inbox</Link>
          <Link className="button secondary" href="/admin/media">Open media moderation</Link>
          <Link className="button secondary" href="/admin/content">Open content moderation</Link>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      {summary ? (
        <section className="admin-metric-grid">
          <article className="admin-metric-card"><p>Total users</p><strong>{countLabel(summary.users.total)}</strong><span className="meta">{countLabel(summary.users.new7d)} new this week · {countLabel(summary.users.restricted)} restricted</span></article>
          <article className="admin-metric-card"><p>Active public content</p><strong>{countLabel(summary.content.activeTrades)}</strong><span className="meta">{countLabel(summary.content.activeNeeds)} needs · {countLabel(summary.content.activeOffers)} offers</span></article>
          <article className="admin-metric-card"><p>Reports / support</p><strong>{countLabel(summary.reports.pending + summary.reports.reviewing)}</strong><span className="meta">{countLabel(summary.reports.pending)} pending reports · {countLabel(summary.support.open)} support tickets</span></article>
          <article className="admin-metric-card"><p>Media review</p><strong>{countLabel(summary.media.pendingReview + summary.media.flagged)}</strong><span className="meta">{countLabel(summary.media.pendingReview)} pending · {countLabel(summary.media.flagged)} flagged</span></article>
        </section>
      ) : null}

      {launchChecklist ? (
        <section className="app-card admin-action-card">
          <div className="status-row">
            <span className={`semantic-badge ${checklistTone(launchChecklist.overallStatus)}`}>Launch checklist: {launchChecklist.overallStatus}</span>
            <span className="semantic-badge admin">{launchChecklist.summary.pass} pass · {launchChecklist.summary.warning} warning · {launchChecklist.summary.fail} fail</span>
          </div>
          <h2>Final admin launch safety checklist</h2>
          <p>Use this before a demo or first launch to confirm admin access, safety queues, public visibility, and money gates.</p>
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

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Users</span><span className="semantic-badge admin">Launch limits</span></div>
          <h2>User search</h2>
          <p>Use Suspend for launch moderation. It sets the user to restricted, revokes active sessions, blocks new posts/proposals, and writes an audit entry without deleting the account.</p>
          <div className="admin-trust-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email, display name, or handle" />
            <select value={trustTier} onChange={(event) => setTrustTier(event.target.value as UserTrustTier | 'all')}>
              {trustTiers.map((tier) => <option key={tier} value={tier}>{tier.replaceAll('_', ' ')}</option>)}
            </select>
            <select value={role} onChange={(event) => setRole(event.target.value as (typeof roleFilters)[number])}>
              {roleFilters.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="button" onClick={() => { void loadUsers(); }} disabled={loading || !token}>Load users</button>
          </div>
          <div className="admin-user-list">
            {users.map((user) => (
              <button type="button" key={user.id} className={selectedUser?.id === user.id ? 'admin-user-row is-active' : 'admin-user-row'} onClick={() => selectUser(user)}>
                <span>
                  <strong>{personLabel(user)}</strong>
                  <small>{user.email} · joined {formatWebDateTime(dateValue(user.createdAt))}</small>
                  <small>{ageConfirmationLabel(user)}</small>
                  <small>{userCounts(user)}</small>
                </span>
                <em className={`semantic-badge ${tierTone(user.trustTier)}`}>{user.trustTier.replaceAll('_', ' ')}</em>
              </button>
            ))}
            {users.length === 0 ? <p>No users loaded yet.</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          {selectedUser ? (
            <>
              <div className="status-row"><span className={`semantic-badge ${tierTone(selectedUser.trustTier)}`}>{selectedUser.trustTier.replaceAll('_', ' ')}</span><span className="semantic-badge admin">{selectedUser.role}</span>{selectedUser.emailVerifiedAt ? <span className="semantic-badge success">email verified</span> : <span className="semantic-badge warning">email not verified</span>}{selectedUser.ageConfirmedAt ? <span className="semantic-badge success">18+ confirmed</span> : <span className="semantic-badge warning">age not confirmed</span>}</div>
              <h2>{personLabel(selectedUser)}</h2>
              <p className="meta">{selectedUser.email}</p>
              <p className="meta">Age policy: {ageConfirmationLabel(selectedUser)}</p>
              <div className="admin-money-strip">
                <span><small>Wallet balance</small><strong>{formatWebMoney(Number(selectedUser.wallet?.availableBalanceCents ?? 0), selectedUser.wallet?.currency ?? 'eur')}</strong></span>
                <span><small>Held</small><strong>{formatWebMoney(Number(selectedUser.wallet?.heldBalanceCents ?? 0), selectedUser.wallet?.currency ?? 'eur')}</strong></span>
                <span><small>Pending payout</small><strong>{formatWebMoney(Number(selectedUser.wallet?.pendingPayoutCents ?? 0), selectedUser.wallet?.currency ?? 'eur')}</strong></span>
              </div>
              <div className="admin-action-card">
                <label className="meta" htmlFor="admin-user-next-tier">Trust tier</label>
                <select id="admin-user-next-tier" value={nextTier} onChange={(event) => setNextTier(event.target.value as UserTrustTier)}>
                  {trustTiers.filter((tier): tier is UserTrustTier => tier !== 'all').map((tier) => <option key={tier} value={tier}>{tier.replaceAll('_', ' ')}</option>)}
                </select>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal admin note. Required for restriction/reinstatement decisions." rows={4} />
                <div className="cta-row">
                  <button type="button" onClick={() => { void updateTrustTier(); }} disabled={loading || !token || nextTier === selectedUser.trustTier}>Save trust tier</button>
                  <button type="button" className="danger" onClick={() => { void moderateUser('suspend'); }} disabled={loading || !token || selectedUser.trustTier === 'restricted'}>Suspend user</button>
                  <button type="button" className="success" onClick={() => { void moderateUser('restore', nextTier === 'restricted' ? 'new' : nextTier); }} disabled={loading || !token || selectedUser.trustTier !== 'restricted'}>Restore user</button>
                  <button type="button" className="secondary" onClick={() => { void moderateUser('force_logout'); }} disabled={loading || !token}>Force logout</button>
                  <Link className="button secondary" href={`/users/${selectedUser.id}`}>View public profile</Link>
                </div>
              </div>
              <p className="notice-box warning">Do not delete users for launch moderation. Suspend first, add an internal note, then review related support/media/trade/content history.</p>
            </>
          ) : (
            <>
              <div className="status-row"><span className="semantic-badge admin">Select a user</span></div>
              <h2>User detail</h2>
              <p>Load users and select one to review trust tier, launch limits, wallet exposure, and moderation context.</p>
            </>
          )}
        </article>
      </section>

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge warning">Safety queues</span></div>
          <h2>Launch admin sections</h2>
          <div className="admin-section-grid">
            {adminSections.map((section) => (
              <Link key={section.href} href={section.href} className="admin-section-card">
                <span className={`semantic-badge ${section.tone}`}>{section.title}</span>
                <p>{section.body}</p>
              </Link>
            ))}
          </div>
        </article>

        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Recent queue</span></div>
          <h2>Support needing attention</h2>
          <div className="admin-audit-list">
            {(overview?.recentTickets ?? []).map((ticket) => {
              const item = ticket as { id: string; subject: string; status: string; priority: string; category: string; updatedAt: string; user?: { email?: string; profile?: { displayName?: string | null } | null } | null; _count?: { messages?: number } };
              return (
                <Link key={item.id} href="/admin/support" className="admin-audit-row">
                  <span><strong>{item.subject}</strong><small>{personLabel(item.user)} · {item.category.replaceAll('_', ' ')} · {formatWebDateTime(dateValue(item.updatedAt))}</small></span>
                  <em className={`semantic-badge ${item.priority === 'urgent' || item.priority === 'high' ? 'danger' : 'info'}`}>{item.priority}</em>
                </Link>
              );
            })}
            {overview && (overview.recentTickets ?? []).length === 0 ? <p>No open support tickets in the latest queue.</p> : null}
            {!overview ? <p>Load the dashboard to see recent support tickets.</p> : null}
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
          {overview && recentAuditLogs.length === 0 ? <p>No admin audit log entries yet. Trust-tier, media, support, and dispute actions will appear here.</p> : null}
          {!overview ? <p>Load the dashboard to see recent audit entries.</p> : null}
        </div>
      </section>
    </main>
  );
}
