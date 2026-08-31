import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SemanticColorName } from '@hellowhen/theme';
import { useThemeTokens } from '../providers/ThemeProvider';
import { AppText } from './AppText';
import { MobileIcon, type MobileIconName } from './MobileIcon';

type AppHeaderActionButtonProps = {
  icon: MobileIconName;
  accessibilityLabel: string;
  onPress: () => void;
  tone?: SemanticColorName;
  iconSize?: number;
  badgeCount?: number;
  badgeTone?: SemanticColorName;
  disabled?: boolean;
  content?: React.ReactNode;
};

export function AppHeaderActionButton({
  icon,
  accessibilityLabel,
  onPress,
  tone,
  iconSize = 20,
  badgeCount = 0,
  badgeTone = tone ?? 'info',
  disabled = false,
  content,
}: AppHeaderActionButtonProps) {
  const theme = useThemeTokens();
  const semantic = tone ? theme.semantic[tone] : null;
  const badgeSemantic = theme.semantic[badgeTone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: semantic?.bg ?? theme.color.surface,
          borderColor: semantic?.bg ?? theme.color.border,
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {content ?? <MobileIcon name={icon} size={iconSize} color={semantic?.onBg ?? theme.color.text} decorative />}
      {badgeCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: badgeSemantic.bg, borderColor: theme.color.surface }]}>
          <AppText style={[styles.badgeText, { color: badgeSemantic.onBg }]}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
