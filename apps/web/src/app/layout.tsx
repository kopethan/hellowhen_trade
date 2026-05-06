import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Zizilia',
  description: 'Publish needs, offers, and focused public trades.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="shell">
          <nav className="nav">
            <Link href="/" className="brand" aria-label="Zizilia home">
              <span className="brand-mark">Z</span>
              <span>Zizilia</span>
            </Link>
            <div className="nav-links">
              <Link href="/trades">Feed</Link>
              <Link href="/me">Me</Link>
              <Link href="/settings">Settings</Link>
              <Link href="/wallet">Wallet</Link>
            </div>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
