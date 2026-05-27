import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useThemeTokens } from '../providers/ThemeProvider';
import { AppText } from './AppText';
import { MobileIcon, type MobileIconName } from './MobileIcon';

export type AppActionSheetAction = {
  key: string;
  label: string;
  icon?: MobileIconName;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  helper?: string;
  onPress: () => void;
};

type AppActionSheetProps = {
  visible: boolean;
  title: string;
  body?: string;
  actions: AppActionSheetAction[];
  cancelLabel: string;
  onCancel?: () => void;
  onClose?: () => void;
};

function getActionColors(theme: ReturnType<typeof useThemeTokens>, action: AppActionSheetAction) {
  if (action.tone === 'danger') {
    return {
      backgroundColor: theme.semantic.warning.softBg,
      borderColor: theme.semantic.warning.border,
      color: theme.semantic.warning.text,
    };
  }

  if (action.tone === 'primary') {
    return {
      backgroundColor: theme.semantic.proposal.softBg,
      borderColor: theme.semantic.proposal.border,
      color: theme.semantic.proposal.text,
    };
  }

  return {
    backgroundColor: theme.color.subtleSurface,
    borderColor: theme.color.border,
    color: theme.color.text,
  };
}

export function AppActionSheet({ visible, title, body, actions, cancelLabel, onCancel, onClose }: AppActionSheetProps) {
  const theme = useThemeTokens();
  const close = onClose ?? onCancel ?? (() => undefined);

  return (
    <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
      <Pressable accessibilityRole="button" onPress={close} style={styles.backdrop}>
        <Pressable
          accessibilityRole="menu"
          onPress={(event) => event.stopPropagation()}
          style={[styles.sheet, { backgroundColor: theme.color.elevated, borderColor: theme.color.border }]}
        >
          <View style={styles.header}>
            <AppText style={styles.title}>{title}</AppText>
            {body ? <AppText style={[styles.body, { color: theme.color.muted }]}>{body}</AppText> : null}
          </View>

          <View style={styles.actions}>
            {actions.map((action) => {
              const colors = getActionColors(theme, action);
              return (
                <Pressable
                  accessibilityRole="menuitem"
                  disabled={action.disabled}
                  key={action.key}
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    styles.action,
                    { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor },
                    pressed && !action.disabled && styles.pressed,
                    action.disabled && styles.disabled,
                  ]}
                >
                  {action.icon ? <MobileIcon name={action.icon} color={colors.color} size={18} decorative /> : null}
                  <View style={styles.actionCopy}>
                    <AppText style={[styles.actionText, { color: colors.color }]}>{action.label}</AppText>
                    {action.helper ? <AppText style={[styles.actionHelper, { color: theme.color.muted }]}>{action.helper}</AppText> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={close}
            style={({ pressed }) => [styles.cancel, { borderColor: theme.color.border }, pressed && styles.pressed]}
          >
            <AppText style={[styles.cancelText, { color: theme.color.muted }]}>{cancelLabel}</AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 6, 23, 0.56)',
    padding: 14,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 16,
    gap: 14,
  },
  header: {
    gap: 6,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
  action: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionHelper: {
    fontSize: 12,
    lineHeight: 16,
  },
  cancel: {
    minHeight: 48,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
});
