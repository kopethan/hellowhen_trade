import type { InventoryItemType, MediaAssetDto, NeedDto, OfferDto } from '@hellowhen/contracts';
import type { SupportedLanguage, TranslationValues } from '@hellowhen/i18n';
import { resolveWebAssetUrl } from '../../lib/api';
import { formatWebDate } from '../../lib/webFormat';

export type InventoryKind = 'need' | 'offer';
export type InventoryItem = NeedDto | OfferDto;

export type InventoryI18n = {
  t?: (key: string, values?: TranslationValues) => string;
  language?: SupportedLanguage;
};

function tr(i18n: InventoryI18n | undefined, key: string, fallback: string, values?: TranslationValues) {
  const value = i18n?.t?.(key, values);
  return value && value !== key ? value : fallback;
}

export type InventoryFormValues = {
  title: string;
  description: string;
  status: string;
  itemType: InventoryItemType;
  category: string;
  timing: string;
  availability: string;
  mode: string;
  locationLabel: string;
  tags: string;
  includes: string;
  expiresAt: string;
};

export const emptyInventoryFormValues: InventoryFormValues = {
  title: '',
  description: '',
  status: 'active',
  itemType: 'service',
  category: '',
  timing: '',
  availability: '',
  mode: 'remote',
  locationLabel: '',
  tags: '',
  includes: '',
  expiresAt: '',
};

export function isNeed(item: InventoryItem): item is NeedDto {
  return 'timing' in item;
}

export function kindLabel(kind: InventoryKind, i18n?: InventoryI18n) {
  return kind === 'need' ? tr(i18n, 'inventory.labels.need', 'Need') : tr(i18n, 'inventory.labels.offer', 'Offer');
}

export function kindPluralLabel(kind: InventoryKind, i18n?: InventoryI18n) {
  return kind === 'need' ? tr(i18n, 'inventory.labels.needs', 'Needs') : tr(i18n, 'inventory.labels.offers', 'Offers');
}

export function sideLabel(kind: InventoryKind, i18n?: InventoryI18n) {
  return kind === 'need' ? tr(i18n, 'inventory.side.need', 'I need') : tr(i18n, 'inventory.side.offer', 'I offer');
}

export function itemTypeLabel(itemType?: InventoryItemType | null, i18n?: InventoryI18n) {
  if (itemType === 'goods') return tr(i18n, 'inventory.itemTypes.goods', 'Goods');
  if (itemType === 'other') return tr(i18n, 'inventory.itemTypes.other', 'Other');
  return tr(i18n, 'inventory.itemTypes.service', 'Service');
}

export function itemTypePluralLabel(itemType?: InventoryItemType | 'all' | null, i18n?: InventoryI18n) {
  if (itemType === 'all') return tr(i18n, 'inventory.itemTypes.all', 'All');
  if (itemType === 'goods') return tr(i18n, 'inventory.itemTypes.goods', 'Goods');
  if (itemType === 'other') return tr(i18n, 'inventory.itemTypes.other', 'Other');
  return tr(i18n, 'inventory.itemTypes.services', 'Services');
}

export function modeLabel(mode?: string | null, i18n?: InventoryI18n) {
  if (mode === 'remote') return tr(i18n, 'inventory.modes.remote', 'Remote');
  if (mode === 'local') return tr(i18n, 'inventory.modes.local', 'Local');
  if (mode === 'hybrid') return tr(i18n, 'inventory.modes.hybrid', 'Hybrid');
  return null;
}

export function inventoryStatusLabel(status?: string | null, i18n?: InventoryI18n) {
  if (!status) return tr(i18n, 'inventory.labels.notSpecified', 'Not specified');
  return tr(i18n, `inventory.statuses.${status}`, status.replace(/_/g, ' '));
}

export function sideClassName(kind: InventoryKind) {
  return kind === 'need' ? 'need' : 'offer';
}

export function getInventoryMetadata(item: InventoryItem, i18n?: InventoryI18n) {
  const timing = isNeed(item) ? item.timing : item.availability;
  return [itemTypeLabel(item.itemType, i18n), item.category, timing, modeLabel(item.mode, i18n), item.locationLabel]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' · ');
}

export function getInventoryTags(item: InventoryItem) {
  const base = item.tags ?? [];
  if (isNeed(item)) return base;
  return [...(item.includes ?? []), ...base];
}

export function inventoryToFormValues(item?: InventoryItem | null): InventoryFormValues {
  if (!item) return emptyInventoryFormValues;
  return {
    title: item.title ?? '',
    description: item.description ?? '',
    status: item.status ?? 'active',
    itemType: item.itemType ?? 'service',
    category: item.category ?? '',
    timing: isNeed(item) ? item.timing ?? '' : '',
    availability: isNeed(item) ? '' : item.availability ?? '',
    mode: item.mode ?? 'remote',
    locationLabel: item.locationLabel ?? '',
    tags: (item.tags ?? []).join(', '),
    includes: isNeed(item) ? '' : (item.includes ?? []).join('\n'),
    expiresAt: item.expiresAt ? item.expiresAt.slice(0, 10) : '',
  };
}

export function parseCsvList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

export function parseLineList(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

export function toIsoDate(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function formatInventoryDate(value?: string | null, i18n?: InventoryI18n) {
  return formatWebDate(value, tr(i18n, 'trade.expiry.noExpiry', 'No expiry'), i18n?.language);
}

export function mediaSrc(media: MediaAssetDto) {
  return resolveWebAssetUrl(media.url, media.storageKey);
}

export function normalizeInventoryList(value: unknown, kind: InventoryKind): InventoryItem[] {
  if (Array.isArray(value)) return value as InventoryItem[];
  if (!value || typeof value !== 'object') return [];
  const record = value as { needs?: unknown[]; offers?: unknown[]; items?: unknown[] };
  if (kind === 'need' && Array.isArray(record.needs)) return record.needs as NeedDto[];
  if (kind === 'offer' && Array.isArray(record.offers)) return record.offers as OfferDto[];
  if (Array.isArray(record.items)) return record.items as InventoryItem[];
  return [];
}

export function normalizeInventoryItem(value: unknown, kind: InventoryKind): InventoryItem | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { id?: unknown; title?: unknown; need?: unknown; offer?: unknown };
  if (typeof record.id === 'string' && typeof record.title === 'string') return value as InventoryItem;
  const nested = kind === 'need' ? record.need : record.offer;
  if (nested && typeof nested === 'object') return nested as InventoryItem;
  return null;
}

export function normalizeMediaUpload(value: unknown): MediaAssetDto | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { media?: unknown; id?: unknown; url?: unknown };
  if (record.media && typeof record.media === 'object') return record.media as MediaAssetDto;
  if (typeof record.id === 'string' && typeof record.url === 'string') return value as MediaAssetDto;
  return null;
}
