import React from 'react';
import { ScrollView } from 'react-native';
import { formatCredits } from '@zizilia/shared';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

const demoTrades = [
  { id: '1', title: 'Need help editing a short launch video', description: 'Polish a 45-second launch video for social.', credits: 25 },
  { id: '2', title: 'Offer: landing page copy review', description: 'Quick copy feedback and structure notes.', credits: 15 },
];

export function TradeFeedScreen() {
  return (
    <AppScreen>
      <ScrollView>
        <AppText style={{ fontSize: 32, fontWeight: '800', marginBottom: 12 }}>Trade Feed</AppText>
        {demoTrades.map((trade) => (
          <AppCard key={trade.id}>
            <AppText style={{ fontSize: 20, fontWeight: '800' }}>{trade.title}</AppText>
            <AppText style={{ marginTop: 8 }}>{trade.description}</AppText>
            <AppText style={{ marginTop: 12, fontWeight: '700' }}>{formatCredits(trade.credits)}</AppText>
          </AppCard>
        ))}
      </ScrollView>
    </AppScreen>
  );
}
