import type { ReactNode } from 'react';

export function MobilePage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mobile-page ${className}`.trim()}>{children}</section>;
}

export function PageIntro({ eyebrow, title, body, action }: { eyebrow?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="page-intro">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {body ? <p>{body}</p> : null}
      </div>
      {action ? <div className="page-intro__action">{action}</div> : null}
    </div>
  );
}
