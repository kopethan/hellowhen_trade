'use client';

import Link from 'next/link';
import { legalPolicyKeys, legalPolicyRoutes } from '@hellowhen/i18n';
import { MobilePage, PageIntro } from '../../components/MobilePage';
import { WebIcon } from '../../components/WebIcon';
import { useWebTranslation } from '../../providers/WebI18nProvider';

export function LegalOverviewClient() {
  const { t } = useWebTranslation();

  return (
    <MobilePage className="legal-page">
      <PageIntro eyebrow={t('legal.overview.eyebrow')} title={t('legal.overview.title')} body={t('legal.overview.body')} />

      <section className="mobile-card mobile-card--soft legal-launch-note">
        <span className="semantic-badge instruction">{t('legal.overview.launchBadge')}</span>
        <h3>{t('legal.overview.launchTitle')}</h3>
        <p>{t('legal.overview.launchBody')}</p>
      </section>

      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge success">{t('legal.overview.helpBadge')}</span>
        <h3>{t('legal.overview.helpTitle')}</h3>
        <p>{t('legal.overview.helpBody')}</p>
        <div className="cta-row">
          <Link href="/support" className="button secondary">{t('legal.overview.openSupport')}</Link>
          <Link href="/account/delete" className="button secondary danger-text">{t('legal.overview.openDeletion')}</Link>
        </div>
      </section>

      <div className="mobile-list legal-card-list">
        {legalPolicyKeys.map((policy) => (
          <Link key={policy} href={legalPolicyRoutes[policy]} className="mobile-link-card legal-link-card">
            <WebIcon name={policy === 'safety' || policy === 'refundDispute' ? 'warning' : 'help'} size={22} decorative className="mobile-link-card__icon" />
            <span className="mobile-link-card__body">
              <strong>{t(`legal.policies.${policy}.title`)}</strong>
              <br />
              {t(`legal.policies.${policy}.summary`)}
            </span>
            <span className="legal-link-card__action">{t('legal.overview.openPolicy')}</span>
          </Link>
        ))}
      </div>
    </MobilePage>
  );
}
