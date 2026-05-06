import React from 'react';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

export function TradeDetailScreen() {
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>Trade Detail</AppText>
        <AppText>Public detail page for active trades. Owners will also see close/expire management actions later.</AppText>
      </AppCard>
    </AppScreen>
  );
}
