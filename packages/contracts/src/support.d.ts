import { z } from 'zod';
export declare const supportTicketCategorySchema: z.ZodEnum<{
    general_feedback: "general_feedback";
    trade_issue: "trade_issue";
    credits_issue: "credits_issue";
    media_issue: "media_issue";
    bug_report: "bug_report";
    account_issue: "account_issue";
    account_recovery: "account_recovery";
    safety_concern: "safety_concern";
}>;
export declare const supportTicketStatusSchema: z.ZodEnum<{
    closed: "closed";
    open: "open";
    in_review: "in_review";
    waiting_for_user: "waiting_for_user";
    resolved: "resolved";
}>;
export declare const supportTicketPrioritySchema: z.ZodEnum<{
    low: "low";
    normal: "normal";
    high: "high";
    urgent: "urgent";
}>;
export declare const supportMessageSenderRoleSchema: z.ZodEnum<{
    user: "user";
    admin: "admin";
    system: "system";
}>;
export declare const createSupportTicketRequestSchema: z.ZodObject<{
    category: z.ZodEnum<{
        general_feedback: "general_feedback";
        trade_issue: "trade_issue";
        credits_issue: "credits_issue";
        media_issue: "media_issue";
        bug_report: "bug_report";
        account_issue: "account_issue";
        account_recovery: "account_recovery";
        safety_concern: "safety_concern";
    }>;
    subject: z.ZodString;
    message: z.ZodString;
    priority: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        low: "low";
        normal: "normal";
        high: "high";
        urgent: "urgent";
    }>>>;
    relatedTradeId: z.ZodOptional<z.ZodString>;
    relatedProposalId: z.ZodOptional<z.ZodString>;
    relatedMediaId: z.ZodOptional<z.ZodString>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const createGuestSupportTicketRequestSchema: z.ZodObject<{
    email: z.ZodString;
    accountEmail: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    category: z.ZodEnum<{
        general_feedback: "general_feedback";
        bug_report: "bug_report";
        account_issue: "account_issue";
        account_recovery: "account_recovery";
        safety_concern: "safety_concern";
    }>;
    subject: z.ZodString;
    message: z.ZodString;
}, z.core.$strip>;
export declare const createSupportMessageRequestSchema: z.ZodObject<{
    body: z.ZodString;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const updateSupportTicketStatusRequestSchema: z.ZodObject<{
    status: z.ZodEnum<{
        closed: "closed";
        open: "open";
        in_review: "in_review";
        waiting_for_user: "waiting_for_user";
        resolved: "resolved";
    }>;
}, z.core.$strip>;
export declare const adminUpdateSupportTicketRequestSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<{
        closed: "closed";
        open: "open";
        in_review: "in_review";
        waiting_for_user: "waiting_for_user";
        resolved: "resolved";
    }>>;
    priority: z.ZodOptional<z.ZodEnum<{
        low: "low";
        normal: "normal";
        high: "high";
        urgent: "urgent";
    }>>;
    assignedAdminId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const adminCreateSupportMessageRequestSchema: z.ZodObject<{
    body: z.ZodString;
    internal: z.ZodOptional<z.ZodBoolean>;
    status: z.ZodOptional<z.ZodEnum<{
        closed: "closed";
        open: "open";
        in_review: "in_review";
        waiting_for_user: "waiting_for_user";
        resolved: "resolved";
    }>>;
    mediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const supportUserPreviewSchema: z.ZodOptional<z.ZodNullable<z.ZodObject<{
    id: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>>>;
export declare const supportTicketMessageSchema: z.ZodObject<{
    id: z.ZodString;
    ticketId: z.ZodString;
    senderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    senderRole: z.ZodEnum<{
        user: "user";
        admin: "admin";
        system: "system";
    }>;
    body: z.ZodString;
    internal: z.ZodBoolean;
    createdAt: z.ZodString;
    sender: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>>;
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
export declare const supportTicketSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodEnum<{
        general_feedback: "general_feedback";
        trade_issue: "trade_issue";
        credits_issue: "credits_issue";
        media_issue: "media_issue";
        bug_report: "bug_report";
        account_issue: "account_issue";
        account_recovery: "account_recovery";
        safety_concern: "safety_concern";
    }>;
    subject: z.ZodString;
    message: z.ZodString;
    status: z.ZodEnum<{
        closed: "closed";
        open: "open";
        in_review: "in_review";
        waiting_for_user: "waiting_for_user";
        resolved: "resolved";
    }>;
    priority: z.ZodEnum<{
        low: "low";
        normal: "normal";
        high: "high";
        urgent: "urgent";
    }>;
    relatedTradeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    relatedProposalId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    relatedMediaId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    assignedAdminId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    guestEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    guestAccountEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    guestName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    resolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    user: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>>;
    assignedAdmin: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>>;
    messages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ticketId: z.ZodString;
        senderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        senderRole: z.ZodEnum<{
            user: "user";
            admin: "admin";
            system: "system";
        }>;
        body: z.ZodString;
        internal: z.ZodBoolean;
        createdAt: z.ZodString;
        sender: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            email: z.ZodOptional<z.ZodString>;
            profile: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                handle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>>;
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
export type SupportTicketCategory = z.infer<typeof supportTicketCategorySchema>;
export type SupportTicketStatus = z.infer<typeof supportTicketStatusSchema>;
export type SupportTicketPriority = z.infer<typeof supportTicketPrioritySchema>;
export type SupportMessageSenderRole = z.infer<typeof supportMessageSenderRoleSchema>;
export type CreateSupportTicketRequest = z.infer<typeof createSupportTicketRequestSchema>;
export type CreateGuestSupportTicketRequest = z.infer<typeof createGuestSupportTicketRequestSchema>;
export type CreateSupportMessageRequest = z.infer<typeof createSupportMessageRequestSchema>;
export type UpdateSupportTicketStatusRequest = z.infer<typeof updateSupportTicketStatusRequestSchema>;
export type AdminUpdateSupportTicketRequest = z.infer<typeof adminUpdateSupportTicketRequestSchema>;
export type AdminCreateSupportMessageRequest = z.infer<typeof adminCreateSupportMessageRequestSchema>;
export type SupportTicketDto = z.infer<typeof supportTicketSchema>;
export type SupportTicketMessageDto = z.infer<typeof supportTicketMessageSchema>;
//# sourceMappingURL=support.d.ts.map