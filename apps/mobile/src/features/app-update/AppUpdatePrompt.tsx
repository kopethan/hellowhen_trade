import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useAppUpdatePolicy } from './AppUpdatePolicyProvider';
import { openAppUpdateStore } from './appUpdateStore';

const APP_ICON = require('../../../assets/icon.png');

export function AppUpdatePrompt() {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const {
    policy,
    shouldPrompt,
    isMandatory,
    dismissOptionalUpdate,
  } = useAppUpdatePolicy();
  const [openingStore, setOpeningStore] = useState(false);
  const [storeError, setStoreError] = useState(false);

  const target = policy?.latest ?? policy?.minimumSupported ?? null;
  const targetKey = policy && target ? `${policy.platform}:${target.version}:${target.build}` : null;
  const visible = Boolean(shouldPrompt && policy && target);
  const maxHeight = Math.max(360, windowHeight - insets.top - insets.bottom - 32);

  const title = isMandatory
    ? t('appUpdate.mandatory.title')
    : t('appUpdate.optional.title');
  const body = isMandatory
    ? t('appUpdate.mandatory.body')
    : t('appUpdate.optional.body');
  const releaseNotes = policy?.releaseNotes?.trim() || null;

  useEffect(() => {
    setOpeningStore(false);
    setStoreError(false);
  }, [targetKey]);

  const versionLabel = useMemo(() => {
    if (!target) return '';
    return t('appUpdate.version', { version: target.version });
  }, [t, target]);

  const dismiss = useCallback(() => {
    if (isMandatory || openingStore) return;
    setStoreError(false);
    void dismissOptionalUpdate();
  }, [dismissOptionalUpdate, isMandatory, openingStore]);

  const openStore = useCallback(async () => {
    if (!policy || openingStore) return;
    setOpeningStore(true);
    setStoreError(false);

    try {
      await openAppUpdateStore(policy.platform, Linking.openURL);
    } catch {
      setStoreError(true);
    } finally {
      setOpeningStore(false);
    }
  }, [openingStore, policy]);

  if (!policy || !target) return null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={isMandatory ? () => undefined : dismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        style={[
          styles.backdrop,
          {
            paddingTop: Math.max(16, insets.top + 8),
            paddingBottom: Math.max(16, insets.bottom + (Platform.OS === 'android' ? 8 : 0)),
          },
        ]}
      >
        <View
          accessibilityRole="alert"
          style={[
            styles.card,
            {
              maxHeight,
              backgroundColor: theme.color.elevated,
              borderColor: theme.color.border,
            },
          ]}
        >
          <ScrollView
            bounces={false}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.visual,
                {
                  backgroundColor: theme.semantic.info.softBg,
                  borderColor: theme.semantic.info.border,
                },
              ]}
            >
              <View
                style={[
                  styles.iconFrame,
                  {
                    backgroundColor: theme.color.surface,
                    borderColor: theme.color.border,
                  },
                ]}
              >
                <Image
                  accessibilityIgnoresInvertColors
                  accessible={false}
                  importantForAccessibility="no"
                  resizeMode="cover"
                  source={APP_ICON}
                  style={styles.icon}
                />
              </View>
            </View>

            <View style={styles.copy}>
              <View style={styles.headingCopy}>
                <AppText style={[styles.title, { color: theme.color.text }]}>{title}</AppText>
                <AppText style={[styles.body, { color: theme.color.muted }]}>{body}</AppText>
              </View>

              <View
                style={[
                  styles.versionPill,
                  {
                    backgroundColor: theme.color.subtleSurface,
                    borderColor: theme.color.border,
                  },
                ]}
              >
                <AppText style={[styles.versionText, { color: theme.color.text }]}>{versionLabel}</AppText>
              </View>

              {releaseNotes ? (
                <View
                  style={[
                    styles.notes,
                    {
                      backgroundColor: theme.color.subtleSurface,
                      borderColor: theme.color.border,
                    },
                  ]}
                >
                  <AppText style={[styles.notesTitle, { color: theme.color.text }]}>
                    {t('appUpdate.releaseNotes')}
                  </AppText>
                  <AppText style={[styles.notesBody, { color: theme.color.muted }]}>{releaseNotes}</AppText>
                </View>
              ) : null}

              {storeError ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.errorBox,
                    {
                      backgroundColor: theme.semantic.danger.softBg,
                      borderColor: theme.semantic.danger.border,
                    },
                  ]}
                >
                  <AppText style={[styles.errorText, { color: theme.semantic.danger.text }]}>
                    {t('appUpdate.storeError')}
                  </AppText>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={[styles.actions, { borderTopColor: theme.color.border }]}>
            {!isMandatory ? (
              <Pressable
                accessibilityRole="button"
                disabled={openingStore}
                onPress={dismiss}
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.color.surface,
                    borderColor: theme.color.border,
                  },
                  pressed && !openingStore && styles.pressed,
                  openingStore && styles.disabled,
                ]}
              >
                <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>
                  {t('appUpdate.actions.later')}
                </AppText>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={openingStore}
              onPress={() => void openStore()}
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                { backgroundColor: theme.color.text },
                pressed && !openingStore && styles.pressed,
                openingStore && styles.disabled,
              ]}
            >
              <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>
                {openingStore ? t('appUpdate.actions.openingStore') : t('appUpdate.actions.update')}
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    borderWidth: 1,
    borderRadius: 30,
    overflow: 'hidden',
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 18,
    gap: 18,
  },
  visual: {
    minHeight: 154,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFrame: {
    width: 94,
    height: 94,
    padding: 5,
    borderWidth: 1,
    borderRadius: 27,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  icon: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
  },
  copy: {
    gap: 14,
  },
  headingCopy: {
    gap: 7,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.45,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  versionPill: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  notes: {
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  notesBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    padding: 16,
  },
  button: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButton: {
    flex: 0.9,
    borderWidth: 1,
  },
  primaryButton: {
    flex: 1.1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
