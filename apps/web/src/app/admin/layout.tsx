import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminAccessGate } from '../../features/admin/AdminAccessGate';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAccessGate>{children}</AdminAccessGate>;
}
