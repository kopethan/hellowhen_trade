import { z } from 'zod';
import { userTrustTierSchema, walletLimitsSchema } from './wallet.js';
export const adminProfilePreviewSchema = z.object({
    displayName: z.string().nullable().optional(),
    handle: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    countryCode: z.string().nullable().optional(),
    preferredCurrency: z.string().nullable().optional(),
}).passthrough().nullable().optional();
export const adminWalletPreviewSchema = z.object({
    availableBalanceCents: z.number().int().optional(),
    heldBalanceCents: z.number().int().optional(),
    pendingPayoutCents: z.number().int().optional(),
    currency: z.string().optional(),
}).passthrough().nullable().optional();
export const adminUserPreviewSchema = z.object({
    id: z.string(),
    email: z.string(),
    role: z.enum(['user', 'admin']).optional(),
    trustTier: userTrustTierSchema.optional(),
    emailVerifiedAt: z.string().nullable().optional(),
    ageConfirmedAt: z.string().nullable().optional(),
    declaredAgeBucket: z.string().nullable().optional(),
    twoFactorEnabled: z.boolean().optional(),
    createdAt: z.string().optional(),
    profile: adminProfilePreviewSchema,
}).passthrough();
export const adminUserSummarySchema = z.object({
    id: z.string(),
    email: z.string(),
    role: z.enum(['user', 'admin']),
    trustTier: userTrustTierSchema,
    trustTierUpdatedAt: z.string().nullable().optional(),
    trustTierNote: z.string().nullable().optional(),
    emailVerifiedAt: z.string().nullable().optional(),
    ageConfirmedAt: z.string().nullable().optional(),
    declaredAgeBucket: z.string().nullable().optional(),
    createdAt: z.string(),
    lastLoginAt: z.string().nullable().optional(),
    profile: adminProfilePreviewSchema,
    wallet: adminWalletPreviewSchema,
    _count: z.object({ needs: z.number().int(), offers: z.number().int(), trades: z.number().int(), supportTickets: z.number().int(), mediaAssets: z.number().int() }).optional(),
    limits: walletLimitsSchema.optional(),
}).passthrough();
export const adminSupportTicketPreviewSchema = z.object({
    id: z.string(),
    subject: z.string(),
    status: z.string(),
    priority: z.string(),
    category: z.string(),
    createdAt: z.string().optional(),
    updatedAt: z.string(),
    user: adminUserPreviewSchema.nullable().optional(),
    _count: z.object({ messages: z.number().int().optional() }).optional(),
}).passthrough();
export const adminAuditLogSchema = z.object({
    id: z.string(),
    adminId: z.string(),
    action: z.string(),
    targetType: z.string(),
    targetId: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    previousValue: z.unknown().optional(),
    nextValue: z.unknown().optional(),
    metadata: z.unknown().optional(),
    createdAt: z.string(),
    admin: adminUserPreviewSchema.nullable().optional(),
}).passthrough();
export const adminOverviewResponseSchema = z.object({
    summary: z.object({
        users: z.object({ total: z.number().int(), new24h: z.number().int(), new7d: z.number().int(), admins: z.number().int(), restricted: z.number().int() }),
        content: z.object({ activeTrades: z.number().int(), disputedTrades: z.number().int(), activeNeeds: z.number().int(), activeOffers: z.number().int() }),
        support: z.object({ open: z.number().int(), urgent: z.number().int() }),
        reports: z.object({ pending: z.number().int(), reviewing: z.number().int() }),
        media: z.object({ pendingReview: z.number().int(), flagged: z.number().int() }),
        money: z.object({
            moneyFeaturesVisible: z.boolean(),
            walletVisible: z.boolean(),
            payoutsVisible: z.boolean(),
            moneyTradesEnabled: z.boolean(),
            realMoneyEnabled: z.boolean(),
            moneyProvider: z.string(),
            moneyProviderEnvironment: z.string(),
        }),
    }),
    recentUsers: z.array(adminUserSummarySchema).default([]),
    recentTickets: z.array(adminSupportTicketPreviewSchema).default([]),
    recentAuditLogs: z.array(adminAuditLogSchema).default([]),
});
export const adminUsersResponseSchema = z.object({
    users: z.array(adminUserSummarySchema),
});
export const adminAuditLogResponseSchema = z.object({
    logs: z.array(adminAuditLogSchema),
});
export const adminUserModerationActionRequestSchema = z.object({
    action: z.enum(['suspend', 'restore', 'mark_reviewed', 'force_logout']),
    note: z.string().trim().min(3).max(1200).optional(),
    trustTier: userTrustTierSchema.optional(),
});
export const adminContentTypeSchema = z.enum(['trade', 'need', 'offer']);
export const adminContentActionRequestSchema = z.object({
    action: z.enum(['hide', 'restore', 'close', 'mark_reviewed']),
    note: z.string().trim().min(3).max(1200).optional(),
});
export const adminListContentQuerySchema = z.object({
    type: z.enum(['all', 'trade', 'need', 'offer']).optional().default('all'),
    q: z.string().trim().min(1).max(120).optional(),
    ownerId: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).max(40).optional(),
    take: z.coerce.number().int().min(1).max(250).optional().default(100),
});
export const adminContentOwnerSchema = adminUserPreviewSchema.passthrough().nullable().optional();
export const adminContentItemSchema = z.object({
    id: z.string(),
    type: adminContentTypeSchema,
    ownerId: z.string(),
    title: z.string(),
    description: z.string().optional().default(''),
    status: z.string(),
    isPublic: z.boolean().optional(),
    postType: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    itemType: z.string().nullable().optional(),
    mode: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    expiresAt: z.string().nullable().optional(),
    closedAt: z.string().nullable().optional(),
    owner: adminContentOwnerSchema,
    mediaCount: z.number().int().optional().default(0),
    proposalCount: z.number().int().optional().default(0),
    linkedTradeCount: z.number().int().optional().default(0),
    publicDiscoverable: z.boolean().optional(),
    visibilityBlockers: z.array(z.string()).optional().default([]),
}).passthrough();
export const adminContentResponseSchema = z.object({
    content: z.array(adminContentItemSchema),
});
export const adminContentActionResponseSchema = z.object({
    item: adminContentItemSchema,
});
export const adminLaunchChecklistItemSchema = z.object({
    id: z.string(),
    label: z.string(),
    status: z.enum(['pass', 'warning', 'fail']),
    detail: z.string(),
    action: z.string().optional(),
});
export const adminLaunchChecklistResponseSchema = z.object({
    overallStatus: z.enum(['pass', 'warning', 'fail']),
    generatedAt: z.string(),
    items: z.array(adminLaunchChecklistItemSchema),
    summary: z.object({
        pass: z.number().int(),
        warning: z.number().int(),
        fail: z.number().int(),
    }),
});
export const adminRuntimeQaCheckSchema = z.object({
    id: z.string(),
    label: z.string(),
    status: z.enum(['pass', 'warning', 'fail']),
    detail: z.string(),
    action: z.string().optional(),
});
export const adminRuntimeQaResponseSchema = z.object({
    overallStatus: z.enum(['pass', 'warning', 'fail']),
    generatedAt: z.string(),
    launchMode: z.object({
        nodeEnv: z.string(),
        moneyLaunchMode: z.string(),
        moneyFeaturesVisible: z.boolean(),
        walletVisible: z.boolean(),
        payoutsVisible: z.boolean(),
        moneyTradesEnabled: z.boolean(),
        realMoneyEnabled: z.boolean(),
        adminRequireTwoFactor: z.boolean(),
    }),
    counts: z.object({
        restrictedUsersWithOpenSessions: z.number().int(),
        activePublicMoneyTradesWhileMoneyOff: z.number().int(),
        publicVisibilityLeaks: z.number().int(),
        pendingReports: z.number().int(),
        urgentSupportTickets: z.number().int(),
        pendingOrFlaggedMedia: z.number().int(),
    }),
    checks: z.array(adminRuntimeQaCheckSchema),
    rehearsal: z.array(z.object({
        step: z.number().int(),
        label: z.string(),
        expected: z.string(),
        operatorAction: z.string().optional(),
    })),
    summary: z.object({
        pass: z.number().int(),
        warning: z.number().int(),
        fail: z.number().int(),
    }),
});
export const adminModerationSmokeResponseSchema = z.object({
    checks: z.object({
        restrictedOwnersHiddenFromFeed: z.boolean(),
        closedNeedsHiddenFromFeed: z.boolean(),
        closedOffersHiddenFromFeed: z.boolean(),
        publicFeedUsesDiscoverableFilter: z.boolean(),
    }),
    counts: z.object({
        feedEligibleTrades: z.number().int(),
        feedEligibleRestrictedOwnerTrades: z.number().int(),
        feedEligibleClosedNeedTrades: z.number().int(),
        feedEligibleClosedOfferTrades: z.number().int(),
        publicTradesOwnedByRestrictedUsers: z.number().int(),
        publicTradesWithClosedNeeds: z.number().int(),
        publicTradesWithClosedOffers: z.number().int(),
        restrictedUsers: z.number().int(),
        activeNeedsOwnedByRestrictedUsers: z.number().int(),
        activeOffersOwnedByRestrictedUsers: z.number().int(),
    }),
    samples: z.object({
        publicTradesOwnedByRestrictedUsers: z.array(adminContentItemSchema).default([]),
        publicTradesWithClosedInventory: z.array(adminContentItemSchema).default([]),
    }),
});
//# sourceMappingURL=admin.js.map