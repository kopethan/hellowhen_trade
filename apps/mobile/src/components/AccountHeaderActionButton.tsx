import React, { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeaderActionButton } from './AppHeaderActionButton';
import { api } from '../lib/api';
import { useAuth } from '../providers/AuthProvider';
import { useTranslation } from '../providers/MobileI18nProvider';
import { UserAvatar } from '../features/users/UserAvatar';

type AccountHeaderActionButtonProps = {
  onPress: () => void;
};

export function AccountHeaderActionButton({ onPress }: AccountHeaderActionButtonProps) {
  const auth = useAuth();
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    let requestSequence = 0;

    if (!auth.isAuthenticated) {
      setUnreadCount(0);
      return () => { active = false; };
    }

    const loadUnreadCount = async () => {
      const requestId = ++requestSequence;
      try {
        const response = await api.notifications.unreadCount();
        if (active && requestId === requestSequence) {
          setUnreadCount(Math.max(0, Math.trunc(response.unreadCount ?? 0)));
        }
      } catch {
        // Preserve the last known badge on transient refresh failures.
      }
    };

    void loadUnreadCount();
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void loadUnreadCount();
    });

    return () => {
      active = false;
      requestSequence += 1;
      appStateSubscription.remove();
    };
  }, [auth.isAuthenticated, auth.user?.id]));

  const profile = auth.user?.profile;
  const hasAvatar = Boolean(profile?.avatarUrl?.trim());
  const accessibilityLabel = unreadCount > 0
    ? `${t('navigation.routes.account')} · ${t('account.notifications.unreadCount', { count: unreadCount })}`
    : t('navigation.routes.account');

  return (
    <AppHeaderActionButton
      icon="profile"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      badgeCount={unreadCount}
      content={hasAvatar ? (
        <UserAvatar
          src={profile?.avatarUrl}
          displayName={profile?.displayName}
          handle={profile?.handle}
          size="md"
          decorative
          style={{ borderWidth: 0 }}
        />
      ) : undefined}
    />
  );
}
