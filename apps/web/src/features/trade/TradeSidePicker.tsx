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

function SourceCard({ href, icon, title, body, dashed = false }: { href: string; icon: 'need' | 'offer' | 'trade' | 'add'; title: string; body: string; dashed?: boolean }) {
  return (
    <Link href={href} className={`trade-side-source-card${dashed ? ' trade-side-source-card--dashed' : ''}`}>
      <span><WebIcon name={icon} size={22} decorative /></span>
      <strong>{title}</strong>
      <small>{body}</small>
    </Link>
  );
}

function SourceButton({ onClick, iconLabel, title, body, warning = false }: { onClick: () => void; iconLabel: string; title: string; body: string; warning?: boolean }) {
  return (
    <button type="button" className={`trade-side-source-card trade-side-source-card--button${warning ? ' trade-side-source-card--warning' : ''}`} onClick={onClick}>
      <span>{iconLabel}</span>
      <strong>{title}</strong>
      <small>{body}</small>
    </button>
  );
}

export function TradeSidePicker({ label, side, mode, onModeChange, items, selectedId, chooseHref, newHref, emptyTitle, emptyBody, moneyEnabled = false, cashPromiseEnabled = false }: TradeSidePickerProps) {
  const { t } = useWebTranslation();
  const sideClass = side === 'need' ? 'need' : 'offer';
  const moneyText = side === 'need' ? t('trade.labels.iNeed') : t('trade.labels.iOffer');
  const savedText = side === 'need' ? t('inventory.labels.savedNeed') : t('inventory.labels.savedOffer');
  const chooseText = side === 'need' ? t('trade.sidePicker.searchSaved', { items: t('inventory.labels.needs').toLowerCase() }) : t('trade.sidePicker.searchSaved', { items: t('inventory.labels.offers').toLowerCase() });
  const pluralLabel = side === 'need' ? t('inventory.labels.needs').toLowerCase() : t('inventory.labels.offers').toLowerCase();
  const itemLabel = side === 'need' ? t('inventory.labels.need') : t('inventory.labels.offer');
  const selected = items.find((item) => item.id === selectedId) ?? null;

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
          <Link href={sourceHref(chooseHref, 'mine')} className="trade-side-choice-card" aria-label={t('trade.sidePicker.changeSource')}>
            <InventoryPreview item={selected} side={side} />
          </Link>
          <Link href={sourceHref(chooseHref, 'mine')} className="button secondary trade-side-change-button">{t('common.actions.edit')}</Link>
        </div>
      ) : (
        <div className="trade-side-source-step trade-side-source-step--inline">
          <p className="trade-side-source-inline-copy">{items.length ? t('inventory.messages.visibleItems', { count: items.length, items: pluralLabel }) : emptyTitle || emptyBody}</p>
          <div className="trade-side-source-grid trade-side-source-grid--inline">
            <SourceCard href={sourceHref(chooseHref, 'mine')} icon={side === 'need' ? 'need' : 'offer'} title={t('trade.sidePicker.useMine')} body={t('trade.sidePicker.useMineBody', { items: pluralLabel })} />
            <SourceCard href={sourceHref(chooseHref, 'starter')} icon="trade" title={t('trade.sidePicker.useStarter')} body={t('trade.sidePicker.useStarterBody')} />
            <SourceCard href={newHref} icon="add" title={t('trade.sidePicker.createNew', { item: itemLabel })} body={t('trade.sidePicker.createNewBody')} dashed />
            {moneyEnabled ? <SourceButton iconLabel="€" title={t('account.walletMoney')} body={t('account.wallet.optionalWalletBody')} onClick={() => onModeChange('money')} /> : null}
            {cashPromiseEnabled ? <SourceButton iconLabel="€" title={t('trade.cashPromise.title')} body={t('trade.cashPromise.notProcessed')} warning onClick={() => onModeChange('cash_promise')} /> : null}
          </div>
        </div>
      )}
    </section>
  );
}
