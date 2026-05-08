import React, { useCallback, useState } from 'react';
import { Button, Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CreditPackageDto, CreditPurchaseDto } from '@hellowhen/contracts';

import type { RootStackParamList } from '../../navigation/RootNavigator';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { MoneyPill, InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';

type Props = NativeStackScreenProps<RootStackParamList, 'BuyCredits'>;
type PackagesResponse = { packages: CreditPackageDto[]; stripeConfigured: boolean };
type PurchasesResponse = { purchases: CreditPurchaseDto[] };
type CheckoutResponse = { checkoutUrl?: string | null; sessionId: string; purchase: CreditPurchaseDto };

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function BuyCreditsScreen({ navigation }: Props) {
  const [packages, setPackages] = useState<CreditPackageDto[]>([]);
  const [purchases, setPurchases] = useState<CreditPurchaseDto[]>([]);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buyingPackageId, setBuyingPackageId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setMessage(null);
    try {
      const [packageResult, purchaseResult] = await Promise.all([
        api.credits.packages() as Promise<PackagesResponse>,
        api.credits.purchasesMine() as Promise<PurchasesResponse>
      ]);
      setPackages(packageResult.packages);
      setStripeConfigured(packageResult.stripeConfigured);
      setPurchases(purchaseResult.purchases);
    } catch (caughtError) {
      setMessage(getFriendlyApiErrorMessage(caughtError));
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function buyPackage(packageId: string) {
    setBuyingPackageId(packageId); setMessage(null);
    try {
      const result = await api.credits.createCheckoutSession({ packageId }) as CheckoutResponse;
      if (!result.checkoutUrl) throw new Error('Stripe did not return a checkout URL.');
      await Linking.openURL(result.checkoutUrl);
      setMessage('Checkout opened. Complete the payment, then return here and pull to refresh your wallet.');
    } catch (caughtError) {
      setMessage(getFriendlyApiErrorMessage(caughtError));
    } finally { setBuyingPackageId(null); }
  }

  return <AppScreen><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}>
    <View style={styles.headerRow}><View style={styles.headerCopy}><SemanticBadge label="Wallet" tone="credits" /><AppText style={styles.title}>Add Money</AppText><AppText style={styles.subtitle}>Wallet money is optional and can be used when a trade includes an amount.</AppText></View></View>
    {!stripeConfigured ? <InfoNotice tone="warning" title="Checkout unavailable" body="Wallet checkout is not available right now. You can still browse trades and manage saved needs and offers." /> : null}
    {message ? <InfoNotice tone={message.includes('opened') ? 'success' : 'warning'} title="Wallet top-up" body={message} /> : null}
    <AppCard><AppText style={styles.sectionTitle}>Money packages</AppText>{packages.length === 0 ? <AppText style={styles.muted}>No packages loaded yet.</AppText> : packages.map((item) => <View key={item.id} style={styles.packageRow}><View style={styles.packageCopy}><MoneyPill amountCents={item.amountCents} currency={item.currency} label="wallet" /><AppText style={styles.packageTitle}>{item.label} · {formatMoney(item.amountCents, item.currency)}</AppText><AppText style={styles.cardText}>{item.description}</AppText></View><Button title={buyingPackageId === item.id ? 'Opening...' : 'Buy'} disabled={!stripeConfigured || Boolean(buyingPackageId)} onPress={() => { void buyPackage(item.id); }} /></View>)}</AppCard>
    <AppCard><AppText style={styles.sectionTitle}>Recent purchases</AppText>{purchases.length === 0 ? <AppText style={styles.cardText}>No wallet top-ups yet. Completed checkout sessions will appear here.</AppText> : purchases.slice(0, 8).map((purchase) => <View key={purchase.id} style={styles.purchaseRow}><View style={styles.purchaseCopy}><StatusBadge status={purchase.status} size="sm" /><AppText style={styles.packageTitle}>{formatMoney(purchase.amountCents, purchase.currency)}</AppText><AppText style={styles.muted}>{purchase.stripeCheckoutSessionId ?? 'pending checkout session'}</AppText></View><AppText style={styles.dateText}>{new Date(purchase.createdAt).toLocaleDateString()}</AppText></View>)}</AppCard>
    <Button title="Back to Account" onPress={() => navigation.goBack()} />
  </ScrollView></AppScreen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1, gap: 8 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { color: '#64748B', lineHeight: 20, fontWeight: '700' },
  sectionTitle: { fontSize: 22, fontWeight: '900' },
  muted: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  cardText: { color: '#64748B', lineHeight: 20, fontWeight: '600' },
  packageRow: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12, gap: 10 },
  packageCopy: { gap: 8 },
  packageTitle: { fontSize: 16, fontWeight: '900' },
  purchaseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, gap: 10 },
  purchaseCopy: { flex: 1, gap: 6 },
  dateText: { color: '#64748B', fontSize: 12, fontWeight: '800' }
});
