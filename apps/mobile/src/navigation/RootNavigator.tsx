import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountScreen } from '../features/account/AccountScreen';
import { AccountDeletionScreen } from '../features/account/AccountDeletionScreen';
import { BusinessAccountsScreen } from '../features/account/BusinessAccountsScreen';
import { BuyCreditsScreen } from '../features/account/BuyCreditsScreen';
import { SupportCenterScreen } from '../features/account/SupportCenterScreen';
import { SupportTicketDetailScreen } from '../features/account/SupportTicketDetailScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { LegalPolicyScreen } from '../features/legal/LegalPolicyScreen';
import { ProfileScreen } from '../features/me/MeScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { SecurityPasswordScreen } from '../features/settings/SecurityPasswordScreen';
import { TwoFactorSecurityScreen } from '../features/settings/TwoFactorSecurityScreen';
import { PublicUserProfileScreen } from '../features/users/PublicUserProfileScreen';
import { CreateNeedScreen } from '../features/trade/CreateNeedScreen';
import { CreateOfferScreen } from '../features/trade/CreateOfferScreen';
import { CreateProposalScreen } from '../features/trade/CreateProposalScreen';
import { CreateTradeScreen, type TradeCreateReturnParams, type TradeCreateSideSelection, type TradeSidePickerParams } from '../features/trade/CreateTradeScreen';
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
import { WalletScreen } from '../features/wallet/WalletScreen';
import { PayoutsScreen } from '../features/wallet/PayoutsScreen';
import { useAuth } from '../providers/AuthProvider';
import { useThemeTokens } from '../providers/ThemeProvider';
import { MobileIcon, type MobileIconName } from '../components/MobileIcon';
import { betaFeatures } from '../lib/betaFeatures';
import { AppCard } from '../components/AppCard';
import { AppScreen } from '../components/AppScreen';
import { AppText } from '../components/AppText';
import { useTranslation } from '../providers/MobileI18nProvider';
import type { LegalPolicyKey } from '@hellowhen/i18n';

export type RootStackParamList = {
  TradeTabs: undefined;
  AccountProfile: undefined;
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
  CreateNeed: { returnTo?: 'createTrade' | 'tradeProposal' | 'proposalDetail'; tradeId?: string; tradeTitle?: string; proposalId?: string; proposalNeedId?: string; proposalOfferId?: string } | undefined;
  NeedDetail: { needId: string; title?: string };
  CreateOffer: { returnTo?: 'createTrade' | 'tradeProposal' | 'proposalDetail'; tradeId?: string; tradeTitle?: string; proposalId?: string; proposalNeedId?: string; proposalOfferId?: string } | undefined;
  OfferDetail: { offerId: string; title?: string };
  CreateTrade: TradeCreateReturnParams;
  TradeSidePicker: TradeSidePickerParams;
  CreateProposal: { tradeId: string; title?: string };
  ProposalDetail: { proposalId: string; selectedProposalSide?: TradeCreateSideSelection; selectedProposalNeedId?: string; selectedProposalOfferId?: string };
  TradePublicDiscussion: { tradeId: string; title?: string };
  TradePrivateProposals: { tradeId: string; title?: string; status?: string; selectedProposalSide?: TradeCreateSideSelection; selectedProposalNeedId?: string; selectedProposalOfferId?: string };
  TradeDetail: { tradeId: string; title?: string; description?: string; amountCents?: number; currency?: string; creditAmount?: number; status?: string; expiresAt?: string | null; selectedProposalSide?: TradeCreateSideSelection; selectedProposalNeedId?: string; selectedProposalOfferId?: string };
  UserProfile: { userId: string; displayName?: string };
  Login: undefined;
};

type MainTabParamList = { Trades: undefined; Needs: undefined; Offers: undefined; Account: undefined };

const Tabs = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthRequiredNotice({ title, body }: { title?: string; body?: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const displayTitle = title ?? 'Login required';
  const displayBody = body ?? 'Sign in to continue with your saved needs, offers, proposals, wallet, and account settings.';

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
const ProtectedAccountScreen = withAuth(AccountScreen, 'Login to open account', 'Sign in to access profile, settings, wallet, support, and beta account tools.');
const ProtectedProfileScreen = withAuth(ProfileScreen);
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
const ProtectedNeedDetailScreen = withAuth(NeedDetailScreen);
const ProtectedCreateOfferScreen = withAuth(CreateOfferScreen, 'Login to create an offer', 'Create offers after signing in so they stay attached to your account.');
const ProtectedOfferDetailScreen = withAuth(OfferDetailScreen);
const ProtectedCreateTradeScreen = withAuth(CreateTradeScreen, 'Login to create a trade', 'Browse the public feed now. Sign in when you are ready to publish a trade.');
const ProtectedTradeSidePickerScreen = withAuth(TradeSidePickerScreen);
const ProtectedCreateProposalScreen = withAuth(CreateProposalScreen, 'Login to send a proposal', 'Proposal messages are private, so you need an account before asking to trade.');
const ProtectedProposalDetailScreen = withAuth(ProposalDetailScreen);
const ProtectedTradePublicDiscussionScreen = withAuth(TradePublicDiscussionScreen, 'Login to view public discussion', 'Public discussion is available to logged-in members so moderation stays accountable.');
const ProtectedTradePrivateProposalsScreen = withAuth(TradePrivateProposalsScreen, 'Login to view private proposals', 'Private proposal conversations are visible only to the trade owner and each applicant.');

function getTabIconName(routeName: keyof MainTabParamList): MobileIconName {
  if (routeName === 'Trades') return 'trade';
  if (routeName === 'Needs') return 'need';
  if (routeName === 'Offers') return 'offer';
  return 'profile';
}

function TradeTabs() {
  const insets = useSafeAreaInsets();
  const theme = useThemeTokens();
  const bottomInset = Math.max(insets.bottom, 0);
  const { t } = useTranslation();

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
      <Tabs.Screen name="Trades" component={TradeDeckFeedScreen} options={{ tabBarLabel: t('navigation.tabs.trades') }} />
      <Tabs.Screen name="Needs" component={ProtectedMyNeedsScreen} options={{ tabBarLabel: t('navigation.tabs.needs') }} />
      <Tabs.Screen name="Offers" component={ProtectedMyOffersScreen} options={{ tabBarLabel: t('navigation.tabs.offers') }} />
      <Tabs.Screen name="Account" component={ProtectedAccountScreen} options={{ tabBarLabel: t('navigation.tabs.account') }} />
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
      <Stack.Screen name="UserProfile" component={PublicUserProfileScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="LegalPolicy" component={LegalPolicyScreen} />
      <Stack.Screen name="AccountProfile" component={ProtectedProfileScreen} />
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
      <Stack.Screen name="NeedDetail" component={ProtectedNeedDetailScreen} />
      <Stack.Screen name="CreateOffer" component={ProtectedCreateOfferScreen} />
      <Stack.Screen name="OfferDetail" component={ProtectedOfferDetailScreen} />
      <Stack.Screen name="CreateTrade" component={ProtectedCreateTradeScreen} />
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
