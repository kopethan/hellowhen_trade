import type { Prisma, PrismaClient } from '@prisma/client';
import { normalizeInventoryLanguageCode, withResolvedInventoryDisplay, type InventoryTranslationLike } from '@hellowhen/shared';
import type { DiscoveryLanguage } from '@hellowhen/contracts';

type InventoryTranslationTargetType = 'need' | 'offer' | 'place';
type InventoryTranslationInput = { languageCode: DiscoveryLanguage; title: string; description: string };
type StoredInventoryTranslation = InventoryTranslationLike & { id?: string; targetType?: InventoryTranslationTargetType; targetId?: string; createdAt?: Date; updatedAt?: Date };
type InventoryWithId = { id: string; defaultLanguage?: string | null; title?: string | null; description?: string | null; translations?: StoredInventoryTranslation[] | null };
type TxClient = PrismaClient | Prisma.TransactionClient;

function normalizeTranslations(input: InventoryTranslationInput[] | undefined, defaultLanguage: string) {
  const defaultCode = normalizeInventoryLanguageCode(defaultLanguage) ?? 'en';
  const byLanguage = new Map<DiscoveryLanguage, InventoryTranslationInput>();

  for (const translation of input ?? []) {
    const languageCode = normalizeInventoryLanguageCode(translation.languageCode);
    if (!languageCode || languageCode === defaultCode) continue;
    const title = translation.title.trim();
    const description = translation.description.trim();
    if (!title || !description) continue;
    byLanguage.set(languageCode, { languageCode, title, description });
  }

  return [...byLanguage.values()];
}

export function inventoryTranslationExtraText(translations: InventoryTranslationInput[] | undefined) {
  return (translations ?? []).flatMap((translation) => [translation.title, translation.description]).filter(Boolean);
}

export async function syncInventoryTranslations(
  prisma: TxClient,
  targetType: InventoryTranslationTargetType,
  targetId: string,
  createdById: string,
  defaultLanguage: string,
  input: InventoryTranslationInput[] | undefined,
) {
  if (input === undefined) return;
  const translations = normalizeTranslations(input, defaultLanguage);
  const keepLanguageCodes = translations.map((translation) => translation.languageCode);

  await prisma.inventoryTranslation.deleteMany({
    where: {
      targetType,
      targetId,
      ...(keepLanguageCodes.length ? { languageCode: { notIn: keepLanguageCodes } } : {}),
    },
  });

  for (const translation of translations) {
    await prisma.inventoryTranslation.upsert({
      where: { targetType_targetId_languageCode: { targetType, targetId, languageCode: translation.languageCode } },
      update: { title: translation.title, description: translation.description },
      create: { targetType, targetId, languageCode: translation.languageCode, title: translation.title, description: translation.description, createdById },
    });
  }
}

export async function loadInventoryTranslationsByTargetIds(
  prisma: TxClient,
  targetType: InventoryTranslationTargetType,
  targetIds: string[],
) {
  const uniqueIds = [...new Set(targetIds.filter(Boolean))];
  const map = new Map<string, StoredInventoryTranslation[]>();
  if (!uniqueIds.length) return map;

  const translations = await prisma.inventoryTranslation.findMany({
    where: { targetType, targetId: { in: uniqueIds } },
    orderBy: { languageCode: 'asc' },
  });

  for (const translation of translations) {
    const current = map.get(translation.targetId) ?? [];
    current.push(translation);
    map.set(translation.targetId, current);
  }

  return map;
}

export async function withInventoryTranslations<T extends InventoryWithId>(
  prisma: TxClient,
  targetType: InventoryTranslationTargetType,
  items: T[],
): Promise<T[]> {
  const translationsByTargetId = await loadInventoryTranslationsByTargetIds(prisma, targetType, items.map((item) => item.id));
  return items.map((item) => ({ ...item, translations: translationsByTargetId.get(item.id) ?? [] }));
}

export async function withOneInventoryTranslation<T extends InventoryWithId>(
  prisma: TxClient,
  targetType: InventoryTranslationTargetType,
  item: T,
): Promise<T> {
  const [hydrated] = await withInventoryTranslations(prisma, targetType, [item]);
  return hydrated ?? ({ ...item, translations: [] } as T);
}

export function applyInventoryDisplayLanguage<T extends InventoryWithId>(items: T[], viewerLanguage?: string | null, preferredLanguages?: readonly (string | null | undefined)[] | null): T[] {
  return items.map((item) => withResolvedInventoryDisplay(item, viewerLanguage, preferredLanguages) as T);
}

export function applyInventoryDisplayLanguageToTrade<T extends { need?: InventoryWithId | null; offer?: InventoryWithId | null }>(trade: T, viewerLanguage?: string | null, preferredLanguages?: readonly (string | null | undefined)[] | null): T {
  return {
    ...trade,
    need: trade.need ? withResolvedInventoryDisplay(trade.need, viewerLanguage, preferredLanguages) : trade.need,
    offer: trade.offer ? withResolvedInventoryDisplay(trade.offer, viewerLanguage, preferredLanguages) : trade.offer,
  };
}

export function applyInventoryDisplayLanguageToTrades<T extends { need?: InventoryWithId | null; offer?: InventoryWithId | null }>(trades: T[], viewerLanguage?: string | null, preferredLanguages?: readonly (string | null | undefined)[] | null): T[] {
  return trades.map((trade) => applyInventoryDisplayLanguageToTrade(trade, viewerLanguage, preferredLanguages));
}
