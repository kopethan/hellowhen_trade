import React from 'react';
import { Button, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { formatCredits } from '@zizilia/shared';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { FeedTrade } from './mockTrades';

export function TradeDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const trade = route.params?.trade as FeedTrade | undefined;

  return (
    <AppScreen>
      <AppCard>
        <View style={styles.topRow}>
          <AppText style={styles.badge}>{trade?.status ?? 'active'}</AppText>
          <AppText style={styles.expiration}>{trade?.expiresAt ? `Expires ${new Date(trade.expiresAt).toLocaleDateString()}` : 'Expiration not set'}</AppText>
        </View>
        <AppText style={styles.title}>{trade?.title ?? 'Trade Detail'}</AppText>
        <AppText style={styles.description}>
          {trade?.description ?? 'Public detail page for an active trade.'}
        </AppText>
        <View style={styles.creditBox}>
          <AppText style={styles.creditAmount}>{formatCredits(trade?.creditAmount ?? 0)}</AppText>
          <AppText style={styles.creditNote}>Fake test credits only</AppText>
        </View>
        <Button title="Back to Feed" onPress={() => navigation.goBack()} />
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  badge: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  expiration: {
    color: '#64748B',
    flexShrink: 1
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    marginTop: 12
  },
  description: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10
  },
  creditBox: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    marginTop: 18,
    marginBottom: 8
  },
  creditAmount: {
    fontSize: 30,
    fontWeight: '900'
  },
  creditNote: {
    color: '#64748B',
    marginTop: 4
  }
});
