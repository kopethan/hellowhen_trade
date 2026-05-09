import type { MoneyProviderAccount, Prisma } from "@prisma/client";
import { env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { airwallexRequest } from "./airwallexClient.js";
import {
  MoneyProviderError,
  type CreateConnectedAccountInput,
  type CreateOnboardingLinkInput,
  type CreatePayoutTransferInput,
  type CreateTradeHoldInput,
  type MoneyProviderAdapter,
  type ProviderAccountDto,
  type ProviderOnboardingLinkResult,
  type ProviderTradeMoneyResult,
  type ProviderWalletBalanceDto,
  type ProviderWalletBalanceSyncResult,
  type RefundTradeHoldInput,
  type ReleaseTradeHoldInput,
  type SyncAccountStatusInput,
  type SyncPayoutTransferInput,
  type SyncWalletBalancesInput,
} from "./moneyProvider.types.js";

type AirwallexAccountResponse = {
  id?: string;
  status?: string;
  account_details?: {
    legal_entity_type?: string;
    business_details?: { business_name?: string | null };
  };
  primary_contact?: { email?: string | null };
  requirements?: unknown;
  capabilities?: unknown;
  default_currency?: string | null;
  country_code?: string | null;
  country?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type AirwallexHostedFlowResponse = {
  id?: string;
  url?: string;
  status?: string;
  expires_at?: string | null;
  [key: string]: unknown;
};

type AirwallexFundsMovementResponse = {
  id?: string;
  request_id?: string;
  status?: string;
  reference?: string;
  amount?: number | string;
  currency?: string;
  [key: string]: unknown;
};

type AirwallexTransferResponse = {
  id?: string;
  transfer_id?: string;
  payment_id?: string;
  request_id?: string;
  short_reference_id?: string;
  status?: string;
  transfer_status?: string;
  failure_reason?: string | null;
  failure_type?: string | null;
  amount_beneficiary_receives?: number | string;
  amount_payer_pays?: number | string;
  transfer_amount?: number | string;
  transfer_currency?: string;
  source_currency?: string;
  transfer_method?: string;
  [key: string]: unknown;
};

type NormalizedAirwallexBalance = {
  currency: string;
  availableCents: number;
  reservedCents: number;
  pendingCents: number;
  externalUpdatedAt: Date | null;
};

function isAirwallexSandboxBlocked() {
  return (
    env.moneyProviderSandboxOnly &&
    (env.airwallexEnv === "production" ||
      !env.airwallexBaseUrl.includes("api-demo.airwallex.com"))
  );
}

function requireAirwallexSandboxApiConfigured(
  message = "Airwallex sandbox is not configured. Add sandbox API credentials before using provider features.",
) {
  if (!env.airwallexEnabled || !env.airwallexClientId || !env.airwallexApiKey) {
    throw new MoneyProviderError("provider_not_configured", message, 503);
  }
  if (isAirwallexSandboxBlocked()) {
    throw new MoneyProviderError(
      "sandbox_only",
      "Airwallex production access is blocked. These provider scaffolding phases only support sandbox/demo access.",
      403,
    );
  }
}

function requireAirwallexConnectedAccountsAccess() {
  requireAirwallexSandboxApiConfigured(
    "Airwallex sandbox is not configured. Add sandbox API credentials before using connected accounts.",
  );
  if (!env.airwallexConnectedAccountsEnabled) {
    throw new MoneyProviderError(
      "provider_not_enabled",
      "Airwallex connected accounts are disabled by AIRWALLEX_CONNECTED_ACCOUNTS_ENABLED.",
      403,
    );
  }
}

function requireAirwallexSandboxConfigured() {
  requireAirwallexConnectedAccountsAccess();
  if (!env.moneyProviderAccountCreationEnabled) {
    throw new MoneyProviderError(
      "provider_not_enabled",
      "Airwallex connected-account creation is disabled by feature flags.",
      403,
    );
  }
}

function toProviderDto(
  account: MoneyProviderAccount | null,
): ProviderAccountDto | null {
  if (!account) return null;
  const raw =
    account.rawProviderStatus && typeof account.rawProviderStatus === "object"
      ? (account.rawProviderStatus as Record<string, unknown>)
      : {};
  const capabilities =
    account.capabilities && typeof account.capabilities === "object"
      ? (account.capabilities as Record<string, unknown>)
      : {};
  const requirements =
    account.requirements && typeof account.requirements === "object"
      ? (account.requirements as Record<string, unknown>)
      : {};
  const currentlyDue = Array.isArray(requirements.currently_due)
    ? requirements.currently_due.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const eventuallyDue = Array.isArray(requirements.eventually_due)
    ? requirements.eventually_due.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const pastDue = Array.isArray(requirements.past_due)
    ? requirements.past_due.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const hostedFlow =
    raw.hostedFlow && typeof raw.hostedFlow === "object"
      ? (raw.hostedFlow as Record<string, unknown>)
      : null;
  return {
    provider: "airwallex_demo",
    status:
      account.status === "active"
        ? "connected"
        : account.status === "not_started"
          ? "not_connected"
          : account.status === "rejected"
            ? "disabled"
            : account.status,
    connectedAt: account.createdAt.toISOString(),
    providerAccountId: account.providerAccountId,
    businessProfileId: account.businessProfileId,
    accountType: account.accountType,
    chargesEnabled: Boolean(
      capabilities.payins_enabled ?? capabilities.charges_enabled,
    ),
    payoutsEnabled: Boolean(capabilities.payouts_enabled),
    detailsSubmitted: ["pending", "active", "restricted"].includes(
      account.status,
    ),
    currentlyDue,
    eventuallyDue,
    pastDue,
    disabledReason:
      typeof requirements.disabled_reason === "string"
        ? requirements.disabled_reason
        : null,
    defaultCurrency: account.defaultCurrency,
    country: account.country,
    lastSyncedAt: account.lastSyncedAt
      ? account.lastSyncedAt.toISOString()
      : null,
    sandboxOnly: true,
    message: hostedFlow?.id
      ? `Airwallex sandbox hosted flow ${String(hostedFlow.id)} is available for onboarding.`
      : "Airwallex sandbox connected account.",
  };
}

function mapAirwallexStatus(
  status?: string,
): Prisma.MoneyProviderAccountCreateInput["status"] {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "CREATED") return "onboarding";
  if (normalized === "SUBMITTED") return "pending";
  if (normalized === "ACTIVE") return "active";
  if (normalized === "ACTION_REQUIRED") return "restricted";
  if (normalized === "SUSPENDED") return "restricted";
  if (normalized === "REJECTED") return "rejected";
  return "onboarding";
}

function legalEntityType(
  accountType: CreateConnectedAccountInput["accountType"],
) {
  return accountType === "individual" || !accountType
    ? "INDIVIDUAL"
    : "BUSINESS";
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function countryFromAccount(
  account: AirwallexAccountResponse,
  fallback?: string | null,
) {
  return (
    (
      account.country_code ??
      account.country ??
      fallback ??
      null
    )?.toUpperCase() ?? null
  );
}

function currencyFromAccount(
  account: AirwallexAccountResponse,
  fallback?: string | null,
) {
  return (
    account.default_currency ??
    fallback ??
    env.airwallexDefaultCurrency
  ).toLowerCase();
}

async function upsertProviderAccount(input: {
  userId: string;
  businessProfileId?: string | null;
  account: AirwallexAccountResponse;
  accountType?: "individual" | "business" | "brand";
  fallbackCountry?: string | null;
  fallbackCurrency?: string | null;
  rawPatch?: Record<string, unknown>;
}) {
  if (!input.account.id)
    throw new MoneyProviderError(
      "airwallex_account_missing_id",
      "Airwallex did not return a connected account ID.",
      502,
    );
  const existing = await prisma.moneyProviderAccount.findFirst({
    where: {
      userId: input.userId,
      provider: "airwallex",
      businessProfileId: input.businessProfileId ?? null,
    },
  });
  const rawProviderStatus = jsonValue({
    ...(input.account ?? {}),
    ...(input.rawPatch ?? {}),
  });
  const data = {
    providerAccountId: input.account.id,
    accountType:
      input.accountType ?? existing?.accountType ?? ("individual" as const),
    status: mapAirwallexStatus(input.account.status),
    country: countryFromAccount(input.account, input.fallbackCountry),
    defaultCurrency: currencyFromAccount(input.account, input.fallbackCurrency),
    capabilities: jsonValue(input.account.capabilities ?? {}),
    requirements: jsonValue(input.account.requirements ?? {}),
    rawProviderStatus,
    lastSyncedAt: new Date(),
  };

  if (existing) {
    return prisma.moneyProviderAccount.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.moneyProviderAccount.create({
    data: {
      userId: input.userId,
      businessProfileId: input.businessProfileId ?? null,
      provider: "airwallex",
      ...data,
    },
  });
}

async function getStoredAccount(userId: string, businessProfileId?: string | null) {
  return prisma.moneyProviderAccount.findFirst({
    where: { userId, provider: "airwallex", businessProfileId: businessProfileId ?? null },
    orderBy: { createdAt: "desc" },
  });
}

async function getUserContact(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      profile: {
        select: {
          displayName: true,
          countryCode: true,
          preferredCurrency: true,
        },
      },
    },
  });
}

async function getBusinessProfileContact(userId: string, businessProfileId?: string | null) {
  if (!businessProfileId) return null;
  return prisma.businessProfile.findFirst({
    where: {
      id: businessProfileId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId, role: { in: ["owner", "admin", "finance"] } } } },
      ],
    },
    select: {
      id: true,
      type: true,
      displayName: true,
      legalName: true,
      countryCode: true,
      preferredCurrency: true,
    },
  });
}

function webUrl(pathname: string | undefined, fallbackPath: string) {
  return new URL(pathname || fallbackPath, env.webAppUrl).toString();
}

function requireAirwallexWalletSyncEnabled() {
  requireAirwallexConnectedAccountsAccess();
  if (!env.moneyProviderWalletSyncEnabled) {
    throw new MoneyProviderError(
      "provider_not_enabled",
      "Airwallex wallet-balance sync is disabled by MONEY_PROVIDER_WALLET_SYNC_ENABLED.",
      403,
    );
  }
}

function requireAirwallexTradeMoneyEnabled() {
  requireAirwallexConnectedAccountsAccess();
  if (!env.moneyProviderTradeMoneyEnabled) {
    throw new MoneyProviderError(
      "provider_not_enabled",
      "Airwallex sandbox trade-money movement is disabled by MONEY_PROVIDER_TRADE_MONEY_ENABLED.",
      403,
    );
  }
}

function requireAirwallexPayoutsEnabled() {
  requireAirwallexConnectedAccountsAccess();
  if (!env.moneyProviderPayoutsEnabled) {
    throw new MoneyProviderError(
      "provider_not_enabled",
      "Airwallex sandbox payouts are disabled by MONEY_PROVIDER_PAYOUTS_ENABLED.",
      403,
    );
  }
  if (!env.airwallexSandboxPayoutBeneficiaryId) {
    throw new MoneyProviderError(
      "airwallex_sandbox_beneficiary_missing",
      "AIRWALLEX_SANDBOX_PAYOUT_BENEFICIARY_ID is required before creating sandbox payout transfers.",
      503,
    );
  }
}

function providerTransactionStatus(
  status?: string,
): Prisma.MoneyProviderTransactionCreateInput["status"] {
  const normalized = String(status ?? "").toUpperCase();
  if (
    normalized === "SETTLED" ||
    normalized === "SUCCEEDED" ||
    normalized === "SUCCESS" ||
    normalized === "COMPLETED" ||
    normalized === "PAID"
  )
    return "succeeded";
  if (
    normalized === "FAILED" ||
    normalized === "SUSPENDED" ||
    normalized === "REJECTED" ||
    normalized === "OVERDUE"
  )
    return "failed";
  if (normalized === "CANCELLED" || normalized === "CANCELED")
    return "canceled";
  if (normalized === "REVERSED" || normalized === "RETRIED") return "reversed";
  return "pending";
}

function payoutRequestStatusFromProviderStatus(
  status?: string | null,
): "approved" | "paid" | "cancelled" {
  const mapped = providerTransactionStatus(status ?? undefined);
  if (mapped === "succeeded") return "paid";
  if (mapped === "canceled") return "cancelled";
  return "approved";
}

function transferStatus(transfer: AirwallexTransferResponse | Record<string, unknown>) {
  return String(
    transfer.status ??
      transfer.transfer_status ??
      transfer.payment_status ??
      transfer.funding_status ??
      "NEW",
  );
}

function transferId(transfer: AirwallexTransferResponse | Record<string, unknown>) {
  const value =
    transfer.id ??
    transfer.transfer_id ??
    transfer.payment_id ??
    transfer.request_id ??
    transfer.short_reference_id;
  return typeof value === "string" && value.trim() ? value : null;
}

function payoutTransferFailure(transfer: AirwallexTransferResponse | Record<string, unknown>) {
  const reason = transfer.failure_reason ?? transfer.failure_type ?? transfer.error ?? null;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

function toProviderTradeMoneyResult(input: {
  providerTransactionId?: string | null;
  status?: string | null;
  message?: string;
}): ProviderTradeMoneyResult {
  const mapped = providerTransactionStatus(input.status ?? undefined);
  return {
    provider: "airwallex",
    providerTransactionId: input.providerTransactionId ?? null,
    status:
      mapped === "succeeded"
        ? "succeeded"
        : mapped === "failed"
          ? "failed"
          : mapped === "reversed"
            ? "reversed"
            : "pending",
    externalStatus: input.status ?? null,
    sandboxOnly: true,
    message: input.message,
  };
}

function requestId(prefix: string, tradeId: string) {
  const cleanTradeId = tradeId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  return `hw_${prefix}_${cleanTradeId}`.slice(0, 64);
}

function centsToProviderAmount(cents: number) {
  return Number((Math.max(0, cents) / 100).toFixed(2));
}

async function accountForUser(userId?: string | null, businessProfileId?: string | null) {
  if (!userId) return null;
  return prisma.moneyProviderAccount.findFirst({
    where: { userId, provider: "airwallex", businessProfileId: businessProfileId ?? null },
    orderBy: { createdAt: "desc" },
  });
}

async function payoutTransferAttemptNumber(payoutId: string) {
  const count = await prisma.moneyProviderTransaction.count({
    where: { provider: "airwallex", payoutRequestId: payoutId, type: "payout" },
  });
  return count + 1;
}

function payoutRequestId(prefix: string, payoutId: string, attempt = 1) {
  const cleanPayoutId = payoutId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 28);
  return `hw_${prefix}_${cleanPayoutId}_${attempt}`.slice(0, 64);
}

async function applyPayoutProviderStatus(input: {
  payoutId: string;
  providerAccountId?: string | null;
  providerTransferId: string;
  providerPayoutId?: string | null;
  rawStatus?: string | null;
  failureMessage?: string | null;
  providerEventId?: string | null;
}) {
  const nextStatus = payoutRequestStatusFromProviderStatus(input.rawStatus);
  const mapped = providerTransactionStatus(input.rawStatus ?? undefined);
  return prisma.payoutRequest.update({
    where: { id: input.payoutId },
    data: {
      provider: "airwallex",
      providerAccountId: input.providerAccountId ?? undefined,
      providerTransferId: input.providerTransferId,
      providerPayoutId: input.providerPayoutId ?? input.providerTransferId,
      providerEventId: input.providerEventId ?? undefined,
      providerExternalStatus: input.rawStatus ?? undefined,
      providerFailureCode: mapped === "failed" ? "airwallex_transfer_failed" : null,
      providerFailureMessage: mapped === "failed" ? input.failureMessage ?? "Airwallex sandbox transfer failed." : null,
      status: nextStatus,
      paidAt: nextStatus === "paid" ? new Date() : undefined,
    },
  });
}

async function upsertProviderTransaction(input: {
  providerTransactionId: string;
  type: Prisma.MoneyProviderTransactionCreateInput["type"];
  status: Prisma.MoneyProviderTransactionCreateInput["status"];
  amountCents: number;
  currency: string;
  userId?: string | null;
  tradeId?: string | null;
  payoutRequestId?: string | null;
  accountId?: string | null;
  counterpartyAccountId?: string | null;
  rawProviderStatus?: unknown;
}) {
  return prisma.moneyProviderTransaction.upsert({
    where: {
      provider_providerTransactionId: {
        provider: "airwallex",
        providerTransactionId: input.providerTransactionId,
      },
    },
    update: {
      status: input.status,
      amountCents: input.amountCents,
      currency: input.currency.toLowerCase(),
      userId: input.userId ?? null,
      tradeId: input.tradeId ?? null,
      payoutRequestId: input.payoutRequestId ?? null,
      moneyProviderAccountId: input.accountId ?? null,
      counterpartyProviderAccountId: input.counterpartyAccountId ?? null,
      rawProviderStatus: jsonValue(input.rawProviderStatus ?? {}),
    },
    create: {
      provider: "airwallex",
      providerTransactionId: input.providerTransactionId,
      type: input.type,
      status: input.status,
      amountCents: input.amountCents,
      currency: input.currency.toLowerCase(),
      userId: input.userId ?? null,
      tradeId: input.tradeId ?? null,
      payoutRequestId: input.payoutRequestId ?? null,
      moneyProviderAccountId: input.accountId ?? null,
      counterpartyProviderAccountId: input.counterpartyAccountId ?? null,
      rawProviderStatus: jsonValue(input.rawProviderStatus ?? {}),
    },
  });
}

function amountToCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.round(value * 100);
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return 0;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return 0;
}

function firstAmount(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null)
      return amountToCents(record[key]);
  }
  return 0;
}

function dateFrom(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function balanceRowsFromResponse(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload))
    return payload.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["balances", "items", "data"]) {
    const value = record[key];
    if (Array.isArray(value))
      return value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      );
  }
  if (typeof record.currency === "string") return [record];

  const mapKeys = [
    "available_amount",
    "available_balance",
    "reserved_amount",
    "reserve_amount",
    "pending_amount",
    "pending_balance",
    "account_balance",
  ];
  const currencies = new Set<string>();
  for (const key of mapKeys) {
    const maybeMap = record[key];
    if (maybeMap && typeof maybeMap === "object" && !Array.isArray(maybeMap)) {
      for (const currency of Object.keys(maybeMap as Record<string, unknown>))
        currencies.add(currency.toUpperCase());
    }
  }
  if (currencies.size > 0) {
    return Array.from(currencies).map((currency) => {
      const row: Record<string, unknown> = { currency };
      for (const key of mapKeys) {
        const maybeMap = record[key];
        if (
          maybeMap &&
          typeof maybeMap === "object" &&
          !Array.isArray(maybeMap)
        )
          row[key] =
            (maybeMap as Record<string, unknown>)[currency] ??
            (maybeMap as Record<string, unknown>)[currency.toLowerCase()];
      }
      return row;
    });
  }
  return [];
}

function normalizeAirwallexBalances(
  payload: unknown,
): NormalizedAirwallexBalance[] {
  return balanceRowsFromResponse(payload)
    .map((row) => {
      const currency = String(
        row.currency ?? row.currency_code ?? row.ccy ?? "",
      ).toLowerCase();
      if (!/^[a-z]{3}$/.test(currency)) return null;
      const availableCents = firstAmount(row, [
        "available_amount",
        "available_balance",
        "available",
        "amount_available",
        "balance",
      ]);
      const reservedCents = firstAmount(row, [
        "reserved_amount",
        "reserve_amount",
        "reserved_balance",
        "reserved",
        "reserve",
      ]);
      const pendingCents = firstAmount(row, [
        "pending_amount",
        "pending_balance",
        "pending",
      ]);
      const externalUpdatedAt = dateFrom(
        row.updated_at ?? row.as_at ?? row.as_of ?? row.created_at,
      );
      return {
        currency,
        availableCents,
        reservedCents,
        pendingCents,
        externalUpdatedAt,
      };
    })
    .filter((item): item is NormalizedAirwallexBalance => Boolean(item));
}

function balanceToDto(
  balance: {
    currency: string;
    availableCents: number;
    reservedCents: number;
    pendingCents: number;
    externalUpdatedAt: Date | null;
    lastSyncedAt: Date | null;
  },
  account: MoneyProviderAccount,
  source: ProviderWalletBalanceDto["source"],
): ProviderWalletBalanceDto {
  return {
    provider: "airwallex_demo",
    providerAccountId: account.providerAccountId,
    currency: balance.currency,
    availableCents: balance.availableCents,
    reservedCents: balance.reservedCents,
    pendingCents: balance.pendingCents,
    totalCents:
      balance.availableCents + balance.reservedCents + balance.pendingCents,
    externalUpdatedAt: balance.externalUpdatedAt
      ? balance.externalUpdatedAt.toISOString()
      : null,
    lastSyncedAt: balance.lastSyncedAt
      ? balance.lastSyncedAt.toISOString()
      : null,
    source,
    sandboxOnly: true,
  };
}

async function getAccountForBalanceInput(input: SyncWalletBalancesInput) {
  if (input.providerAccountId)
    return prisma.moneyProviderAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "airwallex",
          providerAccountId: input.providerAccountId,
        },
      },
    });
  if (input.userId) return getStoredAccount(input.userId, input.businessProfileId);
  return null;
}

async function getStoredWalletBalancesForAccount(
  account: MoneyProviderAccount | null,
  source: ProviderWalletBalanceDto["source"] = "stored",
): Promise<ProviderWalletBalanceDto[]> {
  if (!account) return [];
  const balances = await prisma.moneyProviderWalletBalance.findMany({
    where: { moneyProviderAccountId: account.id },
    orderBy: { currency: "asc" },
  });
  return balances.map((balance) => balanceToDto(balance, account, source));
}

async function syncAirwallexWalletBalances(
  input: SyncWalletBalancesInput,
): Promise<ProviderWalletBalanceSyncResult> {
  requireAirwallexWalletSyncEnabled();
  const account = await getAccountForBalanceInput(input);
  if (!account) {
    return {
      account: null,
      balances: [],
      syncedAt: null,
      message: "No Airwallex sandbox connected account exists yet.",
    };
  }

  const rawBalances = await airwallexRequest<unknown>(
    "/api/v1/balances/current",
    {
      onBehalfOf: account.providerAccountId,
      scaToken: input.scaToken,
    },
  );
  const normalized = normalizeAirwallexBalances(rawBalances);
  const syncedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBalances = [];
    for (const balance of normalized) {
      updatedBalances.push(
        await tx.moneyProviderWalletBalance.upsert({
          where: {
            moneyProviderAccountId_currency: {
              moneyProviderAccountId: account.id,
              currency: balance.currency,
            },
          },
          update: {
            provider: "airwallex",
            availableCents: balance.availableCents,
            reservedCents: balance.reservedCents,
            pendingCents: balance.pendingCents,
            externalUpdatedAt: balance.externalUpdatedAt ?? null,
            lastSyncedAt: syncedAt,
          },
          create: {
            moneyProviderAccountId: account.id,
            provider: "airwallex",
            currency: balance.currency,
            availableCents: balance.availableCents,
            reservedCents: balance.reservedCents,
            pendingCents: balance.pendingCents,
            externalUpdatedAt: balance.externalUpdatedAt ?? null,
            lastSyncedAt: syncedAt,
          },
        }),
      );
    }
    await tx.moneyProviderAccount.update({
      where: { id: account.id },
      data: {
        rawProviderStatus: jsonValue({
          ...(account.rawProviderStatus &&
          typeof account.rawProviderStatus === "object"
            ? (account.rawProviderStatus as Record<string, unknown>)
            : {}),
          lastBalanceSync: {
            syncedAt: syncedAt.toISOString(),
            balanceCount: normalized.length,
            raw: rawBalances,
          },
        }),
        lastSyncedAt: syncedAt,
      },
    });
    return updatedBalances;
  });

  const refreshed = await prisma.moneyProviderAccount.findUnique({
    where: { id: account.id },
  });
  return {
    account: toProviderDto(refreshed),
    balances: updated.map((balance) =>
      balanceToDto(balance, refreshed ?? account, "provider_sync"),
    ),
    syncedAt: syncedAt.toISOString(),
    message: normalized.length
      ? "Airwallex sandbox wallet balances synced."
      : "Airwallex returned no wallet balances for this sandbox account.",
  };
}

async function createHostedFlow(input: {
  accountId: string;
  userId: string;
  businessProfileId?: string | null;
  accountType?: "individual" | "business" | "brand";
  returnUrl?: string;
  refreshUrl?: string;
}) {
  const isBusinessFlow = Boolean(input.businessProfileId) || input.accountType === "business" || input.accountType === "brand";
  const templateId = isBusinessFlow ? env.airwallexBusinessHostedFlowTemplateId : env.airwallexHostedFlowTemplateId;
  if (!templateId) {
    throw new MoneyProviderError(
      "airwallex_hosted_flow_template_missing",
      isBusinessFlow ? "AIRWALLEX_BUSINESS_HOSTED_FLOW_TEMPLATE_ID is required for business or brand hosted onboarding links." : "AIRWALLEX_HOSTED_FLOW_TEMPLATE_ID is required for hosted onboarding links.",
      503,
    );
  }
  const returnUrl =
    input.returnUrl ??
    webUrl(
      isBusinessFlow ? env.airwallexBusinessOnboardingReturnPath : env.airwallexOnboardingReturnPath,
      isBusinessFlow ? "/account/business?airwallex=return" : "/account/payouts?airwallex=return",
    );
  const errorUrl =
    input.refreshUrl ??
    webUrl(
      isBusinessFlow ? env.airwallexBusinessOnboardingErrorPath : env.airwallexOnboardingErrorPath,
      isBusinessFlow ? "/account/business?airwallex=error" : "/account/payouts?airwallex=error",
    );
  const flow = await airwallexRequest<AirwallexHostedFlowResponse>(
    "/api/v1/hosted_flows/create",
    {
      method: "POST",
      body: {
        account_id: input.accountId,
        return_url: returnUrl,
        error_url: errorUrl,
        template: templateId,
        metadata: {
          userId: input.userId,
          businessProfileId: input.businessProfileId ?? null,
          accountType: input.accountType ?? null,
          provider: "airwallex",
          phase: isBusinessFlow ? "21.6" : "21.2",
        },
      },
    },
  );
  if (!flow.id)
    throw new MoneyProviderError(
      "airwallex_hosted_flow_missing_id",
      "Airwallex did not return a hosted flow ID.",
      502,
    );
  const authorized = await airwallexRequest<AirwallexHostedFlowResponse>(
    `/api/v1/hosted_flows/${encodeURIComponent(flow.id)}/authorize`,
    {
      method: "POST",
      body: { identity: input.userId },
    },
  );
  if (!authorized.url)
    throw new MoneyProviderError(
      "airwallex_onboarding_url_missing",
      "Airwallex did not return an onboarding URL.",
      502,
    );
  return { flow, authorized };
}

export const airwallexMoneyProvider: MoneyProviderAdapter = {
  provider: "airwallex",
  environment: env.airwallexEnv,
  sandboxOnly: true,
  capabilities: [
    "connected_accounts",
    "onboarding_links",
    "wallet_balances",
    "trade_holds",
    "platform_fees",
    "payouts",
    "webhooks",
    "refunds",
    "disputes",
  ],

  isConfigured() {
    return Boolean(
      env.airwallexEnabled &&
      env.airwallexClientId &&
      env.airwallexApiKey &&
      !isAirwallexSandboxBlocked(),
    );
  },

  getPublicStatus() {
    return {
      provider: this.provider,
      environment: this.environment,
      configured: this.isConfigured(),
      sandboxOnly: true,
      capabilities: this.capabilities,
    };
  },

  async getConnectedAccount(
    userId: string,
    businessProfileId?: string | null,
  ): Promise<ProviderAccountDto | null> {
    const account = await getStoredAccount(userId, businessProfileId);
    if (!account) {
      return {
        provider: "airwallex_demo",
        status: "not_connected",
        connectedAt: null,
        sandboxOnly: true,
        message: "Airwallex sandbox connected account is not created yet.",
      };
    }
    return toProviderDto(account);
  },

  async createConnectedAccount(input: CreateConnectedAccountInput) {
    requireAirwallexSandboxConfigured();
    const existing = await getStoredAccount(input.userId, input.businessProfileId);
    if (existing) return toProviderDto(existing)!;

    const [user, businessProfile] = await Promise.all([
      getUserContact(input.userId),
      getBusinessProfileContact(input.userId, input.businessProfileId),
    ]);
    if (input.businessProfileId && !businessProfile) {
      throw new MoneyProviderError(
        "business_profile_not_found",
        "Business or brand profile was not found, or you do not have permission to manage its provider account.",
        404,
      );
    }
    if (!user?.email)
      throw new MoneyProviderError(
        "user_email_required",
        "A verified app email is required before creating an Airwallex connected account.",
        400,
      );

    const accountType =
      input.accountType ??
      (businessProfile
        ? businessProfile.type === "brand" || businessProfile.type === "enterprise"
          ? "brand"
          : "business"
        : env.airwallexDefaultAccountType === "business"
          ? "business"
          : "individual");
    const displayName =
      businessProfile?.legalName ||
      businessProfile?.displayName ||
      user.profile?.displayName ||
      user.email.split("@")[0] ||
      "Hellowhen user";
    const payload =
      accountType === "individual"
        ? {
            account_details: {
              legal_entity_type: legalEntityType(accountType),
            },
            customer_agreements: {
              agreed_to_data_usage: true,
              agreed_to_terms_and_conditions: true,
            },
            primary_contact: { email: user.email },
          }
        : {
            account_details: {
              legal_entity_type: legalEntityType(accountType),
              business_details: { business_name: displayName },
            },
            customer_agreements: {
              agreed_to_data_usage: true,
              agreed_to_terms_and_conditions: true,
            },
            primary_contact: { email: user.email },
          };

    const account = await airwallexRequest<AirwallexAccountResponse>(
      "/api/v1/accounts/create",
      { method: "POST", body: payload },
    );
    const stored = await upsertProviderAccount({
      userId: input.userId,
      businessProfileId: input.businessProfileId ?? null,
      account,
      accountType,
      fallbackCountry: input.country ?? businessProfile?.countryCode ?? user.profile?.countryCode ?? null,
      fallbackCurrency:
        input.defaultCurrency ??
        businessProfile?.preferredCurrency ??
        user.profile?.preferredCurrency ??
        env.airwallexDefaultCurrency,
    });
    return toProviderDto(stored)!;
  },

  async createOnboardingLink(
    input: CreateOnboardingLinkInput,
  ): Promise<ProviderOnboardingLinkResult> {
    requireAirwallexSandboxConfigured();
    let stored = await getStoredAccount(input.userId, input.businessProfileId);
    if (!stored) {
      await this.createConnectedAccount({ userId: input.userId, businessProfileId: input.businessProfileId, accountType: input.accountType });
      stored = await getStoredAccount(input.userId, input.businessProfileId);
    }
    if (!stored)
      throw new MoneyProviderError(
        "airwallex_account_not_found",
        "Airwallex connected account could not be created.",
        502,
      );

    const { flow, authorized } = await createHostedFlow({
      accountId: stored.providerAccountId,
      userId: input.userId,
      businessProfileId: input.businessProfileId,
      accountType: stored.accountType,
      returnUrl: input.returnUrl,
      refreshUrl: input.refreshUrl,
    });
    stored = await prisma.moneyProviderAccount.update({
      where: { id: stored.id },
      data: {
        rawProviderStatus: jsonValue({
          ...(stored.rawProviderStatus &&
          typeof stored.rawProviderStatus === "object"
            ? (stored.rawProviderStatus as Record<string, unknown>)
            : {}),
          hostedFlow: {
            id: flow.id,
            status: flow.status,
            authorizedAt: new Date().toISOString(),
          },
        }),
        lastSyncedAt: new Date(),
      },
    });
    return {
      url: authorized.url!,
      expiresAt: authorized.expires_at ?? null,
      account: toProviderDto(stored),
    };
  },

  async syncConnectedAccountStatus(input: SyncAccountStatusInput) {
    requireAirwallexConnectedAccountsAccess();
    const stored = input.providerAccountId
      ? await prisma.moneyProviderAccount.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "airwallex",
              providerAccountId: input.providerAccountId,
            },
          },
        })
      : input.userId
        ? await getStoredAccount(input.userId, input.businessProfileId)
        : null;
    if (!stored) return null;
    const account = await airwallexRequest<AirwallexAccountResponse>(
      `/api/v1/accounts/${encodeURIComponent(stored.providerAccountId)}`,
    );
    const updated = await upsertProviderAccount({
      userId: stored.userId,
      businessProfileId: stored.businessProfileId,
      account: { ...account, id: account.id ?? stored.providerAccountId },
      accountType: stored.accountType,
      fallbackCountry: stored.country,
      fallbackCurrency: stored.defaultCurrency,
    });
    return toProviderDto(updated);
  },

  async getWalletBalances(input: SyncWalletBalancesInput) {
    const account = await getAccountForBalanceInput(input);
    return {
      account: toProviderDto(account),
      balances: await getStoredWalletBalancesForAccount(account),
      syncedAt: account?.lastSyncedAt
        ? account.lastSyncedAt.toISOString()
        : null,
      message: account
        ? "Stored Airwallex sandbox wallet balances loaded."
        : "No Airwallex sandbox connected account exists yet.",
    };
  },

  async syncWalletBalances(input: SyncWalletBalancesInput) {
    return syncAirwallexWalletBalances(input);
  },

  async createTradeHold(input: CreateTradeHoldInput) {
    requireAirwallexTradeMoneyEnabled();
    const [buyerAccount, sellerAccount] = await Promise.all([
      accountForUser(input.buyerId),
      accountForUser(input.sellerId),
    ]);
    const providerTransactionId = requestId("trade_hold", input.tradeId);
    await upsertProviderTransaction({
      providerTransactionId,
      type: "trade_hold",
      status: "succeeded",
      amountCents: input.amountCents,
      currency: input.currency,
      userId: input.buyerId,
      tradeId: input.tradeId,
      accountId: buyerAccount?.id ?? null,
      counterpartyAccountId: sellerAccount?.id ?? null,
      rawProviderStatus: {
        source: "hellowhen_ledger",
        providerApiCalled: false,
        sandboxOnly: true,
        proposalId: input.proposalId ?? null,
        moneySide: input.moneySide ?? null,
        message:
          "Hellowhen ledger reserved the buyer wallet balance. No Airwallex API hold exists in Phase 21.4.",
      },
    });
    return {
      provider: "airwallex",
      providerTransactionId,
      status: "recorded",
      externalStatus: "HELLOWHEN_LEDGER_HELD",
      sandboxOnly: true,
      message:
        "Trade hold mirrored as a provider transaction record. No Airwallex API hold was created.",
    } satisfies ProviderTradeMoneyResult;
  },

  async releaseTradeHold(input: ReleaseTradeHoldInput) {
    requireAirwallexTradeMoneyEnabled();
    const sellerAccount = await accountForUser(input.sellerId);
    if (!sellerAccount) {
      const failedId = requestId(
        "trade_release_missing_account",
        input.tradeId,
      );
      await upsertProviderTransaction({
        providerTransactionId: failedId,
        type: "trade_release",
        status: "failed",
        amountCents: input.amountCents,
        currency: input.currency,
        userId: input.sellerId,
        tradeId: input.tradeId,
        rawProviderStatus: {
          providerApiCalled: false,
          error: "seller_provider_account_missing",
          sandboxOnly: true,
        },
      });
      throw new MoneyProviderError(
        "seller_provider_account_missing",
        "Seller does not have an Airwallex sandbox connected account for trade-money release.",
        409,
      );
    }
    const transferRequestId = requestId("trade_release", input.tradeId);
    try {
      const transfer = await airwallexRequest<AirwallexFundsMovementResponse>(
        "/api/v1/connected_account_transfers/create",
        {
          method: "POST",
          body: {
            request_id: transferRequestId,
            reference: `hellowhen_trade_${input.tradeId}`,
            amount: centsToProviderAmount(input.amountCents),
            currency: input.currency.toUpperCase(),
            reason: "services",
            destination: sellerAccount.providerAccountId,
          },
        },
      );
      const providerTransactionId =
        transfer.id ?? transfer.request_id ?? transferRequestId;
      await upsertProviderTransaction({
        providerTransactionId,
        type: "trade_release",
        status: providerTransactionStatus(transfer.status),
        amountCents: input.amountCents,
        currency: input.currency,
        userId: input.sellerId,
        tradeId: input.tradeId,
        accountId: sellerAccount.id,
        rawProviderStatus: {
          ...transfer,
          request_id: transferRequestId,
          confirmedById: input.confirmedById ?? null,
          platformFeeCents: input.platformFeeCents ?? 0,
          sandboxOnly: true,
        },
      });
      return toProviderTradeMoneyResult({
        providerTransactionId,
        status: transfer.status ?? "NEW",
        message:
          "Airwallex sandbox connected-account transfer created for trade release.",
      });
    } catch (error) {
      const providerTransactionId = requestId(
        "trade_release_failed",
        input.tradeId,
      );
      const message =
        error instanceof Error
          ? error.message
          : "Airwallex trade release failed.";
      await upsertProviderTransaction({
        providerTransactionId,
        type: "trade_release",
        status: "failed",
        amountCents: input.amountCents,
        currency: input.currency,
        userId: input.sellerId,
        tradeId: input.tradeId,
        accountId: sellerAccount.id,
        rawProviderStatus: {
          providerApiCalled: true,
          error: message,
          sandboxOnly: true,
        },
      });
      throw error;
    }
  },

  async refundTradeHold(input: RefundTradeHoldInput) {
    requireAirwallexTradeMoneyEnabled();
    const buyerAccount = await accountForUser(input.buyerId);
    const sellerAccount = await accountForUser(input.sellerId ?? null);
    if (!input.wasReleased) {
      const providerTransactionId = requestId("trade_refund", input.tradeId);
      await upsertProviderTransaction({
        providerTransactionId,
        type: "refund",
        status: "succeeded",
        amountCents: input.amountCents,
        currency: input.currency,
        userId: input.buyerId,
        tradeId: input.tradeId,
        accountId: buyerAccount?.id ?? null,
        counterpartyAccountId: sellerAccount?.id ?? null,
        rawProviderStatus: {
          source: "hellowhen_ledger",
          providerApiCalled: false,
          refundedById: input.refundedById ?? null,
          reason: input.reason ?? null,
          sandboxOnly: true,
          message:
            "Held Hellowhen ledger balance returned before any Airwallex release transfer.",
        },
      });
      return {
        provider: "airwallex",
        providerTransactionId,
        status: "recorded",
        externalStatus: "HELLOWHEN_LEDGER_REFUNDED",
        sandboxOnly: true,
        message:
          "Refund mirrored as a provider transaction record. No Airwallex API call was required.",
      } satisfies ProviderTradeMoneyResult;
    }
    if (!sellerAccount) {
      const failedId = requestId("trade_refund_missing_account", input.tradeId);
      await upsertProviderTransaction({
        providerTransactionId: failedId,
        type: "refund",
        status: "failed",
        amountCents: input.amountCents,
        currency: input.currency,
        userId: input.buyerId,
        tradeId: input.tradeId,
        accountId: buyerAccount?.id ?? null,
        rawProviderStatus: {
          providerApiCalled: false,
          error: "seller_provider_account_missing",
          sandboxOnly: true,
        },
      });
      throw new MoneyProviderError(
        "seller_provider_account_missing",
        "Seller does not have an Airwallex sandbox connected account to reverse a released trade transfer.",
        409,
      );
    }
    const chargeRequestId = requestId("trade_refund_charge", input.tradeId);
    try {
      const charge = await airwallexRequest<AirwallexFundsMovementResponse>(
        "/api/v1/charges/create",
        {
          method: "POST",
          body: {
            request_id: chargeRequestId,
            reference: `hellowhen_trade_refund_${input.tradeId}`,
            amount: centsToProviderAmount(input.amountCents),
            currency: input.currency.toUpperCase(),
            reason: "refund",
            source: sellerAccount.providerAccountId,
          },
        },
      );
      const providerTransactionId =
        charge.id ?? charge.request_id ?? chargeRequestId;
      await upsertProviderTransaction({
        providerTransactionId,
        type: "refund",
        status: providerTransactionStatus(charge.status),
        amountCents: input.amountCents,
        currency: input.currency,
        userId: input.buyerId,
        tradeId: input.tradeId,
        accountId: buyerAccount?.id ?? null,
        counterpartyAccountId: sellerAccount.id,
        rawProviderStatus: {
          ...charge,
          request_id: chargeRequestId,
          refundedById: input.refundedById ?? null,
          reason: input.reason ?? null,
          sandboxOnly: true,
        },
      });
      return toProviderTradeMoneyResult({
        providerTransactionId,
        status: charge.status ?? "NEW",
        message:
          "Airwallex sandbox charge created to reverse a released trade transfer.",
      });
    } catch (error) {
      const providerTransactionId = requestId(
        "trade_refund_failed",
        input.tradeId,
      );
      const message =
        error instanceof Error
          ? error.message
          : "Airwallex trade refund failed.";
      await upsertProviderTransaction({
        providerTransactionId,
        type: "refund",
        status: "failed",
        amountCents: input.amountCents,
        currency: input.currency,
        userId: input.buyerId,
        tradeId: input.tradeId,
        accountId: buyerAccount?.id ?? null,
        counterpartyAccountId: sellerAccount.id,
        rawProviderStatus: {
          providerApiCalled: true,
          error: message,
          sandboxOnly: true,
        },
      });
      throw error;
    }
  },

  async createPayoutTransfer(input: CreatePayoutTransferInput) {
    requireAirwallexPayoutsEnabled();
    const account = await accountForUser(input.userId);
    if (!account) {
      throw new MoneyProviderError(
        "airwallex_payout_account_missing",
        "User does not have an Airwallex sandbox connected account for payout transfer testing.",
        409,
      );
    }
    if (!["active", "pending"].includes(account.status)) {
      throw new MoneyProviderError(
        "airwallex_payout_account_not_ready",
        "Airwallex sandbox connected account must be pending or active before payout transfer testing.",
        409,
      );
    }

    const attempt = await payoutTransferAttemptNumber(input.payoutId);
    const transferRequestId = payoutRequestId("payout", input.payoutId, attempt);
    const transfer = await airwallexRequest<AirwallexTransferResponse>(
      "/api/v1/transfers/create",
      {
        method: "POST",
        onBehalfOf: account.providerAccountId,
        scaToken: input.scaToken ?? undefined,
        body: {
          beneficiary_id: env.airwallexSandboxPayoutBeneficiaryId,
          transfer_amount: centsToProviderAmount(input.netAmountCents).toFixed(2),
          transfer_currency: input.currency.toUpperCase(),
          source_currency: input.currency.toUpperCase(),
          transfer_method: env.airwallexSandboxPayoutTransferMethod,
          reason: env.airwallexSandboxPayoutReason,
          reference: `hellowhen_payout_${input.payoutId}`.slice(0, 140),
          request_id: transferRequestId,
          metadata: {
            hellowhenPayoutId: input.payoutId,
            grossAmountCents: input.grossAmountCents,
            platformFeeCents: input.platformFeeCents,
            netAmountCents: input.netAmountCents,
            sandboxOnly: true,
            requestedById: input.requestedById ?? null,
          },
        },
      },
    );
    const rawStatus = transferStatus(transfer);
    const providerTransactionId = transferId(transfer) ?? transferRequestId;
    await upsertProviderTransaction({
      providerTransactionId,
      type: "payout",
      status: providerTransactionStatus(rawStatus),
      amountCents: input.netAmountCents,
      currency: input.currency,
      userId: input.userId,
      payoutRequestId: input.payoutId,
      accountId: account.id,
      rawProviderStatus: {
        ...transfer,
        request_id: transferRequestId,
        grossAmountCents: input.grossAmountCents,
        platformFeeCents: input.platformFeeCents,
        netAmountCents: input.netAmountCents,
        sandboxOnly: true,
        phase: "21.5",
      },
    });
    const payout = await applyPayoutProviderStatus({
      payoutId: input.payoutId,
      providerAccountId: account.id,
      providerTransferId: providerTransactionId,
      providerPayoutId: transfer.id ?? providerTransactionId,
      rawStatus,
      failureMessage: payoutTransferFailure(transfer),
    });
    return {
      id: providerTransactionId,
      provider: "airwallex",
      status: rawStatus,
      providerTransactionId,
      externalStatus: rawStatus,
      payoutRequestStatus: payout.status,
      sandboxOnly: true,
      message: "Airwallex sandbox payout transfer created. Status updates should be reconciled through webhooks or admin sync.",
    };
  },

  async syncPayoutTransfer(input: SyncPayoutTransferInput) {
    requireAirwallexConnectedAccountsAccess();
    const payout = input.payoutId
      ? await prisma.payoutRequest.findUnique({
          where: { id: input.payoutId },
          include: { providerAccount: true },
        })
      : input.providerTransferId
        ? await prisma.payoutRequest.findFirst({
            where: {
              provider: "airwallex",
              OR: [
                { providerTransferId: input.providerTransferId },
                { providerPayoutId: input.providerTransferId },
              ],
            },
            include: { providerAccount: true },
          })
        : null;
    if (!payout?.providerTransferId) {
      throw new MoneyProviderError(
        "airwallex_payout_transfer_not_found",
        "No Airwallex sandbox payout transfer is linked to this payout request yet.",
        404,
      );
    }
    const account = payout.providerAccount ?? (await accountForUser(payout.userId));
    if (!account) {
      throw new MoneyProviderError(
        "airwallex_payout_account_missing",
        "No Airwallex sandbox connected account is linked to this payout transfer.",
        409,
      );
    }
    const transfer = await airwallexRequest<AirwallexTransferResponse>(
      `/api/v1/transfers/${encodeURIComponent(payout.providerTransferId)}`,
      { onBehalfOf: account.providerAccountId, scaToken: input.scaToken ?? undefined },
    );
    const rawStatus = transferStatus(transfer);
    const providerTransactionId = transferId(transfer) ?? payout.providerTransferId;
    await upsertProviderTransaction({
      providerTransactionId,
      type: "payout",
      status: providerTransactionStatus(rawStatus),
      amountCents: payout.netAmountCents,
      currency: payout.currency,
      userId: payout.userId,
      payoutRequestId: payout.id,
      accountId: account.id,
      rawProviderStatus: { ...transfer, sandboxOnly: true, syncSource: "admin_or_webhook" },
    });
    const updated = await applyPayoutProviderStatus({
      payoutId: payout.id,
      providerAccountId: account.id,
      providerTransferId: providerTransactionId,
      providerPayoutId: transfer.id ?? providerTransactionId,
      rawStatus,
      failureMessage: payoutTransferFailure(transfer),
    });
    return {
      id: providerTransactionId,
      provider: "airwallex",
      status: rawStatus,
      providerTransactionId,
      externalStatus: rawStatus,
      payoutRequestStatus: updated.status,
      sandboxOnly: true,
      message: "Airwallex sandbox payout transfer status synced.",
    };
  },
};
