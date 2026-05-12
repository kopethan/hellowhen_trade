'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { formatInventoryDate, getInventoryMetadata, inventoryStatusLabel, itemTypeLabel, getInventoryTags, kindLabel, kindPluralLabel, mediaSrc, modeLabel, normalizeInventoryItem, sideClassName, sideLabel, type InventoryItem, type InventoryKind } from './inventoryPresentation';

type InventoryDetailClientProps = {
  kind: InventoryKind;
  itemId: string;
};

export function InventoryDetailClient({ kind, itemId }: InventoryDetailClientProps) {
  const demoDataEnabled = isWebDemoDataEnabled();
  const { t, language } = useWebTranslation();
  const [item, setItem] = useState<InventoryItem | null>(() => demoDataEnabled ? (kind === 'need' ? mockNeeds : mockOffers).find((entry) => entry.id === itemId) ?? null : null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadItem() {
      setLoading(true);
      try {
        const response = kind === 'need' ? await api.needs.get(itemId) : await api.offers.get(itemId);
        if (!mounted) return;
        const liveItem = normalizeInventoryItem(response, kind);
        if (liveItem) {
          setItem(liveItem);
          setUsingFallback(false);
        }
      } catch {
        if (!mounted) return;
        const fallback = demoDataEnabled ? (kind === 'need' ? mockNeeds : mockOffers).find((entry) => entry.id === itemId) ?? null : null;
        setItem(fallback);
        setUsingFallback(demoDataEnabled && Boolean(fallback));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadItem();
    return () => { mounted = false; };
  }, [demoDataEnabled, itemId, kind]);

  const baseHref = kind === 'need' ? '/needs' : '/offers';
  const i18n = { t, language };
  const noun = kindLabel(kind, i18n);
  const pluralNoun = kindPluralLabel(kind, i18n);

  if (!item && loading) {
    return (
      <article className="trade-detail-page">
        <section className="trade-hero-section">
          <span className="semantic-badge instruction">{t('common.states.loading')}</span>
          <h2>{t('inventory.messages.loadingItems', { items: noun.toLowerCase() })}</h2>
        </section>
      </article>
    );
  }

  if (!item) {
    return (
      <article className="trade-detail-page">
        <section className="trade-hero-section">
          <span className="semantic-badge danger">{t('trade.labels.notFound')}</span>
          <h2>{t('inventory.errors.notFoundTitle', { item: noun.toLowerCase() })}</h2>
          <p>{t('inventory.errors.notFoundBody', { collection: pluralNoun })}</p>
          <Link href={baseHref} className="button">{t('common.actions.back')} {pluralNoun}</Link>
        </section>
      </article>
    );
  }

  const metadata = getInventoryMetadata(item, i18n);
  const tags = getInventoryTags(item);
  const timingLabel = kind === 'need' && 'timing' in item
    ? item.timing ?? t('inventory.labels.notSpecified')
    : kind === 'offer' && 'availability' in item
      ? item.availability ?? t('inventory.labels.notSpecified')
      : t('inventory.labels.notSpecified');

  return (
    <article className="trade-detail-page">
      <section className="trade-hero-section">
        <div className="status-row">
          <span className={`semantic-badge ${sideClassName(kind)}`}>{sideLabel(kind, i18n)}</span>
          <span className="semantic-badge instruction">{inventoryStatusLabel(item.status, i18n)}</span>
          {usingFallback ? <span className="semantic-badge instruction">{t('trade.labels.demoDetail')}</span> : null}
        </div>
        <h2>{item.title}</h2>
        <p>{item.description}</p>
        {metadata ? <p className="meta">{metadata}</p> : null}
        <div className="inventory-detail-actions">
          <Link href={`${baseHref}/${item.id}/edit`} className="button">{kind === 'need' ? t('inventory.actions.editNeed') : t('inventory.actions.editOffer')}</Link>
          <Link href={kind === 'need' ? `/trades/create?needId=${item.id}` : `/trades/create?offerId=${item.id}`} className="button secondary">{t('inventory.actions.useInTrade')}</Link>
        </div>
      </section>

      {item.media?.length ? (
        <section className="trade-social-section">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">{t('inventory.labels.images')}</p>
              <h2>{kind === 'need' ? t('inventory.labels.needReferences') : t('inventory.labels.offerReferences')}</h2>
            </div>
          </div>
          <div className="inventory-media-grid inventory-media-grid--detail">
            {item.media.map((media) => (
              <figure key={media.id}>
                <img src={mediaSrc(media)} alt={media.filename ?? item.title} />
                <figcaption><span className="semantic-badge instruction">{inventoryStatusLabel(media.status, i18n)}</span></figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : (
        <section className="trade-social-section">
          <div className="proposal-empty-state">
            <strong>{t('inventory.labels.noImages')}</strong>
            <span>{t('inventory.empty.noImagesYetBody')}</span>
          </div>
        </section>
      )}

      <section className="trade-social-section trade-social-section--compact">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">{t('inventory.labels.details')}</p>
            <h2>{noun} {t('inventory.labels.information').toLowerCase()}</h2>
          </div>
        </div>
        <dl className="trade-detail-list">
          <div><dt>{t('inventory.labels.status')}</dt><dd>{inventoryStatusLabel(item.status, i18n)}</dd></div>
          <div><dt>{t('inventory.labels.type')}</dt><dd>{itemTypeLabel(item.itemType, i18n)}</dd></div>
          <div><dt>{t('inventory.labels.category')}</dt><dd>{item.category ?? t('inventory.labels.notSpecified')}</dd></div>
          <div><dt>{kind === 'need' ? t('inventory.labels.timing') : t('inventory.labels.availability')}</dt><dd>{timingLabel}</dd></div>
          <div><dt>{t('inventory.labels.mode')}</dt><dd>{modeLabel(item.mode, i18n) ?? t('inventory.labels.notSpecified')}</dd></div>
          <div><dt>{t('inventory.labels.location')}</dt><dd>{item.locationLabel ?? t('inventory.labels.notSpecified')}</dd></div>
          <div><dt>{t('inventory.labels.expires')}</dt><dd>{formatInventoryDate(item.expiresAt, i18n)}</dd></div>
        </dl>
        {tags.length ? (
          <div className="tag-row">
            {tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        ) : null}
      </section>
    </article>
  );
}
