import type { CSSProperties } from 'react';
import { resolveWebAssetUrl } from '../../lib/api';

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export type UserAvatarProps = {
  src?: string | null;
  storageKey?: string | null;
  displayName?: string | null;
  handle?: string | null;
  size?: UserAvatarSize;
  className?: string;
  alt?: string;
  decorative?: boolean;
  style?: CSSProperties;
};

function cleanText(value?: string | null) {
  return value?.trim() ?? '';
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
  className = '',
  alt,
  decorative = false,
  style,
}: UserAvatarProps) {
  const imageSrc = resolveWebAssetUrl(src, storageKey);
  const name = getUserDisplayName(displayName, handle);
  const imageAlt = decorative ? '' : (alt ?? `${name} avatar`);
  const classes = ['user-avatar', `user-avatar--${size}`, className].filter(Boolean).join(' ');

  if (imageSrc) {
    return (
      <span className={classes} style={style} aria-hidden={decorative || undefined}>
        <img className="user-avatar__image" src={imageSrc} alt={imageAlt} loading="lazy" />
      </span>
    );
  }

  return (
    <span
      className={classes}
      style={style}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : imageAlt}
    >
      <span className="user-avatar__initial">{getUserInitial(displayName, handle)}</span>
    </span>
  );
}
