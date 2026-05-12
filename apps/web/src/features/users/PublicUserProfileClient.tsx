'use client';

import type { PublicProfileResponse, PublicProfileTradeSummary } from '@hellowhen/contracts';
import { truncateText } from '@hellowhen/shared';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { api, resolveWebAssetUrl } from '../../lib/api';
import { UserAvatar } from './UserAvatar';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { formatWebDate, formatWebShortDate, formatWebMoney } from '../../lib/webFormat';

function profileName(profile: PublicProfileResponse['user']['profile']) {
  return profile?.displayName?.trim() || profile?.handle?.trim() || 'Hellowhen member';
}


function countryLabel(countryCode?: string | null) {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function compactJoin(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

function postTypeLabel(post: PublicProfileTradeSummary) {
  if (post.postType === 'open_need') return 'Open Need';
  if (post.postType === 'open_offer') return 'Open Offer';
  return 'Trade';
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

function postMeta(post: PublicProfileTradeSummary) {
  const needMeta = post.need ? compactJoin([post.need.category, post.need.timing, post.need.mode, post.need.locationLabel]) : '';
  const offerMeta = post.offer ? compactJoin([post.offer.category, post.offer.availability, post.offer.mode, post.offer.locationLabel]) : '';
  const mode = post.need?.mode ?? post.offer?.mode ?? null;
  const details = post.postType === 'open_need'
    ? needMeta
    : post.postType === 'open_offer'
      ? offerMeta
      : compactJoin([mode, post.status]);
  return details || `Posted ${formatWebShortDate(post.createdAt)}`;
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
  const amountCents = post.amountCents ?? 0;
  const hasMoney = amountCents > 0;

  return (
    <Link href={`/trades/${post.id}`} className="public-profile-post-card" aria-label={`Open ${postTitle(post)}`}>
      <PublicProfilePostImage post={post} />
      <div className="public-profile-post-card__body">
        <div className="status-row">
          <span className={`semantic-badge ${postBadgeClass(post)}`}>{postTypeLabel(post)}</span>
          <span className="meta">{post.status}</span>
        </div>
        <h3>{postTitle(post)}</h3>
        <p>{truncateText(postDescription(post), 120)}</p>
        <div className="public-profile-post-card__meta">
          <span>{postMeta(post)}</span>
          <strong>{hasMoney ? formatWebMoney(amountCents, post.currency) : 'Service-for-service'}</strong>
        </div>
      </div>
    </Link>
  );
}

function PublicProfileSection({ title, body, posts }: { title: string; body: string; posts: PublicProfileTradeSummary[] }) {
  return (
    <section className="public-profile-section">
      <div className="trade-section-heading">
        <div>
          <p className="eyebrow">Public posts</p>
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
          <strong>Nothing public here yet</strong>
          <span>Public active posts from this member will appear here.</span>
        </div>
      )}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <article className="public-profile-page">
      <section className="public-profile-hero public-profile-hero--loading">
        <UserAvatar displayName="Hellowhen member" size="lg" decorative />
        <div>
          <span className="semantic-badge instruction">Loading</span>
          <h2>Loading profile...</h2>
          <p>Fetching public marketplace information.</p>
        </div>
      </section>
    </article>
  );
}

export function PublicUserProfileClient({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.users.publicProfile(userId);
      setProfile(response);
    } catch (cause) {
      setProfile(null);
      setError(getFriendlyApiErrorMessage(cause, 'This public profile could not be loaded yet.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    async function loadMountedProfile() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.users.publicProfile(userId);
        if (!mounted) return;
        setProfile(response);
      } catch (cause) {
        if (!mounted) return;
        setProfile(null);
        setError(getFriendlyApiErrorMessage(cause, 'This public profile could not be loaded yet.'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadMountedProfile();
    return () => { mounted = false; };
  }, [userId]);

  const displayName = profileName(profile?.user.profile);
  const location = countryLabel(profile?.user.profile?.countryCode);
  const memberSince = profile?.user.memberSince ? formatWebDate(profile.user.memberSince) : 'Unknown';
  const handle = profile?.user.profile?.handle?.trim();
  const stats = useMemo(() => profile ? [
    { label: 'Completed', value: profile.stats.completedTradesCount },
    { label: 'Active trades', value: profile.stats.activeTradesCount },
    { label: 'Open needs', value: profile.stats.openNeedsCount },
    { label: 'Open offers', value: profile.stats.openOffersCount },
  ] : [], [profile]);

  if (loading && !profile) return <ProfileSkeleton />;

  if (!profile) {
    return (
      <article className="public-profile-page">
        <section className="public-profile-hero">
          <UserAvatar displayName="Unknown member" size="lg" decorative />
          <div>
            <span className="semantic-badge danger">Not available</span>
            <h2>Profile unavailable</h2>
            <p>{error ?? 'This public profile could not be loaded.'}</p>
          </div>
        </section>
        <div className="public-profile-error-actions">
          <button type="button" className="button primary" onClick={() => void loadProfile()} disabled={loading}>
            {loading ? 'Retrying...' : 'Try again'}
          </button>
          <Link href="/trades" className="button secondary">Back to trades</Link>
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
          <span className="semantic-badge trade">Public profile</span>
          <h2>{displayName}</h2>
          <div className="public-profile-meta-row">
            {handle ? <span>@{handle}</span> : null}
            <span>Member since {memberSince}</span>
            {location ? <span>{location}</span> : null}
          </div>
          {profile.user.profile?.bio ? <p>{profile.user.profile.bio}</p> : <p className="meta">This member has not added a public bio yet.</p>}
        </div>
      </section>

      <section className="public-profile-stats" aria-label="Public marketplace stats">
        {stats.map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <PublicProfileSection
        title="Active trades"
        body="Public Need + Offer exchanges this member currently has open."
        posts={profile.sections.activeTrades}
      />
      <PublicProfileSection
        title="Open needs"
        body="Public needs waiting for other members to propose offers."
        posts={profile.sections.openNeeds}
      />
      <PublicProfileSection
        title="Open offers"
        body="Public offers waiting for other members to propose needs."
        posts={profile.sections.openOffers}
      />
    </article>
  );
}
