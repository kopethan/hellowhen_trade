'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { InventoryTemplateDto } from '@hellowhen/contracts';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { availabilityPresetLabel, durationPresetLabel, inventoryCategoryLabel, itemTypeLabel, mediaSrc, modeLabel } from '../inventory/inventoryPresentation';

type InventoryIdeaKind = 'need' | 'offer';
type TemplateResponse = InventoryTemplateDto | { template?: InventoryTemplateDto };
type CloneTemplateResponse = { need?: { id?: string }; offer?: { id?: string } };

type ExploreInventoryIdeaDetailClientProps = {
  kind: InventoryIdeaKind;
  templateId: string;
};

function unwrapTemplate(response: TemplateResponse): InventoryTemplateDto | null {
  if ('template' in response) return (response as { template?: InventoryTemplateDto }).template ?? null;
  return response as InventoryTemplateDto;
}

function sourceLabel(template: InventoryTemplateDto, t: ReturnType<typeof useWebTranslation>['t']) {
  if (template.businessProfile?.displayName) return t('inventory.sourceLabels.fromBusiness', { name: template.businessProfile.displayName });
  if (template.sourceType === 'brand') return t('inventory.sourceLabels.brandLibrary');
  if (template.sourceType === 'business') return t('inventory.sourceLabels.companyLibrary');
  if (template.sourceType === 'partner') return t('inventory.sourceLabels.partnerLibrary');
  return t('inventory.sourceLabels.hellowhenLibrary');
}

export function ExploreInventoryIdeaDetailClient({ kind, templateId }: ExploreInventoryIdeaDetailClientProps) {
  const router = useRouter();
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const i18n = { t, language };
  const [template, setTemplate] = useState<InventoryTemplateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [action, setAction] = useState<'add' | 'trade' | ''>('');
  const [actionError, setActionError] = useState('');
  const label = kind === 'need' ? t('inventory.labels.need') : t('inventory.labels.offer');

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.inventoryTemplates.get(templateId) as TemplateResponse;
      const next = unwrapTemplate(response);
      if (!next || next.kind !== kind || next.status !== 'active') throw new Error(t('inventory.errors.apiMissingItem', { item: label }));
      setTemplate(next);
    } catch (caughtError) {
      setTemplate(null);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [kind, label, t, templateId]);

  useEffect(() => { void loadTemplate(); }, [loadTemplate]);
  useEffect(() => { setCopiedId(''); setActionError(''); }, [kind, templateId]);

  const ensureCopy = useCallback(async () => {
    if (copiedId) return copiedId;
    if (!template) throw new Error(t('inventory.errors.starterLibraryCouldNotLoad'));
    const response = await api.inventoryTemplates.clone(template.id, { status: 'active' }) as CloneTemplateResponse;
    const nextId = kind === 'need' ? response.need?.id : response.offer?.id;
    if (!nextId) throw new Error(t('inventory.errors.apiMissingItem', { item: label }));
    setCopiedId(nextId);
    return nextId;
  }, [copiedId, kind, label, t, template]);

  function requireSignedIn() {
    if (!auth.hydrated) return false;
    if (auth.isAuthenticated) return true;
    router.push(`/auth?next=${encodeURIComponent(`/explore/${kind === 'need' ? 'needs' : 'offers'}/${templateId}`)}`);
    return false;
  }

  async function addToMine() {
    if (!requireSignedIn() || copiedId || action) return;
    setAction('add');
    setActionError('');
    try { await ensureCopy(); } catch (caughtError) { setActionError(getFriendlyApiErrorMessage(caughtError)); } finally { setAction(''); }
  }

  async function startTrade() {
    if (!requireSignedIn() || action) return;
    setAction('trade');
    setActionError('');
    try {
      const itemId = await ensureCopy();
      const params = new URLSearchParams({ postType: 'need_offer', [kind === 'need' ? 'needId' : 'offerId']: itemId });
      router.push(`/trades/create?${params.toString()}`);
    } catch (caughtError) {
      setActionError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setAction('');
    }
  }

  const images = useMemo(() => (template?.media ?? []).map((media) => ({ id: media.id, src: mediaSrc(media) })).filter((image) => Boolean(image.src)), [template]);

  if (loading) return <main className="mobile-page web-app-page explore-detail-page"><div className="explore-discovery-state"><span className="semantic-badge instruction">{t('common.states.loading')}</span></div></main>;
  if (!template || error) {
    return (
      <main className="mobile-page web-app-page explore-detail-page">
        <div className="explore-discovery-state">
          <WebIcon name={kind} size={28} decorative />
          <h1>{t('inventory.errors.unavailable', { item: label })}</h1>
          <p>{error || t('inventory.errors.starterLibraryCouldNotLoad')}</p>
          <button type="button" className="button secondary" onClick={() => { void loadTemplate(); }}>{t('common.actions.tryAgain')}</button>
        </div>
      </main>
    );
  }

  const timing = kind === 'need' ? template.timing : template.availability;
  const availability = availabilityPresetLabel(template.availabilityPreset, i18n);
  const duration = durationPresetLabel(template.durationPreset, i18n);
  const chips = [itemTypeLabel(template.itemType, i18n), inventoryCategoryLabel(template.category, i18n), modeLabel(template.mode, i18n)].filter(Boolean);

  return (
    <main className="mobile-page web-app-page explore-detail-page">
      <Link href="/explore" className="explore-detail-back"><WebIcon name="back" size={17} decorative /> {t('common.actions.back')}</Link>
      <header className="explore-detail-hero">
        <span className={`semantic-badge ${kind}`}>{t('common.librarySegments.explore')} · {label}</span>
        <h1>{template.title}</h1>
        {template.description ? <p>{template.description}</p> : null}
        <small>{sourceLabel(template, t)}</small>
        <div className="explore-detail-chips">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
      </header>

      <section className="explore-detail-section">
        <h2>{t('inventory.labels.details')}</h2>
        <dl className="explore-detail-list">
          <div><dt>{kind === 'need' ? t('inventory.labels.timing') : t('inventory.labels.availability')}</dt><dd>{timing || availability || t('inventory.labels.notSpecified')}</dd></div>
          {timing && availability ? <div><dt>{t('inventory.libraryFilters.availability')}</dt><dd>{availability}</dd></div> : null}
          <div><dt>{t('inventory.libraryFilters.duration')}</dt><dd>{duration || t('inventory.labels.notSpecified')}</dd></div>
          <div><dt>{t('inventory.labels.location')}</dt><dd>{template.locationLabel || t('inventory.labels.notSpecified')}</dd></div>
        </dl>
      </section>

      {template.tags?.length ? <section className="explore-detail-section"><h2>{t('inventory.labels.tags')}</h2><div className="explore-detail-chips">{template.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section> : null}
      {kind === 'offer' && template.includes?.length ? <section className="explore-detail-section"><h2>{t('inventory.labels.includes')}</h2><ul>{template.includes.map((item, index) => <li key={`${template.id}-include-${index}`}>{item}</li>)}</ul></section> : null}
      {images.length ? <section className="explore-detail-section"><h2>{t('inventory.labels.images')}</h2><div className="explore-detail-images">{images.slice(0, 5).map((image, index) => <img key={image.id} src={image.src} alt={`${template.title} ${index + 1}`} loading="lazy" />)}</div></section> : null}

      <section className="explore-detail-actions">
        <p>{actionError || (copiedId ? t('common.exploreActions.addedHelper') : t('common.exploreActions.helper'))}</p>
        <div>
          <button type="button" className="button secondary" disabled={Boolean(copiedId || action)} onClick={() => { void addToMine(); }}>
            {copiedId ? t(kind === 'need' ? 'common.exploreActions.addedNeed' : 'common.exploreActions.addedOffer') : action === 'add' ? t('common.states.saving') : t(kind === 'need' ? 'common.exploreActions.addNeed' : 'common.exploreActions.addOffer')}
          </button>
          <button type="button" className="button" disabled={Boolean(action === 'add')} onClick={() => { void startTrade(); }}>{action === 'trade' ? t('common.states.creating') : t('common.exploreActions.startTrade')}</button>
        </div>
      </section>
    </main>
  );
}
