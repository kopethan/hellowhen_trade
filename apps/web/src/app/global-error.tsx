'use client';

import { useEffect, type CSSProperties } from 'react';

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  display: 'grid',
  placeItems: 'center',
  background: '#020617',
  color: '#f8fafc',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const cardStyle: CSSProperties = {
  width: 'min(92vw, 440px)',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  borderRadius: 28,
  padding: 24,
  background: 'rgba(15, 23, 42, 0.96)',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.4)',
};

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 16,
  borderRadius: 999,
  border: '1px solid rgba(248, 250, 252, 0.24)',
  background: '#f8fafc',
  color: '#020617',
  padding: '12px 16px',
  fontWeight: 800,
  cursor: 'pointer',
};

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Hellowhen global web error', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={pageStyle}>
        <main style={cardStyle}>
          <p style={{ margin: '0 0 10px', color: '#67e8f9', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>Temporary issue</p>
          <h1 style={{ margin: '0 0 12px', fontSize: 28, lineHeight: 1.1 }}>Hellowhen is having trouble loading</h1>
          <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
            This may happen during a short beta deploy or server restart. Please retry in a moment.
          </p>
          {error.digest ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Error reference: {error.digest}</p> : null}
          <button type="button" style={buttonStyle} onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
