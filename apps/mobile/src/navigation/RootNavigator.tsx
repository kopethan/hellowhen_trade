import React, { useCallback, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TradePostType } from '@hellowhen/contracts';
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
import { OnboardingGuideScreen } from '../features/onboarding-guide/OnboardingGuideScreen';
import { useOnboardingGuideCompletion } from '../features/onboarding-guide/onboardingGuideStorage';
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
import { CreatePlaceScreen, CreatePlanScreen, JoinedPlansScreen, MyPlacesScreen, MyPlansScreen, PlaceLibraryScreen, PlanDetailScreen, PlansScreen } from '../features/plans/PlansScreens';
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
  Plans: undefined;
  PlanDetail: { planId: string; title?: string };
  MyPlans: undefined;
  JoinedPlans: undefined;
  MyPlaces: undefined;
  PlaceLibrary: undefined;
  CreatePlan: undefined;
  CreatePlace: undefined;
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
  OnboardingGuide: { replay?: boolean } | undefined;
  Login: undefined;
};

type MainTabParamList = { Trades: undefined; Needs: undefined; Offers: undefined; Account: undefined; PlanTab: undefined; MeTab: undefined; TradeTab: undefined };

const Tabs = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthRequiredNotice({ title, body }: { title?: string; body?: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const displayTitle = title ?? 'Login required';
  const displayBody = body ?? 'Sign in to continue with your saved needs, offers, proposals, and account settings.';

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

function withAuth<P extends object>(Component: React.ComponentType<P>, title?: string, body?: string) {
  function ProtectedScreen(props: P) {
    const auth = useAuth();
    if (!auth.isAuthenticated) return <AuthRequiredNotice title={title} body={body} />;
    return <Component {...props} />;
  }
  return ProtectedScreen;
}

const ProtectedMyNeedsScreen = withAuth(MyNeedsScreen, 'Login to manage needs', 'The public feed is open. Sign in to create, edit, and manage your own needs.');
const ProtectedMyOffersScreen = withAuth(MyOffersScreen, 'Login to manage offers', 'The public feed is open. Sign in to create, edit, and manage your own offers.');
const ProtectedAccountScreen = withAuth(AccountScreen, 'Login to open account', 'Sign in to access your profile, settings, support, and account tools.');
const ProtectedProfileScreen = withAuth(ProfileScreen);
const ProtectedNotificationsScreen = withAuth(NotificationsScreen);
const ProtectedSavedLibraryScreen = withAuth(SavedLibraryScreen);
const ProtectedAgendaScreen = withAuth(AgendaScreen);
const ProtectedPlansScreen = withAuth(PlansScreen, 'Login to open Plans', 'Plans are joinable place-based activities, so you need an account before joining or creating them.');
const ProtectedPlanDetailScreen = withAuth(PlanDetailScreen);
const ProtectedMyPlansScreen = withAuth(MyPlansScreen);
const ProtectedJoinedPlansScreen = withAuth(JoinedPlansScreen);
const ProtectedMyPlacesScreen = withAuth(MyPlacesScreen);
const ProtectedPlaceLibraryScreen = withAuth(PlaceLibraryScreen);
const ProtectedCreatePlanScreen = withAuth(CreatePlanScreen, 'Login to create a plan', 'Create Plans after signing in so they stay attached to your account.');
const ProtectedCreatePlaceScreen = withAuth(CreatePlaceScreen, 'Login to create a place', 'Create reusable Places after signing in so they stay attached to your account.');
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
const ProtectedCreateNeedScreen = withAuth(CreateNeedScreen, 'Login to create a need', 'Create needs after signing in so they stay attached to your account.');
const ProtectedCreateNeedFullScreen = withAuth(CreateNeedFullScreen, 'Login to create a need', 'Create needs after signing in so they stay attached to your account.');
const ProtectedNeedDetailScreen = withAuth(NeedDetailScreen);
const ProtectedCreateOfferScreen = withAuth(CreateOfferScreen, 'Login to create an offer', 'Create offers after signing in so they stay attached to your account.');
const ProtectedCreateOfferFullScreen = withAuth(CreateOfferFullScreen, 'Login to create an offer', 'Create offers after signing in so they stay attached to your account.');
const ProtectedOfferDetailScreen = withAuth(OfferDetailScreen);
const ProtectedCreateTradeScreen = withAuth(CreateTradeScreen, 'Login to create a trade', 'Browse the public feed now. Sign in when you are ready to publish a trade.');
const ProtectedCreateTradeFullScreen = withAuth(CreateTradeFullScreen, 'Login to create a trade', 'Browse the public feed now. Sign in when you are ready to publish a trade.');
const ProtectedTradeSidePickerScreen = withAuth(TradeSidePickerScreen);
const ProtectedCreateProposalScreen = withAuth(CreateProposalScreen, 'Login to send a proposal', 'Proposal messages are private, so you need an account before asking to trade.');
const ProtectedProposalDetailScreen = withAuth(ProposalDetailScreen);
const ProtectedTradePublicDiscussionScreen = withAuth(TradePublicDiscussionScreen, 'Login to view public discussion', 'Public discussion is available to logged-in members so moderation stays accountable.');
const ProtectedTradePrivateProposalsScreen = withAuth(TradePrivateProposalsScreen, 'Login to view private proposals', 'Private proposal conversations are visible only to the trade owner and each applicant.');

function getTabIconName(routeName: keyof MainTabParamList): MobileIconName {
  if (routeName === 'Trades' || routeName === 'TradeTab') return 'trade';
  if (routeName === 'Needs') return 'need';
  if (routeName === 'Offers') return 'offer';
  if (routeName === 'PlanTab') return 'calendar';
  return 'profile';
}

function TradeTabs() {
  const insets = useSafeAreaInsets();
  const theme = useThemeTokens();
  const auth = useAuth();
  const bottomInset = Math.max(insets.bottom, 0);
  const { t } = useTranslation();
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const usePlansMeTradeNav = betaFeatures.mainNavPlansMeTrade;

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
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarIcon: ({ color, size }) => (
          <MobileIcon name={getTabIconName(route.name)} size={Math.max(size, 22)} color={color} />
        ),
        tabBarIconStyle: { marginTop: 6 },
        tabBarLabelStyle: { fontWeight: '900', fontSize: 12, paddingBottom: 6 },
        tabBarItemStyle: { paddingTop: 7 },
        tabBarStyle: { height: 66 + bottomInset, paddingBottom: bottomInset, borderTopColor: theme.color.border, backgroundColor: theme.color.surface },
        tabBarActiveTintColor: theme.semantic.proposal.bg,
        tabBarInactiveTintColor: theme.color.muted,
      })}
    >
      {usePlansMeTradeNav ? (
        <>
          <Tabs.Screen name="PlanTab" component={ProtectedPlansScreen} options={{ tabBarLabel: t('navigation.tabs.plans') }} />
          <Tabs.Screen name="MeTab" component={ProtectedAccountScreen} options={{ tabBarLabel: t('navigation.tabs.me'), tabBarBadge: notificationUnreadCount > 0 ? Math.min(notificationUnreadCount, 99) : undefined }} />
          <Tabs.Screen name="TradeTab" component={TradeDeckFeedScreen} options={{ tabBarLabel: t('navigation.tabs.trade') }} />
        </>
      ) : (
        <>
          <Tabs.Screen name="Trades" component={TradeDeckFeedScreen} options={{ tabBarLabel: t('navigation.tabs.trades') }} />
          <Tabs.Screen name="Needs" component={ProtectedMyNeedsScreen} options={{ tabBarLabel: t('navigation.tabs.needs') }} />
          <Tabs.Screen name="Offers" component={ProtectedMyOffersScreen} options={{ tabBarLabel: t('navigation.tabs.offers') }} />
          <Tabs.Screen name="Account" component={ProtectedAccountScreen} options={{ tabBarLabel: t('navigation.tabs.account'), tabBarBadge: notificationUnreadCount > 0 ? Math.min(notificationUnreadCount, 99) : undefined }} />
        </>
      )}
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const auth = useAuth();
  const theme = useThemeTokens();
  const onboardingGuide = useOnboardingGuideCompletion();

  if (!auth.hydrated || !onboardingGuide.hydrated) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.background }}><ActivityIndicator /></View>;
  }

  return (
    <Stack.Navigator initialRouteName={onboardingGuide.completed ? 'TradeTabs' : 'OnboardingGuide'} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TradeTabs" component={TradeTabs} />
      <Stack.Screen name="TradeDetail" component={TradeDetailScreen} />
      <Stack.Screen name="MyNeeds" component={ProtectedMyNeedsScreen} />
      <Stack.Screen name="MyOffers" component={ProtectedMyOffersScreen} />
      <Stack.Screen name="TradeIdeaDetail" component={TradeIdeaDetailScreen} />
      <Stack.Screen name="UserProfile" component={PublicUserProfileScreen} />
      <Stack.Screen name="OnboardingGuide" component={OnboardingGuideScreen} initialParams={{ replay: false }} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="LegalPolicy" component={LegalPolicyScreen} />
      <Stack.Screen name="AccountProfile" component={ProtectedProfileScreen} />
      <Stack.Screen name="Notifications" component={ProtectedNotificationsScreen} />
      <Stack.Screen name="SavedLibrary" component={ProtectedSavedLibraryScreen} />
      <Stack.Screen name="Agenda" component={ProtectedAgendaScreen} />
      {betaFeatures.plansEnabled ? <Stack.Screen name="Plans" component={ProtectedPlansScreen} /> : null}
      {betaFeatures.plansEnabled ? <Stack.Screen name="PlanDetail" component={ProtectedPlanDetailScreen} /> : null}
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
  authRequiredShell: { flex: 1, justifyContent: 'center', paddingVertical: 36 },
  authRequiredCard: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  authRequiredTitle: { fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  authRequiredBody: { fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  authRequiredButton: { minHeight: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
  authRequiredButtonText: { fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
