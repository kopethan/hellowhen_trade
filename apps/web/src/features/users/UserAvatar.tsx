'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getWebApiBaseUrl } from '../../lib/api';

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

function resolveStoredAvatarUrl(src?: string | null, storageKey?: string | null) {
  const raw = (src ?? storageKey ?? '').trim();
  if (!raw) return '';

  // Profile avatars may come from server-owned uploads or trusted OAuth HTTPS
  // providers. Do not render data:, blob:, file:, javascript:, or other active
  // schemes from persisted profile data.
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';

  const normalized = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  const path = raw.startsWith('/')
    ? raw
    : normalized.startsWith('uploads/')
      ? `/${normalized}`
      : `/uploads/${normalized}`;

  return `${getWebApiBaseUrl().replace(/\/$/, '')}${path}`;
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
  const imageSrc = useMemo(() => resolveStoredAvatarUrl(src, storageKey), [src, storageKey]);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  const name = getUserDisplayName(displayName, handle);
  const imageAlt = decorative ? '' : (alt ?? `${name} avatar`);
  const classes = ['user-avatar', `user-avatar--${size}`, className].filter(Boolean).join(' ');
  const showImage = Boolean(imageSrc && !imageFailed);

  if (showImage) {
    return (
      <span className={classes} style={style} aria-hidden={decorative || undefined}>
        <img
          className="user-avatar__image"
          src={imageSrc}
          alt={imageAlt}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
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
