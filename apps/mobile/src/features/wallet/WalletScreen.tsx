import React from 'react';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

export function WalletScreen() {
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>Wallet / Credits</AppText>
        <AppText>Fake credits only in Patch 1. Purchased credits are not withdrawable. Earned credits become payout-eligible later.</AppText>
      </AppCard>
    </AppScreen>
  );
}
