import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../components/AppText';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { UserAvatar, getUserDisplayName, type UserAvatarSize } from './UserAvatar';

type UserIdentityProfile = {
  displayName?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
};

type UserIdentityUser = {
  id?: string | null;
  profile?: UserIdentityProfile | null;
} | null | undefined;

export type UserIdentityPressableVariant = 'inline' | 'chip' | 'row' | 'compact';

export type UserIdentityPressableProps = {
  user?: UserIdentityUser;
  userId?: string | null;
  displayName?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
  variant?: UserIdentityPressableVariant;
  avatarSize?: UserAvatarSize;
  subtitle?: React.ReactNode;
  statusText?: React.ReactNode;
  showHandle?: boolean;
  disabled?: boolean;
  stopPropagation?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function isPublicUserId(value?: string | null) {
  const normalized = value?.trim() ?? '';
  if (!normalized) return false;
  return !['preview', 'unknown', 'mock', 'demo', 'local'].includes(normalized.toLowerCase());
}

function cleanHandle(handle?: string | null) {
  const value = handle?.trim().replace(/^@+/, '') ?? '';
  return value || null;
}

function avatarSizeForVariant(variant: UserIdentityPressableVariant): UserAvatarSize {
  if (variant === 'inline') return 'xs';
  if (variant === 'chip') return 'sm';
  if (variant === 'compact') return 'sm';
  return 'md';
}

function variantStyle(variant: UserIdentityPressableVariant) {
  if (variant === 'inline') return styles.inline;
  if (variant === 'chip') return styles.chip;
  if (variant === 'compact') return styles.compact;
  return styles.row;
}

export function UserIdentityPressable({
  user,
  userId,
  displayName,
  handle,
  avatarUrl,
  variant = 'row',
  avatarSize,
  subtitle,
  statusText,
  showHandle = true,
  disabled = false,
  stopPropagation = true,
  onPress,
  style,
  accessibilityLabel,
}: UserIdentityPressableProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const resolvedUserId = userId ?? user?.id ?? null;
  const profile = user?.profile ?? null;
  const resolvedDisplayName = displayName ?? profile?.displayName ?? null;
  const resolvedHandle = handle ?? profile?.handle ?? null;
  const resolvedAvatarUrl = avatarUrl ?? profile?.avatarUrl ?? null;
  const name = getUserDisplayName(resolvedDisplayName, resolvedHandle);
  const handleLabel = cleanHandle(resolvedHandle);
  const canOpenProfile = isPublicUserId(resolvedUserId);
  const isStatic = disabled || (!canOpenProfile && !onPress);

  const secondary = useMemo(() => {
    if (subtitle) return subtitle;
    if (statusText) return statusText;
    if (showHandle && handleLabel) return `@${handleLabel}`;
    return null;
  }, [handleLabel, showHandle, statusText, subtitle]);

  const content = (
    <>
      <UserAvatar
        src={resolvedAvatarUrl}
        displayName={resolvedDisplayName}
        handle={resolvedHandle}
        size={avatarSize ?? avatarSizeForVariant(variant)}
        decorative
      />
      <View style={styles.body}>
        <AppText style={[styles.name, variant === 'inline' && styles.inlineName]} numberOfLines={1}>{name}</AppText>
        {secondary ? <AppText style={[styles.meta, { color: theme.color.muted }]} numberOfLines={1}>{secondary}</AppText> : null}
      </View>
    </>
  );

  const baseStyle = [
    styles.base,
    variantStyle(variant),
    variant === 'chip' ? { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border } : null,
    isStatic ? styles.staticIdentity : null,
    style,
  ];

  function handlePress(event: GestureResponderEvent) {
    if (stopPropagation) event.stopPropagation?.();
    if (disabled) return;
    if (onPress) {
      onPress();
      return;
    }
    if (!canOpenProfile || !resolvedUserId) return;
    navigation.navigate('UserProfile', { userId: resolvedUserId, displayName: name });
  }

  if (isStatic && !onPress) {
    return <View style={baseStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('profile.accessibility.openPublicProfile', { name })}
      accessibilityHint={t('profile.accessibility.publicProfileHint')}
      hitSlop={6}
      onPress={handlePress}
      disabled={isStatic && !onPress}
      style={({ pressed }) => [baseStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  inline: {
    gap: 6,
    alignSelf: 'flex-start',
  },
  chip: {
    minHeight: 42,
    gap: 9,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
  },
  row: {
    gap: 11,
  },
  compact: {
    gap: 8,
  },
  body: {
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  inlineName: {
    fontSize: 13,
    lineHeight: 16,
  },
  meta: {
    marginTop: 1,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  staticIdentity: {
    opacity: 0.92,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
