'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { PlusSubscriptionSnapshotResponse } from '@hellowhen/contracts';
import type { SupportedLanguage, TranslationValues } from '@hellowhen/i18n';
import {
  ACCOUNT_IDENTITY_METADATA,
  HANDLE_NAMESPACE_METADATA,
  MEMBERSHIP_FEATURE_CATALOG,
  PERSONAL_MEMBERSHIP_TIER_METADATA,
  normalizePersonalMembershipTier,
  normalizeSubscriptionStatus,
  type AccountIdentityMetadata,
  type MembershipFeatureAvailability,
  type MembershipFeatureInclusion,
  type MembershipFeatureKey,
  type PersonalMembershipTier,
  type PersonalMembershipTierMetadata,
  type SubscriptionStatus,
} from '@hellowhen/shared';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { formatWebDate, formatWebMoney } from '../../lib/webFormat';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';

const personalCards = [
  PERSONAL_MEMBERSHIP_TIER_METADATA.free,
  PERSONAL_MEMBERSHIP_TIER_METADATA.plus,
  PERSONAL_MEMBERSHIP_TIER_METADATA.pro,
] as const;

const featureLimit = 5;
const membershipRoute = '/account/membership';

type MembershipSnapshot = PlusSubscriptionSnapshotResponse | null;
type WebTranslator = (key: string, values?: TranslationValues) => string;

type MembershipCardAction = {
  label: string;
  href?: string;
  disabled?: boolean;
};

function formatStatus(status: SubscriptionStatus, t: WebTranslator) {
  return t(`account.membership.statusLabels.${status}`);
}

function formatStatusTitle(status: SubscriptionStatus, t: WebTranslator) {
  return t(`account.membership.statusTitles.${status}`);
}

function statusTone(status: SubscriptionStatus) {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'success';
    case 'past_due':
      return 'warning';
    case 'canceled':
    case 'expired':
      return 'danger';
    case 'none':
    default:
      return 'neutral';
  }
}

function boolStatusLabel(value: boolean, t: WebTranslator) {
  return value ? t('account.membership.booleans.enabled') : t('account.membership.booleans.hidden');
}

function boolStatusTone(value: boolean) {
  return value ? 'success' : 'neutral';
}

function formatSubscriptionDate(value: string | null | undefined, language: SupportedLanguage) {
  return formatWebDate(value, '—', language);
}

function formatPeriodSummary(snapshot: MembershipSnapshot, language: SupportedLanguage, t: WebTranslator) {
  const state = snapshot?.subscriptionState;
  if (!state) return t('account.membership.statusOverview.noBillingPeriod');
  if (state.trialEndsAt) {
    return t('account.membership.statusOverview.periodTrialEnds', { date: formatSubscriptionDate(state.trialEndsAt, language) });
  }
  if (state.currentPeriodEndsAt) {
    return t('account.membership.statusOverview.periodCurrentEnds', { date: formatSubscriptionDate(state.currentPeriodEndsAt, language) });
  }
  if (state.expiresAt) {
    return t('account.membership.statusOverview.periodAccessExpires', { date: formatSubscriptionDate(state.expiresAt, language) });
  }
  if (state.canceledAt) {
    return t('account.membership.statusOverview.periodCanceled', { date: formatSubscriptionDate(state.canceledAt, language) });
  }
  return t('account.membership.statusOverview.noPeriod');
}

function formatUpdatedAt(value: string | null | undefined, language: SupportedLanguage, t: WebTranslator) {
  if (!value) return t('account.membership.statusOverview.noStatusUpdate');
  return t('account.membership.statusOverview.statusUpdated', { date: formatSubscriptionDate(value, language) });
}

function availabilityTone(availability: MembershipFeatureAvailability) {
  switch (availability) {
    case 'included':
      return 'success';
    case 'limited':
      return 'instruction';
    case 'future':
      return 'info';
    case 'upgrade':
    default:
      return 'warning';
  }
}

function availabilityLabel(availability: MembershipFeatureAvailability, t: WebTranslator) {
  return t(`account.membership.availability.${availability}`);
}

function featureLabel(key: MembershipFeatureKey, t: WebTranslator) {
  const catalogEntry = MEMBERSHIP_FEATURE_CATALOG[key];
  const label = t(`account.membership.features.${key}.shortLabel`);
  return label === `account.membership.features.${key}.shortLabel` ? catalogEntry.shortLabel : label;
}

function featureNote(feature: MembershipFeatureInclusion, t: WebTranslator) {
  if (!feature.note) return null;
  const key = `account.membership.featureNotes.${feature.key}.${feature.availability}`;
  const note = t(key);
  return note === key ? feature.note : note;
}

function tierDisplayName(tier: PersonalMembershipTier, t: WebTranslator) {
  return t(`account.membership.tiers.${tier}.displayName`);
}

function tierDescription(tier: PersonalMembershipTier, t: WebTranslator) {
  return t(`account.membership.tiers.${tier}.description`);
}

function tierBadgeLabel(tier: PersonalMembershipTier, t: WebTranslator) {
  return t(`account.membership.tiers.${tier}.badgeLabel`);
}

function identityDisplayName(identityType: AccountIdentityMetadata['identityType'], t: WebTranslator) {
  return t(`account.membership.identities.${identityType}.displayName`);
}

function identityDescription(identityType: AccountIdentityMetadata['identityType'], t: WebTranslator) {
  return t(`account.membership.identities.${identityType}.description`);
}

function identityBadgeLabel(identityType: AccountIdentityMetadata['identityType'], t: WebTranslator) {
  return t(`account.membership.identities.${identityType}.badgeLabel`);
}

function FeatureList({ features, t }: { features: readonly MembershipFeatureInclusion[]; t: WebTranslator }) {
  const visibleFeatures = features.slice(0, featureLimit);
  const extraCount = Math.max(features.length - visibleFeatures.length, 0);

  return (
    <ul className="membership-card__features">
      {visibleFeatures.map((feature) => {
        const note = featureNote(feature, t);
        return (
          <li key={`${feature.key}-${feature.availability}`}>
            <span className={`semantic-badge ${availabilityTone(feature.availability)}`}>{availabilityLabel(feature.availability, t)}</span>
            <span>
              <strong>{featureLabel(feature.key, t)}</strong>
              {note ? <small>{note}</small> : null}
            </span>
          </li>
        );
      })}
      {extraCount > 0 ? <li className="membership-card__feature-more">{t('account.membership.moreFeatures', { count: extraCount })}</li> : null}
    </ul>
  );
}

function CardAction({ action }: { action: MembershipCardAction }) {
  if (action.href && !action.disabled) return <Link className="button full" href={action.href}>{action.label}</Link>;
  return <button className="secondary full" type="button" disabled>{action.label}</button>;
}

function PersonalTierCard({
  card,
  currentTier,
  currentStatus,
  action,
  statusLoaded,
  t,
}: {
  card: PersonalMembershipTierMetadata;
  currentTier: PersonalMembershipTier;
  currentStatus: SubscriptionStatus;
  action: MembershipCardAction;
  statusLoaded: boolean;
  t: WebTranslator;
}) {
  const isCurrent = statusLoaded && card.tier === currentTier;
  const currentIsActive = currentStatus === 'active' || currentStatus === 'trialing';
  const badgeClass = card.tier === 'plus' ? 'success' : card.tier === 'pro' ? 'professional' : 'neutral';

  return (
    <article className={`membership-card ${card.featured ? 'is-featured' : ''}`.trim()}>
      <div className="membership-card__header">
        <div>
          <span className={`semantic-badge ${badgeClass}`}>{tierBadgeLabel(card.tier, t)}</span>
          <h3>{tierDisplayName(card.tier, t)}</h3>
          <p>{tierDescription(card.tier, t)}</p>
        </div>
        {isCurrent ? (
          <span className={`semantic-badge ${currentIsActive ? 'success' : 'instruction'}`}>
            {currentIsActive ? t('account.membership.currentTierBadge') : formatStatus(currentStatus, t)}
          </span>
        ) : null}
      </div>
      <FeatureList features={card.featureInclusions} t={t} />
      <p className="membership-card__boundary">{t(`account.membership.tiers.${card.tier}.boundary`)}</p>
      <CardAction action={action} />
    </article>
  );
}

function MembershipStatusOverview({
  snapshot,
  currentTier,
  currentStatus,
  loadError,
  language,
  t,
}: {
  snapshot: MembershipSnapshot;
  currentTier: PersonalMembershipTier;
  currentStatus: SubscriptionStatus;
  loadError: boolean;
  language: SupportedLanguage;
  t: WebTranslator;
}) {
  const statusLabel = formatStatusTitle(currentStatus, t);
  const hasSnapshot = Boolean(snapshot);
  const hasPlusAccess = Boolean(snapshot?.access.hasPlusAccess);
  const canSeePlusSurfaces = Boolean(snapshot?.access.canSeePlusSurfaces);
  const quota = snapshot?.aiAssistUsage;
  const monthlyPrice = formatWebMoney(
    snapshot?.price.monthlyCents ?? betaFeatures.plusSubscriptionFeatures.monthlyPriceCents,
    snapshot?.price.monthlyCurrency ?? betaFeatures.plusSubscriptionFeatures.monthlyPriceCurrency,
  );

  if (loadError) {
    return (
      <section className="membership-status-overview membership-status-overview--error">
        <div className="membership-status-overview__main">
          <span className="semantic-badge warning">{t('account.membership.statusOverview.errorBadge')}</span>
          <h3>{t('account.membership.statusOverview.errorTitle')}</h3>
          <p>{t('account.membership.statusOverview.errorBody')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="membership-status-overview">
      <div className="membership-status-overview__main">
        <span className="semantic-badge info">{t('account.membership.statusOverview.currentBadge')}</span>
        <h3>
          {hasSnapshot
            ? t('account.membership.statusOverview.loadedTitle', { tier: tierDisplayName(currentTier, t), status: statusLabel })
            : t('account.membership.statusOverview.loadingTitle')}
        </h3>
        <p>{t('account.membership.statusOverview.body')}</p>
      </div>
      <div className="membership-status-grid" aria-label={t('account.membership.statusOverview.gridAria')}>
        <div className="membership-status-tile">
          <span>{t('account.membership.statusOverview.personalTier')}</span>
          <strong>{tierDisplayName(currentTier, t)}</strong>
          <small>{tierDescription(currentTier, t)}</small>
        </div>
        <div className="membership-status-tile">
          <span>{t('account.membership.statusOverview.subscriptionStatus')}</span>
          <strong><span className={`semantic-badge ${statusTone(currentStatus)}`}>{statusLabel}</span></strong>
          <small>{formatUpdatedAt(snapshot?.state.subscriptionStatusUpdatedAt, language, t)}</small>
        </div>
        <div className="membership-status-tile">
          <span>{t('account.membership.statusOverview.plusAccess')}</span>
          <strong>
            <span className={`semantic-badge ${hasPlusAccess ? 'success' : 'neutral'}`}>
              {hasPlusAccess ? t('account.membership.statusOverview.plusAccessAvailable') : t('account.membership.statusOverview.plusAccessNotActive')}
            </span>
          </strong>
          <small>{canSeePlusSurfaces ? t('account.membership.statusOverview.plusSurfacesVisible') : t('account.membership.statusOverview.plusSurfacesHidden')}</small>
        </div>
        <div className="membership-status-tile">
          <span>{t('account.membership.statusOverview.aiQuota')}</span>
          <strong>{quota ? `${quota.remaining}/${quota.quota}` : '—'}</strong>
          <small>{quota ? t('account.membership.statusOverview.aiQuotaDetails', { date: formatSubscriptionDate(quota.resetAt, language) }) : t('account.membership.statusOverview.aiQuotaEmpty')}</small>
        </div>
        <div className="membership-status-tile">
          <span>{t('account.membership.statusOverview.period')}</span>
          <strong>{formatPeriodSummary(snapshot, language, t)}</strong>
          <small>{t('account.membership.statusOverview.noPaymentProvider')}</small>
        </div>
        <div className="membership-status-tile">
          <span>{t('account.membership.statusOverview.referencePrice')}</span>
          <strong>{t('account.membership.statusOverview.monthlyPrice', { price: monthlyPrice })}</strong>
          <small>{t('account.membership.statusOverview.referencePriceNote')}</small>
        </div>
      </div>
    </section>
  );
}

function MembershipAvailabilityPanel({ t }: { t: WebTranslator }) {
  const featureRows = [
    { key: 'plusMembershipSurfaces', enabled: betaFeatures.plusSubscriptionFeatures.plusPublic },
    { key: 'savedLibrary', enabled: betaFeatures.savedLibraryEnabled },
    { key: 'agenda', enabled: betaFeatures.agendaEnabled },
    { key: 'aiAssistance', enabled: betaFeatures.plusSubscriptionFeatures.aiAssistEnabled },
    { key: 'customization', enabled: betaFeatures.plusSubscriptionFeatures.customizationEnabled },
    { key: 'proAccountSurfaces', enabled: betaFeatures.proSubscriptionFeatures.proAccountsVisible },
    { key: 'businessIdentitySurfaces', enabled: betaFeatures.businessAccountsVisible },
  ] as const;

  return (
    <section className="membership-availability-panel">
      <div>
        <span className="semantic-badge neutral">{t('account.membership.availabilityPanel.badge')}</span>
        <h3>{t('account.membership.availabilityPanel.title')}</h3>
        <p>{t('account.membership.availabilityPanel.body')}</p>
      </div>
      <div className="membership-availability-list">
        {featureRows.map((row) => (
          <div key={row.key} className="membership-availability-row">
            <span className={`semantic-badge ${boolStatusTone(row.enabled)}`}>{boolStatusLabel(row.enabled, t)}</span>
            <div>
              <strong>{t(`account.membership.availabilityPanel.rows.${row.key}.label`)}</strong>
              <small>{t(`account.membership.availabilityPanel.rows.${row.key}.note`)}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BusinessBoundaryPanel({ t }: { t: WebTranslator }) {
  return (
    <section className="membership-boundary-panel" aria-label={t('account.membership.boundaryPanel.aria')}>
      <div className="membership-boundary-card">
        <span className="semantic-badge neutral">{t('account.membership.boundaryPanel.personalBadge')}</span>
        <h3>{t('account.membership.boundaryPanel.personalTitle')}</h3>
        <p>{t('account.membership.boundaryPanel.personalBody')}</p>
        <strong>{HANDLE_NAMESPACE_METADATA.personal.pathPattern}</strong>
      </div>
      <div className="membership-boundary-card membership-boundary-card--business">
        <span className="semantic-badge business">{t('account.membership.boundaryPanel.businessBadge')}</span>
        <h3>{t('account.membership.boundaryPanel.businessTitle')}</h3>
        <p>{t('account.membership.boundaryPanel.businessBody')}</p>
        <strong>{HANDLE_NAMESPACE_METADATA.organization.pathPattern}</strong>
      </div>
    </section>
  );
}

function BusinessIdentityCard({ card, t }: { card: AccountIdentityMetadata; t: WebTranslator }) {
  const namespace = HANDLE_NAMESPACE_METADATA[card.handleNamespace];
  const action: MembershipCardAction = betaFeatures.businessAccountsVisible
    ? { label: t('account.membership.actions.openBusinessArea'), href: '/account/business' }
    : { label: t('account.membership.actions.businessHidden'), disabled: true };

  return (
    <article className="membership-card membership-card--business">
      <div className="membership-card__header">
        <div>
          <span className="semantic-badge business">{identityBadgeLabel(card.identityType, t)}</span>
          <h3>{identityDisplayName(card.identityType, t)}</h3>
          <p>{identityDescription(card.identityType, t)}</p>
        </div>
        <span className="semantic-badge info">{t('account.membership.identityCard.separateIdentityBadge')}</span>
      </div>
      <div className="membership-namespace-grid" aria-label={t('account.membership.identityCard.namespaceAria')}>
        <div>
          <span>{t('account.membership.identityCard.personalNamespace')}</span>
          <strong>{HANDLE_NAMESPACE_METADATA.personal.examplePath}</strong>
        </div>
        <div>
          <span>{t('account.membership.identityCard.organizationNamespace')}</span>
          <strong>{namespace.examplePath}</strong>
        </div>
      </div>
      <FeatureList features={card.featureInclusions} t={t} />
      <p className="membership-card__boundary">
        {t('account.membership.identityCard.boundary', {
          personalExample: HANDLE_NAMESPACE_METADATA.personal.examplePath,
          organizationExample: namespace.examplePath,
        })}
      </p>
      {namespace.currentLegacyExamplePath ? (
        <p className="membership-card__legacy-note">
          {t('account.membership.identityCard.legacyRouteNote', { path: namespace.currentLegacyExamplePath })}
        </p>
      ) : null}
      <CardAction action={action} />
    </article>
  );
}

export function MembershipClient() {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [plusSnapshot, setPlusSnapshot] = useState<PlusSubscriptionSnapshotResponse | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadMembershipStatus() {
      if (!auth.hydrated || !auth.isAuthenticated) {
        if (mounted) {
          setPlusSnapshot(null);
          setLoadError(false);
        }
        return;
      }
      try {
        const response = await api.plus.me();
        if (mounted) {
          setPlusSnapshot(response);
          setLoadError(false);
        }
      } catch {
        if (mounted) {
          setPlusSnapshot(null);
          setLoadError(true);
        }
      }
    }
    void loadMembershipStatus();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated]);

  const statusLoaded = Boolean(plusSnapshot);
  const currentTier = normalizePersonalMembershipTier(plusSnapshot?.state?.subscriptionTier);
  const currentStatus = normalizeSubscriptionStatus(plusSnapshot?.state?.subscriptionStatus);

  const actions = useMemo<Record<PersonalMembershipTier, MembershipCardAction>>(() => {
    const loginHref = `/auth?next=${encodeURIComponent(membershipRoute)}`;
    if (!auth.isAuthenticated) {
      return {
        free: { label: t('account.membership.actions.loginOrRegister'), href: loginHref },
        plus: { label: t('account.membership.actions.loginToViewAccess'), href: loginHref },
        pro: { label: t('account.membership.actions.loginToViewAccess'), href: loginHref },
      };
    }

    if (!statusLoaded && !loadError) {
      return {
        free: { label: t('account.membership.actions.loadingStatus'), disabled: true },
        plus: { label: t('account.membership.actions.loadingStatus'), disabled: true },
        pro: { label: t('account.membership.actions.loadingStatus'), disabled: true },
      };
    }

    return {
      free: { label: statusLoaded && currentTier === 'free' ? t('account.membership.actions.currentMembership') : t('account.membership.actions.includedByDefault'), disabled: true },
      plus: { label: statusLoaded && currentTier === 'plus' ? t('account.membership.actions.currentMembership') : t('account.membership.actions.checkoutNotConnected'), disabled: true },
      pro: { label: statusLoaded && currentTier === 'pro' ? t('account.membership.actions.currentMembership') : t('account.membership.actions.checkoutNotConnected'), disabled: true },
    };
  }, [auth.isAuthenticated, currentTier, loadError, statusLoaded, t]);

  return (
    <div className="membership-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">{t('account.membership.eyebrow')}</p>
          <h2>{t('account.membership.title')}</h2>
          <p>{t('account.membership.intro')}</p>
        </div>
        <div className="page-intro__action">
          <Link href="/account" className="button secondary">{t('account.membership.backToAccount')}</Link>
        </div>
      </div>

      <section className="membership-hero-card">
        <div className="membership-hero-card__icon" aria-hidden="true">★</div>
        <div>
          <span className="semantic-badge instruction">{t('account.membership.hero.badge')}</span>
          <h3>{t('account.membership.hero.title')}</h3>
          <p>{t('account.membership.hero.body')}</p>
        </div>
      </section>

      {auth.hydrated && !auth.isAuthenticated ? (
        <section className="mobile-card mobile-card--soft membership-status-card">
          <span className="semantic-badge instruction">{t('account.membership.signedOut.badge')}</span>
          <h3>{t('account.membership.signedOut.title')}</h3>
          <p>{t('account.membership.signedOut.body')}</p>
          <Link className="button primary" href={`/auth?next=${encodeURIComponent(membershipRoute)}`}>{t('common.actions.loginOrRegister')}</Link>
        </section>
      ) : null}

      {auth.isAuthenticated ? (
        <MembershipStatusOverview
          currentStatus={currentStatus}
          currentTier={currentTier}
          language={language}
          loadError={loadError}
          snapshot={plusSnapshot}
          t={t}
        />
      ) : null}

      <BusinessBoundaryPanel t={t} />

      <section className="membership-section membership-section--personal">
        <div className="membership-section__header">
          <span className="semantic-badge neutral">{t('account.membership.sections.personalBadge')}</span>
          <div>
            <h3>{t('account.membership.sections.personalTitle')}</h3>
            <p>{t('account.membership.sections.personalBody')}</p>
          </div>
        </div>
        <div className="membership-grid membership-grid--personal">
          {personalCards.map((card) => (
            <PersonalTierCard
              key={card.tier}
              action={actions[card.tier]}
              card={card}
              currentStatus={currentStatus}
              currentTier={currentTier}
              statusLoaded={statusLoaded}
              t={t}
            />
          ))}
        </div>
      </section>

      <section className="membership-section membership-section--identity">
        <div className="membership-section__header">
          <span className="semantic-badge business">{t('account.membership.sections.identityBadge')}</span>
          <div>
            <h3>{t('account.membership.sections.identityTitle')}</h3>
            <p>{t('account.membership.sections.identityBody')}</p>
          </div>
        </div>
        <BusinessIdentityCard card={ACCOUNT_IDENTITY_METADATA.business_organization} t={t} />
      </section>

      <MembershipAvailabilityPanel t={t} />

      <section className="notice-box info membership-next-note">
        <strong>{t('account.membership.nextNote.label')}</strong> {t('account.membership.nextNote.body')}
      </section>
    </div>
  );
}
