'use client';

import type { PublicProfileResponse, PublicProfileTradeSummary } from '@hellowhen/contracts';
import { truncateText } from '@hellowhen/shared';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { AddToAgendaButton } from '../../components/AddToAgendaButton';
import { ReportContentButton } from '../../components/ReportContentButton';
import { SavedToggleButton } from '../../components/SavedToggleButton';
import { api, resolveWebAssetUrl } from '../../lib/api';
import { UserAvatar } from './UserAvatar';
import { VerificationBadgeList } from './VerificationBadgeList';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { formatWebDate, formatWebShortDate, formatWebMoney } from '../../lib/webFormat';
import { getModeLabel, getNeedTimingBadge, getOfferTimingBadge, getStatusLabel } from '../trade/tradePresentation';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { useWebAuth } from '../../providers/WebAuthProvider';

type TFunction = ReturnType<typeof useWebTranslation>['t'];

function profileName(profile: PublicProfileResponse['user']['profile'], t: TFunction) {
  return profile?.displayName?.trim() || profile?.handle?.trim() || t('profile.hellowhenMember');
}

function countryLabel(countryCode?: string | null, language = 'en') {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return null;
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function compactJoin(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

function presenceTrustCounts(stats?: PublicProfileResponse['stats'] | null) {
  return {
    places: stats?.verifiedOfflinePlacesCount ?? 0,
    plans: stats?.verifiedOfflinePlansCount ?? 0,
    checkIns: stats?.verifiedOfflineCheckInsCount ?? 0,
  };
}

function presenceTrustSummary(stats: PublicProfileResponse['stats'], t: TFunction) {
  const counts = presenceTrustCounts(stats);
  if (!counts.places && !counts.plans && !counts.checkIns) return t('profile.trust.summaryNone');
  return t('profile.trust.summary', { places: counts.places, plans: counts.plans, checkIns: counts.checkIns });
}

function postTypeLabel(post: PublicProfileTradeSummary, t: TFunction) {
  if (post.postType === 'open_need') return t('trade.labels.openNeed');
  if (post.postType === 'open_offer') return t('trade.labels.openOffer');
  return t('trade.labels.trade');
}

function postBadgeClass(post: PublicProfileTradeSummary) {
  if (post.postType === 'open_need') return 'need';
  if (post.postType === 'open_offer') return 'offer';
  return 'trade';
}

function postTitle(post: PublicProfileTradeSummary) {
  if (post.postType === 'open_need') return post.need?.title ?? post.title;
  if (post.postType === 'open_offer') return post.offer?.title ?? post.title;
  const needTitle = post.need?.title;
  const offerTitle = post.offer?.title;
  if (needTitle && offerTitle) return `${needTitle} ↔ ${offerTitle}`;
  return post.title;
}

function postDescription(post: PublicProfileTradeSummary) {
  if (post.postType === 'open_need') return post.need?.description ?? post.description;
  if (post.postType === 'open_offer') return post.offer?.description ?? post.description;
  return post.description;
}

function postMeta(post: PublicProfileTradeSummary, language: 'en' | 'fr' | 'es', t: TFunction) {
  const i18n = { t, language };
  const needMeta = post.need ? compactJoin([post.need.category, getNeedTimingBadge(post.need, i18n), getModeLabel(post.need.mode, i18n), post.need.locationLabel]) : '';
  const offerMeta = post.offer ? compactJoin([post.offer.category, getOfferTimingBadge(post.offer, i18n), getModeLabel(post.offer.mode, i18n), post.offer.locationLabel]) : '';
  const mode = post.need?.mode ?? post.offer?.mode ?? null;
  const details = post.postType === 'open_need'
    ? needMeta
    : post.postType === 'open_offer'
      ? offerMeta
      : compactJoin([getModeLabel(mode, i18n), getStatusLabel(post.status, i18n)]);
  return details || t('profile.posts.postedDate', { date: formatWebShortDate(post.createdAt, t('trade.expiry.noDateSet'), language) });
}

function postImage(post: PublicProfileTradeSummary) {
  const needImage = post.need?.media?.find((item) => item.status === 'active' && (item.url || item.storageKey));
  const offerImage = post.offer?.media?.find((item) => item.status === 'active' && (item.url || item.storageKey));
  const tradeImage = post.media?.find((item) => item.status === 'active' && (item.url || item.storageKey));
  return needImage ?? offerImage ?? tradeImage ?? null;
}

function PublicProfilePostImage({ post }: { post: PublicProfileTradeSummary }) {
  const image = postImage(post);
  const imageSrc = image ? resolveWebAssetUrl(image.url, image.storageKey) : '';
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  if (imageSrc && !imageFailed) {
    return <img className="public-profile-post-card__image" src={imageSrc} alt="" loading="lazy" onError={() => setImageFailed(true)} />;
  }

  return (
    <div className="public-profile-post-card__image public-profile-post-card__image--fallback" aria-hidden="true">
      <WebIcon name={post.postType === 'open_need' ? 'need' : post.postType === 'open_offer' ? 'offer' : 'trade'} size={28} decorative />
    </div>
  );
}

function PostCard({ post }: { post: PublicProfileTradeSummary }) {
  const { t, language } = useWebTranslation();
  const amountCents = post.amountCents ?? 0;
  const hasMoney = amountCents > 0;
  const title = postTitle(post);
  const typeLabel = postTypeLabel(post, t);

  return (
    <Link href={`/trades/${post.id}`} className="public-profile-post-card" aria-label={t('trade.actions.open', { type: typeLabel, title })}>
      <PublicProfilePostImage post={post} />
      <div className="public-profile-post-card__body">
        <div className="status-row">
          <span className={`semantic-badge ${postBadgeClass(post)}`}>{typeLabel}</span>
          <span className="meta">{getStatusLabel(post.status, { t, language })}</span>
        </div>
        <h3>{title}</h3>
        <p>{truncateText(postDescription(post), 120)}</p>
        <div className="public-profile-post-card__meta">
          <span>{postMeta(post, language, t)}</span>
          <strong>{hasMoney ? formatWebMoney(amountCents, post.currency, language) : t('trade.labels.serviceForService')}</strong>
        </div>
      </div>
    </Link>
  );
}

function PublicProfileSection({ title, body, posts }: { title: string; body: string; posts: PublicProfileTradeSummary[] }) {
  const { t } = useWebTranslation();
  return (
    <section className="public-profile-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">{t('profile.posts.eyebrow')}</p>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <span className="semantic-badge instruction">{posts.length}</span>
      </div>
      {posts.length ? (
        <div className="public-profile-post-list">
          {posts.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      ) : (
        <div className="public-profile-empty-state">
          <strong>{t('profile.posts.emptyTitle')}</strong>
          <span>{t('profile.posts.emptyBody')}</span>
        </div>
      )}
    </section>
  );
}

function ProfileSkeleton() {
  const { t } = useWebTranslation();
  return (
    <article className="public-profile-page">
      <section className="public-profile-hero public-profile-hero--loading">
        <UserAvatar displayName={t('profile.hellowhenMember')} size="lg" decorative />
        <div>
          <span className="semantic-badge instruction">{t('profile.loading.badge')}</span>
          <h2>{t('profile.loading.title')}</h2>
          <p>{t('profile.loading.body')}</p>
        </div>
      </section>
    </article>
  );
}

export function PublicUserProfileClient({ userId, username }: { userId?: string; username?: string }) {
  const { t, language } = useWebTranslation();
  const auth = useWebAuth();
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockBusy, setBlockBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = username ? await api.users.publicProfileByUsername(username) : await api.users.publicProfile(userId ?? '');
      setProfile(response);
    } catch (cause) {
      setProfile(null);
      setError(getFriendlyApiErrorMessage(cause, t('common.messages.profileUnavailable')));
    } finally {
      setLoading(false);
    }
  }, [t, userId, username]);

  useEffect(() => {
    let mounted = true;
    async function loadMountedProfile() {
      setLoading(true);
      setError(null);
      try {
        const response = username ? await api.users.publicProfileByUsername(username) : await api.users.publicProfile(userId ?? '');
        if (!mounted) return;
        setProfile(response);
      } catch (cause) {
        if (!mounted) return;
        setProfile(null);
        setError(getFriendlyApiErrorMessage(cause, t('common.messages.profileUnavailable')));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadMountedProfile();
    return () => { mounted = false; };
  }, [t, userId, username]);

  const displayName = profileName(profile?.user.profile, t);
  const location = countryLabel(profile?.user.profile?.countryCode, language);
  const memberSince = profile?.user.memberSince ? formatWebDate(profile.user.memberSince, t('common.states.unknown'), language) : t('common.states.unknown');
  const lastPresenceConfirmed = profile?.stats.lastOfflinePresenceConfirmedAt ? formatWebDate(profile.stats.lastOfflinePresenceConfirmedAt, t('common.states.unknown'), language) : null;
  const handle = profile?.user.profile?.handle?.trim();
  const presenceCounts = presenceTrustCounts(profile?.stats);
  const hasPresenceTrust = presenceCounts.places > 0 || presenceCounts.plans > 0 || presenceCounts.checkIns > 0;
  const presenceSummary = profile ? presenceTrustSummary(profile.stats, t) : '';
  const isBlockedByMe = Boolean(profile?.viewerState?.isBlockedByMe);

  async function toggleBlock() {
    if (!profile) return;
    setBlockBusy(true);
    setNotice(null);
    setError(null);
    try {
      if (isBlockedByMe) {
        await api.users.unblock(profile.user.id);
        setProfile((current) => current ? { ...current, viewerState: { ...(current.viewerState ?? {}), isBlockedByMe: false }, sections: current.sections } : current);
        setNotice(t('profile.unblockSuccess'));
      } else {
        await api.users.block(profile.user.id);
        setProfile((current) => current ? { ...current, viewerState: { ...(current.viewerState ?? {}), isBlockedByMe: true }, sections: { ...current.sections, activeTrades: [], openNeeds: [], openOffers: [] } } : current);
        setNotice(t('profile.blockSuccess'));
      }
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('profile.blockError')));
    } finally {
      setBlockBusy(false);
    }
  }

  const stats = useMemo(() => profile ? [
    { label: t('profile.stats.completed'), value: profile.stats.completedTradesCount },
    { label: t('profile.stats.activeTrades'), value: profile.stats.activeTradesCount },
    { label: t('profile.stats.openNeeds'), value: profile.stats.openNeedsCount },
    { label: t('profile.stats.openOffers'), value: profile.stats.openOffersCount },
  ] : [], [profile, t]);

  if (loading && !profile) return <ProfileSkeleton />;

  if (!profile) {
    return (
      <article className="public-profile-page">
        <section className="public-profile-hero">
          <UserAvatar displayName={t('profile.unknownMember')} size="lg" decorative />
          <div>
            <span className="semantic-badge danger">{t('profile.unavailableBadge')}</span>
            <h2>{t('profile.unavailableTitle')}</h2>
            <p>{error ?? t('common.messages.profileUnavailable')}</p>
          </div>
        </section>
        <div className="public-profile-error-actions">
          <button type="button" className="button primary" onClick={() => void loadProfile()} disabled={loading}>
            {loading ? t('common.actions.retrying') : t('common.actions.tryAgain')}
          </button>
          <Link href="/trades" className="button secondary">{t('trade.actions.backToTrades')}</Link>
        </div>
      </article>
    );
  }

  return (
    <article className="public-profile-page">
      <section className="public-profile-hero">
        <UserAvatar
          src={profile.user.profile?.avatarUrl}
          displayName={profile.user.profile?.displayName}
          handle={profile.user.profile?.handle}
          size="lg"
          decorative
        />
        <div className="public-profile-hero__body">
          <span className="semantic-badge trade">{t('profile.publicBadge')}</span>
          <h2>{displayName}</h2>
          <VerificationBadgeList badges={profile.user.badges} />
          {hasPresenceTrust ? (
            <div className="public-profile-presence-counter" aria-label={t('profile.trust.heroCounter', { count: presenceCounts.places })}>
              <WebIcon name="verified" size={14} decorative />
              <strong>{presenceCounts.places}</strong>
              <span>{t('profile.trust.heroCounter', { count: presenceCounts.places })}</span>
            </div>
          ) : null}
          <div className="public-profile-meta-row">
            {handle ? <span>@{handle}</span> : null}
            <span>{t('profile.memberSince', { date: memberSince })}</span>
            {location ? <span>{location}</span> : null}
          </div>
          {profile.user.profile?.bio ? <p>{profile.user.profile.bio}</p> : <p className="meta">{t('profile.noBio')}</p>}
          <div className="cta-row">
            <SavedToggleButton itemType="user" itemId={profile.user.id} hidden={auth.user?.id === profile.user.id} />
            <AddToAgendaButton sourceType="user" sourceId={profile.user.id} itemType="person" title={displayName} note={profile.user.profile?.bio} hidden={auth.user?.id === profile.user.id} />
            <ReportContentButton targetType="profile" targetId={profile.user.id} labelKey="report.profile" helperKey="report.helper.profile" buttonClassName="button secondary danger-text" />
            {auth.isAuthenticated && auth.user?.id !== profile.user.id ? (
              <button type="button" className="button secondary" disabled={blockBusy} onClick={() => void toggleBlock()}>{isBlockedByMe ? t('common.actions.unblockUser') : t('common.actions.blockUser')}</button>
            ) : null}
          </div>
          {isBlockedByMe ? <p className="notice-box warning">{t('profile.blockedByMeNotice')}</p> : null}
          {notice ? <p className="notice-box success">{notice}</p> : null}
        </div>
      </section>

      <section className="public-profile-trust-panel" aria-label={t('profile.trust.title')}>
        <div className="public-profile-trust-panel__header">
          <span className="public-profile-trust-panel__icon" aria-hidden="true"><WebIcon name="verified" size={18} decorative /></span>
          <div>
            <h3>{t('profile.trust.title')}</h3>
            <p>{t('profile.trust.body')}</p>
          </div>
        </div>
        <div className={`public-profile-trust-summary${hasPresenceTrust ? '' : ' is-empty'}`}>
          <span>{t('profile.trust.primaryCounterLabel')}</span>
          <strong>{presenceCounts.places}</strong>
          <p>{presenceSummary}</p>
        </div>
        <div className="public-profile-trust-grid">
          <div>
            <strong>{memberSince}</strong>
            <span>{t('profile.trust.memberSinceLabel')}</span>
          </div>
          <div>
            <strong>{profile.stats.verifiedOfflinePlacesCount ?? 0}</strong>
            <span>{t('profile.trust.verifiedPlaces')}</span>
          </div>
          <div>
            <strong>{profile.stats.verifiedOfflinePlansCount ?? 0}</strong>
            <span>{t('profile.trust.verifiedPlans')}</span>
          </div>
          <div>
            <strong>{profile.stats.verifiedOfflineCheckInsCount ?? 0}</strong>
            <span>{t('profile.trust.checkIns')}</span>
          </div>
        </div>
        {lastPresenceConfirmed ? (
          <p className="public-profile-trust-panel__note">{t('profile.trust.lastPresence')}: {lastPresenceConfirmed}</p>
        ) : null}
      </section>

      <section className="public-profile-stats" aria-label={t('profile.statsLabel')}>
        {stats.map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <PublicProfileSection
        title={t('profile.posts.activeTradesTitle')}
        body={t('profile.posts.activeTradesBody')}
        posts={profile.sections.activeTrades}
      />
      <PublicProfileSection
        title={t('profile.posts.openNeedsTitle')}
        body={t('profile.posts.openNeedsBody')}
        posts={profile.sections.openNeeds}
      />
      <PublicProfileSection
        title={t('profile.posts.openOffersTitle')}
        body={t('profile.posts.openOffersBody')}
        posts={profile.sections.openOffers}
      />
    </article>
  );
}
