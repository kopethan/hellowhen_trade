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
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { InfoNotice, MoneyPill, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { resolveMediaUrl } from '../trade/mediaUrls';

type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null };
type AccountRoute = 'AccountProfile' | 'ProPlans' | 'BusinessAccounts' | 'Wallet' | 'Payouts' | 'Settings' | 'LegalPolicy' | 'SupportCenter' | 'AccountDeletion' | 'BuyCredits';

type AccountAction = {
  titleKey: string;
  descriptionKey: string;
  badgeKey: string;
  tone: SemanticColorName;
  route: AccountRoute;
  icon: MobileIconName;
};

const accountActions: AccountAction[] = [
  { titleKey: 'account.items.profile.title', descriptionKey: 'account.items.profile.bodyNative', badgeKey: 'account.items.profile.badge', tone: 'info', route: 'AccountProfile', icon: 'profile' },
  ...(betaFeatures.proSubscriptionFeatures.proAccountsVisible ? [{ titleKey: 'account.items.plans.title', descriptionKey: 'account.items.plans.bodyNative', badgeKey: 'account.items.plans.badge', tone: 'success' as SemanticColorName, route: 'ProPlans' as AccountRoute, icon: 'profile' as MobileIconName }] : []),
  ...(betaFeatures.businessAccountsVisible ? [{ titleKey: 'account.items.business.title', descriptionKey: 'account.items.business.bodyNative', badgeKey: 'account.items.business.badge', tone: 'instruction' as SemanticColorName, route: 'BusinessAccounts' as AccountRoute, icon: 'business' as MobileIconName }] : []),
  ...(betaFeatures.walletVisible ? [{ titleKey: 'account.items.wallet.title', descriptionKey: 'account.items.wallet.bodyNative', badgeKey: 'account.items.wallet.badge', tone: 'credits' as SemanticColorName, route: 'Wallet' as AccountRoute, icon: 'wallet' as MobileIconName }] : []),
  ...(betaFeatures.payoutsVisible ? [{ titleKey: 'account.items.payouts.title', descriptionKey: 'account.items.payouts.bodyNative', badgeKey: 'account.items.payouts.badge', tone: 'success' as SemanticColorName, route: 'Payouts' as AccountRoute, icon: 'payout' as MobileIconName }] : []),
  { titleKey: 'account.items.settings.title', descriptionKey: 'account.items.settings.bodyNative', badgeKey: 'account.items.settings.badge', tone: 'instruction', route: 'Settings', icon: 'settings' },
  { titleKey: 'account.items.legal.title', descriptionKey: 'account.items.legal.bodyNative', badgeKey: 'account.items.legal.badge', tone: 'warning', route: 'LegalPolicy', icon: 'warning' },
  { titleKey: 'account.items.support.title', descriptionKey: 'account.items.support.bodyNative', badgeKey: 'account.items.support.badge', tone: 'success', route: 'SupportCenter', icon: 'help' },
  { titleKey: 'account.items.delete.title', descriptionKey: 'account.items.delete.bodyNative', badgeKey: 'account.items.delete.badge', tone: 'warning', route: 'AccountDeletion', icon: 'warning' },
];

function formatLedgerType(type: string) {
  if (type === 'test_credit_grant') return 'demo top-up';
  if (type === 'credit_purchase') return 'wallet top-up';
  if (type === 'payout_requested') return 'payout';
  if (type === 'trade_hold') return 'trade hold';
  if (type === 'trade_release') return 'trade release';
  if (type === 'trade_refund') return 'trade refund';
  return type.replaceAll('_', ' ');
}

function entryAmount(entry: LedgerEntryDto) {
  return `${entry.amountCents > 0 ? '+' : ''}${formatMoney(entry.amountCents ?? 0, entry.currency ?? 'eur')}`;
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
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [wallet, setWallet] = useState<WalletResponse['wallet']>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  const loadWallet = useCallback(async () => {
    if (!(betaFeatures.walletVisible || betaFeatures.payoutsVisible)) { setWallet(null); setWalletError(null); return; }
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

  useFocusEffect(useCallback(() => { if (betaFeatures.walletVisible || betaFeatures.payoutsVisible) void loadWallet(); }, [loadWallet]));

  const displayName = getDisplayName(auth.user);
  const handle = auth.user?.profile?.handle ? `@${auth.user.profile.handle}` : t('account.addHandle');
  const avatarUri = getAvatarUri(auth.user);
  const currency = wallet?.currency ?? 'eur';
  const total = wallet ? wallet.availableBalanceCents + wallet.heldBalanceCents + wallet.pendingPayoutCents : 0;
  const recentEntries = wallet?.entries?.filter((entry) => entry.amountCents !== 0 && entry.type !== 'starting_demo_credits').slice(0, 3) ?? [];

  function navigate(route: AccountRoute) {
    if (route === 'AccountProfile') navigation.navigate('AccountProfile');
    else if (route === 'ProPlans') navigation.navigate('ProPlans');
    else if (route === 'BusinessAccounts') navigation.navigate('BusinessAccounts');
    else if (route === 'Wallet') navigation.navigate('Wallet');
    else if (route === 'Payouts') navigation.navigate('Payouts');
    else if (route === 'Settings') navigation.navigate('Settings');
    else if (route === 'LegalPolicy') navigation.navigate('LegalPolicy');
    else if (route === 'SupportCenter') navigation.navigate('SupportCenter');
    else if (route === 'AccountDeletion') navigation.navigate('AccountDeletion');
    else navigation.navigate('BuyCredits');
  }

  const header = <View style={styles.header}><View style={styles.headerBadgeRow}><SemanticBadge label={t('common.states.beta')} tone="instruction" /></View><AppText style={styles.title}>{t('account.title')}</AppText><AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.headerBody')}</AppText></View>;

  return (
    <AppFixedHeaderScreen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loadingWallet} onRefresh={() => { if (betaFeatures.walletVisible || betaFeatures.payoutsVisible) void loadWallet(); }} />}>
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
              <AppText style={[styles.profileEmail, { color: theme.color.muted }]}>{auth.user?.email ?? t('common.states.signedIn')}</AppText>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => navigate('AccountProfile')} style={({ pressed }) => [styles.fullWidthButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
            <AppText style={[styles.fullWidthButtonText, { color: theme.color.background }]}>{t('account.editProfile')}</AppText>
          </Pressable>
        </AppCard>

        {(betaFeatures.walletVisible || betaFeatures.payoutsVisible) ? <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>{t('account.wallet.title')}</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.wallet.body')}</AppText>
            </View>
            <MoneyPill amountCents={total} currency={currency} label={t('account.total')} />
          </View>

          {wallet ? (
            <View style={styles.walletGrid}>
              <WalletMetric label={t('account.wallet.available')} value={wallet.availableBalanceCents} currency={currency} tone="credits" />
              <WalletMetric label={t('account.wallet.held')} value={wallet.heldBalanceCents} currency={currency} tone="time" />
              <WalletMetric label={t('account.wallet.earnings')} value={wallet.pendingPayoutCents} currency={currency} tone="success" />
            </View>
          ) : null}

          <View style={styles.inlineActions}>
            <Pressable accessibilityRole="button" onPress={() => navigate('Wallet')} style={({ pressed }) => [styles.inlinePrimary, { backgroundColor: theme.semantic.proposal.bg }, pressed && styles.pressed]}>
              <AppText style={styles.inlinePrimaryText}>{t('common.actions.openWallet')}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigate('BuyCredits')} style={({ pressed }) => [styles.inlineSecondary, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
              <AppText style={[styles.inlineSecondaryText, { color: theme.color.text }]}>{t('common.actions.add')}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigate('Payouts')} style={({ pressed }) => [styles.inlineSecondary, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
              <AppText style={[styles.inlineSecondaryText, { color: theme.color.text }]}>{t('common.actions.payout')}</AppText>
            </Pressable>
          </View>

          {walletError ? <InfoNotice tone="warning" title={t('account.walletUnavailable')} body={walletError} /> : null}
        </AppCard> : null}

        {(betaFeatures.walletVisible || betaFeatures.payoutsVisible) ? <AppCard>
          <View style={styles.sectionHeaderRow}>
            <AppText style={styles.sectionTitle}>{t('account.wallet.recentActivity')}</AppText>
            <Pressable accessibilityRole="button" onPress={() => navigate('Wallet')} style={({ pressed }) => [styles.textButton, { backgroundColor: theme.color.subtleSurface }, pressed && styles.pressed]}>
              <AppText style={[styles.textButtonText, { color: theme.color.text }]}>{t('common.actions.viewAll')}</AppText>
            </Pressable>
          </View>
          {recentEntries.length === 0 ? <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.noWalletActivity')}</AppText> : recentEntries.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
        </AppCard> : null}

        <View style={styles.menuList}>
          {accountActions.map((action) => <AccountActionRow key={action.route} action={action} onPress={() => navigate(action.route)} />)}
        </View>

        <Pressable accessibilityRole="button" onPress={() => { void auth.logout(); }} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
          <AppText style={styles.logoutButtonText}>{t('common.actions.logout')}</AppText>
        </Pressable>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function AccountActionRow({ action, onPress }: { action: AccountAction; onPress: () => void }) {
  const theme = useThemeTokens();
  const tone = theme.semantic[action.tone];
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.actionContent}>
        <View style={[styles.actionIcon, { backgroundColor: tone.softBg, borderColor: tone.border }]}>
          <MobileIcon name={action.icon} size={19} color={tone.text} />
        </View>
        <View style={styles.actionTextWrap}>
          <View style={styles.actionTitleRow}>
            <AppText style={styles.actionTitle}>{t(action.titleKey)}</AppText>
            <SemanticBadge label={t(action.badgeKey)} tone={action.tone} size="sm" />
          </View>
          <AppText style={[styles.actionDescription, { color: theme.color.muted }]}>{t(action.descriptionKey)}</AppText>
        </View>
      </View>
      <MobileIcon name="chevron-right" size={22} color={theme.color.muted} />
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
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center' },
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
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
  actionIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionTextWrap: { flex: 1, gap: 4 },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionTitle: { fontSize: 18, fontWeight: '900' },
  actionDescription: { lineHeight: 19, fontWeight: '600' },
  logoutButton: { marginTop: 4, borderRadius: 18, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', paddingVertical: 14, alignItems: 'center' },
  logoutButtonText: { color: '#991B1B', fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
