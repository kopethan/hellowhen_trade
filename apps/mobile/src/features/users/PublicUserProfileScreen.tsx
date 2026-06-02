import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PublicProfileResponse, PublicProfileTradeSummary, PublicVerificationBadge } from '@hellowhen/contracts';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { ReportContentPanel } from '../../components/ReportContentPanel';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { UserAvatar, getUserDisplayName, resolveNativeAssetUrl } from './UserAvatar';
import { isPublicUserId } from './UserIdentityPressable';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

type PostKind = 'trade' | 'need' | 'offer';
type TFunction = ReturnType<typeof useTranslation>['t'];

function displayNameForProfile(profile: PublicProfileResponse['user']['profile']) {
  return getUserDisplayName(profile?.displayName, profile?.handle, '');
}

function formatHandle(handle?: string | null) {
  const normalized = handle?.trim().replace(/^@+/, '') ?? '';
  return normalized ? `@${normalized}` : null;
}


function verificationBadgeTone(tone?: PublicVerificationBadge['tone']) {
  if (tone === 'success' || tone === 'trusted') return 'success';
  if (tone === 'professional') return 'proposal';
  if (tone === 'business') return 'trade';
  if (tone === 'enterprise') return 'admin';
  return 'muted';
}

function VerificationBadgeRow({ badges }: { badges?: PublicVerificationBadge[] | null }) {
  const safeBadges = badges?.filter((badge) => badge?.kind && badge.label) ?? [];
  if (!safeBadges.length) return null;
  return (
    <View style={styles.badgeRow}>
      {safeBadges.map((badge) => <SemanticBadge key={badge.kind} label={badge.label} tone={verificationBadgeTone(badge.tone)} size="sm" />)}
    </View>
  );
}

function formatDate(value?: string | null, language = 'en') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language, { month: 'short', year: 'numeric' }).format(date);
}

function postKindLabel(kind: PostKind, t: TFunction) {
  if (kind === 'need') return t('trade.labels.openNeed');
  if (kind === 'offer') return t('trade.labels.openOffer');
  return t('trade.labels.trade');
}

function postImageUrl(post: PublicProfileTradeSummary) {
  const media = [...(post.need?.media ?? []), ...(post.offer?.media ?? []), ...(post.media ?? [])];
  const active = media.find((item) => item.status === 'active');
  return resolveNativeAssetUrl(active?.url);
}

function postTitle(post: PublicProfileTradeSummary, kind: PostKind, t: TFunction) {
  const title = kind === 'need' ? post.need?.title || post.title : kind === 'offer' ? post.offer?.title || post.title : post.title;
  return title?.trim() || postKindLabel(kind, t);
}

function postDescription(post: PublicProfileTradeSummary, kind: PostKind) {
  if (kind === 'need') return post.need?.description || post.description;
  if (kind === 'offer') return post.offer?.description || post.description;
  return post.description || post.need?.description || post.offer?.description || '';
}

function postMeta(post: PublicProfileTradeSummary, kind: PostKind) {
  if (kind === 'need') return [post.need?.category, post.need?.timing, post.need?.locationLabel].filter(Boolean).join(' · ');
  if (kind === 'offer') return [post.offer?.category, post.offer?.availability, post.offer?.locationLabel].filter(Boolean).join(' · ');
  return [post.need?.category, post.offer?.category].filter(Boolean).join(' · ');
}

function sectionTitle(kind: PostKind, t: TFunction) {
  if (kind === 'need') return t('profile.posts.openNeedsTitle');
  if (kind === 'offer') return t('profile.posts.openOffersTitle');
  return t('profile.posts.activeTradesTitle');
}

function sectionEmptyText(kind: PostKind, t: TFunction) {
  if (kind === 'need') return t('profile.posts.emptyNeeds');
  if (kind === 'offer') return t('profile.posts.emptyOffers');
  return t('profile.posts.emptyTrades');
}

function StatTile({ label, value }: { label: string; value: number }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.statTile, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={[styles.statLabel, { color: theme.color.muted }]}>{label}</AppText>
    </View>
  );
}

function PostCard({ post, kind, onOpen }: { post: PublicProfileTradeSummary; kind: PostKind; onOpen: () => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = postImageUrl(post);
  const hasImage = Boolean(imageUrl) && !imageFailed;
  const title = postTitle(post, kind, t);
  const description = postDescription(post, kind);
  const meta = postMeta(post, kind);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('trade.actions.open', { type: postKindLabel(kind, t), title })}
      onPress={onOpen}
      style={({ pressed }) => [styles.postCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}
    >
      {hasImage ? (
        <Image source={{ uri: imageUrl }} style={styles.postImage} onError={() => setImageFailed(true)} />
      ) : (
        <View style={[styles.postImageFallback, { backgroundColor: theme.semantic[kind].softBg, borderColor: theme.semantic[kind].border }]}>
          <MobileIcon name={kind === 'need' ? 'need' : kind === 'offer' ? 'offer' : 'trade'} color={theme.semantic[kind].text} size={26} />
        </View>
      )}
      <View style={styles.postBody}>
        <View style={styles.postBadgeRow}>
          <SemanticBadge label={postKindLabel(kind, t)} tone={kind} size="sm" />
          <StatusBadge status={post.status} size="sm" />
        </View>
        <AppText style={styles.postTitle} numberOfLines={2}>{title}</AppText>
        {description ? <AppText style={[styles.postDescription, { color: theme.color.muted }]} numberOfLines={3}>{description}</AppText> : null}
        {meta ? <AppText style={[styles.postMeta, { color: theme.color.muted }]} numberOfLines={1}>{meta}</AppText> : null}
      </View>
    </Pressable>
  );
}

function PublicPostSection({ kind, posts, onOpenPost }: { kind: PostKind; posts: PublicProfileTradeSummary[]; onOpenPost: (post: PublicProfileTradeSummary) => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText style={styles.sectionTitle}>{sectionTitle(kind, t)}</AppText>
        <AppText style={[styles.sectionCount, { color: theme.color.muted }]}>{posts.length}</AppText>
      </View>
      {posts.length === 0 ? (
        <View style={[styles.emptySection, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{sectionEmptyText(kind, t)}</AppText>
        </View>
      ) : (
        <View style={styles.postStack}>
          {posts.map((post) => <PostCard key={post.id} post={post} kind={kind} onOpen={() => onOpenPost(post)} />)}
        </View>
      )}
    </View>
  );
}

export function PublicUserProfileScreen({ navigation, route }: Props) {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t, language } = useTranslation();
  const { userId, displayName } = route.params;
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!isPublicUserId(userId)) {
      setProfile(null);
      setError(t('profile.errors.linkUnavailable'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.users.publicProfile(userId.trim());
      setProfile(result);
    } catch (caughtError) {
      setProfile(null);
      setError(getFriendlyApiErrorMessage(caughtError, t('profile.errors.couldNotLoad')));
    } finally {
      setLoading(false);
    }
  }, [t, userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const name = useMemo(() => displayNameForProfile(profile?.user.profile) || displayName || t('profile.hellowhenMember'), [displayName, profile?.user.profile, t]);
  const handleLabel = formatHandle(profile?.user.profile?.handle);
  const memberSince = formatDate(profile?.user.memberSince, language);
  const isBlockedByMe = Boolean(profile?.viewerState?.isBlockedByMe);
  const activeTrades = profile?.sections.activeTrades ?? [];
  const openNeeds = profile?.sections.openNeeds ?? [];
  const openOffers = profile?.sections.openOffers ?? [];

  const openPost = useCallback((post: PublicProfileTradeSummary) => {
    navigation.navigate('TradeDetail', {
      tradeId: post.id,
      title: post.title,
      description: post.description,
      amountCents: post.amountCents ?? 0,
      currency: post.currency ?? 'eur',
      creditAmount: 0,
      status: post.status,
      expiresAt: post.expiresAt ?? null,
    });
  }, [navigation]);

  async function toggleBlock() {
    if (!profile) return;
    setBlockBusy(true); setNotice(null); setError(null);
    try {
      if (isBlockedByMe) {
        await api.users.unblock(profile.user.id);
        setProfile((current) => current ? { ...current, viewerState: { ...(current.viewerState ?? {}), isBlockedByMe: false } } : current);
        setNotice(t('profile.unblockSuccess'));
      } else {
        await api.users.block(profile.user.id);
        setProfile((current) => current ? { ...current, viewerState: { ...(current.viewerState ?? {}), isBlockedByMe: true }, sections: { ...current.sections, activeTrades: [], openNeeds: [], openOffers: [] } } : current);
        setNotice(t('profile.blockSuccess'));
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('profile.blockError')));
    } finally { setBlockBusy(false); }
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('profile.title')} onBack={() => navigation.goBack()} />}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProfile(); }} tintColor={theme.color.text} />}
      >
        {notice ? <InfoNotice tone="success" title={t('common.states.done')} body={notice} /> : null}

        {error ? (
          <AppCard>
            <View style={styles.errorBox}>
              <MobileIcon name="profile" color={theme.color.text} size={34} />
              <AppText style={styles.errorTitle}>{t('profile.unavailableTitle')}</AppText>
              <AppText style={[styles.errorBody, { color: theme.color.muted }]}>{error}</AppText>
              <View style={styles.errorActions}>
                <Pressable accessibilityRole="button" onPress={() => { void loadProfile(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
                  <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{t('common.actions.tryAgain')}</AppText>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => navigation.navigate('TradeTabs')} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                  <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{t('trade.actions.backToTrades')}</AppText>
                </Pressable>
              </View>
            </View>
          </AppCard>
        ) : null}

        {profile ? (
          <>
            <AppCard style={styles.heroCard}>
              <UserAvatar src={profile.user.profile?.avatarUrl} displayName={name} handle={profile.user.profile?.handle} size="lg" />
              <View style={styles.heroCopy}>
                <AppText style={styles.displayName}>{name}</AppText>
                <VerificationBadgeRow badges={profile.user.badges} />
                {handleLabel ? <AppText style={[styles.handle, { color: theme.color.muted }]}>{handleLabel}</AppText> : null}
                {profile.user.profile?.bio ? <AppText style={[styles.bio, { color: theme.color.text }]}>{profile.user.profile.bio}</AppText> : null}
                <View style={styles.metaRow}>
                  {profile.user.profile?.countryCode ? <SemanticBadge label={profile.user.profile.countryCode} tone="muted" size="sm" /> : null}
                  {memberSince ? <SemanticBadge label={t('profile.memberSince', { date: memberSince })} tone="info" size="sm" /> : null}
                </View>
                <ReportContentPanel targetType="profile" targetId={profile.user.id} labelKey="report.profile" helperKey="report.helper.profile" />
                {auth.isAuthenticated && auth.user?.id !== profile.user.id ? (
                  <Pressable accessibilityRole="button" disabled={blockBusy} onPress={() => { void toggleBlock(); }} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, blockBusy && styles.disabled, pressed && styles.pressed]}>
                    <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{isBlockedByMe ? t('common.actions.unblockUser') : t('common.actions.blockUser')}</AppText>
                  </Pressable>
                ) : null}
                {isBlockedByMe ? <InfoNotice tone="warning" title={t('common.actions.blockUser')} body={t('profile.blockedByMeNotice')} /> : null}
              </View>
            </AppCard>

            <View style={styles.statsGrid}>
              <StatTile label={t('profile.stats.completed')} value={profile.stats.completedTradesCount} />
              <StatTile label={t('profile.stats.activeTrades')} value={profile.stats.activeTradesCount} />
              <StatTile label={t('profile.stats.openNeeds')} value={profile.stats.openNeedsCount} />
              <StatTile label={t('profile.stats.openOffers')} value={profile.stats.openOffersCount} />
            </View>

            <PublicPostSection kind="trade" posts={activeTrades} onOpenPost={openPost} />
            <PublicPostSection kind="need" posts={openNeeds} onOpenPost={openPost} />
            <PublicPostSection kind="offer" posts={openOffers} onOpenPost={openPost} />
          </>
        ) : !error ? (
          <InfoNotice tone="info" title={t('profile.loading.nativeTitle')} body={t('profile.loading.nativeBody')} />
        ) : null}
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, gap: 16 },
  heroCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  heroCopy: { flex: 1, minWidth: 0, gap: 7 },
  displayName: { fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5 },
  handle: { fontSize: 14, fontWeight: '800' },
  bio: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: { width: '48%', flexGrow: 1, minHeight: 88, borderWidth: 1, borderRadius: 22, padding: 14, justifyContent: 'center' },
  statValue: { fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.4 },
  statLabel: { marginTop: 2, fontSize: 12, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.45 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', letterSpacing: -0.25 },
  sectionCount: { fontSize: 13, fontWeight: '900' },
  emptySection: { minHeight: 78, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 14 },
  emptyText: { textAlign: 'center', fontWeight: '800', lineHeight: 20 },
  postStack: { gap: 10 },
  postCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  postImage: { width: '100%', height: 156, backgroundColor: '#E2E8F0' },
  postImageFallback: { height: 108, borderBottomWidth: 1, alignItems: 'center', justifyContent: 'center' },
  postBody: { padding: 14, gap: 8 },
  postBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  postTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.2 },
  postDescription: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  postMeta: { fontSize: 12, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.35 },
  errorBox: { alignItems: 'center', gap: 11, paddingVertical: 16 },
  errorTitle: { fontSize: 23, lineHeight: 28, fontWeight: '900', textAlign: 'center' },
  errorBody: { textAlign: 'center', fontWeight: '700', lineHeight: 20 },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 4 },
  primaryButton: { minHeight: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { fontWeight: '900' },
  secondaryButton: { minHeight: 46, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
