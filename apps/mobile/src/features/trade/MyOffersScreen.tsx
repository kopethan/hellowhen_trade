import React from 'react';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

export function MyOffersScreen() {
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>My Offers</AppText>
        <AppText>Private owner list for offers. Offers can later be used to create public trades.</AppText>
      </AppCard>
    </AppScreen>
  );
}
