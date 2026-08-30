import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SemanticColorName } from '@hellowhen/theme';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { AppText } from '../AppText';

type LibraryFilterGroupProps = {
  title: string;
  children: React.ReactNode;
};

type LibraryFilterOptionProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: SemanticColorName;
  accessibilityLabel?: string;
};

export function LibraryFilterGroup({ title, children }: LibraryFilterGroupProps) {
  return (
    <View style={styles.group}>
      <AppText accessibilityRole="header" style={styles.groupTitle}>{title}</AppText>
      <View style={styles.options}>{children}</View>
    </View>
  );
}

export function LibraryFilterOption({
  label,
  selected,
  onPress,
  tone,
  accessibilityLabel,
}: LibraryFilterOptionProps) {
  const theme = useThemeTokens();
  const semantic = tone ? theme.semantic[tone] : theme.semantic.info;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? semantic.bg : theme.color.surface,
          borderColor: selected ? semantic.bg : theme.color.border,
        },
        pressed && styles.pressed,
      ]}
    >
      {selected ? <View style={[styles.selectedDot, { backgroundColor: semantic.onBg }]} /> : null}
      <AppText style={[styles.optionText, { color: selected ? semantic.onBg : theme.color.text }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 10,
  },
  groupTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  optionText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
});
