import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthUser, WalletDto, LedgerEntryDto } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, MoneyPill, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { resolveMediaUrl } from '../trade/mediaUrls';

type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null };
type AccountRoute = 'AccountProfile' | 'Wallet' | 'Settings' | 'SupportCenter' | 'BuyCredits';

type AccountAction = {
  title: string;
  description: string;
  badge: string;
  tone: SemanticColorName;
  route: AccountRoute;
};

const accountActions: AccountAction[] = [
  { title: 'Profile', description: 'Display name, handle, and public bio.', badge: 'Profile', tone: 'info', route: 'AccountProfile' },
  { title: 'Wallet', description: 'Optional money, holds, pending payouts, and activity.', badge: 'Wallet', tone: 'credits', route: 'Wallet' },
  { title: 'Settings', description: 'Notifications, appearance, and privacy.', badge: 'Settings', tone: 'instruction', route: 'Settings' },
  { title: 'Support', description: 'Get help with trades, images, wallet, or safety.', badge: 'Help', tone: 'success', route: 'SupportCenter' },
];

function formatLedgerType(type: string) {
  return type.replaceAll('_', ' ');
}

function entryAmount(entry: LedgerEntryDto) {
  if (entry.amountCents) return `${entry.amountCents > 0 ? '+' : ''}${formatMoney(entry.amountCents, entry.currency ?? 'eur')}`;
  return entry.amount ? `${entry.amount > 0 ? '+' : ''}${entry.amount} legacy credits` : formatMoney(0, entry.currency ?? 'eur');
}

function ledgerTone(type: string, amount: number): SemanticColorName {
  if (type.includes('hold')) return 'time';
  if (type.includes('refund')) return 'warning';
  if (type.includes('release') || type.includes('earned')) return 'success';
  if (amount < 0) return 'danger';
  return 'credits';
}

function getDisplayName(user: AuthUser | null) {
  return user?.profile?.displayName || user?.profile?.handle || user?.email || 'Hellowhen member';
}

function getAvatarUri(user: AuthUser | null) {
  const url = user?.profile?.avatarUrl;
  return url ? resolveMediaUrl(url) : null;
}

export function AccountScreen() {
  const theme = useThemeTokens();
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [wallet, setWallet] = useState<WalletResponse['wallet']>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  const loadWallet = useCallback(async () => {
    setLoadingWallet(true);
    setWalletError(null);

    try {
      const result = await api.wallet.me() as WalletResponse;
      setWallet(result.wallet);
    } catch (caughtError) {
      setWallet(null);
      setWalletError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadWallet(); }, [loadWallet]));

  const displayName = getDisplayName(auth.user);
  const handle = auth.user?.profile?.handle ? `@${auth.user.profile.handle}` : 'Add a handle';
  const avatarUri = getAvatarUri(auth.user);
  const currency = wallet?.currency ?? 'eur';
  const total = wallet ? wallet.availableBalanceCents + wallet.heldBalanceCents + wallet.pendingPayoutCents : 0;
  const recentEntries = wallet?.entries?.slice(0, 3) ?? [];

  function navigate(route: AccountRoute) {
    if (route === 'AccountProfile') navigation.navigate('AccountProfile');
    else if (route === 'Wallet') navigation.navigate('Wallet');
    else if (route === 'Settings') navigation.navigate('Settings');
    else if (route === 'SupportCenter') navigation.navigate('SupportCenter');
    else navigation.navigate('BuyCredits');
  }

  const header = <View style={styles.header}><SemanticBadge label="Account" tone="info" /><AppText style={styles.title}>Account</AppText><AppText style={[styles.subtitle, { color: theme.color.muted }]}>Profile, wallet, settings, and support.</AppText></View>;

  return (
    <AppFixedHeaderScreen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loadingWallet} onRefresh={() => { void loadWallet(); }} />}>
        <AppCard>
          <View style={styles.profileHero}>
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <AppText style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</AppText>
              )}
            </View>
            <View style={styles.profileCopy}>
              <AppText style={styles.profileName}>{displayName}</AppText>
              <AppText style={[styles.profileMeta, { color: theme.semantic.proposal.bg }]}>{handle}</AppText>
              <AppText style={[styles.profileEmail, { color: theme.color.muted }]}>{auth.user?.email ?? 'Signed in'}</AppText>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => navigate('AccountProfile')} style={({ pressed }) => [styles.fullWidthButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
            <AppText style={[styles.fullWidthButtonText, { color: theme.color.background }]}>Edit Profile</AppText>
          </Pressable>
        </AppCard>

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>Wallet</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>Optional money available for trades, holds, and payouts.</AppText>
            </View>
            <MoneyPill amountCents={total} currency={currency} label="total" />
          </View>

          {wallet ? (
            <View style={styles.walletGrid}>
              <WalletMetric label="Available" value={wallet.availableBalanceCents} currency={currency} tone="credits" />
              <WalletMetric label="Held" value={wallet.heldBalanceCents} currency={currency} tone="time" />
              <WalletMetric label="Pending" value={wallet.pendingPayoutCents} currency={currency} tone="success" />
            </View>
          ) : null}

          <View style={styles.inlineActions}>
            <Pressable accessibilityRole="button" onPress={() => navigate('Wallet')} style={({ pressed }) => [styles.inlinePrimary, { backgroundColor: theme.semantic.proposal.bg }, pressed && styles.pressed]}>
              <AppText style={styles.inlinePrimaryText}>Open Wallet</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigate('BuyCredits')} style={({ pressed }) => [styles.inlineSecondary, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
              <AppText style={[styles.inlineSecondaryText, { color: theme.color.text }]}>Add Money</AppText>
            </Pressable>
          </View>

          {walletError ? <InfoNotice tone="warning" title="Wallet unavailable" body={walletError} /> : null}
        </AppCard>

        {recentEntries.length > 0 ? (
          <AppCard>
            <View style={styles.sectionHeaderRow}>
              <AppText style={styles.sectionTitle}>Recent activity</AppText>
              <Pressable accessibilityRole="button" onPress={() => navigate('Wallet')} style={({ pressed }) => [styles.textButton, { backgroundColor: theme.color.subtleSurface }, pressed && styles.pressed]}>
                <AppText style={styles.textButtonText}>View all</AppText>
              </Pressable>
            </View>
            {recentEntries.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
          </AppCard>
        ) : null}

        <View style={styles.menuList}>
          {accountActions.map((action) => <AccountActionRow key={action.title} action={action} onPress={() => navigate(action.route)} />)}
        </View>

        <Pressable accessibilityRole="button" onPress={() => { void auth.logout(); }} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
          <AppText style={styles.logoutButtonText}>Logout</AppText>
        </Pressable>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function AccountActionRow({ action, onPress }: { action: AccountAction; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.actionContent}>
        <SemanticBadge label={action.badge} tone={action.tone} size="sm" />
        <View style={styles.actionTextWrap}>
          <AppText style={styles.actionTitle}>{action.title}</AppText>
          <AppText style={[styles.actionDescription, { color: theme.color.muted }]}>{action.description}</AppText>
        </View>
      </View>
      <AppText style={[styles.chevron, { color: theme.color.muted }]}>›</AppText>
    </Pressable>
  );
}

function WalletMetric({ label, value, currency, tone }: { label: string; value: number; currency: string; tone: SemanticColorName }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.metricBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
      <SemanticBadge label={label} tone={tone} size="sm" />
      <AppText style={styles.metricValue}>{formatMoney(value, currency)}</AppText>
    </View>
  );
}


function LedgerRow({ entry }: { entry: LedgerEntryDto }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.ledgerRow, { borderTopColor: theme.color.border }]}>
      <View style={styles.ledgerCopy}>
        <SemanticBadge label={formatLedgerType(entry.type)} tone={ledgerTone(entry.type, entry.amountCents || entry.amount)} size="sm" />
        <AppText style={[styles.ledgerDescription, { color: theme.color.muted }]}>{entry.description ?? entry.balanceType}</AppText>
      </View>
      <AppText style={[styles.ledgerAmount, (entry.amountCents || entry.amount) < 0 && styles.ledgerAmountNegative]}>{entryAmount(entry)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#CCFBF1', borderWidth: 1, borderColor: '#5EEAD4', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 32 },
  avatarText: { color: '#0F766E', fontSize: 24, fontWeight: '900' },
  profileCopy: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  profileMeta: { marginTop: 3, fontWeight: '900' },
  profileEmail: { marginTop: 3, fontWeight: '600' },
  fullWidthButton: { borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  fullWidthButtonText: { fontWeight: '900' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionCopy: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.35 },
  cardText: { lineHeight: 20, fontWeight: '600' },
  walletGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricBox: { width: '47%', borderRadius: 18, borderWidth: 1, padding: 12, gap: 8 },
  metricValue: { fontSize: 18, fontWeight: '900' },
  inlineActions: { flexDirection: 'row', gap: 10 },
  inlinePrimary: { flex: 1, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  inlinePrimaryText: { color: '#FFFFFF', fontWeight: '900' },
  inlineSecondary: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  inlineSecondaryText: { fontWeight: '900' },
  textButton: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  textButtonText: { color: '#334155', fontWeight: '900' },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, paddingTop: 10 },
  ledgerCopy: { flex: 1, gap: 6 },
  ledgerDescription: { fontSize: 12, fontWeight: '700' },
  ledgerAmount: { color: '#047857', fontSize: 18, fontWeight: '900' },
  ledgerAmountNegative: { color: '#B91C1C' },
  menuList: { gap: 10 },
  actionRow: { minHeight: 88, borderRadius: 22, borderWidth: 1, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  actionContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
  actionTextWrap: { flex: 1, gap: 4 },
  actionTitle: { fontSize: 18, fontWeight: '900' },
  actionDescription: { lineHeight: 19, fontWeight: '600' },
  chevron: { fontSize: 32, fontWeight: '700' },
  logoutButton: { marginTop: 4, borderRadius: 18, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', paddingVertical: 14, alignItems: 'center' },
  logoutButtonText: { color: '#991B1B', fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
