import React from 'react';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

export function CreateNeedScreen() {
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>Create Need</AppText>
        <AppText>Patch 1 placeholder. Needs are private to owner.</AppText>
      </AppCard>
    </AppScreen>
  );
}
