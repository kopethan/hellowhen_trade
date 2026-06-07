'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { WebIcon, type WebIconName } from './WebIcon';

type OptionPickerTone = 'default' | 'danger' | 'warning' | 'muted';

type WebOptionPickerShellProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function WebOptionPickerShell({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
}: WebOptionPickerShellProps) {
  return (
    <section className={`web-option-picker ${className}`.trim()}>
      <div className="web-option-picker__intro">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="web-option-picker__action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

type WebOptionPickerPanelProps = {
  eyebrow?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function WebOptionPickerPanel({ eyebrow, badge, children, className = '' }: WebOptionPickerPanelProps) {
  return (
    <div className={`web-option-picker-panel ${className}`.trim()}>
      {eyebrow || badge ? (
        <div className="web-option-picker-panel__top">
          {eyebrow ? <span>{eyebrow}</span> : <span aria-hidden="true" />}
          {badge ? <em>{badge}</em> : null}
        </div>
      ) : null}
      <div className="web-option-picker-panel__list">{children}</div>
    </div>
  );
}

type WebOptionPickerCardBaseProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  iconName?: WebIconName;
  trailing?: ReactNode;
  tone?: OptionPickerTone;
  dashed?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
};

type WebOptionPickerCardProps = WebOptionPickerCardBaseProps & {
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
};

function cardClassName({ tone = 'default', dashed, disabled, className = '' }: Pick<WebOptionPickerCardProps, 'tone' | 'dashed' | 'disabled' | 'className'>) {
  return [
    'web-option-picker-card',
    tone !== 'default' ? `web-option-picker-card--${tone}` : '',
    dashed ? 'web-option-picker-card--dashed' : '',
    disabled ? 'is-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

function WebOptionPickerCardContent({
  title,
  description,
  meta,
  icon,
  iconName,
  trailing,
  children,
}: WebOptionPickerCardBaseProps) {
  const resolvedTrailing = trailing ?? <span className="web-option-picker-card__chevron" aria-hidden="true">→</span>;

  return (
    <>
      <span className="web-option-picker-card__icon" aria-hidden="true">
        {icon ?? (iconName ? <WebIcon name={iconName} size={22} decorative /> : null)}
      </span>
      <span className="web-option-picker-card__body">
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
        {meta ? <span className="web-option-picker-card__meta">{meta}</span> : null}
        {children}
      </span>
      {resolvedTrailing}
    </>
  );
}

export function WebOptionPickerCard(props: WebOptionPickerCardProps) {
  const { href, onClick, type = 'button', disabled, ...contentProps } = props;
  const className = cardClassName(props);

  if (href && !disabled) {
    return (
      <Link className={className} href={href}>
        <WebOptionPickerCardContent {...contentProps} disabled={disabled} />
      </Link>
    );
  }

  return (
    <button className={className} type={type} onClick={onClick} disabled={disabled}>
      <WebOptionPickerCardContent {...contentProps} disabled={disabled} />
    </button>
  );
}

export function WebOptionPickerDangerCard(props: Omit<WebOptionPickerCardProps, 'tone'>) {
  return <WebOptionPickerCard {...props} tone="danger" />;
}
