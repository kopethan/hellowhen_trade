import type { LedgerEntryDto, PayoutRequestDto, PayoutSummaryDto, WalletDto } from '@hellowhen/contracts';
import { API_URL } from '../../lib/api';

export const fallbackCurrency = 'eur';

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

export function formatMoney(cents = 0, currency = fallbackCurrency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ledgerLabel(type: string) {
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

export function payoutStatusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function moneyDeltaClassName(cents: number) {
  if (cents > 0) return 'success';
  if (cents < 0) return 'danger';
  return 'instruction';
}


export function assetUrl(value?: string | null) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  const base = API_URL.replace(/\/$/, '');
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${base}${path}`;
}

export function parseMoneyInputToCents(value: string) {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}
