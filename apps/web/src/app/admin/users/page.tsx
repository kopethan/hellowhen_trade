'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { AdminUserSummaryDto, AdminUsersResponse, UserTrustTier } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime, formatWebMoney } from '../../../lib/webFormat';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

const trustTiers: Array<UserTrustTier | 'all'> = ['all', 'new', 'email_verified', 'stripe_verified', 'trusted', 'restricted'];
const roleFilters = ['all', 'user', 'admin'] as const;

function personLabel(user?: { email?: string; profile?: { displayName?: string | null; handle?: string | null } | null } | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}

function tierTone(tier?: string) {
  if (tier === 'restricted') return 'danger';
  if (tier === 'trusted' || tier === 'stripe_verified') return 'success';
  if (tier === 'email_verified') return 'info';
  return 'admin';
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

export default function AdminUsersPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [users, setUsers] = useState<AdminUserSummaryDto[]>([]);
  const [query, setQuery] = useState('');
  const [trustTier, setTrustTier] = useState<UserTrustTier | 'all'>('all');
  const [role, setRole] = useState<(typeof roleFilters)[number]>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUserSummaryDto | null>(null);
  const [nextTier, setNextTier] = useState<UserTrustTier>('new');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deepLinkUserId, setDeepLinkUserId] = useState<string | null>(null);

  useEffect(() => {
    const userId = new URLSearchParams(window.location.search).get('userId');
    if (userId) setDeepLinkUserId(userId);
  }, []);

  useEffect(() => {
    if (!token || !deepLinkUserId) return;
    void openUser(deepLinkUserId);
    setDeepLinkUserId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, deepLinkUserId]);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setUsers([]);
    setSelectedUser(null);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
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
      if (!response.ok) throw new Error('Could not load admin users. Make sure this account has admin role and satisfies 2FA requirements.');
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

  async function openUser(userId: string) {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams({ userId });
      const response = await fetch(`${apiBase}/admin/users?${params}`, { headers });
      if (!response.ok) throw new Error('Could not load the linked admin user. Make sure this account has admin role and satisfies 2FA requirements.');
      const data = await response.json() as AdminUsersResponse;
      const linkedUser = data.users[0] ?? null;
      setUsers(data.users);
      setSelectedUser(linkedUser);
      if (linkedUser) {
        setNextTier(linkedUser.trustTier);
        setQuery(linkedUser.email);
        setNotice({ tone: 'success', body: `Loaded linked user ${personLabel(linkedUser)} from usage monitoring.` });
      } else {
        setNotice({ tone: 'warning', body: 'The linked user was not found or is no longer available.' });
      }
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load the linked user.' });
    } finally {
      setLoading(false);
    }
  }


  async function moderateUser(action: 'suspend' | 'restore' | 'mark_reviewed' | 'force_logout', restoreTier: UserTrustTier = 'new') {
    if (!token || !selectedUser) return;
    if ((action === 'suspend' || action === 'restore' || action === 'force_logout') && !note.trim()) {
      setNotice({ tone: 'warning', body: 'Add an internal note before suspending, restoring, or force-logging-out a user.' });
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

  return (
    <main className="admin-console">
      <section className="app-card admin-console__hero">
        <div className="status-row"><span className="semantic-badge info">Users</span><span className="semantic-badge admin">One job: account moderation</span></div>
        <h1>User moderation</h1>
        <p>Search accounts, verify launch status, suspend unsafe users, restore restricted users, force logout sessions, and open safe user drill-ins from usage monitoring without deleting accounts.</p>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Suspension sets the user to restricted, revokes active sessions, blocks new posts/proposals, and writes an audit entry.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Search</span><span className="semantic-badge admin">Launch limits</span></div>
          <h2>User search</h2>
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
              <p className="notice-box warning">Do not delete users for launch moderation. Suspend/restore users with internal notes only; every restriction and reversal stays visible in the audit log.</p>
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
    </main>
  );
}
