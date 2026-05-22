import { z } from 'zod';
export declare const needStatusSchema: z.ZodEnum<{
    active: "active";
    draft: "draft";
    fulfilled: "fulfilled";
    closed: "closed";
    expired: "expired";
}>;
export declare const offerStatusSchema: z.ZodEnum<{
    active: "active";
    draft: "draft";
    closed: "closed";
    expired: "expired";
    accepted: "accepted";
}>;
export declare const tradePostTypeSchema: z.ZodEnum<{
    need_offer: "need_offer";
    open_need: "open_need";
    open_offer: "open_offer";
}>;
export declare const tradeStatusSchema: z.ZodEnum<{
    active: "active";
    draft: "draft";
    closed: "closed";
    expired: "expired";
    funded: "funded";
    in_progress: "in_progress";
    submitted: "submitted";
    completed: "completed";
    disputed: "disputed";
    cancelled: "cancelled";
}>;
export declare const tradeActionStatusSchema: z.ZodEnum<{
    active: "active";
    in_progress: "in_progress";
    submitted: "submitted";
    completed: "completed";
    disputed: "disputed";
    cancelled: "cancelled";
}>;
export declare const proposalStatusSchema: z.ZodEnum<{
    accepted: "accepted";
    pending: "pending";
    declined: "declined";
    withdrawn: "withdrawn";
}>;
export declare const proposalActionStatusSchema: z.ZodEnum<{
    accepted: "accepted";
    declined: "declined";
    withdrawn: "withdrawn";
}>;
export declare const tradeExchangeModeSchema: z.ZodEnum<{
    remote: "remote";
    local: "local";
    hybrid: "hybrid";
}>;
export declare const discoveryLanguageSchema: z.ZodEnum<{
    en: "en";
    fr: "fr";
}>;
export declare const inventoryItemTypeSchema: z.ZodEnum<{
    service: "service";
    goods: "goods";
    other: "other";
}>;
export declare const inventoryTemplateKindSchema: z.ZodEnum<{
    need: "need";
    offer: "offer";
}>;
export declare const inventoryTemplateSourceTypeSchema: z.ZodEnum<{
    hellowhen: "hellowhen";
    business: "business";
    brand: "brand";
    partner: "partner";
}>;
export declare const inventoryTemplateStatusSchema: z.ZodEnum<{
    active: "active";
    draft: "draft";
    archived: "archived";
}>;
export declare const cloneInventoryTemplateStatusSchema: z.ZodEnum<{
    active: "active";
    draft: "draft";
}>;
export declare const tradeNeedSideKindSchema: z.ZodEnum<{
    need: "need";
    money: "money";
}>;
export declare const tradeOfferSideKindSchema: z.ZodEnum<{
    offer: "offer";
    money: "money";
}>;
export { INVENTORY_DESCRIPTION_MAX_LENGTH, INVENTORY_DESCRIPTION_MIN_LENGTH, INVENTORY_TITLE_MAX_LENGTH, INVENTORY_TITLE_MIN_LENGTH } from './inventoryLimits.js';
export declare const createNeedRequestSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        draft: "draft";
        fulfilled: "fulfilled";
        closed: "closed";
        expired: "expired";
    }>>;
    expiresAt: z.ZodOptional<z.ZodString>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        service: "service";
        goods: "goods";
        other: "other";
    }>>>;
    category: z.ZodOptional<z.ZodString>;
    timing: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>;
    locationLabel: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const createOfferRequestSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        draft: "draft";
        closed: "closed";
        expired: "expired";
        accepted: "accepted";
    }>>;
    expiresAt: z.ZodOptional<z.ZodString>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        service: "service";
        goods: "goods";
        other: "other";
    }>>>;
    category: z.ZodOptional<z.ZodString>;
    availability: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>;
    locationLabel: z.ZodOptional<z.ZodString>;
    includes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const createTradeRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    creditAmount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    amountCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    postType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        need_offer: "need_offer";
        open_need: "open_need";
        open_offer: "open_offer";
    }>>>;
    needKind: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        need: "need";
        money: "money";
    }>>>;
    offerKind: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        offer: "offer";
        money: "money";
    }>>>;
    needId: z.ZodOptional<z.ZodString>;
    offerId: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodString>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const updateNeedRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    itemType: z.ZodOptional<z.ZodEnum<{
        service: "service";
        goods: "goods";
        other: "other";
    }>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timing: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    availability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>>;
    locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    includes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        draft: "draft";
        fulfilled: "fulfilled";
        closed: "closed";
        expired: "expired";
    }>>;
}, z.core.$strip>;
export declare const updateOfferRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    itemType: z.ZodOptional<z.ZodEnum<{
        service: "service";
        goods: "goods";
        other: "other";
    }>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timing: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    availability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>>;
    locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    includes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        draft: "draft";
        closed: "closed";
        expired: "expired";
        accepted: "accepted";
    }>>;
}, z.core.$strip>;
export declare const listInventoryTemplatesQuerySchema: z.ZodObject<{
    kind: z.ZodOptional<z.ZodEnum<{
        need: "need";
        offer: "offer";
    }>>;
    itemType: z.ZodOptional<z.ZodEnum<{
        service: "service";
        goods: "goods";
        other: "other";
    }>>;
    sourceType: z.ZodOptional<z.ZodEnum<{
        hellowhen: "hellowhen";
        business: "business";
        brand: "brand";
        partner: "partner";
    }>>;
    businessProfileId: z.ZodOptional<z.ZodString>;
    q: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodEnum<{
        en: "en";
        fr: "fr";
    }>>;
    countryCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    take: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const cloneInventoryTemplateRequestSchema: z.ZodObject<{
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        active: "active";
        draft: "draft";
    }>>>;
}, z.core.$strip>;
export declare const listTradesFeedQuerySchema: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodEnum<{
        en: "en";
        fr: "fr";
    }>>;
    countryCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    mode: z.ZodOptional<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>;
    category: z.ZodOptional<z.ZodString>;
    hasImages: z.ZodOptional<z.ZodCoercedBoolean<unknown>>;
    hasMoney: z.ZodOptional<z.ZodCoercedBoolean<unknown>>;
    postType: z.ZodOptional<z.ZodEnum<{
        need_offer: "need_offer";
        open_need: "open_need";
        open_offer: "open_offer";
    }>>;
    refreshSeed: z.ZodOptional<z.ZodString>;
    seenTradeIds: z.ZodPreprocess<z.ZodPipe<z.ZodOptional<z.ZodArray<z.ZodString>>, z.ZodTransform<string[] | undefined, string[] | undefined>>>;
    take: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const updateTradeStatusRequestSchema: z.ZodObject<{
    status: z.ZodEnum<{
        active: "active";
        in_progress: "in_progress";
        submitted: "submitted";
        completed: "completed";
        disputed: "disputed";
        cancelled: "cancelled";
    }>;
}, z.core.$strip>;
export declare const adminTradeDisputeActionRequestSchema: z.ZodObject<{
    action: z.ZodEnum<{
        refund_payer: "refund_payer";
        release_seller: "release_seller";
        mark_resolved: "mark_resolved";
    }>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createTradeProposalRequestSchema: z.ZodObject<{
    message: z.ZodString;
    proposedNeedId: z.ZodOptional<z.ZodString>;
    proposedOfferId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateProposalStatusRequestSchema: z.ZodObject<{
    status: z.ZodEnum<{
        accepted: "accepted";
        declined: "declined";
        withdrawn: "withdrawn";
    }>;
}, z.core.$strip>;
export declare const createProposalMessageRequestSchema: z.ZodObject<{
    body: z.ZodString;
}, z.core.$strip>;
export declare const profilePreviewSchema: z.ZodOptional<z.ZodNullable<z.ZodObject<{
    displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>>>;
export declare const userPreviewSchema: z.ZodObject<{
    id: z.ZodString;
    profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const needSchema: z.ZodObject<{
    id: z.ZodString;
    ownerId: z.ZodString;
    sourceTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    title: z.ZodString;
    description: z.ZodString;
    itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        service: "service";
        goods: "goods";
        other: "other";
    }>>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timing: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>>;
    locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodEnum<{
        active: "active";
        draft: "draft";
        fulfilled: "fulfilled";
        closed: "closed";
        expired: "expired";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    media: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            need: "need";
            offer: "offer";
            trade: "trade";
            profile: "profile";
            support_ticket: "support_ticket";
            support_message: "support_message";
            plan: "plan";
            plan_place: "plan_place";
        }>>>;
        entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        url: z.ZodString;
        storageKey: z.ZodString;
        filename: z.ZodString;
        mimeType: z.ZodString;
        sizeBytes: z.ZodNumber;
        status: z.ZodEnum<{
            active: "active";
            flagged: "flagged";
            removed: "removed";
            pending_review: "pending_review";
        }>;
        reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodOptional<z.ZodString>;
        owner: z.ZodOptional<z.ZodUnknown>;
        reviewer: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const offerSchema: z.ZodObject<{
    id: z.ZodString;
    ownerId: z.ZodString;
    sourceTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    title: z.ZodString;
    description: z.ZodString;
    itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        service: "service";
        goods: "goods";
        other: "other";
    }>>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    availability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>>;
    locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    includes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodEnum<{
        active: "active";
        draft: "draft";
        closed: "closed";
        expired: "expired";
        accepted: "accepted";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    media: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            need: "need";
            offer: "offer";
            trade: "trade";
            profile: "profile";
            support_ticket: "support_ticket";
            support_message: "support_message";
            plan: "plan";
            plan_place: "plan_place";
        }>>>;
        entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        url: z.ZodString;
        storageKey: z.ZodString;
        filename: z.ZodString;
        mimeType: z.ZodString;
        sizeBytes: z.ZodNumber;
        status: z.ZodEnum<{
            active: "active";
            flagged: "flagged";
            removed: "removed";
            pending_review: "pending_review";
        }>;
        reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodOptional<z.ZodString>;
        owner: z.ZodOptional<z.ZodUnknown>;
        reviewer: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const inventoryTemplateBusinessProfileSchema: z.ZodOptional<z.ZodNullable<z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
}, z.core.$loose>>>;
export declare const inventoryTemplateSchema: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    kind: z.ZodEnum<{
        need: "need";
        offer: "offer";
    }>;
    sourceType: z.ZodEnum<{
        hellowhen: "hellowhen";
        business: "business";
        brand: "brand";
        partner: "partner";
    }>;
    businessProfileId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    languageCode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        en: "en";
        fr: "fr";
    }>>>;
    countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    title: z.ZodString;
    description: z.ZodString;
    itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        service: "service";
        goods: "goods";
        other: "other";
    }>>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timing: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    availability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>>;
    locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    includes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodEnum<{
        active: "active";
        draft: "draft";
        archived: "archived";
    }>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    businessProfile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>>;
}, z.core.$strip>;
export declare const cloneInventoryTemplateResponseSchema: z.ZodObject<{
    template: z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        kind: z.ZodEnum<{
            need: "need";
            offer: "offer";
        }>;
        sourceType: z.ZodEnum<{
            hellowhen: "hellowhen";
            business: "business";
            brand: "brand";
            partner: "partner";
        }>;
        businessProfileId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        languageCode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            en: "en";
            fr: "fr";
        }>>>;
        countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        description: z.ZodString;
        itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            service: "service";
            goods: "goods";
            other: "other";
        }>>>;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        timing: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        availability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            remote: "remote";
            local: "local";
            hybrid: "hybrid";
        }>>>;
        locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        includes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            archived: "archived";
        }>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        businessProfile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            displayName: z.ZodString;
            handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            type: z.ZodOptional<z.ZodString>;
            status: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>>;
    }, z.core.$strip>;
    need: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        sourceTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        description: z.ZodString;
        itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            service: "service";
            goods: "goods";
            other: "other";
        }>>>;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        timing: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            remote: "remote";
            local: "local";
            hybrid: "hybrid";
        }>>>;
        locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            fulfilled: "fulfilled";
            closed: "closed";
            expired: "expired";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        media: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                need: "need";
                offer: "offer";
                trade: "trade";
                profile: "profile";
                support_ticket: "support_ticket";
                support_message: "support_message";
                plan: "plan";
                plan_place: "plan_place";
            }>>>;
            entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            url: z.ZodString;
            storageKey: z.ZodString;
            filename: z.ZodString;
            mimeType: z.ZodString;
            sizeBytes: z.ZodNumber;
            status: z.ZodEnum<{
                active: "active";
                flagged: "flagged";
                removed: "removed";
                pending_review: "pending_review";
            }>;
            reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodOptional<z.ZodString>;
            owner: z.ZodOptional<z.ZodUnknown>;
            reviewer: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    offer: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        sourceTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        description: z.ZodString;
        itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            service: "service";
            goods: "goods";
            other: "other";
        }>>>;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        availability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            remote: "remote";
            local: "local";
            hybrid: "hybrid";
        }>>>;
        locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        includes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            closed: "closed";
            expired: "expired";
            accepted: "accepted";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        media: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                need: "need";
                offer: "offer";
                trade: "trade";
                profile: "profile";
                support_ticket: "support_ticket";
                support_message: "support_message";
                plan: "plan";
                plan_place: "plan_place";
            }>>>;
            entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            url: z.ZodString;
            storageKey: z.ZodString;
            filename: z.ZodString;
            mimeType: z.ZodString;
            sizeBytes: z.ZodNumber;
            status: z.ZodEnum<{
                active: "active";
                flagged: "flagged";
                removed: "removed";
                pending_review: "pending_review";
            }>;
            reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodOptional<z.ZodString>;
            owner: z.ZodOptional<z.ZodUnknown>;
            reviewer: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const tradePaymentSchema: z.ZodObject<{
    id: z.ZodString;
    tradeId: z.ZodOptional<z.ZodString>;
    buyerId: z.ZodString;
    sellerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    creditAmount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    amountCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    platformFee: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    platformFeeCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    status: z.ZodString;
}, z.core.$loose>;
export declare const tradeEscrowSchema: z.ZodObject<{
    id: z.ZodString;
    tradeId: z.ZodOptional<z.ZodString>;
    heldCredits: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    heldAmountCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    holdReleasedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export declare const tradeSchema: z.ZodObject<{
    id: z.ZodString;
    ownerId: z.ZodString;
    providerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    needId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    offerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    title: z.ZodString;
    description: z.ZodString;
    creditAmount: z.ZodNumber;
    amountCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    postType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        need_offer: "need_offer";
        open_need: "open_need";
        open_offer: "open_offer";
    }>>>;
    status: z.ZodEnum<{
        active: "active";
        draft: "draft";
        closed: "closed";
        expired: "expired";
        funded: "funded";
        in_progress: "in_progress";
        submitted: "submitted";
        completed: "completed";
        disputed: "disputed";
        cancelled: "cancelled";
    }>;
    isPublic: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    closedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    deliverySubmittedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    deliverySubmittedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    confirmedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    confirmedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    disputedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    disputedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    disputeTicketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    owner: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    provider: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    need: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        sourceTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        description: z.ZodString;
        itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            service: "service";
            goods: "goods";
            other: "other";
        }>>>;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        timing: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            remote: "remote";
            local: "local";
            hybrid: "hybrid";
        }>>>;
        locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            fulfilled: "fulfilled";
            closed: "closed";
            expired: "expired";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        media: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                need: "need";
                offer: "offer";
                trade: "trade";
                profile: "profile";
                support_ticket: "support_ticket";
                support_message: "support_message";
                plan: "plan";
                plan_place: "plan_place";
            }>>>;
            entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            url: z.ZodString;
            storageKey: z.ZodString;
            filename: z.ZodString;
            mimeType: z.ZodString;
            sizeBytes: z.ZodNumber;
            status: z.ZodEnum<{
                active: "active";
                flagged: "flagged";
                removed: "removed";
                pending_review: "pending_review";
            }>;
            reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodOptional<z.ZodString>;
            owner: z.ZodOptional<z.ZodUnknown>;
            reviewer: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    offer: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        sourceTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        description: z.ZodString;
        itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            service: "service";
            goods: "goods";
            other: "other";
        }>>>;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        availability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            remote: "remote";
            local: "local";
            hybrid: "hybrid";
        }>>>;
        locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        includes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            closed: "closed";
            expired: "expired";
            accepted: "accepted";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        media: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                need: "need";
                offer: "offer";
                trade: "trade";
                profile: "profile";
                support_ticket: "support_ticket";
                support_message: "support_message";
                plan: "plan";
                plan_place: "plan_place";
            }>>>;
            entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            url: z.ZodString;
            storageKey: z.ZodString;
            filename: z.ZodString;
            mimeType: z.ZodString;
            sizeBytes: z.ZodNumber;
            status: z.ZodEnum<{
                active: "active";
                flagged: "flagged";
                removed: "removed";
                pending_review: "pending_review";
            }>;
            reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodOptional<z.ZodString>;
            owner: z.ZodOptional<z.ZodUnknown>;
            reviewer: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    payment: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        tradeId: z.ZodOptional<z.ZodString>;
        buyerId: z.ZodString;
        sellerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        creditAmount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        amountCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        platformFee: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        platformFeeCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        status: z.ZodString;
    }, z.core.$loose>>>;
    escrow: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        tradeId: z.ZodOptional<z.ZodString>;
        heldCredits: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        heldAmountCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        holdReleasedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    media: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            need: "need";
            offer: "offer";
            trade: "trade";
            profile: "profile";
            support_ticket: "support_ticket";
            support_message: "support_message";
            plan: "plan";
            plan_place: "plan_place";
        }>>>;
        entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        url: z.ZodString;
        storageKey: z.ZodString;
        filename: z.ZodString;
        mimeType: z.ZodString;
        sizeBytes: z.ZodNumber;
        status: z.ZodEnum<{
            active: "active";
            flagged: "flagged";
            removed: "removed";
            pending_review: "pending_review";
        }>;
        reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodOptional<z.ZodString>;
        owner: z.ZodOptional<z.ZodUnknown>;
        reviewer: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const proposalMessageSchema: z.ZodObject<{
    id: z.ZodString;
    proposalId: z.ZodString;
    senderId: z.ZodString;
    body: z.ZodString;
    createdAt: z.ZodString;
    sender: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const tradeProposalSchema: z.ZodObject<{
    id: z.ZodString;
    tradeId: z.ZodString;
    applicantId: z.ZodString;
    proposedNeedId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    proposedOfferId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    message: z.ZodString;
    status: z.ZodEnum<{
        accepted: "accepted";
        pending: "pending";
        declined: "declined";
        withdrawn: "withdrawn";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    respondedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    applicant: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    trade: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        providerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        needId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        offerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        description: z.ZodString;
        creditAmount: z.ZodNumber;
        amountCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        postType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            need_offer: "need_offer";
            open_need: "open_need";
            open_offer: "open_offer";
        }>>>;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            closed: "closed";
            expired: "expired";
            funded: "funded";
            in_progress: "in_progress";
            submitted: "submitted";
            completed: "completed";
            disputed: "disputed";
            cancelled: "cancelled";
        }>;
        isPublic: z.ZodBoolean;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        closedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        deliverySubmittedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        deliverySubmittedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        confirmedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        confirmedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        disputedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        disputedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        disputeTicketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        owner: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        provider: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        need: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            sourceTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            title: z.ZodString;
            description: z.ZodString;
            itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                service: "service";
                goods: "goods";
                other: "other";
            }>>>;
            category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            timing: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                remote: "remote";
                local: "local";
                hybrid: "hybrid";
            }>>>;
            locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
            status: z.ZodEnum<{
                active: "active";
                draft: "draft";
                fulfilled: "fulfilled";
                closed: "closed";
                expired: "expired";
            }>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
            expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            media: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                ownerId: z.ZodString;
                entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    need: "need";
                    offer: "offer";
                    trade: "trade";
                    profile: "profile";
                    support_ticket: "support_ticket";
                    support_message: "support_message";
                    plan: "plan";
                    plan_place: "plan_place";
                }>>>;
                entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                url: z.ZodString;
                storageKey: z.ZodString;
                filename: z.ZodString;
                mimeType: z.ZodString;
                sizeBytes: z.ZodNumber;
                status: z.ZodEnum<{
                    active: "active";
                    flagged: "flagged";
                    removed: "removed";
                    pending_review: "pending_review";
                }>;
                reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                createdAt: z.ZodString;
                updatedAt: z.ZodOptional<z.ZodString>;
                owner: z.ZodOptional<z.ZodUnknown>;
                reviewer: z.ZodOptional<z.ZodUnknown>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        offer: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            sourceTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            title: z.ZodString;
            description: z.ZodString;
            itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                service: "service";
                goods: "goods";
                other: "other";
            }>>>;
            category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            availability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                remote: "remote";
                local: "local";
                hybrid: "hybrid";
            }>>>;
            locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            includes: z.ZodOptional<z.ZodArray<z.ZodString>>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
            status: z.ZodEnum<{
                active: "active";
                draft: "draft";
                closed: "closed";
                expired: "expired";
                accepted: "accepted";
            }>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
            expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            media: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                ownerId: z.ZodString;
                entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    need: "need";
                    offer: "offer";
                    trade: "trade";
                    profile: "profile";
                    support_ticket: "support_ticket";
                    support_message: "support_message";
                    plan: "plan";
                    plan_place: "plan_place";
                }>>>;
                entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                url: z.ZodString;
                storageKey: z.ZodString;
                filename: z.ZodString;
                mimeType: z.ZodString;
                sizeBytes: z.ZodNumber;
                status: z.ZodEnum<{
                    active: "active";
                    flagged: "flagged";
                    removed: "removed";
                    pending_review: "pending_review";
                }>;
                reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                createdAt: z.ZodString;
                updatedAt: z.ZodOptional<z.ZodString>;
                owner: z.ZodOptional<z.ZodUnknown>;
                reviewer: z.ZodOptional<z.ZodUnknown>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        payment: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            tradeId: z.ZodOptional<z.ZodString>;
            buyerId: z.ZodString;
            sellerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            creditAmount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            amountCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
            platformFee: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            platformFeeCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            status: z.ZodString;
        }, z.core.$loose>>>;
        escrow: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            tradeId: z.ZodOptional<z.ZodString>;
            heldCredits: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            heldAmountCents: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
            holdReleasedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        media: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                need: "need";
                offer: "offer";
                trade: "trade";
                profile: "profile";
                support_ticket: "support_ticket";
                support_message: "support_message";
                plan: "plan";
                plan_place: "plan_place";
            }>>>;
            entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            url: z.ZodString;
            storageKey: z.ZodString;
            filename: z.ZodString;
            mimeType: z.ZodString;
            sizeBytes: z.ZodNumber;
            status: z.ZodEnum<{
                active: "active";
                flagged: "flagged";
                removed: "removed";
                pending_review: "pending_review";
            }>;
            reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodOptional<z.ZodString>;
            owner: z.ZodOptional<z.ZodUnknown>;
            reviewer: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    proposedNeed: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        sourceTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        description: z.ZodString;
        itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            service: "service";
            goods: "goods";
            other: "other";
        }>>>;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        timing: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            remote: "remote";
            local: "local";
            hybrid: "hybrid";
        }>>>;
        locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            fulfilled: "fulfilled";
            closed: "closed";
            expired: "expired";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        media: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                need: "need";
                offer: "offer";
                trade: "trade";
                profile: "profile";
                support_ticket: "support_ticket";
                support_message: "support_message";
                plan: "plan";
                plan_place: "plan_place";
            }>>>;
            entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            url: z.ZodString;
            storageKey: z.ZodString;
            filename: z.ZodString;
            mimeType: z.ZodString;
            sizeBytes: z.ZodNumber;
            status: z.ZodEnum<{
                active: "active";
                flagged: "flagged";
                removed: "removed";
                pending_review: "pending_review";
            }>;
            reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodOptional<z.ZodString>;
            owner: z.ZodOptional<z.ZodUnknown>;
            reviewer: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    proposedOffer: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        sourceTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        description: z.ZodString;
        itemType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            service: "service";
            goods: "goods";
            other: "other";
        }>>>;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        availability: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            remote: "remote";
            local: "local";
            hybrid: "hybrid";
        }>>>;
        locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        includes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            closed: "closed";
            expired: "expired";
            accepted: "accepted";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        media: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                need: "need";
                offer: "offer";
                trade: "trade";
                profile: "profile";
                support_ticket: "support_ticket";
                support_message: "support_message";
                plan: "plan";
                plan_place: "plan_place";
            }>>>;
            entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            url: z.ZodString;
            storageKey: z.ZodString;
            filename: z.ZodString;
            mimeType: z.ZodString;
            sizeBytes: z.ZodNumber;
            status: z.ZodEnum<{
                active: "active";
                flagged: "flagged";
                removed: "removed";
                pending_review: "pending_review";
            }>;
            reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodOptional<z.ZodString>;
            owner: z.ZodOptional<z.ZodUnknown>;
            reviewer: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    messages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        proposalId: z.ZodString;
        senderId: z.ZodString;
        body: z.ZodString;
        createdAt: z.ZodString;
        sender: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type NeedDto = z.infer<typeof needSchema>;
export type OfferDto = z.infer<typeof offerSchema>;
export type InventoryTemplateDto = z.infer<typeof inventoryTemplateSchema>;
export type CloneInventoryTemplateResponse = z.infer<typeof cloneInventoryTemplateResponseSchema>;
export type TradeDto = z.infer<typeof tradeSchema>;
export type TradePostType = z.infer<typeof tradePostTypeSchema>;
export type TradeStatus = z.infer<typeof tradeStatusSchema>;
export type TradeActionStatus = z.infer<typeof tradeActionStatusSchema>;
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;
export type ProposalActionStatus = z.infer<typeof proposalActionStatusSchema>;
export type TradeExchangeMode = z.infer<typeof tradeExchangeModeSchema>;
export type DiscoveryLanguage = z.infer<typeof discoveryLanguageSchema>;
export type InventoryItemType = z.infer<typeof inventoryItemTypeSchema>;
export type InventoryTemplateKind = z.infer<typeof inventoryTemplateKindSchema>;
export type InventoryTemplateSourceType = z.infer<typeof inventoryTemplateSourceTypeSchema>;
export type InventoryTemplateStatus = z.infer<typeof inventoryTemplateStatusSchema>;
export type TradeNeedSideKind = z.infer<typeof tradeNeedSideKindSchema>;
export type TradeOfferSideKind = z.infer<typeof tradeOfferSideKindSchema>;
export type TradeProposalDto = z.infer<typeof tradeProposalSchema>;
export type ProposalMessageDto = z.infer<typeof proposalMessageSchema>;
export type CreateNeedRequest = z.infer<typeof createNeedRequestSchema>;
export type CreateOfferRequest = z.infer<typeof createOfferRequestSchema>;
export type CreateTradeRequest = z.infer<typeof createTradeRequestSchema>;
export type UpdateNeedRequest = z.infer<typeof updateNeedRequestSchema>;
export type UpdateOfferRequest = z.infer<typeof updateOfferRequestSchema>;
export type ListInventoryTemplatesQuery = z.infer<typeof listInventoryTemplatesQuerySchema>;
export type CloneInventoryTemplateRequest = z.infer<typeof cloneInventoryTemplateRequestSchema>;
export type ListTradesFeedQuery = z.infer<typeof listTradesFeedQuerySchema>;
export type UpdateTradeStatusRequest = z.infer<typeof updateTradeStatusRequestSchema>;
export type AdminTradeDisputeActionRequest = z.infer<typeof adminTradeDisputeActionRequestSchema>;
export type CreateTradeProposalRequest = z.infer<typeof createTradeProposalRequestSchema>;
export type UpdateProposalStatusRequest = z.infer<typeof updateProposalStatusRequestSchema>;
export type CreateProposalMessageRequest = z.infer<typeof createProposalMessageRequestSchema>;
//# sourceMappingURL=trade.d.ts.map