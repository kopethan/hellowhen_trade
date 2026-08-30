import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import type { SemanticColorName } from '@hellowhen/theme';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { AppText } from '../AppText';
import { MobileIcon } from '../MobileIcon';

export type LibraryActiveFilterChip = {
  key: string;
  label: string;
  accessibilityLabel?: string;
  onRemove: () => void;
};

type LibraryActiveFilterChipsProps = {
  filters: readonly LibraryActiveFilterChip[];
  tone?: SemanticColorName;
};

export function LibraryActiveFilterChips({ filters, tone }: LibraryActiveFilterChipsProps) {
  const theme = useThemeTokens();
  const semantic = tone ? theme.semantic[tone] : theme.semantic.info;

  if (filters.length === 0) return null;

  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {filters.map((filter) => (
        <Pressable
          key={filter.key}
          accessibilityRole="button"
          accessibilityLabel={filter.accessibilityLabel ?? filter.label}
          hitSlop={2}
          onPress={filter.onRemove}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: semantic.softBg, borderColor: semantic.border },
            pressed && styles.pressed,
          ]}
        >
          <AppText style={[styles.label, { color: semantic.text }]} numberOfLines={1}>{filter.label}</AppText>
          <MobileIcon name="close" size={14} color={semantic.text} decorative />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingRight: 2,
  },
  chip: {
    minHeight: 40,
    maxWidth: 240,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
