'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminContentClassificationActionResponse, AdminContentClassificationAiSuggestionResponse, AdminContentClassificationPlacementSignalResponse, AdminContentClassificationDto, AdminContentClassificationsResponse, AdminContentDomainCategory, AdminContentSafetyCategory, AdminContentSafetySeverity, AdminContentSuggestedAction } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { formatWebDateTime } from '../../../lib/webFormat';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';

type Notice = { tone: 'info' | 'warning' | 'danger' | 'success'; body: string };
type Allable<T extends string> = 'all' | T;
type TargetType = 'need' | 'offer' | 'trade' | 'profile' | 'business_template' | 'business_need' | 'business_offer' | 'business_campaign';
type ClassificationStatus = 'pending' | 'completed' | 'failed' | 'reviewed' | 'overridden';
type ClassificationSource = 'rules' | 'ai' | 'admin';

const targetTypeOptions: Array<Allable<TargetType>> = ['all', 'need', 'offer', 'trade', 'profile', 'business_template', 'business_need', 'business_offer', 'business_campaign'];
const sourceOptions: Array<Allable<ClassificationSource>> = ['all', 'rules', 'ai', 'admin'];
const statusOptions: Array<Allable<ClassificationStatus>> = ['all', 'pending', 'completed', 'failed', 'reviewed', 'overridden'];
const safetyOptions: Array<Allable<AdminContentSafetyCategory>> = ['all', 'safe', 'adult', 'sexual', 'violence', 'hate_or_harassment', 'self_harm', 'illegal_or_regulated', 'spam_or_scam', 'unknown'];
const severityOptions: Array<Allable<AdminContentSafetySeverity>> = ['all', 'none', 'low', 'medium', 'high', 'critical'];
const suggestedActionOptions: Array<Allable<AdminContentSuggestedAction>> = ['all', 'allow', 'review', 'hide'];
const domainOptions: Array<Allable<AdminContentDomainCategory>> = ['all', 'design', 'development', 'photography_video', 'writing_copywriting', 'translation_language', 'marketing_social', 'business_startup', 'education_tutoring', 'local_help', 'events_community', 'creative_art', 'health_wellness', 'home_practical', 'other'];

function labelize(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'unknown';
}

function personLabel(user?: { email?: string; profile?: { displayName?: string | null; handle?: string | null } | null } | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Unknown user';
}

function dateValue(value: string | Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function countLabel(value?: number | null) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

function statusTone(value?: string | null) {
  if (value === 'reviewed') return 'success';
  if (value === 'overridden') return 'admin';
  if (value === 'failed') return 'danger';
  if (value === 'completed') return 'info';
  return 'warning';
}

function safetyTone(item: AdminContentClassificationDto) {
  if (item.safetySeverity === 'critical' || item.suggestedAction === 'hide') return 'danger';
  if (item.safetySeverity === 'high' || item.suggestedAction === 'review') return 'warning';
  if (item.safetySeverity === 'medium' || item.adultRelated || item.spamOrScamRisk || item.regulatedRisk) return 'warning';
  if (item.safetyCategory === 'safe') return 'success';
  return 'info';
}

function classificationRiskLabel(item: AdminContentClassificationDto) {
  const parts = [labelize(item.safetyCategory), labelize(item.safetySeverity)];
  if (item.categoryMismatch) parts.push('category mismatch');
  if (item.spamOrScamRisk) parts.push('spam/scam');
  if (item.regulatedRisk) parts.push('regulated');
  return parts.join(' · ');
}

function targetTitle(item: AdminContentClassificationDto) {
  return item.target?.title || `${labelize(item.targetType)} ${item.targetId}`;
}

function tagText(tags?: string[] | null) {
  return tags?.length ? tags.join(', ') : '';
}

function parseTags(value: string) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value.split(',')) {
    const tag = raw.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

export default function AdminContentIntelligencePage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [targetType, setTargetType] = useState<Allable<TargetType>>('all');
  const [source, setSource] = useState<Allable<ClassificationSource>>('all');
  const [status, setStatus] = useState<Allable<ClassificationStatus>>('all');
  const [safetyCategory, setSafetyCategory] = useState<Allable<AdminContentSafetyCategory>>('all');
  const [safetySeverity, setSafetySeverity] = useState<Allable<AdminContentSafetySeverity>>('all');
  const [suggestedAction, setSuggestedAction] = useState<Allable<AdminContentSuggestedAction>>('all');
  const [systemCategory, setSystemCategory] = useState<Allable<AdminContentDomainCategory>>('all');
  const [categoryMismatch, setCategoryMismatch] = useState<'all' | 'true' | 'false'>('all');
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<AdminContentClassificationsResponse | null>(null);
  const [items, setItems] = useState<AdminContentClassificationDto[]>([]);
  const [selectedItem, setSelectedItem] = useState<AdminContentClassificationDto | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [overrideSystemCategory, setOverrideSystemCategory] = useState<AdminContentDomainCategory | ''>('');
  const [overrideSafetyCategory, setOverrideSafetyCategory] = useState<AdminContentSafetyCategory | ''>('');
  const [overrideSafetySeverity, setOverrideSafetySeverity] = useState<AdminContentSafetySeverity | ''>('');
  const [overrideSuggestedAction, setOverrideSuggestedAction] = useState<AdminContentSuggestedAction | ''>('');
  const [overrideMismatch, setOverrideMismatch] = useState<'keep' | 'true' | 'false'>('keep');
  const [overrideTags, setOverrideTags] = useState('');
  const [overrideNewTags, setOverrideNewTags] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const aiSuggestionsAvailable = Boolean(response?.flags.aiAdminOnlySuggestionsAvailable);
  const aiSuggestionsDisabledReason = response?.flags.aiAdminOnlySuggestionsDisabledReason ?? 'AI admin suggestions are disabled by feature flags.';
  const placementSignalsAvailable = Boolean(response?.flags.placementSignalsAvailable);
  const placementSignalsDisabledReason = response?.flags.placementSignalsDisabledReason ?? 'Placement signals are disabled by feature flags.';

  function resetOverrideForm(item: AdminContentClassificationDto | null) {
    setAdminNote('');
    setOverrideSystemCategory((item?.systemCategory ?? '') as AdminContentDomainCategory | '');
    setOverrideSafetyCategory((item?.safetyCategory ?? '') as AdminContentSafetyCategory | '');
    setOverrideSafetySeverity((item?.safetySeverity ?? '') as AdminContentSafetySeverity | '');
    setOverrideSuggestedAction((item?.suggestedAction ?? '') as AdminContentSuggestedAction | '');
    setOverrideMismatch('keep');
    setOverrideTags(tagText(item?.suggestedTags));
    setOverrideNewTags(tagText(item?.suggestedNewTags));
  }

  function selectItem(item: AdminContentClassificationDto) {
    setSelectedItem(item);
    resetOverrideForm(item);
  }

  function clearLocalSession() {
    clearAdminBrowserSession();
    setResponse(null);
    setItems([]);
    setSelectedItem(null);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function queryString() {
    const params = new URLSearchParams();
    params.set('targetType', targetType);
    params.set('source', source);
    params.set('status', status);
    params.set('safetyCategory', safetyCategory);
    params.set('safetySeverity', safetySeverity);
    params.set('suggestedAction', suggestedAction);
    params.set('systemCategory', systemCategory);
    params.set('categoryMismatch', categoryMismatch);
    if (query.trim()) params.set('q', query.trim());
    const text = params.toString();
    return text ? `?${text}` : '';
  }

  async function loadQueue() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const fetchResponse = await fetch(`${apiBase}/admin/content-intelligence${queryString()}`, { headers });
      if (!fetchResponse.ok) throw new Error('Could not load content intelligence queue. Make sure this account has admin role and satisfies 2FA requirements.');
      const data = await fetchResponse.json() as AdminContentClassificationsResponse;
      setResponse(data);
      setItems(data.classifications);
      if (selectedItem) {
        const refreshed = data.classifications.find((item) => item.id === selectedItem.id) ?? null;
        setSelectedItem(refreshed);
        resetOverrideForm(refreshed);
      }
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load content intelligence queue.' });
    } finally {
      setLoading(false);
    }
  }


  async function requestAiSuggestion() {
    if (!token || !selectedItem) return;
    if (!aiSuggestionsAvailable) {
      setNotice({ tone: 'warning', body: aiSuggestionsDisabledReason });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const fetchResponse = await fetch(`${apiBase}/admin/content-intelligence/${selectedItem.id}/ai-suggestion`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ adminNote: adminNote.trim() || undefined }),
      });
      const data = await fetchResponse.json().catch(() => null) as AdminContentClassificationAiSuggestionResponse | { message?: string; error?: string } | null;
      if (!fetchResponse.ok) throw new Error((data as { message?: string } | null)?.message || 'Could not generate AI suggestion.');
      const classification = (data as AdminContentClassificationAiSuggestionResponse).classification;
      setItems((current) => {
        const withoutExistingAi = current.filter((item) => !(item.targetType === classification.targetType && item.targetId === classification.targetId && item.source === 'ai'));
        return [classification, ...withoutExistingAi];
      });
      setSelectedItem(classification);
      resetOverrideForm(classification);
      setNotice({ tone: 'success', body: 'AI suggestion stored as a separate admin-only classification row. It did not change public content or admin decisions.' });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not generate AI suggestion.' });
    } finally {
      setLoading(false);
    }
  }

  async function syncPlacementSignal() {
    if (!token || !selectedItem) return;
    if (!placementSignalsAvailable) {
      setNotice({ tone: 'warning', body: placementSignalsDisabledReason });
      return;
    }
    if (!['reviewed', 'overridden'].includes(selectedItem.status)) {
      setNotice({ tone: 'warning', body: 'Review or override the classification before syncing future placement signals.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const fetchResponse = await fetch(`${apiBase}/admin/content-intelligence/${selectedItem.id}/placement-signal`, {
        method: 'POST',
        headers,
      });
      const data = await fetchResponse.json().catch(() => null) as AdminContentClassificationPlacementSignalResponse | { message?: string; error?: string } | null;
      if (!fetchResponse.ok) throw new Error((data as { message?: string } | null)?.message || 'Could not sync placement signal.');
      const signal = (data as AdminContentClassificationPlacementSignalResponse).signal;
      const nextSelected = { ...selectedItem, placementSignal: signal };
      setSelectedItem(nextSelected);
      setItems((current) => current.map((item) => item.id === selectedItem.id ? nextSelected : item));
      setNotice({ tone: signal.contextualEligible ? 'success' : 'info', body: signal.contextualEligible ? 'Future contextual placement signal synced. This did not place ads, enable sponsored content, track users, or change public content.' : 'Placement signal synced as disabled because this content is not safe/ready for future matching.' });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not sync placement signal.' });
    } finally {
      setLoading(false);
    }
  }

  async function applyAction(action: 'mark_reviewed' | 'override') {
    if (!token || !selectedItem) return;
    if (action === 'override' && !adminNote.trim()) {
      setNotice({ tone: 'warning', body: 'Add an internal admin note before overriding classification values.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const body = action === 'mark_reviewed'
        ? { action, adminNote: adminNote.trim() || undefined }
        : {
          action,
          adminNote: adminNote.trim(),
          systemCategory: overrideSystemCategory || null,
          safetyCategory: overrideSafetyCategory || undefined,
          safetySeverity: overrideSafetySeverity || undefined,
          suggestedAction: overrideSuggestedAction || undefined,
          categoryMismatch: overrideMismatch === 'keep' ? undefined : overrideMismatch === 'true',
          suggestedTags: parseTags(overrideTags),
          suggestedNewTags: parseTags(overrideNewTags),
        };
      const fetchResponse = await fetch(`${apiBase}/admin/content-intelligence/${selectedItem.id}/action`, { method: 'PATCH', headers, body: JSON.stringify(body) });
      if (!fetchResponse.ok) {
        const errorBody = await fetchResponse.json().catch(() => null) as { message?: string } | null;
        throw new Error(errorBody?.message || 'Could not update content classification.');
      }
      const data = await fetchResponse.json() as AdminContentClassificationActionResponse;
      setSelectedItem(data.classification);
      setItems((current) => current.map((item) => item.id === data.classification.id ? data.classification : item));
      resetOverrideForm(data.classification);
      setNotice({ tone: 'success', body: action === 'mark_reviewed' ? 'Classification marked reviewed.' : 'Classification override saved.' });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not update content classification.' });
    } finally {
      setLoading(false);
    }
  }

  const flags = response?.flags;
  const summary = response?.summary;

  return (
    <main className="admin-console">
      <section className="app-card admin-console__hero">
        <div className="status-row">
          <span className="semantic-badge admin">Content intelligence</span>
          <span className={`semantic-badge ${flags?.contentIntelligenceEnabled ? 'success' : 'warning'}`}>{flags?.contentIntelligenceEnabled ? 'Classification flags on' : 'Classification flags off'}</span>
          <Link className="button secondary" href="/admin">Back to admin</Link>
        </div>
        <div>
          <p className="eyebrow">Patch C5</p>
          <h1>Admin-only classification queue</h1>
          <p>Review rule-based and optional admin-triggered AI safety, domain, and tag suggestions. Admin-reviewed classifications can also sync hidden future contextual placement signals; this does not place ads, track users, publish labels, auto-hide content, auto-ban users, or change public categories.</p>
        </div>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Internal tools use your signed-in admin app session. Classification can be disabled and still keep this review console available for existing stored results.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
        {response ? (
          <p className={aiSuggestionsAvailable ? 'notice-box success' : 'notice-box info'}>
            AI admin suggestions: {aiSuggestionsAvailable ? `${labelize(response.flags.aiProvider)} provider configured for admin-only suggestions.` : aiSuggestionsDisabledReason}
          </p>
        ) : null}
        {response ? (
          <p className={placementSignalsAvailable ? 'notice-box success' : 'notice-box info'}>
            Future contextual placement signals: {placementSignalsAvailable ? 'enabled for admin-reviewed internal records only.' : placementSignalsDisabledReason}
          </p>
        ) : null}
      </section>

      {summary ? (
        <section className="admin-metric-grid">
          <article className="admin-metric-card"><p>Total classifications</p><strong>{countLabel(summary.total)}</strong><span className="meta">{countLabel(summary.needsReview)} need review</span></article>
          <article className="admin-metric-card"><p>High risk</p><strong>{countLabel(summary.highRisk)}</strong><span className="meta">High or critical safety severity</span></article>
          <article className="admin-metric-card"><p>Mismatch</p><strong>{countLabel(summary.categoryMismatch)}</strong><span className="meta">User category differs from system category</span></article>
          <article className="admin-metric-card"><p>Spam / regulated</p><strong>{countLabel(summary.spamOrScam + summary.regulated)}</strong><span className="meta">{countLabel(summary.adultOrSexual)} adult/sexual · {countLabel(summary.failed)} failed</span></article>
        </section>
      ) : null}

      <section className="admin-detail-grid">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Filters</span><span className="semantic-badge admin">Admin-only</span></div>
          <h2>Queue</h2>
          <div className="admin-trust-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search target ID, reason, note" />
            <select value={targetType} onChange={(event) => setTargetType(event.target.value as Allable<TargetType>)}>{targetTypeOptions.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={source} onChange={(event) => setSource(event.target.value as Allable<ClassificationSource>)}>{sourceOptions.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={status} onChange={(event) => setStatus(event.target.value as Allable<ClassificationStatus>)}>{statusOptions.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={safetyCategory} onChange={(event) => setSafetyCategory(event.target.value as Allable<AdminContentSafetyCategory>)}>{safetyOptions.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={safetySeverity} onChange={(event) => setSafetySeverity(event.target.value as Allable<AdminContentSafetySeverity>)}>{severityOptions.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={suggestedAction} onChange={(event) => setSuggestedAction(event.target.value as Allable<AdminContentSuggestedAction>)}>{suggestedActionOptions.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={systemCategory} onChange={(event) => setSystemCategory(event.target.value as Allable<AdminContentDomainCategory>)}>{domainOptions.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            <select value={categoryMismatch} onChange={(event) => setCategoryMismatch(event.target.value as 'all' | 'true' | 'false')}><option value="all">all mismatch states</option><option value="true">category mismatch</option><option value="false">no category mismatch</option></select>
            <button type="button" onClick={() => { void loadQueue(); }} disabled={loading || !token}>Load queue</button>
          </div>
          <div className="admin-user-list">
            {items.map((item) => (
              <button type="button" key={item.id} className={selectedItem?.id === item.id ? 'admin-user-row is-active' : 'admin-user-row'} onClick={() => selectItem(item)}>
                <span>
                  <strong>{targetTitle(item)}</strong>
                  <small>{labelize(item.targetType)} · {personLabel(item.target?.owner as never)} · {labelize(item.systemCategory)} · confidence {Math.round((item.categoryConfidence ?? 0) * 100)}%</small>
                  <small>{classificationRiskLabel(item)} · {formatWebDateTime(dateValue(item.updatedAt))}</small>
                  {item.placementSignal ? <small>Placement signal: {labelize(item.placementSignal.status)} · {item.placementSignal.contextualEligible ? 'contextual eligible' : 'not eligible'}</small> : null}
                </span>
                <span className="status-row">
                  <em className={`semantic-badge ${safetyTone(item)}`}>{labelize(item.suggestedAction)}</em>
                  <em className={`semantic-badge ${statusTone(item.status)}`}>{labelize(item.status)}</em>
                </span>
              </button>
            ))}
            {response && items.length === 0 ? <p>No classifications match these filters.</p> : null}
            {!response ? <p>Load the queue to review stored content classifications.</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          {selectedItem ? (
            <>
              <div className="status-row">
                <span className={`semantic-badge ${safetyTone(selectedItem)}`}>{labelize(selectedItem.safetyCategory)}</span>
                <span className={`semantic-badge ${statusTone(selectedItem.status)}`}>{labelize(selectedItem.status)}</span>
                {selectedItem.categoryMismatch ? <span className="semantic-badge warning">Mismatch</span> : null}
              </div>
              <h2>{targetTitle(selectedItem)}</h2>
              <p>{selectedItem.target?.description || selectedItem.reason || 'No preview text available.'}</p>
              <div className="admin-user-meta-grid">
                <span><small>Target</small><strong>{labelize(selectedItem.targetType)} · {selectedItem.targetId}</strong></span>
                <span><small>Owner</small><strong>{personLabel(selectedItem.target?.owner as never)}</strong></span>
                <span><small>User category</small><strong>{labelize(selectedItem.userCategory)}</strong></span>
                <span><small>System category</small><strong>{labelize(selectedItem.systemCategory)}</strong></span>
                <span><small>Confidence</small><strong>{Math.round((selectedItem.categoryConfidence ?? 0) * 100)}%</strong></span>
                <span><small>Source</small><strong>{labelize(selectedItem.source)}</strong></span>
                <span><small>Safety</small><strong>{labelize(selectedItem.safetyCategory)} · {labelize(selectedItem.safetySeverity)}</strong></span>
                <span><small>Signals</small><strong>{selectedItem.adultRelated ? 'adult ' : ''}{selectedItem.spamOrScamRisk ? 'spam/scam ' : ''}{selectedItem.regulatedRisk ? 'regulated ' : ''}{selectedItem.childSafe ? 'child safe' : 'not child safe'}</strong></span>
              </div>
              {selectedItem.reason ? <p className="notice-box info">{selectedItem.reason}</p> : null}
              <div className="admin-user-meta-grid">
                <span><small>Suggested tags</small><strong>{tagText(selectedItem.suggestedTags) || 'None'}</strong></span>
                <span><small>Suggested new tags</small><strong>{tagText(selectedItem.suggestedNewTags) || 'None'}</strong></span>
                <span><small>Reviewed by</small><strong>{personLabel(selectedItem.reviewedBy as never)}</strong></span>
                <span><small>Reviewed at</small><strong>{selectedItem.reviewedAt ? formatWebDateTime(dateValue(selectedItem.reviewedAt)) : 'Not reviewed'}</strong></span>
              </div>
              {selectedItem.adminNote ? <p className="notice-box success">Admin note: {selectedItem.adminNote}</p> : null}
              {selectedItem.placementSignal ? (
                <div className="admin-user-meta-grid">
                  <span><small>Placement signal</small><strong>{labelize(selectedItem.placementSignal.status)} · {selectedItem.placementSignal.contextualEligible ? 'eligible' : 'not eligible'}</strong></span>
                  <span><small>Signal category</small><strong>{labelize(selectedItem.placementSignal.category)}</strong></span>
                  <span><small>Signal tags</small><strong>{tagText(selectedItem.placementSignal.tags) || 'None'}</strong></span>
                  <span><small>Signal surfaces</small><strong>{selectedItem.placementSignal.surfaces.length ? selectedItem.placementSignal.surfaces.map(labelize).join(', ') : 'None'}</strong></span>
                  <span><small>Business matching</small><strong>{selectedItem.placementSignal.businessPlacementEligible ? 'eligible' : 'disabled'}</strong></span>
                  <span><small>Contextual ads</small><strong>{selectedItem.placementSignal.adsPlacementEligible ? 'eligible' : 'disabled'}</strong></span>
                </div>
              ) : null}
              {selectedItem.placementSignal?.reason ? <p className="notice-box info">Placement signal: {selectedItem.placementSignal.reason}</p> : null}
              <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Internal admin note. Required before override." rows={3} />
              <div className="admin-trust-controls">
                <select value={overrideSystemCategory} onChange={(event) => setOverrideSystemCategory(event.target.value as AdminContentDomainCategory | '')}><option value="">No system category</option>{domainOptions.filter((item) => item !== 'all').map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
                <select value={overrideSafetyCategory} onChange={(event) => setOverrideSafetyCategory(event.target.value as AdminContentSafetyCategory | '')}><option value="">Keep safety category</option>{safetyOptions.filter((item) => item !== 'all').map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
                <select value={overrideSafetySeverity} onChange={(event) => setOverrideSafetySeverity(event.target.value as AdminContentSafetySeverity | '')}><option value="">Keep severity</option>{severityOptions.filter((item) => item !== 'all').map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
                <select value={overrideSuggestedAction} onChange={(event) => setOverrideSuggestedAction(event.target.value as AdminContentSuggestedAction | '')}><option value="">Keep suggested action</option>{suggestedActionOptions.filter((item) => item !== 'all').map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
                <select value={overrideMismatch} onChange={(event) => setOverrideMismatch(event.target.value as 'keep' | 'true' | 'false')}><option value="keep">Keep mismatch value</option><option value="true">Set mismatch true</option><option value="false">Set mismatch false</option></select>
                <input value={overrideTags} onChange={(event) => setOverrideTags(event.target.value)} placeholder="Suggested tags, comma separated" />
                <input value={overrideNewTags} onChange={(event) => setOverrideNewTags(event.target.value)} placeholder="Suggested new tags, comma separated" />
              </div>
              <div className="admin-action-grid">
                <button type="button" className="secondary" onClick={() => { void requestAiSuggestion(); }} disabled={loading || !token || !aiSuggestionsAvailable}>Generate AI suggestion</button>
                <button type="button" className="secondary" onClick={() => { void syncPlacementSignal(); }} disabled={loading || !token || !placementSignalsAvailable || !['reviewed', 'overridden'].includes(selectedItem.status)}>Sync placement signal</button>
                <button type="button" className="secondary" onClick={() => { void applyAction('mark_reviewed'); }} disabled={loading || !token}>Mark reviewed</button>
                <button type="button" className="warning" onClick={() => { void applyAction('override'); }} disabled={loading || !token}>Save override</button>
                {selectedItem.target?.href ? <Link className="button secondary" href={selectedItem.target.href}>Open target</Link> : null}
                <Link className="button secondary" href="/admin/content">Open content moderation</Link>
              </div>
              <p className="notice-box warning">Overrides update stored suggestions only. Generating an AI suggestion stores a separate source=ai row for admin review. Syncing a placement signal stores hidden internal category/tag signals for later contextual matching only. These actions do not place ads, track users, change public categories, hide content, delete content, ban users, or expose public AI labels.</p>
            </>
          ) : (
            <>
              <div className="status-row"><span className="semantic-badge admin">Select classification</span></div>
              <h2>Classification detail</h2>
              <p>Select a classification to inspect safety/domain signals, suggested tags, target content preview, and admin review actions.</p>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
