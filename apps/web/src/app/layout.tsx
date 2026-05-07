import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Hellowhen',
  description: 'Publish needs, offers, and focused public trades.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="shell">
          <nav className="nav">
            <Link href="/" className="brand" aria-label="Hellowhen home">
              <img src="/brand/wordmark-light.svg" alt="Hellowhen" className="brand-wordmark" />
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
