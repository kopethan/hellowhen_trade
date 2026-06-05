import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PreviewCardTheme } from '@hellowhen/contracts';
import { PREVIEW_CARD_THEME_DESCRIPTIONS, PREVIEW_CARD_THEME_LABELS, PREVIEW_CARD_THEMES } from '@hellowhen/shared';
import { AppCard } from '../../../components/AppCard';
import { AppText } from '../../../components/AppText';
import { SemanticBadge } from '../../../components/SemanticUI';
import { useAuth } from '../../../providers/AuthProvider';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { api } from '../../../lib/api';
import { betaFeatures } from '../../../lib/betaFeatures';

type PreviewThemePickerCardProps = {
  value: PreviewCardTheme;
  onChange: (theme: PreviewCardTheme) => void;
  disabled?: boolean;
};

const THEME_ACCENTS: Record<PreviewCardTheme, string> = {
  default: '#E2E8F0',
  blue: '#60A5FA',
  green: '#34D399',
  purple: '#A78BFA',
  amber: '#F59E0B',
  rose: '#FB7185',
};

export function PreviewThemePickerCard({ value, onChange, disabled }: PreviewThemePickerCardProps) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const [canCustomize, setCanCustomize] = useState(false);

  useEffect(() => {
    if (!betaFeatures.plusSubscriptionFeatures.customizationEnabled || !auth.hydrated || !auth.isAuthenticated) {
      setCanCustomize(false);
      return;
    }
    let mounted = true;
    async function loadPlusSnapshot() {
      try {
        const response = await api.plus.me();
        if (mounted) setCanCustomize(Boolean(response.access.entitlements.customization));
      } catch {
        if (mounted) setCanCustomize(false);
      }
    }
    void loadPlusSnapshot();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated]);

  if (!betaFeatures.plusSubscriptionFeatures.customizationEnabled) return null;

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <AppText style={[styles.title, { color: theme.color.text }]}>Preview card theme</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{canCustomize ? 'Choose an approved Plus theme for the first preview card.' : 'Preview themes are a hidden Plus customization preview.'}</AppText>
        </View>
        <SemanticBadge label="Plus" tone="instruction" />
      </View>
      <View style={styles.grid}>
        {PREVIEW_CARD_THEMES.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: disabled || !canCustomize }}
              disabled={disabled || !canCustomize}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: theme.color.surface, borderColor: selected ? THEME_ACCENTS[option] : theme.color.border },
                selected && { backgroundColor: theme.color.subtleSurface },
                (disabled || !canCustomize) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: THEME_ACCENTS[option] }]} />
              <View style={styles.optionCopy}>
                <AppText style={[styles.optionTitle, { color: theme.color.text }]}>{PREVIEW_CARD_THEME_LABELS[option]}</AppText>
                <AppText style={[styles.optionBody, { color: theme.color.muted }]} numberOfLines={2}>{PREVIEW_CARD_THEME_DESCRIPTIONS[option]}</AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  body: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  grid: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 10 },
  swatch: { width: 24, height: 24, borderRadius: 12 },
  optionCopy: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  optionBody: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
});
