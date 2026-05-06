import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../features/auth/LoginScreen';
import { CreateNeedScreen } from '../features/trade/CreateNeedScreen';
import { CreateOfferScreen } from '../features/trade/CreateOfferScreen';
import { CreateTradeScreen } from '../features/trade/CreateTradeScreen';
import { MyNeedsScreen } from '../features/trade/MyNeedsScreen';
import { MyOffersScreen } from '../features/trade/MyOffersScreen';
import { MyTradesScreen } from '../features/trade/MyTradesScreen';
import { TradeDetailScreen } from '../features/trade/TradeDetailScreen';
import { TradeFeedScreen } from '../features/trade/TradeFeedScreen';
import { MeScreen } from '../features/me/MeScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { WalletScreen } from '../features/wallet/WalletScreen';
import { useAuth } from '../providers/AuthProvider';

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TradeTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Feed" component={TradeFeedScreen} />
      <Tabs.Screen name="Create" component={CreateTradeScreen} />
      <Tabs.Screen name="Needs" component={MyNeedsScreen} options={{ title: 'My Needs' }} />
      <Tabs.Screen name="Offers" component={MyOffersScreen} options={{ title: 'My Offers' }} />
      <Tabs.Screen name="Trades" component={MyTradesScreen} options={{ title: 'My Trades' }} />
      <Tabs.Screen name="Wallet" component={WalletScreen} />
      <Tabs.Screen name="Me" component={MeScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
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
          <Stack.Screen name="CreateNeed" component={CreateNeedScreen} />
          <Stack.Screen name="CreateOffer" component={CreateOfferScreen} />
          <Stack.Screen name="TradeDetail" component={TradeDetailScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
