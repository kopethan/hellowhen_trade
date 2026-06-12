'use client';

import Link from 'next/link';
import { WebIcon, type WebIconName } from './WebIcon';

type MembershipUpgradeCardProps = {
  badge: string;
  title: string;
  body: string;
  actionLabel: string;
  comingSoonLabel: string;
  href?: string;
  icon?: WebIconName;
  variant?: 'plus' | 'pro' | 'disabled';
  compact?: boolean;
  code?: string;
};

export function MembershipUpgradeCard({
  badge,
  title,
  body,
  actionLabel,
  comingSoonLabel,
  href = '/account/membership',
  icon = 'profile',
  variant = 'plus',
  compact = false,
  code,
}: MembershipUpgradeCardProps) {
  const canOpenMembership = Boolean(href);

  return (
    <section className={`membership-upgrade-card membership-upgrade-card--${variant} ${compact ? 'membership-upgrade-card--compact' : ''}`.trim()}>
      <span className="membership-upgrade-card__icon" aria-hidden="true">
        <WebIcon name={icon} size={compact ? 18 : 22} decorative />
      </span>
      <div className="membership-upgrade-card__body">
        <span className={`semantic-badge ${variant === 'disabled' ? 'instruction' : 'success'}`}>{badge}</span>
        <h3>{title}</h3>
        <p>{body}</p>
        {code ? <code>{code}</code> : null}
      </div>
      <div className="membership-upgrade-card__action">
        {canOpenMembership ? <Link href={href} className="button primary">{actionLabel}</Link> : <span>{comingSoonLabel}</span>}
      </div>
    </section>
  );
}
