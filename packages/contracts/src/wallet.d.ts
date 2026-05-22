import { z } from 'zod';
export declare const userTrustTierSchema: z.ZodEnum<{
    new: "new";
    email_verified: "email_verified";
    stripe_verified: "stripe_verified";
    trusted: "trusted";
    restricted: "restricted";
}>;
export declare const moneyLaunchModeSchema: z.ZodEnum<{
    disabled: "disabled";
    demo: "demo";
    private_beta: "private_beta";
    production: "production";
}>;
export declare const moneyProviderSchema: z.ZodEnum<{
    none: "none";
    stripe: "stripe";
    airwallex: "airwallex";
}>;
export declare const moneyProviderEnvironmentSchema: z.ZodEnum<{
    demo: "demo";
    production: "production";
    none: "none";
    test: "test";
}>;
export declare const moneyProviderCapabilitySchema: z.ZodEnum<{
    connected_accounts: "connected_accounts";
    onboarding_links: "onboarding_links";
    wallet_balances: "wallet_balances";
    payins: "payins";
    trade_holds: "trade_holds";
    platform_fees: "platform_fees";
    payouts: "payouts";
    webhooks: "webhooks";
    refunds: "refunds";
    disputes: "disputes";
}>;
export declare const moneySafetyStatusSchema: z.ZodObject<{
    launchMode: z.ZodEnum<{
        disabled: "disabled";
        demo: "demo";
        private_beta: "private_beta";
        production: "production";
    }>;
    moneyProvider: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        none: "none";
        stripe: "stripe";
        airwallex: "airwallex";
    }>>>;
    moneyProviderEnvironment: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        demo: "demo";
        production: "production";
        none: "none";
        test: "test";
    }>>>;
    moneyProviderConfigured: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    moneyProviderSandboxOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    moneyProviderCapabilities: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        connected_accounts: "connected_accounts";
        onboarding_links: "onboarding_links";
        wallet_balances: "wallet_balances";
        payins: "payins";
        trade_holds: "trade_holds";
        platform_fees: "platform_fees";
        payouts: "payouts";
        webhooks: "webhooks";
        refunds: "refunds";
        disputes: "disputes";
    }>>>>;
    policyVersion: z.ZodString;
    walletTermsVersion: z.ZodString;
    payoutTermsVersion: z.ZodString;
    refundPolicyVersion: z.ZodString;
    disputePolicyVersion: z.ZodString;
    policyAcknowledgementRequired: z.ZodBoolean;
    policyAcknowledged: z.ZodBoolean;
    acknowledgedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    privateBetaAllowed: z.ZodBoolean;
    requiresManualPayoutReview: z.ZodBoolean;
    moneyFeaturesVisible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    walletVisible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    payoutsVisible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    moneyTradesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    cashTradesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    realMoneyEnabled: z.ZodBoolean;
    demoMoneyEnabled: z.ZodBoolean;
    providerTradeMoneyEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    providerTransfersEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    providerWalletSyncEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    stripeTransfersEnabled: z.ZodBoolean;
    productionSwitchEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    privateBetaAllowlistCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    message: z.ZodString;
}, z.core.$strip>;
export declare const acknowledgeMoneySafetyRequestSchema: z.ZodObject<{
    accepted: z.ZodLiteral<true>;
}, z.core.$strip>;
export declare const adminUpdateTrustTierRequestSchema: z.ZodObject<{
    trustTier: z.ZodEnum<{
        new: "new";
        email_verified: "email_verified";
        stripe_verified: "stripe_verified";
        trusted: "trusted";
        restricted: "restricted";
    }>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const walletLimitsSchema: z.ZodObject<{
    trustTier: z.ZodEnum<{
        new: "new";
        email_verified: "email_verified";
        stripe_verified: "stripe_verified";
        trusted: "trusted";
        restricted: "restricted";
    }>;
    effectiveTrustTier: z.ZodEnum<{
        new: "new";
        email_verified: "email_verified";
        stripe_verified: "stripe_verified";
        trusted: "trusted";
        restricted: "restricted";
    }>;
    serviceActiveTradeLimit: z.ZodNumber;
    moneyActiveTradeLimit: z.ZodNumber;
    perTradeMoneyCapCents: z.ZodNumber;
    walletBalanceCapCents: z.ZodNumber;
    weeklyPayoutCapCents: z.ZodNumber;
    minimumPayoutCents: z.ZodNumber;
    payoutsEnabled: z.ZodBoolean;
    moneyTradesEnabled: z.ZodBoolean;
    walletTopUpsEnabled: z.ZodBoolean;
    activeServiceTradeCount: z.ZodDefault<z.ZodNumber>;
    activeMoneyTradeCount: z.ZodDefault<z.ZodNumber>;
    walletExposureCents: z.ZodDefault<z.ZodNumber>;
    weeklyRequestedPayoutGrossCents: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const walletSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    purchasedAvailableCredits: z.ZodNumber;
    earnedPendingCredits: z.ZodNumber;
    earnedAvailableCredits: z.ZodNumber;
    heldCredits: z.ZodNumber;
    availableBalanceCents: z.ZodDefault<z.ZodNumber>;
    heldBalanceCents: z.ZodDefault<z.ZodNumber>;
    pendingPayoutCents: z.ZodDefault<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const ledgerEntrySchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    walletId: z.ZodString;
    tradeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodEnum<{
        starting_demo_credits: "starting_demo_credits";
        test_credit_grant: "test_credit_grant";
        credit_purchase: "credit_purchase";
        trade_hold: "trade_hold";
        trade_release: "trade_release";
        trade_refund: "trade_refund";
        earned_pending: "earned_pending";
        platform_fee: "platform_fee";
        platform_fee_placeholder: "platform_fee_placeholder";
        payout_requested: "payout_requested";
        payout_paid: "payout_paid";
        adjustment: "adjustment";
    }>;
    balanceType: z.ZodEnum<{
        earned_pending: "earned_pending";
        purchased: "purchased";
        earned_available: "earned_available";
        held: "held";
    }>;
    amount: z.ZodNumber;
    amountCents: z.ZodDefault<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const demoTopUpRequestSchema: z.ZodObject<{
    amountCents: z.ZodNumber;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const demoPayoutRequestSchema: z.ZodObject<{
    amountCents: z.ZodNumber;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const payoutRequestStatusSchema: z.ZodEnum<{
    draft: "draft";
    cancelled: "cancelled";
    requested: "requested";
    approved: "approved";
    paid: "paid";
    rejected: "rejected";
}>;
export declare const adminPayoutActionSchema: z.ZodEnum<{
    approve: "approve";
    pause: "pause";
    reject: "reject";
    cancel: "cancel";
    mark_paid: "mark_paid";
    retry: "retry";
}>;
export declare const adminPayoutActionRequestSchema: z.ZodObject<{
    action: z.ZodEnum<{
        approve: "approve";
        pause: "pause";
        reject: "reject";
        cancel: "cancel";
        mark_paid: "mark_paid";
        retry: "retry";
    }>;
    note: z.ZodOptional<z.ZodString>;
    scaToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const adminPayoutStatusFilterSchema: z.ZodEnum<{
    draft: "draft";
    cancelled: "cancelled";
    requested: "requested";
    approved: "approved";
    paid: "paid";
    rejected: "rejected";
    all: "all";
}>;
export declare const payoutRequestSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    amount: z.ZodNumber;
    amountCents: z.ZodNumber;
    grossAmountCents: z.ZodDefault<z.ZodNumber>;
    platformFeeCents: z.ZodDefault<z.ZodNumber>;
    netAmountCents: z.ZodDefault<z.ZodNumber>;
    platformFeeRateBps: z.ZodDefault<z.ZodNumber>;
    currency: z.ZodString;
    status: z.ZodEnum<{
        draft: "draft";
        cancelled: "cancelled";
        requested: "requested";
        approved: "approved";
        paid: "paid";
        rejected: "rejected";
    }>;
    requestedAt: z.ZodString;
    reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paidAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stripeConnectAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stripeTransferId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stripePayoutId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stripeEventId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stripeFailureCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stripeFailureMessage: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stripeExternalStatus: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    provider: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        none: "none";
        stripe: "stripe";
        airwallex: "airwallex";
    }>>>;
    providerAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    providerTransferId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    providerPayoutId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    providerEventId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    providerFailureCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    providerFailureMessage: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    providerExternalStatus: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const moneyProviderAccountSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        none: "none";
        stripe: "stripe";
        airwallex: "airwallex";
        stripe_demo: "stripe_demo";
        stripe_connect_test: "stripe_connect_test";
        airwallex_demo: "airwallex_demo";
    }>;
    status: z.ZodEnum<{
        restricted: "restricted";
        pending: "pending";
        disabled: "disabled";
        not_connected: "not_connected";
        onboarding: "onboarding";
        connected: "connected";
    }>;
    connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    providerAccountId: z.ZodOptional<z.ZodString>;
    stripeAccountId: z.ZodOptional<z.ZodString>;
    businessProfileId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    accountType: z.ZodOptional<z.ZodEnum<{
        business: "business";
        brand: "brand";
        individual: "individual";
    }>>;
    legacyStripeAccountId: z.ZodOptional<z.ZodString>;
    chargesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    payoutsEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    detailsSubmitted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    currentlyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    eventuallyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    pastDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    disabledReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultCurrency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sandboxOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const moneyProviderWalletBalanceSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        none: "none";
        stripe: "stripe";
        airwallex: "airwallex";
        stripe_connect_test: "stripe_connect_test";
        airwallex_demo: "airwallex_demo";
    }>;
    providerAccountId: z.ZodOptional<z.ZodString>;
    currency: z.ZodString;
    availableCents: z.ZodDefault<z.ZodNumber>;
    reservedCents: z.ZodDefault<z.ZodNumber>;
    pendingCents: z.ZodDefault<z.ZodNumber>;
    totalCents: z.ZodDefault<z.ZodNumber>;
    externalUpdatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source: z.ZodDefault<z.ZodEnum<{
        stored: "stored";
        provider_sync: "provider_sync";
        not_supported: "not_supported";
    }>>;
    sandboxOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const moneyProviderWalletBalancesSyncRequestSchema: z.ZodObject<{
    scaToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const moneyProviderWalletBalancesResponseSchema: z.ZodObject<{
    provider: z.ZodObject<{
        provider: z.ZodEnum<{
            none: "none";
            stripe: "stripe";
            airwallex: "airwallex";
        }>;
        environment: z.ZodEnum<{
            demo: "demo";
            production: "production";
            none: "none";
            test: "test";
        }>;
        configured: z.ZodBoolean;
        sandboxOnly: z.ZodBoolean;
        capabilities: z.ZodArray<z.ZodEnum<{
            connected_accounts: "connected_accounts";
            onboarding_links: "onboarding_links";
            wallet_balances: "wallet_balances";
            payins: "payins";
            trade_holds: "trade_holds";
            platform_fees: "platform_fees";
            payouts: "payouts";
            webhooks: "webhooks";
            refunds: "refunds";
            disputes: "disputes";
        }>>;
    }, z.core.$strip>;
    account: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        provider: z.ZodEnum<{
            none: "none";
            stripe: "stripe";
            airwallex: "airwallex";
            stripe_demo: "stripe_demo";
            stripe_connect_test: "stripe_connect_test";
            airwallex_demo: "airwallex_demo";
        }>;
        status: z.ZodEnum<{
            restricted: "restricted";
            pending: "pending";
            disabled: "disabled";
            not_connected: "not_connected";
            onboarding: "onboarding";
            connected: "connected";
        }>;
        connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        providerAccountId: z.ZodOptional<z.ZodString>;
        stripeAccountId: z.ZodOptional<z.ZodString>;
        businessProfileId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        accountType: z.ZodOptional<z.ZodEnum<{
            business: "business";
            brand: "brand";
            individual: "individual";
        }>>;
        legacyStripeAccountId: z.ZodOptional<z.ZodString>;
        chargesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        payoutsEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        detailsSubmitted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        currentlyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        eventuallyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        pastDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        disabledReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultCurrency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sandboxOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    balances: z.ZodDefault<z.ZodArray<z.ZodObject<{
        provider: z.ZodEnum<{
            none: "none";
            stripe: "stripe";
            airwallex: "airwallex";
            stripe_connect_test: "stripe_connect_test";
            airwallex_demo: "airwallex_demo";
        }>;
        providerAccountId: z.ZodOptional<z.ZodString>;
        currency: z.ZodString;
        availableCents: z.ZodDefault<z.ZodNumber>;
        reservedCents: z.ZodDefault<z.ZodNumber>;
        pendingCents: z.ZodDefault<z.ZodNumber>;
        totalCents: z.ZodDefault<z.ZodNumber>;
        externalUpdatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<{
            stored: "stored";
            provider_sync: "provider_sync";
            not_supported: "not_supported";
        }>>;
        sandboxOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>>>;
    syncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    moneySafety: z.ZodOptional<z.ZodObject<{
        launchMode: z.ZodEnum<{
            disabled: "disabled";
            demo: "demo";
            private_beta: "private_beta";
            production: "production";
        }>;
        moneyProvider: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            none: "none";
            stripe: "stripe";
            airwallex: "airwallex";
        }>>>;
        moneyProviderEnvironment: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            demo: "demo";
            production: "production";
            none: "none";
            test: "test";
        }>>>;
        moneyProviderConfigured: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        moneyProviderSandboxOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        moneyProviderCapabilities: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodEnum<{
            connected_accounts: "connected_accounts";
            onboarding_links: "onboarding_links";
            wallet_balances: "wallet_balances";
            payins: "payins";
            trade_holds: "trade_holds";
            platform_fees: "platform_fees";
            payouts: "payouts";
            webhooks: "webhooks";
            refunds: "refunds";
            disputes: "disputes";
        }>>>>;
        policyVersion: z.ZodString;
        walletTermsVersion: z.ZodString;
        payoutTermsVersion: z.ZodString;
        refundPolicyVersion: z.ZodString;
        disputePolicyVersion: z.ZodString;
        policyAcknowledgementRequired: z.ZodBoolean;
        policyAcknowledged: z.ZodBoolean;
        acknowledgedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        privateBetaAllowed: z.ZodBoolean;
        requiresManualPayoutReview: z.ZodBoolean;
        moneyFeaturesVisible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        walletVisible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        payoutsVisible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        moneyTradesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        cashTradesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        realMoneyEnabled: z.ZodBoolean;
        demoMoneyEnabled: z.ZodBoolean;
        providerTradeMoneyEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        providerTransfersEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        providerWalletSyncEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        stripeTransfersEnabled: z.ZodBoolean;
        productionSwitchEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        privateBetaAllowlistCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        message: z.ZodString;
    }, z.core.$strip>>;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const moneyProviderTransactionSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    provider: z.ZodUnion<[z.ZodEnum<{
        none: "none";
        stripe: "stripe";
        airwallex: "airwallex";
        stripe_legacy: "stripe_legacy";
    }>, z.ZodString]>;
    providerTransactionId: z.ZodString;
    type: z.ZodString;
    status: z.ZodString;
    amountCents: z.ZodNumber;
    currency: z.ZodString;
    userId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tradeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    payoutRequestId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    providerAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    counterpartyProviderAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rawProviderStatus: z.ZodOptional<z.ZodUnknown>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export declare const moneyProviderTransactionsResponseSchema: z.ZodObject<{
    provider: z.ZodObject<{
        provider: z.ZodEnum<{
            none: "none";
            stripe: "stripe";
            airwallex: "airwallex";
        }>;
        environment: z.ZodEnum<{
            demo: "demo";
            production: "production";
            none: "none";
            test: "test";
        }>;
        configured: z.ZodBoolean;
        sandboxOnly: z.ZodBoolean;
        capabilities: z.ZodArray<z.ZodEnum<{
            connected_accounts: "connected_accounts";
            onboarding_links: "onboarding_links";
            wallet_balances: "wallet_balances";
            payins: "payins";
            trade_holds: "trade_holds";
            platform_fees: "platform_fees";
            payouts: "payouts";
            webhooks: "webhooks";
            refunds: "refunds";
            disputes: "disputes";
        }>>;
    }, z.core.$strip>;
    transactions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        provider: z.ZodUnion<[z.ZodEnum<{
            none: "none";
            stripe: "stripe";
            airwallex: "airwallex";
            stripe_legacy: "stripe_legacy";
        }>, z.ZodString]>;
        providerTransactionId: z.ZodString;
        type: z.ZodString;
        status: z.ZodString;
        amountCents: z.ZodNumber;
        currency: z.ZodString;
        userId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tradeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        payoutRequestId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        providerAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        counterpartyProviderAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        rawProviderStatus: z.ZodOptional<z.ZodUnknown>;
        createdAt: z.ZodOptional<z.ZodString>;
        updatedAt: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>>;
}, z.core.$strip>;
export declare const moneyProviderOnboardingLinkRequestSchema: z.ZodObject<{
    returnUrl: z.ZodOptional<z.ZodString>;
    refreshUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const moneyProviderOnboardingLinkResponseSchema: z.ZodObject<{
    url: z.ZodString;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    account: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        provider: z.ZodEnum<{
            none: "none";
            stripe: "stripe";
            airwallex: "airwallex";
            stripe_demo: "stripe_demo";
            stripe_connect_test: "stripe_connect_test";
            airwallex_demo: "airwallex_demo";
        }>;
        status: z.ZodEnum<{
            restricted: "restricted";
            pending: "pending";
            disabled: "disabled";
            not_connected: "not_connected";
            onboarding: "onboarding";
            connected: "connected";
        }>;
        connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        providerAccountId: z.ZodOptional<z.ZodString>;
        stripeAccountId: z.ZodOptional<z.ZodString>;
        businessProfileId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        accountType: z.ZodOptional<z.ZodEnum<{
            business: "business";
            brand: "brand";
            individual: "individual";
        }>>;
        legacyStripeAccountId: z.ZodOptional<z.ZodString>;
        chargesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        payoutsEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        detailsSubmitted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        currentlyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        eventuallyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        pastDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        disabledReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultCurrency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sandboxOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    providerConfigured: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const stripeConnectPayoutAccountSchema: z.ZodObject<{
    provider: z.ZodLiteral<"stripe_connect_test">;
    status: z.ZodEnum<{
        restricted: "restricted";
        pending: "pending";
        disabled: "disabled";
        not_connected: "not_connected";
        onboarding: "onboarding";
        connected: "connected";
    }>;
    connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stripeAccountId: z.ZodOptional<z.ZodString>;
    chargesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    payoutsEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    detailsSubmitted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    currentlyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    eventuallyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    pastDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    disabledReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultCurrency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const payoutAccountSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    provider: z.ZodLiteral<"stripe_demo">;
    status: z.ZodEnum<{
        not_connected: "not_connected";
        connected: "connected";
    }>;
    connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    provider: z.ZodLiteral<"stripe_connect_test">;
    status: z.ZodEnum<{
        restricted: "restricted";
        pending: "pending";
        disabled: "disabled";
        not_connected: "not_connected";
        onboarding: "onboarding";
        connected: "connected";
    }>;
    connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stripeAccountId: z.ZodOptional<z.ZodString>;
    chargesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    payoutsEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    detailsSubmitted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    currentlyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    eventuallyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    pastDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    disabledReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultCurrency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>], "provider">;
export declare const stripeConnectAccountLinkResponseSchema: z.ZodObject<{
    url: z.ZodString;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    account: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        provider: z.ZodLiteral<"stripe_connect_test">;
        status: z.ZodEnum<{
            restricted: "restricted";
            pending: "pending";
            disabled: "disabled";
            not_connected: "not_connected";
            onboarding: "onboarding";
            connected: "connected";
        }>;
        connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stripeAccountId: z.ZodOptional<z.ZodString>;
        chargesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        payoutsEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        detailsSubmitted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        currentlyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        eventuallyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        pastDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        disabledReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultCurrency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    stripeConnectConfigured: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const payoutSummarySchema: z.ZodObject<{
    currency: z.ZodString;
    platformFeeRateBps: z.ZodDefault<z.ZodNumber>;
    availableForPayoutCents: z.ZodNumber;
    availableGrossEarningsCents: z.ZodDefault<z.ZodNumber>;
    estimatedPlatformFeeCents: z.ZodDefault<z.ZodNumber>;
    estimatedNetPayoutCents: z.ZodDefault<z.ZodNumber>;
    pendingPayoutRequestsCents: z.ZodNumber;
    pendingPayoutRequestsGrossCents: z.ZodDefault<z.ZodNumber>;
    pendingPayoutRequestsFeeCents: z.ZodDefault<z.ZodNumber>;
    pendingPayoutRequestsNetCents: z.ZodDefault<z.ZodNumber>;
    paidOutCents: z.ZodNumber;
    paidOutGrossCents: z.ZodDefault<z.ZodNumber>;
    paidOutFeeCents: z.ZodDefault<z.ZodNumber>;
    paidOutNetCents: z.ZodDefault<z.ZodNumber>;
    payoutAccount: z.ZodUnion<[z.ZodDiscriminatedUnion<[z.ZodObject<{
        provider: z.ZodLiteral<"stripe_demo">;
        status: z.ZodEnum<{
            not_connected: "not_connected";
            connected: "connected";
        }>;
        connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        provider: z.ZodLiteral<"stripe_connect_test">;
        status: z.ZodEnum<{
            restricted: "restricted";
            pending: "pending";
            disabled: "disabled";
            not_connected: "not_connected";
            onboarding: "onboarding";
            connected: "connected";
        }>;
        connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stripeAccountId: z.ZodOptional<z.ZodString>;
        chargesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        payoutsEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        detailsSubmitted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        currentlyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        eventuallyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        pastDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        disabledReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultCurrency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>], "provider">, z.ZodObject<{
        provider: z.ZodEnum<{
            none: "none";
            stripe: "stripe";
            airwallex: "airwallex";
            stripe_demo: "stripe_demo";
            stripe_connect_test: "stripe_connect_test";
            airwallex_demo: "airwallex_demo";
        }>;
        status: z.ZodEnum<{
            restricted: "restricted";
            pending: "pending";
            disabled: "disabled";
            not_connected: "not_connected";
            onboarding: "onboarding";
            connected: "connected";
        }>;
        connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        providerAccountId: z.ZodOptional<z.ZodString>;
        stripeAccountId: z.ZodOptional<z.ZodString>;
        businessProfileId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        accountType: z.ZodOptional<z.ZodEnum<{
            business: "business";
            brand: "brand";
            individual: "individual";
        }>>;
        legacyStripeAccountId: z.ZodOptional<z.ZodString>;
        chargesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        payoutsEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        detailsSubmitted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        currentlyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        eventuallyDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        pastDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        disabledReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultCurrency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sandboxOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    moneyProviderConfigured: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    providerTransferMode: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    providerWalletBalances: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        provider: z.ZodEnum<{
            none: "none";
            stripe: "stripe";
            airwallex: "airwallex";
            stripe_connect_test: "stripe_connect_test";
            airwallex_demo: "airwallex_demo";
        }>;
        providerAccountId: z.ZodOptional<z.ZodString>;
        currency: z.ZodString;
        availableCents: z.ZodDefault<z.ZodNumber>;
        reservedCents: z.ZodDefault<z.ZodNumber>;
        pendingCents: z.ZodDefault<z.ZodNumber>;
        totalCents: z.ZodDefault<z.ZodNumber>;
        externalUpdatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastSyncedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<{
            stored: "stored";
            provider_sync: "provider_sync";
            not_supported: "not_supported";
        }>>;
        sandboxOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>>>>;
    stripeConnectConfigured: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    stripeConnectTransferMode: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    limits: z.ZodOptional<z.ZodObject<{
        trustTier: z.ZodEnum<{
            new: "new";
            email_verified: "email_verified";
            stripe_verified: "stripe_verified";
            trusted: "trusted";
            restricted: "restricted";
        }>;
        effectiveTrustTier: z.ZodEnum<{
            new: "new";
            email_verified: "email_verified";
            stripe_verified: "stripe_verified";
            trusted: "trusted";
            restricted: "restricted";
        }>;
        serviceActiveTradeLimit: z.ZodNumber;
        moneyActiveTradeLimit: z.ZodNumber;
        perTradeMoneyCapCents: z.ZodNumber;
        walletBalanceCapCents: z.ZodNumber;
        weeklyPayoutCapCents: z.ZodNumber;
        minimumPayoutCents: z.ZodNumber;
        payoutsEnabled: z.ZodBoolean;
        moneyTradesEnabled: z.ZodBoolean;
        walletTopUpsEnabled: z.ZodBoolean;
        activeServiceTradeCount: z.ZodDefault<z.ZodNumber>;
        activeMoneyTradeCount: z.ZodDefault<z.ZodNumber>;
        walletExposureCents: z.ZodDefault<z.ZodNumber>;
        weeklyRequestedPayoutGrossCents: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    moneySafety: z.ZodOptional<z.ZodObject<{
        launchMode: z.ZodEnum<{
            disabled: "disabled";
            demo: "demo";
            private_beta: "private_beta";
            production: "production";
        }>;
        moneyProvider: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            none: "none";
            stripe: "stripe";
            airwallex: "airwallex";
        }>>>;
        moneyProviderEnvironment: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            demo: "demo";
            production: "production";
            none: "none";
            test: "test";
        }>>>;
        moneyProviderConfigured: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        moneyProviderSandboxOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        moneyProviderCapabilities: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodEnum<{
            connected_accounts: "connected_accounts";
            onboarding_links: "onboarding_links";
            wallet_balances: "wallet_balances";
            payins: "payins";
            trade_holds: "trade_holds";
            platform_fees: "platform_fees";
            payouts: "payouts";
            webhooks: "webhooks";
            refunds: "refunds";
            disputes: "disputes";
        }>>>>;
        policyVersion: z.ZodString;
        walletTermsVersion: z.ZodString;
        payoutTermsVersion: z.ZodString;
        refundPolicyVersion: z.ZodString;
        disputePolicyVersion: z.ZodString;
        policyAcknowledgementRequired: z.ZodBoolean;
        policyAcknowledged: z.ZodBoolean;
        acknowledgedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        privateBetaAllowed: z.ZodBoolean;
        requiresManualPayoutReview: z.ZodBoolean;
        moneyFeaturesVisible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        walletVisible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        payoutsVisible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        moneyTradesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        cashTradesEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        realMoneyEnabled: z.ZodBoolean;
        demoMoneyEnabled: z.ZodBoolean;
        providerTradeMoneyEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        providerTransfersEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        providerWalletSyncEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        stripeTransfersEnabled: z.ZodBoolean;
        productionSwitchEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        privateBetaAllowlistCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        message: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type MoneyLaunchMode = z.infer<typeof moneyLaunchModeSchema>;
export type MoneyProvider = z.infer<typeof moneyProviderSchema>;
export type MoneyProviderEnvironment = z.infer<typeof moneyProviderEnvironmentSchema>;
export type MoneySafetyStatusDto = z.infer<typeof moneySafetyStatusSchema>;
export type AcknowledgeMoneySafetyRequest = z.infer<typeof acknowledgeMoneySafetyRequestSchema>;
export type UserTrustTier = z.infer<typeof userTrustTierSchema>;
export type AdminUpdateTrustTierRequest = z.infer<typeof adminUpdateTrustTierRequestSchema>;
export type WalletLimitsDto = z.infer<typeof walletLimitsSchema>;
export type WalletDto = z.infer<typeof walletSchema>;
export type LedgerEntryDto = z.infer<typeof ledgerEntrySchema>;
export type DemoTopUpRequest = z.infer<typeof demoTopUpRequestSchema>;
export type DemoPayoutRequest = z.infer<typeof demoPayoutRequestSchema>;
export type PayoutRequestStatus = z.infer<typeof payoutRequestStatusSchema>;
export type AdminPayoutAction = z.infer<typeof adminPayoutActionSchema>;
export type AdminPayoutActionRequest = z.infer<typeof adminPayoutActionRequestSchema>;
export type AdminPayoutStatusFilter = z.infer<typeof adminPayoutStatusFilterSchema>;
export type PayoutRequestDto = z.infer<typeof payoutRequestSchema>;
export type MoneyProviderAccountDto = z.infer<typeof moneyProviderAccountSchema>;
export type MoneyProviderWalletBalanceDto = z.infer<typeof moneyProviderWalletBalanceSchema>;
export type MoneyProviderWalletBalancesSyncRequest = z.infer<typeof moneyProviderWalletBalancesSyncRequestSchema>;
export type MoneyProviderWalletBalancesResponse = z.infer<typeof moneyProviderWalletBalancesResponseSchema>;
export type MoneyProviderTransactionDto = z.infer<typeof moneyProviderTransactionSchema>;
export type MoneyProviderTransactionsResponse = z.infer<typeof moneyProviderTransactionsResponseSchema>;
export type MoneyProviderOnboardingLinkRequest = z.infer<typeof moneyProviderOnboardingLinkRequestSchema>;
export type MoneyProviderOnboardingLinkResponse = z.infer<typeof moneyProviderOnboardingLinkResponseSchema>;
export type StripeConnectPayoutAccountDto = z.infer<typeof stripeConnectPayoutAccountSchema>;
export type StripeConnectAccountLinkResponse = z.infer<typeof stripeConnectAccountLinkResponseSchema>;
export type PayoutAccountDto = z.infer<typeof payoutAccountSchema>;
export type PayoutSummaryDto = z.infer<typeof payoutSummarySchema>;
//# sourceMappingURL=wallet.d.ts.map