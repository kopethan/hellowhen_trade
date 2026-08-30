import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { SemanticColorName } from '@hellowhen/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { AppHeader } from '../AppHeader';
import { AppText } from '../AppText';

type LibraryFilterScreenProps = {
  visible: boolean;
  title: string;
  body?: string;
  children: React.ReactNode;
  closeAccessibilityLabel: string;
  resetLabel: string;
  applyLabel: string;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  tone?: SemanticColorName;
  resetDisabled?: boolean;
  applyDisabled?: boolean;
};

export function LibraryFilterScreen({
  visible,
  title,
  body,
  children,
  closeAccessibilityLabel,
  resetLabel,
  applyLabel,
  onClose,
  onReset,
  onApply,
  tone,
  resetDisabled = false,
  applyDisabled = false,
}: LibraryFilterScreenProps) {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const semantic = tone ? theme.semantic[tone] : theme.semantic.info;

  return (
    <Modal
      animationType={reducedMotion ? 'none' : 'slide'}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      transparent={false}
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        style={[
          styles.screen,
          {
            backgroundColor: theme.color.background,
            paddingTop: Math.max(insets.top, 10),
          },
        ]}
      >
        <View style={styles.headerWrap}>
          <AppHeader
            title={title}
            onBack={onClose}
            backAccessibilityLabel={closeAccessibilityLabel}
            rightSlot={(
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={resetLabel}
                accessibilityState={{ disabled: resetDisabled }}
                disabled={resetDisabled}
                onPress={onReset}
                style={({ pressed }) => [
                  styles.resetAction,
                  { borderColor: theme.color.border, backgroundColor: theme.color.surface },
                  pressed && !resetDisabled && styles.pressed,
                  resetDisabled && styles.disabled,
                ]}
              >
                <AppText style={[styles.resetActionText, { color: theme.color.text }]}>{resetLabel}</AppText>
              </Pressable>
            )}
          />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 28 + Math.max(insets.bottom, 8) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {body ? <AppText style={[styles.body, { color: theme.color.muted }]}>{body}</AppText> : null}
          {children}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.color.background,
              borderTopColor: theme.color.border,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={applyLabel}
            accessibilityState={{ disabled: applyDisabled }}
            disabled={applyDisabled}
            onPress={onApply}
            style={({ pressed }) => [
              styles.applyButton,
              { backgroundColor: semantic.bg, borderColor: semantic.bg },
              pressed && !applyDisabled && styles.pressed,
              applyDisabled && styles.disabled,
            ]}
          >
            <AppText style={[styles.applyText, { color: semantic.onBg }]}>{applyLabel}</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  resetAction: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetActionText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 22,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  applyButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
