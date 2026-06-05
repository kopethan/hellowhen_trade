import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useThemeTokens } from '../providers/ThemeProvider';
import { AppText } from './AppText';

export type AppConfirmSheetTone = 'default' | 'danger';

type AppConfirmSheetProps = {
  visible: boolean;
  title: string;
  body?: string;
  cancelLabel: string;
  confirmLabel: string;
  tone?: AppConfirmSheetTone;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AppConfirmSheet({
  visible,
  title,
  body,
  cancelLabel,
  confirmLabel,
  tone = 'default',
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: AppConfirmSheetProps) {
  const theme = useThemeTokens();
  const confirmColors = tone === 'danger'
    ? theme.semantic.danger
    : theme.semantic.proposal;

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={styles.backdrop}>
        <Pressable
          accessibilityRole="alert"
          onPress={(event) => event.stopPropagation()}
          style={[styles.sheet, { backgroundColor: theme.color.elevated, borderColor: theme.color.border }]}
        >
          <View style={styles.copy}>
            <AppText style={[styles.title, { color: theme.color.text }]}>{title}</AppText>
            {body ? <AppText style={[styles.body, { color: theme.color.muted }]}>{body}</AppText> : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                { backgroundColor: theme.color.surface, borderColor: theme.color.border },
                pressed && styles.pressed,
              ]}
            >
              <AppText style={[styles.cancelText, { color: theme.color.text }]}>{cancelLabel}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={confirmDisabled}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                { backgroundColor: confirmColors.softBg, borderColor: confirmColors.border },
                pressed && !confirmDisabled && styles.pressed,
                confirmDisabled && styles.disabled,
              ]}
            >
              <AppText style={[styles.confirmText, { color: confirmColors.text }]}>{confirmLabel}</AppText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 6, 23, 0.66)',
    padding: 14,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    gap: 18,
  },
  copy: {
    gap: 8,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  cancelButton: {
    flex: 0.9,
  },
  confirmButton: {
    flex: 1.1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '900',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
});
