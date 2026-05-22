'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CreateGuestSupportTicketRequest } from '@hellowhen/contracts';
import { MobilePage, PageIntro } from '../../components/MobilePage';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebTranslation } from '../../providers/WebI18nProvider';

type GuestSupportCategory = CreateGuestSupportTicketRequest['category'];

const guestCategories: GuestSupportCategory[] = [
  'account_recovery',
  'account_issue',
  'safety_concern',
  'bug_report',
  'general_feedback',
];

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function PublicSupportClient({ initialCategory = 'account_recovery' }: { initialCategory?: GuestSupportCategory }) {
  const { t } = useWebTranslation();
  const safeInitialCategory = guestCategories.includes(initialCategory) ? initialCategory : 'account_recovery';
  const [email, setEmail] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GuestSupportCategory>(safeInitialCategory);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');


  function validateGuestSupportRequest() {
    const contactEmail = email.trim();
    const accountAccessEmail = accountEmail.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!isValidEmailAddress(contactEmail)) return t('support.public.validationContactEmail');
    if (accountAccessEmail && !isValidEmailAddress(accountAccessEmail)) return t('support.public.validationAccountEmail');
    if (trimmedSubject.length < 3) return t('support.public.validationSubject');
    if (trimmedMessage.length < 10) return t('support.public.validationMessage');
    return '';
  }

  async function submitGuestSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    const validationError = validateGuestSupportRequest();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await api.support.createGuestTicket({
        email: email.trim(),
        accountEmail: accountEmail.trim() || undefined,
        name: name.trim() || undefined,
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setNotice(t('support.public.guestSuccess'));
      setEmail('');
      setAccountEmail('');
      setName('');
      setCategory('account_recovery');
      setSubject('');
      setMessage('');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MobilePage>
      <PageIntro eyebrow={t('support.public.eyebrow')} title={t('support.public.title')} body={t('support.public.body')} />
      {notice ? <p className="notice-box success">{notice}</p> : null}

      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge warning">{t('support.public.guestBadge')}</span>
        <h3>{t('support.public.guestTitle')}</h3>
        <p>{t('support.public.guestBody')}</p>
        <form onSubmit={submitGuestSupport} className="form-grid" noValidate>
          <label className="field-label">
            {t('support.public.contactEmail')}
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder={t('support.public.contactEmailPlaceholder')} />
          </label>
          <label className="field-label">
            {t('support.public.accountEmail')}
            <input value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} type="email" autoComplete="email" placeholder={t('support.public.accountEmailPlaceholder')} />
          </label>
          <label className="field-label">
            {t('support.public.name')}
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder={t('support.public.namePlaceholder')} />
          </label>
          <label className="field-label">
            {t('support.category')}
            <select value={category} onChange={(event) => setCategory(event.target.value as GuestSupportCategory)}>
              {guestCategories.map((item) => <option key={item} value={item}>{t(`support.categories.${item}`)}</option>)}
            </select>
          </label>
          <label className="field-label">
            {t('support.subject')}
            <input value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={3} maxLength={140} placeholder={t('support.public.subjectPlaceholder')} />
          </label>
          <label className="field-label">
            {t('support.message')}
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={4000} rows={6} placeholder={t('support.public.messagePlaceholder')} />
          </label>
          <p className="notice-box info">{t('support.public.guestPrivacy')}</p>
          {error ? <p className="notice-box danger">{error}</p> : null}
          <button type="submit" disabled={submitting}>{submitting ? t('support.creatingTicket') : t('support.public.submitGuest')}</button>
        </form>
      </section>

      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge success">{t('support.title')}</span>
        <h3>{t('support.public.privateTitle')}</h3>
        <p>{t('support.public.privateBody')}</p>
        <div className="cta-row">
          <Link href="/account/support" className="button primary">{t('support.public.openSupport')}</Link>
          <Link href="/legal/safety" className="button secondary">{t('legal.policies.safety.title')}</Link>
        </div>
      </section>
      <section className="mobile-card mobile-card--soft">
        <h3>{t('account.deletion.title')}</h3>
        <p>{t('support.public.deletionBody')}</p>
        <Link href="/account/delete" className="button secondary">{t('account.deletion.submitRequest')}</Link>
      </section>
    </MobilePage>
  );
}
