import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthUser, LedgerEntryDto, WalletDto } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { DetailInfoList, DetailSection } from '../../components/detail';
import { resolveMediaUrl } from '../trade/mediaUrls';

type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null };
type AccountRoute = 'AccountProfile' | 'Notifications' | 'SavedLibrary' | 'OnboardingGuide' | 'ProPlans' | 'BusinessAccounts' | 'Wallet' | 'Payouts' | 'Settings' | 'LegalPolicy' | 'SupportCenter' | 'AccountDeletion' | 'BuyCredits';
type AccountGroupKey = 'activity' | 'settings' | 'future';

type AccountAction = {
  titleKey: string;
  descriptionKey: string;
  badgeKey: string;
  tone: SemanticColorName;
  route: AccountRoute;
  icon: MobileIconName;
  group: AccountGroupKey;
};

const accountActions: AccountAction[] = [
  { titleKey: 'account.items.profile.title', descriptionKey: 'account.items.profile.bodyNative', badgeKey: 'account.items.profile.badge', tone: 'info', route: 'AccountProfile', icon: 'profile', group: 'activity' },
  { titleKey: 'account.items.notifications.title', descriptionKey: 'account.items.notifications.bodyNative', badgeKey: 'account.items.notifications.badge', tone: 'proposal', route: 'Notifications', icon: 'bell', group: 'activity' },
  ...(betaFeatures.savedLibraryEnabled ? [{ titleKey: 'account.items.saved.title', descriptionKey: 'account.items.saved.bodyNative', badgeKey: 'account.items.saved.badge', tone: 'proposal' as SemanticColorName, route: 'SavedLibrary' as AccountRoute, icon: 'save' as MobileIconName, group: 'activity' as AccountGroupKey }] : []),
  { titleKey: 'account.items.guide.title', descriptionKey: 'account.items.guide.bodyNative', badgeKey: 'account.items.guide.badge', tone: 'info', route: 'OnboardingGuide', icon: 'help', group: 'activity' },
  { titleKey: 'account.items.support.title', descriptionKey: 'account.items.support.bodyNative', badgeKey: 'account.items.support.badge', tone: 'success', route: 'SupportCenter', icon: 'help', group: 'activity' },
  { titleKey: 'account.items.settings.title', descriptionKey: 'account.items.settings.bodyNative', badgeKey: 'account.items.settings.badge', tone: 'instruction', route: 'Settings', icon: 'settings', group: 'settings' },
  { titleKey: 'account.items.legal.title', descriptionKey: 'account.items.legal.bodyNative', badgeKey: 'account.items.legal.badge', tone: 'warning', route: 'LegalPolicy', icon: 'warning', group: 'settings' },
  { titleKey: 'account.items.delete.title', descriptionKey: 'account.items.delete.bodyNative', badgeKey: 'account.items.delete.badge', tone: 'warning', route: 'AccountDeletion', icon: 'warning', group: 'settings' },
  ...(betaFeatures.plusSubscriptionFeatures.plusPublic ? [{ titleKey: 'account.items.plans.title', descriptionKey: 'account.items.plans.bodyNative', badgeKey: 'account.items.plans.badge', tone: 'success' as SemanticColorName, route: 'ProPlans' as AccountRoute, icon: 'profile' as MobileIconName, group: 'future' as AccountGroupKey }] : []),
  ...(betaFeatures.businessAccountsVisible ? [{ titleKey: 'account.items.business.title', descriptionKey: 'account.items.business.bodyNative', badgeKey: 'account.items.business.badge', tone: 'instruction' as SemanticColorName, route: 'BusinessAccounts' as AccountRoute, icon: 'business' as MobileIconName, group: 'future' as AccountGroupKey }] : []),
  ...(betaFeatures.walletVisible ? [{ titleKey: 'account.items.wallet.title', descriptionKey: 'account.items.wallet.bodyNative', badgeKey: 'account.items.wallet.badge', tone: 'credits' as SemanticColorName, route: 'Wallet' as AccountRoute, icon: 'wallet' as MobileIconName, group: 'future' as AccountGroupKey }] : []),
  ...(betaFeatures.payoutsVisible ? [{ titleKey: 'account.items.payouts.title', descriptionKey: 'account.items.payouts.bodyNative', badgeKey: 'account.items.payouts.badge', tone: 'success' as SemanticColorName, route: 'Payouts' as AccountRoute, icon: 'payout' as MobileIconName, group: 'future' as AccountGroupKey }] : []),
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

function groupActions(actions: AccountAction[]) {
  return {
    activity: actions.filter((action) => action.group === 'activity'),
    settings: actions.filter((action) => action.group === 'settings'),
    future: actions.filter((action) => action.group === 'future'),
  };
}

export function AccountScreen() {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [wallet, setWallet] = useState<WalletResponse['wallet']>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

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

  const loadNotificationPreview = useCallback(async () => {
    try {
      const response = await api.notifications.unreadCount();
      setNotificationUnreadCount(response.unreadCount ?? 0);
    } catch {
      setNotificationUnreadCount(0);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (betaFeatures.walletVisible || betaFeatures.payoutsVisible) void loadWallet();
    void loadNotificationPreview();
  }, [loadWallet, loadNotificationPreview]));

  const displayName = getDisplayName(auth.user);
  const handle = auth.user?.profile?.handle ? `@${auth.user.profile.handle}` : t('account.addHandle');
  const avatarUri = getAvatarUri(auth.user);
  const currency = wallet?.currency ?? 'eur';
  const recentEntries = wallet?.entries?.filter((entry) => entry.amountCents !== 0 && entry.type !== 'starting_demo_credits').slice(0, 3) ?? [];
  const groupedActions = useMemo(() => groupActions(accountActions), []);

  function navigate(route: AccountRoute) {
    if (route === 'AccountProfile') navigation.navigate('AccountProfile');
    else if (route === 'Notifications') navigation.navigate('Notifications');
    else if (route === 'SavedLibrary') navigation.navigate('SavedLibrary');
    else if (route === 'OnboardingGuide') navigation.navigate('OnboardingGuide', { replay: true });
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

  const header = (
    <View style={styles.header}>
      <View style={styles.headerBadgeRow}><SemanticBadge label={t('common.states.beta')} tone="instruction" /></View>
      <AppText style={styles.title}>{t('account.title')}</AppText>
      <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.headerBody')}</AppText>
    </View>
  );

  return (
    <AppFixedHeaderScreen header={header}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loadingWallet} onRefresh={() => { if (betaFeatures.walletVisible || betaFeatures.payoutsVisible) void loadWallet(); void loadNotificationPreview(); }} />}
      >
        <View style={[styles.profilePanel, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <View style={styles.profileHero}>
            <View style={[styles.avatar, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <AppText style={[styles.avatarText, { color: theme.semantic.proposal.text }]}>{displayName.slice(0, 1).toUpperCase()}</AppText>
              )}
            </View>
            <View style={styles.profileCopy}>
              <AppText style={styles.profileName}>{displayName}</AppText>
              <AppText style={[styles.profileMeta, { color: theme.semantic.proposal.text }]}>{handle}</AppText>
              <AppText style={[styles.profileEmail, { color: theme.color.muted }]}>{auth.user?.email ?? t('common.states.signedIn')}</AppText>
            </View>
          </View>
          <View style={styles.quickActions}>
            <AccountQuickAction icon="profile" label={t('account.quickActions.editProfile')} onPress={() => navigate('AccountProfile')} tone="info" />
            <AccountQuickAction icon="bell" label={t('account.quickActions.notifications')} count={notificationUnreadCount} onPress={() => navigate('Notifications')} tone="proposal" />
            <AccountQuickAction icon="help" label={t('account.quickActions.support')} onPress={() => navigate('SupportCenter')} tone="success" />
          </View>
        </View>

        {(betaFeatures.walletVisible || betaFeatures.payoutsVisible) ? (
          <DetailSection title={t('account.wallet.title')} description={t('account.wallet.body')} compact={false}>
            {wallet ? (
              <DetailInfoList rows={[
                { label: t('account.wallet.available'), value: formatMoney(wallet.availableBalanceCents, currency), tone: 'credits' },
                { label: t('account.wallet.held'), value: formatMoney(wallet.heldBalanceCents, currency), tone: 'time' },
                { label: t('account.wallet.earnings'), value: formatMoney(wallet.pendingPayoutCents, currency), tone: 'success' },
              ]} />
            ) : null}
            <View style={styles.inlineActions}>
              <Pressable accessibilityRole="button" onPress={() => navigate('Wallet')} style={({ pressed }) => [styles.inlinePrimary, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
                <AppText style={[styles.inlinePrimaryText, { color: theme.color.background }]}>{t('common.actions.openWallet')}</AppText>
              </Pressable>
              {betaFeatures.walletVisible ? (
                <Pressable accessibilityRole="button" onPress={() => navigate('BuyCredits')} style={({ pressed }) => [styles.inlineSecondary, { borderColor: theme.color.border }, pressed && styles.pressed]}>
                  <AppText style={[styles.inlineSecondaryText, { color: theme.color.text }]}>{t('common.actions.add')}</AppText>
                </Pressable>
              ) : null}
              {betaFeatures.payoutsVisible ? (
                <Pressable accessibilityRole="button" onPress={() => navigate('Payouts')} style={({ pressed }) => [styles.inlineSecondary, { borderColor: theme.color.border }, pressed && styles.pressed]}>
                  <AppText style={[styles.inlineSecondaryText, { color: theme.color.text }]}>{t('common.actions.payout')}</AppText>
                </Pressable>
              ) : null}
            </View>
            {walletError ? <InfoNotice tone="warning" title={t('account.walletUnavailable')} body={walletError} /> : null}
          </DetailSection>
        ) : null}

        {(betaFeatures.walletVisible || betaFeatures.payoutsVisible) ? (
          <DetailSection title={t('account.wallet.recentActivity')} compact>
            {recentEntries.length === 0 ? <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.noWalletActivity')}</AppText> : recentEntries.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
          </DetailSection>
        ) : null}

        <AccountActionGroup title={t('account.sections.activity')} actions={groupedActions.activity} unreadCount={notificationUnreadCount} onNavigate={navigate} />
        <AccountActionGroup title={t('account.sections.settings')} actions={groupedActions.settings} unreadCount={notificationUnreadCount} onNavigate={navigate} />
        {groupedActions.future.length > 0 ? <AccountActionGroup title={t('account.sections.future')} actions={groupedActions.future} unreadCount={notificationUnreadCount} onNavigate={navigate} /> : null}

        <Pressable accessibilityRole="button" accessibilityLabel={t('common.actions.logout')} onPress={() => { void auth.logout(); }} style={({ pressed }) => [styles.logoutButton, { borderColor: theme.semantic.danger.border, backgroundColor: theme.semantic.danger.softBg }, pressed && styles.pressed]}>
          <AppText style={[styles.logoutButtonText, { color: theme.semantic.danger.text }]}>{t('common.actions.logout')}</AppText>
        </Pressable>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function AccountQuickAction({ icon, label, count, onPress, tone }: { icon: MobileIconName; label: string; count?: number; onPress: () => void; tone: SemanticColorName }) {
  const theme = useThemeTokens();
  const semantic = theme.semantic[tone];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={count && count > 0 ? `${label} · ${count}` : label} onPress={onPress} style={({ pressed }) => [styles.quickAction, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={[styles.quickIcon, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}>
        <MobileIcon name={icon} size={17} color={semantic.text} />
        {count && count > 0 ? <View style={[styles.quickDot, { backgroundColor: theme.semantic.proposal.bg }]}><AppText style={styles.quickDotText}>{Math.min(count, 99)}</AppText></View> : null}
      </View>
      <AppText style={styles.quickLabel} numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

function AccountActionGroup({ title, actions, unreadCount, onNavigate }: { title: string; actions: AccountAction[]; unreadCount: number; onNavigate: (route: AccountRoute) => void }) {
  if (actions.length === 0) return null;
  return (
    <DetailSection title={title} compact>
      <View style={styles.menuList}>
        {actions.map((action, index) => <AccountActionRow key={action.route} action={action} unreadCount={action.route === 'Notifications' ? unreadCount : 0} last={index === actions.length - 1} onPress={() => onNavigate(action.route)} />)}
      </View>
    </DetailSection>
  );
}

function AccountActionRow({ action, unreadCount, last, onPress }: { action: AccountAction; unreadCount?: number; last?: boolean; onPress: () => void }) {
  const theme = useThemeTokens();
  const tone = theme.semantic[action.tone];
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={unreadCount && unreadCount > 0 ? `${t(action.titleKey)} · ${unreadCount}` : t(action.titleKey)} onPress={onPress} style={({ pressed }) => [styles.actionRow, !last && { borderBottomColor: theme.color.border, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && styles.pressed]}>
      <View style={styles.actionContent}>
        <View style={[styles.actionIcon, { backgroundColor: tone.softBg, borderColor: tone.border }]}>
          <MobileIcon name={action.icon} size={18} color={tone.text} />
        </View>
        <View style={styles.actionTextWrap}>
          <View style={styles.actionTitleRow}>
            <AppText style={styles.actionTitle}>{t(action.titleKey)}</AppText>
            {unreadCount && unreadCount > 0 ? <SemanticBadge label={String(unreadCount)} tone={action.tone} size="sm" /> : null}
          </View>
          <AppText style={[styles.actionDescription, { color: theme.color.muted }]}>{t(action.descriptionKey)}</AppText>
        </View>
      </View>
      <MobileIcon name="chevron-right" size={22} color={theme.color.muted} />
    </Pressable>
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
      <AppText style={[styles.ledgerAmount, { color: (entry.amountCents || entry.amount) < 0 ? theme.semantic.danger.text : theme.semantic.success.text }]}>{entryAmount(entry)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 12 },
  header: { gap: 8 },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  profilePanel: { borderRadius: 28, borderWidth: 1, padding: 16, gap: 15 },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 66, height: 66, borderRadius: 33, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 33 },
  avatarText: { fontSize: 25, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 23, fontWeight: '900', letterSpacing: -0.35 },
  profileMeta: { marginTop: 3, fontWeight: '900' },
  profileEmail: { marginTop: 3, fontWeight: '600' },
  quickActions: { flexDirection: 'row', gap: 9 },
  quickAction: { flex: 1, minHeight: 74, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, gap: 7 },
  quickIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  quickDot: { position: 'absolute', top: -5, right: -9, minWidth: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  quickDotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  quickLabel: { fontSize: 12, lineHeight: 15, fontWeight: '900', textAlign: 'center' },
  cardText: { lineHeight: 20, fontWeight: '600' },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  inlinePrimary: { flex: 1, minWidth: 130, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  inlinePrimaryText: { fontWeight: '900' },
  inlineSecondary: { flex: 1, minWidth: 96, borderRadius: 16, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  inlineSecondaryText: { fontWeight: '900' },
  menuList: { borderRadius: 20, overflow: 'hidden' },
  actionRow: { minHeight: 72, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  actionContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionTextWrap: { flex: 1, gap: 3 },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionTitle: { fontSize: 17, fontWeight: '900' },
  actionDescription: { lineHeight: 19, fontWeight: '600' },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, paddingTop: 10 },
  ledgerCopy: { flex: 1, gap: 6 },
  ledgerDescription: { fontSize: 12, fontWeight: '700' },
  ledgerAmount: { fontSize: 18, fontWeight: '900' },
  logoutButton: { marginTop: 4, borderRadius: 18, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  logoutButtonText: { fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
