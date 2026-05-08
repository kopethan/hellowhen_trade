import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { SemanticBadge } from '../../components/SemanticUI';

export function TradeFeedScreen() {
  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SemanticBadge label="Trades" tone="trade" />
        <AppText style={styles.title}>Trades</AppText>
        <AppCard>
          <AppText style={styles.cardTitle}>Open the Trades tab</AppText>
          <AppText style={styles.cardText}>Browse the square trade decks from the main Trades screen.</AppText>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30, gap: 14 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  cardTitle: { fontSize: 22, fontWeight: '900' },
  cardText: { color: '#64748B', lineHeight: 20, fontWeight: '600' },
});
