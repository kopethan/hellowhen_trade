import type { InventoryItemType, MediaAssetDto, NeedDto, OfferDto } from '@hellowhen/contracts';
import { resolveWebAssetUrl } from '../../lib/api';
import { formatWebDate } from '../../lib/webFormat';

export type InventoryKind = 'need' | 'offer';
export type InventoryItem = NeedDto | OfferDto;

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
  mode: '',
  locationLabel: '',
  tags: '',
  includes: '',
  expiresAt: '',
};

export function isNeed(item: InventoryItem): item is NeedDto {
  return 'timing' in item;
}

export function kindLabel(kind: InventoryKind) {
  return kind === 'need' ? 'Need' : 'Offer';
}

export function sideLabel(kind: InventoryKind) {
  return kind === 'need' ? 'I need' : 'I offer';
}

export function itemTypeLabel(itemType?: InventoryItemType | null) {
  if (itemType === 'goods') return 'Goods';
  if (itemType === 'other') return 'Other';
  return 'Service';
}

export function sideClassName(kind: InventoryKind) {
  return kind === 'need' ? 'need' : 'offer';
}

export function getInventoryMetadata(item: InventoryItem) {
  const timing = isNeed(item) ? item.timing : item.availability;
  return [itemTypeLabel(item.itemType), item.category, timing, item.mode, item.locationLabel]
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
    mode: item.mode ?? '',
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

export function formatInventoryDate(value?: string | null) {
  return formatWebDate(value, 'No expiry');
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
