'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWebTranslation } from '../providers/WebI18nProvider';
import { WebIcon } from './WebIcon';

export function WebAccountHeaderAction({ local = false }: { local?: boolean }) {
  const pathname = usePathname() || '/';
  const { t } = useWebTranslation();
  const active = pathname === '/me' || pathname.startsWith('/account') || pathname.startsWith('/legal');
  const className = [
    'web-account-action',
    local ? 'feed-world-account-action' : '',
    active ? 'is-active' : '',
  ].filter(Boolean).join(' ');
  const label = t('navigation.tabs.account');

  return (
    <Link href="/account" className={className} aria-current={active ? 'page' : undefined} aria-label={label} title={label}>
      <WebIcon name="profile" size={20} decorative />
    </Link>
  );
}
