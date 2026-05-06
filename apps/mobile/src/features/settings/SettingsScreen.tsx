import React from 'react';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

export function SettingsScreen() {
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>Settings</AppText>
        <AppText>Patch 1 placeholder for general, account, appearance, notifications, password, and support.</AppText>
      </AppCard>
    </AppScreen>
  );
}
