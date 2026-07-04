import React, { useCallback, useMemo, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthUser, LedgerEntryDto, WalletDto } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { DetailInfoList, DetailSection } from '../../components/detail';
import { resolveMediaUrl } from '../trade/mediaUrls';

type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null };
type AccountRoute = 'TradeTabs' | 'CreateTrade' | 'MyNeeds' | 'MyOffers' | 'CreateNeed' | 'CreateOffer' | 'AccountProfile' | 'Notifications' | 'SavedLibrary' | 'Agenda' | 'Plans' | 'MyPlans' | 'JoinedPlans' | 'MyPlaces' | 'PlaceLibrary' | 'CreatePlan' | 'CreatePlace' | 'OnboardingGuide' | 'Membership' | 'ProPlans' | 'BusinessAccounts' | 'Wallet' | 'Payouts' | 'Settings' | 'LegalPolicy' | 'SupportCenter' | 'AccountDeletion' | 'BuyCredits';
type AccountGroupKey = 'activity' | 'plans' | 'settings' | 'future';
type MeHubSectionKey = 'activity' | 'plans' | 'tools';

type AccountAction = {
  titleKey: string;
  descriptionKey: string;
  badgeKey: string;
  tone: SemanticColorName;
  route: AccountRoute;
  icon: MobileIconName;
  group: AccountGroupKey;
};

type MeHubWidget = {
  title: string;
  body: string;
  route: AccountRoute;
  icon: MobileIconName;
  tone: SemanticColorName;
  count?: number;
};

type MeHubCounts = {
  trades?: number;
  needs?: number;
  offers?: number;
  myPlans?: number;
  joinedPlans?: number;
  places?: number;
};

function countCollection(response: unknown, key: string) {
  if (!response || typeof response !== 'object') return undefined;
  const value = (response as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : undefined;
}

const accountActions: AccountAction[] = [
  { titleKey: 'account.items.profile.title', descriptionKey: 'account.items.profile.bodyNative', badgeKey: 'account.items.profile.badge', tone: 'info', route: 'AccountProfile', icon: 'profile', group: 'activity' },
  { titleKey: 'account.items.notifications.title', descriptionKey: 'account.items.notifications.bodyNative', badgeKey: 'account.items.notifications.badge', tone: 'proposal', route: 'Notifications', icon: 'bell', group: 'activity' },
  ...(betaFeatures.savedLibraryEnabled ? [{ titleKey: 'account.items.saved.title', descriptionKey: 'account.items.saved.bodyNative', badgeKey: 'account.items.saved.badge', tone: 'proposal' as SemanticColorName, route: 'SavedLibrary' as AccountRoute, icon: 'save' as MobileIconName, group: 'activity' as AccountGroupKey }] : []),
  ...(betaFeatures.agendaEnabled ? [{ titleKey: 'account.items.agenda.title', descriptionKey: 'account.items.agenda.bodyNative', badgeKey: 'account.items.agenda.badge', tone: 'instruction' as SemanticColorName, route: 'Agenda' as AccountRoute, icon: 'bell' as MobileIconName, group: 'activity' as AccountGroupKey }] : []),
  ...(betaFeatures.plansVisible ? [
    { titleKey: 'account.items.plansFeature.title', descriptionKey: 'account.items.plansFeature.bodyNative', badgeKey: 'account.items.plansFeature.badge', tone: 'instruction' as SemanticColorName, route: 'Plans' as AccountRoute, icon: 'plan' as MobileIconName, group: 'plans' as AccountGroupKey },
    { titleKey: 'account.items.myPlansFeature.title', descriptionKey: 'account.items.myPlansFeature.bodyNative', badgeKey: 'account.items.myPlansFeature.badge', tone: 'info' as SemanticColorName, route: 'MyPlans' as AccountRoute, icon: 'activity' as MobileIconName, group: 'plans' as AccountGroupKey },
    { titleKey: 'account.items.joinedPlansFeature.title', descriptionKey: 'account.items.joinedPlansFeature.bodyNative', badgeKey: 'account.items.joinedPlansFeature.badge', tone: 'success' as SemanticColorName, route: 'JoinedPlans' as AccountRoute, icon: 'proposal-accepted' as MobileIconName, group: 'plans' as AccountGroupKey },
    { titleKey: 'account.items.myPlacesFeature.title', descriptionKey: 'account.items.myPlacesFeature.bodyNative', badgeKey: 'account.items.myPlacesFeature.badge', tone: 'proposal' as SemanticColorName, route: 'MyPlaces' as AccountRoute, icon: 'location-on' as MobileIconName, group: 'plans' as AccountGroupKey },
    { titleKey: 'account.items.placeLibraryFeature.title', descriptionKey: 'account.items.placeLibraryFeature.bodyNative', badgeKey: 'account.items.placeLibraryFeature.badge', tone: 'instruction' as SemanticColorName, route: 'PlaceLibrary' as AccountRoute, icon: 'search' as MobileIconName, group: 'plans' as AccountGroupKey },
    { titleKey: 'account.items.createPlanFeature.title', descriptionKey: 'account.items.createPlanFeature.bodyNative', badgeKey: 'account.items.createPlanFeature.badge', tone: 'success' as SemanticColorName, route: 'CreatePlan' as AccountRoute, icon: 'add' as MobileIconName, group: 'plans' as AccountGroupKey },
    { titleKey: 'account.items.createPlaceFeature.title', descriptionKey: 'account.items.createPlaceFeature.bodyNative', badgeKey: 'account.items.createPlaceFeature.badge', tone: 'info' as SemanticColorName, route: 'CreatePlace' as AccountRoute, icon: 'location-on' as MobileIconName, group: 'plans' as AccountGroupKey },
  ] : []),
  { titleKey: 'account.items.guide.title', descriptionKey: 'account.items.guide.bodyNative', badgeKey: 'account.items.guide.badge', tone: 'info', route: 'OnboardingGuide', icon: 'help', group: 'activity' },
  { titleKey: 'account.items.support.title', descriptionKey: 'account.items.support.bodyNative', badgeKey: 'account.items.support.badge', tone: 'success', route: 'SupportCenter', icon: 'help', group: 'activity' },
  { titleKey: 'account.items.settings.title', descriptionKey: 'account.items.settings.bodyNative', badgeKey: 'account.items.settings.badge', tone: 'instruction', route: 'Settings', icon: 'settings', group: 'settings' },
  { titleKey: 'account.items.legal.title', descriptionKey: 'account.items.legal.bodyNative', badgeKey: 'account.items.legal.badge', tone: 'warning', route: 'LegalPolicy', icon: 'warning', group: 'settings' },
  { titleKey: 'account.items.delete.title', descriptionKey: 'account.items.delete.bodyNative', badgeKey: 'account.items.delete.badge', tone: 'warning', route: 'AccountDeletion', icon: 'warning', group: 'settings' },
  ...(betaFeatures.mobileMembershipVisible ? [{ titleKey: 'account.items.membership.title', descriptionKey: 'account.items.membership.bodyNative', badgeKey: 'account.items.membership.badge', tone: 'success' as SemanticColorName, route: 'Membership' as AccountRoute, icon: 'profile' as MobileIconName, group: 'future' as AccountGroupKey }] : []),
  ...(betaFeatures.businessAccountsVisible ? [{ titleKey: 'account.items.business.title', descriptionKey: 'account.items.business.bodyNative', badgeKey: 'account.items.business.badge', tone: 'instruction' as SemanticColorName, route: 'BusinessAccounts' as AccountRoute, icon: 'business' as MobileIconName, group: 'future' as AccountGroupKey }] : []),
  ...(betaFeatures.walletVisible ? [{ titleKey: 'account.items.wallet.title', descriptionKey: 'account.items.wallet.bodyNative', badgeKey: 'account.items.wallet.badge', tone: 'credits' as SemanticColorName, route: 'Wallet' as AccountRoute, icon: 'wallet' as MobileIconName, group: 'future' as AccountGroupKey }] : []),
  ...(betaFeatures.payoutsVisible ? [{ titleKey: 'account.items.payouts.title', descriptionKey: 'account.items.payouts.bodyNative', badgeKey: 'account.items.payouts.badge', tone: 'success' as SemanticColorName, route: 'Payouts' as AccountRoute, icon: 'payout' as MobileIconName, group: 'future' as AccountGroupKey }] : []),
];

function formatLedgerType(type: string) {
  if (type === 'test_credit_grant') return 'demo top-up';
  if (type === 'credit_purchase') return 'wallet top-up';
  if (type === 'payout_requested') return 'payout';
  if (type === 'trade_hold') return 'trade hold';
  if (type === 'trade_release') return 'trade release';
  if (type === 'trade_refund') return 'trade refund';
  return type.replaceAll('_', ' ');
}

function entryAmount(entry: LedgerEntryDto) {
  return `${entry.amountCents > 0 ? '+' : ''}${formatMoney(entry.amountCents ?? 0, entry.currency ?? 'eur')}`;
}

function ledgerTone(type: string, amount: number): SemanticColorName {
  if (type.includes('hold')) return 'time';
  if (type.includes('refund')) return 'warning';
  if (type.includes('release') || type.includes('earned')) return 'success';
  if (amount < 0) return 'danger';
  return 'credits';
}

function getDisplayName(user: AuthUser | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Hellowhen member';
}

function getAvatarUri(user: AuthUser | null) {
  const url = user?.profile?.avatarUrl;
  return url ? resolveMediaUrl(url) : null;
}

function groupActions(actions: AccountAction[]) {
  return {
    activity: actions.filter((action) => action.group === 'activity'),
    plans: actions.filter((action) => action.group === 'plans'),
    settings: actions.filter((action) => action.group === 'settings'),
    future: actions.filter((action) => action.group === 'future'),
  };
}

export function AccountScreen() {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [wallet, setWallet] = useState<WalletResponse['wallet']>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [meHubCounts, setMeHubCounts] = useState<MeHubCounts>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<MeHubSectionKey, boolean>>({ activity: false, plans: false, tools: false });

  const loadWallet = useCallback(async () => {
    if (!(betaFeatures.walletVisible || betaFeatures.payoutsVisible)) { setWallet(null); setWalletError(null); return; }
    setLoadingWallet(true);
    setWalletError(null);

    try {
      const result = await api.wallet.me() as WalletResponse;
      setWallet(result.wallet);
    } catch (caughtError) {
      setWallet(null);
      setWalletError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  const loadNotificationPreview = useCallback(async () => {
    try {
      const response = await api.notifications.unreadCount();
      setNotificationUnreadCount(response.unreadCount ?? 0);
    } catch {
      setNotificationUnreadCount(0);
    }
  }, []);

  const loadMeHubCounts = useCallback(async () => {
    if (!auth.user?.id) { setMeHubCounts({}); return; }
    const [trades, needs, offers, myPlans, joinedPlans, places] = await Promise.all([
      api.trades.mine({ scope: 'created' }).then((response) => countCollection(response, 'trades')).catch(() => undefined),
      api.needs.mine().then((response) => countCollection(response, 'needs')).catch(() => undefined),
      api.offers.mine().then((response) => countCollection(response, 'offers')).catch(() => undefined),
      betaFeatures.plansVisible ? api.plans.mine().then((response) => countCollection(response, 'plans')).catch(() => undefined) : Promise.resolve(undefined),
      betaFeatures.plansVisible ? api.plans.joined().then((response) => countCollection(response, 'plans')).catch(() => undefined) : Promise.resolve(undefined),
      betaFeatures.plansVisible ? api.places.mine({ take: 100 }).then((response) => countCollection(response, 'places')).catch(() => undefined) : Promise.resolve(undefined),
    ]);
    setMeHubCounts({ trades, needs, offers, myPlans, joinedPlans, places });
  }, [auth.user?.id]);

  useFocusEffect(useCallback(() => {
    if (betaFeatures.walletVisible || betaFeatures.payoutsVisible) void loadWallet();
    void loadNotificationPreview();
    void loadMeHubCounts();
  }, [loadWallet, loadMeHubCounts, loadNotificationPreview]));

  const displayName = getDisplayName(auth.user);
  const handle = auth.user?.profile?.handle ? `@${auth.user.profile.handle}` : t('account.addHandle');
  const avatarUri = getAvatarUri(auth.user);
  const currency = wallet?.currency ?? 'eur';
  const recentEntries = wallet?.entries?.filter((entry) => entry.amountCents !== 0 && entry.type !== 'starting_demo_credits').slice(0, 3) ?? [];
  const groupedActions = useMemo(() => groupActions(accountActions), []);

  function toggleMeSection(section: MeHubSectionKey) {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function navigate(route: AccountRoute) {
    setMenuOpen(false);
    if (route === 'TradeTabs') navigation.navigate('TradeTabs');
    else if (route === 'CreateTrade') navigation.navigate('CreateTrade');
    else if (route === 'MyNeeds') navigation.navigate('MyNeeds');
    else if (route === 'MyOffers') navigation.navigate('MyOffers');
    else if (route === 'CreateNeed') navigation.navigate('CreateNeed');
    else if (route === 'CreateOffer') navigation.navigate('CreateOffer');
    else if (route === 'AccountProfile') navigation.navigate('AccountProfile');
    else if (route === 'Notifications') navigation.navigate('Notifications');
    else if (route === 'SavedLibrary') navigation.navigate('SavedLibrary');
    else if (route === 'Agenda') navigation.navigate('Agenda');
    else if (route === 'Plans') navigation.navigate('Plans');
    else if (route === 'MyPlans') navigation.navigate('MyPlans');
    else if (route === 'JoinedPlans') navigation.navigate('JoinedPlans');
    else if (route === 'MyPlaces') navigation.navigate('MyPlaces');
    else if (route === 'PlaceLibrary') navigation.navigate('PlaceLibrary');
    else if (route === 'CreatePlan') navigation.navigate('CreatePlan');
    else if (route === 'CreatePlace') navigation.navigate('CreatePlace');
    else if (route === 'OnboardingGuide') navigation.navigate('GuideHub');
    else if (route === 'Membership') navigation.navigate('Membership');
    else if (route === 'ProPlans') navigation.navigate('ProPlans');
    else if (route === 'BusinessAccounts') navigation.navigate('BusinessAccounts');
    else if (route === 'Wallet') navigation.navigate('Wallet');
    else if (route === 'Payouts') navigation.navigate('Payouts');
    else if (route === 'Settings') navigation.navigate('Settings');
    else if (route === 'LegalPolicy') navigation.navigate('LegalPolicy');
    else if (route === 'SupportCenter') navigation.navigate('SupportCenter');
    else if (route === 'AccountDeletion') navigation.navigate('AccountDeletion');
    else navigation.navigate('BuyCredits');
  }

  const activityWidgets = useMemo<MeHubWidget[]>(() => [
    { title: t('trade.wizard.actions.myTrades.title'), body: t('trade.wizard.actions.myTrades.body'), route: 'TradeTabs', icon: 'activity', tone: 'trade', count: meHubCounts.trades },
    { title: t('trade.wizard.actions.myNeeds.title'), body: t('trade.wizard.actions.myNeeds.body'), route: 'MyNeeds', icon: 'need', tone: 'need', count: meHubCounts.needs },
    { title: t('trade.wizard.actions.myOffers.title'), body: t('trade.wizard.actions.myOffers.body'), route: 'MyOffers', icon: 'offer', tone: 'offer', count: meHubCounts.offers },
  ], [meHubCounts.needs, meHubCounts.offers, meHubCounts.trades, t]);

  const planWidgets = useMemo<MeHubWidget[]>(() => betaFeatures.plansVisible ? [
    { title: t('account.items.plansFeature.title'), body: t('account.items.plansFeature.bodyNative'), route: 'Plans', icon: 'plan', tone: 'instruction' },
    { title: t('account.items.myPlansFeature.title'), body: t('account.items.myPlansFeature.bodyNative'), route: 'MyPlans', icon: 'activity', tone: 'info', count: meHubCounts.myPlans },
    { title: t('account.items.joinedPlansFeature.title'), body: t('account.items.joinedPlansFeature.bodyNative'), route: 'JoinedPlans', icon: 'proposal-accepted', tone: 'success', count: meHubCounts.joinedPlans },
    { title: t('account.items.myPlacesFeature.title'), body: t('account.items.myPlacesFeature.bodyNative'), route: 'MyPlaces', icon: 'location-on', tone: 'proposal', count: meHubCounts.places },
    { title: t('account.items.placeLibraryFeature.title'), body: t('account.items.placeLibraryFeature.bodyNative'), route: 'PlaceLibrary', icon: 'search', tone: 'instruction' },
  ] : [], [meHubCounts.joinedPlans, meHubCounts.myPlans, meHubCounts.places, t]);

  const toolWidgets = useMemo<MeHubWidget[]>(() => [
    ...(betaFeatures.savedLibraryEnabled ? [{ title: t('account.items.saved.title'), body: t('account.items.saved.bodyNative'), route: 'SavedLibrary' as AccountRoute, icon: 'save' as MobileIconName, tone: 'proposal' as SemanticColorName }] : []),
    ...(betaFeatures.agendaEnabled ? [{ title: t('account.items.agenda.title'), body: t('account.items.agenda.bodyNative'), route: 'Agenda' as AccountRoute, icon: 'calendar' as MobileIconName, tone: 'instruction' as SemanticColorName }] : []),
    { title: t('account.items.notifications.title'), body: t('account.items.notifications.bodyNative'), route: 'Notifications', icon: 'bell', tone: 'proposal', count: notificationUnreadCount },
    { title: t('account.items.support.title'), body: t('account.items.support.bodyNative'), route: 'SupportCenter', icon: 'help', tone: 'success' },
  ], [notificationUnreadCount, t]);

  const futureActions = groupedActions.future;
  const menuActions = [...groupedActions.settings, ...futureActions, groupedActions.activity.find((action) => action.route === 'OnboardingGuide'), groupedActions.activity.find((action) => action.route === 'SupportCenter')].filter(Boolean) as AccountAction[];

  const header = (
    <View style={styles.headerRowTop}>
      <View style={styles.headerCopy}>
        <View style={styles.headerBadgeRow}><SemanticBadge label={t('common.states.beta')} tone="instruction" /></View>
        <AppText style={styles.title}>{t(betaFeatures.mainNavPlansMeTrade ? 'navigation.tabs.me' : 'account.title')}</AppText>
        <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.headerBody')}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('account.menu.open')} onPress={() => setMenuOpen(true)} style={({ pressed }) => [styles.headerMenuButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
        <MobileIcon name="more" size={21} color={theme.color.text} />
      </Pressable>
    </View>
  );

  return (
    <AppFixedHeaderScreen header={header}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loadingWallet} onRefresh={() => { if (betaFeatures.walletVisible || betaFeatures.payoutsVisible) void loadWallet(); void loadNotificationPreview(); void loadMeHubCounts(); }} />}
      >
        <View style={[styles.profilePanel, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <View style={styles.profileHero}>
            <View style={[styles.avatar, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <AppText style={[styles.avatarText, { color: theme.semantic.proposal.text }]}>{displayName.slice(0, 1).toUpperCase()}</AppText>
              )}
            </View>
            <View style={styles.profileCopy}>
              <AppText style={styles.profileName}>{displayName}</AppText>
              <AppText style={[styles.profileMeta, { color: theme.semantic.proposal.text }]}>{handle}</AppText>
              <AppText style={[styles.profileEmail, { color: theme.color.muted }]}>{auth.user?.email ?? t('common.states.signedIn')}</AppText>
            </View>
          </View>
          <View style={styles.quickActions}>
            <AccountQuickAction icon="trade" label={t('account.quickActions.createTrade')} onPress={() => navigate('CreateTrade')} tone="trade" />
            {betaFeatures.plansVisible ? <AccountQuickAction icon="calendar" label={t('account.quickActions.createPlan')} onPress={() => navigate('CreatePlan')} tone="instruction" /> : <AccountQuickAction icon="bell" label={t('account.quickActions.notifications')} count={notificationUnreadCount} onPress={() => navigate('Notifications')} tone="proposal" />}
            {betaFeatures.plansVisible ? <AccountQuickAction icon="location-on" label={t('account.quickActions.addPlace')} onPress={() => navigate('CreatePlace')} tone="proposal" /> : <AccountQuickAction icon="help" label={t('account.quickActions.support')} onPress={() => navigate('SupportCenter')} tone="success" />}
          </View>
        </View>

        <MeWidgetSection sectionKey="activity" title={t('account.sections.activity')} widgets={activityWidgets} collapsed={collapsedSections.activity} onToggle={toggleMeSection} onNavigate={navigate} />
        {planWidgets.length > 0 ? <MeWidgetSection sectionKey="plans" title={t('account.sections.plans')} widgets={planWidgets} collapsed={collapsedSections.plans} onToggle={toggleMeSection} onNavigate={navigate} /> : null}
        <MeWidgetSection sectionKey="tools" title={t('account.sections.tools')} widgets={toolWidgets} collapsed={collapsedSections.tools} onToggle={toggleMeSection} onNavigate={navigate} />

        {(betaFeatures.walletVisible || betaFeatures.payoutsVisible) ? (
          <DetailSection title={t('account.wallet.title')} description={t('account.wallet.body')} compact={false}>
            {wallet ? (
              <DetailInfoList rows={[
                { label: t('account.wallet.available'), value: formatMoney(wallet.availableBalanceCents, currency), tone: 'credits' },
                { label: t('account.wallet.held'), value: formatMoney(wallet.heldBalanceCents, currency), tone: 'time' },
                { label: t('account.wallet.earnings'), value: formatMoney(wallet.pendingPayoutCents, currency), tone: 'success' },
              ]} />
            ) : null}
            <View style={styles.inlineActions}>
              <Pressable accessibilityRole="button" onPress={() => navigate('Wallet')} style={({ pressed }) => [styles.inlinePrimary, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
                <AppText style={[styles.inlinePrimaryText, { color: theme.color.background }]}>{t('common.actions.openWallet')}</AppText>
              </Pressable>
              {betaFeatures.walletVisible ? (
                <Pressable accessibilityRole="button" onPress={() => navigate('BuyCredits')} style={({ pressed }) => [styles.inlineSecondary, { borderColor: theme.color.border }, pressed && styles.pressed]}>
                  <AppText style={[styles.inlineSecondaryText, { color: theme.color.text }]}>{t('common.actions.add')}</AppText>
                </Pressable>
              ) : null}
              {betaFeatures.payoutsVisible ? (
                <Pressable accessibilityRole="button" onPress={() => navigate('Payouts')} style={({ pressed }) => [styles.inlineSecondary, { borderColor: theme.color.border }, pressed && styles.pressed]}>
                  <AppText style={[styles.inlineSecondaryText, { color: theme.color.text }]}>{t('common.actions.payout')}</AppText>
                </Pressable>
              ) : null}
            </View>
            {walletError ? <InfoNotice tone="warning" title={t('account.walletUnavailable')} body={walletError} /> : null}
          </DetailSection>
        ) : null}

        {(betaFeatures.walletVisible || betaFeatures.payoutsVisible) ? (
          <DetailSection title={t('account.wallet.recentActivity')} compact>
            {recentEntries.length === 0 ? <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.noWalletActivity')}</AppText> : recentEntries.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
          </DetailSection>
        ) : null}

        <AccountMenuModal visible={menuOpen} actions={menuActions} unreadCount={notificationUnreadCount} onClose={() => setMenuOpen(false)} onLogout={() => { setMenuOpen(false); void auth.logout(); }} onNavigate={navigate} />
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function AccountQuickAction({ icon, label, count, onPress, tone }: { icon: MobileIconName; label: string; count?: number; onPress: () => void; tone: SemanticColorName }) {
  const theme = useThemeTokens();
  const semantic = theme.semantic[tone];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={count && count > 0 ? `${label} · ${count}` : label} onPress={onPress} style={({ pressed }) => [styles.quickAction, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={[styles.quickIcon, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}>
        <MobileIcon name={icon} size={17} color={semantic.text} />
        {count && count > 0 ? <View style={[styles.quickDot, { backgroundColor: theme.semantic.proposal.bg }]}><AppText style={styles.quickDotText}>{Math.min(count, 99)}</AppText></View> : null}
      </View>
      <AppText style={styles.quickLabel} numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

function MeWidgetSection({ sectionKey, title, widgets, collapsed, onToggle, onNavigate }: { sectionKey: MeHubSectionKey; title: string; widgets: MeHubWidget[]; collapsed: boolean; onToggle: (section: MeHubSectionKey) => void; onNavigate: (route: AccountRoute) => void }) {
  const theme = useThemeTokens();
  if (widgets.length === 0) return null;
  return (
    <View style={styles.widgetSection}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => onToggle(sectionKey)} style={({ pressed }) => [styles.widgetSectionHeader, pressed && styles.pressed]}>
        <View style={styles.widgetSectionTitleRow}>
          <AppText style={[styles.widgetSectionTitle, { color: theme.color.muted }]}>{title}</AppText>
          <SemanticBadge label={String(widgets.length)} tone="info" size="sm" />
        </View>
        <MobileIcon name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={theme.color.muted} />
      </Pressable>
      {!collapsed ? (
        <View style={[styles.menuList, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          {widgets.map((widget, index) => (
            <MeHubWidgetRow key={`${widget.route}-${widget.title}`} widget={widget} last={index === widgets.length - 1} onPress={() => onNavigate(widget.route)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MeHubWidgetRow({ widget, last, onPress }: { widget: MeHubWidget; last?: boolean; onPress: () => void }) {
  const theme = useThemeTokens();
  const tone = theme.semantic[widget.tone];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={typeof widget.count === 'number' ? `${widget.title} · ${widget.count}` : widget.title} onPress={onPress} style={({ pressed }) => [styles.actionRow, !last && { borderBottomColor: theme.color.border, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && styles.pressed]}>
      <View style={styles.actionContent}>
        <View style={[styles.actionIcon, { backgroundColor: tone.softBg, borderColor: tone.border }]}>
          <MobileIcon name={widget.icon} size={18} color={tone.text} />
        </View>
        <View style={styles.actionTextWrap}>
          <View style={styles.actionTitleRow}>
            <AppText style={styles.actionTitle}>{widget.title}</AppText>
            {typeof widget.count === 'number' ? <SemanticBadge label={String(Math.min(widget.count, 99))} tone={widget.tone} size="sm" /> : null}
          </View>
          <AppText style={[styles.actionDescription, { color: theme.color.muted }]} numberOfLines={2}>{widget.body}</AppText>
        </View>
      </View>
      <MobileIcon name="chevron-right" size={22} color={theme.color.muted} />
    </Pressable>
  );
}

function AccountMenuModal({ actions, unreadCount, visible, onClose, onLogout, onNavigate }: { actions: AccountAction[]; unreadCount: number; visible: boolean; onClose: () => void; onLogout: () => void; onNavigate: (route: AccountRoute) => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const settingsActions = actions.filter((action) => action.group === 'settings');
  const futureActions = actions.filter((action) => action.group === 'future');
  const helpActions = actions.filter((action) => action.route === 'OnboardingGuide' || action.route === 'SupportCenter');

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('account.menu.close')} onPress={onClose} style={styles.menuBackdrop}>
        <Pressable accessibilityRole="menu" onPress={(event) => event.stopPropagation()} style={[styles.menuSheet, { backgroundColor: theme.color.elevated, borderColor: theme.color.border }]}>
          <View style={styles.menuHeader}>
            <View style={styles.menuHeaderCopy}>
              <AppText style={styles.menuTitle}>{t('account.menu.title')}</AppText>
              <AppText style={[styles.menuBody, { color: theme.color.muted }]}>{t('account.menu.body')}</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('account.menu.close')} onPress={onClose} style={({ pressed }) => [styles.menuCloseButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
              <MobileIcon name="close" size={19} color={theme.color.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.menuScrollContent} showsVerticalScrollIndicator={false}>
            <AccountMenuSection title={t('account.menu.sections.settings')} actions={settingsActions} unreadCount={unreadCount} onNavigate={onNavigate} />
            <AccountMenuSection title={t('account.menu.sections.help')} actions={helpActions} unreadCount={unreadCount} onNavigate={onNavigate} />
            <AccountMenuSection title={t('account.menu.sections.future')} actions={futureActions} unreadCount={unreadCount} onNavigate={onNavigate} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.actions.logout')} onPress={onLogout} style={({ pressed }) => [styles.logoutButton, { borderColor: theme.semantic.danger.border, backgroundColor: theme.semantic.danger.softBg }, pressed && styles.pressed]}>
              <AppText style={[styles.logoutButtonText, { color: theme.semantic.danger.text }]}>{t('common.actions.logout')}</AppText>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AccountMenuSection({ title, actions, unreadCount, onNavigate }: { title: string; actions: AccountAction[]; unreadCount: number; onNavigate: (route: AccountRoute) => void }) {
  const theme = useThemeTokens();
  if (actions.length === 0) return null;
  return (
    <View style={styles.menuSection}>
      <AppText style={[styles.menuSectionTitle, { color: theme.color.muted }]}>{title}</AppText>
      <View style={[styles.menuList, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        {actions.map((action, index) => <AccountActionRow key={`${action.route}-${index}`} action={action} unreadCount={action.route === 'Notifications' ? unreadCount : 0} last={index === actions.length - 1} onPress={() => onNavigate(action.route)} />)}
      </View>
    </View>
  );
}

function AccountActionGroup({ title, actions, unreadCount, onNavigate }: { title: string; actions: AccountAction[]; unreadCount: number; onNavigate: (route: AccountRoute) => void }) {
  if (actions.length === 0) return null;
  return (
    <DetailSection title={title} compact>
      <View style={styles.menuList}>
        {actions.map((action, index) => <AccountActionRow key={action.route} action={action} unreadCount={action.route === 'Notifications' ? unreadCount : 0} last={index === actions.length - 1} onPress={() => onNavigate(action.route)} />)}
      </View>
    </DetailSection>
  );
}

function AccountActionRow({ action, unreadCount, last, onPress }: { action: AccountAction; unreadCount?: number; last?: boolean; onPress: () => void }) {
  const theme = useThemeTokens();
  const tone = theme.semantic[action.tone];
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={unreadCount && unreadCount > 0 ? `${t(action.titleKey)} · ${unreadCount}` : t(action.titleKey)} onPress={onPress} style={({ pressed }) => [styles.actionRow, !last && { borderBottomColor: theme.color.border, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && styles.pressed]}>
      <View style={styles.actionContent}>
        <View style={[styles.actionIcon, { backgroundColor: tone.softBg, borderColor: tone.border }]}>
          <MobileIcon name={action.icon} size={18} color={tone.text} />
        </View>
        <View style={styles.actionTextWrap}>
          <View style={styles.actionTitleRow}>
            <AppText style={styles.actionTitle}>{t(action.titleKey)}</AppText>
            {unreadCount && unreadCount > 0 ? <SemanticBadge label={String(unreadCount)} tone={action.tone} size="sm" /> : null}
          </View>
          <AppText style={[styles.actionDescription, { color: theme.color.muted }]}>{t(action.descriptionKey)}</AppText>
        </View>
      </View>
      <MobileIcon name="chevron-right" size={22} color={theme.color.muted} />
    </Pressable>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntryDto }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.ledgerRow, { borderTopColor: theme.color.border }]}>
      <View style={styles.ledgerCopy}>
        <SemanticBadge label={formatLedgerType(entry.type)} tone={ledgerTone(entry.type, entry.amountCents || entry.amount)} size="sm" />
        <AppText style={[styles.ledgerDescription, { color: theme.color.muted }]}>{entry.description ?? entry.balanceType}</AppText>
      </View>
      <AppText style={[styles.ledgerAmount, { color: (entry.amountCents || entry.amount) < 0 ? theme.semantic.danger.text : theme.semantic.success.text }]}>{entryAmount(entry)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 12 },
  headerRowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 8 },
  headerMenuButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  widgetSection: { gap: 9 },
  widgetSectionHeader: { minHeight: 34, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  widgetSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  widgetSectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' },
  menuBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 10, 24, 0.42)', paddingHorizontal: 14, paddingBottom: 14 },
  menuSheet: { width: '100%', maxHeight: '86%', borderRadius: 28, borderWidth: 1, padding: 16, gap: 14 },
  menuHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  menuHeaderCopy: { flex: 1, minWidth: 0, gap: 5 },
  menuTitle: { fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.45 },
  menuBody: { lineHeight: 19, fontWeight: '700' },
  menuCloseButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 8 },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  profilePanel: { borderRadius: 28, borderWidth: 1, padding: 16, gap: 15 },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 66, height: 66, borderRadius: 33, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 33 },
  avatarText: { fontSize: 25, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 23, fontWeight: '900', letterSpacing: -0.35 },
  profileMeta: { marginTop: 3, fontWeight: '900' },
  profileEmail: { marginTop: 3, fontWeight: '600' },
  quickActions: { flexDirection: 'row', gap: 9 },
  quickAction: { flex: 1, minHeight: 74, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, gap: 7 },
  quickIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  quickDot: { position: 'absolute', top: -5, right: -9, minWidth: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  quickDotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  quickLabel: { fontSize: 12, lineHeight: 15, fontWeight: '900', textAlign: 'center' },
  cardText: { lineHeight: 20, fontWeight: '600' },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  inlinePrimary: { flex: 1, minWidth: 130, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  inlinePrimaryText: { fontWeight: '900' },
  inlineSecondary: { flex: 1, minWidth: 96, borderRadius: 16, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  inlineSecondaryText: { fontWeight: '900' },
  menuScrollContent: { gap: 12, paddingBottom: 2 },
  menuSection: { gap: 8 },
  menuSectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase', paddingHorizontal: 4 },
  menuList: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  actionRow: { minHeight: 72, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  actionContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionTextWrap: { flex: 1, gap: 3 },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionTitle: { fontSize: 17, fontWeight: '900' },
  actionDescription: { lineHeight: 19, fontWeight: '600' },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, paddingTop: 10 },
  ledgerCopy: { flex: 1, gap: 6 },
  ledgerDescription: { fontSize: 12, fontWeight: '700' },
  ledgerAmount: { fontSize: 18, fontWeight: '900' },
  logoutButton: { marginTop: 4, borderRadius: 18, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  logoutButtonText: { fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
