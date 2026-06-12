import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { MembershipProductHandle } from '@hellowhen/shared';
import { AppCard } from '../../components/AppCard';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';

type ProductCard = {
  handle: MembershipProductHandle;
  title: string;
  price: string;
  appleProductId: string;
  googleProductId: string;
};

type IapModule = Record<string, unknown>;
type NativePurchase = Record<string, unknown>;

type Props = {
  products: ProductCard[];
  onSynced: () => Promise<void> | void;
};

function getProductId(purchase: NativePurchase): string | null {
  const ids = Array.isArray(purchase.productIds) ? purchase.productIds : null;
  return String(purchase.productId ?? purchase.productIdentifier ?? ids?.[0] ?? '').trim() || null;
}

function getPurchaseToken(purchase: NativePurchase): string | null {
  return String(purchase.purchaseToken ?? purchase.transactionReceipt ?? '').trim() || null;
}

async function initConnection(iap: IapModule) {
  if (typeof iap.initConnection === 'function') await iap.initConnection();
}

async function getProducts(iap: IapModule, productIds: string[]) {
  if (typeof iap.getSubscriptions === 'function') return await iap.getSubscriptions({ skus: productIds });
  if (typeof iap.getProducts === 'function') return await iap.getProducts({ skus: productIds });
  return [];
}

async function requestSubscription(iap: IapModule, productId: string) {
  if (typeof iap.requestSubscription === 'function') return await iap.requestSubscription({ sku: productId });
  if (typeof iap.requestPurchase === 'function') return await iap.requestPurchase({ sku: productId });
  throw new Error('iap_request_not_available');
}

async function getAvailablePurchases(iap: IapModule) {
  if (typeof iap.getAvailablePurchases === 'function') return await iap.getAvailablePurchases();
  return [];
}

async function finishTransaction(iap: IapModule, purchase: NativePurchase) {
  if (typeof iap.finishTransaction === 'function') await iap.finishTransaction({ purchase, isConsumable: false });
}

export function AndroidGooglePlayMembershipCard({ products, onSynced }: Props) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger' | 'info'; title: string; body: string } | null>(null);
  const enabled = Platform.OS === 'android' && betaFeatures.mobileMembershipPurchases.androidGooglePlayEnabled;
  const productIds = useMemo(() => products.map((product) => product.googleProductId).filter(Boolean), [products]);
  const primaryProduct = products.find((product) => product.handle === 'hellowhen_plus_monthly') ?? products[0];

  const syncPurchase = useCallback(async (purchase: NativePurchase, source: 'purchase' | 'restore') => {
    const productId = getProductId(purchase) ?? primaryProduct?.googleProductId;
    const purchaseToken = getPurchaseToken(purchase);
    if (!productId || !purchaseToken) throw new Error('google_purchase_missing_token');
    const response = await api.subscriptions.syncGooglePlayPurchase({
      source,
      productId,
      purchaseToken,
      orderId: String(purchase.orderId ?? purchase.transactionId ?? '').trim() || undefined,
      transactionDate: typeof purchase.transactionDate === 'number' ? purchase.transactionDate : undefined,
      acknowledged: typeof purchase.isAcknowledgedAndroid === 'boolean' ? purchase.isAcknowledgedAndroid : undefined,
    });
    if (response.grantApplied) {
      setMessage({ tone: 'success', title: t('account.mobileMembership.nativeActions.googlePurchaseSuccess'), body: response.message });
    } else {
      setMessage({ tone: 'warning', title: t('account.mobileMembership.nativeActions.googlePurchasePending'), body: response.message });
    }
    await onSynced();
  }, [onSynced, primaryProduct?.googleProductId, t]);

  const subscribe = useCallback(async () => {
    if (!primaryProduct) return;
    setBusy(true);
    setMessage(null);
    try {
      const iap = await import('expo-iap') as IapModule;
      await initConnection(iap);
      await getProducts(iap, productIds);
      const result = await requestSubscription(iap, primaryProduct.googleProductId);
      const purchase = Array.isArray(result) ? result[0] : result;
      if (purchase && typeof purchase === 'object') {
        await syncPurchase(purchase as NativePurchase, 'purchase');
        await finishTransaction(iap, purchase as NativePurchase);
      } else {
        setMessage({ tone: 'warning', title: t('account.mobileMembership.nativeActions.googlePurchasePending'), body: t('account.mobileMembership.nativeActions.googlePurchasePending') });
      }
    } catch {
      setMessage({ tone: 'danger', title: t('account.mobileMembership.nativeActions.googlePurchaseError'), body: t('account.mobileMembership.nativeActions.googlePurchaseError') });
    } finally {
      setBusy(false);
    }
  }, [primaryProduct, productIds, syncPurchase, t]);

  const restore = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const iap = await import('expo-iap') as IapModule;
      await initConnection(iap);
      const purchases = await getAvailablePurchases(iap) as NativePurchase[];
      const purchase = purchases.find((item) => {
        const productId = getProductId(item);
        return Boolean(productId && productIds.includes(productId));
      });
      if (!purchase) {
        setMessage({ tone: 'info', title: t('account.mobileMembership.nativeActions.googleRestoreEmpty'), body: t('account.mobileMembership.nativeActions.googleRestoreEmpty') });
        return;
      }
      await syncPurchase(purchase, 'restore');
      setMessage((current) => current ?? { tone: 'success', title: t('account.mobileMembership.nativeActions.googleRestoreSuccess'), body: t('account.mobileMembership.nativeActions.googleRestoreSuccess') });
    } catch {
      setMessage({ tone: 'danger', title: t('account.mobileMembership.nativeActions.googleRestoreError'), body: t('account.mobileMembership.nativeActions.googleRestoreError') });
    } finally {
      setBusy(false);
    }
  }, [productIds, syncPurchase, t]);

  if (!enabled) return null;
  if (Platform.OS !== 'android') return null;

  return (
    <AppCard style={[styles.card, { borderColor: theme.semantic.success.border }]}>
      <SemanticBadge label={t('account.mobileMembership.nativeActions.googleLiveBadge')} tone="success" />
      <AppText style={styles.title}>{t('account.mobileMembership.nativeActions.googleLiveTitle')}</AppText>
      <AppText style={[styles.body, { color: theme.color.muted }]}>{t('account.mobileMembership.nativeActions.googleLiveBody')}</AppText>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={busy || !primaryProduct} onPress={subscribe} style={[styles.button, { backgroundColor: theme.color.text }]}>
          <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{busy ? t('account.mobileMembership.nativeActions.googleSyncing') : t('account.mobileMembership.nativeActions.googleSubscribe')}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={restore} style={[styles.button, styles.secondaryButton, { borderColor: theme.color.border }]}>
          <AppText style={styles.secondaryButtonText}>{busy ? t('account.mobileMembership.nativeActions.googleRestoring') : t('account.mobileMembership.nativeActions.googleRestore')}</AppText>
        </Pressable>
      </View>
      {message ? <InfoNotice tone={message.tone} title={message.title} body={message.body} /> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.3 },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  actions: { gap: 8 },
  button: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  secondaryButton: { borderWidth: 1, backgroundColor: 'transparent' },
  primaryButtonText: { fontSize: 14, fontWeight: '900' },
  secondaryButtonText: { fontSize: 14, fontWeight: '900' },
});
