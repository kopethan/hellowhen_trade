import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminAccessGate } from '../../features/admin/AdminAccessGate';

export const metadata: Metadata = {
  title: 'Hellowhen Admin',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

const adminNavItems = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/library', label: 'Starter library' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/pro', label: 'Pro' },
  { href: '/admin/business', label: 'Business' },
  { href: '/admin/usage', label: 'Usage' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/support', label: 'Support' },
  { href: '/admin/media', label: 'Media' },
  { href: '/admin/safety', label: 'Safety' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAccessGate>
      <div className="admin-shell">
        <nav className="admin-nav" aria-label="Admin navigation">
          <Link className="admin-nav__brand" href="/admin">Hellowhen Admin</Link>
          <div className="admin-nav__links">
            {adminNavItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
          </div>
          <p className="admin-nav__note">First beta mode: Pro and Business are admin-only hidden foundations; money, wallet, payouts, and Plans stay out of launch admin navigation.</p>
        </nav>
        {children}
      </div>
    </AdminAccessGate>
  );
}
