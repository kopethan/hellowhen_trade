import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountScreen } from '../features/account/AccountScreen';
import { BuyCreditsScreen } from '../features/account/BuyCreditsScreen';
import { SupportCenterScreen } from '../features/account/SupportCenterScreen';
import { SupportTicketDetailScreen } from '../features/account/SupportTicketDetailScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ProfileScreen } from '../features/me/MeScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { CreateNeedScreen } from '../features/trade/CreateNeedScreen';
import { CreateOfferScreen } from '../features/trade/CreateOfferScreen';
import { CreateProposalScreen } from '../features/trade/CreateProposalScreen';
import { CreateTradeScreen, type TradeCreateReturnParams, type TradeSidePickerParams } from '../features/trade/CreateTradeScreen';
import { TradeSidePickerScreen } from '../features/trade/TradeSidePickerScreen';
import { MyNeedsScreen } from '../features/trade/MyNeedsScreen';
import { NeedDetailScreen } from '../features/trade/NeedDetailScreen';
import { MyOffersScreen } from '../features/trade/MyOffersScreen';
import { OfferDetailScreen } from '../features/trade/OfferDetailScreen';
import { ProposalDetailScreen } from '../features/trade/ProposalDetailScreen';
import { TradeDeckFeedScreen } from '../features/trade/TradeDeckFeedScreen';
import { TradeDetailScreen } from '../features/trade/TradeDetailScreen';
import { WalletScreen } from '../features/wallet/WalletScreen';
import { PayoutsScreen } from '../features/wallet/PayoutsScreen';
import { useAuth } from '../providers/AuthProvider';
import { useThemeTokens } from '../providers/ThemeProvider';

export type RootStackParamList = {
  TradeTabs: undefined;
  AccountProfile: undefined;
  Wallet: undefined;
  Payouts: undefined;
  Settings: undefined;
  BuyCredits: undefined;
  SupportCenter: undefined;
  SupportTicketDetail: { ticketId: string; subject?: string };
  CreateNeed: undefined;
  NeedDetail: { needId: string; title?: string };
  CreateOffer: undefined;
  OfferDetail: { offerId: string; title?: string };
  CreateTrade: TradeCreateReturnParams;
  TradeSidePicker: TradeSidePickerParams;
  CreateProposal: { tradeId: string; title?: string };
  ProposalDetail: { proposalId: string };
  TradeDetail: { tradeId: string; title?: string; description?: string; amountCents?: number; currency?: string; creditAmount?: number; status?: string; expiresAt?: string | null };
  Login: undefined;
};

type MainTabParamList = { Trades: undefined; Needs: undefined; Offers: undefined; Account: undefined };

const Tabs = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TradeTabs() {
  const insets = useSafeAreaInsets();
  const theme = useThemeTokens();
  const bottomInset = Math.max(insets.bottom, 0);

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontWeight: '900', fontSize: 12, paddingBottom: 8 },
        tabBarItemStyle: { paddingTop: 8 },
        tabBarStyle: { height: 58 + bottomInset, paddingBottom: bottomInset, borderTopColor: theme.color.border, backgroundColor: theme.color.surface },
        tabBarActiveTintColor: theme.semantic.proposal.bg,
        tabBarInactiveTintColor: theme.color.muted,
      }}
    >
      <Tabs.Screen name="Trades" component={TradeDeckFeedScreen} />
      <Tabs.Screen name="Needs" component={MyNeedsScreen} />
      <Tabs.Screen name="Offers" component={MyOffersScreen} />
      <Tabs.Screen name="Account" component={AccountScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const auth = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {auth.isAuthenticated ? (
        <>
          <Stack.Screen name="TradeTabs" component={TradeTabs} />
          <Stack.Screen name="AccountProfile" component={ProfileScreen} />
          <Stack.Screen name="Wallet" component={WalletScreen} />
          <Stack.Screen name="Payouts" component={PayoutsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="BuyCredits" component={BuyCreditsScreen} />
          <Stack.Screen name="SupportCenter" component={SupportCenterScreen} />
          <Stack.Screen name="SupportTicketDetail" component={SupportTicketDetailScreen} />
          <Stack.Screen name="CreateNeed" component={CreateNeedScreen} />
          <Stack.Screen name="NeedDetail" component={NeedDetailScreen} />
          <Stack.Screen name="CreateOffer" component={CreateOfferScreen} />
          <Stack.Screen name="OfferDetail" component={OfferDetailScreen} />
          <Stack.Screen name="CreateTrade" component={CreateTradeScreen} />
          <Stack.Screen name="TradeSidePicker" component={TradeSidePickerScreen} />
          <Stack.Screen name="CreateProposal" component={CreateProposalScreen} />
          <Stack.Screen name="ProposalDetail" component={ProposalDetailScreen} />
          <Stack.Screen name="TradeDetail" component={TradeDetailScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
