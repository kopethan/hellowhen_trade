import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '../../components/AppText';
import { API_URL } from '../../lib/api';
import { useThemeTokens } from '../../providers/ThemeProvider';

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export type UserAvatarProps = {
  src?: string | null;
  storageKey?: string | null;
  displayName?: string | null;
  handle?: string | null;
  size?: UserAvatarSize;
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

const AVATAR_SIZE_PX: Record<UserAvatarSize, number> = {
  xs: 22,
  sm: 32,
  md: 44,
  lg: 76,
};

function cleanText(value?: string | null) {
  return value?.trim() ?? '';
}

export function resolveNativeAssetUrl(src?: string | null, storageKey?: string | null) {
  const value = cleanText(src) || cleanText(storageKey);
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return '';
  }
  return `${API_URL.replace(/\/$/, '')}${value.startsWith('/') ? value : `/${value}`}`;
}

export function getUserDisplayName(displayName?: string | null, handle?: string | null, fallback = 'Hellowhen member') {
  return cleanText(displayName) || cleanText(handle).replace(/^@+/, '') || fallback;
}

export function getUserInitial(displayName?: string | null, handle?: string | null) {
  const name = getUserDisplayName(displayName, handle, 'H');
  return name.slice(0, 1).toUpperCase() || 'H';
}

export function UserAvatar({
  src,
  storageKey,
  displayName,
  handle,
  size = 'sm',
  decorative = false,
  style,
  imageStyle,
}: UserAvatarProps) {
  const theme = useThemeTokens();
  const imageSrc = useMemo(() => resolveNativeAssetUrl(src, storageKey), [src, storageKey]);
  const [imageFailed, setImageFailed] = useState(false);
  const pixelSize = AVATAR_SIZE_PX[size];
  const showImage = Boolean(imageSrc) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  return (
    <View
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : `${getUserDisplayName(displayName, handle)} avatar`}
      style={[
        styles.avatar,
        {
          width: pixelSize,
          height: pixelSize,
          borderRadius: pixelSize / 2,
          backgroundColor: theme.semantic.proposal.softBg,
          borderColor: theme.semantic.proposal.border,
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: imageSrc }}
          style={[styles.image, imageStyle]}
          onError={() => setImageFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <AppText
          style={[
            styles.initial,
            {
              color: theme.semantic.proposal.text,
              fontSize: Math.max(11, Math.round(pixelSize * 0.4)),
              lineHeight: Math.max(13, Math.round(pixelSize * 0.48)),
            },
          ]}
        >
          {getUserInitial(displayName, handle)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initial: {
    fontWeight: '900',
    textAlign: 'center',
  },
});
