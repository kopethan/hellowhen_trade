import React from 'react';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

export function MyTradesScreen() {
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>My Trades</AppText>
        <AppText>Private owner management for needs, offers, active trades, closed trades, and expired trades.</AppText>
      </AppCard>
    </AppScreen>
  );
}
