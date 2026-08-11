'use client';

import Link from 'next/link';
import { MobilePage, PageIntro } from '../../components/MobilePage';
import { useWebTranslation } from '../../providers/WebI18nProvider';

const prohibitedKeys = ['csam', 'grooming', 'sexualization', 'sextortion', 'trafficking'] as const;
const responseKeys = ['review', 'remove', 'accounts', 'standards'] as const;

export function ChildSafetyStandardsClient() {
  const { t } = useWebTranslation();

  return (
    <MobilePage className="legal-page">
      <PageIntro
        eyebrow={t('legal.childSafety.eyebrow')}
        title={t('legal.childSafety.title')}
        body={t('legal.childSafety.summary')}
      />

      <p className="notice-box info legal-updated-note">{t('legal.childSafety.updated')}</p>

      <div className="legal-policy-section-list">
        <section className="mobile-card legal-policy-section">
          <h3>{t('legal.childSafety.standardsTitle')}</h3>
          <p>{t('legal.childSafety.standardsBody')}</p>
        </section>

        <section className="mobile-card legal-policy-section">
          <h3>{t('legal.childSafety.prohibitedTitle')}</h3>
          <p>{t('legal.childSafety.prohibitedBody')}</p>
          <ul className="policy-bullet-list">
            {prohibitedKeys.map((key) => <li key={key}>{t(`legal.childSafety.prohibited.${key}`)}</li>)}
          </ul>
        </section>

        <section className="mobile-card legal-policy-section">
          <h3>{t('legal.childSafety.notPermittedTitle')}</h3>
          <p>{t('legal.childSafety.notPermittedBody')}</p>
        </section>

        <section className="mobile-card legal-policy-section">
          <h3>{t('legal.childSafety.reportTitle')}</h3>
          <p>{t('legal.childSafety.reportBody')}</p>
          <ul className="policy-bullet-list">
            <li>{t('legal.childSafety.reportInApp')}</li>
            <li>{t('legal.childSafety.reportEmail')}</li>
          </ul>
          <div className="cta-row">
            <Link href="/support?category=safety_concern" className="button secondary">{t('legal.childSafety.reportAction')}</Link>
            <a href="mailto:support@hellowhen.com" className="button secondary">{t('legal.childSafety.emailAction')}</a>
          </div>
        </section>

        <section className="mobile-card legal-policy-section">
          <h3>{t('legal.childSafety.responseTitle')}</h3>
          <p>{t('legal.childSafety.responseBody')}</p>
          <ul className="policy-bullet-list">
            {responseKeys.map((key) => <li key={key}>{t(`legal.childSafety.response.${key}`)}</li>)}
          </ul>
        </section>

        <section className="mobile-card legal-policy-section">
          <h3>{t('legal.childSafety.authorityTitle')}</h3>
          <p>{t('legal.childSafety.authorityBody')}</p>
        </section>
      </div>

      <section className="mobile-card mobile-card--soft legal-related-card">
        <span className="semantic-badge info">{t('navigation.routes.legal')}</span>
        <h3>{t('legal.childSafety.relatedTitle')}</h3>
        <div className="cta-row">
          <Link href="/legal/privacy" className="button secondary">{t('legal.childSafety.privacyAction')}</Link>
          <Link href="/legal/terms" className="button secondary">{t('legal.childSafety.termsAction')}</Link>
          <Link href="/support?category=safety_concern" className="button secondary">{t('legal.childSafety.supportAction')}</Link>
        </div>
      </section>
    </MobilePage>
  );
}
