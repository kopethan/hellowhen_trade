import type { TradePostType } from '@hellowhen/contracts';

export type TradeFeedFilters = {
  q: string;
  mode: string;
  hasImages: boolean;
  hasMoney: boolean;
  postType: '' | TradePostType;
};

export type TradeFilterOption = { label: string; value: string; body?: string };
export type TradeFilterGroup = { title: string; body: string; options: TradeFilterOption[] };

export const initialTradeFilters: TradeFeedFilters = { q: '', mode: '', hasImages: false, hasMoney: false, postType: '' };

export const tradeFilterGroups: TradeFilterGroup[] = [
  {
    title: 'Post type',
    body: 'Choose which exchange cards should appear.',
    options: [
      { label: 'Full trades', value: 'postType:need_offer', body: 'Need + offer exchange cards' },
      { label: 'Open needs', value: 'postType:open_need', body: 'People asking for offers' },
      { label: 'Open offers', value: 'postType:open_offer', body: 'People offering help first' },
    ],
  },
  {
    title: 'Mode',
    body: 'Match how the exchange can happen.',
    options: [
      { label: 'Remote', value: 'mode:remote', body: 'Online or from anywhere' },
      { label: 'Local', value: 'mode:local', body: 'Meet or exchange nearby' },
      { label: 'Hybrid', value: 'mode:hybrid', body: 'Remote with local option' },
    ],
  },
  {
    title: 'Extras',
    body: 'Find richer posts when you need more context.',
    options: [
      { label: 'Has images', value: 'extra:hasImages', body: 'Posts with uploaded media' },
      { label: 'Includes wallet money', value: 'extra:hasMoney', body: 'Money-enabled trades only' },
    ],
  },
];

const allowedTradeFilterValues = new Set(tradeFilterGroups.flatMap((group) => group.options.map((option) => option.value)));

type ReadonlyURLSearchParams = Pick<URLSearchParams, 'get'>;

export function toggleTradeFilterValue(values: string[], value: string) {
  if (!allowedTradeFilterValues.has(value)) return values;
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function normalizeTradeSearchQuery(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function tradeSearchQueryFromSearchParams(searchParams: URLSearchParams | ReadonlyURLSearchParams) {
  return normalizeTradeSearchQuery(searchParams.get('q'));
}

export function tradeFiltersFromSearchParams(searchParams: URLSearchParams | ReadonlyURLSearchParams): TradeFeedFilters {
  const postType = searchParams.get('postType');
  const mode = searchParams.get('mode');
  return {
    q: tradeSearchQueryFromSearchParams(searchParams),
    mode: mode === 'remote' || mode === 'local' || mode === 'hybrid' ? mode : '',
    postType: postType === 'need_offer' || postType === 'open_need' || postType === 'open_offer' ? postType : '',
    hasImages: searchParams.get('hasImages') === '1' || searchParams.get('hasImages') === 'true',
    hasMoney: searchParams.get('hasMoney') === '1' || searchParams.get('hasMoney') === 'true',
  };
}

export function tradeFilterValuesFromFilters(filters: TradeFeedFilters) {
  const values: string[] = [];
  if (filters.postType) values.push(`postType:${filters.postType}`);
  if (filters.mode) values.push(`mode:${filters.mode}`);
  if (filters.hasImages) values.push('extra:hasImages');
  if (filters.hasMoney) values.push('extra:hasMoney');
  return values;
}

export function tradeFiltersFromValues(values: string[], query?: string | null): TradeFeedFilters {
  const filters: TradeFeedFilters = { ...initialTradeFilters, q: normalizeTradeSearchQuery(query) };
  for (const value of values) {
    if (!allowedTradeFilterValues.has(value)) continue;
    const [key, option] = value.split(':');
    if (key === 'postType' && (option === 'need_offer' || option === 'open_need' || option === 'open_offer')) filters.postType = option;
    if (key === 'mode' && (option === 'remote' || option === 'local' || option === 'hybrid')) filters.mode = option;
    if (key === 'extra' && option === 'hasImages') filters.hasImages = true;
    if (key === 'extra' && option === 'hasMoney') filters.hasMoney = true;
  }
  return filters;
}

export function activeTradeFilterCount(filters: TradeFeedFilters) {
  return tradeFilterValuesFromFilters(filters).length + (normalizeTradeSearchQuery(filters.q) ? 1 : 0);
}

export function buildTradeFilterSearchParams(filters: TradeFeedFilters) {
  const params = new URLSearchParams();
  const normalizedQuery = normalizeTradeSearchQuery(filters.q);
  if (normalizedQuery) params.set('q', normalizedQuery);
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.postType) params.set('postType', filters.postType);
  if (filters.hasImages) params.set('hasImages', '1');
  if (filters.hasMoney) params.set('hasMoney', '1');
  return params;
}

export function buildTradeFilterHref(path: string, filters: TradeFeedFilters) {
  const params = buildTradeFilterSearchParams(filters);
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export function tradeFilterSummary(filters: TradeFeedFilters) {
  const parts: string[] = [];
  const normalizedQuery = normalizeTradeSearchQuery(filters.q);
  if (normalizedQuery) parts.push(`Search: “${normalizedQuery}”`);
  if (filters.postType) parts.push(filters.postType === 'need_offer' ? 'Full trades' : filters.postType === 'open_need' ? 'Open needs' : 'Open offers');
  if (filters.mode) parts.push(filters.mode.charAt(0).toUpperCase() + filters.mode.slice(1));
  if (filters.hasImages) parts.push('Has images');
  if (filters.hasMoney) parts.push('Includes wallet money');
  return parts.join(' · ');
}
