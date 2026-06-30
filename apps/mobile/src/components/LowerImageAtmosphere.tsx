import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export type LowerImageAtmospherePreset = 'trade' | 'plan';

type ToneValue = { dark: string; light: string };

type GradientStop = {
  offset: number;
  opacity: number;
};

type LowerImageAtmosphereProfile = {
  blurRadius: number;
  blurOpacity: number;
  gradientTop: number;
  stops: readonly GradientStop[];
  tint: ToneValue;
};

type LowerImageAtmosphereProps = {
  imageUrl?: string | null;
  isDark: boolean;
  preset?: LowerImageAtmospherePreset;
};

type AtmospherePresetConfig = LowerImageAtmosphereProfile;

const SHARED_POSTER_ATMOSPHERE_PROFILE: AtmospherePresetConfig = {
  blurRadius: 22,
  blurOpacity: 0.058,
  gradientTop: 46,
  stops: [
    { offset: 0, opacity: 0 },
    { offset: 0.18, opacity: 0.02 },
    { offset: 0.48, opacity: 0.14 },
    { offset: 0.84, opacity: 0.46 },
    { offset: 1, opacity: 0.62 },
  ],
  tint: { dark: '#02070A', light: '#06100E' },
};

const POSTER_ATMOSPHERE_PRESET_CONFIGS: Record<LowerImageAtmospherePreset, AtmospherePresetConfig> = {
  trade: SHARED_POSTER_ATMOSPHERE_PROFILE,
  plan: SHARED_POSTER_ATMOSPHERE_PROFILE,
};

function tone(value: ToneValue, isDark: boolean) {
  return isDark ? value.dark : value.light;
}

export function LowerImageAtmosphere({ imageUrl, isDark, preset = 'trade' }: LowerImageAtmosphereProps) {
  if (!imageUrl) return null;

  const profile = POSTER_ATMOSPHERE_PRESET_CONFIGS[preset];
  const gradientId = `lower-image-atmosphere-${preset}-${isDark ? 'dark' : 'light'}`;
  const tintColor = tone(profile.tint, isDark);
  const gradientHeight = 100 - profile.gradientTop;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Image source={{ uri: imageUrl }} resizeMode="cover" blurRadius={profile.blurRadius} style={[StyleSheet.absoluteFillObject, { opacity: profile.blurOpacity }]} />
      <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            {profile.stops.map((stop) => (
              <Stop key={`${gradientId}-${stop.offset}`} offset={stop.offset} stopColor={tintColor} stopOpacity={stop.opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y={profile.gradientTop} width="100" height={gradientHeight} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}
