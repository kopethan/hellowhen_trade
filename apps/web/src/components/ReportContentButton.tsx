'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import type { ReportReason, ReportTargetType } from '@hellowhen/contracts';
import { api } from '../lib/api';
import { getFriendlyApiErrorMessage } from '../lib/webErrors';
import { useWebAuth } from '../providers/WebAuthProvider';
import { useWebTranslation } from '../providers/WebI18nProvider';
import { WebIcon } from './WebIcon';

type ReportContentButtonProps = {
  targetType: ReportTargetType;
  targetId: string;
  labelKey?: string;
  helperKey?: string;
  buttonClassName?: string;
};

const reportReasons: ReportReason[] = ['spam', 'scam', 'harassment', 'illegal_unsafe', 'fake_profile', 'inappropriate_image', 'other'];

export function ReportContentButton({ targetType, targetId, labelKey = 'report.button', helperKey = 'report.helper.content', buttonClassName = 'button secondary danger-text' }: ReportContentButtonProps) {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.isAuthenticated) {
      setNotice(t('report.loginRequired'));
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.reports.create({ targetType, targetId, reason, details: details.trim() || undefined }) as { duplicate?: boolean };
      setNotice(response.duplicate ? t('report.duplicate') : t('report.sent'));
      setDetails('');
      if (!response.duplicate) setReason('spam');
      setOpen(false);
    } catch (cause) {
      const body = typeof cause === 'object' && cause && 'body' in cause ? (cause as { body?: { error?: string } }).body : undefined;
      if (body?.error === 'cannot_report_own_content') setNotice(t('report.ownContent'));
      else setNotice(getFriendlyApiErrorMessage(cause, t('report.error')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="report-content-block">
      <button type="button" className={buttonClassName} onClick={() => setOpen((value) => !value)} disabled={loading}>
        <WebIcon name="report-flag" size={16} decorative /> {open ? t('report.cancel') : t(labelKey)}
      </button>
      {notice ? <p className="notice-box info">{notice}</p> : null}
      {open ? (
        <form className="proposal-composer report-content-form" onSubmit={submitReport}>
          <p className="meta">{t(helperKey)}</p>
          <label className="field-label">
            {t('report.reason')}
            <select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>
              {reportReasons.map((item) => <option key={item} value={item}>{t(`report.reasons.${item}`)}</option>)}
            </select>
          </label>
          <label className="field-label">
            {t('report.detailsOptional')}
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder={t('report.detailsPlaceholder')} rows={4} />
          </label>
          <button type="submit" disabled={loading || !auth.isAuthenticated}>{loading ? t('report.sending') : t('report.send')}</button>
          {!auth.isAuthenticated ? <p className="meta">{t('report.loginRequired')}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
