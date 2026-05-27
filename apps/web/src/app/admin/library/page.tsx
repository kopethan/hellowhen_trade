'use client';

import { useMemo, useState } from 'react';
import type { MediaAssetDto } from '@hellowhen/contracts';
import { getWebApiBaseUrl } from '../../../lib/api';
import { adminSessionRequiredMessage, clearAdminBrowserSession, useAdminSessionToken } from '../../../features/admin/adminSession';

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';
type TemplateKind = 'need' | 'offer';
type TemplateStatus = 'draft' | 'pending_review' | 'active' | 'rejected' | 'archived';
type ItemType = 'service' | 'goods' | 'other';
type ExchangeMode = 'remote' | 'local' | 'hybrid';

type AdminLibraryTemplateDto = {
  id: string;
  key: string;
  kind: TemplateKind;
  sourceType: string;
  languageCode: string;
  countryCode?: string | null;
  title: string;
  description: string;
  itemType: ItemType;
  category?: string | null;
  timing?: string | null;
  availability?: string | null;
  mode?: ExchangeMode | null;
  locationLabel?: string | null;
  tags?: string[];
  includes?: string[];
  status: TemplateStatus;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  media?: MediaAssetDto[];
  businessProfileId?: string | null;
  businessProfile?: { id: string; displayName: string; handle?: string | null; type?: string; status?: string } | null;
  _count?: { createdNeeds?: number; createdOffers?: number };
};

type LibraryFormState = {
  kind: TemplateKind;
  title: string;
  description: string;
  itemType: ItemType;
  languageCode: 'en' | 'fr';
  countryCode: string;
  category: string;
  timing: string;
  availability: string;
  mode: '' | ExchangeMode;
  locationLabel: string;
  tagsText: string;
  includesText: string;
  status: TemplateStatus;
  sortOrder: string;
};

const emptyForm: LibraryFormState = {
  kind: 'need',
  title: '',
  description: '',
  itemType: 'service',
  languageCode: 'en',
  countryCode: '',
  category: '',
  timing: '',
  availability: '',
  mode: '',
  locationLabel: '',
  tagsText: '',
  includesText: '',
  status: 'active',
  sortOrder: '0',
};

function countLabel(value?: number | null) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function fillForm(template: AdminLibraryTemplateDto): LibraryFormState {
  return {
    kind: template.kind,
    title: template.title,
    description: template.description,
    itemType: template.itemType,
    languageCode: template.languageCode === 'fr' ? 'fr' : 'en',
    countryCode: template.countryCode ?? '',
    category: template.category ?? '',
    timing: template.timing ?? '',
    availability: template.availability ?? '',
    mode: template.mode ?? '',
    locationLabel: template.locationLabel ?? '',
    tagsText: (template.tags ?? []).join(', '),
    includesText: (template.includes ?? []).join(', '),
    status: template.status,
    sortOrder: String(template.sortOrder ?? 0),
  };
}

function templateUsageLabel(template: AdminLibraryTemplateDto) {
  if (template.kind === 'need') return `${countLabel(template._count?.createdNeeds)} cloned need(s)`;
  return `${countLabel(template._count?.createdOffers)} cloned offer(s)`;
}

function templateMediaUrl(media: MediaAssetDto, apiBase: string) {
  const raw = media.url || media.storageKey || '';
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  const normalized = raw.startsWith('/') ? raw : raw.startsWith('uploads/') ? `/${raw}` : `/uploads/${raw}`;
  return `${apiBase.replace(/\/$/, '')}${normalized}`;
}

export default function AdminLibraryPage() {
  const apiBase = useMemo(() => getWebApiBaseUrl(), []);
  const { token, headers } = useAdminSessionToken();
  const [templates, setTemplates] = useState<AdminLibraryTemplateDto[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AdminLibraryTemplateDto | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | TemplateKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TemplateStatus>('active');
  const [query, setQuery] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'all' | 'hellowhen' | 'business' | 'brand' | 'partner'>('all');
  const [reviewNote, setReviewNote] = useState('');
  const [form, setForm] = useState<LibraryFormState>(emptyForm);
  const [templateMedia, setTemplateMedia] = useState<MediaAssetDto[]>([]);
  const [notice, setNotice] = useState<{ tone: NoticeTone; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  function clearLocalSession() {
    clearAdminBrowserSession();
    setTemplates([]);
    setSelectedTemplate(null);
    setTemplateMedia([]);
    setNotice({ tone: 'info', body: 'Local admin browser session cleared.' });
  }

  function updateForm<K extends keyof LibraryFormState>(key: K, value: LibraryFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm(nextKind: TemplateKind = form.kind) {
    setSelectedTemplate(null);
    setTemplateMedia([]);
    setForm({ ...emptyForm, kind: nextKind });
  }

  function selectTemplate(template: AdminLibraryTemplateDto) {
    setSelectedTemplate(template);
    setTemplateMedia(template.media ?? []);
    setForm(fillForm(template));
  }

  function buildRequestBody() {
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      itemType: form.itemType,
      languageCode: form.languageCode,
      countryCode: form.countryCode.trim() || null,
      category: form.category.trim() || null,
      timing: form.kind === 'need' ? form.timing.trim() || null : null,
      availability: form.kind === 'offer' ? form.availability.trim() || null : null,
      mode: form.mode || null,
      locationLabel: form.locationLabel.trim() || null,
      tags: splitList(form.tagsText),
      includes: form.kind === 'offer' ? splitList(form.includesText) : [],
      status: form.status,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
      mediaIds: templateMedia.map((item) => item.id),
    };
  }

  async function loadTemplates() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (kindFilter !== 'all') params.set('kind', kindFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (query.trim()) params.set('q', query.trim());
      if (sourceTypeFilter !== 'all') params.set('sourceType', sourceTypeFilter);
      const suffix = params.toString() ? `?${params}` : '';
      const response = await fetch(`${apiBase}/admin/library${suffix}`, { headers });
      if (!response.ok) throw new Error('Could not load starter library templates.');
      const data = await response.json() as { templates: AdminLibraryTemplateDto[] };
      setTemplates(data.templates);
      if (selectedTemplate) {
        const refreshed = data.templates.find((item) => item.id === selectedTemplate.id) ?? null;
        setSelectedTemplate(refreshed);
        setTemplateMedia(refreshed?.media ?? []);
      }
      setNotice({ tone: 'success', body: `Loaded ${data.templates.length} starter template${data.templates.length === 1 ? '' : 's'}.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not load starter library.' });
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplate() {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const body = buildRequestBody();
      const response = await fetch(selectedTemplate ? `${apiBase}/admin/library/${selectedTemplate.id}` : `${apiBase}/admin/library`, {
        method: selectedTemplate ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(selectedTemplate ? body : { ...body, kind: form.kind }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(errorBody?.message || 'Could not save starter template.');
      }
      const data = await response.json() as { template: AdminLibraryTemplateDto };
      setSelectedTemplate(data.template);
      setTemplateMedia(data.template.media ?? []);
      setForm(fillForm(data.template));
      setTemplates((current) => {
        const exists = current.some((item) => item.id === data.template.id);
        return exists ? current.map((item) => item.id === data.template.id ? data.template : item) : [data.template, ...current];
      });
      setNotice({ tone: 'success', body: `${data.template.kind === 'need' ? 'Need' : 'Offer'} starter template saved.` });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not save starter template.' });
    } finally {
      setLoading(false);
    }
  }

  async function changeTemplateVisibility(template: AdminLibraryTemplateDto, action: 'approve' | 'reject' | 'hide' | 'restore') {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/admin/library/${template.id}/action`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action, note: reviewNote.trim() || undefined }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(errorBody?.message || 'Could not update starter template visibility.');
      }
      const data = await response.json() as { template: AdminLibraryTemplateDto };
      setTemplates((current) => current.map((item) => item.id === data.template.id ? data.template : item));
      if (selectedTemplate?.id === data.template.id) {
        setSelectedTemplate(data.template);
        setTemplateMedia(data.template.media ?? []);
        setForm(fillForm(data.template));
      }
      setReviewNote('');
      setNotice({ tone: 'success', body: action === 'approve' ? 'Template approved for public starter lists.' : action === 'reject' ? 'Template rejected.' : action === 'hide' ? 'Starter template hidden from public starter lists.' : 'Starter template restored to public starter lists.' });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not update starter template.' });
    } finally {
      setLoading(false);
    }
  }

  async function uploadTemplateImages(files: FileList | null) {
    if (!token) { setNotice({ tone: 'warning', body: adminSessionRequiredMessage() }); return; }
    if (!files?.length || templateMedia.length >= 5) return;
    setUploading(true);
    setNotice(null);
    try {
      const nextMedia = [...templateMedia];
      for (const file of Array.from(files).slice(0, Math.max(0, 5 - nextMedia.length))) {
        const formData = new FormData();
        formData.append('image', file);
        const uploadHeaders = new Headers(headers);
        uploadHeaders.delete('Content-Type');
        const response = await fetch(`${apiBase}/media/image`, { method: 'POST', headers: uploadHeaders, body: formData });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(errorBody?.message || 'Could not upload starter image.');
        }
        const data = await response.json() as { media?: MediaAssetDto };
        if (data.media) nextMedia.push(data.media);
      }
      setTemplateMedia(nextMedia.slice(0, 5));
      setNotice({ tone: 'success', body: 'Starter image uploaded. Save the template to attach it.' });
    } catch (error) {
      setNotice({ tone: 'danger', body: error instanceof Error ? error.message : 'Could not upload starter image.' });
    } finally {
      setUploading(false);
    }
  }

  function removeTemplateImage(mediaId: string) {
    setTemplateMedia((current) => current.filter((item) => item.id !== mediaId));
  }

  const activeCount = templates.filter((template) => template.status === 'active').length;
  const reviewCount = templates.filter((template) => template.status === 'pending_review').length;
  const hiddenCount = templates.filter((template) => template.status === 'archived').length;

  return (
    <main className="admin-console">
      <section className="app-card admin-console__hero">
        <div className="status-row"><span className="semantic-badge info">Starter library</span><span className="semantic-badge admin">Needs and Offers only</span></div>
        <h1>Starter Need/Offer library</h1>
        <p>Manage the admin-created templates users see in their Starter tab. Hiding a template removes it from public starter lists without deleting any user Need/Offer already cloned from it.</p>
        <div className="admin-console__login-grid">
          <p className="notice-box info">Templates are not real trades. They are reusable starter examples for first launch onboarding and empty states.</p>
          <button type="button" className="secondary" onClick={clearLocalSession} disabled={!token}>Clear local session</button>
        </div>
        <div className="admin-money-strip">
          <span><small>Loaded</small><strong>{countLabel(templates.length)}</strong></span>
          <span><small>Active</small><strong>{countLabel(activeCount)}</strong></span>
          <span><small>Review</small><strong>{countLabel(reviewCount)}</strong></span>
          <span><small>Hidden</small><strong>{countLabel(hiddenCount)}</strong></span>
        </div>
        {notice ? <p className={`notice-box ${notice.tone}`}>{notice.body}</p> : null}
      </section>

      <section className="admin-detail-grid admin-detail-grid--wide-left">
        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge info">Browse</span></div>
          <h2>Library templates</h2>
          <div className="admin-trust-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, description, category, or key" />
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as 'all' | TemplateKind)}>
              <option value="all">all kinds</option>
              <option value="need">needs</option>
              <option value="offer">offers</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | TemplateStatus)}>
              <option value="active">active</option>
              <option value="pending_review">pending review</option>
              <option value="draft">draft</option>
              <option value="rejected">rejected</option>
              <option value="archived">hidden</option>
              <option value="all">all statuses</option>
            </select>
            <select value={sourceTypeFilter} onChange={(event) => setSourceTypeFilter(event.target.value as 'all' | 'hellowhen' | 'business' | 'brand' | 'partner')}>
              <option value="all">all sources</option>
              <option value="hellowhen">hellowhen</option>
              <option value="business">business</option>
              <option value="brand">brand</option>
              <option value="partner">partner</option>
            </select>
            <button type="button" onClick={() => { void loadTemplates(); }} disabled={loading || !token}>Load library</button>
          </div>
          <div className="admin-user-list">
            {templates.map((template) => (
              <button key={template.id} type="button" className={selectedTemplate?.id === template.id ? 'admin-user-row is-active' : 'admin-user-row'} onClick={() => selectTemplate(template)}>
                <span>
                  <strong>{template.title}</strong>
                  <small>{template.kind} · {template.itemType} · {template.sourceType} · {template.languageCode.toUpperCase()}{template.countryCode ? `-${template.countryCode}` : ''} · {template.key}</small>
                  <small>{template.businessProfile ? `${template.businessProfile.displayName} · ${template.businessProfile.status ?? 'business'}` : 'Hellowhen-owned'} · {templateUsageLabel(template)} · {(template.media ?? []).length} image(s) · sort {template.sortOrder ?? 0}</small>
                </span>
                <em className={`semantic-badge ${template.status === 'active' ? 'success' : template.status === 'pending_review' ? 'warning' : template.status === 'archived' ? 'warning' : template.status === 'rejected' ? 'danger' : 'admin'}`}>{template.status === 'archived' ? 'hidden' : template.status.replace('_', ' ')}</em>
              </button>
            ))}
            {templates.length === 0 ? <p>No starter templates loaded yet.</p> : null}
          </div>
        </article>

        <article className="app-card admin-action-card">
          <div className="status-row"><span className="semantic-badge admin">{selectedTemplate ? 'Edit template' : 'Create template'}</span></div>
          <h2>{selectedTemplate ? selectedTemplate.title : 'New starter template'}</h2>
          <div className="admin-template-form">
            <label><span>Kind</span><select value={form.kind} onChange={(event) => resetForm(event.target.value as TemplateKind)} disabled={!!selectedTemplate}><option value="need">Need</option><option value="offer">Offer</option></select></label>
            <label><span>Title</span><input value={form.title} onChange={(event) => updateForm('title', event.target.value)} maxLength={70} /></label>
            <label><span>Description</span><textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={5} maxLength={500} /></label>
            <div className="admin-template-form__grid">
              <label><span>Item type</span><select value={form.itemType} onChange={(event) => updateForm('itemType', event.target.value as ItemType)}><option value="service">service</option><option value="goods">goods</option><option value="other">other</option></select></label>
              <label><span>Status</span><select value={form.status} onChange={(event) => updateForm('status', event.target.value as TemplateStatus)}><option value="active">active</option><option value="pending_review">pending review</option><option value="draft">draft</option><option value="rejected">rejected</option><option value="archived">hidden</option></select></label>
              <label><span>Language</span><select value={form.languageCode} onChange={(event) => updateForm('languageCode', event.target.value as 'en' | 'fr')}><option value="en">English</option><option value="fr">French</option></select></label>
              <label><span>Country code</span><input value={form.countryCode} onChange={(event) => updateForm('countryCode', event.target.value.toUpperCase().slice(0, 2))} placeholder="Optional" /></label>
              <label><span>Category</span><input value={form.category} onChange={(event) => updateForm('category', event.target.value)} /></label>
              <label><span>Mode</span><select value={form.mode} onChange={(event) => updateForm('mode', event.target.value as '' | ExchangeMode)}><option value="">none</option><option value="remote">remote</option><option value="local">local</option><option value="hybrid">hybrid</option></select></label>
              <label><span>{form.kind === 'need' ? 'Timing' : 'Availability'}</span><input value={form.kind === 'need' ? form.timing : form.availability} onChange={(event) => form.kind === 'need' ? updateForm('timing', event.target.value) : updateForm('availability', event.target.value)} /></label>
              <label><span>Location label</span><input value={form.locationLabel} onChange={(event) => updateForm('locationLabel', event.target.value)} /></label>
              <label><span>Sort order</span><input value={form.sortOrder} onChange={(event) => updateForm('sortOrder', event.target.value)} inputMode="numeric" /></label>
            </div>
            <label><span>Tags, comma-separated</span><input value={form.tagsText} onChange={(event) => updateForm('tagsText', event.target.value)} placeholder="design, remote, this week" /></label>
            {form.kind === 'offer' ? <label><span>Includes, comma-separated</span><input value={form.includesText} onChange={(event) => updateForm('includesText', event.target.value)} placeholder="one revision, source file" /></label> : null}
            <section className="admin-template-media-panel">
              <div>
                <strong>Starter images</strong>
                <span>Upload up to 5 JPEG, PNG, or WEBP images. When a user clones this starter, the images are copied onto the new Need/Offer.</span>
              </div>
              <label className="image-upload-button">
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || loading || templateMedia.length >= 5 || !token} onChange={(event) => { void uploadTemplateImages(event.target.files); event.currentTarget.value = ''; }} />
                {uploading ? 'Uploading…' : templateMedia.length >= 5 ? 'Image limit reached' : 'Upload images'}
              </label>
              {templateMedia.length ? (
                <div className="inventory-media-grid admin-template-media-grid">
                  {templateMedia.map((item) => (
                    <figure key={item.id}>
                      <img src={templateMediaUrl(item, apiBase)} alt={item.filename ?? 'Starter template image'} />
                      <figcaption>
                        <span className="semantic-badge instruction">{item.status ?? 'active'}</span>
                        <button type="button" className="secondary" onClick={() => removeTemplateImage(item.id)} disabled={loading || uploading}>Remove</button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : <p className="notice-box info">No starter images yet. Text-only templates still work.</p>}
            </section>
            <div className="cta-row">
              <button type="button" onClick={() => { void saveTemplate(); }} disabled={loading || !token}>{selectedTemplate ? 'Save changes' : 'Create template'}</button>
              <button type="button" className="secondary" onClick={() => resetForm()}>New template</button>
              {selectedTemplate ? <input value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Admin review note for Business items" /> : null}
              {selectedTemplate?.status === 'pending_review' ? <button type="button" className="success" onClick={() => { void changeTemplateVisibility(selectedTemplate, 'approve'); }} disabled={loading || !token}>Approve</button> : null}
              {selectedTemplate?.status === 'pending_review' ? <button type="button" className="danger" onClick={() => { void changeTemplateVisibility(selectedTemplate, 'reject'); }} disabled={loading || !token}>Reject</button> : null}
              {selectedTemplate?.status === 'archived' ? <button type="button" className="success" onClick={() => { void changeTemplateVisibility(selectedTemplate, 'restore'); }} disabled={loading || !token}>Restore</button> : null}
              {selectedTemplate && selectedTemplate.status !== 'archived' ? <button type="button" className="danger" onClick={() => { void changeTemplateVisibility(selectedTemplate, 'hide'); }} disabled={loading || !token}>Hide</button> : null}
            </div>
          </div>
          <p className="notice-box warning">Changing a template affects future starter lists only. Existing user-created Needs/Offers linked to the template are kept unchanged.</p>
        </article>
      </section>
    </main>
  );
}
