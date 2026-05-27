'use client';

import { useMemo, useState } from 'react';
import {
  IDENTITY_VERIFICATION_STATUSES,
  PROFESSIONAL_STATUSES,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_TIERS,
  type IdentityVerificationStatus,
  type ProfessionalStatus,
  type SubscriptionStatus,
  type SubscriptionTier,
} from '@hellowhen/shared';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime, formatWebMoney } from '../../../lib/webFormat';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type FilterValue<T extends string> = T | 'all';

type AdminProUser = {
  id: string;
  email: string;
  role: string;
  trustTier: string;
  accountKind: string;
  professionalStatus: ProfessionalStatus;
  professionalStatusUpdatedAt: string | null;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStatusUpdatedAt: string | null;
  emailVerifiedAt: string | null;
  ageConfirmedAt: string | null;
  createdAt: string;
  profile: { displayName?: string | null; handle?: string | null; avatarUrl?: string | null } | null;
  professionalProfile: {
    displayName?: string | null;
    headline?: string | null;
    category?: string | null;
    status?: ProfessionalStatus;
    statusNote?: string | null;
    reviewedAt?: string | null;
  } | null;
  subscriptionState: {
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    provider?: string | null;
    trialStartedAt?: string | null;
    trialEndsAt?: string | null;
    currentPeriodStartedAt?: string | null;
    currentPeriodEndsAt?: string | null;
    expiresAt?: string | null;
    adminNote?: string | null;
  } | null;
  identityVerificationState: {
    provider?: string | null;
    status: IdentityVerificationStatus;
    submittedAt?: string | null;
    verifiedAt?: string | null;
    rejectedAt?: string | null;
    expiresAt?: string | null;
    rejectionReason?: string | null;
    adminNote?: string | null;
  } | null;
  access: { hasProAccess: boolean; blockers: string[] };
};

type AdminProResponse = {
  config: {
    subscriptionsEnabled: boolean;
    proAccountsEnabled: boolean;
    proAccountsVisible: boolean;
    proTrialsEnabled: boolean;
    identityVerificationEnabled: boolean;
    monthlyPriceCents: number;
    monthlyPriceCurrency: string;
    trialDays: number;
    providerConnected: boolean;
    publicUpgradeVisible: boolean;
  };
  summary: {
    verifiedProfessionals: number;
    activeProUsers: number;
    trialingProUsers: number;
    pendingIdentityReviews: number;
  };
  users: AdminProUser[];
};

type FormState = {
  professionalStatus: ProfessionalStatus;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  identityVerificationStatus: IdentityVerificationStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodStartedAt: string;
  currentPeriodEndsAt: string;
  expiresAt: string;
  verificationExpiresAt: string;
  professionalStatusNote: string;
  subscriptionAdminNote: string;
  identityAdminNote: string;
  rejectionReason: string;
  note: string;
};

const professionalStatusFilters = ['all', ...PROFESSIONAL_STATUSES] as const;
const subscriptionTierFilters = ['all', ...SUBSCRIPTION_TIERS] as const;
const subscriptionStatusFilters = ['all', ...SUBSCRIPTION_STATUSES] as const;
const identityStatusFilters = ['all', ...IDENTITY_VERIFICATION_STATUSES] as const;

function personLabel(user?: AdminProUser | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.professionalProfile?.displayName || user?.email || 'Unknown user';
}

function statusTone(value?: string) {
  if (value === 'verified' || value === 'active' || value === 'trialing' || value === 'pro') return 'success';
  if (value === 'pending' || value === 'pending_verification' || value === 'past_due') return 'warning';
  if (value === 'rejected' || value === 'suspended' || value === 'restricted' || value === 'expired') return 'danger';
  return 'admin';
}

function dateValue(value: string | Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function formFromUser(user: AdminProUser): FormState {
  return {
    professionalStatus: user.professionalStatus,
    subscriptionTier: user.subscriptionTier,
    subscriptionStatus: user.subscriptionStatus,
    identityVerificationStatus: user.identityVerificationState?.status ?? 'none',
    trialStartedAt: dateInputValue(user.subscriptionState?.trialStartedAt),
    trialEndsAt: dateInputValue(user.subscriptionState?.trialEndsAt),
    currentPeriodStartedAt: dateInputValue(user.subscriptionState?.currentPeriodStartedAt),
    currentPeriodEndsAt: dateInputValue(user.subscriptionState?.currentPeriodEndsAt),
    expiresAt: dateInputValue(user.subscriptionState?.expiresAt),
    verificationExpiresAt: dateInputValue(user.identityVerificationState?.expiresAt),
    professionalStatusNote: user.professionalProfile?.statusNote ?? '',
    subscriptionAdminNote: user.subscriptionState?.adminNote ?? '',
    identityAdminNote: user.identityVerificationState?.adminNote ?? '',
    rejectionReason: user.identityVerificationState?.rejectionReason ?? '',
    note: '',
  };
}

function compactDate(value: string | null | undefined) {
  return value ? formatWebDateTime(dateValue(value)) : 'not set';
}

function BlockerList({ blockers }: { blockers: string[] }) {
  if (!blockers.length) return <span className="semantic-badge success">Pro access</span>;
  return <span className="semantic-badge warning">{blockers.map((item) => item.replaceAll('_', ' ')).join(' · ')}</span>;
}

export default function AdminProPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [users, setUsers] = useState<AdminProUser[]>([]);
  const [config, setConfig] = useState<AdminProResponse['config'] | null>(null);
  const [summary, setSummary] = useState<AdminProResponse['summary'] | null>(null);
  const [query, setQuery] = useState('');
  const [professionalStatus, setProfessionalStatus] = useState<FilterValue<ProfessionalStatus>>('all');
  const [subscriptionTier, setSubscriptionTier] = useState<FilterValue<SubscriptionTier>>('all');
  const [subscriptionStatus, setSubscriptionStatus] = useState<FilterValue<SubscriptionStatus>>('all');
  const [identityStatus, setIdentityStatus] = useState<FilterValue<IdentityVerificationStatus>>('all');
  const [selectedUser, setSelectedUser] = useState<AdminProUser | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  function selectUser(user: AdminProUser) {
    setSelectedUser(user);
    setForm(formFromUser(user));
    setNotice(null);
  }

  function clearLocalSession() {
    clearAdminBrowserSession();
    setUsers([]);
    setSelectedUser(null);
    setForm(null);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  async function loadUsers() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (professionalStatus !== 'all') params.set('professionalStatus', professionalStatus);
      if (subscriptionTier !== 'all') params.set('subscriptionTier', subscriptionTier);
      if (subscriptionStatus !== 'all') params.set('subscriptionStatus', subscriptionStatus);
      if (identityStatus !== 'all') params.set('identityVerificationStatus', identityStatus);
      const suffix = params.toString() ? `?${params}` : '';
      const response = await fetch(`${apiBase}/admin/pro/users${suffix}`, { headers });
      if (!response.ok) throw new Error('Could not load Pro admin users. Make sure this account has admin role and satisfies 2FA requirements.');
      const data = await response.json() as AdminProResponse;
      setUsers(data.users);
      setConfig(data.config);
      setSummary(data.summary);
      if (selectedUser) {
        const updated = data.users.find((item) => item.id === selectedUser.id) ?? null;
        setSelectedUser(updated);
        setForm(updated ? formFromUser(updated) : null);
      }
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load Pro users.' });
    } finally {
      setLoading(false);
    }
  }

  async function saveUser() {
    if (!token || !selectedUser || !form) return;
    if (!form.note.trim()) {
      setNotice({ tone: 'warning', body: 'Add an internal admin note before changing Pro, subscription, or identity status.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const payload = {
        professionalStatus: form.professionalStatus,
        subscriptionTier: form.subscriptionTier,
        subscriptionStatus: form.subscriptionStatus,
        identityVerificationProvider: form.identityVerificationStatus === 'none' ? 'none' : 'manual',
        identityVerificationStatus: form.identityVerificationStatus,
        trialStartedAt: form.trialStartedAt || null,
        trialEndsAt: form.trialEndsAt || null,
        currentPeriodStartedAt: form.currentPeriodStartedAt || null,
        currentPeriodEndsAt: form.currentPeriodEndsAt || null,
        expiresAt: form.expiresAt || null,
        verificationExpiresAt: form.verificationExpiresAt || null,
        professionalStatusNote: form.professionalStatusNote.trim() || null,
        subscriptionAdminNote: form.subscriptionAdminNote.trim() || null,
        identityAdminNote: form.identityAdminNote.trim() || null,
        rejectionReason: form.rejectionReason.trim() || null,
        note: form.note.trim(),
      };
      const response = await fetch(`${apiBase}/admin/pro/users/${selectedUser.id}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || 'Could not save Pro admin changes.');
      }
      const data = await response.json() as { user: AdminProUser; config: AdminProResponse['config'] };
      setConfig(data.config);
      setSelectedUser(data.user);
      setUsers((current) => current.map((item) => item.id === data.user.id ? data.user : item));
      setForm(formFromUser(data.user));
      setNotice({ tone: 'success', body: 'Pro admin state saved and written to the audit log.' });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not save Pro admin changes.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-console">
      <section className="app-card admin-console__hero">
        <div className="status-row"><span className="semantic-badge admin">Pro foundation</span><span className="semantic-badge warning">Admin only</span></div>
        <h1>Professional subscriptions</h1>
        <p>Manually review future professional status, trial/subscription state, and identity verification state. This does not expose public upgrade buttons, checkout, or identity provider calls.</p>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Planned Pro price: {formatWebMoney(config?.monthlyPriceCents ?? 1499, config?.monthlyPriceCurrency ?? 'eur')}/month · trial default: {config?.trialDays ?? 14} days.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        {config ? <div className="admin-money-strip">
          <span><small>Subscriptions flag</small><strong>{config.subscriptionsEnabled ? 'enabled' : 'disabled'}</strong></span>
          <span><small>Pro visible</small><strong>{config.proAccountsVisible ? 'visible' : 'hidden'}</strong></span>
          <span><small>Provider</small><strong>{config.providerConnected ? 'connected' : 'none'}</strong></span>
          <span><small>Public upgrade</small><strong>{config.publicUpgradeVisible ? 'visible' : 'hidden'}</strong></span>
        </div> : null}
        {summary ? <div className="admin-money-strip">
          <span><small>Verified professionals</small><strong>{summary.verifiedProfessionals}</strong></span>
          <span><small>Active Pro</small><strong>{summary.activeProUsers}</strong></span>
          <span><small>Trialing Pro</small><strong>{summary.trialingProUsers}</strong></span>
          <span><small>Pending identity</small><strong>{summary.pendingIdentityReviews}</strong></span>
        </div> : null}
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      <section className="admin-detail-grid admin-detail-grid--wide-left">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Search</span><span className="semantic-badge admin">No billing provider</span></div>
          <h2>Professional users</h2>
          <div className="admin-trust-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email, name, handle, headline, or category" />
            <select value={professionalStatus} onChange={(event) => setProfessionalStatus(event.target.value as FilterValue<ProfessionalStatus>)}>
              {professionalStatusFilters.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
            <select value={subscriptionTier} onChange={(event) => setSubscriptionTier(event.target.value as FilterValue<SubscriptionTier>)}>
              {subscriptionTierFilters.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
            <select value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value as FilterValue<SubscriptionStatus>)}>
              {subscriptionStatusFilters.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
            <select value={identityStatus} onChange={(event) => setIdentityStatus(event.target.value as FilterValue<IdentityVerificationStatus>)}>
              {identityStatusFilters.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
            <button type="button" onClick={() => { void loadUsers(); }} disabled={loading || !token}>Load users</button>
          </div>
          <div className="admin-user-list">
            {users.map((user) => (
              <button type="button" key={user.id} className={selectedUser?.id === user.id ? 'admin-user-row is-active' : 'admin-user-row'} onClick={() => selectUser(user)}>
                <span>
                  <strong>{personLabel(user)}</strong>
                  <small>{user.email} · joined {formatWebDateTime(dateValue(user.createdAt))}</small>
                  <small>{user.professionalProfile?.headline || user.professionalProfile?.category || 'No professional profile yet'}</small>
                  <small><BlockerList blockers={user.access.blockers} /></small>
                </span>
                <em className={`semantic-badge ${statusTone(user.professionalStatus)}`}>{user.professionalStatus.replaceAll('_', ' ')}</em>
              </button>
            ))}
            {users.length === 0 ? <p>No Pro users loaded yet.</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          {selectedUser && form ? (
            <>
              <div className="status-row">
                <span className={`semantic-badge ${statusTone(selectedUser.professionalStatus)}`}>{selectedUser.professionalStatus.replaceAll('_', ' ')}</span>
                <span className={`semantic-badge ${statusTone(selectedUser.subscriptionStatus)}`}>{selectedUser.subscriptionTier.replaceAll('_', ' ')} · {selectedUser.subscriptionStatus.replaceAll('_', ' ')}</span>
                <BlockerList blockers={selectedUser.access.blockers} />
              </div>
              <h2>{personLabel(selectedUser)}</h2>
              <p className="meta">{selectedUser.email}</p>
              <p className="meta">Professional status updated: {compactDate(selectedUser.professionalStatusUpdatedAt)} · subscription updated: {compactDate(selectedUser.subscriptionStatusUpdatedAt)}</p>

              <div className="admin-template-form">
                <div className="admin-template-form__grid">
                  <label>Professional status
                    <select value={form.professionalStatus} onChange={(event) => updateForm('professionalStatus', event.target.value as ProfessionalStatus)}>
                      {PROFESSIONAL_STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                    </select>
                  </label>
                  <label>Subscription tier
                    <select value={form.subscriptionTier} onChange={(event) => updateForm('subscriptionTier', event.target.value as SubscriptionTier)}>
                      {SUBSCRIPTION_TIERS.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                    </select>
                  </label>
                  <label>Subscription status
                    <select value={form.subscriptionStatus} onChange={(event) => updateForm('subscriptionStatus', event.target.value as SubscriptionStatus)}>
                      {SUBSCRIPTION_STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                    </select>
                  </label>
                  <label>Identity status
                    <select value={form.identityVerificationStatus} onChange={(event) => updateForm('identityVerificationStatus', event.target.value as IdentityVerificationStatus)}>
                      {IDENTITY_VERIFICATION_STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                    </select>
                  </label>
                  <label>Trial starts
                    <input type="date" value={form.trialStartedAt} onChange={(event) => updateForm('trialStartedAt', event.target.value)} />
                  </label>
                  <label>Trial ends
                    <input type="date" value={form.trialEndsAt} onChange={(event) => updateForm('trialEndsAt', event.target.value)} />
                  </label>
                  <label>Current period starts
                    <input type="date" value={form.currentPeriodStartedAt} onChange={(event) => updateForm('currentPeriodStartedAt', event.target.value)} />
                  </label>
                  <label>Current period ends
                    <input type="date" value={form.currentPeriodEndsAt} onChange={(event) => updateForm('currentPeriodEndsAt', event.target.value)} />
                  </label>
                  <label>Subscription expires
                    <input type="date" value={form.expiresAt} onChange={(event) => updateForm('expiresAt', event.target.value)} />
                  </label>
                  <label>Identity expires
                    <input type="date" value={form.verificationExpiresAt} onChange={(event) => updateForm('verificationExpiresAt', event.target.value)} />
                  </label>
                </div>
                <label>Professional review note
                  <textarea value={form.professionalStatusNote} onChange={(event) => updateForm('professionalStatusNote', event.target.value)} rows={3} placeholder="Visible/internal note for professional review state." />
                </label>
                <label>Subscription admin note
                  <textarea value={form.subscriptionAdminNote} onChange={(event) => updateForm('subscriptionAdminNote', event.target.value)} rows={3} placeholder="Internal note for trial/subscription state." />
                </label>
                <label>Identity admin note
                  <textarea value={form.identityAdminNote} onChange={(event) => updateForm('identityAdminNote', event.target.value)} rows={3} placeholder="Internal note for manual identity review." />
                </label>
                <label>Identity rejection reason
                  <textarea value={form.rejectionReason} onChange={(event) => updateForm('rejectionReason', event.target.value)} rows={2} placeholder="Reason if identity/professional review is rejected." />
                </label>
                <label>Required audit note
                  <textarea value={form.note} onChange={(event) => updateForm('note', event.target.value)} rows={3} placeholder="Required internal admin note for the audit log." />
                </label>
                <div className="cta-row">
                  <button type="button" onClick={() => { void saveUser(); }} disabled={loading || !token}>Save Pro state</button>
                  <button type="button" className="secondary" onClick={() => selectUser(selectedUser)} disabled={loading}>Reset form</button>
                </div>
              </div>
              <p className="notice-box warning">Manual Pro state is for hidden admin testing only. It does not create invoices, payments, provider verification, or public upgrade access.</p>
            </>
          ) : (
            <>
              <div className="status-row"><span className="semantic-badge admin">Select a user</span></div>
              <h2>Pro state detail</h2>
              <p>Load users and select one to manage professional review, subscription state, trial dates, identity state, and audit notes.</p>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
