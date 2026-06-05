import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  listTradeSearchSuggestionsQuerySchema,
  recordTradeSearchKeywordRequestSchema,
  type TradeSearchSuggestionSource,
} from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';

export const tradeSearchRoutes = Router();

const MIN_SUGGESTION_QUERY_LENGTH = 2;
const MAX_CONTENT_TERM_SCAN = 80;
const suggestionsRateLimit = createRateLimiter({ keyPrefix: 'trade-search-suggestions', windowMs: 60_000, max: 120 });
const recordRateLimit = createRateLimiter({ keyPrefix: 'trade-search-record', windowMs: 60_000, max: 60 });

type SuggestionCandidate = {
  query: string;
  source: TradeSearchSuggestionSource;
  score: number;
  totalCount?: number;
};

function cleanSearchQuery(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function normalizeSearchQueryKey(value: string) {
  return cleanSearchQuery(value)
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toKeywordDto(keyword: {
  id: string;
  normalizedQuery: string;
  displayQuery: string;
  language: string | null;
  countryCode: string | null;
  totalCount: number;
  successfulCount: number;
  suggestionClickCount: number;
  lastResultCount: number;
  lastSearchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: keyword.id,
    normalizedQuery: keyword.normalizedQuery,
    displayQuery: keyword.displayQuery,
    language: keyword.language,
    countryCode: keyword.countryCode,
    totalCount: keyword.totalCount,
    successfulCount: keyword.successfulCount,
    suggestionClickCount: keyword.suggestionClickCount,
    lastResultCount: keyword.lastResultCount,
    lastSearchedAt: keyword.lastSearchedAt.toISOString(),
    createdAt: keyword.createdAt.toISOString(),
    updatedAt: keyword.updatedAt.toISOString(),
  };
}

function containsText(value: string) {
  return { contains: value, mode: 'insensitive' as const };
}

function getMatchBoost(queryKey: string, termKey: string) {
  if (termKey === queryKey) return 100;
  if (termKey.startsWith(queryKey)) return 48;
  if (termKey.includes(queryKey)) return 24;
  return 0;
}

function addSuggestion(map: Map<string, SuggestionCandidate>, candidate: SuggestionCandidate) {
  const query = cleanSearchQuery(candidate.query);
  const key = normalizeSearchQueryKey(query);
  if (key.length < MIN_SUGGESTION_QUERY_LENGTH || query.length > 120) return;

  const existing = map.get(key);
  if (!existing || candidate.score > existing.score) map.set(key, { ...candidate, query });
}

function addContentTermSuggestion(
  map: Map<string, SuggestionCandidate>,
  queryKey: string,
  value: string | null | undefined,
  source: TradeSearchSuggestionSource,
  baseScore: number,
) {
  if (!value) return;
  const display = cleanSearchQuery(value);
  const termKey = normalizeSearchQueryKey(display);
  const boost = getMatchBoost(queryKey, termKey);
  if (!boost) return;
  addSuggestion(map, { query: display, source, score: baseScore + boost });
}

tradeSearchRoutes.get('/suggestions', optionalAuth, suggestionsRateLimit, asyncRoute(async (req, res) => {
  const input = listTradeSearchSuggestionsQuerySchema.parse(req.query);
  const displayQuery = cleanSearchQuery(input.q ?? '');
  const queryKey = normalizeSearchQueryKey(displayQuery);

  if (queryKey.length < MIN_SUGGESTION_QUERY_LENGTH) return res.json({ suggestions: [] });

  const [keywords, needs, offers] = await Promise.all([
    prisma.tradeSearchKeyword.findMany({
      where: {
        OR: [
          { normalizedQuery: { contains: queryKey } },
          { displayQuery: containsText(displayQuery) },
        ],
      },
      orderBy: [{ totalCount: 'desc' }, { successfulCount: 'desc' }, { lastSearchedAt: 'desc' }],
      take: input.take * 3,
    }),
    prisma.need.findMany({
      where: {
        status: 'active',
        owner: { trustTier: { not: 'restricted' } },
        OR: [
          { category: containsText(displayQuery) },
          { title: containsText(displayQuery) },
          { description: containsText(displayQuery) },
        ],
      },
      select: { category: true, tags: true },
      orderBy: { updatedAt: 'desc' },
      take: MAX_CONTENT_TERM_SCAN,
    }),
    prisma.offer.findMany({
      where: {
        status: 'active',
        owner: { trustTier: { not: 'restricted' } },
        OR: [
          { category: containsText(displayQuery) },
          { title: containsText(displayQuery) },
          { description: containsText(displayQuery) },
        ],
      },
      select: { category: true, tags: true },
      orderBy: { updatedAt: 'desc' },
      take: MAX_CONTENT_TERM_SCAN,
    }),
  ]);

  const suggestions = new Map<string, SuggestionCandidate>();

  for (const keyword of keywords) {
    const termKey = normalizeSearchQueryKey(keyword.displayQuery);
    const boost = getMatchBoost(queryKey, termKey);
    if (!boost) continue;
    const localeBoost = (input.language && keyword.language === input.language ? 8 : 0)
      + (input.countryCode && keyword.countryCode === input.countryCode ? 6 : 0);
    addSuggestion(suggestions, {
      query: keyword.displayQuery,
      source: 'keyword',
      totalCount: keyword.totalCount,
      score: boost + localeBoost + keyword.totalCount * 3 + keyword.successfulCount * 5 + keyword.suggestionClickCount * 2,
    });
  }

  for (const need of needs) {
    addContentTermSuggestion(suggestions, queryKey, need.category, 'category', 18);
    for (const tag of need.tags) addContentTermSuggestion(suggestions, queryKey, tag, 'tag', 12);
  }

  for (const offer of offers) {
    addContentTermSuggestion(suggestions, queryKey, offer.category, 'category', 18);
    for (const tag of offer.tags) addContentTermSuggestion(suggestions, queryKey, tag, 'tag', 12);
  }

  const result = [...suggestions.values()]
    .sort((left, right) => right.score - left.score || left.query.localeCompare(right.query))
    .slice(0, input.take);

  return res.json({ suggestions: result });
}));

tradeSearchRoutes.post('/keywords', optionalAuth, recordRateLimit, asyncRoute(async (req, res) => {
  const input = recordTradeSearchKeywordRequestSchema.parse(req.body ?? {});
  const displayQuery = cleanSearchQuery(input.q);
  const normalizedQuery = normalizeSearchQueryKey(displayQuery);

  if (normalizedQuery.length < MIN_SUGGESTION_QUERY_LENGTH) {
    return res.status(400).json({ error: 'search_query_too_short', message: 'Search query must be at least 2 characters.' });
  }

  const now = new Date();
  const updateData: Prisma.TradeSearchKeywordUpdateInput = {
    displayQuery,
    language: input.language ?? null,
    countryCode: input.countryCode ?? null,
    totalCount: { increment: 1 },
    lastResultCount: input.resultCount,
    lastSearchedAt: now,
  };
  if (input.resultCount > 0) updateData.successfulCount = { increment: 1 };
  if (input.source === 'suggestion_clicked') updateData.suggestionClickCount = { increment: 1 };

  const keyword = await prisma.tradeSearchKeyword.upsert({
    where: { normalizedQuery },
    create: {
      normalizedQuery,
      displayQuery,
      language: input.language ?? null,
      countryCode: input.countryCode ?? null,
      totalCount: 1,
      successfulCount: input.resultCount > 0 ? 1 : 0,
      suggestionClickCount: input.source === 'suggestion_clicked' ? 1 : 0,
      lastResultCount: input.resultCount,
      lastSearchedAt: now,
    },
    update: updateData,
  });

  return res.status(201).json({ keyword: toKeywordDto(keyword) });
}));
