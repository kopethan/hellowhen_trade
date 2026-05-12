'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
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

export type UserIdentityLinkVariant = 'inline' | 'chip' | 'row' | 'compact';

export type UserIdentityLinkProps = {
  user?: UserIdentityUser;
  userId?: string | null;
  displayName?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
  href?: string;
  variant?: UserIdentityLinkVariant;
  avatarSize?: UserAvatarSize;
  subtitle?: ReactNode;
  statusText?: ReactNode;
  showHandle?: boolean;
  disabled?: boolean;
  stopPropagation?: boolean;
  className?: string;
  ariaLabel?: string;
};

function cleanHandle(handle?: string | null) {
  const value = handle?.trim().replace(/^@+/, '') ?? '';
  return value || null;
}

function avatarSizeForVariant(variant: UserIdentityLinkVariant): UserAvatarSize {
  if (variant === 'inline') return 'xs';
  if (variant === 'chip') return 'sm';
  if (variant === 'compact') return 'sm';
  return 'md';
}

export function UserIdentityLink({
  user,
  userId,
  displayName,
  handle,
  avatarUrl,
  href,
  variant = 'row',
  avatarSize,
  subtitle,
  statusText,
  showHandle = true,
  disabled = false,
  stopPropagation = true,
  className = '',
  ariaLabel,
}: UserIdentityLinkProps) {
  const resolvedUserId = userId ?? user?.id ?? null;
  const profile = user?.profile ?? null;
  const resolvedDisplayName = displayName ?? profile?.displayName ?? null;
  const resolvedHandle = handle ?? profile?.handle ?? null;
  const resolvedAvatarUrl = avatarUrl ?? profile?.avatarUrl ?? null;
  const name = getUserDisplayName(resolvedDisplayName, resolvedHandle);
  const handleLabel = cleanHandle(resolvedHandle);
  const secondary = subtitle ?? statusText ?? (showHandle && handleLabel ? `@${handleLabel}` : null);
  const targetHref = href ?? (resolvedUserId ? `/users/${encodeURIComponent(resolvedUserId)}` : undefined);
  const classes = [
    'user-identity-link',
    `user-identity-link--${variant}`,
    (!targetHref || disabled) ? 'user-identity-link--static' : '',
    className,
  ].filter(Boolean).join(' ');
  const content = (
    <>
      <UserAvatar
        src={resolvedAvatarUrl}
        displayName={resolvedDisplayName}
        handle={resolvedHandle}
        size={avatarSize ?? avatarSizeForVariant(variant)}
        decorative
      />
      <span className="user-identity-link__body">
        <span className="user-identity-link__name">{name}</span>
        {secondary ? <span className="user-identity-link__meta">{secondary}</span> : null}
      </span>
    </>
  );

  function handleClick(event: MouseEvent<HTMLElement>) {
    if (stopPropagation) event.stopPropagation();
  }

  if (!targetHref || disabled) {
    return <span className={classes} onClick={handleClick}>{content}</span>;
  }

  return (
    <Link
      className={classes}
      href={targetHref}
      aria-label={ariaLabel ?? `Open ${name}'s public profile`}
      title={`Open ${name}'s public profile`}
      onClick={handleClick}
    >
      {content}
    </Link>
  );
}
