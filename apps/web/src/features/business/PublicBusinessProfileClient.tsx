'use client';

import type { PublicBusinessInventoryItem, PublicBusinessProfileResponse, PublicProfileTradeSummary } from '@hellowhen/contracts';
import { publicBusinessPath, truncateText } from '@hellowhen/shared';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { api, resolveWebAssetUrl } from '../../lib/api';
import { formatWebDate, formatWebShortDate, formatWebMoney } from '../../lib/webFormat';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { businessStatusLabel, businessTypeLabel } from '../account/accountPresentation';
import { getModeLabel, getStatusLabel } from '../trade/tradePresentation';
import { VerificationBadgeList } from '../users/VerificationBadgeList';

type TFunction = ReturnType<typeof useWebTranslation>['t'];

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

function postImage(post: PublicProfileTradeSummary) {
  const needImage = post.need?.media?.find((item) => item.status === 'active' && (item.url || item.storageKey));
  const offerImage = post.offer?.media?.find((item) => item.status === 'active' && (item.url || item.storageKey));
  const tradeImage = post.media?.find((item) => item.status === 'active' && (item.url || item.storageKey));
  return needImage ?? offerImage ?? tradeImage ?? null;
}

function itemImage(item: PublicBusinessInventoryItem) {
  return item.media?.find((media) => media.status === 'active' && (media.url || media.storageKey)) ?? null;
}

function PublicBusinessCardImage({ image, fallbackIcon }: { image?: { url?: string | null; storageKey?: string | null } | null; fallbackIcon: 'trade' | 'need' | 'offer' }) {
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
      <WebIcon name={fallbackIcon} size={28} decorative />
    </div>
  );
}

function TradePostCard({ post }: { post: PublicProfileTradeSummary }) {
  const { t, language } = useWebTranslation();
  const amountCents = post.amountCents ?? 0;
  const hasMoney = amountCents > 0;
  const typeLabel = postTypeLabel(post, t);
  const mode = post.need?.mode ?? post.offer?.mode ?? null;
  const meta = compactJoin([getModeLabel(mode, { t, language }), getStatusLabel(post.status, { t, language })]) || formatWebShortDate(post.createdAt, t('trade.expiry.noDateSet'), language);

  return (
    <Link href={`/trades/${post.id}`} className="public-profile-post-card" aria-label={t('trade.actions.open', { type: typeLabel, title: postTitle(post) })}>
      <PublicBusinessCardImage image={postImage(post)} fallbackIcon="trade" />
      <div className="public-profile-post-card__body">
        <div className="status-row">
          <span className={`semantic-badge ${postBadgeClass(post)}`}>{typeLabel}</span>
          <span className="meta">{meta}</span>
        </div>
        <h3>{postTitle(post)}</h3>
        <p>{truncateText(postDescription(post), 120)}</p>
        <div className="public-profile-post-card__meta">
          <span>{formatWebShortDate(post.createdAt, t('trade.expiry.noDateSet'), language)}</span>
          <strong>{hasMoney ? formatWebMoney(amountCents, post.currency, language) : t('trade.labels.serviceForService')}</strong>
        </div>
      </div>
    </Link>
  );
}

function InventoryItemCard({ item, kind }: { item: PublicBusinessInventoryItem; kind: 'need' | 'offer' }) {
  const { t, language } = useWebTranslation();
  const mode = getModeLabel(item.mode, { t, language });
  const details = kind === 'need'
    ? compactJoin([item.category, item.timing, mode, item.locationLabel])
    : compactJoin([item.category, item.availability, mode, item.locationLabel]);

  return (
    <article className="public-profile-post-card" aria-label={item.title}>
      <PublicBusinessCardImage image={itemImage(item)} fallbackIcon={kind} />
      <div className="public-profile-post-card__body">
        <div className="status-row">
          <span className={`semantic-badge ${kind}`}>{kind === 'need' ? t('inventory.kind.need') : t('inventory.kind.offer')}</span>
          <span className="meta">{item.status}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{truncateText(item.description, 120)}</p>
        <div className="public-profile-post-card__meta">
          <span>{details || formatWebShortDate(item.createdAt, t('trade.expiry.noDateSet'), language)}</span>
        </div>
      </div>
    </article>
  );
}

function PublicBusinessSection({ title, body, count, children }: { title: string; body: string; count: number; children: ReactNode }) {
  return (
    <section className="public-profile-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">Business profile</p>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <span className="semantic-badge instruction">{count}</span>
      </div>
      {count ? <div className="public-profile-post-list">{children}</div> : (
        <div className="public-profile-empty-state">
          <strong>No public items yet</strong>
          <span>This business has not published items in this section yet.</span>
        </div>
      )}
    </section>
  );
}

function BusinessSkeleton() {
  return (
    <article className="public-profile-page">
      <section className="public-profile-hero public-profile-hero--loading">
        <div className="public-profile-post-card__image public-profile-post-card__image--fallback" aria-hidden="true">
          <WebIcon name="profile" size={32} decorative />
        </div>
        <div>
          <span className="semantic-badge instruction">Loading</span>
          <h2>Loading business profile…</h2>
          <p>Checking the public Business namespace.</p>
        </div>
      </section>
    </article>
  );
}

export function PublicBusinessProfileClient({ businessSlug }: { businessSlug: string }) {
  const { t, language } = useWebTranslation();
  const [profile, setProfile] = useState<PublicBusinessProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.business.publicProfileBySlug(businessSlug);
        if (!mounted) return;
        setProfile(response);
      } catch (cause) {
        if (!mounted) return;
        setProfile(null);
        setError(getFriendlyApiErrorMessage(cause, 'Business profile unavailable.'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadProfile();
    return () => { mounted = false; };
  }, [businessSlug]);

  const business = profile?.businessProfile;
  const slug = business?.slug ?? business?.handle ?? businessSlug;
  const path = publicBusinessPath(slug);
  const location = countryLabel(business?.countryCode, language);
  const createdAt = business?.createdAt ? formatWebDate(business.createdAt, t('common.states.unknown'), language) : t('common.states.unknown');
  const isVerified = business?.status === 'verified' || Boolean(business?.verifiedAt);
  const stats = useMemo(() => profile ? [
    { label: 'Public trades', value: profile.stats.activeTradesCount },
    { label: 'Open needs', value: profile.stats.openNeedsCount },
    { label: 'Open offers', value: profile.stats.openOffersCount },
  ] : [], [profile]);

  if (loading && !profile) return <BusinessSkeleton />;

  if (!profile || !business) {
    return (
      <article className="public-profile-page">
        <section className="public-profile-hero">
          <div className="public-profile-post-card__image public-profile-post-card__image--fallback" aria-hidden="true">
            <WebIcon name="profile" size={32} decorative />
          </div>
          <div>
            <span className="semantic-badge danger">Unavailable</span>
            <h2>Business profile not found</h2>
            <p>{error ?? 'This Business profile is not public or does not exist.'}</p>
            <Link href="/trades" className="button secondary">Back to Trades</Link>
          </div>
        </section>
      </article>
    );
  }

  return (
    <article className="public-profile-page">
      <section className="public-profile-hero">
        <div className="public-profile-post-card__image public-profile-post-card__image--fallback" aria-hidden="true">
          <WebIcon name="profile" size={32} decorative />
        </div>
        <div className="public-profile-hero__body">
          <div className="status-row">
            <span className="semantic-badge trade">Business</span>
            <span className={isVerified ? 'semantic-badge success' : 'semantic-badge neutral'}>{businessStatusLabel(business.status, t)}</span>
            <span className="semantic-badge instruction">{businessTypeLabel(business.type, t)}</span>
          </div>
          <h2>{business.displayName}</h2>
          <VerificationBadgeList badges={business.badges} />
          <div className="public-profile-meta-row">
            {path ? <span>{path}</span> : null}
            <span>Created {createdAt}</span>
            {location ? <span>{location}</span> : null}
          </div>
          {business.description ? <p>{business.description}</p> : <p className="meta">This Business profile has not added a public description yet.</p>}
          {business.websiteUrl ? <a className="button secondary" href={business.websiteUrl} target="_blank" rel="noreferrer">Visit website</a> : null}
        </div>
      </section>

      <section className="public-profile-stats" aria-label="Business profile stats">
        {stats.map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <PublicBusinessSection title="Public trades" body="Trades published under this Business profile." count={profile.sections.activeTrades.length}>
        {profile.sections.activeTrades.map((post) => <TradePostCard key={post.id} post={post} />)}
      </PublicBusinessSection>

      <PublicBusinessSection title="Business needs" body="Needs published by this Business profile." count={profile.sections.openNeeds.length}>
        {profile.sections.openNeeds.map((item) => <InventoryItemCard key={item.id} item={item} kind="need" />)}
      </PublicBusinessSection>

      <PublicBusinessSection title="Business offers" body="Offers published by this Business profile." count={profile.sections.openOffers.length}>
        {profile.sections.openOffers.map((item) => <InventoryItemCard key={item.id} item={item} kind="offer" />)}
      </PublicBusinessSection>
    </article>
  );
}
