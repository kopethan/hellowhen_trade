'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { publicBusinessPath } from '@hellowhen/shared';
import Link from 'next/link';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { businessStatusLabel, businessTypeLabel, formatDateTime } from './accountPresentation';

type BusinessRole = 'owner' | 'admin' | 'finance' | 'member';
type BusinessInviteRole = Exclude<BusinessRole, 'owner'>;
type BusinessProfile = {
  id: string;
  displayName: string;
  handle?: string | null;
  type: string;
  status: string;
  preferredCurrency?: string;
  countryCode?: string | null;
  counts?: { needs?: number; offers?: number; trades?: number; inventoryTemplates?: number; campaigns?: number };
};
type BusinessMember = {
  id: string;
  userId: string;
  role: BusinessRole;
  createdAt?: string;
  user?: { id: string; email: string; profile?: { displayName?: string | null; handle?: string | null } | null };
};
type BusinessInvitation = {
  id: string;
  email: string;
  role: BusinessRole;
  status: string;
  expiresAt?: string | null;
  createdAt?: string;
  businessProfile?: { id: string; displayName: string; type: string; status: string };
  invitedBy?: { email?: string; profile?: { displayName?: string | null } | null };
};
type BusinessAuditLog = {
  id: string;
  action: string;
  targetEmail?: string | null;
  note?: string | null;
  createdAt?: string;
  actor?: { email?: string; profile?: { displayName?: string | null } | null };
};
type BusinessTemplateStatus = 'draft' | 'pending_review' | 'active' | 'rejected' | 'archived';
type BusinessTemplateKind = 'need' | 'offer';
type BusinessTemplate = {
  id: string;
  key: string;
  kind: BusinessTemplateKind;
  title: string;
  description: string;
  itemType?: 'service' | 'goods' | 'other';
  languageCode?: 'en' | 'fr';
  status: BusinessTemplateStatus;
  sourceType?: string;
  category?: string | null;
  timing?: string | null;
  availability?: string | null;
  sortOrder?: number;
  updatedAt?: string;
  _count?: { createdNeeds?: number; createdOffers?: number };
};
type BusinessTemplateForm = {
  kind: BusinessTemplateKind;
  title: string;
  description: string;
  itemType: 'service' | 'goods' | 'other';
  languageCode: 'en' | 'fr';
  category: string;
  timing: string;
  availability: string;
};
const emptyTemplateForm: BusinessTemplateForm = { kind: 'need', title: '', description: '', itemType: 'service', languageCode: 'en', category: '', timing: '', availability: '' };

type BusinessContentStatus = 'draft' | 'pending_review' | 'active' | 'rejected' | 'closed' | 'expired' | 'fulfilled' | 'accepted';
type BusinessOwnedItem = {
  id: string;
  title: string;
  description: string;
  itemType?: 'service' | 'goods' | 'other';
  status: BusinessContentStatus;
  category?: string | null;
  timing?: string | null;
  availability?: string | null;
  updatedAt?: string;
  _count?: { trades?: number };
};
type BusinessContentForm = {
  kind: BusinessTemplateKind;
  title: string;
  description: string;
  itemType: 'service' | 'goods' | 'other';
  category: string;
  timing: string;
  availability: string;
};
const emptyContentForm: BusinessContentForm = { kind: 'need', title: '', description: '', itemType: 'service', category: '', timing: '', availability: '' };

type BusinessCampaignStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'paused' | 'archived' | 'completed';
type BusinessCampaignOpportunityType = 'collaboration' | 'creator_request' | 'service_request' | 'community' | 'research' | 'other';
type BusinessCampaignItemTargetType = 'need' | 'offer' | 'inventory_template';
type BusinessCampaignItem = {
  id: string;
  targetType: BusinessCampaignItemTargetType;
  targetId: string;
  note?: string | null;
  sortOrder?: number;
  target?: { id: string; title?: string | null; status?: string | null; kind?: string | null } | null;
};
type BusinessCampaign = {
  id: string;
  opportunityType: BusinessCampaignOpportunityType;
  status: BusinessCampaignStatus;
  title: string;
  summary?: string | null;
  description: string;
  eligibility?: string | null;
  deliverables?: string | null;
  updatedAt?: string;
  items?: BusinessCampaignItem[];
  _count?: { items?: number; applications?: number };
};
type BusinessCampaignForm = {
  opportunityType: BusinessCampaignOpportunityType;
  title: string;
  summary: string;
  description: string;
  eligibility: string;
  deliverables: string;
};
type BusinessCampaignItemForm = { targetType: BusinessCampaignItemTargetType; targetId: string; note: string; sortOrder: string };
const emptyCampaignForm: BusinessCampaignForm = { opportunityType: 'collaboration', title: '', summary: '', description: '', eligibility: '', deliverables: '' };
const emptyCampaignItemForm: BusinessCampaignItemForm = { targetType: 'need', targetId: '', note: '', sortOrder: '0' };


type TeamResponse = {
  businessProfile?: Pick<BusinessProfile, 'id' | 'displayName' | 'type' | 'status'> & { ownerId?: string };
  myRole?: BusinessRole | null;
  canManageTeam?: boolean;
  members?: BusinessMember[];
  invitations?: BusinessInvitation[];
  auditLogs?: BusinessAuditLog[];
};

const roleOptions: BusinessInviteRole[] = ['member', 'finance', 'admin'];

function memberName(member: BusinessMember) {
  return member.user?.profile?.displayName || member.user?.email || 'Team member';
}

function auditActor(log: BusinessAuditLog) {
  return log.actor?.profile?.displayName || log.actor?.email || 'Team action';
}

function cleanAction(value: string) {
  return value.replace(/^business_team_/, '').replaceAll('_', ' ');
}

export function BusinessAccountsClient() {
  const auth = useWebAuth();
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [invitationsMine, setInvitationsMine] = useState<BusinessInvitation[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [templates, setTemplates] = useState<BusinessTemplate[]>([]);
  const [businessNeeds, setBusinessNeeds] = useState<BusinessOwnedItem[]>([]);
  const [businessOffers, setBusinessOffers] = useState<BusinessOwnedItem[]>([]);
  const [businessCampaigns, setBusinessCampaigns] = useState<BusinessCampaign[]>([]);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<'all' | BusinessCampaignStatus>('all');
  const [campaignForm, setCampaignForm] = useState<BusinessCampaignForm>(emptyCampaignForm);
  const [campaignReviewNotes, setCampaignReviewNotes] = useState<Record<string, string>>({});
  const [campaignItemForms, setCampaignItemForms] = useState<Record<string, BusinessCampaignItemForm>>({});
  const [contentKindFilter, setContentKindFilter] = useState<BusinessTemplateKind>('need');
  const [contentStatusFilter, setContentStatusFilter] = useState<'all' | BusinessContentStatus>('all');
  const [contentForm, setContentForm] = useState<BusinessContentForm>(emptyContentForm);
  const [contentReviewNotes, setContentReviewNotes] = useState<Record<string, string>>({});
  const [templateStatusFilter, setTemplateStatusFilter] = useState<'all' | BusinessTemplateStatus>('all');
  const [templateForm, setTemplateForm] = useState<BusinessTemplateForm>(emptyTemplateForm);
  const [templateReviewNotes, setTemplateReviewNotes] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<BusinessInviteRole>('member');
  const [inviteNote, setInviteNote] = useState('');
  const [memberNotes, setMemberNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === selectedId) ?? profiles[0] ?? null, [profiles, selectedId]);

  async function loadProfiles() {
    if (!auth.hydrated || !auth.isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [profileResult, invitationResult] = await Promise.all([
        api.business.mine() as Promise<{ businessProfiles?: BusinessProfile[] }>,
        api.business.invitationsMine() as Promise<{ invitations?: BusinessInvitation[] }>,
      ]);
      const nextProfiles = profileResult.businessProfiles ?? [];
      setProfiles(nextProfiles);
      setInvitationsMine(invitationResult.invitations ?? []);
      setSelectedId((current) => current || nextProfiles[0]?.id || '');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setProfiles([]);
      setInvitationsMine([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeam(profileId = selectedProfile?.id) {
    if (!profileId) { setTeam(null); return; }
    try {
      const result = await api.business.team(profileId) as TeamResponse;
      setTeam(result);
    } catch (caughtError) {
      setTeam(null);
      setError(getFriendlyApiErrorMessage(caughtError));
    }
  }

  async function loadTemplates(profileId = selectedProfile?.id) {
    if (!profileId) { setTemplates([]); return; }
    try {
      const result = await api.business.templates(profileId, { kind: 'all', status: templateStatusFilter, take: 50 }) as { templates?: BusinessTemplate[] };
      setTemplates(result.templates ?? []);
    } catch (caughtError) {
      setTemplates([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    }
  }

  async function loadBusinessInventory(profileId = selectedProfile?.id) {
    if (!profileId) { setBusinessNeeds([]); setBusinessOffers([]); return; }
    try {
      if (contentKindFilter === 'need') {
        const result = await api.business.businessNeeds(profileId, { status: contentStatusFilter, take: 50 }) as { needs?: BusinessOwnedItem[] };
        setBusinessNeeds(result.needs ?? []);
        setBusinessOffers([]);
      } else {
        const result = await api.business.businessOffers(profileId, { status: contentStatusFilter, take: 50 }) as { offers?: BusinessOwnedItem[] };
        setBusinessOffers(result.offers ?? []);
        setBusinessNeeds([]);
      }
    } catch (caughtError) {
      setBusinessNeeds([]);
      setBusinessOffers([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    }
  }

  async function loadBusinessCampaigns(profileId = selectedProfile?.id) {
    if (!profileId) { setBusinessCampaigns([]); return; }
    try {
      const result = await api.business.campaigns(profileId, { status: campaignStatusFilter, opportunityType: 'all', take: 50 }) as { campaigns?: BusinessCampaign[] };
      const nextCampaigns = result.campaigns ?? [];
      setBusinessCampaigns(nextCampaigns);
      setCampaignItemForms((current) => {
        const next = { ...current };
        for (const campaign of nextCampaigns) if (!next[campaign.id]) next[campaign.id] = emptyCampaignItemForm;
        return next;
      });
    } catch (caughtError) {
      setBusinessCampaigns([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    }
  }


  useEffect(() => { void loadProfiles(); }, [auth.hydrated, auth.isAuthenticated]);
  useEffect(() => { void loadTeam(selectedProfile?.id); void loadTemplates(selectedProfile?.id); void loadBusinessInventory(selectedProfile?.id); void loadBusinessCampaigns(selectedProfile?.id); }, [selectedProfile?.id, templateStatusFilter, contentKindFilter, contentStatusFilter, campaignStatusFilter]);

  async function acceptInvitation(invitation: BusinessInvitation) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.acceptInvitation(invitation.id, {});
      setMessage(`Joined ${invitation.businessProfile?.displayName ?? 'business team'}.`);
      await loadProfiles();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.inviteMember(selectedProfile.id, { email: inviteEmail, role: inviteRole, note: inviteNote || undefined });
      setInviteEmail('');
      setInviteRole('member');
      setInviteNote('');
      setMessage('Invitation created. The invited person can accept it after signing in with that email.');
      await loadTeam(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function revokeInvitation(invitation: BusinessInvitation) {
    if (!selectedProfile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.updateInvitation(selectedProfile.id, invitation.id, { action: 'revoke' });
      setMessage('Invitation revoked.');
      await loadTeam(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function updateMemberRole(member: BusinessMember, role: BusinessRole) {
    if (!selectedProfile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.updateMember(selectedProfile.id, member.id, { role: role as 'admin' | 'finance' | 'member', note: memberNotes[member.id] || undefined });
      setMessage('Member role updated.');
      await loadTeam(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(member: BusinessMember) {
    if (!selectedProfile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.removeMember(selectedProfile.id, member.id, { note: memberNotes[member.id] || undefined });
      setMessage('Member removed.');
      await loadTeam(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }


  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.createTemplate(selectedProfile.id, {
        kind: templateForm.kind,
        title: templateForm.title,
        description: templateForm.description,
        itemType: templateForm.itemType,
        languageCode: templateForm.languageCode,
        category: templateForm.category.trim() || undefined,
        timing: templateForm.kind === 'need' ? templateForm.timing.trim() || undefined : undefined,
        availability: templateForm.kind === 'offer' ? templateForm.availability.trim() || undefined : undefined,
        tags: [],
        includes: [],
        mediaIds: [],
        sortOrder: 0,
      });
      setTemplateForm(emptyTemplateForm);
      setMessage('Draft Business library item created. Owners/admins can submit it for admin review.');
      await loadTemplates(selectedProfile.id);
      await loadProfiles();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function requestTemplateReview(template: BusinessTemplate) {
    if (!selectedProfile) return;
    const note = templateReviewNotes[template.id]?.trim() ?? '';
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.requestTemplateReview(selectedProfile.id, template.id, { note });
      setTemplateReviewNotes((current) => ({ ...current, [template.id]: '' }));
      setMessage('Business library item submitted for admin review.');
      await loadTemplates(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function archiveTemplate(template: BusinessTemplate) {
    if (!selectedProfile) return;
    const note = templateReviewNotes[template.id]?.trim() || undefined;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.archiveTemplate(selectedProfile.id, template.id, { note });
      setMessage('Business library item archived.');
      await loadTemplates(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function createBusinessContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (contentForm.kind === 'need') {
        await api.business.createBusinessNeed(selectedProfile.id, {
          title: contentForm.title,
          description: contentForm.description,
          itemType: contentForm.itemType,
          defaultLanguage: 'en',
          previewTheme: 'default',
          category: contentForm.category.trim() || undefined,
          timing: contentForm.timing.trim() || undefined,
          mediaIds: [],
          tags: [],
          status: 'draft',
        });
      } else {
        await api.business.createBusinessOffer(selectedProfile.id, {
          title: contentForm.title,
          description: contentForm.description,
          itemType: contentForm.itemType,
          defaultLanguage: 'en',
          previewTheme: 'default',
          category: contentForm.category.trim() || undefined,
          availability: contentForm.availability.trim() || undefined,
          mediaIds: [],
          tags: [],
          includes: [],
          status: 'draft',
        });
      }
      setContentForm(emptyContentForm);
      setMessage('Draft Business-owned Need/Offer created. Owners/admins can submit it for admin review.');
      await loadBusinessInventory(selectedProfile.id);
      await loadProfiles();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function requestBusinessContentReview(item: BusinessOwnedItem) {
    if (!selectedProfile) return;
    const note = contentReviewNotes[item.id]?.trim() ?? '';
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (contentKindFilter === 'need') await api.business.requestBusinessNeedReview(selectedProfile.id, item.id, { note });
      else await api.business.requestBusinessOfferReview(selectedProfile.id, item.id, { note });
      setContentReviewNotes((current) => ({ ...current, [item.id]: '' }));
      setMessage('Business-owned item submitted for admin review.');
      await loadBusinessInventory(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function archiveBusinessContent(item: BusinessOwnedItem) {
    if (!selectedProfile) return;
    const note = contentReviewNotes[item.id]?.trim() || undefined;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (contentKindFilter === 'need') await api.business.archiveBusinessNeed(selectedProfile.id, item.id, { note });
      else await api.business.archiveBusinessOffer(selectedProfile.id, item.id, { note });
      setMessage('Business-owned item archived.');
      await loadBusinessInventory(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }


  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.createCampaign(selectedProfile.id, {
        opportunityType: campaignForm.opportunityType,
        title: campaignForm.title,
        summary: campaignForm.summary.trim() || undefined,
        description: campaignForm.description,
        eligibility: campaignForm.eligibility.trim() || undefined,
        deliverables: campaignForm.deliverables.trim() || undefined,
        status: 'draft',
      });
      setCampaignForm(emptyCampaignForm);
      setMessage('Draft Business campaign created. Attach approved Business items before submitting it for admin review.');
      await loadBusinessCampaigns(selectedProfile.id);
      await loadProfiles();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function requestCampaignReview(campaign: BusinessCampaign) {
    if (!selectedProfile) return;
    const note = campaignReviewNotes[campaign.id]?.trim() ?? '';
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.requestCampaignReview(selectedProfile.id, campaign.id, { note });
      setCampaignReviewNotes((current) => ({ ...current, [campaign.id]: '' }));
      setMessage('Business campaign submitted for admin review.');
      await loadBusinessCampaigns(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function archiveCampaign(campaign: BusinessCampaign) {
    if (!selectedProfile) return;
    const note = campaignReviewNotes[campaign.id]?.trim() || undefined;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.archiveCampaign(selectedProfile.id, campaign.id, { note });
      setMessage('Business campaign archived.');
      await loadBusinessCampaigns(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function addCampaignItem(campaign: BusinessCampaign) {
    if (!selectedProfile) return;
    const form = campaignItemForms[campaign.id] ?? emptyCampaignItemForm;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.addCampaignItem(selectedProfile.id, campaign.id, {
        targetType: form.targetType,
        targetId: form.targetId.trim(),
        note: form.note.trim() || undefined,
        sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
      });
      setCampaignItemForms((current) => ({ ...current, [campaign.id]: emptyCampaignItemForm }));
      setMessage('Campaign item attached.');
      await loadBusinessCampaigns(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function removeCampaignItem(campaign: BusinessCampaign, item: BusinessCampaignItem) {
    if (!selectedProfile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.business.removeCampaignItem(selectedProfile.id, campaign.id, item.id, {});
      setMessage('Campaign item removed.');
      await loadBusinessCampaigns(selectedProfile.id);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  if (!auth.hydrated) return null;
  if (!auth.isAuthenticated) return <section className="mobile-card"><p className="meta">Sign in to manage Business accounts.</p></section>;

  return (
    <div className="mobile-page">
      <section className="notice-box warning">
        Business teams are still hidden for the first launch. Use this area only for internal testing while Business flags are enabled.
      </section>

      {error ? <section className="notice-box danger">{error}</section> : null}
      {message ? <section className="notice-box success">{message}</section> : null}

      {invitationsMine.length ? (
        <section className="mobile-card">
          <p className="eyebrow">Your invitations</p>
          <div className="mobile-list">
            {invitationsMine.map((invitation) => (
              <div key={invitation.id} className="mobile-card mobile-card--soft">
                <span className="semantic-badge instruction">{invitation.role}</span>
                <h3>{invitation.businessProfile?.displayName ?? 'Business team'}</h3>
                <p className="meta">Invited by {invitation.invitedBy?.profile?.displayName ?? invitation.invitedBy?.email ?? 'a team admin'}{invitation.expiresAt ? ` · expires ${formatDateTime(invitation.expiresAt)}` : ''}</p>
                <button type="button" disabled={saving} onClick={() => { void acceptInvitation(invitation); }}>Accept invitation</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? <section className="mobile-card"><p className="meta">Loading Business accounts…</p></section> : null}

      {!loading && !profiles.length ? (
        <section className="inventory-empty-state">
          <span className="inventory-empty-state__plus">+</span>
          <strong>No Business profiles yet</strong>
          <span>Business profile creation remains hidden. Team management appears here after a profile exists.</span>
        </section>
      ) : null}

      {profiles.length ? (
        <section className="mobile-card">
          <label className="field-label">Business profile
            <select value={selectedProfile?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
            </select>
          </label>
          {selectedProfile ? (
            <div className="status-row" style={{ marginTop: 12 }}>
              <span className="semantic-badge instruction">{businessTypeLabel(selectedProfile.type)}</span>
              <span className="semantic-badge neutral">{businessStatusLabel(selectedProfile.status)}</span>
              {publicBusinessPath(selectedProfile.handle) ? <Link href={publicBusinessPath(selectedProfile.handle) ?? '#'} className="semantic-badge info">{publicBusinessPath(selectedProfile.handle)}</Link> : <span className="semantic-badge warning">No /b URL yet</span>}
              <span className="meta">Needs {selectedProfile.counts?.needs ?? 0} · Offers {selectedProfile.counts?.offers ?? 0} · Trades {selectedProfile.counts?.trades ?? 0} · Templates {selectedProfile.counts?.inventoryTemplates ?? 0} · Campaigns {selectedProfile.counts?.campaigns ?? 0}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedProfile ? (
        <section className="mobile-card">
          <div className="page-intro">
            <div>
              <p className="eyebrow">Campaigns / opportunities</p>
              <h3>Hidden campaign skeleton</h3>
              <p className="meta">Group approved Business-owned Needs, Offers, or library items into future collaboration opportunities. No budgets, credits, tokens, payouts, or paid-job flow exists here.</p>
            </div>
            <select value={campaignStatusFilter} onChange={(event) => setCampaignStatusFilter(event.target.value as 'all' | BusinessCampaignStatus)}>
              <option value="all">all</option>
              <option value="draft">draft</option>
              <option value="pending_review">pending review</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="paused">paused</option>
              <option value="archived">archived</option>
              <option value="completed">completed</option>
            </select>
          </div>
          <form className="form-stack" onSubmit={(event) => { void createCampaign(event); }}>
            <label className="field-label">Opportunity type
              <select value={campaignForm.opportunityType} onChange={(event) => setCampaignForm((current) => ({ ...current, opportunityType: event.target.value as BusinessCampaignOpportunityType }))}>
                <option value="collaboration">Collaboration</option>
                <option value="creator_request">Creator request</option>
                <option value="service_request">Service request</option>
                <option value="community">Community</option>
                <option value="research">Research</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field-label">Title
              <input value={campaignForm.title} onChange={(event) => setCampaignForm((current) => ({ ...current, title: event.target.value }))} maxLength={100} required />
            </label>
            <label className="field-label">Short summary
              <input value={campaignForm.summary} onChange={(event) => setCampaignForm((current) => ({ ...current, summary: event.target.value }))} maxLength={240} />
            </label>
            <label className="field-label">Description
              <textarea value={campaignForm.description} onChange={(event) => setCampaignForm((current) => ({ ...current, description: event.target.value }))} rows={4} maxLength={2000} required />
            </label>
            <div className="status-row">
              <label className="field-label">Eligibility
                <input value={campaignForm.eligibility} onChange={(event) => setCampaignForm((current) => ({ ...current, eligibility: event.target.value }))} />
              </label>
              <label className="field-label">Deliverables
                <input value={campaignForm.deliverables} onChange={(event) => setCampaignForm((current) => ({ ...current, deliverables: event.target.value }))} />
              </label>
            </div>
            <button type="submit" disabled={saving || campaignForm.title.trim().length < 3 || campaignForm.description.trim().length < 20}>{saving ? 'Saving…' : 'Create draft campaign'}</button>
          </form>
          <div className="mobile-list" style={{ marginTop: 16 }}>
            {businessCampaigns.map((campaign) => {
              const form = campaignItemForms[campaign.id] ?? emptyCampaignItemForm;
              const canSubmit = ['draft', 'rejected', 'paused'].includes(campaign.status);
              return (
                <div key={campaign.id} className="mobile-card mobile-card--soft">
                  <div className="status-row">
                    <span className="semantic-badge instruction">{campaign.opportunityType.replace('_', ' ')}</span>
                    <span className="semantic-badge neutral">{campaign.status.replace('_', ' ')}</span>
                    <span className="meta">{campaign._count?.items ?? campaign.items?.length ?? 0} item(s) · {campaign._count?.applications ?? 0} application(s)</span>
                  </div>
                  <h4>{campaign.title}</h4>
                  {campaign.summary ? <p className="meta">{campaign.summary}</p> : null}
                  <p>{campaign.description}</p>
                  {(campaign.items ?? []).length ? (
                    <div className="mobile-list">
                      {(campaign.items ?? []).map((item) => (
                        <div key={item.id} className="status-row">
                          <span className="semantic-badge info">{item.targetType.replace('_', ' ')}</span>
                          <span>{item.target?.title ?? item.targetId}</span>
                          <button type="button" className="secondary" disabled={saving} onClick={() => { void removeCampaignItem(campaign, item); }}>Remove</button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="meta">Attach at least one approved Business Need, Offer, or library item before review.</p>}
                  <div className="form-stack">
                    <div className="status-row">
                      <label className="field-label">Attach target
                        <select value={form.targetType} onChange={(event) => setCampaignItemForms((current) => ({ ...current, [campaign.id]: { ...(current[campaign.id] ?? emptyCampaignItemForm), targetType: event.target.value as BusinessCampaignItemTargetType } }))}>
                          <option value="need">Need</option>
                          <option value="offer">Offer</option>
                          <option value="inventory_template">Library item</option>
                        </select>
                      </label>
                      <label className="field-label">Target ID
                        <input value={form.targetId} onChange={(event) => setCampaignItemForms((current) => ({ ...current, [campaign.id]: { ...(current[campaign.id] ?? emptyCampaignItemForm), targetId: event.target.value } }))} placeholder="Approved Business item ID" />
                      </label>
                    </div>
                    <label className="field-label">Item note
                      <input value={form.note} onChange={(event) => setCampaignItemForms((current) => ({ ...current, [campaign.id]: { ...(current[campaign.id] ?? emptyCampaignItemForm), note: event.target.value } }))} />
                    </label>
                    <button type="button" className="secondary" disabled={saving || !form.targetId.trim()} onClick={() => { void addCampaignItem(campaign); }}>Attach item</button>
                  </div>
                  <label className="field-label">Review/archive note
                    <input value={campaignReviewNotes[campaign.id] ?? ''} onChange={(event) => setCampaignReviewNotes((current) => ({ ...current, [campaign.id]: event.target.value }))} placeholder="Required before review submit" />
                  </label>
                  <div className="cta-row">
                    {canSubmit ? <button type="button" disabled={saving || (campaignReviewNotes[campaign.id]?.trim().length ?? 0) < 3 || !(campaign.items ?? []).length} onClick={() => { void requestCampaignReview(campaign); }}>Submit for review</button> : null}
                    {campaign.status !== 'archived' ? <button type="button" className="secondary" disabled={saving} onClick={() => { void archiveCampaign(campaign); }}>Archive</button> : null}
                  </div>
                </div>
              );
            })}
            {businessCampaigns.length === 0 ? <p className="meta">No Business campaigns match this filter.</p> : null}
          </div>
        </section>
      ) : null}

      {selectedProfile ? (
        <section className="mobile-card">
          <div className="page-intro">
            <div>
              <p className="eyebrow">Business-owned Needs/Offers</p>
              <h3>Sponsored inventory drafts</h3>
              <p className="meta">These are real Business-owned Needs/Offers. They stay hidden until submitted by an owner/admin and approved by an admin.</p>
            </div>
            <div className="status-row">
              <select value={contentKindFilter} onChange={(event) => { const kind = event.target.value as BusinessTemplateKind; setContentKindFilter(kind); setContentForm((current) => ({ ...current, kind })); }}>
                <option value="need">Needs</option>
                <option value="offer">Offers</option>
              </select>
              <select value={contentStatusFilter} onChange={(event) => setContentStatusFilter(event.target.value as 'all' | BusinessContentStatus)}>
                <option value="all">all</option>
                <option value="draft">draft</option>
                <option value="pending_review">pending review</option>
                <option value="active">approved</option>
                <option value="rejected">rejected</option>
                <option value="closed">closed</option>
              </select>
            </div>
          </div>
          <form className="form-stack" onSubmit={(event) => { void createBusinessContent(event); }}>
            <label className="field-label">Title
              <input value={contentForm.title} onChange={(event) => setContentForm((current) => ({ ...current, title: event.target.value }))} maxLength={70} required />
            </label>
            <label className="field-label">Description
              <textarea value={contentForm.description} onChange={(event) => setContentForm((current) => ({ ...current, description: event.target.value }))} rows={4} maxLength={500} required />
            </label>
            <label className="field-label">Category
              <input value={contentForm.category} onChange={(event) => setContentForm((current) => ({ ...current, category: event.target.value }))} />
            </label>
            <label className="field-label">{contentForm.kind === 'need' ? 'Timing' : 'Availability'}
              <input value={contentForm.kind === 'need' ? contentForm.timing : contentForm.availability} onChange={(event) => setContentForm((current) => contentForm.kind === 'need' ? { ...current, timing: event.target.value } : { ...current, availability: event.target.value })} />
            </label>
            <button type="submit" disabled={saving || contentForm.title.trim().length < 3 || contentForm.description.trim().length < 10}>{saving ? 'Saving…' : `Create draft Business ${contentForm.kind}`}</button>
          </form>
          <div className="mobile-list" style={{ marginTop: 16 }}>
            {(contentKindFilter === 'need' ? businessNeeds : businessOffers).map((item) => {
              const canSubmit = ['draft', 'rejected', 'closed'].includes(item.status);
              return (
                <div key={item.id} className="mobile-card mobile-card--soft">
                  <div className="status-row">
                    <span className="semantic-badge instruction">{contentKindFilter}</span>
                    <span className="semantic-badge neutral">{item.status.replace('_', ' ')}</span>
                  </div>
                  <h4>{item.title}</h4>
                  <p className="meta">{item.category || 'uncategorized'} · {contentKindFilter === 'need' ? item.timing || 'timing not set' : item.availability || 'availability not set'} · {item._count?.trades ?? 0} linked trade(s)</p>
                  <p>{item.description}</p>
                  <label className="field-label">Review/archive note
                    <input value={contentReviewNotes[item.id] ?? ''} onChange={(event) => setContentReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Required before review submit" />
                  </label>
                  <div className="cta-row">
                    {canSubmit ? <button type="button" disabled={saving || (contentReviewNotes[item.id]?.trim().length ?? 0) < 3} onClick={() => { void requestBusinessContentReview(item); }}>Submit for review</button> : null}
                    {item.status !== 'closed' ? <button type="button" className="secondary" disabled={saving} onClick={() => { void archiveBusinessContent(item); }}>Archive</button> : null}
                  </div>
                </div>
              );
            })}
            {(contentKindFilter === 'need' ? businessNeeds : businessOffers).length === 0 ? <p className="meta">No Business-owned {contentKindFilter}s match this filter.</p> : null}
          </div>
        </section>
      ) : null}

      {selectedProfile ? (
        <section className="mobile-card">
          <div className="page-intro">
            <div>
              <p className="eyebrow">Business library</p>
              <h3>Draft sponsored Needs/Offers</h3>
              <p className="meta">These items stay hidden until a Business owner/admin submits them and an admin approves them.</p>
            </div>
            <select value={templateStatusFilter} onChange={(event) => setTemplateStatusFilter(event.target.value as 'all' | BusinessTemplateStatus)}>
              <option value="all">all</option>
              <option value="draft">draft</option>
              <option value="pending_review">pending review</option>
              <option value="active">approved</option>
              <option value="rejected">rejected</option>
              <option value="archived">archived</option>
            </select>
          </div>
          <form className="form-stack" onSubmit={(event) => { void createTemplate(event); }}>
            <div className="status-row">
              <label className="field-label">Kind
                <select value={templateForm.kind} onChange={(event) => setTemplateForm((current) => ({ ...current, kind: event.target.value as BusinessTemplateKind }))}>
                  <option value="need">Need</option>
                  <option value="offer">Offer</option>
                </select>
              </label>
              <label className="field-label">Language
                <select value={templateForm.languageCode} onChange={(event) => setTemplateForm((current) => ({ ...current, languageCode: event.target.value as 'en' | 'fr' }))}>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                </select>
              </label>
            </div>
            <label className="field-label">Title
              <input value={templateForm.title} onChange={(event) => setTemplateForm((current) => ({ ...current, title: event.target.value }))} maxLength={70} required />
            </label>
            <label className="field-label">Description
              <textarea value={templateForm.description} onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))} rows={4} maxLength={500} required />
            </label>
            <label className="field-label">Category
              <input value={templateForm.category} onChange={(event) => setTemplateForm((current) => ({ ...current, category: event.target.value }))} />
            </label>
            <label className="field-label">{templateForm.kind === 'need' ? 'Timing' : 'Availability'}
              <input value={templateForm.kind === 'need' ? templateForm.timing : templateForm.availability} onChange={(event) => setTemplateForm((current) => templateForm.kind === 'need' ? { ...current, timing: event.target.value } : { ...current, availability: event.target.value })} />
            </label>
            <button type="submit" disabled={saving || templateForm.title.trim().length < 3 || templateForm.description.trim().length < 10}>{saving ? 'Saving…' : 'Create draft library item'}</button>
          </form>
          <div className="mobile-list" style={{ marginTop: 16 }}>
            {templates.map((template) => {
              const canSubmit = ['draft', 'rejected', 'archived'].includes(template.status);
              return (
                <div key={template.id} className="mobile-card mobile-card--soft">
                  <div className="status-row">
                    <span className="semantic-badge instruction">{template.kind}</span>
                    <span className="semantic-badge neutral">{template.status === 'active' ? 'approved' : template.status.replace('_', ' ')}</span>
                  </div>
                  <h4>{template.title}</h4>
                  <p className="meta">{template.sourceType ?? 'business'} · {(template.languageCode ?? 'en').toUpperCase()}{template.category ? ` · ${template.category}` : ''}</p>
                  <p>{template.description}</p>
                  <label className="field-label">Review/archive note
                    <input value={templateReviewNotes[template.id] ?? ''} onChange={(event) => setTemplateReviewNotes((current) => ({ ...current, [template.id]: event.target.value }))} placeholder="Required before review submit" />
                  </label>
                  <div className="cta-row">
                    {canSubmit ? <button type="button" disabled={saving || (templateReviewNotes[template.id]?.trim().length ?? 0) < 3} onClick={() => { void requestTemplateReview(template); }}>Submit for review</button> : null}
                    {template.status !== 'archived' ? <button type="button" className="secondary" disabled={saving} onClick={() => { void archiveTemplate(template); }}>Archive</button> : null}
                  </div>
                </div>
              );
            })}
            {templates.length === 0 ? <p className="meta">No Business library items match this filter.</p> : null}
          </div>
        </section>
      ) : null}

      {selectedProfile && team ? (
        <>
          <section className="mobile-card">
            <div className="page-intro">
              <div>
                <p className="eyebrow">Team members</p>
                <h3>{selectedProfile.displayName}</h3>
                <p className="meta">Your role: {team.myRole ?? 'member'}</p>
              </div>
              <span className="semantic-badge instruction">{team.members?.length ?? 0} member(s)</span>
            </div>
            <div className="mobile-list">
              {(team.members ?? []).map((member) => {
                const canEditRole = team.myRole === 'owner' && member.role !== 'owner';
                const canRemove = Boolean(team.canManageTeam && member.role !== 'owner' && member.userId !== auth.user?.id && (team.myRole === 'owner' || member.role === 'member'));
                return (
                  <div key={member.id} className="mobile-card mobile-card--soft">
                    <div className="status-row">
                      <span className="semantic-badge neutral">{member.role}</span>
                      <strong>{memberName(member)}</strong>
                    </div>
                    <p className="meta">{member.user?.email}{member.createdAt ? ` · joined ${formatDateTime(member.createdAt)}` : ''}</p>
                    {(canEditRole || canRemove) ? (
                      <div className="form-stack">
                        <label className="field-label">Team action note
                          <input value={memberNotes[member.id] ?? ''} onChange={(event) => setMemberNotes((current) => ({ ...current, [member.id]: event.target.value }))} placeholder="Optional internal note" />
                        </label>
                        {canEditRole ? (
                          <label className="field-label">Role
                            <select value={member.role} onChange={(event) => { void updateMemberRole(member, event.target.value as BusinessRole); }} disabled={saving}>
                              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                            </select>
                          </label>
                        ) : null}
                        {canRemove ? <button type="button" className="danger" disabled={saving} onClick={() => { void removeMember(member); }}>Remove member</button> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {team.canManageTeam ? (
            <section className="mobile-card">
              <p className="eyebrow">Invite member</p>
              <form className="form-stack" onSubmit={(event) => { void inviteMember(event); }}>
                <label className="field-label">Email
                  <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} type="email" placeholder="member@example.com" required />
                </label>
                <label className="field-label">Role
                  <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as BusinessInviteRole)}>
                    {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label className="field-label">Note
                  <textarea value={inviteNote} onChange={(event) => setInviteNote(event.target.value)} rows={3} maxLength={1000} placeholder="Optional internal context" />
                </label>
                <button type="submit" disabled={saving || !inviteEmail.trim()}>{saving ? 'Saving…' : 'Create invitation'}</button>
              </form>
            </section>
          ) : null}

          <section className="mobile-card">
            <p className="eyebrow">Pending invitations</p>
            {(team.invitations ?? []).length ? (
              <div className="mobile-list">
                {(team.invitations ?? []).map((invitation) => (
                  <div key={invitation.id} className="mobile-card mobile-card--soft">
                    <span className="semantic-badge instruction">{invitation.role}</span>
                    <strong>{invitation.email}</strong>
                    <p className="meta">Created {formatDateTime(invitation.createdAt)}{invitation.expiresAt ? ` · expires ${formatDateTime(invitation.expiresAt)}` : ''}</p>
                    {team.canManageTeam ? <button type="button" className="secondary" disabled={saving} onClick={() => { void revokeInvitation(invitation); }}>Revoke</button> : null}
                  </div>
                ))}
              </div>
            ) : <p className="meta">No pending invitations.</p>}
          </section>

          <section className="mobile-card">
            <p className="eyebrow">Team audit</p>
            {(team.auditLogs ?? []).length ? (
              <div className="mobile-list">
                {(team.auditLogs ?? []).map((log) => (
                  <div key={log.id} className="mobile-card mobile-card--soft">
                    <strong>{cleanAction(log.action)}</strong>
                    <p className="meta">{auditActor(log)}{log.targetEmail ? ` · ${log.targetEmail}` : ''}{log.createdAt ? ` · ${formatDateTime(log.createdAt)}` : ''}</p>
                    {log.note ? <p>{log.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : <p className="meta">No team actions recorded yet.</p>}
          </section>
        </>
      ) : null}
    </div>
  );
}
