import React, { useCallback, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PlaceDto, TradePostType } from '@hellowhen/contracts';
import { AccountScreen } from '../features/account/AccountScreen';
import { AccountDeletionScreen } from '../features/account/AccountDeletionScreen';
import { BusinessAccountsScreen } from '../features/account/BusinessAccountsScreen';
import { BuyCreditsScreen } from '../features/account/BuyCreditsScreen';
import { NotificationsScreen } from '../features/account/NotificationsScreen';
import { AgendaScreen } from '../features/account/AgendaScreen';
import { SavedCollectionDetailScreen, SavedLibraryScreen } from '../features/account/SavedLibraryScreen';
import { MembershipScreen } from '../features/account/MembershipScreen';
import { PlanSelectionScreen } from '../features/account/PlanSelectionScreen';
import { SupportCenterScreen } from '../features/account/SupportCenterScreen';
import { SupportTicketDetailScreen } from '../features/account/SupportTicketDetailScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { GuideHubScreen } from '../features/onboarding-guide/GuideHubScreen';
import { OnboardingGuideScreen } from '../features/onboarding-guide/OnboardingGuideScreen';
import type { OnboardingGuideType } from '../features/onboarding-guide/onboardingGuide.slides';
import { LegalPolicyScreen } from '../features/legal/LegalPolicyScreen';
import { ProfileScreen } from '../features/me/MeScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { SecurityPasswordScreen } from '../features/settings/SecurityPasswordScreen';
import { TwoFactorSecurityScreen } from '../features/settings/TwoFactorSecurityScreen';
import { PublicUserProfileScreen } from '../features/users/PublicUserProfileScreen';
import { CreateNeedScreen } from '../features/trade/CreateNeedScreen';
import { CreateNeedFullScreen } from '../features/trade/CreateNeedFullScreen';
import { CreateOfferScreen } from '../features/trade/CreateOfferScreen';
import { CreateOfferFullScreen } from '../features/trade/CreateOfferFullScreen';
import { CreateProposalScreen } from '../features/trade/CreateProposalScreen';
import { CreateTradeFullScreen } from '../features/trade/CreateTradeFullScreen';
import { CreateTradeScreen, type TradeCreateReturnParams, type TradeCreateSideSelection, type TradeSidePickerParams } from '../features/trade/CreateTradeScreen';
import type { FeedTradeIdeaKey } from '../features/trade/tradeFeedIdeas';
import { TradeSidePickerScreen } from '../features/trade/TradeSidePickerScreen';
import { MyNeedsScreen } from '../features/trade/MyNeedsScreen';
import { NeedDetailScreen } from '../features/trade/NeedDetailScreen';
import { MyOffersScreen } from '../features/trade/MyOffersScreen';
import { OfferDetailScreen } from '../features/trade/OfferDetailScreen';
import { ProposalDetailScreen } from '../features/trade/ProposalDetailScreen';
import { TradePrivateProposalsScreen } from '../features/trade/TradePrivateProposalsScreen';
import { TradePublicDiscussionScreen } from '../features/trade/TradePublicDiscussionScreen';
import { TradeDeckFeedScreen } from '../features/trade/TradeDeckFeedScreen';
import { TradeDetailScreen } from '../features/trade/TradeDetailScreen';
import { TradeIdeaDetailScreen } from '../features/trade/TradeIdeaDetailScreen';
import { CreatePlaceScreen, CreatePlanScreen, JoinedPlansScreen, MyPlacesScreen, MyPlansScreen, PlaceLibraryScreen, PlanDetailScreen, PlanFiltersScreen, PlanIdeaDetailScreen, PlansScreen } from '../features/plans/PlansScreens';
import { PlanPublicDiscussionScreen } from '../features/plans/PlanPublicDiscussionScreen';
import { WalletScreen } from '../features/wallet/WalletScreen';
import { PayoutsScreen } from '../features/wallet/PayoutsScreen';
import { useAuth } from '../providers/AuthProvider';
import { useThemeTokens } from '../providers/ThemeProvider';
import { MobileIcon, type MobileIconName } from '../components/MobileIcon';
import { api } from '../lib/api';
import { betaFeatures } from '../lib/betaFeatures';
import { AppCard } from '../components/AppCard';
import { AppScreen } from '../components/AppScreen';
import { AppText } from '../components/AppText';
import { useTranslation } from '../providers/MobileI18nProvider';
import type { LegalPolicyKey } from '@hellowhen/i18n';
import { DEFAULT_NORMAL_APP_NAV_MOBILE_TAB_NAME, getNormalAppNavItemByMobileTabName, normalAppNavItems, type NormalAppNavItemId } from '@hellowhen/shared';
import type { ThemeTokens } from '@hellowhen/theme';

type InventoryCreateReturnTarget = 'createTrade' | 'createTradeFull' | 'tradeProposal' | 'proposalDetail';
type InventoryCreateParams = { returnTo?: InventoryCreateReturnTarget; tradeId?: string; tradeTitle?: string; proposalId?: string; proposalNeedId?: string; proposalOfferId?: string; initialTemplateKey?: string; initialIdeaKey?: FeedTradeIdeaKey | null; initialPostType?: TradePostType | null; initialNeedSelection?: TradeCreateSideSelection | null; initialOfferSelection?: TradeCreateSideSelection | null; initialExpiryDays?: number | null } | undefined;

export type RootStackParamList = {
  TradeTabs: undefined;
  MyNeeds: undefined;
  MyOffers: undefined;
  AccountProfile: undefined;
  Notifications: undefined;
  SavedLibrary: undefined;
  Agenda: undefined;
  Plans: { filters?: string[]; q?: string } | undefined;
  PlanFilters: { filters?: string[]; q?: string } | undefined;
  PlanDetail: { planId: string; title?: string };
  PlanIdeaDetail: { ideaId: string };
  PlanPublicDiscussion: { planId: string; title?: string };
  MyPlans: undefined;
  JoinedPlans: undefined;
  MyPlaces: undefined;
  PlaceLibrary: undefined;
  CreatePlan: { createdPlace?: PlaceDto; createdPlaceTargetIndex?: number; createdPlaceNonce?: number; updatedPlace?: PlaceDto; updatedPlaceTargetIndex?: number; updatedPlaceNonce?: number; updatedPlaceSelectAfterFix?: boolean; initialPlanIdeaKey?: string } | undefined;
  CreatePlace: { returnToCreatePlan?: boolean; editPlace?: PlaceDto; copyFromPlace?: PlaceDto; targetPlaceIndex?: number; selectPlaceAfterSave?: boolean } | undefined;
  SavedLibraryCollection: { collectionId: string; title?: string };
  Membership: undefined;
  ProPlans: undefined;
  Wallet: undefined;
  Payouts: undefined;
  Settings: undefined;
  SecurityPassword: undefined;
  TwoFactorSecurity: undefined;
  BusinessAccounts: undefined;
  BuyCredits: undefined;
  SupportCenter: undefined;
  AccountDeletion: undefined;
  SupportTicketDetail: { ticketId: string; subject?: string };
  LegalPolicy: { policy?: LegalPolicyKey } | undefined;
  CreateNeed: InventoryCreateParams;
  CreateNeedFull: InventoryCreateParams;
  NeedDetail: { needId: string; title?: string };
  CreateOffer: InventoryCreateParams;
  CreateOfferFull: InventoryCreateParams;
  OfferDetail: { offerId: string; title?: string };
  CreateTrade: TradeCreateReturnParams;
  CreateTradeFull: TradeCreateReturnParams;
  TradeSidePicker: TradeSidePickerParams;
  CreateProposal: { tradeId: string; title?: string };
  ProposalDetail: { proposalId: string; selectedProposalSide?: TradeCreateSideSelection; selectedProposalNeedId?: string; selectedProposalOfferId?: string };
  TradePublicDiscussion: { tradeId: string; title?: string };
  TradePrivateProposals: { tradeId: string; title?: string; status?: string; selectedProposalSide?: TradeCreateSideSelection; selectedProposalNeedId?: string; selectedProposalOfferId?: string };
  TradeDetail: { tradeId: string; title?: string; description?: string; amountCents?: number; currency?: string; creditAmount?: number; status?: string; expiresAt?: string | null; selectedProposalSide?: TradeCreateSideSelection; selectedProposalNeedId?: string; selectedProposalOfferId?: string };
  TradeIdeaDetail: { ideaId: string };
  UserProfile: { userId: string; displayName?: string };
  GuideHub: undefined;
  OnboardingGuide: { replay?: boolean; guide?: OnboardingGuideType } | undefined;
  Login: undefined;
};

type MainTabParamList = Record<typeof normalAppNavItems[number]['mobileTabName'], undefined>;

const Tabs = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthRequiredNotice({ titleKey, bodyKey }: { titleKey?: string; bodyKey?: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const displayTitle = t(titleKey ?? 'navigation.authRequired.default.title');
  const displayBody = t(bodyKey ?? 'navigation.authRequired.default.body');

  return (
    <AppScreen>
      <View style={styles.authRequiredShell}>
        <AppCard style={styles.authRequiredCard}>
          <MobileIcon name="profile" size={30} color={theme.color.text} />
          <AppText style={styles.authRequiredTitle}>{displayTitle}</AppText>
          <AppText style={[styles.authRequiredBody, { color: theme.color.muted }]}>{displayBody}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.authRequiredButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}
          >
            <AppText style={[styles.authRequiredButtonText, { color: theme.color.background }]}>{t('common.actions.loginOrRegister')}</AppText>
          </Pressable>
        </AppCard>
      </View>
    </AppScreen>
  );
}

function withAuth<P extends object>(Component: React.ComponentType<P>, titleKey?: string, bodyKey?: string) {
  function ProtectedScreen(props: P) {
    const auth = useAuth();
    if (!auth.isAuthenticated) return <AuthRequiredNotice titleKey={titleKey} bodyKey={bodyKey} />;
    return <Component {...props} />;
  }
  return ProtectedScreen;
}

const ProtectedMyNeedsScreen = withAuth(MyNeedsScreen, 'navigation.authRequired.manageNeeds.title', 'navigation.authRequired.manageNeeds.body');
const ProtectedMyOffersScreen = withAuth(MyOffersScreen, 'navigation.authRequired.manageOffers.title', 'navigation.authRequired.manageOffers.body');
const ProtectedAccountScreen = withAuth(AccountScreen, 'navigation.authRequired.account.title', 'navigation.authRequired.account.body');
const ProtectedProfileScreen = withAuth(ProfileScreen);
const ProtectedNotificationsScreen = withAuth(NotificationsScreen);
const ProtectedSavedLibraryScreen = withAuth(SavedLibraryScreen);
const ProtectedAgendaScreen = withAuth(AgendaScreen);
const ProtectedPlanPublicDiscussionScreen = withAuth(PlanPublicDiscussionScreen, 'navigation.authRequired.planDiscussion.title', 'navigation.authRequired.planDiscussion.body');
const ProtectedMyPlansScreen = withAuth(MyPlansScreen);
const ProtectedJoinedPlansScreen = withAuth(JoinedPlansScreen);
const ProtectedMyPlacesScreen = withAuth(MyPlacesScreen);
const ProtectedPlaceLibraryScreen = withAuth(PlaceLibraryScreen);
const ProtectedCreatePlanScreen = withAuth(CreatePlanScreen, 'navigation.authRequired.createPlan.title', 'navigation.authRequired.createPlan.body');
const ProtectedCreatePlaceScreen = withAuth(CreatePlaceScreen, 'navigation.authRequired.createPlace.title', 'navigation.authRequired.createPlace.body');
const ProtectedSavedCollectionDetailScreen = withAuth(SavedCollectionDetailScreen);
const ProtectedMembershipScreen = withAuth(MembershipScreen);
const ProtectedPlanSelectionScreen = withAuth(PlanSelectionScreen);
const ProtectedWalletScreen = withAuth(WalletScreen);
const ProtectedPayoutsScreen = withAuth(PayoutsScreen);
const ProtectedSettingsScreen = withAuth(SettingsScreen);
const ProtectedSecurityPasswordScreen = withAuth(SecurityPasswordScreen);
const ProtectedTwoFactorSecurityScreen = withAuth(TwoFactorSecurityScreen);
const ProtectedBusinessAccountsScreen = withAuth(BusinessAccountsScreen);
const ProtectedBuyCreditsScreen = withAuth(BuyCreditsScreen);
const ProtectedSupportCenterScreen = withAuth(SupportCenterScreen);
const ProtectedAccountDeletionScreen = withAuth(AccountDeletionScreen);
const ProtectedSupportTicketDetailScreen = withAuth(SupportTicketDetailScreen);
const ProtectedCreateNeedScreen = withAuth(CreateNeedScreen, 'navigation.authRequired.createNeed.title', 'navigation.authRequired.createNeed.body');
const ProtectedCreateNeedFullScreen = withAuth(CreateNeedFullScreen, 'navigation.authRequired.createNeed.title', 'navigation.authRequired.createNeed.body');
const ProtectedNeedDetailScreen = withAuth(NeedDetailScreen);
const ProtectedCreateOfferScreen = withAuth(CreateOfferScreen, 'navigation.authRequired.createOffer.title', 'navigation.authRequired.createOffer.body');
const ProtectedCreateOfferFullScreen = withAuth(CreateOfferFullScreen, 'navigation.authRequired.createOffer.title', 'navigation.authRequired.createOffer.body');
const ProtectedOfferDetailScreen = withAuth(OfferDetailScreen);
const ProtectedCreateTradeScreen = withAuth(CreateTradeScreen, 'navigation.authRequired.createTrade.title', 'navigation.authRequired.createTrade.body');
const ProtectedCreateTradeFullScreen = withAuth(CreateTradeFullScreen, 'navigation.authRequired.createTrade.title', 'navigation.authRequired.createTrade.body');
const ProtectedTradeSidePickerScreen = withAuth(TradeSidePickerScreen);
const ProtectedCreateProposalScreen = withAuth(CreateProposalScreen, 'navigation.authRequired.sendProposal.title', 'navigation.authRequired.sendProposal.body');
const ProtectedProposalDetailScreen = withAuth(ProposalDetailScreen);
const ProtectedTradePublicDiscussionScreen = withAuth(TradePublicDiscussionScreen, 'navigation.authRequired.tradeDiscussion.title', 'navigation.authRequired.tradeDiscussion.body');
const ProtectedTradePrivateProposalsScreen = withAuth(TradePrivateProposalsScreen, 'navigation.authRequired.privateProposals.title', 'navigation.authRequired.privateProposals.body');

function MeHomeScreen() {
  const auth = useAuth();
  return auth.isAuthenticated ? <AccountScreen /> : <LoginScreen />;
}

function getTabIconName(routeName: keyof MainTabParamList): MobileIconName {
  return getNormalAppNavItemByMobileTabName(routeName)?.icon ?? 'profile';
}

function getTabBadge(count: number) {
  return count > 0 ? Math.min(count, 99) : undefined;
}

function getNormalTabActiveTintColor(routeName: keyof MainTabParamList, theme: ThemeTokens) {
  const normalNavItem = getNormalAppNavItemByMobileTabName(routeName);
  if (normalNavItem?.id === 'plans') return theme.semantic.plan.bg;
  if (normalNavItem?.id === 'trade') return theme.semantic.trade.bg;
  return theme.color.text;
}

function getNormalTabPillBackgroundColor(routeName: keyof MainTabParamList, theme: ThemeTokens) {
  const normalNavItem = getNormalAppNavItemByMobileTabName(routeName);
  if (normalNavItem?.id === 'plans') return theme.semantic.plan.softBg;
  if (normalNavItem?.id === 'trade') return theme.semantic.trade.softBg;
  if (normalNavItem?.id === 'me') return theme.color.subtleSurface;
  return 'transparent';
}

const normalMobileTabScreenById: Record<NormalAppNavItemId, React.ComponentType<any>> = {
  plans: PlansScreen,
  me: MeHomeScreen,
  trade: TradeDeckFeedScreen,
};

function TradeTabs() {
  const insets = useSafeAreaInsets();
  const theme = useThemeTokens();
  const auth = useAuth();
  const bottomInset = Math.max(insets.bottom, 0);
  const { t } = useTranslation();
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  const loadNotificationUnreadCount = useCallback(async () => {
    if (!auth.isAuthenticated) { setNotificationUnreadCount(0); return; }
    try {
      const response = await api.notifications.unreadCount();
      setNotificationUnreadCount(response.unreadCount ?? 0);
    } catch {
      setNotificationUnreadCount(0);
    }
  }, [auth.isAuthenticated]);

  useFocusEffect(useCallback(() => { void loadNotificationUnreadCount(); }, [loadNotificationUnreadCount]));

  return (
    <Tabs.Navigator
      initialRouteName={DEFAULT_NORMAL_APP_NAV_MOBILE_TAB_NAME}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarIcon: ({ color, size, focused }) => {
          const icon = <MobileIcon name={getTabIconName(route.name)} size={Math.max(size, 21)} color={color} />;
          return (
            <View style={[styles.normalTabIconPill, focused && { backgroundColor: getNormalTabPillBackgroundColor(route.name, theme) }]}>
              {icon}
            </View>
          );
        },
        tabBarIconStyle: styles.normalTabIcon,
        tabBarLabelStyle: styles.normalTabLabel,
        tabBarItemStyle: styles.normalTabItem,
        tabBarStyle: [
          styles.tabBar,
          styles.normalAppTabBar,
          {
            height: 70 + bottomInset,
            paddingBottom: bottomInset || 8,
            borderTopColor: theme.color.border,
            backgroundColor: theme.color.surface,
          },
        ],
        tabBarActiveTintColor: getNormalTabActiveTintColor(route.name, theme),
        tabBarInactiveTintColor: theme.color.muted,
        tabBarBadgeStyle: styles.tabBadge,
      })}
    >
      {normalAppNavItems.map((item) => (
        <Tabs.Screen
          key={item.id}
          name={item.mobileTabName}
          component={normalMobileTabScreenById[item.id]}
          options={{
            tabBarLabel: t(item.labelKey),
            tabBarBadge: item.id === 'me' ? getTabBadge(notificationUnreadCount) : undefined,
          }}
        />
      ))}
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const auth = useAuth();
  const theme = useThemeTokens();

  if (!auth.hydrated) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.background }}><ActivityIndicator /></View>;
  }

  return (
    <Stack.Navigator initialRouteName="TradeTabs" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TradeTabs" component={TradeTabs} />
      <Stack.Screen name="TradeDetail" component={TradeDetailScreen} />
      <Stack.Screen name="MyNeeds" component={ProtectedMyNeedsScreen} />
      <Stack.Screen name="MyOffers" component={ProtectedMyOffersScreen} />
      <Stack.Screen name="TradeIdeaDetail" component={TradeIdeaDetailScreen} />
      <Stack.Screen name="UserProfile" component={PublicUserProfileScreen} />
      <Stack.Screen name="GuideHub" component={GuideHubScreen} />
      <Stack.Screen name="OnboardingGuide" component={OnboardingGuideScreen} initialParams={{ replay: false }} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="LegalPolicy" component={LegalPolicyScreen} />
      <Stack.Screen name="AccountProfile" component={ProtectedProfileScreen} />
      <Stack.Screen name="Notifications" component={ProtectedNotificationsScreen} />
      <Stack.Screen name="SavedLibrary" component={ProtectedSavedLibraryScreen} />
      <Stack.Screen name="Agenda" component={ProtectedAgendaScreen} />
      {betaFeatures.plansEnabled ? <Stack.Screen name="Plans" component={PlansScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="PlanFilters" component={PlanFiltersScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="PlanDetail" component={PlanDetailScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="PlanIdeaDetail" component={PlanIdeaDetailScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="PlanPublicDiscussion" component={ProtectedPlanPublicDiscussionScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="MyPlans" component={ProtectedMyPlansScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="JoinedPlans" component={ProtectedJoinedPlansScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="MyPlaces" component={ProtectedMyPlacesScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="PlaceLibrary" component={ProtectedPlaceLibraryScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="CreatePlan" component={ProtectedCreatePlanScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="CreatePlace" component={ProtectedCreatePlaceScreen} /> : null}
      <Stack.Screen name="SavedLibraryCollection" component={ProtectedSavedCollectionDetailScreen} />
      {betaFeatures.mobileMembershipVisible ? <Stack.Screen name="Membership" component={ProtectedMembershipScreen} /> : null}
      {betaFeatures.plusSubscriptionFeatures.plusPublic ? <Stack.Screen name="ProPlans" component={ProtectedPlanSelectionScreen} /> : null}
      {betaFeatures.walletVisible ? <Stack.Screen name="Wallet" component={ProtectedWalletScreen} /> : null}
      {betaFeatures.payoutsVisible ? <Stack.Screen name="Payouts" component={ProtectedPayoutsScreen} /> : null}
      <Stack.Screen name="Settings" component={ProtectedSettingsScreen} />
      <Stack.Screen name="SecurityPassword" component={ProtectedSecurityPasswordScreen} />
      <Stack.Screen name="TwoFactorSecurity" component={ProtectedTwoFactorSecurityScreen} />
      {betaFeatures.businessAccountsVisible ? <Stack.Screen name="BusinessAccounts" component={ProtectedBusinessAccountsScreen} /> : null}
      {betaFeatures.walletVisible ? <Stack.Screen name="BuyCredits" component={ProtectedBuyCreditsScreen} /> : null}
      <Stack.Screen name="SupportCenter" component={ProtectedSupportCenterScreen} />
      <Stack.Screen name="AccountDeletion" component={ProtectedAccountDeletionScreen} />
      <Stack.Screen name="SupportTicketDetail" component={ProtectedSupportTicketDetailScreen} />
      <Stack.Screen name="CreateNeed" component={ProtectedCreateNeedScreen} />
      <Stack.Screen name="CreateNeedFull" component={ProtectedCreateNeedFullScreen} />
      <Stack.Screen name="NeedDetail" component={ProtectedNeedDetailScreen} />
      <Stack.Screen name="CreateOffer" component={ProtectedCreateOfferScreen} />
      <Stack.Screen name="CreateOfferFull" component={ProtectedCreateOfferFullScreen} />
      <Stack.Screen name="OfferDetail" component={ProtectedOfferDetailScreen} />
      <Stack.Screen name="CreateTrade" component={ProtectedCreateTradeScreen} />
      <Stack.Screen name="CreateTradeFull" component={ProtectedCreateTradeFullScreen} />
      <Stack.Screen name="TradeSidePicker" component={ProtectedTradeSidePickerScreen} />
      <Stack.Screen name="CreateProposal" component={ProtectedCreateProposalScreen} />
      <Stack.Screen name="TradePublicDiscussion" component={ProtectedTradePublicDiscussionScreen} />
      <Stack.Screen name="TradePrivateProposals" component={ProtectedTradePrivateProposalsScreen} />
      <Stack.Screen name="ProposalDetail" component={ProtectedProposalDetailScreen} />
    </Stack.Navigator>
  );
}


const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
  },
  normalAppTabBar: {
    paddingTop: 8,
  },
  normalTabItem: {
    paddingTop: 2,
  },
  normalTabIcon: {
    marginTop: 1,
  },
  normalTabIconPill: {
    minWidth: 42,
    minHeight: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  normalTabLabel: {
    fontWeight: '900',
    fontSize: 12,
    lineHeight: 15,
    paddingBottom: 7,
  },
  tabBadge: {
    fontWeight: '900',
    fontSize: 10,
    minWidth: 18,
    minHeight: 18,
    lineHeight: 14,
  },
  authRequiredShell: { flex: 1, justifyContent: 'center', paddingVertical: 36 },
  authRequiredCard: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  authRequiredTitle: { fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  authRequiredBody: { fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  authRequiredButton: { minHeight: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
  authRequiredButtonText: { fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
