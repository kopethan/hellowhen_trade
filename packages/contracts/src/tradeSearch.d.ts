import { z } from 'zod';
export declare const tradeSearchKeywordSourceSchema: z.ZodEnum<{
    submitted: "submitted";
    suggestion_clicked: "suggestion_clicked";
}>;
export declare const tradeSearchSuggestionSourceSchema: z.ZodEnum<{
    keyword: "keyword";
    category: "category";
    tag: "tag";
}>;
export declare const tradeSearchQuerySchema: z.ZodString;
export declare const listTradeSearchSuggestionsQuerySchema: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodEnum<{
        en: "en";
        fr: "fr";
    }>>;
    countryCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    take: z.ZodDefault<z.ZodCoercedNumber<number>>;
}, z.core.$strip>;
export declare const recordTradeSearchKeywordRequestSchema: z.ZodObject<{
    q: z.ZodString;
    source: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        submitted: "submitted";
        suggestion_clicked: "suggestion_clicked";
    }>>>;
    resultCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    language: z.ZodOptional<z.ZodEnum<{
        en: "en";
        fr: "fr";
    }>>;
    countryCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
}, z.core.$strip>;
export declare const tradeSearchSuggestionSchema: z.ZodObject<{
    query: z.ZodString;
    source: z.ZodEnum<{
        keyword: "keyword";
        category: "category";
        tag: "tag";
    }>;
    score: z.ZodNumber;
    totalCount: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const tradeSearchKeywordSchema: z.ZodObject<{
    id: z.ZodString;
    normalizedQuery: z.ZodString;
    displayQuery: z.ZodString;
    language: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        en: "en";
        fr: "fr";
    }>>>;
    countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    totalCount: z.ZodNumber;
    successfulCount: z.ZodNumber;
    suggestionClickCount: z.ZodNumber;
    lastResultCount: z.ZodNumber;
    lastSearchedAt: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const tradeSearchSuggestionsResponseSchema: z.ZodObject<{
    suggestions: z.ZodArray<z.ZodObject<{
        query: z.ZodString;
        source: z.ZodEnum<{
            keyword: "keyword";
            category: "category";
            tag: "tag";
        }>;
        score: z.ZodNumber;
        totalCount: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const tradeSearchKeywordResponseSchema: z.ZodObject<{
    keyword: z.ZodObject<{
        id: z.ZodString;
        normalizedQuery: z.ZodString;
        displayQuery: z.ZodString;
        language: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            en: "en";
            fr: "fr";
        }>>>;
        countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        totalCount: z.ZodNumber;
        successfulCount: z.ZodNumber;
        suggestionClickCount: z.ZodNumber;
        lastResultCount: z.ZodNumber;
        lastSearchedAt: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type TradeSearchKeywordSource = z.infer<typeof tradeSearchKeywordSourceSchema>;
export type TradeSearchSuggestionSource = z.infer<typeof tradeSearchSuggestionSourceSchema>;
export type ListTradeSearchSuggestionsQuery = z.infer<typeof listTradeSearchSuggestionsQuerySchema>;
export type RecordTradeSearchKeywordRequest = z.infer<typeof recordTradeSearchKeywordRequestSchema>;
export type TradeSearchSuggestion = z.infer<typeof tradeSearchSuggestionSchema>;
export type TradeSearchKeywordDto = z.infer<typeof tradeSearchKeywordSchema>;
export type TradeSearchSuggestionsResponse = z.infer<typeof tradeSearchSuggestionsResponseSchema>;
export type TradeSearchKeywordResponse = z.infer<typeof tradeSearchKeywordResponseSchema>;
//# sourceMappingURL=tradeSearch.d.ts.map
