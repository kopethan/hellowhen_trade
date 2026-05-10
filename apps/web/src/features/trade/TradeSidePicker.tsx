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
  chooseHref: string;
  emptyTitle: string;
  emptyBody: string;
  moneyEnabled?: boolean;
};

function statusLabel(item: Inventory) {
  return item.status;
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
      <em>{statusLabel(item)}</em>
    </span>
  );
}

export function TradeSidePicker({ label, side, mode, onModeChange, items, selectedId, chooseHref, emptyTitle, emptyBody, moneyEnabled = false }: TradeSidePickerProps) {
  const sideClass = side === 'need' ? 'need' : 'offer';
  const moneyText = side === 'need' ? 'I need money' : 'I offer money';
  const savedText = side === 'need' ? 'Saved Need' : 'Saved Offer';
  const chooseText = side === 'need' ? 'Click to choose a saved need' : 'Click to choose a saved offer';
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
        <div className="trade-side-mode-toggle" role="group" aria-label={`${label} type`}>
          <button type="button" className={mode === 'saved' ? 'is-active' : ''} onClick={() => onModeChange('saved')}>{savedText}</button>
          <button type="button" className={mode === 'money' ? 'is-active' : ''} onClick={() => onModeChange('money')}>Wallet money</button>
        </div>
      ) : null}

      {mode === 'money' && moneyEnabled ? (
        <div className="trade-side-money-state">
          <strong>{moneyText}</strong>
          <span>The amount is set once below and stays under this side.</span>
        </div>
      ) : selected ? (
        <div className="trade-side-choice-state">
          <Link href={chooseHref} className="trade-side-choice-card" aria-label={`Change ${side === 'need' ? 'need' : 'offer'}`}>
            <InventoryPreview item={selected} side={side} />
          </Link>
          <Link href={chooseHref} className="button secondary trade-side-change-button">Change</Link>
        </div>
      ) : (
        <Link href={chooseHref} className="trade-side-placeholder">
          <span><WebIcon name={side === 'need' ? 'need' : 'offer'} size={22} decorative /></span>
          <strong>{chooseText}</strong>
          <small>{items.length ? `${items.length} saved ${side === 'need' ? 'needs' : 'offers'} available` : emptyTitle || emptyBody}</small>
        </Link>
      )}
    </section>
  );
}
