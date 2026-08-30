import React from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { SemanticColorName } from '@hellowhen/theme';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { AppText } from '../AppText';
import { MobileIcon } from '../MobileIcon';

type LibrarySearchFilterRowProps = {
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder: string;
  searchAccessibilityLabel?: string;
  filterAccessibilityLabel: string;
  onOpenFilters: () => void;
  filterCount?: number;
  tone?: SemanticColorName;
  clearAccessibilityLabel: string;
  filtersExpanded?: boolean;
};

export function LibrarySearchFilterRow({
  query,
  onQueryChange,
  searchPlaceholder,
  searchAccessibilityLabel,
  filterAccessibilityLabel,
  onOpenFilters,
  filterCount = 0,
  tone,
  clearAccessibilityLabel,
  filtersExpanded = false,
}: LibrarySearchFilterRowProps) {
  const theme = useThemeTokens();
  const semantic = tone ? theme.semantic[tone] : theme.semantic.info;

  function openFilters() {
    Keyboard.dismiss();
    onOpenFilters();
  }

  return (
    <View style={styles.row}>
      <View style={[styles.searchBox, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        <MobileIcon name="search" size={18} color={theme.color.muted} decorative />
        <TextInput
          accessibilityLabel={searchAccessibilityLabel ?? searchPlaceholder}
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={() => Keyboard.dismiss()}
          placeholder={searchPlaceholder}
          placeholderTextColor={theme.color.muted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={120}
          returnKeyType="search"
          style={[styles.searchInput, { color: theme.color.text }]}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearAccessibilityLabel}
            onPress={() => onQueryChange('')}
            hitSlop={6}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <MobileIcon name="close" size={16} color={theme.color.muted} decorative />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filterAccessibilityLabel}
        accessibilityState={{ expanded: filtersExpanded }}
        onPress={openFilters}
        style={({ pressed }) => [
          styles.filterButton,
          {
            backgroundColor: filterCount > 0 ? semantic.softBg : theme.color.surface,
            borderColor: filterCount > 0 ? semantic.border : theme.color.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <MobileIcon name="filter" size={19} color={filterCount > 0 ? semantic.text : theme.color.text} decorative />
        {filterCount > 0 ? (
          <View accessibilityLiveRegion="polite" style={[styles.countBadge, { backgroundColor: semantic.bg }]}>
            <AppText style={[styles.countText, { color: semantic.onBg }]}>{filterCount > 99 ? '99+' : filterCount}</AppText>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    paddingVertical: 0,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.97 }],
  },
});
