import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export type LowerImageAtmospherePreset = 'trade' | 'plan';

type ToneValue = { dark: string; light: string };

type BlurBand = {
  top: number;
  height: number;
  blur: number;
  opacity: number;
  tintOpacity: number;
};

type WashBand = {
  top: number;
  height: number;
  opacity: number;
  tone: ToneValue;
};

type LowerImageAtmosphereProfile = {
  bands: readonly BlurBand[];
  tint: ToneValue;
  washes: readonly WashBand[];
};

type LowerImageAtmosphereProps = {
  imageUrl?: string | null;
  isDark: boolean;
  preset?: LowerImageAtmospherePreset;
};

const POSTER_ATMOSPHERE_BAND_GEOMETRY = [
  { top: 58, height: 34, blur: 8 },
  { top: 66, height: 30, blur: 16 },
  { top: 74, height: 26, blur: 28 },
  { top: 84, height: 20, blur: 42 },
] as const;

const POSTER_ATMOSPHERE_WASH_GEOMETRY = [
  { top: 60, height: 18 },
  { top: 68, height: 18 },
  { top: 76, height: 18 },
  { top: 84, height: 18 },
] as const;

const POSTER_ATMOSPHERE_PROFILES: Record<LowerImageAtmospherePreset, {
  bandOpacity: readonly number[];
  bandTintOpacity: readonly number[];
  tint: ToneValue;
  washOpacity: readonly number[];
  washTone: ToneValue;
}> = {
  trade: {
    bandOpacity: [0.012, 0.04, 0.085, 0.14],
    bandTintOpacity: [0.006, 0.026, 0.055, 0.085],
    tint: { dark: 'rgba(2,10,9,0.32)', light: 'rgba(2,28,22,0.36)' },
    washOpacity: [0.035, 0.08, 0.16, 0.34],
    washTone: { dark: 'rgba(1,7,7,0.78)', light: 'rgba(1,20,17,0.78)' },
  },
  plan: {
    bandOpacity: [0.012, 0.038, 0.08, 0.135],
    bandTintOpacity: [0.006, 0.024, 0.052, 0.085],
    tint: { dark: 'rgba(8,6,18,0.3)', light: 'rgba(12,19,28,0.34)' },
    washOpacity: [0.032, 0.074, 0.15, 0.32],
    washTone: { dark: 'rgba(3,3,8,0.76)', light: 'rgba(4,8,15,0.76)' },
  },
};

const PROFILES: Record<LowerImageAtmospherePreset, LowerImageAtmosphereProfile> = {
  trade: createProfile('trade'),
  plan: createProfile('plan'),
};

function createProfile(preset: LowerImageAtmospherePreset): LowerImageAtmosphereProfile {
  const { bandOpacity, bandTintOpacity, washOpacity, washTone, tint } = POSTER_ATMOSPHERE_PROFILES[preset];

  return {
    tint,
    bands: POSTER_ATMOSPHERE_BAND_GEOMETRY.map((band, index) => ({
      ...band,
      opacity: bandOpacity[index] ?? 0,
      tintOpacity: bandTintOpacity[index] ?? 0,
    })),
    washes: POSTER_ATMOSPHERE_WASH_GEOMETRY.map((wash, index) => ({
      ...wash,
      opacity: washOpacity[index] ?? 0,
      tone: washTone,
    })),
  };
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
      {profile.bands.map((band, index) => (
        <React.Fragment key={`${preset}-lower-image-atmosphere-band-${index}`}>
          <View
            style={[
              styles.blurBand,
              {
                top: `${band.top}%`,
                height: `${band.height}%`,
                opacity: band.opacity,
              },
            ]}
          >
            <Image source={{ uri: imageUrl }} resizeMode="cover" blurRadius={band.blur} style={StyleSheet.absoluteFillObject} />
          </View>
          <View
            style={[
              styles.blurBand,
              {
                top: `${band.top}%`,
                height: `${band.height}%`,
                backgroundColor: imageTint,
                opacity: band.tintOpacity,
              },
            ]}
          />
        </React.Fragment>
      ))}
      {profile.washes.map((wash, index) => (
        <View
          key={`${preset}-lower-image-atmosphere-wash-${index}`}
          style={[
            styles.washBand,
            {
              top: `${wash.top}%`,
              height: `${wash.height}%`,
              backgroundColor: tone(wash.tone, isDark),
              opacity: wash.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  blurBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  washBand: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
