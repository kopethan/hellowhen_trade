import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { truncateText } from '@hellowhen/shared';
import { formatLocalizedTimeUntil, type SupportedLanguage } from '@hellowhen/i18n';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import { AppText } from '../../../components/AppText';
import { MoneyPill, SemanticBadge, StatusBadge } from '../../../components/SemanticUI';
import type { TradeDeckItem } from '../types';
import { resolveMediaVariantUrl } from '../mediaUrls';

type TFunction = ReturnType<typeof useTranslation>['t'];

type TradeDeckCardProps = {
  trade: TradeDeckItem;
  index: number;
  total: number;
  saved: boolean;
  onOpen: () => void;
  onPass: () => void;
  onSave: () => void;
};

function getTradeKind(trade: TradeDeckItem, t: TFunction): { label: string; tone: 'need' | 'offer' | 'trade' } {
  if (trade.needId) return { label: t('trade.labels.needTrade'), tone: 'need' };
  if (trade.offerId) return { label: t('trade.labels.offerTrade'), tone: 'offer' };
  return { label: t('trade.labels.publicTrade'), tone: 'trade' };
}

function getExpiryLabel(expiresAt: string | null | undefined, t: TFunction, language: SupportedLanguage) {
  return formatLocalizedTimeUntil(expiresAt, language, {
    noValue: t('trade.labels.openExpiry'),
    expired: t('trade.expiry.expired'),
    fallback: (count, unit) => unit === 'hour' ? t('trade.expiry.hoursLeft', { count }) : t('trade.expiry.daysLeft', { count }),
  });
}

export function TradeDeckCard({ trade, index, total, saved, onOpen, onPass, onSave }: TradeDeckCardProps) {
  const { t, language } = useTranslation();
  const kind = getTradeKind(trade, t);
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <SemanticBadge label={kind.label} tone={kind.tone} />
        <AppText style={styles.counter}>{index + 1}/{total}</AppText>
      </View>
      {trade.media?.[0] ? <Image source={{ uri: resolveMediaVariantUrl(trade.media[0], 'card') }} style={styles.heroImage} /> : null}
      <View style={styles.mainContent}>
        <StatusBadge status={trade.status} size="sm" />
        <AppText style={styles.title}>{trade.title}</AppText>
        <AppText style={styles.description}>{truncateText(trade.description, 190)}</AppText>
      </View>
      <View style={styles.creditPanel}>
        {(trade.amountCents ?? 0) > 0 ? <MoneyPill amountCents={trade.amountCents ?? 0} currency={trade.currency ?? 'eur'} label={t('trade.labels.optionalMoney').toLowerCase()} /> : <SemanticBadge label={t('trade.labels.serviceForService')} tone="trade" />}
      </View>
      <View style={styles.metaRow}>
        <SemanticBadge label={getExpiryLabel(trade.expiresAt, t, language)} tone="time" size="sm" />
        <SemanticBadge label={t('trade.labels.optionalMoney')} tone="info" size="sm" />
      </View>
      <View style={styles.actionsRow}>
        <Pressable accessibilityRole="button" onPress={onPass} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><AppText style={styles.secondaryButtonText}>{t('trade.deck.pass')}</AppText></Pressable>
        <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><AppText style={styles.primaryButtonText}>{t('trade.deck.openDetail')}</AppText></Pressable>
        <Pressable accessibilityRole="button" onPress={onSave} style={({ pressed }) => [styles.secondaryButton, saved && styles.savedButton, pressed && styles.pressed]}><AppText style={[styles.secondaryButtonText, saved && styles.savedButtonText]}>{saved ? t('common.states.saved') : t('common.actions.save')}</AppText></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 500, borderRadius: 34, borderWidth: 1, borderColor: '#111827', backgroundColor: '#FFFFFF', padding: 22, gap: 18, shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 5 },
  heroImage: { width: '100%', height: 138, borderRadius: 24, backgroundColor: '#E2E8F0' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  counter: { color: '#6B7280', fontWeight: '800' },
  mainContent: { flex: 1, justifyContent: 'center', gap: 12 },
  title: { fontSize: 32, lineHeight: 36, fontWeight: '900', letterSpacing: -0.8 },
  description: { color: '#475569', fontSize: 16, lineHeight: 23, fontWeight: '600' },
  creditPanel: { borderRadius: 24, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 16, gap: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  primaryButton: { flex: 1.35, minHeight: 48, borderRadius: 16, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryButtonText: { color: '#334155', fontWeight: '900' },
  savedButton: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  savedButtonText: { color: '#92400E' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
