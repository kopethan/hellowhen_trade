'use client';

import Link from 'next/link';
import type { NeedDto, OfferDto } from '@hellowhen/contracts';
import { WebIcon } from '../../components/WebIcon';
import { getInventoryMetadata, mediaSrc } from '../inventory/inventoryPresentation';
import { useWebTranslation } from '../../providers/WebI18nProvider';

type SideMode = 'saved' | 'money' | 'cash_promise';
type Side = 'need' | 'offer';
type Inventory = NeedDto | OfferDto;

type TradeSidePickerProps = {
  label: string;
  side: Side;
  mode: SideMode;
  onModeChange: (mode: SideMode) => void;
  items: Inventory[];
  selectedId: string;
  chooseHref: string;
  sourceChoiceHref?: string;
  newHref: string;
  emptyTitle: string;
  emptyBody: string;
  moneyEnabled?: boolean;
  cashPromiseEnabled?: boolean;
};

function sourceHref(href: string, source: 'mine' | 'starter') {
  return `${href}${href.includes('?') ? '&' : '?'}source=${source}`;
}

function InventoryPreview({ item, side }: { item: Inventory; side: Side }) {
  const image = item.media?.[0] ?? null;
  return (
    <span className="trade-side-choice-card__inner">
      <span className="trade-side-choice-card__media" aria-hidden="true">
        {image ? <img src={mediaSrc(image)} alt="" loading="lazy" /> : <WebIcon name={side === 'need' ? 'need' : 'offer'} size={24} decorative />}
      </span>
      <span className="trade-side-choice-card__body">
        <strong>{item.title}</strong>
        <small>{getInventoryMetadata(item) || item.description}</small>
      </span>
      <em>{item.status}</em>
    </span>
  );
}

function SourceActionLink({ href, label, ariaLabel, tone = 'default' }: { href: string; label: string; ariaLabel: string; tone?: 'default' | 'starter' | 'create' }) {
  return (
    <Link href={href} aria-label={ariaLabel} className={`trade-side-inline-action trade-side-inline-action--${tone}`}>
      {label}
    </Link>
  );
}

export function TradeSidePicker({ label, side, mode, onModeChange, items, selectedId, chooseHref, sourceChoiceHref, newHref, emptyTitle, emptyBody, moneyEnabled = false, cashPromiseEnabled = false }: TradeSidePickerProps) {
  const { t } = useWebTranslation();
  const sideClass = side === 'need' ? 'need' : 'offer';
  const moneyText = side === 'need' ? t('trade.labels.iNeed') : t('trade.labels.iOffer');
  const savedText = side === 'need' ? t('inventory.labels.savedNeed') : t('inventory.labels.savedOffer');
  const pluralLabel = side === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase();
  const itemLabel = side === 'need' ? t('inventory.labels.need') : t('inventory.labels.offer');
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const sourceTitle = t('trade.sidePicker.chooseSourceTitle', { item: itemLabel.toLowerCase() });
  const sourceBody = t('trade.sidePicker.chooseSourceBody', { items: pluralLabel, item: itemLabel.toLowerCase() });
  const sourceRouteHref = sourceChoiceHref ?? chooseHref;

  return (
    <section className="mobile-card trade-side-picker">
      <div className="trade-side-picker__header">
        <div>
          <p className="eyebrow">{label}</p>
          <h3>{mode === 'money' ? moneyText : mode === 'cash_promise' ? t('trade.cashPromise.title') : selected ? selected.title : t('trade.sidePicker.chooseSourceTitle', { item: itemLabel.toLowerCase() })}</h3>
        </div>
        <span className={`semantic-badge ${sideClass}`}><WebIcon name={side === 'need' ? 'need' : 'offer'} size={14} decorative /> {label}</span>
      </div>

      {mode === 'money' && moneyEnabled ? (
        <div className="trade-side-money-state">
          <strong>{moneyText}</strong>
          <span>{t('account.wallet.optionalWalletBody')}</span>
          <button type="button" className="trade-side-source-back" onClick={() => onModeChange('saved')}>{savedText}</button>
        </div>
      ) : mode === 'cash_promise' && cashPromiseEnabled ? (
        <div className="trade-side-money-state trade-side-money-state--cash-promise">
          <strong>{t('trade.cashPromise.title')}</strong>
          <span>{t('trade.cashPromise.notProcessed')}</span>
          <button type="button" className="trade-side-source-back" onClick={() => onModeChange('saved')}>{savedText}</button>
        </div>
      ) : selected ? (
        <div className="trade-side-choice-state">
          <Link href={sourceRouteHref} className="trade-side-choice-card trade-side-choice-card--link" aria-label={t('trade.sidePicker.changeSource')}>
            <InventoryPreview item={selected} side={side} />
          </Link>
          <div className="trade-side-inline-actions" role="group" aria-label={t('trade.sidePicker.changeSource')}>
            <SourceActionLink
              href={sourceHref(chooseHref, 'mine')}
              label={t('trade.sidePicker.sourceMineShort')}
              ariaLabel={t('trade.sidePicker.useMine')}
            />
            <SourceActionLink
              href={sourceHref(chooseHref, 'starter')}
              label={t('trade.sidePicker.sourceStarterShort')}
              ariaLabel={t('trade.sidePicker.useStarter')}
              tone="starter"
            />
            <SourceActionLink
              href={newHref}
              label={t('common.actions.create')}
              ariaLabel={t('trade.sidePicker.createNew', { item: itemLabel })}
              tone="create"
            />
          </div>
        </div>
      ) : (
        <div className="trade-side-source-step trade-side-source-step--inline">
          <p className="trade-side-source-inline-copy">{items.length ? t('inventory.messages.visibleItems', { count: items.length, items: pluralLabel }) : emptyTitle || emptyBody}</p>
          <Link href={sourceRouteHref} className="trade-side-source-trigger">
            <span><WebIcon name={side === 'need' ? 'need' : 'offer'} size={20} decorative /></span>
            <strong>{sourceTitle}</strong>
            <small>{sourceBody}</small>
          </Link>
        </div>
      )}
    </section>
  );
}
