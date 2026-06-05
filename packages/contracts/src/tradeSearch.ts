import { z } from 'zod';
import { discoveryLanguageSchema } from './trade.js';

export const tradeSearchKeywordSourceSchema = z.enum(['submitted', 'suggestion_clicked']);
export const tradeSearchSuggestionSourceSchema = z.enum(['keyword', 'category', 'tag']);

export const tradeSearchQuerySchema = z.string().trim().min(2).max(120);

export const listTradeSearchSuggestionsQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  language: discoveryLanguageSchema.optional(),
  countryCode: z.string().trim().min(2).max(2).transform((value) => value.toUpperCase()).optional(),
  take: z.coerce.number().int().min(1).max(20).optional().default(8),
});

export const recordTradeSearchKeywordRequestSchema = z.object({
  q: tradeSearchQuerySchema,
  source: tradeSearchKeywordSourceSchema.optional().default('submitted'),
  resultCount: z.number().int().min(0).max(100000).optional().default(0),
  language: discoveryLanguageSchema.optional(),
  countryCode: z.string().trim().min(2).max(2).transform((value) => value.toUpperCase()).optional(),
});

export const tradeSearchSuggestionSchema = z.object({
  query: z.string(),
  source: tradeSearchSuggestionSourceSchema,
  score: z.number(),
  totalCount: z.number().int().min(0).optional(),
});

export const tradeSearchKeywordSchema = z.object({
  id: z.string(),
  normalizedQuery: z.string(),
  displayQuery: z.string(),
  language: discoveryLanguageSchema.nullable().optional(),
  countryCode: z.string().nullable().optional(),
  totalCount: z.number().int().min(0),
  successfulCount: z.number().int().min(0),
  suggestionClickCount: z.number().int().min(0),
  lastResultCount: z.number().int().min(0),
  lastSearchedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const tradeSearchSuggestionsResponseSchema = z.object({ suggestions: z.array(tradeSearchSuggestionSchema) });
export const tradeSearchKeywordResponseSchema = z.object({ keyword: tradeSearchKeywordSchema });

export type TradeSearchKeywordSource = z.infer<typeof tradeSearchKeywordSourceSchema>;
export type TradeSearchSuggestionSource = z.infer<typeof tradeSearchSuggestionSourceSchema>;
export type ListTradeSearchSuggestionsQuery = z.infer<typeof listTradeSearchSuggestionsQuerySchema>;
export type RecordTradeSearchKeywordRequest = z.infer<typeof recordTradeSearchKeywordRequestSchema>;
export type TradeSearchSuggestion = z.infer<typeof tradeSearchSuggestionSchema>;
export type TradeSearchKeywordDto = z.infer<typeof tradeSearchKeywordSchema>;
export type TradeSearchSuggestionsResponse = z.infer<typeof tradeSearchSuggestionsResponseSchema>;
export type TradeSearchKeywordResponse = z.infer<typeof tradeSearchKeywordResponseSchema>;
