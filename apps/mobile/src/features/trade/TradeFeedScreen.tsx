import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { SemanticBadge } from '../../components/SemanticUI';
import { useTranslation } from '../../providers/MobileI18nProvider';

export function TradeFeedScreen() {
  const { t } = useTranslation();
  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SemanticBadge label={t('navigation.tabs.trades')} tone="trade" />
        <AppText style={styles.title}>{t('navigation.tabs.trades')}</AppText>
        <AppCard>
          <AppText style={styles.cardTitle}>{t('trade.deck.openTradesTab')}</AppText>
          <AppText style={styles.cardText}>{t('trade.deck.feedRedirectBody')}</AppText>
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
