import React from 'react';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

export function CreateTradeScreen() {
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>Create Trade</AppText>
        <AppText>Patch 1 placeholder. Active trades become public.</AppText>
      </AppCard>
    </AppScreen>
  );
}
