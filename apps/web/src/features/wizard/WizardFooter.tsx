'use client';

import Link from 'next/link';

type WizardFooterProps = {
  primaryLabel: string;
  onPrimary?: () => void;
  primaryType?: 'button' | 'submit';
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryLoadingLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryHref?: string;
  secondaryDisabled?: boolean;
  tertiaryLabel?: string;
  onTertiary?: () => void;
  tertiaryHref?: string;
  tertiaryDisabled?: boolean;
  helperText?: string;
};

export function WizardFooter({
  primaryLabel,
  onPrimary,
  primaryType = 'button',
  primaryDisabled = false,
  primaryLoading = false,
  primaryLoadingLabel,
  secondaryLabel,
  onSecondary,
  secondaryHref,
  secondaryDisabled = false,
  tertiaryLabel,
  onTertiary,
  tertiaryHref,
  tertiaryDisabled = false,
  helperText,
}: WizardFooterProps) {
  const isPrimaryDisabled = primaryDisabled || primaryLoading;

  return (
    <footer className="wizard-footer">
      {helperText ? <p className="wizard-footer__helper">{helperText}</p> : null}
      <div className="wizard-footer__actions">
        {secondaryLabel ? (
          secondaryHref ? (
            <Link className={`wizard-footer__button wizard-footer__button--secondary${secondaryDisabled || primaryLoading ? ' is-disabled' : ''}`} href={secondaryHref} aria-disabled={secondaryDisabled || primaryLoading}>
              {secondaryLabel}
            </Link>
          ) : (
            <button className="wizard-footer__button wizard-footer__button--secondary" type="button" disabled={secondaryDisabled || primaryLoading} onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )
        ) : null}
        <button className="wizard-footer__button wizard-footer__button--primary" type={primaryType} disabled={isPrimaryDisabled} onClick={onPrimary}>
          {primaryLoading ? primaryLoadingLabel ?? primaryLabel : primaryLabel}
        </button>
      </div>
      {tertiaryLabel ? (
        tertiaryHref ? (
          <Link className={`wizard-footer__tertiary${tertiaryDisabled || primaryLoading ? ' is-disabled' : ''}`} href={tertiaryHref} aria-disabled={tertiaryDisabled || primaryLoading}>
            {tertiaryLabel}
          </Link>
        ) : (
          <button className="wizard-footer__tertiary" type="button" disabled={tertiaryDisabled || primaryLoading} onClick={onTertiary}>
            {tertiaryLabel}
          </button>
        )
      ) : null}
    </footer>
  );
}
