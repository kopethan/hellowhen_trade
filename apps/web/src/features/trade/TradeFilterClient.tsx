'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { WebIcon } from '../../components/WebIcon';
import { betaFeatures } from '../../lib/betaFeatures';
import { activeTradeFilterCount, buildTradeFilterHref, tradeFilterGroups, tradeFiltersFromSearchParams, tradeFiltersFromValues, tradeFilterValuesFromFilters, toggleTradeFilterValue } from './tradeFilters';

export function TradeFilterClient() {
  const searchParams = useSearchParams();
  const searchParamKey = searchParams.toString();
  const incomingFilters = useMemo(() => tradeFiltersFromSearchParams(searchParams), [searchParamKey, searchParams]);
  const incomingFilterValues = useMemo(() => tradeFilterValuesFromFilters(incomingFilters), [incomingFilters]);
  const incomingFilterKey = incomingFilterValues.join('|');
  const [selectedValues, setSelectedValues] = useState<string[]>(incomingFilterValues);
  const [searchQuery, setSearchQuery] = useState(incomingFilters.q);
  const selectedFilters = useMemo(() => tradeFiltersFromValues(selectedValues, searchQuery), [searchQuery, selectedValues]);
  const activeCount = activeTradeFilterCount(selectedFilters);
  const tradesHref = useMemo(() => buildTradeFilterHref('/trades', selectedFilters), [selectedFilters]);
  const backHref = useMemo(() => buildTradeFilterHref('/trades', incomingFilters), [incomingFilters]);

  useEffect(() => {
    setSelectedValues(incomingFilterValues);
    setSearchQuery(incomingFilters.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingFilterKey, incomingFilters.q]);

  function toggleValue(value: string) {
    if (!betaFeatures.moneyTradesEnabled && value === 'extra:hasMoney') return;
    setSelectedValues((current) => toggleTradeFilterValue(current, value));
  }

  return (
    <main className="mobile-page plans-page plans-filter-page trade-filter-page app-filter-page app-filter-page--trade web-app-page web-app-page--filter web-app-page--trade">
      <header className="plans-filter-header app-filter-header">
        <Link className="plans-feed-icon-button app-filter-back" href={backHref} aria-label="Back to Trade"><WebIcon name="back" size={18} decorative /></Link>
        <div>
          <h1>Trade filters</h1>
          <p>Search and filter exchange cards.</p>
        </div>
      </header>

      <section className="plans-filter-hero trade-filter-hero app-filter-hero" aria-label="Trade filter summary">
        <span className="plans-filter-hero__icon app-filter-hero__icon" aria-hidden="true"><WebIcon name="filter" size={18} decorative /></span>
        <div>
          <strong>Find the right exchange</strong>
          <span>Search words stay attached to the feed so Trade can learn what people look for later.</span>
        </div>
      </section>

      <section className="plans-filter-search app-filter-search" aria-label="Search Trades">
        <label htmlFor="trade-filter-search">Search</label>
        <div className="plans-filter-search__inputWrap app-filter-search__input-wrap">
          <input
            id="trade-filter-search"
            type="search"
            value={searchQuery}
            maxLength={120}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search trades, needs, offers..."
          />
          {searchQuery.trim() ? <button type="button" onClick={() => setSearchQuery('')}>Clear</button> : null}
        </div>
        <p>Search is applied on the feed after you tap Show trades.</p>
      </section>

      <section className="plans-filter-groups app-filter-groups" aria-label="Trade filter options">
        {tradeFilterGroups.map((group) => (
          <article key={group.title} className="plans-filter-group app-filter-group">
            <div className="plans-filter-group__header app-filter-group__header">
              <h2>{group.title}</h2>
              <p>{group.body}</p>
            </div>
            <div className="plans-filter-options app-filter-options">
              {group.options.map((option) => {
                const selected = selectedValues.includes(option.value);
                const disabled = !betaFeatures.moneyTradesEnabled && option.value === 'extra:hasMoney';
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={selected ? 'plans-filter-option app-filter-option is-selected' : 'plans-filter-option app-filter-option'}
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => toggleValue(option.value)}
                  >
                    <span className="plans-filter-option__check app-filter-option__check" aria-hidden="true">{selected ? '×' : ''}</span>
                    <span>
                      <strong>{option.label}</strong>
                      {option.body ? <small>{disabled ? 'Disabled for this build' : option.body}</small> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      <footer className="plans-filter-footer app-filter-footer">
        <button type="button" className="button secondary" disabled={activeCount === 0} onClick={() => { setSelectedValues([]); setSearchQuery(''); }}>Reset</button>
        <Link className="button primary" href={tradesHref}>{activeCount ? `Show trades (${activeCount})` : 'Show trades'}</Link>
      </footer>
    </main>
  );
}
