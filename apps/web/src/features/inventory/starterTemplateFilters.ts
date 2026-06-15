import type { InventoryTemplateDto } from '@hellowhen/contracts';

export type StarterPackFilter = 'all' | 'creative' | 'startup' | 'languageAdmin' | 'local' | 'objectsAccess';

export const STARTER_PACK_FILTERS: Array<{ value: StarterPackFilter; key: string }> = [
  { value: 'all', key: 'inventory.starterPacks.all' },
  { value: 'creative', key: 'inventory.starterPacks.creative' },
  { value: 'startup', key: 'inventory.starterPacks.startup' },
  { value: 'languageAdmin', key: 'inventory.starterPacks.languageAdmin' },
  { value: 'local', key: 'inventory.starterPacks.local' },
  { value: 'objectsAccess', key: 'inventory.starterPacks.objectsAccess' },
];

const PACK_KEYWORDS: Record<Exclude<StarterPackFilter, 'all'>, string[]> = {
  creative: [
    'photo',
    'photos',
    'portrait',
    'product-photos',
    'photography',
    'video',
    'reel',
    'filming',
    'visual',
    'visuals',
    'logo',
    'branding',
    'brand-colors',
    'canva',
    'instagram',
    'social-post',
    'content',
    'background',
  ],
  startup: [
    'app-flow',
    'app-test',
    'first-real-user',
    'user-feedback',
    'landing-page',
    'website',
    'booking-contact-form',
    'pricing-page',
    'ux-feedback',
    'review-landing',
    'startup',
    'business',
    'service-offer',
    'brand-name',
    'naming',
  ],
  languageAdmin: [
    'french',
    'english',
    'translation',
    'correction',
    'phone-call',
    'call-roleplay',
    'email',
    'copy',
    'copywriting',
    'writing',
    'cold-dm',
    'dm',
    'message',
    'cv',
    'linkedin',
  ],
  local: [
    'local-paris',
    'paris',
    'quiet-table',
    'bike-small-pickup',
    'small-bike-pickup',
    'visit-place',
    'local-place',
    'bike',
    'pickup',
    'workspace',
    'recommendations',
  ],
  objectsAccess: [
    'tripod',
    'printer',
    'clean-background',
    'clean-wall',
    'borrow',
    'lend',
    'access-printer',
    'objects',
    'access',
  ],
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function starterPackSearchText(template: InventoryTemplateDto) {
  return normalizeText([
    template.key,
    template.title,
    template.description,
    template.category,
    template.timing,
    template.availability,
    template.locationLabel,
    ...(template.tags ?? []),
    ...(template.includes ?? []),
  ].filter(Boolean).join(' '));
}

export function matchesStarterPackFilter(template: InventoryTemplateDto, filter: StarterPackFilter) {
  if (filter === 'all') return true;
  const haystack = starterPackSearchText(template);
  return PACK_KEYWORDS[filter].some((keyword) => haystack.includes(normalizeText(keyword)));
}
