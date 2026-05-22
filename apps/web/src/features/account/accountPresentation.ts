import type { LedgerEntryDto, MoneySafetyStatusDto, PayoutRequestDto, PayoutSummaryDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { resolveWebAssetUrl } from '../../lib/api';
import { formatWebDateTime, formatWebMoney } from '../../lib/webFormat';
import type { SupportedLanguage, TranslationValues } from '@hellowhen/i18n';

export const fallbackCurrency = 'eur';

export const defaultPayoutPlatformFeeRateBps = 1000;

export function normalizePayoutFeeRateBps(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultPayoutPlatformFeeRateBps;
  return Math.min(Math.max(Math.trunc(value), 0), 5000);
}

export function calculatePayoutFeeCents(grossAmountCents: number, platformFeeRateBps = defaultPayoutPlatformFeeRateBps) {
  const gross = Math.max(0, Math.trunc(grossAmountCents || 0));
  const rate = normalizePayoutFeeRateBps(platformFeeRateBps);
  if (gross <= 0 || rate <= 0) return 0;
  return Math.min(gross, Math.round((gross * rate) / 10000));
}

export function getPayoutGrossCents(payout: PayoutRequestDto) {
  return payout.grossAmountCents && payout.grossAmountCents > 0 ? payout.grossAmountCents : payout.amountCents;
}

export function getPayoutFeeCents(payout: PayoutRequestDto, fallbackRateBps = defaultPayoutPlatformFeeRateBps) {
  if (typeof payout.platformFeeCents === 'number' && (payout.platformFeeCents > 0 || (payout.netAmountCents ?? 0) > 0)) return payout.platformFeeCents;
  return calculatePayoutFeeCents(getPayoutGrossCents(payout), payout.platformFeeRateBps ?? fallbackRateBps);
}

export function getPayoutNetCents(payout: PayoutRequestDto, fallbackRateBps = defaultPayoutPlatformFeeRateBps) {
  if (payout.netAmountCents && payout.netAmountCents > 0) return payout.netAmountCents;
  return Math.max(0, getPayoutGrossCents(payout) - getPayoutFeeCents(payout, fallbackRateBps));
}

export function formatPayoutFeeRate(platformFeeRateBps = defaultPayoutPlatformFeeRateBps) {
  const rate = normalizePayoutFeeRateBps(platformFeeRateBps);
  return `${Number((rate / 100).toFixed(2))}%`;
}

export function normalizeWallet(payload: unknown): WalletDto | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { id?: unknown; wallet?: unknown };
  if (typeof record.id === 'string') return payload as WalletDto;
  return record.wallet && typeof record.wallet === 'object' ? record.wallet as WalletDto : null;
}

export function normalizeLedger(payload: unknown): LedgerEntryDto[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as LedgerEntryDto[];
  if (typeof payload !== 'object') return [];
  const record = payload as { entries?: unknown };
  return Array.isArray(record.entries) ? record.entries as LedgerEntryDto[] : [];
}

export function normalizePayouts(payload: unknown) {
  if (!payload || typeof payload !== 'object') return { wallet: null, payouts: [] as PayoutRequestDto[], summary: null as PayoutSummaryDto | null };
  const record = payload as { wallet?: unknown; payouts?: unknown; summary?: unknown };
  return {
    wallet: record.wallet && typeof record.wallet === 'object' ? record.wallet as WalletDto : null,
    payouts: Array.isArray(record.payouts) ? record.payouts as PayoutRequestDto[] : [],
    summary: record.summary && typeof record.summary === 'object' ? record.summary as PayoutSummaryDto : null,
  };
}

export function formatMoney(cents = 0, currency = fallbackCurrency, language?: SupportedLanguage) {
  return formatWebMoney(cents, currency, language);
}

export function formatDateTime(value?: string | null, language?: SupportedLanguage) {
  return formatWebDateTime(value, '—', language);
}

export function ledgerLabel(type: string, t?: (key: string, values?: TranslationValues) => string) {
  const localized = t?.(`account.ledger.${type}`);
  if (localized && localized !== `account.ledger.${type}`) return localized;
  const labels: Record<string, string> = {
    starting_demo_credits: 'Starting demo balance',
    test_credit_grant: 'Demo top-up',
    credit_purchase: 'Wallet top-up',
    trade_hold: 'Held for trade',
    trade_release: 'Released from trade',
    trade_refund: 'Trade refund',
    earned_pending: 'Trade earnings',
    platform_fee: 'Platform fee',
    platform_fee_placeholder: 'Platform fee estimate',
    payout_requested: 'Payout requested',
    payout_paid: 'Payout paid',
    adjustment: 'Wallet adjustment',
  };
  return labels[type] ?? type.replace(/_/g, ' ');
}

export function payoutStatusLabel(status: string, t?: (key: string, values?: TranslationValues) => string) {
  const localized = t?.(`account.payoutStatuses.${status}`);
  if (localized && localized !== `account.payoutStatuses.${status}`) return localized;
  return status.replace(/_/g, ' ');
}

export function moneyLaunchModeLabel(mode: string, t?: (key: string, values?: TranslationValues) => string) {
  const localized = t?.(`account.moneySafety.launchModes.${mode}`);
  if (localized && localized !== `account.moneySafety.launchModes.${mode}`) return localized;
  return mode.replace(/_/g, ' ');
}

export function moneySafetyMessage(status: MoneySafetyStatusDto, t?: (key: string, values?: TranslationValues) => string) {
  if (status.launchMode === 'disabled') return t?.('account.moneySafety.messages.disabled') ?? status.message;
  if (!status.privateBetaAllowed) return t?.('account.moneySafety.messages.privateBeta') ?? status.message;
  if (status.policyAcknowledgementRequired && !status.policyAcknowledged) return t?.('account.moneySafety.messages.policyRequired') ?? status.message;
  if (status.launchMode === 'production') return t?.('account.moneySafety.messages.production') ?? status.message;
  return t?.('account.moneySafety.messages.demoOrBeta') ?? status.message;
}

export function moneyDeltaClassName(cents: number) {
  if (cents > 0) return 'success';
  if (cents < 0) return 'danger';
  return 'instruction';
}


export function assetUrl(value?: string | null) {
  const raw = value?.trim() ?? '';
  if (!raw) return '';
  if (/^(data|blob|file|javascript|vbscript):/i.test(raw)) return '';
  return resolveWebAssetUrl(raw);
}


export function businessTypeLabel(type: string, t?: (key: string, values?: TranslationValues) => string) {
  const localized = t?.(`account.business.types.${type}`);
  if (localized && localized !== `account.business.types.${type}`) return localized;
  return type.replace(/_/g, ' ');
}

export function businessStatusLabel(status: string, t?: (key: string, values?: TranslationValues) => string) {
  const localized = t?.(`account.business.statuses.${status}`);
  if (localized && localized !== `account.business.statuses.${status}`) return localized;
  return status.replace(/_/g, ' ');
}

export function trustTierLabel(tier?: string | null, t?: (key: string, values?: TranslationValues) => string) {
  const key = tier || 'new';
  const localized = t?.(`account.trustTiers.${key}`);
  if (localized && localized !== `account.trustTiers.${key}`) return localized;
  const labels: Record<string, string> = {
    new: 'New account',
    email_verified: 'Email verified',
    stripe_verified: 'Payout verified',
    trusted: 'Trusted',
    restricted: 'Restricted',
  };
  return tier ? labels[tier] ?? tier.replace(/_/g, ' ') : labels.new;
}

export function formatLimitCount(used = 0, limit = 0) {
  if (limit <= 0) return `${used} / 0`;
  return `${used} / ${limit}`;
}

export function normalizeLimits(payload: unknown): WalletLimitsDto | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { limits?: unknown; effectiveTrustTier?: unknown };
  if (record.limits && typeof record.limits === 'object') return record.limits as WalletLimitsDto;
  return typeof record.effectiveTrustTier === 'string' ? payload as WalletLimitsDto : null;
}

export function parseMoneyInputToCents(value: string) {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}
