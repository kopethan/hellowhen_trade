'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { InAppNotificationType, NotificationDto } from '@hellowhen/contracts';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { formatDateTime } from './accountPresentation';

type NotificationMetadata = { tradeTitle?: unknown } | null | undefined;

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

function tradeTitleFromNotification(notification: NotificationDto) {
  const value = notificationMetadata(notification)?.tradeTitle;
  return typeof value === 'string' && value.trim() ? `“${value.trim()}”` : 'this trade';
}

function notificationTitle(type: InAppNotificationType, fallback: string, t: (key: string) => string) {
  const key = `account.notifications.types.${type}`;
  const localized = t(key);
  return localized === key ? fallback : localized;
}

function notificationBody(notification: NotificationDto, t: (key: string, values?: Record<string, string>) => string) {
  const key = `account.notifications.messages.${notification.type}`;
  const localized = t(key, { tradeTitle: tradeTitleFromNotification(notification) });
  return localized === key ? notification.body : localized;
}

export function NotificationsClient() {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  async function load() {
    if (!auth.hydrated || !auth.isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await api.notifications.mine({ take: 50, unreadOnly: false });
      const normalized = normalizeNotifications(payload);
      setNotifications(normalized.notifications);
      setUnreadCount(normalized.unreadCount);
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, t('account.notifications.loadError')));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [auth.hydrated, auth.isAuthenticated]);

  async function markRead(notificationId: string) {
    setUpdating(true);
    setError(null);
    try {
      await api.notifications.markRead(notificationId);
      setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, t('account.notifications.markError')));
    } finally {
      setUpdating(false);
    }
  }

  async function markAllRead() {
    setUpdating(true);
    setError(null);
    try {
      await api.notifications.markAllRead();
      const now = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      setUnreadCount(0);
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, t('account.notifications.markError')));
    } finally {
      setUpdating(false);
    }
  }

  const hasNotifications = notifications.length > 0;
  const unreadLabel = useMemo(() => t('account.notifications.unreadCount', { count: unreadCount }), [t, unreadCount]);

  if (!auth.hydrated || loading) {
    return <section className="mobile-card mobile-card--soft"><p>{t('account.notifications.loading')}</p></section>;
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
        <h3>{t('account.signedOut.title')}</h3>
        <p>{t('account.signedOut.body')}</p>
        <Link href="/auth?next=/account/notifications" className="button primary">{t('common.actions.loginOrRegister')}</Link>
      </section>
    );
  }

  return (
    <div className="notifications-panel">
      <section className="mobile-card mobile-card--soft notifications-summary-card">
        <div>
          <span className={unreadCount > 0 ? 'semantic-badge proposal' : 'semantic-badge instruction'}>{unreadLabel}</span>
          <h3>{t('account.notifications.title')}</h3>
          <p>{t('account.notifications.body')}</p>
        </div>
        {unreadCount > 0 ? <button className="button secondary" disabled={updating} onClick={() => { void markAllRead(); }}>{t('account.notifications.markAllRead')}</button> : null}
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      {!hasNotifications ? (
        <section className="mobile-card mobile-card--soft notification-empty-state">
          <WebIcon name="bell" size={28} decorative />
          <h3>{t('account.notifications.emptyTitle')}</h3>
          <p>{t('account.notifications.emptyBody')}</p>
        </section>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => {
            const isUnread = !notification.readAt;
            const content = (
              <>
                <span className={isUnread ? 'notification-dot notification-dot--unread' : 'notification-dot'} aria-hidden="true" />
                <span className="notification-card__copy">
                  <span className="notification-card__meta">
                    <span className={isUnread ? 'semantic-badge proposal' : 'semantic-badge instruction'}>{isUnread ? t('account.notifications.unread') : t('account.notifications.read')}</span>
                    <span>{formatDateTime(notification.createdAt, language)}</span>
                  </span>
                  <strong>{notificationTitle(notification.type, notification.title, t)}</strong>
                  <span>{notificationBody(notification, t)}</span>
                </span>
                <span className="notification-card__actions">
                  {!notification.targetPath && isUnread ? <button className="button tiny" disabled={updating} onClick={() => { void markRead(notification.id); }}>{t('account.notifications.markRead')}</button> : null}
                  {notification.targetPath ? <span className="button tiny">{t('account.notifications.open')}</span> : null}
                </span>
              </>
            );
            return notification.targetPath ? (
              <Link key={notification.id} href={notification.targetPath} className={isUnread ? 'notification-card notification-card--unread' : 'notification-card'} onClick={() => { if (isUnread) void markRead(notification.id); }}>
                {content}
              </Link>
            ) : (
              <div key={notification.id} className={isUnread ? 'notification-card notification-card--unread' : 'notification-card'}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
