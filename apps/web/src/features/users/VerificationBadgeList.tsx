import type { PublicVerificationBadge } from '@hellowhen/contracts';

type VerificationBadgeListProps = {
  badges?: PublicVerificationBadge[] | null;
  size?: 'sm' | 'md';
  className?: string;
};

function toneClass(tone?: PublicVerificationBadge['tone']) {
  if (tone === 'success') return 'success';
  if (tone === 'trusted') return 'trusted';
  if (tone === 'professional') return 'professional';
  if (tone === 'business') return 'business';
  if (tone === 'enterprise') return 'enterprise';
  return 'neutral';
}

export function VerificationBadgeList({ badges, size = 'md', className = '' }: VerificationBadgeListProps) {
  const safeBadges = badges?.filter((badge) => badge?.kind && badge.label) ?? [];
  if (!safeBadges.length) return null;

  return (
    <div className={['verification-badge-row', size === 'sm' ? 'verification-badge-row--sm' : '', className].filter(Boolean).join(' ')}>
      {safeBadges.map((badge) => (
        <span key={badge.kind} className={`semantic-badge ${toneClass(badge.tone)}`} title={badge.title ?? badge.label}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}
