import React from 'react';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

export function CreateOfferScreen() {
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>Create Offer</AppText>
        <AppText>Patch 1 placeholder. Offers are private to owner.</AppText>
      </AppCard>
    </AppScreen>
  );
}
