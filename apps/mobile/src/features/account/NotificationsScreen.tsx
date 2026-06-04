import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InAppNotificationType, NotificationDto } from '@hellowhen/contracts';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;
type NotificationFilter = 'all' | 'unread';
type NotificationMetadata = {
  tradeTitle?: unknown;
  ticketSubject?: unknown;
  status?: unknown;
  statusLabel?: unknown;
} | null | undefined;

function normalizeNotifications(payload: unknown) {
  if (!payload || typeof payload !== 'object') return { notifications: [] as NotificationDto[], unreadCount: 0 };
  const record = payload as { notifications?: unknown; unreadCount?: unknown };
  return {
    notifications: Array.isArray(record.notifications) ? record.notifications as NotificationDto[] : [],
    unreadCount: typeof record.unreadCount === 'number' ? record.unreadCount : 0,
  };
}

function notificationMetadata(notification: NotificationDto): NotificationMetadata {
  return notification.metadata && typeof notification.metadata === 'object' ? notification.metadata as NotificationMetadata : null;
}

function quotedText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? `“${value.trim()}”` : fallback;
}

function tradeTitleFromNotification(notification: NotificationDto) {
  return quotedText(notificationMetadata(notification)?.tradeTitle, 'this trade');
}

function ticketSubjectFromNotification(notification: NotificationDto) {
  return quotedText(notificationMetadata(notification)?.ticketSubject, 'your support ticket');
}

function statusLabelFromNotification(notification: NotificationDto, t: (key: string) => string) {
  const metadata = notificationMetadata(notification);
  if (typeof metadata?.status === 'string' && metadata.status.trim()) {
    const key = `account.notifications.statuses.${metadata.status.trim()}`;
    const localized = t(key);
    if (localized !== key) return localized;
  }
  if (typeof metadata?.statusLabel === 'string' && metadata.statusLabel.trim()) return metadata.statusLabel.trim();
  return t('account.notifications.statuses.updated');
}

function notificationTitle(type: InAppNotificationType, fallback: string, t: (key: string) => string) {
  const key = `account.notifications.types.${type}`;
  const localized = t(key);
  return localized === key ? fallback : localized;
}

function notificationBody(notification: NotificationDto, t: (key: string, values?: Record<string, string>) => string) {
  const key = `account.notifications.messages.${notification.type}`;
  const localized = t(key, {
    tradeTitle: tradeTitleFromNotification(notification),
    ticketSubject: ticketSubjectFromNotification(notification),
    statusLabel: statusLabelFromNotification(notification, t),
  });
  return localized === key ? notification.body : localized;
}

function notificationTone(type: InAppNotificationType) {
  if (type === 'trade_proposal_accepted') return 'success' as const;
  if (type === 'trade_proposal_declined' || type === 'trade_proposal_withdrawn') return 'warning' as const;
  if (type === 'support_ticket_updated') return 'info' as const;
  if (type === 'content_moderation_updated') return 'danger' as const;
  if (type === 'trade_status_updated') return 'time' as const;
  return 'proposal' as const;
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function NotificationsScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.notifications.mine({ take: 80, unreadOnly: false });
      const normalized = normalizeNotifications(response);
      setNotifications(normalized.notifications);
      setUnreadCount(normalized.unreadCount);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('account.notifications.loadError')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void loadNotifications(); }, [loadNotifications]));

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter((notification) => !notification.readAt);
    return notifications;
  }, [filter, notifications]);

  const unreadLabel = useMemo(() => t('account.notifications.unreadCount', { count: unreadCount }), [t, unreadCount]);
  const totalLabel = useMemo(() => t('account.notifications.totalCount', { count: notifications.length }), [t, notifications.length]);

  async function markRead(notification: NotificationDto) {
    if (notification.readAt) return;
    try {
      await api.notifications.markRead(notification.id);
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('account.notifications.markError')));
    }
  }

  async function markAllRead() {
    if (unreadCount <= 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await api.notifications.markAllRead();
      const now = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      setUnreadCount(0);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('account.notifications.markError')));
    } finally {
      setMarkingAll(false);
    }
  }

  function openNotification(notification: NotificationDto) {
    void markRead(notification);
    if (notification.supportTicketId) {
      navigation.navigate('SupportTicketDetail', { ticketId: notification.supportTicketId });
      return;
    }
    if (notification.proposalId) {
      navigation.navigate('ProposalDetail', { proposalId: notification.proposalId });
      return;
    }
    if (notification.tradeId) {
      navigation.navigate('TradeDetail', { tradeId: notification.tradeId });
    }
  }

  const emptyTitle = filter === 'unread' ? t('account.notifications.emptyUnreadTitle') : t('account.notifications.emptyTitle');
  const emptyBody = filter === 'unread' ? t('account.notifications.emptyUnreadBody') : t('account.notifications.emptyBody');

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('account.notifications.title')} onBack={() => navigation.goBack()} /> }>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadNotifications(); }} />}>
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <SemanticBadge label={unreadLabel} tone={unreadCount > 0 ? 'proposal' : 'instruction'} />
            <SemanticBadge label={totalLabel} tone="instruction" />
          </View>
          <AppText style={styles.title}>{t('account.notifications.title')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.notifications.body')}</AppText>
        </View>

        <View style={styles.filterRow}>
          <NotificationFilterPill label={t('account.notifications.filters.all')} active={filter === 'all'} count={notifications.length} onPress={() => setFilter('all')} />
          <NotificationFilterPill label={t('account.notifications.filters.unread')} active={filter === 'unread'} count={unreadCount} onPress={() => setFilter('unread')} />
        </View>

        {error ? <InfoNotice tone="danger" title={t('account.notifications.loadError')} body={error} /> : null}

        {unreadCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => { void markAllRead(); }} disabled={markingAll} style={({ pressed }) => [styles.markAllButton, { backgroundColor: theme.color.text }, (pressed || markingAll) && styles.pressed]}>
            {markingAll ? <ActivityIndicator color={theme.color.background} /> : <AppText style={[styles.markAllButtonText, { color: theme.color.background }]}>{t('account.notifications.markAllRead')}</AppText>}
          </Pressable>
        ) : null}

        <InfoNotice tone="info" title={t('account.notifications.privacyTitle')} body={t('account.notifications.privacyBody')} />

        {loading && notifications.length === 0 ? (
          <AppCard style={styles.loadingCard}>
            <ActivityIndicator color={theme.color.text} />
            <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{t('account.notifications.loading')}</AppText>
          </AppCard>
        ) : null}

        {!loading && filteredNotifications.length === 0 ? (
          <AppCard style={styles.emptyCard}>
            <MobileIcon name="bell" size={30} color={theme.color.text} />
            <AppText style={styles.emptyTitle}>{emptyTitle}</AppText>
            <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{emptyBody}</AppText>
          </AppCard>
        ) : filteredNotifications.map((notification) => {
          const unread = !notification.readAt;
          const tone = notificationTone(notification.type);
          const semantic = theme.semantic[tone];
          return (
            <Pressable key={notification.id} accessibilityRole="button" onPress={() => openNotification(notification)} style={({ pressed }) => [styles.notificationCard, { backgroundColor: unread ? semantic.softBg : theme.color.surface, borderColor: unread ? semantic.border : theme.color.border }, pressed && styles.pressed]}>
              <View style={[styles.notificationIcon, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}>
                <MobileIcon name={notification.supportTicketId ? 'help' : notification.tradeId ? 'trade' : 'bell'} size={18} color={semantic.text} />
              </View>
              <View style={styles.notificationCopy}>
                <View style={styles.notificationMetaRow}>
                  <SemanticBadge label={unread ? t('account.notifications.unread') : t('account.notifications.read')} tone={unread ? tone : 'instruction'} size="sm" />
                  <AppText style={[styles.notificationTime, { color: theme.color.muted }]}>{formatNotificationTime(notification.createdAt)}</AppText>
                </View>
                <AppText style={styles.notificationTitle}>{notificationTitle(notification.type, notification.title, t)}</AppText>
                <AppText style={[styles.notificationBody, { color: theme.color.muted }]}>{notificationBody(notification, t)}</AppText>
              </View>
              <MobileIcon name="chevron-right" size={22} color={theme.color.muted} />
            </Pressable>
          );
        })}
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function NotificationFilterPill({ label, active, count, onPress }: { label: string; active: boolean; count: number; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.filterPill, { backgroundColor: active ? theme.color.text : theme.color.surface, borderColor: active ? theme.color.text : theme.color.border }, pressed && styles.pressed]}>
      <AppText style={[styles.filterPillText, { color: active ? theme.color.background : theme.color.text }]}>{label}</AppText>
      <View style={[styles.filterPillCount, { backgroundColor: active ? theme.color.background : theme.color.subtleSurface }]}>
        <AppText style={[styles.filterPillCountText, { color: active ? theme.color.text : theme.color.muted }]}>{count}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 10 },
  filterPill: { flex: 1, minHeight: 44, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  filterPillText: { fontWeight: '900' },
  filterPillCount: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  filterPillCountText: { fontSize: 12, fontWeight: '900' },
  markAllButton: { borderRadius: 18, paddingVertical: 13, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  markAllButtonText: { fontWeight: '900' },
  loadingCard: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  emptyCard: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  emptyBody: { fontWeight: '700', lineHeight: 20, textAlign: 'center' },
  notificationCard: { minHeight: 102, borderRadius: 22, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  notificationIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notificationCopy: { flex: 1, gap: 5 },
  notificationMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  notificationTime: { fontSize: 12, fontWeight: '800' },
  notificationTitle: { fontSize: 17, fontWeight: '900' },
  notificationBody: { lineHeight: 19, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
