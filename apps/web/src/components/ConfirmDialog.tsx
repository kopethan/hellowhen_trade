'use client';

import { useEffect } from 'react';
import { useWebTranslation } from '../providers/WebI18nProvider';

type ConfirmDialogVariant = 'default' | 'danger' | 'warning';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  showCancel?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  eyebrow,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  loading = false,
  showCancel = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useWebTranslation();
  const confirmText = confirmLabel ?? t('common.actions.confirm');
  const cancelText = cancelLabel ?? t('common.actions.cancel');

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [loading, onCancel, open]);

  if (!open) return null;

  const badgeClass = variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : 'instruction';
  const confirmClass = variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : '';

  return (
    <div className="app-dialog" role="presentation" onMouseDown={() => { if (!loading) onCancel(); }}>
      <section
        className={`app-dialog__panel app-dialog__panel--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="app-dialog__content">
          {eyebrow ? <span className={`semantic-badge ${badgeClass}`}>{eyebrow}</span> : null}
          <h2 id="app-dialog-title">{title}</h2>
          <p>{body}</p>
        </div>
        <div className="app-dialog__actions">
          {showCancel ? <button type="button" className="secondary" onClick={onCancel} disabled={loading}>{cancelText}</button> : null}
          <button type="button" className={confirmClass} onClick={() => void onConfirm()} disabled={loading}>{loading ? t('common.states.working') : confirmText}</button>
        </div>
      </section>
    </div>
  );
}
