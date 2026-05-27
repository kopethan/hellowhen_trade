'use client';

import type { NeedDto, OfferDto } from '@hellowhen/contracts';
import { betaFeatures } from '../../lib/betaFeatures';
import { WebIcon } from '../../components/WebIcon';

type TradePackageRequiredSide = 'need' | 'offer' | null;

type ProTradePackagePrototypeProps = {
  requiredSide: TradePackageRequiredSide;
  enabled: boolean;
  needs: NeedDto[];
  offers: OfferDto[];
  supportingNeedIds: string[];
  supportingOfferIds: string[];
  onToggleEnabled: (enabled: boolean) => void;
  onSupportingNeedIdsChange: (ids: string[]) => void;
  onSupportingOfferIdsChange: (ids: string[]) => void;
};

function itemMeta(item: NeedDto | OfferDto) {
  const timing = (item as NeedDto).timing ?? (item as OfferDto).availability;
  return [item.category, item.mode, timing].filter(Boolean).join(' · ') || item.itemType || 'Saved item';
}

function toggleId(current: string[], id: string, max: number) {
  if (current.includes(id)) return current.filter((itemId) => itemId !== id);
  return [...current, id].slice(0, max);
}

export function ProTradePackagePrototype({
  requiredSide,
  enabled,
  needs,
  offers,
  supportingNeedIds,
  supportingOfferIds,
  onToggleEnabled,
  onSupportingNeedIdsChange,
  onSupportingOfferIdsChange,
}: ProTradePackagePrototypeProps) {
  const flags = betaFeatures.proTradePackageFeatures;
  if (!flags.visible || !['need', 'offer'].includes(requiredSide ?? '')) return null;

  const isOfferPackage = requiredSide === 'offer';
  const items = isOfferPackage ? offers : needs;
  const selectedIds = isOfferPackage ? supportingOfferIds : supportingNeedIds;
  const maxItems = isOfferPackage ? flags.maxSupportingOffers : flags.maxSupportingNeeds;
  const title = isOfferPackage ? 'Pro Trade Package: offer multiple Offers' : 'Pro Trade Package: request multiple Needs';
  const body = isOfferPackage
    ? 'Hidden prototype for one Open Need with multiple supporting Offers. The owner accepts or declines the package as one unit.'
    : 'Hidden prototype for one Open Offer with multiple supporting Needs. The owner accepts or declines the package as one unit.';

  return (
    <section className="pro-package-prototype" aria-label="Hidden Pro Trade Package prototype">
      <div className="pro-package-prototype__header">
        <div>
          <p className="eyebrow">Hidden Pro prototype</p>
          <h3 className="icon-heading"><WebIcon name="proposal" size={18} decorative /> {title}</h3>
        </div>
        <label className="pro-package-prototype__switch">
          <input type="checkbox" checked={enabled} onChange={(event) => onToggleEnabled(event.target.checked)} />
          <span>{enabled ? 'Package mode on' : 'Package mode off'}</span>
        </label>
      </div>
      <p className="pro-package-prototype__body">{body}</p>
      <p className="pro-package-prototype__body subtle">Requires verified Professional access and an active/trialing Pro subscription. Backend guards still enforce access.</p>

      {enabled ? (
        <div className="pro-package-prototype__items">
          <div className="pro-package-prototype__limit-row">
            <strong>{isOfferPackage ? 'Supporting Offers' : 'Supporting Needs'}</strong>
            <span>{selectedIds.length}/{maxItems}</span>
          </div>
          {items.length ? items.map((item) => {
            const selected = selectedIds.includes(item.id);
            const disabled = !selected && selectedIds.length >= maxItems;
            return (
              <label key={item.id} className={selected ? 'pro-package-prototype__item selected' : 'pro-package-prototype__item'}>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onChange={() => {
                    const nextIds = toggleId(selectedIds, item.id, maxItems);
                    if (isOfferPackage) onSupportingOfferIdsChange(nextIds);
                    else onSupportingNeedIdsChange(nextIds);
                  }}
                />
                <span>
                  <strong>{item.title}</strong>
                  <em>{itemMeta(item)}</em>
                </span>
              </label>
            );
          }) : (
            <div className="pro-package-prototype__empty">Create active saved {isOfferPackage ? 'Offers' : 'Needs'} before testing a package.</div>
          )}
        </div>
      ) : null}
    </section>
  );
}
