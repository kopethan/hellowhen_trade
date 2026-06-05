import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { betaFeatures } from '../../lib/betaFeatures';
import { formatMobilePlusMonthlyPrice, formatMobilePlusYearlyPrice, getMobilePlusGate } from '../../lib/plusGate';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProPlans'>;
type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;
type PlanCard = {
  title: string;
  price: string;
  badge?: string;
  body: string;
  bullets: string[];
  boundary?: string;
  actionLabel: string;
  featured?: boolean;
};

function bulletList(keyPrefix: string, count: number, t: TFunction, values?: Record<string, string | number | boolean | null | undefined>) {
  return Array.from({ length: count }, (_, index) => t(`${keyPrefix}.${index + 1}`, values));
}

function PlanCardView({ card }: { card: PlanCard }) {
  const theme = useThemeTokens();
  return (
    <AppCard style={[styles.planCard, card.featured ? { borderColor: theme.semantic.success.bg } : null]}>
      <View style={styles.planHeader}>
        <View style={styles.planTitleBlock}>
          {card.badge ? <SemanticBadge label={card.badge} tone={card.featured ? 'success' : 'instruction'} /> : null}
          <AppText style={styles.planTitle}>{card.title}</AppText>
          <AppText style={[styles.planBody, { color: theme.color.muted }]}>{card.body}</AppText>
        </View>
        <AppText style={styles.planPrice}>{card.price}</AppText>
      </View>
      <View style={styles.bullets}>
        {card.bullets.map((bullet) => (
          <View key={bullet} style={styles.bulletRow}>
            <AppText style={[styles.bulletMark, { color: theme.semantic.success.bg }]}>✓</AppText>
            <AppText style={styles.bulletText}>{bullet}</AppText>
          </View>
        ))}
      </View>
      {card.boundary ? <AppText style={[styles.boundary, { color: theme.color.muted, borderTopColor: theme.color.border }]}>{card.boundary}</AppText> : null}
      <Pressable accessibilityRole="button" disabled style={[styles.disabledButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
        <AppText style={[styles.disabledButtonText, { color: theme.color.muted }]}>{card.actionLabel}</AppText>
      </Pressable>
    </AppCard>
  );
}

export function PlanSelectionScreen({ navigation }: Props) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const gate = getMobilePlusGate();
  const plusPrice = formatMobilePlusMonthlyPrice(gate);
  const yearlyPrice = formatMobilePlusYearlyPrice(gate);
  const hidden = !betaFeatures.plusSubscriptionFeatures.plusPublic;

  const cards: PlanCard[] = [
    {
      title: t('account.plans.free.title'),
      price: t('account.plans.free.price'),
      body: t('account.plans.free.body'),
      bullets: bulletList('account.plans.free.bullets', 5, t, { quota: gate.entitlements.monthlyAiAssistQuota }),
      boundary: t('account.plans.free.boundary'),
      actionLabel: auth.isAuthenticated ? t('account.plans.actions.currentPlan') : t('common.actions.loginOrRegister'),
    },
    {
      title: t('account.plans.plus.title'),
      price: t('account.plans.plus.price', { price: plusPrice }),
      badge: t('account.plans.plus.badge'),
      body: t('account.plans.plus.body'),
      bullets: bulletList('account.plans.plus.bullets', 6, t, { quota: betaFeatures.plusSubscriptionFeatures.plusMonthlyAiAssistQuota }),
      boundary: t('account.plans.plus.boundary', { yearlyPrice }),
      actionLabel: t('account.plans.actions.comingLater'),
      featured: true,
    },
  ];

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('account.plans.title')} onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {hidden ? (
          <InfoNotice tone="info" title={t('account.plans.hiddenTitle')} body={t('account.plans.hiddenBody')} />
        ) : (
          <>
            <InfoNotice tone="info" title={t('account.plans.previewTitle')} body={t('account.plans.previewBody')} />
            <View style={[styles.priceStrip, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
              <AppText style={[styles.priceStripLabel, { color: theme.color.muted }]}>{t('account.plans.plus.monthlyLabel')}</AppText>
              <AppText style={styles.priceStripValue}>{plusPrice}{t('account.plans.plus.monthlySuffix')}</AppText>
              <AppText style={[styles.priceStripBody, { color: theme.color.muted }]}>{t('account.plans.plus.yearlyLater', { yearlyPrice })}</AppText>
            </View>
            {cards.map((card) => <PlanCardView key={card.title} card={card} />)}
            <InfoNotice tone="warning" title={t('account.plans.safetyTitle')} body={t('account.plans.safetyBody')} />
          </>
        )}
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  priceStrip: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 4 },
  priceStripLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  priceStripValue: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.5 },
  priceStripBody: { fontSize: 13, lineHeight: 19, fontWeight: '800' },
  planCard: { gap: 14 },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  planTitleBlock: { flex: 1, gap: 8 },
  planTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.4 },
  planPrice: { fontSize: 17, lineHeight: 23, fontWeight: '900', textAlign: 'right' },
  planBody: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  bullets: { gap: 8 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bulletMark: { fontSize: 14, lineHeight: 20, fontWeight: '900' },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  boundary: { borderTopWidth: 1, paddingTop: 12, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  disabledButton: { minHeight: 46, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  disabledButtonText: { fontSize: 14, fontWeight: '900' },
});
