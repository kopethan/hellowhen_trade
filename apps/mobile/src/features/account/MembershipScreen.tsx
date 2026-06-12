import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PlusSubscriptionSnapshotResponse } from '@hellowhen/contracts';
import {
  MEMBERSHIP_PRODUCT_HANDLES,
  MEMBERSHIP_PRODUCT_METADATA,
  getMembershipNativeStoreProductId,
  normalizeMembershipProductHandle,
  type MembershipProductHandle,
} from '@hellowhen/shared';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { formatMobilePlusMonthlyPrice, formatMobilePlusYearlyPrice, getMobilePlusGate } from '../../lib/plusGate';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { AndroidGooglePlayMembershipCard } from './AndroidGooglePlayMembershipCard';
import { IosStoreKitMembershipCard } from './IosStoreKitMembershipCard';
import { useThemeTokens } from '../../providers/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Membership'>;
type ProductCard = {
  handle: MembershipProductHandle;
  title: string;
  price: string;
  appleProductId: string;
  googleProductId: string;
};

type StatusTone = 'muted' | 'success' | 'warning' | 'danger' | 'info';

function formatPrice(cents: number, currency: string) {
  const normalizedCurrency = currency.toLowerCase() || 'eur';
  const locale = normalizedCurrency === 'eur' ? 'fr-FR' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: normalizedCurrency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${normalizedCurrency.toUpperCase()}`;
  }
}

function titleForTier(tier: string | undefined, t: (key: string) => string) {
  if (tier === 'pro') return t('account.mobileMembership.tiers.pro');
  if (tier === 'plus') return t('account.mobileMembership.tiers.plus');
  return t('account.mobileMembership.tiers.free');
}

function titleForStatus(status: string | undefined, t: (key: string) => string) {
  if (status === 'trialing') return t('account.mobileMembership.status.trialing');
  if (status === 'active') return t('account.mobileMembership.status.active');
  if (status === 'past_due') return t('account.mobileMembership.status.past_due');
  if (status === 'canceled') return t('account.mobileMembership.status.canceled');
  if (status === 'expired') return t('account.mobileMembership.status.expired');
  return t('account.mobileMembership.status.none');
}

function toneForStatus(status: string | undefined): StatusTone {
  if (status === 'active' || status === 'trialing') return 'success';
  if (status === 'past_due') return 'warning';
  if (status === 'canceled' || status === 'expired') return 'danger';
  return 'muted';
}

function getConfiguredProductId(handle: MembershipProductHandle, store: 'apple' | 'google') {
  const configured = betaFeatures.mobileMembershipPurchases.nativeProductIds[store][handle];
  if (configured) return configured;
  return getMembershipNativeStoreProductId(store === 'apple' ? 'apple_app_store' : 'google_play', handle) ?? handle;
}

function ProductRow({ product }: { product: ProductCard }) {
  const theme = useThemeTokens();
  return (
    <AppCard style={styles.productCard}>
      <View style={styles.productHeader}>
        <View style={styles.productTitleBlock}>
          <AppText style={styles.productTitle}>{product.title}</AppText>
          <AppText style={[styles.productHandle, { color: theme.color.muted }]}>{product.handle}</AppText>
        </View>
        <AppText style={styles.productPrice}>{product.price}</AppText>
      </View>
      <View style={[styles.productIds, { borderTopColor: theme.color.border }]}>
        <ProductIdLine label="Apple" value={product.appleProductId} />
        <ProductIdLine label="Google" value={product.googleProductId} />
      </View>
    </AppCard>
  );
}

function ProductIdLine({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.productIdLine}>
      <AppText style={[styles.productIdLabel, { color: theme.color.muted }]}>{label}</AppText>
      <AppText style={styles.productIdValue}>{value}</AppText>
    </View>
  );
}

function StorePlaceholderAction() {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const isIosPlaceholder = Platform.OS === 'ios' && betaFeatures.mobileMembershipPurchases.iosPlaceholderVisible;
  const isAndroidPlaceholder = Platform.OS === 'android' && betaFeatures.mobileMembershipPurchases.androidPlaceholderVisible;
  if (!isIosPlaceholder && !isAndroidPlaceholder) return null;

  const title = isIosPlaceholder ? t('account.mobileMembership.nativeActions.apple') : t('account.mobileMembership.nativeActions.google');
  const body = isIosPlaceholder ? t('account.mobileMembership.nativeActions.appleBody') : t('account.mobileMembership.nativeActions.googleBody');

  return (
    <AppCard style={[styles.nativeActionCard, { borderColor: theme.semantic.warning.border }]}>
      <SemanticBadge label={t('account.mobileMembership.nativeActions.placeholderBadge')} tone="warning" />
      <AppText style={styles.nativeActionTitle}>{title}</AppText>
      <AppText style={[styles.nativeActionBody, { color: theme.color.muted }]}>{body}</AppText>
      <Pressable accessibilityRole="button" disabled style={[styles.disabledButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
        <AppText style={[styles.disabledButtonText, { color: theme.color.muted }]}>{t('account.mobileMembership.nativeActions.disabled')}</AppText>
      </Pressable>
    </AppCard>
  );
}

export function MembershipScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<PlusSubscriptionSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const visible = betaFeatures.mobileMembershipVisible;

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.plus.me();
      setSnapshot(response);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (visible) void loadSnapshot();
  }, [loadSnapshot, visible]);

  const gate = getMobilePlusGate(snapshot);
  const plusMonthly = snapshot ? formatPrice(snapshot.price.monthlyCents, snapshot.price.monthlyCurrency) : formatMobilePlusMonthlyPrice(gate);
  const plusYearly = snapshot ? formatPrice(snapshot.price.yearlyCents, snapshot.price.yearlyCurrency) : formatMobilePlusYearlyPrice(gate);
  const proMonthly = formatPrice(betaFeatures.proSubscriptionFeatures.monthlyPriceCents, betaFeatures.proSubscriptionFeatures.monthlyPriceCurrency);

  const productCards = useMemo<ProductCard[]>(() => MEMBERSHIP_PRODUCT_HANDLES.map((handle) => {
    const product = MEMBERSHIP_PRODUCT_METADATA[handle];
    const normalizedHandle = normalizeMembershipProductHandle(handle) ?? handle;
    const price = product.tier === 'plus'
      ? (product.interval === 'monthly' ? plusMonthly : plusYearly)
      : (product.interval === 'monthly' ? proMonthly : t('account.mobileMembership.prices.proYearlyLater'));
    const title = t(`account.mobileMembership.products.${normalizedHandle}`);
    return {
      handle: normalizedHandle,
      title,
      price,
      appleProductId: getConfiguredProductId(normalizedHandle, 'apple'),
      googleProductId: getConfiguredProductId(normalizedHandle, 'google'),
    };
  }), [plusMonthly, plusYearly, proMonthly, t]);

  const tier = snapshot?.state.subscriptionTier;
  const status = snapshot?.state.subscriptionStatus;

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('account.mobileMembership.title')} onBack={() => navigation.goBack()} />}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSnapshot} />}
      >
        {!visible ? (
          <InfoNotice tone="info" title={t('account.mobileMembership.hiddenTitle')} body={t('account.mobileMembership.hiddenBody')} />
        ) : (
          <>
            <InfoNotice tone="info" title={t('account.mobileMembership.previewTitle')} body={t('account.mobileMembership.previewBody')} />

            <AppCard style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View style={styles.statusCopy}>
                  <SemanticBadge label={t('account.mobileMembership.currentBadge')} tone="info" />
                  <AppText style={styles.statusTitle}>{titleForTier(tier, t)}</AppText>
                  <AppText style={[styles.statusBody, { color: theme.color.muted }]}>{t('account.mobileMembership.statusBody')}</AppText>
                </View>
                <SemanticBadge label={titleForStatus(status, t)} tone={toneForStatus(status)} />
              </View>
              <View style={[styles.statusGrid, { borderTopColor: theme.color.border }]}>
                <StatusMetric label={t('account.mobileMembership.metrics.plusAccess')} value={gate.hasPlusAccess ? t('account.mobileMembership.values.available') : t('account.mobileMembership.values.notActive')} />
                <StatusMetric label={t('account.mobileMembership.metrics.aiQuota')} value={`${gate.entitlements.monthlyAiAssistQuota}`} />
                <StatusMetric label={t('account.mobileMembership.metrics.provider')} value={snapshot?.entitlement?.sourceLabel ?? snapshot?.subscriptionState?.provider ?? t('account.mobileMembership.values.none')} />
                <StatusMetric label={t('account.mobileMembership.metrics.reconciliation')} value={snapshot?.entitlement?.reconciliation?.appStateRecommendation ? t(`account.mobileMembership.reconciliation.${snapshot.entitlement.reconciliation.appStateRecommendation}`) : t('account.mobileMembership.values.none')} />
              </View>
              {error ? <InfoNotice tone="warning" title={t('account.mobileMembership.loadErrorTitle')} body={t('account.mobileMembership.loadErrorBody')} /> : null}
            </AppCard>

            <View style={styles.tierGrid}>
              <TierMiniCard title={t('account.mobileMembership.tiers.free')} badge={t('account.mobileMembership.tierBadges.basic')} body={t('account.mobileMembership.tierBodies.free')} />
              <TierMiniCard title={t('account.mobileMembership.tiers.plus')} badge={t('account.mobileMembership.tierBadges.plus')} body={t('account.mobileMembership.tierBodies.plus')} featured />
              <TierMiniCard title={t('account.mobileMembership.tiers.pro')} badge={t('account.mobileMembership.tierBadges.pro')} body={t('account.mobileMembership.tierBodies.pro')} />
            </View>

            <AppCard style={[styles.identityCard, { borderColor: theme.semantic.instruction.border }]}>
              <SemanticBadge label={t('account.mobileMembership.identity.badge')} tone="instruction" />
              <AppText style={styles.identityTitle}>{t('account.mobileMembership.identity.title')}</AppText>
              <AppText style={[styles.identityBody, { color: theme.color.muted }]}>{t('account.mobileMembership.identity.body')}</AppText>
              <View style={styles.namespaceRows}>
                <NamespacePill label={t('account.mobileMembership.identity.personalNamespace')} value="/u/apple" />
                <NamespacePill label={t('account.mobileMembership.identity.organizationNamespace')} value="/org/apple" />
              </View>
            </AppCard>

            <IosStoreKitMembershipCard products={productCards} onSynced={loadSnapshot} />
            <AndroidGooglePlayMembershipCard products={productCards} onSynced={loadSnapshot} />
            <StorePlaceholderAction />

            <View style={styles.sectionHeader}>
              <SemanticBadge label={t('account.mobileMembership.productsBadge')} tone="proposal" />
              <AppText style={styles.sectionTitle}>{t('account.mobileMembership.productsTitle')}</AppText>
              <AppText style={[styles.sectionBody, { color: theme.color.muted }]}>{t('account.mobileMembership.productsBody')}</AppText>
            </View>
            {productCards.map((product) => <ProductRow key={product.handle} product={product} />)}

            <InfoNotice tone="warning" title={t('account.mobileMembership.boundaryTitle')} body={t('account.mobileMembership.boundaryBody')} />
          </>
        )}
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.metric, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
      <AppText style={[styles.metricLabel, { color: theme.color.muted }]}>{label}</AppText>
      <AppText style={styles.metricValue} numberOfLines={1}>{value}</AppText>
    </View>
  );
}

function TierMiniCard({ title, badge, body, featured = false }: { title: string; badge: string; body: string; featured?: boolean }) {
  const theme = useThemeTokens();
  return (
    <AppCard style={[styles.tierCard, featured ? { borderColor: theme.semantic.success.border } : null]}>
      <SemanticBadge label={badge} tone={featured ? 'success' : 'muted'} />
      <AppText style={styles.tierTitle}>{title}</AppText>
      <AppText style={[styles.tierBody, { color: theme.color.muted }]}>{body}</AppText>
    </AppCard>
  );
}

function NamespacePill({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.namespacePill, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
      <AppText style={[styles.namespaceLabel, { color: theme.color.muted }]}>{label}</AppText>
      <AppText style={styles.namespaceValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 34, gap: 12 },
  statusCard: { gap: 14 },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  statusCopy: { flex: 1, gap: 8 },
  statusTitle: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.5 },
  statusBody: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  statusGrid: { borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metric: { flexGrow: 1, flexBasis: 96, borderWidth: 1, borderRadius: 16, padding: 11, gap: 4 },
  metricLabel: { fontSize: 11, lineHeight: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 15, lineHeight: 19, fontWeight: '900' },
  tierGrid: { gap: 10 },
  tierCard: { gap: 9 },
  tierTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.3 },
  tierBody: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  identityCard: { gap: 10 },
  identityTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.35 },
  identityBody: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  namespaceRows: { gap: 8 },
  namespacePill: { borderWidth: 1, borderRadius: 16, padding: 11, gap: 3 },
  namespaceLabel: { fontSize: 11, lineHeight: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  namespaceValue: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  nativeActionCard: { gap: 10 },
  nativeActionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.3 },
  nativeActionBody: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  disabledButton: { minHeight: 46, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  disabledButtonText: { fontSize: 14, fontWeight: '900' },
  sectionHeader: { gap: 7, paddingTop: 4 },
  sectionTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.4 },
  sectionBody: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  productCard: { gap: 12 },
  productHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  productTitleBlock: { flex: 1, gap: 4 },
  productTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  productHandle: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  productPrice: { fontSize: 16, lineHeight: 21, fontWeight: '900', textAlign: 'right' },
  productIds: { borderTopWidth: 1, paddingTop: 10, gap: 7 },
  productIdLine: { gap: 2 },
  productIdLabel: { fontSize: 11, lineHeight: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  productIdValue: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
});
