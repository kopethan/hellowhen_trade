'use client';

import Link from 'next/link';
import { MobilePage, PageIntro } from '../../components/MobilePage';
import { useWebTranslation } from '../../providers/WebI18nProvider';

export function PublicSupportClient() {
  const { t } = useWebTranslation();
  return (
    <MobilePage>
      <PageIntro eyebrow={t('support.public.eyebrow')} title={t('support.public.title')} body={t('support.public.body')} />
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
