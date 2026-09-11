'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { WebIcon } from '../../components/WebIcon';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { PlansFeatureGate } from './PlansFeatureGate';
import { activePlanFilterCount, buildPlanFilterHref, normalizePlanSearchQuery, planFilterGroups, planFiltersFromSearchParams, planSearchQueryFromSearchParams, togglePlanFilterValue } from './planFilters';

type PlanFilterClientProps = {
  plansEnabled?: boolean;
};

export function PlanFilterClient({ plansEnabled }: PlanFilterClientProps) {
  const searchParams = useSearchParams();
  const { t } = useWebTranslation();
  const searchParamKey = searchParams.toString();
  const incomingFilters = useMemo(() => planFiltersFromSearchParams(searchParams), [searchParamKey, searchParams]);
  const incomingFilterKey = incomingFilters.join('|');
  const incomingQuery = useMemo(() => planSearchQueryFromSearchParams(searchParams), [searchParamKey, searchParams]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(incomingFilters);
  const [searchQuery, setSearchQuery] = useState(incomingQuery);
  const normalizedSearchQuery = normalizePlanSearchQuery(searchQuery);
  const activeCount = activePlanFilterCount(selectedFilters, normalizedSearchQuery);
  const plansHref = useMemo(() => buildPlanFilterHref('/plans', selectedFilters, normalizedSearchQuery), [selectedFilters, normalizedSearchQuery]);
  const backHref = useMemo(() => buildPlanFilterHref('/plans', incomingFilters, incomingQuery), [incomingFilters, incomingQuery]);
  const translatedGroups = useMemo(() => planFilterGroups.map((group, groupIndex) => {
    const groupKeys = ['status', 'mode', 'join', 'places', 'time'] as const;
    const groupKey = groupKeys[groupIndex];
    const optionKeys: Record<string, string> = {
      'status:open': 'open', 'status:full': 'full', 'status:started': 'started',
      'mode:local': 'local', 'mode:remote': 'remote', 'join:automatic': 'automatic',
      'places:one': 'one', 'places:multiple': 'multiple',
      'time:today': 'today', 'time:week': 'week', 'time:month': 'month',
    };
    return {
      ...group,
      title: t(`plans.filters.groups.${groupKey}.title`),
      body: t(`plans.filters.groups.${groupKey}.body`),
      options: group.options.map((option) => {
        const optionKey = optionKeys[option.value];
        return {
          ...option,
          label: optionKey ? t(`plans.filters.groups.${groupKey}.${optionKey}.label`) : option.label,
          body: optionKey && option.body ? t(`plans.filters.groups.${groupKey}.${optionKey}.body`) : option.body,
        };
      }),
    };
  }), [t]);

  useEffect(() => {
    setSelectedFilters(incomingFilters);
    setSearchQuery(incomingQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingFilterKey, incomingQuery]);

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page plans-filter-page app-filter-page app-filter-page--plans web-app-page web-app-page--filter web-app-page--plans">
        <header className="plans-filter-header app-filter-header">
          <Link className="plans-feed-icon-button app-filter-back" href={backHref} aria-label={t('plans.create.intro.backToPlans')}><WebIcon name="back" size={18} decorative /></Link>
          <div>
            <h1>{t('plans.filters.title')}</h1>
            <p>{t('plans.filters.groups.status.body')}</p>
          </div>
        </header>

        <section className="plans-filter-hero app-filter-hero" aria-label={t('plans.filters.title')}>
          <span className="plans-filter-hero__icon app-filter-hero__icon" aria-hidden="true">◇</span>
          <div>
            <strong>{t('plans.filters.heroTitle')}</strong>
            <span>{t('plans.filters.heroBody')}</span>
          </div>
        </section>

        <section className="plans-filter-search app-filter-search" aria-label={t('plans.filters.searchLabel')}>
          <label htmlFor="plan-filter-search">{t('plans.filters.searchLabel')}</label>
          <div className="plans-filter-search__inputWrap app-filter-search__input-wrap">
            <input
              id="plan-filter-search"
              type="search"
              value={searchQuery}
              maxLength={120}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('plans.filters.searchPlaceholder')}
            />
            {normalizedSearchQuery ? <button type="button" onClick={() => setSearchQuery('')}>{t('plans.filters.clear')}</button> : null}
          </div>
          <p>{t('plans.filters.searchHelp')}</p>
        </section>

        <section className="plans-filter-groups app-filter-groups" aria-label={t('plans.filters.title')}>
          {translatedGroups.map((group) => (
            <article key={group.title} className="plans-filter-group app-filter-group">
              <div className="plans-filter-group__header app-filter-group__header">
                <h2>{group.title}</h2>
                <p>{group.body}</p>
              </div>
              <div className="plans-filter-options app-filter-options">
                {group.options.map((option) => {
                  const selected = selectedFilters.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={selected ? 'plans-filter-option app-filter-option is-selected' : 'plans-filter-option app-filter-option'}
                      aria-pressed={selected}
                      onClick={() => setSelectedFilters((current) => togglePlanFilterValue(current, option.value))}
                    >
                      <span className="plans-filter-option__check app-filter-option__check" aria-hidden="true">{selected ? '×' : ''}</span>
                      <span>
                        <strong>{option.label}</strong>
                        {option.body ? <small>{option.body}</small> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </section>

        <footer className="plans-filter-footer app-filter-footer">
          <button type="button" className="button secondary" disabled={activeCount === 0} onClick={() => { setSelectedFilters([]); setSearchQuery(''); }}>{t('plans.filters.reset')}</button>
          <Link className="button primary" href={plansHref}>{activeCount ? t('plans.filters.showCount', { count: activeCount }) : t('plans.filters.show')}</Link>
        </footer>
      </main>
    </PlansFeatureGate>
  );
}
