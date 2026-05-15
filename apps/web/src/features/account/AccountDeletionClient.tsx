'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { AccountDeletionRequestDto } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';

function normalizeRequest(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { request?: unknown };
  return record.request && typeof record.request === 'object' ? record.request as AccountDeletionRequestDto : null;
}

export function AccountDeletionClient() {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const [request, setRequest] = useState<AccountDeletionRequestDto | null>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function loadRequest() {
    if (!auth.hydrated) return;
    if (!auth.isAuthenticated) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      setRequest(normalizeRequest(await api.account.deletionRequest()));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRequest(); }, [auth.hydrated, auth.isAuthenticated]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setNotice(''); setError('');
    try {
      const response = await api.account.requestDeletion({ reason: reason.trim() || undefined, details: details.trim() || undefined });
      setRequest(normalizeRequest(response));
      setReason(''); setDetails(''); setNotice(t('account.deletion.requestCreated'));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    setSaving(true); setNotice(''); setError('');
    try {
      const response = await api.account.cancelDeletionRequest();
      setRequest(normalizeRequest(response));
      setNotice(t('account.deletion.requestCancelled'));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  if (!auth.hydrated || loading) return <p className="notice-box info">{t('common.states.loading')}…</p>;
  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <h3>{t('account.deletion.signedOutTitle')}</h3>
        <p>{t('account.deletion.signedOutBody')}</p>
        <Link href="/auth?next=/account/delete" className="button primary">{t('common.actions.loginOrRegister')}</Link>
      </section>
    );
  }

  const active = request && ['requested', 'in_review'].includes(request.status);

  return (
    <div className="account-deletion-flow">
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge warning">{t('account.deletion.badge')}</span>
        <h3>{t('account.deletion.whatHappensTitle')}</h3>
        <p>{t('account.deletion.whatHappensBody')}</p>
        <ul className="policy-bullet-list">
          <li>{t('account.deletion.pointProfile')}</li>
          <li>{t('account.deletion.pointSafety')}</li>
          <li>{t('account.deletion.pointSupport')}</li>
        </ul>
      </section>

      {active ? (
        <section className="mobile-card settings-panel">
          <div>
            <span className="semantic-badge instruction">{request.status}</span>
            <h3>{t('account.deletion.activeTitle')}</h3>
            <p>{t('account.deletion.activeBody')}</p>
          </div>
          <button type="button" className="secondary" disabled={saving} onClick={() => void cancel()}>{t('account.deletion.cancelRequest')}</button>
        </section>
      ) : (
        <form className="mobile-card settings-panel" onSubmit={submit}>
          <div>
            <h3>{t('account.deletion.formTitle')}</h3>
            <p>{t('account.deletion.formBody')}</p>
          </div>
          <label className="field-label">
            {t('account.deletion.reason')}
            <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={120} placeholder={t('account.deletion.reasonPlaceholder')} />
          </label>
          <label className="field-label">
            {t('account.deletion.details')}
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={2000} rows={5} placeholder={t('account.deletion.detailsPlaceholder')} />
          </label>
          <button type="submit" className="danger-button" disabled={saving}>{saving ? t('common.states.submitting') : t('account.deletion.submitRequest')}</button>
        </form>
      )}

      <section className="mobile-card mobile-card--soft">
        <h3>{t('account.deletion.needHelpTitle')}</h3>
        <p>{t('account.deletion.needHelpBody')}</p>
        <Link href="/account/support" className="button secondary">{t('account.items.support.title')}</Link>
      </section>

      {notice ? <p className="notice-box success">{notice}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}
    </div>
  );
}
