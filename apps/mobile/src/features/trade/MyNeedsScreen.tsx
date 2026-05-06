import React from 'react';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

export function MyNeedsScreen() {
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>My Needs</AppText>
        <AppText>Private owner list for needs. Other users do not browse needs directly in the MVP.</AppText>
      </AppCard>
    </AppScreen>
  );
}
