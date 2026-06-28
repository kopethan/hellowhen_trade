/**
 * Shared placement helper for starter idea templates.
 *
 * Starter ideas are inspiration templates, not fake user activity. Keep this helper
 * deterministic so server-rendered feeds and hydrated clients agree on the initial
 * layout.
 */
export type StarterIdeaPlacement<Key extends string> = {
  inlineIdeaKeysByAfterIndex: Partial<Record<number, Key>>;
  appendedIdeaKeys: Key[];
};

export type StarterIdeaPlacementOptions = {
  realItemCount: number;
  ideaKeys: readonly string[];
  visibleLimit: number;
  sparseFeedThreshold?: number;
  denseFeedThreshold?: number;
  insertAfterEveryRealItems?: number;
};

export function createEmptyStarterIdeaPlacement<Key extends string>(): StarterIdeaPlacement<Key> {
  return {
    inlineIdeaKeysByAfterIndex: {},
    appendedIdeaKeys: [],
  };
}

export function getUniqueStarterIdeaKeys<Key extends string>(keys: readonly Key[]) {
  const seen = new Set<Key>();
  const uniqueKeys: Key[] = [];

  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueKeys.push(key);
  }

  return uniqueKeys;
}

export function buildStarterIdeaPlacement<Key extends string>({
  realItemCount,
  ideaKeys,
  visibleLimit,
  sparseFeedThreshold = 4,
  denseFeedThreshold = 40,
  insertAfterEveryRealItems = 4,
}: StarterIdeaPlacementOptions & { ideaKeys: readonly Key[] }): StarterIdeaPlacement<Key> {
  if (realItemCount >= denseFeedThreshold || visibleLimit <= 0 || insertAfterEveryRealItems <= 0) {
    return createEmptyStarterIdeaPlacement<Key>();
  }

  const visibleIdeaKeys = getUniqueStarterIdeaKeys(ideaKeys).slice(0, Math.max(0, visibleLimit));
  if (!visibleIdeaKeys.length) return createEmptyStarterIdeaPlacement<Key>();

  if (realItemCount < sparseFeedThreshold) {
    return {
      inlineIdeaKeysByAfterIndex: {},
      appendedIdeaKeys: [...visibleIdeaKeys],
    };
  }

  const inlineIdeaKeysByAfterIndex: Partial<Record<number, Key>> = {};
  const inlineIdeaCount = Math.min(Math.floor(realItemCount / insertAfterEveryRealItems), visibleIdeaKeys.length);

  for (let ideaIndex = 0; ideaIndex < inlineIdeaCount; ideaIndex += 1) {
    const afterIndex = ((ideaIndex + 1) * insertAfterEveryRealItems) - 1;
    inlineIdeaKeysByAfterIndex[afterIndex] = visibleIdeaKeys[ideaIndex];
  }

  return {
    inlineIdeaKeysByAfterIndex,
    appendedIdeaKeys: visibleIdeaKeys.slice(inlineIdeaCount),
  };
}

export function getInlineStarterIdeaKey<Key extends string>(index: number, placement: StarterIdeaPlacement<Key>): Key | null {
  return placement.inlineIdeaKeysByAfterIndex[index] ?? null;
}

export type FeedItemWithStarterIdeas<RealItem extends object, IdeaKey extends string> = RealItem | { type: 'idea'; ideaKey: IdeaKey };

export function buildFeedItemsWithStarterIdeas<RealItem extends object, IdeaKey extends string>(
  realItemCount: number,
  placement: StarterIdeaPlacement<IdeaKey>,
  createRealItem: (index: number) => RealItem,
): Array<FeedItemWithStarterIdeas<RealItem, IdeaKey>> {
  const items: Array<FeedItemWithStarterIdeas<RealItem, IdeaKey>> = [];

  for (let realItemIndex = 0; realItemIndex < realItemCount; realItemIndex += 1) {
    items.push(createRealItem(realItemIndex));
    const inlineIdeaKey = getInlineStarterIdeaKey(realItemIndex, placement);
    if (inlineIdeaKey) items.push({ type: 'idea', ideaKey: inlineIdeaKey });
  }

  for (const ideaKey of placement.appendedIdeaKeys) {
    items.push({ type: 'idea', ideaKey });
  }

  return items;
}
