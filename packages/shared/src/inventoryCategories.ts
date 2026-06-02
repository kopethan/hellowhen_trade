export type InventoryCategoryValue = typeof inventoryCategoryOptions[number]['value'];

export type InventoryCategoryOption = {
  value: string;
  labelKey: string;
};

export const inventoryCategoryOptions = [
  { value: 'Design', labelKey: 'inventory.categories.design' },
  { value: 'Development', labelKey: 'inventory.categories.development' },
  { value: 'Photography / Video', labelKey: 'inventory.categories.photographyVideo' },
  { value: 'Writing / Copywriting', labelKey: 'inventory.categories.writingCopywriting' },
  { value: 'Translation / Language', labelKey: 'inventory.categories.translationLanguage' },
  { value: 'Marketing / Social Media', labelKey: 'inventory.categories.marketingSocial' },
  { value: 'Business / Startup', labelKey: 'inventory.categories.businessStartup' },
  { value: 'Education / Tutoring', labelKey: 'inventory.categories.educationTutoring' },
  { value: 'Local Help', labelKey: 'inventory.categories.localHelp' },
  { value: 'Events / Community', labelKey: 'inventory.categories.eventsCommunity' },
  { value: 'Sports / Outdoor', labelKey: 'inventory.categories.sportsOutdoor' },
  { value: 'Creative / Art', labelKey: 'inventory.categories.creativeArt' },
  { value: 'Health / Wellness', labelKey: 'inventory.categories.healthWellness' },
  { value: 'Home / Practical Help', labelKey: 'inventory.categories.homePractical' },
  { value: 'Other', labelKey: 'inventory.categories.other' },
] as const satisfies readonly InventoryCategoryOption[];

export function findInventoryCategoryOption(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return inventoryCategoryOptions.find((option) => option.value.toLowerCase() === normalized) ?? null;
}
