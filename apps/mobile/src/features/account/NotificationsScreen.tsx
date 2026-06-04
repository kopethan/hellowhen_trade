import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InAppNotificationType, NotificationDto } from '@hellowhen/contracts';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { DetailEmptyState } from '../../components/detail';
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

type NotificationGroup = {
  key: string;
  label: string;
  notifications: NotificationDto[];
};

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

function notificationTitle(type: InAppNotificationType, t: (key: string) => string) {
  const key = `account.notifications.types.${type}`;
  const localized = t(key);
  return localized === key ? t('account.notifications.safeTitle') : localized;
}

function notificationBody(notification: NotificationDto, t: (key: string, values?: Record<string, string>) => string) {
  const key = `account.notifications.messages.${notification.type}`;
  const localized = t(key, {
    tradeTitle: tradeTitleFromNotification(notification),
    ticketSubject: ticketSubjectFromNotification(notification),
    statusLabel: statusLabelFromNotification(notification, t),
  });
  return localized === key ? t('account.notifications.safeBody') : localized;
}

function notificationTone(type: InAppNotificationType) {
  if (type === 'trade_proposal_accepted') return 'success' as const;
  if (type === 'trade_proposal_declined' || type === 'trade_proposal_withdrawn') return 'warning' as const;
  if (type === 'support_ticket_updated') return 'info' as const;
  if (type === 'content_moderation_updated') return 'danger' as const;
  if (type === 'trade_status_updated') return 'time' as const;
  return 'proposal' as const;
}

function notificationIcon(notification: NotificationDto) {
  if (notification.supportTicketId) return 'help' as const;
  if (notification.proposalId) return 'proposal' as const;
  if (notification.tradeId) return 'trade' as const;
  return 'bell' as const;
}

function parseNotificationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatNotificationClock(value: string) {
  const date = parseNotificationDate(value);
  if (!date) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function sectionKeyForDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function notificationSectionLabel(date: Date, t: (key: string) => string) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameLocalDay(date, today)) return t('account.notifications.sections.today');
  if (isSameLocalDay(date, yesterday)) return t('account.notifications.sections.yesterday');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function groupNotifications(notifications: NotificationDto[], t: (key: string) => string): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  notifications.forEach((notification) => {
    const date = parseNotificationDate(notification.createdAt) ?? new Date(0);
    const key = sectionKeyForDate(date);
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, label: notificationSectionLabel(date, t), notifications: [] };
      groups.push(group);
    }
    group.notifications.push(notification);
  });
  return groups;
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
  const loadRequestIdRef = useRef(0);
  const markingNotificationIdsRef = useRef(new Set<string>());

  const loadNotifications = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const response = await api.notifications.mine({ take: 80, unreadOnly: false });
      if (requestId !== loadRequestIdRef.current) return;
      const normalized = normalizeNotifications(response);
      setNotifications(normalized.notifications);
      setUnreadCount(normalized.unreadCount);
    } catch (caughtError) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(getFriendlyApiErrorMessage(caughtError, t('account.notifications.loadError')));
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void loadNotifications(); }, [loadNotifications]));

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter((notification) => !notification.readAt);
    return notifications;
  }, [filter, notifications]);

  const groupedNotifications = useMemo(() => groupNotifications(filteredNotifications, t), [filteredNotifications, t]);
  const unreadLabel = useMemo(() => t('account.notifications.unreadCount', { count: unreadCount }), [t, unreadCount]);
  const totalLabel = useMemo(() => t('account.notifications.totalCount', { count: notifications.length }), [t, notifications.length]);

  async function markRead(notification: NotificationDto) {
    if (notification.readAt || markingNotificationIdsRef.current.has(notification.id)) return;
    markingNotificationIdsRef.current.add(notification.id);
    try {
      await api.notifications.markRead(notification.id);
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('account.notifications.markError')));
    } finally {
      markingNotificationIdsRef.current.delete(notification.id);
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

        <View style={styles.topControls}>
          <View style={styles.filterRow}>
            <NotificationFilterPill label={t('account.notifications.filters.all')} active={filter === 'all'} count={notifications.length} onPress={() => setFilter('all')} />
            <NotificationFilterPill label={t('account.notifications.filters.unread')} active={filter === 'unread'} count={unreadCount} onPress={() => setFilter('unread')} />
          </View>
          {unreadCount > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('account.notifications.markAllRead')} onPress={() => { void markAllRead(); }} disabled={markingAll} style={({ pressed }) => [styles.markAllButton, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, (pressed || markingAll) && styles.pressed]}>
              {markingAll ? <ActivityIndicator color={theme.color.text} /> : <AppText style={[styles.markAllButtonText, { color: theme.color.text }]}>{t('account.notifications.markAllRead')}</AppText>}
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.privacyStrip, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <MobileIcon name="warning" size={15} color={theme.color.muted} />
          <AppText style={[styles.privacyText, { color: theme.color.muted }]}>{t('account.notifications.privacyShort')}</AppText>
        </View>

        {error && notifications.length > 0 ? <InfoNotice tone="danger" title={t('account.notifications.loadError')} body={error} /> : null}

        {loading && notifications.length === 0 ? (
          <View style={[styles.loadingState, { borderColor: theme.color.border }]}>
            <ActivityIndicator color={theme.color.text} />
            <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{t('account.notifications.loading')}</AppText>
          </View>
        ) : null}

        {!loading && filteredNotifications.length === 0 ? (
          <DetailEmptyState
            icon={error ? 'warning' : 'bell'}
            title={error ? t('account.notifications.loadError') : emptyTitle}
            body={error ?? emptyBody}
            actionLabel={error ? t('common.actions.tryAgain') : undefined}
            onAction={error ? () => { void loadNotifications(); } : undefined}
          />
        ) : groupedNotifications.map((section) => (
          <View key={section.key} style={styles.notificationSection}>
            <AppText style={[styles.sectionTitle, { color: theme.color.muted }]}>{section.label}</AppText>
            <View style={[styles.notificationList, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
              {section.notifications.map((notification, index) => <NotificationRow key={notification.id} notification={notification} first={index === 0} onPress={() => openNotification(notification)} />)}
            </View>
          </View>
        ))}
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function NotificationFilterPill({ label, active, count, onPress }: { label: string; active: boolean; count: number; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} · ${count}`} accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.filterPill, { backgroundColor: active ? theme.color.text : theme.color.surface, borderColor: active ? theme.color.text : theme.color.border }, pressed && styles.pressed]}>
      <AppText style={[styles.filterPillText, { color: active ? theme.color.background : theme.color.text }]}>{label}</AppText>
      <View style={[styles.filterPillCount, { backgroundColor: active ? theme.color.background : theme.color.subtleSurface }]}>
        <AppText style={[styles.filterPillCountText, { color: active ? theme.color.text : theme.color.muted }]}>{count}</AppText>
      </View>
    </Pressable>
  );
}

function NotificationRow({ notification, first, onPress }: { notification: NotificationDto; first?: boolean; onPress: () => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const unread = !notification.readAt;
  const tone = notificationTone(notification.type);
  const semantic = theme.semantic[tone];

  const title = notificationTitle(notification.type, t);
  const body = notificationBody(notification, t);
  const accessibilityLabel = [title, unread ? t('account.notifications.unread') : t('account.notifications.read'), formatNotificationClock(notification.createdAt)].filter(Boolean).join(' · ');

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={t('account.notifications.open')} onPress={onPress} style={({ pressed }) => [styles.notificationRow, !first && { borderTopColor: theme.color.border, borderTopWidth: StyleSheet.hairlineWidth }, pressed && styles.pressed]}>
      <View style={[styles.notificationIcon, { backgroundColor: unread ? semantic.softBg : theme.color.subtleSurface, borderColor: unread ? semantic.border : theme.color.border }]}>
        <MobileIcon name={notificationIcon(notification)} size={18} color={unread ? semantic.text : theme.color.muted} />
      </View>
      <View style={styles.notificationCopy}>
        <View style={styles.notificationTopRow}>
          <AppText style={styles.notificationTitle}>{title}</AppText>
          {unread ? <View style={[styles.unreadDot, { backgroundColor: semantic.text }]} /> : null}
        </View>
        <AppText style={[styles.notificationBody, { color: theme.color.muted }]}>{body}</AppText>
        <View style={styles.notificationMetaRow}>
          <AppText style={[styles.notificationTime, { color: theme.color.muted }]}>{formatNotificationClock(notification.createdAt)}</AppText>
          <SemanticBadge label={unread ? t('account.notifications.unread') : t('account.notifications.read')} tone={unread ? tone : 'instruction'} size="sm" />
        </View>
      </View>
      <MobileIcon name="chevron-right" size={21} color={theme.color.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  topControls: { gap: 10 },
  filterRow: { flexDirection: 'row', gap: 10 },
  filterPill: { flex: 1, minHeight: 44, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  filterPillText: { fontWeight: '900' },
  filterPillCount: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  filterPillCountText: { fontSize: 12, fontWeight: '900' },
  markAllButton: { alignSelf: 'flex-end', minHeight: 40, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  markAllButtonText: { fontWeight: '900' },
  privacyStrip: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  loadingState: { minHeight: 116, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyBody: { fontWeight: '700', lineHeight: 20, textAlign: 'center' },
  notificationSection: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  notificationList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  notificationRow: { minHeight: 94, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  notificationIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notificationCopy: { flex: 1, gap: 5 },
  notificationTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationTitle: { flex: 1, fontSize: 17, fontWeight: '900' },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  notificationBody: { lineHeight: 19, fontWeight: '700' },
  notificationMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  notificationTime: { fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
