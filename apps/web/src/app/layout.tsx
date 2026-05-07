import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Hellowhen',
  description: 'Publish needs, offers, and focused public trades.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="shell">
          <nav className="nav">
            <Link href="/" className="brand" aria-label="Hellowhen home">
              <span className="brand-mark">Z</span>
              <span>Hellowhen</span>
            </Link>
            <div className="nav-links">
              <Link href="/trades">Feed</Link>
              <Link href="/me">Me</Link>
              <Link href="/settings">Settings</Link>
              <Link href="/wallet">Wallet</Link>
              <Link href="/admin/media">Admin Media</Link>
              <Link href="/admin/credits">Admin Credits</Link>
              <Link href="/admin/support">Admin Support</Link>
              <Link href="/reset-password">Reset Password</Link>
            </div>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
