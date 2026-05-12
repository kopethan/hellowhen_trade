'use client';

import Link from 'next/link';
import type { NeedDto, OfferDto } from '@hellowhen/contracts';
import { WebIcon } from '../../components/WebIcon';
import { getInventoryMetadata, mediaSrc } from '../inventory/inventoryPresentation';
import { useWebTranslation } from '../../providers/WebI18nProvider';

type SideMode = 'saved' | 'money';
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
  emptyTitle: string;
  emptyBody: string;
  moneyEnabled?: boolean;
};

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

export function TradeSidePicker({ label, side, mode, onModeChange, items, selectedId, chooseHref, emptyTitle, emptyBody, moneyEnabled = false }: TradeSidePickerProps) {
  const { t } = useWebTranslation();
  const sideClass = side === 'need' ? 'need' : 'offer';
  const moneyText = side === 'need' ? t('trade.labels.iNeed') : t('trade.labels.iOffer');
  const savedText = side === 'need' ? t('inventory.labels.savedNeed') : t('inventory.labels.savedOffer');
  const chooseText = side === 'need' ? t('trade.sidePicker.searchSaved', { items: t('inventory.labels.needs').toLowerCase() }) : t('trade.sidePicker.searchSaved', { items: t('inventory.labels.offers').toLowerCase() });
  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <section className="mobile-card trade-side-picker">
      <div className="trade-side-picker__header">
        <div>
          <p className="eyebrow">{label}</p>
          <h3>{mode === 'money' ? moneyText : selected ? selected.title : chooseText}</h3>
        </div>
        <span className={`semantic-badge ${sideClass}`}><WebIcon name={side === 'need' ? 'need' : 'offer'} size={14} decorative /> {label}</span>
      </div>

      {moneyEnabled ? (
        <div className="trade-side-mode-toggle" role="group" aria-label={`${label} ${t('trade.labels.type')}`}>
          <button type="button" className={mode === 'saved' ? 'is-active' : ''} onClick={() => onModeChange('saved')}>{savedText}</button>
          <button type="button" className={mode === 'money' ? 'is-active' : ''} onClick={() => onModeChange('money')}>{t('account.walletMoney')}</button>
        </div>
      ) : null}

      {mode === 'money' && moneyEnabled ? (
        <div className="trade-side-money-state">
          <strong>{moneyText}</strong>
          <span>{t('account.wallet.optionalWalletBody')}</span>
        </div>
      ) : selected ? (
        <div className="trade-side-choice-state">
          <Link href={chooseHref} className="trade-side-choice-card" aria-label={t('trade.sidePicker.changeSource')}>
            <InventoryPreview item={selected} side={side} />
          </Link>
          <Link href={chooseHref} className="button secondary trade-side-change-button">{t('common.actions.edit')}</Link>
        </div>
      ) : (
        <Link href={chooseHref} className="trade-side-placeholder">
          <span><WebIcon name={side === 'need' ? 'need' : 'offer'} size={22} decorative /></span>
          <strong>{chooseText}</strong>
          <small>{items.length ? t('inventory.messages.visibleItems', { count: items.length, items: side === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase() }) : emptyTitle || emptyBody}</small>
        </Link>
      )}
    </section>
  );
}
