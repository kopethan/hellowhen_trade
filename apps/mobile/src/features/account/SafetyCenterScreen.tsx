import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReportDto, UserBlockDto } from '@hellowhen/contracts';
import { formatLocalizedDateTime } from '@hellowhen/i18n';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'SafetyCenter'>;

function blockedMemberName(block: UserBlockDto, fallback: string) {
  return block.blocked?.profile?.displayName?.trim()
    || block.blocked?.profile?.handle?.trim()
    || fallback;
}

function blockedMemberHandle(block: UserBlockDto) {
  const handle = block.blocked?.profile?.handle?.trim();
  return handle ? `@${handle}` : null;
}

function reportLabel(report: ReportDto, fallback: string) {
  return report.target?.label?.trim() || fallback;
}

export function SafetyCenterScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const [blocks, setBlocks] = useState<UserBlockDto[]>([]);
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSafetyData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [blockedResponse, reportsResponse] = await Promise.all([
        api.users.blocked(),
        api.reports.mine(),
      ]);
      setBlocks(blockedResponse.blocks ?? []);
      setReports(reportsResponse.reports ?? []);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadSafetyData();
  }, [loadSafetyData]));

  async function unblock(block: UserBlockDto) {
    const blockedUserId = block.blockedId || block.blocked?.id;
    if (!blockedUserId) return;
    setUnblockingId(blockedUserId);
    setError(null);
    setNotice(null);
    try {
      await api.users.unblock(blockedUserId);
      setBlocks((current) => current.filter((item) => item.id !== block.id));
      setNotice(t('account.safetyCenter.unblocked'));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setUnblockingId(null);
    }
  }

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadSafetyData(); }} />}
      >
        <AppHeader title={t('account.safetyCenter.title')} onBack={() => navigation.goBack()} />

        <View style={styles.header}>
          <SemanticBadge label={t('account.safetyCenter.badge')} tone="warning" />
          <AppText style={styles.title}>{t('account.safetyCenter.title')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('account.safetyCenter.body')}</AppText>
        </View>

        <InfoNotice tone="info" title={t('account.safetyCenter.privateTitle')} body={t('account.safetyCenter.privateBody')} />
        {notice ? <InfoNotice tone="success" title={t('common.states.done')} body={notice} /> : null}
        {error ? <InfoNotice tone="warning" title={t('account.safetyCenter.couldNotLoad')} body={error} /> : null}

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('account.safetyCenter.actionsTitle')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('account.safetyCenter.actionsBody')}</AppText>
          <View style={styles.actionRow}>
            <SafetyActionButton label={t('account.safetyCenter.guidelinesAction')} onPress={() => navigation.navigate('LegalPolicy', { policy: 'safety' })} />
            <SafetyActionButton label={t('account.safetyCenter.supportAction')} onPress={() => navigation.navigate('SupportCenter')} />
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.sectionHeader}>
            <AppText style={styles.sectionTitle}>{t('account.safetyCenter.reportsTitle')}</AppText>
            <SemanticBadge label={String(reports.length)} tone="instruction" size="sm" />
          </View>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('account.safetyCenter.reportsBody')}</AppText>
          {reports.length === 0 ? (
            <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{t('account.safetyCenter.noReports')}</AppText>
          ) : reports.map((report) => (
            <View key={report.id} style={[styles.listRow, { borderTopColor: theme.color.border }]}>
              <View style={styles.listCopy}>
                <View style={styles.badgeRow}>
                  <StatusBadge status={report.status} size="sm" />
                  <SemanticBadge label={t(`report.reasons.${report.reason}`)} tone="warning" size="sm" />
                </View>
                <AppText style={styles.rowTitle}>{reportLabel(report, t('account.safetyCenter.reportedContent'))}</AppText>
                <AppText style={[styles.rowMeta, { color: theme.color.muted }]}>{formatLocalizedDateTime(report.createdAt, language)}</AppText>
              </View>
            </View>
          ))}
        </AppCard>

        <AppCard>
          <View style={styles.sectionHeader}>
            <AppText style={styles.sectionTitle}>{t('account.safetyCenter.blockedTitle')}</AppText>
            <SemanticBadge label={String(blocks.length)} tone="danger" size="sm" />
          </View>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('account.safetyCenter.blockedBody')}</AppText>
          {blocks.length === 0 ? (
            <AppText style={[styles.emptyText, { color: theme.color.muted }]}>{t('account.safetyCenter.noBlockedUsers')}</AppText>
          ) : blocks.map((block) => {
            const blockedUserId = block.blockedId || block.blocked?.id || '';
            const unblocking = unblockingId === blockedUserId;
            return (
              <View key={block.id} style={[styles.blockedRow, { borderTopColor: theme.color.border }]}>
                <View style={styles.listCopy}>
                  <AppText style={styles.rowTitle}>{blockedMemberName(block, t('account.safetyCenter.blockedMember'))}</AppText>
                  {blockedMemberHandle(block) ? <AppText style={[styles.rowMeta, { color: theme.color.muted }]}>{blockedMemberHandle(block)}</AppText> : null}
                  <AppText style={[styles.rowMeta, { color: theme.color.muted }]}>{t('account.safetyCenter.blockedOn', { date: formatLocalizedDateTime(block.createdAt, language) })}</AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={unblocking}
                  onPress={() => { void unblock(block); }}
                  style={({ pressed }) => [styles.unblockButton, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, pressed && styles.pressed, unblocking && styles.disabled]}
                >
                  <AppText style={styles.unblockText}>{unblocking ? t('common.states.working') : t('common.actions.unblockUser')}</AppText>
                </Pressable>
              </View>
            );
          })}
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

function SafetyActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, pressed && styles.pressed]}>
      <AppText style={styles.actionButtonText}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 36, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -0.8 },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', letterSpacing: -0.25 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  actionButton: { flexGrow: 1, minHeight: 46, minWidth: 140, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  actionButtonText: { fontWeight: '900', textAlign: 'center' },
  listRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  blockedRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  listCopy: { flex: 1, minWidth: 0, gap: 5 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rowTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  rowMeta: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  emptyText: { lineHeight: 20, fontWeight: '700', paddingTop: 4 },
  unblockButton: { minHeight: 42, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  unblockText: { fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
