import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { AdPlacement } from '@hellowhen/shared';
import { adPlacementLabel, isAdPlacement } from '@hellowhen/shared';
import { AppText } from './AppText';
import { useThemeTokens } from '../providers/ThemeProvider';
import { betaFeatures } from '../lib/betaFeatures';

type NativeAdSlotProps = {
  placement: AdPlacement;
  label?: string;
};

export function NativeAdSlot({ placement, label = 'Sponsored' }: NativeAdSlotProps) {
  const theme = useThemeTokens();

  if (!isAdPlacement(placement)) return null;
  if (!betaFeatures.adsEnabled || !betaFeatures.mobileAdsEnabled || !betaFeatures.adsDebugPlaceholders) return null;

  return (
    <View accessibilityLabel={label} style={[styles.slot, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
      <AppText style={[styles.label, { color: theme.color.muted }]}>{label}</AppText>
      <AppText style={[styles.title, { color: theme.color.text }]}>Ad placeholder</AppText>
      <AppText style={[styles.meta, { color: theme.color.muted }]}>{adPlacementLabel(placement)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    fontSize: 12,
    fontWeight: '800',
  },
});
