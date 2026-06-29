import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export type LowerImageAtmospherePreset = 'trade' | 'plan';

type ToneValue = { dark: string; light: string };

type BlurBand = {
  top: number;
  height: number;
  blur: number;
  opacity: number;
};

type TintBand = {
  top: number;
  height: number;
  opacity: number;
};

type LowerImageAtmosphereProfile = {
  imageBands: readonly BlurBand[];
  tintBands: readonly TintBand[];
  tint: ToneValue;
};

type LowerImageAtmosphereProps = {
  imageUrl?: string | null;
  isDark: boolean;
  preset?: LowerImageAtmospherePreset;
};

type AtmospherePresetConfig = {
  startPercent: number;
  tintBandCount: number;
  tintBandOverlap: number;
  tintStrength: number;
  imageBands: readonly BlurBand[];
  tint: ToneValue;
};

const POSTER_ATMOSPHERE_PRESET_CONFIGS: Record<LowerImageAtmospherePreset, AtmospherePresetConfig> = {
  trade: {
    startPercent: 52,
    tintBandCount: 4,
    tintBandOverlap: 18,
    tintStrength: 0.25,
    imageBands: [
      { top: 62, height: 34, blur: 12, opacity: 0.026 },
      { top: 78, height: 24, blur: 22, opacity: 0.055 },
    ],
    tint: { dark: 'rgba(1,5,5,0.58)', light: 'rgba(4,12,11,0.58)' },
  },
  plan: {
    startPercent: 52,
    tintBandCount: 4,
    tintBandOverlap: 18,
    tintStrength: 0.27,
    imageBands: [
      { top: 62, height: 34, blur: 12, opacity: 0.028 },
      { top: 78, height: 24, blur: 22, opacity: 0.06 },
    ],
    tint: { dark: 'rgba(2,3,8,0.6)', light: 'rgba(5,10,14,0.6)' },
  },
};

const PROFILES: Record<LowerImageAtmospherePreset, LowerImageAtmosphereProfile> = {
  trade: createProfile('trade'),
  plan: createProfile('plan'),
};

function createProfile(preset: LowerImageAtmospherePreset): LowerImageAtmosphereProfile {
  const config = POSTER_ATMOSPHERE_PRESET_CONFIGS[preset];
  const safeStart = clamp(config.startPercent, 0, 92);
  const overlayHeight = 100 - safeStart;
  const tintBandHeight = overlayHeight / config.tintBandCount;

  return {
    imageBands: config.imageBands,
    tint: config.tint,
    tintBands: Array.from({ length: config.tintBandCount }, (_, index) => {
      const progress = (index + 1) / config.tintBandCount;
      const eased = smoothstep((progress - 0.08) / 0.92);
      const bottomGuard = smoothstep((progress - 0.72) / 0.28);

      return {
        top: safeStart + index * tintBandHeight,
        height: tintBandHeight + config.tintBandOverlap,
        opacity: clamp(eased * config.tintStrength + bottomGuard * 0.115, 0, 0.42),
      };
    }),
  };
}

function smoothstep(value: number) {
  const progress = clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function tone(value: ToneValue, isDark: boolean) {
  return isDark ? value.dark : value.light;
}

export function LowerImageAtmosphere({ imageUrl, isDark, preset = 'trade' }: LowerImageAtmosphereProps) {
  if (!imageUrl) return null;

  const profile = PROFILES[preset];
  const imageTint = tone(profile.tint, isDark);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {profile.imageBands.map((band, index) => (
        <View
          key={`${preset}-lower-image-atmosphere-image-band-${index}`}
          style={[
            styles.band,
            {
              top: `${band.top}%`,
              height: `${band.height}%`,
              opacity: band.opacity,
            },
          ]}
        >
          <Image source={{ uri: imageUrl }} resizeMode="cover" blurRadius={band.blur} style={StyleSheet.absoluteFillObject} />
        </View>
      ))}
      {profile.tintBands.map((band, index) => (
        <View
          key={`${preset}-lower-image-atmosphere-tint-band-${index}`}
          style={[
            styles.band,
            {
              top: `${band.top}%`,
              height: `${band.height}%`,
              backgroundColor: imageTint,
              opacity: band.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
});
