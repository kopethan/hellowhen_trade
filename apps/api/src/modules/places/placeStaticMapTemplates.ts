import { randomBytes } from 'node:crypto';
import { PLACE_STATIC_MAP_TEMPLATE_FAMILIES, type PlaceStaticMapTemplateFamily } from '@hellowhen/contracts';

type StaticMapTheme = 'light' | 'dark';

type PlaceStaticMapVariant = {
  markerColor: string;
  styles: readonly string[];
  mapType?: 'roadmap' | 'terrain';
  zoom?: number;
};

type PlaceStaticMapTemplate = {
  key: PlaceStaticMapTemplateFamily;
  label: string;
  light: PlaceStaticMapVariant;
  dark: PlaceStaticMapVariant;
};

const HIDE_DISTRACTIONS = [
  'feature:poi.business|visibility:off',
  'feature:transit|visibility:off',
] as const;


const SYSTEM_PLACE_STATIC_MAP_TEMPLATE_FAMILIES = PLACE_STATIC_MAP_TEMPLATE_FAMILIES.filter(
  (family) => family !== 'premium_mono',
) as Exclude<PlaceStaticMapTemplateFamily, 'premium_mono'>[];

function hashTemplateSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function placeStaticMapTemplateFamilyForSeed(seed: string | null | undefined): PlaceStaticMapTemplateFamily {
  const normalizedSeed = seed?.trim() || randomBytes(8).toString('hex');
  const index = hashTemplateSeed(normalizedSeed) % SYSTEM_PLACE_STATIC_MAP_TEMPLATE_FAMILIES.length;
  return SYSTEM_PLACE_STATIC_MAP_TEMPLATE_FAMILIES[index] ?? 'clean_local';
}

export function createRandomPlaceStaticMapTemplateAssignment(seedPrefix = 'place') {
  const seed = `${seedPrefix}:${randomBytes(8).toString('hex')}`;
  return {
    staticMapTemplateFamily: placeStaticMapTemplateFamilyForSeed(seed),
    staticMapTemplateSeed: seed,
  };
}

export const PLACE_STATIC_MAP_TEMPLATES: Record<PlaceStaticMapTemplateFamily, PlaceStaticMapTemplate> = {
  clean_local: {
    key: 'clean_local',
    label: 'Clean Local',
    light: {
      markerColor: '0x0f766e',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|element:labels|visibility:off',
        'feature:road|element:geometry|color:0xf2f5f9',
        'feature:water|element:geometry|color:0xdbeafe',
        'feature:landscape|element:geometry|color:0xf8fafc',
        'feature:administrative|element:labels.text.fill|color:0x475569',
      ],
    },
    dark: {
      markerColor: '0x38bdf8',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|element:labels|visibility:off',
        'feature:road|element:geometry|color:0x334155',
        'feature:road|element:labels.text.fill|color:0xe2e8f0',
        'feature:water|element:geometry|color:0x0f172a',
        'feature:landscape|element:geometry|color:0x111827',
        'feature:administrative|element:labels.text.fill|color:0xcbd5e1',
      ],
    },
  },
  night_social: {
    key: 'night_social',
    label: 'Night Social',
    light: {
      markerColor: '0x7c3aed',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|element:labels|visibility:off',
        'feature:road|element:geometry|color:0xe9d5ff',
        'feature:road|element:labels.text.fill|color:0x581c87',
        'feature:water|element:geometry|color:0xc4b5fd',
        'feature:landscape|element:geometry|color:0xf5f3ff',
      ],
    },
    dark: {
      markerColor: '0xc084fc',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|element:labels|visibility:off',
        'feature:road|element:geometry|color:0x312e81',
        'feature:road|element:labels.text.fill|color:0xddd6fe',
        'feature:water|element:geometry|color:0x1e1b4b',
        'feature:landscape|element:geometry|color:0x111827',
      ],
    },
  },
  soft_pastel: {
    key: 'soft_pastel',
    label: 'Soft Pastel',
    light: {
      markerColor: '0xf97316',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|element:labels|visibility:off',
        'feature:road|element:geometry|color:0xffedd5',
        'feature:water|element:geometry|color:0xbae6fd',
        'feature:landscape|element:geometry|color:0xfef3c7',
        'feature:administrative|element:labels.text.fill|color:0x92400e',
      ],
    },
    dark: {
      markerColor: '0xfb923c',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|element:labels|visibility:off',
        'feature:road|element:geometry|color:0x431407',
        'feature:road|element:labels.text.fill|color:0xfed7aa',
        'feature:water|element:geometry|color:0x0c4a6e',
        'feature:landscape|element:geometry|color:0x1c1917',
      ],
    },
  },
  minimal_address: {
    key: 'minimal_address',
    label: 'Minimal Address',
    light: {
      markerColor: '0x111827',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|visibility:off',
        'feature:transit|visibility:off',
        'feature:road.local|element:labels|visibility:off',
        'feature:road|element:geometry|color:0xe5e7eb',
        'feature:water|element:geometry|color:0xf3f4f6',
        'feature:landscape|element:geometry|color:0xffffff',
      ],
    },
    dark: {
      markerColor: '0xf9fafb',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|visibility:off',
        'feature:transit|visibility:off',
        'feature:road.local|element:labels|visibility:off',
        'feature:road|element:geometry|color:0x374151',
        'feature:water|element:geometry|color:0x111827',
        'feature:landscape|element:geometry|color:0x030712',
      ],
    },
  },
  city_grid: {
    key: 'city_grid',
    label: 'City Grid',
    light: {
      markerColor: '0x2563eb',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|element:labels|visibility:off',
        'feature:road|element:geometry|color:0xdbeafe',
        'feature:road.arterial|element:geometry|color:0x93c5fd',
        'feature:road.highway|element:geometry|color:0x60a5fa',
        'feature:water|element:geometry|color:0xbfdbfe',
        'feature:landscape|element:geometry|color:0xf8fafc',
      ],
    },
    dark: {
      markerColor: '0x60a5fa',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|element:labels|visibility:off',
        'feature:road|element:geometry|color:0x1d4ed8',
        'feature:road.arterial|element:geometry|color:0x2563eb',
        'feature:road.highway|element:geometry|color:0x3b82f6',
        'feature:water|element:geometry|color:0x172554',
        'feature:landscape|element:geometry|color:0x020617',
      ],
    },
  },
  green_outdoor: {
    key: 'green_outdoor',
    label: 'Green Outdoor',
    light: {
      markerColor: '0x16a34a',
      mapType: 'terrain',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi.park|element:geometry|color:0xbbf7d0',
        'feature:road|element:geometry|color:0xecfccb',
        'feature:water|element:geometry|color:0x99f6e4',
        'feature:landscape|element:geometry|color:0xf0fdf4',
      ],
    },
    dark: {
      markerColor: '0x4ade80',
      mapType: 'terrain',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi.park|element:geometry|color:0x14532d',
        'feature:road|element:geometry|color:0x365314',
        'feature:water|element:geometry|color:0x134e4a',
        'feature:landscape|element:geometry|color:0x052e16',
      ],
    },
  },
  warm_travel: {
    key: 'warm_travel',
    label: 'Warm Travel',
    light: {
      markerColor: '0xb45309',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|element:labels|visibility:off',
        'feature:road|element:geometry|color:0xfde68a',
        'feature:water|element:geometry|color:0xfcd34d',
        'feature:landscape|element:geometry|color:0xfffbeb',
        'feature:administrative|element:labels.text.fill|color:0x78350f',
      ],
    },
    dark: {
      markerColor: '0xfbbf24',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:poi|element:labels|visibility:off',
        'feature:road|element:geometry|color:0x92400e',
        'feature:road|element:labels.text.fill|color:0xfef3c7',
        'feature:water|element:geometry|color:0x451a03',
        'feature:landscape|element:geometry|color:0x1c1917',
      ],
    },
  },
  premium_mono: {
    key: 'premium_mono',
    label: 'Premium Mono',
    light: {
      markerColor: '0x18181b',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:all|element:labels.text.fill|color:0x27272a',
        'feature:poi|visibility:off',
        'feature:road|element:geometry|color:0xd4d4d8',
        'feature:water|element:geometry|color:0xe4e4e7',
        'feature:landscape|element:geometry|color:0xfafafa',
      ],
    },
    dark: {
      markerColor: '0xf4f4f5',
      styles: [
        ...HIDE_DISTRACTIONS,
        'feature:all|element:labels.text.fill|color:0xd4d4d8',
        'feature:poi|visibility:off',
        'feature:road|element:geometry|color:0x3f3f46',
        'feature:water|element:geometry|color:0x18181b',
        'feature:landscape|element:geometry|color:0x09090b',
      ],
    },
  },
};

export function isPlaceStaticMapTemplateFamily(value?: string | null): value is PlaceStaticMapTemplateFamily {
  return typeof value === 'string' && (PLACE_STATIC_MAP_TEMPLATE_FAMILIES as readonly string[]).includes(value);
}

export function getPlaceStaticMapTemplate(value?: string | null) {
  return PLACE_STATIC_MAP_TEMPLATES[isPlaceStaticMapTemplateFamily(value) ? value : 'clean_local'];
}

export function getPlaceStaticMapVariant(template: PlaceStaticMapTemplate, theme: StaticMapTheme) {
  return template[theme];
}
