import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthUser } from '@hellowhen/contracts';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppSmartHeaderScreen } from '../../components/AppSmartHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures, mobileFeatureFlagDiagnostics } from '../../lib/betaFeatures';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { DetailInfoList, DetailSection } from '../../components/detail';
import { resolveMediaUrl } from '../trade/mediaUrls';

type AccountRoute = 'TradeActivityMine' | 'TradeActivityProposals' | 'MyNeeds' | 'MyOffers' | 'AccountProfile' | 'Notifications' | 'SavedLibrary' | 'Agenda' | 'MyPlans' | 'JoinedPlans' | 'MyPlaces' | 'OnboardingGuide' | 'Membership' | 'BusinessAccounts' | 'Wallet' | 'Payouts' | 'Settings' | 'LegalPolicy' | 'SupportCenter' | 'SafetyCenter' | 'AccountDeletion';
type AccountHubCounts = {
  trades?: number;
  needs?: number;
  offers?: number;
  myPlans?: number;
  joinedPlans?: number;
  places?: number;
};

type AccountNavigation = NativeStackNavigationProp<RootStackParamList>;

function navigateToAccountRoute(navigation: AccountNavigation, route: AccountRoute) {
  if (route === 'TradeActivityMine' || route === 'TradeActivityProposals') {
    navigation.navigate('TradeTabs', {
      screen: 'TradeTab',
      params: {
        accountActivity: route === 'TradeActivityMine' ? 'mine' : 'involved',
        accountActivityKey: Date.now(),
      },
    });
  } else if (route === 'MyNeeds') navigation.navigate('MyNeeds');
  else if (route === 'MyOffers') navigation.navigate('MyOffers');
  else if (route === 'AccountProfile') navigation.navigate('AccountProfile');
  else if (route === 'Notifications') navigation.navigate('Notifications');
  else if (route === 'SavedLibrary') navigation.navigate('SavedLibrary');
  else if (route === 'Agenda') navigation.navigate('Agenda');
  else if (route === 'MyPlans') navigation.navigate('MyPlans');
  else if (route === 'JoinedPlans') navigation.navigate('JoinedPlans');
  else if (route === 'MyPlaces') navigation.navigate('MyPlaces');
  else if (route === 'OnboardingGuide') navigation.navigate('GuideHub');
  else if (route === 'Membership') navigation.navigate('Membership');
  else if (route === 'BusinessAccounts') navigation.navigate('BusinessAccounts');
  else if (route === 'Wallet') navigation.navigate('Wallet');
  else if (route === 'Payouts') navigation.navigate('Payouts');
  else if (route === 'Settings') navigation.navigate('Settings');
  else if (route === 'LegalPolicy') navigation.navigate('LegalPolicy');
  else if (route === 'SupportCenter') navigation.navigate('SupportCenter');
  else if (route === 'SafetyCenter') navigation.navigate('SafetyCenter');
  else navigation.navigate('AccountDeletion');
}

function countCollection(response: unknown, key: string) {
  if (!response || typeof response !== 'object') return undefined;
  const value = (response as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : undefined;
}

const accountFutureActions: Array<{ titleKey: string; route: AccountRoute }> = [
  ...(betaFeatures.mobileMembershipVisible ? [{ titleKey: 'account.items.membership.title', route: 'Membership' as AccountRoute }] : []),
  ...(betaFeatures.businessAccountsVisible ? [{ titleKey: 'account.items.business.title', route: 'BusinessAccounts' as AccountRoute }] : []),
  ...(betaFeatures.walletVisible ? [{ titleKey: 'account.items.wallet.title', route: 'Wallet' as AccountRoute }] : []),
  ...(betaFeatures.payoutsVisible ? [{ titleKey: 'account.items.payouts.title', route: 'Payouts' as AccountRoute }] : []),
];

function getDisplayName(user: AuthUser | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Hellowhen member';
}

function getAvatarUri(user: AuthUser | null) {
  const url = user?.profile?.avatarUrl;
  return url ? resolveMediaUrl(url) : null;
}

export function AccountScreen() {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t } = useTranslation();
  const navigation = useNavigation<AccountNavigation>();
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [counts, setCounts] = useState<AccountHubCounts>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadNotificationPreview = useCallback(async () => {
    try {
      const response = await api.notifications.unreadCount();
      setNotificationUnreadCount(response.unreadCount ?? 0);
    } catch {
      setNotificationUnreadCount(0);
    }
  }, []);

  const loadAccountCounts = useCallback(async () => {
    if (!auth.user?.id) { setCounts({}); return; }
    const [trades, needs, offers, myPlans, joinedPlans, places] = await Promise.all([
      api.trades.mine({ scope: 'created' }).then((response) => countCollection(response, 'trades')).catch(() => undefined),
      api.needs.mine().then((response) => countCollection(response, 'needs')).catch(() => undefined),
      api.offers.mine().then((response) => countCollection(response, 'offers')).catch(() => undefined),
      betaFeatures.plansVisible ? api.plans.mine().then((response) => countCollection(response, 'plans')).catch(() => undefined) : Promise.resolve(undefined),
      betaFeatures.plansVisible ? api.plans.joined().then((response) => countCollection(response, 'plans')).catch(() => undefined) : Promise.resolve(undefined),
      betaFeatures.plansVisible ? api.places.mine({ take: 100 }).then((response) => countCollection(response, 'places')).catch(() => undefined) : Promise.resolve(undefined),
    ]);
    setCounts({ trades, needs, offers, myPlans, joinedPlans, places });
  }, [auth.user?.id]);

  const refreshAccount = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      await Promise.all([loadNotificationPreview(), loadAccountCounts()]);
    } finally {
      if (showRefresh) setRefreshing(false);
    }
  }, [loadAccountCounts, loadNotificationPreview]);

  useFocusEffect(useCallback(() => { void refreshAccount(); }, [refreshAccount]));

  const displayName = getDisplayName(auth.user);
  const handle = auth.user?.profile?.handle ? `@${auth.user.profile.handle}` : t('account.addHandle');
  const avatarUri = getAvatarUri(auth.user);
  const futureActions = accountFutureActions;
  const showFlagDiagnostics = betaFeatures.mobileDiagnosticsVisible;

  function navigate(route: AccountRoute) {
    navigateToAccountRoute(navigation, route);
  }

  const header = (
    <View style={styles.headerCopy}>
      <AppText style={styles.title}>{t('account.title')}</AppText>
      <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.headerBody')}</AppText>
    </View>
  );

  return (
    <AppSmartHeaderScreen header={header} resetKey={auth.user?.id ?? 'account'}>
      {(scrollProps) => (
        <ScrollView
          {...scrollProps.scrollViewProps}
          contentContainerStyle={[scrollProps.contentInsetStyle, styles.content]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refreshAccount(true); }} />}
        >
          <AccountHubSection title={t('account.hub.profile')}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('account.hub.publicProfile')}
              onPress={() => navigate('AccountProfile')}
              style={({ pressed }) => [styles.profileRow, pressed && styles.pressed]}
            >
              <View style={[styles.avatar, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
                {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} /> : <AppText style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</AppText>}
              </View>
              <View style={styles.profileCopy}>
                <AppText style={styles.profileName} numberOfLines={1}>{displayName}</AppText>
                <AppText style={[styles.profileMeta, { color: theme.color.muted }]} numberOfLines={1}>{handle}</AppText>
                <AppText style={[styles.profileHint, { color: theme.color.muted }]}>{t('account.hub.publicProfile')}</AppText>
              </View>
              <MobileIcon name="chevron-right" size={21} color={theme.color.muted} />
            </Pressable>
          </AccountHubSection>

          {showFlagDiagnostics ? <MobileFlagDiagnosticsCard /> : null}

          {betaFeatures.plansVisible ? (
            <AccountHubSection title={t('account.sections.plans')} titleTone="plan">
              <AccountHubRow title={t('account.items.myPlansFeature.title')} count={counts.myPlans} countTone="plan" onPress={() => navigate('MyPlans')} />
              <AccountHubRow title={t('account.items.joinedPlansFeature.title')} count={counts.joinedPlans} countTone="plan" onPress={() => navigate('JoinedPlans')} />
              <AccountHubRow title={t('account.hub.myPlaces')} count={counts.places} countTone="place" onPress={() => navigate('MyPlaces')} />
            </AccountHubSection>
          ) : null}

          <AccountHubSection title={t('navigation.tabs.trade')} titleTone="trade">
            <AccountHubRow title={t('trade.wizard.actions.myTrades.title')} count={counts.trades} countTone="trade" onPress={() => navigate('TradeActivityMine')} />
            <AccountHubRow title={t('trade.wizard.actions.proposals.title')} onPress={() => navigate('TradeActivityProposals')} />
            <AccountHubRow title={t('trade.wizard.actions.myNeeds.title')} count={counts.needs} countTone="need" onPress={() => navigate('MyNeeds')} />
            <AccountHubRow title={t('trade.wizard.actions.myOffers.title')} count={counts.offers} countTone="offer" onPress={() => navigate('MyOffers')} />
          </AccountHubSection>

          <AccountHubSection title={t('account.sections.tools')}>
            {betaFeatures.savedLibraryEnabled ? <AccountHubRow title={t('account.items.saved.title')} onPress={() => navigate('SavedLibrary')} /> : null}
            {betaFeatures.agendaEnabled ? <AccountHubRow title={t('account.items.agenda.title')} onPress={() => navigate('Agenda')} /> : null}
            <AccountHubRow title={t('account.items.notifications.title')} count={notificationUnreadCount} onPress={() => navigate('Notifications')} />
            <AccountHubRow title={t('account.items.guide.title')} onPress={() => navigate('OnboardingGuide')} />
          </AccountHubSection>

          <AccountHubSection title={t('account.sections.settings')}>
            <AccountHubRow title={t('account.items.settings.title')} description={t('account.hub.settingsSummary')} onPress={() => navigate('Settings')} />
            <AccountHubRow title={t('account.items.safety.title')} onPress={() => navigate('SafetyCenter')} />
            <AccountHubRow title={t('account.items.support.title')} onPress={() => navigate('SupportCenter')} />
            <AccountHubRow title={t('account.items.legal.title')} onPress={() => navigate('LegalPolicy')} />
            <AccountHubRow title={t('account.items.delete.title')} danger onPress={() => navigate('AccountDeletion')} />
          </AccountHubSection>

          {futureActions.length > 0 ? (
            <AccountHubSection title={t('account.sections.future')}>
              {futureActions.map((action) => <AccountHubRow key={action.route} title={t(action.titleKey)} onPress={() => navigate(action.route)} />)}
            </AccountHubSection>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.actions.logout')}
            onPress={() => { void auth.logout().finally(() => navigation.navigate('Login')); }}
            style={({ pressed }) => [styles.logoutRow, { borderColor: theme.color.border }, pressed && styles.pressed]}
          >
            <AppText style={[styles.logoutText, { color: theme.semantic.danger.text }]}>{t('common.actions.logout')}</AppText>
          </Pressable>
        </ScrollView>
      )}
    </AppSmartHeaderScreen>
  );
}

function AccountHubSection({ title, titleTone, children }: { title: string; titleTone?: SemanticColorName; children: React.ReactNode }) {
  const theme = useThemeTokens();
  const titleColor = titleTone ? theme.semantic[titleTone].text : theme.color.muted;
  return (
    <View style={styles.hubSection}>
      <AppText style={[styles.hubSectionTitle, { color: titleColor }]}>{title}</AppText>
      <View style={[styles.hubList, { borderColor: theme.color.border }]}>{children}</View>
    </View>
  );
}

function AccountHubRow({ title, description, count, countTone, danger = false, onPress }: { title: string; description?: string; count?: number; countTone?: SemanticColorName; danger?: boolean; onPress: () => void }) {
  const theme = useThemeTokens();
  const countTextColor = countTone ? theme.semantic[countTone].text : theme.semantic.muted.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={typeof count === 'number' ? `${title} · ${count}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.hubRow, { borderBottomColor: theme.color.border }, pressed && styles.pressed]}
    >
      <View style={styles.hubRowCopy}>
        <AppText style={[styles.hubRowTitle, danger && { color: theme.semantic.danger.text }]}>{title}</AppText>
        {description ? <AppText style={[styles.hubRowDescription, { color: theme.color.muted }]}>{description}</AppText> : null}
      </View>
      <View style={styles.hubRowEnd}>
        {typeof count === 'number' ? <SemanticBadge label={String(Math.min(count, 99))} tone="muted" size="sm" textStyle={{ color: countTextColor }} /> : null}
        <MobileIcon name="chevron-right" size={20} color={danger ? theme.semantic.danger.text : theme.color.muted} />
      </View>
    </Pressable>
  );
}

function formatDiagnosticValue(value: boolean | string | undefined) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return '(unset)';
}

function MobileFlagDiagnosticsCard() {
  const rows = [
    { label: 'STORE_RELEASE', value: mobileFeatureFlagDiagnostics.raw.EXPO_PUBLIC_STORE_RELEASE },
    { label: 'NODE_ENV', value: mobileFeatureFlagDiagnostics.nodeEnv },
    { label: 'API URL', value: mobileFeatureFlagDiagnostics.raw.EXPO_PUBLIC_API_URL },
    { label: 'resolved plansEnabled', value: mobileFeatureFlagDiagnostics.resolved.plansEnabled, tone: mobileFeatureFlagDiagnostics.resolved.plansEnabled ? 'success' as const : 'warning' as const },
    { label: 'resolved plansVisible', value: mobileFeatureFlagDiagnostics.resolved.plansVisible, tone: mobileFeatureFlagDiagnostics.resolved.plansVisible ? 'success' as const : 'warning' as const },
    { label: 'resolved main nav', value: mobileFeatureFlagDiagnostics.resolved.mainNavPlansMeTrade, tone: mobileFeatureFlagDiagnostics.resolved.mainNavPlansMeTrade ? 'success' as const : 'warning' as const },
    { label: 'release guards', value: mobileFeatureFlagDiagnostics.resolved.firstLaunchGuardsEnabled },
    { label: 'force safe flags', value: mobileFeatureFlagDiagnostics.resolved.forceFirstLaunchSafeFlags },
    { label: 'plans guard allow', value: mobileFeatureFlagDiagnostics.resolved.plansAllowWithFirstLaunchGuards, tone: mobileFeatureFlagDiagnostics.resolved.plansAllowWithFirstLaunchGuards ? 'success' as const : 'warning' as const },
    { label: 'force Plans hidden', value: mobileFeatureFlagDiagnostics.resolved.forcePlansFirstLaunchSafeFlags, tone: mobileFeatureFlagDiagnostics.resolved.forcePlansFirstLaunchSafeFlags ? 'warning' as const : 'success' as const },
    { label: 'EXPO FIRST_LAUNCH', value: mobileFeatureFlagDiagnostics.raw.EXPO_PUBLIC_FIRST_LAUNCH_GUARDS_ENABLED },
    { label: 'NEXT FIRST_LAUNCH', value: mobileFeatureFlagDiagnostics.raw.NEXT_PUBLIC_FIRST_LAUNCH_GUARDS_ENABLED },
    { label: 'EXPO PLANS_ALLOW', value: mobileFeatureFlagDiagnostics.raw.EXPO_PUBLIC_PLANS_ALLOW_WITH_FIRST_LAUNCH_GUARDS },
    { label: 'NEXT PLANS_ALLOW', value: mobileFeatureFlagDiagnostics.raw.NEXT_PUBLIC_PLANS_ALLOW_WITH_FIRST_LAUNCH_GUARDS },
    { label: 'EXPO PLANS_ENABLED', value: mobileFeatureFlagDiagnostics.raw.EXPO_PUBLIC_PLANS_ENABLED },
    { label: 'NEXT PLANS_ENABLED', value: mobileFeatureFlagDiagnostics.raw.NEXT_PUBLIC_PLANS_ENABLED },
    { label: 'EXPO PLANS_VISIBLE', value: mobileFeatureFlagDiagnostics.raw.EXPO_PUBLIC_PLANS_VISIBLE },
    { label: 'NEXT PLANS_VISIBLE', value: mobileFeatureFlagDiagnostics.raw.NEXT_PUBLIC_PLANS_VISIBLE },
    { label: 'EXPO MAIN_NAV', value: mobileFeatureFlagDiagnostics.raw.EXPO_PUBLIC_MAIN_NAV_PLANS_ME_TRADE },
    { label: 'NEXT MAIN_NAV', value: mobileFeatureFlagDiagnostics.raw.NEXT_PUBLIC_MAIN_NAV_PLANS_ME_TRADE },
    { label: 'diagnostics flag', value: mobileFeatureFlagDiagnostics.raw.EXPO_PUBLIC_MOBILE_FLAG_DIAGNOSTICS_VISIBLE },
  ].map((row) => ({ ...row, value: formatDiagnosticValue(row.value) }));

  return (
    <DetailSection title="Feature flag diagnostics" description="Temporary mobile bundle diagnostics for Plans visibility. Remove or hide after production flags are confirmed." compact>
      <DetailInfoList rows={rows} />
    </DetailSection>
  );
}


const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 20 },
  headerCopy: { gap: 8 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  hubSection: { gap: 8 },
  hubSectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase', paddingHorizontal: 4 },
  hubList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  profileRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4 },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 26 },
  avatarText: { fontSize: 20, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0, gap: 2 },
  profileName: { fontSize: 18, fontWeight: '900' },
  profileMeta: { fontSize: 13, fontWeight: '700' },
  profileHint: { fontSize: 12, fontWeight: '600' },
  hubRow: { minHeight: 56, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  hubRowCopy: { flex: 1, minWidth: 0, gap: 3 },
  hubRowTitle: { fontSize: 16, fontWeight: '800' },
  hubRowDescription: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  hubRowEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoutRow: { minHeight: 56, justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 },
  logoutText: { fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
