import React from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { SemanticColorName } from '@hellowhen/theme';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { MobileIcon } from '../MobileIcon';

type LibraryInlineSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  clearAccessibilityLabel: string;
  tone?: SemanticColorName;
  autoFocus?: boolean;
};

export function LibraryInlineSearch({
  query,
  onQueryChange,
  placeholder,
  accessibilityLabel,
  clearAccessibilityLabel,
  tone,
  autoFocus = true,
}: LibraryInlineSearchProps) {
  const theme = useThemeTokens();
  const semantic = tone ? theme.semantic[tone] : theme.semantic.info;

  return (
    <View
      style={[
        styles.searchBox,
        {
          backgroundColor: theme.color.surface,
          borderColor: query ? semantic.border : theme.color.border,
        },
      ]}
    >
      <MobileIcon name="search" size={18} color={query ? semantic.text : theme.color.muted} decorative />
      <TextInput
        accessibilityLabel={accessibilityLabel ?? placeholder}
        value={query}
        onChangeText={onQueryChange}
        placeholder={placeholder}
        placeholderTextColor={theme.color.muted}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()}
        style={[styles.input, { color: theme.color.text }]}
      />
      {query ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
          onPress={() => onQueryChange('')}
          hitSlop={8}
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
        >
          <MobileIcon name="close" size={16} color={theme.color.muted} decorative />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
});
