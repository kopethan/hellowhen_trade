'use client';

import Link from 'next/link';
import { legalPolicyKeys, legalPolicyRoutes, legalPolicySectionKeys, type LegalPolicyKey } from '@hellowhen/i18n';
import { MobilePage, PageIntro } from '../../components/MobilePage';
import { useWebTranslation } from '../../providers/WebI18nProvider';

function isLegalPolicyKey(value: string): value is LegalPolicyKey {
  return legalPolicyKeys.includes(value as LegalPolicyKey);
}

export function LegalPolicyClient({ policy }: { policy: LegalPolicyKey }) {
  const { t } = useWebTranslation();

  if (!isLegalPolicyKey(policy)) return null;

  return (
    <MobilePage className="legal-page">
      <PageIntro
        eyebrow={t('legal.overview.eyebrow')}
        title={t(`legal.policies.${policy}.title`)}
        body={t(`legal.policies.${policy}.summary`)}
      />

      <p className="notice-box info legal-updated-note">{t(`legal.policies.${policy}.updated`)}</p>

      <div className="legal-policy-section-list">
        {legalPolicySectionKeys[policy].map((section) => (
          <section key={section} className="mobile-card legal-policy-section">
            <h3>{t(`legal.policies.${policy}.sections.${section}.title`)}</h3>
            <p>{t(`legal.policies.${policy}.sections.${section}.body`)}</p>
          </section>
        ))}
      </div>

      <section className="mobile-card mobile-card--soft legal-related-card">
        <span className="semantic-badge info">{t('navigation.routes.legal')}</span>
        <h3>{t('legal.overview.title')}</h3>
        <div className="cta-row">
          <Link href="/legal" className="button secondary">{t('navigation.routes.legal')}</Link>
          {legalPolicyKeys.filter((item) => item !== policy).map((item) => (
            <Link key={item} href={legalPolicyRoutes[item]} className="button secondary">{t(`legal.policies.${item}.shortTitle`)}</Link>
          ))}
        </div>
      </section>
    </MobilePage>
  );
}
