import { z } from 'zod';
export declare const planStatusSchema: z.ZodEnum<{
    draft: "draft";
    expired: "expired";
    completed: "completed";
    cancelled: "cancelled";
    open: "open";
    full: "full";
    started: "started";
    hidden: "hidden";
}>;
export declare const planPublicStatusSchema: z.ZodEnum<{
    open: "open";
    full: "full";
    started: "started";
    cancelled: "cancelled";
}>;
export declare const planJoinApprovalModeSchema: z.ZodEnum<{
    owner_approval: "owner_approval";
    automatic: "automatic";
}>;
export declare const planParticipantStatusSchema: z.ZodEnum<{
    removed: "removed";
    accepted: "accepted";
    cancelled: "cancelled";
    pending: "pending";
    declined: "declined";
    left: "left";
}>;
export declare const planPlaceModeSchema: z.ZodEnum<{
    remote: "remote";
    local: "local";
}>;
export declare const planOwnerParticipantActionSchema: z.ZodEnum<{
    removed: "removed";
    accepted: "accepted";
    declined: "declined";
}>;
export declare const planSelfParticipantActionSchema: z.ZodEnum<{
    cancelled: "cancelled";
    left: "left";
}>;
export declare const planPlaceInputSchema: z.ZodObject<{
    mode: z.ZodOptional<z.ZodEnum<{
        remote: "remote";
        local: "local";
    }>>;
    title: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    addressPublicText: z.ZodOptional<z.ZodString>;
    addressPrivateText: z.ZodOptional<z.ZodString>;
    startsAt: z.ZodOptional<z.ZodString>;
    endsAt: z.ZodOptional<z.ZodString>;
    order: z.ZodOptional<z.ZodNumber>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const createPlanRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    mode: z.ZodOptional<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>;
    locationLabel: z.ZodOptional<z.ZodString>;
    startsAt: z.ZodString;
    endsAt: z.ZodOptional<z.ZodString>;
    maxParticipants: z.ZodOptional<z.ZodNumber>;
    joinApprovalMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        owner_approval: "owner_approval";
        automatic: "automatic";
    }>>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        open: "open";
    }>>>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    places: z.ZodOptional<z.ZodArray<z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<{
            remote: "remote";
            local: "local";
        }>>;
        title: z.ZodString;
        note: z.ZodOptional<z.ZodString>;
        addressPublicText: z.ZodOptional<z.ZodString>;
        addressPrivateText: z.ZodOptional<z.ZodString>;
        startsAt: z.ZodOptional<z.ZodString>;
        endsAt: z.ZodOptional<z.ZodString>;
        order: z.ZodOptional<z.ZodNumber>;
        mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const updatePlanRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>>;
    locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startsAt: z.ZodOptional<z.ZodString>;
    endsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maxParticipants: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    joinApprovalMode: z.ZodOptional<z.ZodEnum<{
        owner_approval: "owner_approval";
        automatic: "automatic";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        cancelled: "cancelled";
        open: "open";
    }>>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const createPlanPlaceRequestSchema: z.ZodObject<{
    mode: z.ZodOptional<z.ZodEnum<{
        remote: "remote";
        local: "local";
    }>>;
    title: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    addressPublicText: z.ZodOptional<z.ZodString>;
    addressPrivateText: z.ZodOptional<z.ZodString>;
    startsAt: z.ZodOptional<z.ZodString>;
    endsAt: z.ZodOptional<z.ZodString>;
    order: z.ZodOptional<z.ZodNumber>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const updatePlanPlaceRequestSchema: z.ZodObject<{
    mode: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
        remote: "remote";
        local: "local";
    }>>>;
    title: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    addressPublicText: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    addressPrivateText: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    startsAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    endsAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    order: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    mediaIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
}, z.core.$strip>;
export declare const listPlansQuerySchema: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        open: "open";
        full: "full";
        started: "started";
    }>>;
    city: z.ZodOptional<z.ZodString>;
    take: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const createPlanJoinRequestSchema: z.ZodObject<{
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updatePlanParticipantRequestSchema: z.ZodObject<{
    status: z.ZodEnum<{
        removed: "removed";
        accepted: "accepted";
        declined: "declined";
    }>;
}, z.core.$strip>;
export declare const updateMyPlanParticipantRequestSchema: z.ZodObject<{
    status: z.ZodEnum<{
        cancelled: "cancelled";
        left: "left";
    }>;
}, z.core.$strip>;
export declare const planPlaceSchema: z.ZodObject<{
    id: z.ZodString;
    planId: z.ZodString;
    order: z.ZodNumber;
    mode: z.ZodDefault<z.ZodEnum<{
        remote: "remote";
        local: "local";
    }>>;
    title: z.ZodString;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    addressPublicText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    addressPrivateText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
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
}, z.core.$loose>;
export declare const planParticipantSchema: z.ZodObject<{
    id: z.ZodString;
    planId: z.ZodString;
    userId: z.ZodString;
    message: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodEnum<{
        removed: "removed";
        accepted: "accepted";
        cancelled: "cancelled";
        pending: "pending";
        declined: "declined";
        left: "left";
    }>;
    decidedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    decidedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    user: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
export declare const planSchema: z.ZodObject<{
    id: z.ZodString;
    ownerId: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        remote: "remote";
        local: "local";
        hybrid: "hybrid";
    }>>>;
    locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startsAt: z.ZodString;
    endsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maxParticipants: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    joinApprovalMode: z.ZodEnum<{
        owner_approval: "owner_approval";
        automatic: "automatic";
    }>;
    status: z.ZodEnum<{
        draft: "draft";
        expired: "expired";
        completed: "completed";
        cancelled: "cancelled";
        open: "open";
        full: "full";
        started: "started";
        hidden: "hidden";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    cancelledAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    owner: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$loose>>>;
    places: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        planId: z.ZodString;
        order: z.ZodNumber;
        mode: z.ZodDefault<z.ZodEnum<{
            remote: "remote";
            local: "local";
        }>>;
        title: z.ZodString;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        addressPublicText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        addressPrivateText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        startsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
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
    participants: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        planId: z.ZodString;
        userId: z.ZodString;
        message: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodEnum<{
            removed: "removed";
            accepted: "accepted";
            cancelled: "cancelled";
            pending: "pending";
            declined: "declined";
            left: "left";
        }>;
        decidedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        decidedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        user: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    participantCount: z.ZodOptional<z.ZodNumber>;
    pendingRequestCount: z.ZodOptional<z.ZodNumber>;
    myParticipantStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        removed: "removed";
        accepted: "accepted";
        cancelled: "cancelled";
        pending: "pending";
        declined: "declined";
        left: "left";
    }>>>;
    canSeePrivatePlaceDetails: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export declare const plansResponseSchema: z.ZodObject<{
    plans: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            remote: "remote";
            local: "local";
            hybrid: "hybrid";
        }>>>;
        locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        startsAt: z.ZodString;
        endsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        maxParticipants: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        joinApprovalMode: z.ZodEnum<{
            owner_approval: "owner_approval";
            automatic: "automatic";
        }>;
        status: z.ZodEnum<{
            draft: "draft";
            expired: "expired";
            completed: "completed";
            cancelled: "cancelled";
            open: "open";
            full: "full";
            started: "started";
            hidden: "hidden";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        cancelledAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        owner: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$loose>>>;
        places: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            planId: z.ZodString;
            order: z.ZodNumber;
            mode: z.ZodDefault<z.ZodEnum<{
                remote: "remote";
                local: "local";
            }>>;
            title: z.ZodString;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            addressPublicText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            addressPrivateText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            endsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
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
        participants: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            planId: z.ZodString;
            userId: z.ZodString;
            message: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            status: z.ZodEnum<{
                removed: "removed";
                accepted: "accepted";
                cancelled: "cancelled";
                pending: "pending";
                declined: "declined";
                left: "left";
            }>;
            decidedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            decidedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
            user: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                id: z.ZodString;
                profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$strip>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
        participantCount: z.ZodOptional<z.ZodNumber>;
        pendingRequestCount: z.ZodOptional<z.ZodNumber>;
        myParticipantStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            removed: "removed";
            accepted: "accepted";
            cancelled: "cancelled";
            pending: "pending";
            declined: "declined";
            left: "left";
        }>>>;
        canSeePrivatePlaceDetails: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>;
}, z.core.$strip>;
export declare const planResponseSchema: z.ZodObject<{
    plan: z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            remote: "remote";
            local: "local";
            hybrid: "hybrid";
        }>>>;
        locationLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        startsAt: z.ZodString;
        endsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        maxParticipants: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        joinApprovalMode: z.ZodEnum<{
            owner_approval: "owner_approval";
            automatic: "automatic";
        }>;
        status: z.ZodEnum<{
            draft: "draft";
            expired: "expired";
            completed: "completed";
            cancelled: "cancelled";
            open: "open";
            full: "full";
            started: "started";
            hidden: "hidden";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        cancelledAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        owner: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$loose>>>;
        places: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            planId: z.ZodString;
            order: z.ZodNumber;
            mode: z.ZodDefault<z.ZodEnum<{
                remote: "remote";
                local: "local";
            }>>;
            title: z.ZodString;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            addressPublicText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            addressPrivateText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            endsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
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
        participants: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            planId: z.ZodString;
            userId: z.ZodString;
            message: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            status: z.ZodEnum<{
                removed: "removed";
                accepted: "accepted";
                cancelled: "cancelled";
                pending: "pending";
                declined: "declined";
                left: "left";
            }>;
            decidedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            decidedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
            user: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                id: z.ZodString;
                profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$strip>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
        participantCount: z.ZodOptional<z.ZodNumber>;
        pendingRequestCount: z.ZodOptional<z.ZodNumber>;
        myParticipantStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            removed: "removed";
            accepted: "accepted";
            cancelled: "cancelled";
            pending: "pending";
            declined: "declined";
            left: "left";
        }>>>;
        canSeePrivatePlaceDetails: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>;
}, z.core.$strip>;
export declare const planParticipantResponseSchema: z.ZodObject<{
    participant: z.ZodObject<{
        id: z.ZodString;
        planId: z.ZodString;
        userId: z.ZodString;
        message: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodEnum<{
            removed: "removed";
            accepted: "accepted";
            cancelled: "cancelled";
            pending: "pending";
            declined: "declined";
            left: "left";
        }>;
        decidedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        decidedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        user: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>;
}, z.core.$strip>;
export declare const planParticipantsResponseSchema: z.ZodObject<{
    participants: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        planId: z.ZodString;
        userId: z.ZodString;
        message: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodEnum<{
            removed: "removed";
            accepted: "accepted";
            cancelled: "cancelled";
            pending: "pending";
            declined: "declined";
            left: "left";
        }>;
        decidedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        decidedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        user: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                countryCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>;
}, z.core.$strip>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type PlanJoinApprovalMode = z.infer<typeof planJoinApprovalModeSchema>;
export type PlanParticipantStatus = z.infer<typeof planParticipantStatusSchema>;
export type PlanPlaceMode = z.infer<typeof planPlaceModeSchema>;
export type CreatePlanRequest = z.infer<typeof createPlanRequestSchema>;
export type UpdatePlanRequest = z.infer<typeof updatePlanRequestSchema>;
export type CreatePlanPlaceRequest = z.infer<typeof createPlanPlaceRequestSchema>;
export type UpdatePlanPlaceRequest = z.infer<typeof updatePlanPlaceRequestSchema>;
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;
export type CreatePlanJoinRequest = z.infer<typeof createPlanJoinRequestSchema>;
export type UpdatePlanParticipantRequest = z.infer<typeof updatePlanParticipantRequestSchema>;
export type UpdateMyPlanParticipantRequest = z.infer<typeof updateMyPlanParticipantRequestSchema>;
export type PlanDto = z.infer<typeof planSchema>;
export type PlanPlaceDto = z.infer<typeof planPlaceSchema>;
export type PlanParticipantDto = z.infer<typeof planParticipantSchema>;
export type PlanResponse = z.infer<typeof planResponseSchema>;
export type PlansResponse = z.infer<typeof plansResponseSchema>;
export type PlanParticipantResponse = z.infer<typeof planParticipantResponseSchema>;
export type PlanParticipantsResponse = z.infer<typeof planParticipantsResponseSchema>;
//# sourceMappingURL=plans.d.ts.map