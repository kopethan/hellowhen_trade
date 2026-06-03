import type { CSSProperties } from 'react';

export type WebIconName =
  | 'add'
  | 'arrow-right'
  | 'back'
  | 'deck-advance'
  | 'deck-back'
  | 'dispute'
  | 'filter'
  | 'help'
  | 'more'
  | 'need'
  | 'offer'
  | 'profile'
  | 'proposal'
  | 'proposal-accepted'
  | 'proposal-declined'
  | 'report-flag'
  | 'search'
  | 'settings'
  | 'share'
  | 'trade'
  | 'warning';

type WebIconProps = {
  name: WebIconName;
  size?: number;
  label?: string;
  className?: string;
  decorative?: boolean;
};

type WebIconStyle = CSSProperties & {
  '--web-icon-url': string;
  '--web-icon-size': string;
};

export function WebIcon({ name, size = 20, label, className, decorative }: WebIconProps) {
  const isDecorative = decorative ?? !label;
  const style: WebIconStyle = {
    '--web-icon-url': `url('/icons/outline/${name}.svg')`,
    '--web-icon-size': `${size}px`,
  };

  return (
    <span
      aria-hidden={isDecorative ? 'true' : undefined}
      aria-label={!isDecorative ? label : undefined}
      className={className ? `web-icon ${className}` : 'web-icon'}
      role={!isDecorative ? 'img' : undefined}
      style={style}
    />
  );
}