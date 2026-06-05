'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { normalizePreviewCardTheme, previewCardThemeClassName } from '@hellowhen/shared';
import { useWebTranslation } from '../../providers/WebI18nProvider';

type TradePosterCardProps = {
  id: string;
  imageUrl?: string | null;
  imageAlt?: string;
  badge: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  detailTitle?: string;
  chips?: string[];
  footer?: ReactNode;
  variant?: 'trade' | 'need' | 'offer';
  previewTheme?: string | null;
};

const FALLBACK_ACCENTS = ['#f97316', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'];
const THEME_ACCENTS = {
  default: null,
  blue: '#3b82f6',
  green: '#10b981',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
} as const;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function fallbackModel(id: string, variant: TradePosterCardProps['variant']) {
  const hash = hashString(`${variant ?? 'trade'}-${id}`);
  const accent = FALLBACK_ACCENTS[hash % FALLBACK_ACCENTS.length] ?? FALLBACK_ACCENTS[0] ?? '#6366f1';
  const hue = hash % 360;
  const hueTwo = (hue + 38 + (hash % 64)) % 360;
  const lineOffset = hash % 43;

  return {
    accent,
    hue,
    hueTwo,
    lineOffset,
  };
}

export function TradePosterCard({ id, imageUrl, imageAlt, badge, eyebrow, title, subtitle, detailTitle, chips = [], footer, variant = 'trade', previewTheme }: TradePosterCardProps) {
  const { t } = useWebTranslation();
  const [imageFailed, setImageFailed] = useState(!imageUrl);
  const visibleImageUrl = imageUrl && !imageFailed ? imageUrl : null;
  const fallback = useMemo(() => fallbackModel(id, variant), [id, variant]);
  const visibleChips = chips.filter(Boolean).slice(0, 3);
  const themeAccent = THEME_ACCENTS[normalizePreviewCardTheme(previewTheme)] ?? fallback.accent;

  useEffect(() => {
    setImageFailed(!imageUrl);
  }, [imageUrl]);

  return (
    <article
      className={`trade-poster-card trade-poster-card--${variant} ${previewCardThemeClassName(previewTheme)}${visibleImageUrl ? ' has-image' : ' has-fallback'}`}
      style={{
        '--poster-accent': themeAccent,
        '--poster-hue': String(fallback.hue),
        '--poster-hue-two': String(fallback.hueTwo),
      } as CSSProperties}
    >
      {visibleImageUrl ? (
        <img className="trade-poster-card__media" src={visibleImageUrl} alt={imageAlt ?? title} loading="lazy" onError={() => setImageFailed(true)} />
      ) : (
        <div className="trade-poster-card__fallback" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => {
            const top = 18 + index * 8.8;
            const left = 7 + ((fallback.lineOffset + index * 13) % 42);

            return <span key={`${id}-fallback-line-${index}`} style={{ '--line-top': `${top}%`, '--line-left': `${left}%` } as CSSProperties} />;
          })}
          <i />
        </div>
      )}

      <div className="trade-poster-card__atmosphere" aria-hidden="true">
        <span className="trade-poster-card__blur-band trade-poster-card__blur-band--1" />
        <span className="trade-poster-card__blur-band trade-poster-card__blur-band--2" />
        <span className="trade-poster-card__blur-band trade-poster-card__blur-band--3" />
        <span className="trade-poster-card__blur-band trade-poster-card__blur-band--4" />
        <span className="trade-poster-card__bottom-wash" />
      </div>

      <div className="trade-poster-card__content">
        <div className="trade-poster-card__topbar">
          <span className={`trade-poster-card__badge trade-poster-card__badge--${variant}`}>{badge}</span>
        </div>

        <div className="trade-poster-card__copy">
          {eyebrow ? <p className="trade-poster-card__eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {detailTitle ? <p className="trade-poster-card__detail-title">{detailTitle}</p> : null}
          {subtitle ? <p className="trade-poster-card__subtitle">{subtitle}</p> : null}
          {footer ? <div className="trade-poster-card__footer">{footer}</div> : null}
          {visibleChips.length ? (
            <div className="trade-poster-card__chips" aria-label={t('trade.labels.tags')}>
              {visibleChips.map((chip) => (
                <span key={`${id}-${chip}`}>{chip}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
