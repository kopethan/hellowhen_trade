'use client';

import Link from 'next/link';
import type { NeedDto, OfferDto } from '@hellowhen/contracts';
import { WebIcon } from '../../components/WebIcon';
import { getInventoryMetadata, mediaSrc } from '../inventory/inventoryPresentation';

type SideMode = 'saved' | 'money';
type Side = 'need' | 'offer';
type Inventory = NeedDto | OfferDto;

type TradeSidePickerProps = {
  label: 'I need' | 'I offer';
  side: Side;
  mode: SideMode;
  onModeChange: (mode: SideMode) => void;
  items: Inventory[];
  selectedId: string;
  onSelect: (id: string) => void;
  emptyHref: string;
  emptyTitle: string;
  emptyBody: string;
  moneyEnabled?: boolean;
};

function statusLabel(item: Inventory) {
  return item.status;
}

export function TradeSidePicker({ label, side, mode, onModeChange, items, selectedId, onSelect, emptyHref, emptyTitle, emptyBody, moneyEnabled = true }: TradeSidePickerProps) {
  const sideClass = side === 'need' ? 'need' : 'offer';
  const moneyText = side === 'need' ? 'I need money' : 'I offer money';
  const savedText = side === 'need' ? 'Saved Need' : 'Saved Offer';

  return (
    <section className="mobile-card trade-side-picker">
      <div className="trade-side-picker__header">
        <div>
          <p className="eyebrow">{label}</p>
          <h3>{mode === 'money' ? moneyText : savedText}</h3>
        </div>
        <span className={`semantic-badge ${sideClass}`}><WebIcon name={side === 'need' ? 'need' : 'offer'} size={14} decorative /> {label}</span>
      </div>

      <div className="trade-side-mode-toggle" role="group" aria-label={`${label} type`}>
        <button type="button" className={mode === 'saved' ? 'is-active' : ''} onClick={() => onModeChange('saved')}>{savedText}</button>
        {moneyEnabled ? <button type="button" className={mode === 'money' ? 'is-active' : ''} onClick={() => onModeChange('money')}>Wallet money</button> : null}
      </div>

      {mode === 'money' && moneyEnabled ? (
        <div className="trade-side-money-state">
          <strong>{moneyText}</strong>
          <span>The amount is set once below and stays under this side.</span>
        </div>
      ) : items.length ? (
        <div className="trade-side-option-list">
          {items.map((item) => {
            const image = item.media?.[0] ?? null;
            const active = item.id === selectedId;
            return (
              <button key={item.id} type="button" className={active ? 'trade-side-option is-active' : 'trade-side-option'} onClick={() => onSelect(item.id)}>
                <span className="trade-side-option__media" aria-hidden="true">
                  {image ? <img src={mediaSrc(image)} alt="" loading="lazy" /> : <WebIcon name={side === 'need' ? 'need' : 'offer'} size={24} decorative />}
                </span>
                <span className="trade-side-option__body">
                  <span className="trade-side-option__top"><strong>{item.title}</strong><em>{statusLabel(item)}</em></span>
                  <span>{getInventoryMetadata(item) || item.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="trade-side-empty-state">
          <strong>{emptyTitle}</strong>
          <span>{emptyBody}</span>
          <Link href={emptyHref} className="button secondary"><WebIcon name="add" size={16} decorative /> Create {side === 'need' ? 'Need' : 'Offer'}</Link>
        </div>
      )}
    </section>
  );
}
