import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppSettings } from '@hellowhen/contracts';

import { AppText } from '../../components/AppText';
import { useAppSettings } from '../../providers/AppSettingsProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useAppUpdatePolicy } from './AppUpdatePolicyProvider';
import { openAppUpdateStore } from './appUpdateStore';

type AppearancePreference = AppSettings['appearance'];

type AppearanceOption = {
  value: AppearancePreference;
  labelKey: string;
};

const UPDATE_ILLUSTRATIONS = {
  light: require('../../../assets/app-update/light/update-available-light.png'),
  dark: require('../../../assets/app-update/dark/update-available-dark.png'),
} as const;

// Match the sampled outer-edge colors of the bundled artwork so the square PNG
// visually dissolves into the full-screen prompt instead of reading as a card.
const UPDATE_BACKGROUNDS = {
  light: '#FEFEFE',
  dark: '#090E24',
} as const;

const APPEARANCE_OPTIONS = [
  { value: 'system', labelKey: 'onboarding.preferences.appearanceOptions.system' },
  { value: 'light', labelKey: 'onboarding.preferences.appearanceOptions.light' },
  { value: 'dark', labelKey: 'onboarding.preferences.appearanceOptions.dark' },
] as const satisfies readonly AppearanceOption[];

export function AppUpdatePrompt() {
  const theme = useThemeTokens();
  const { settings, setSettings } = useAppSettings();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const {
    policy,
    shouldPrompt,
    isMandatory,
    dismissOptionalUpdate,
  } = useAppUpdatePolicy();
  const [openingStore, setOpeningStore] = useState(false);
  const [storeError, setStoreError] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  const target = policy?.latest ?? policy?.minimumSupported ?? null;
  const targetKey = policy && target ? `${policy.platform}:${target.version}:${target.build}` : null;
  const visible = Boolean(shouldPrompt && policy && target);

  const title = isMandatory
    ? t('appUpdate.mandatory.title')
    : t('appUpdate.optional.title');
  const body = isMandatory
    ? t('appUpdate.mandatory.body')
    : t('appUpdate.optional.body');
  const releaseNotes = policy?.releaseNotes?.trim() || null;
  const updateIllustration = UPDATE_ILLUSTRATIONS[theme.mode];
  const updateBackground = UPDATE_BACKGROUNDS[theme.mode];
  const appearanceTitle = t('onboarding.preferences.appearanceTitle');
  const currentAppearance = APPEARANCE_OPTIONS.find((option) => option.value === settings.appearance) ?? APPEARANCE_OPTIONS[0];
  const currentAppearanceLabel = t(currentAppearance.labelKey);
  const appearanceSummary = `${appearanceTitle} · ${currentAppearanceLabel}`;
  const usableHeight = Math.max(0, windowHeight - insets.top - insets.bottom);
  const compactHeight = usableHeight < 720;
  const illustrationSize = Math.max(180, Math.min(windowWidth - 56, compactHeight ? 220 : 280));

  useEffect(() => {
    setOpeningStore(false);
    setStoreError(false);
    setAppearanceOpen(false);
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

  const selectAppearance = useCallback((appearance: AppearancePreference) => {
    setSettings({ ...settings, appearance });
    setAppearanceOpen(false);
  }, [setSettings, settings]);

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
      transparent={false}
      visible={visible}
    >
      <StatusBar
        backgroundColor={updateBackground}
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        translucent
      />
      <View
        accessibilityViewIsModal
        style={[
          styles.screen,
          {
            backgroundColor: updateBackground,
            paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 8 : 0),
          },
        ]}
      >
        <ScrollView
          bounces={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
        >
          <View accessibilityRole="alert" style={styles.content}>
            <View style={styles.hero}>
              <Image
                accessibilityIgnoresInvertColors
                accessible={false}
                importantForAccessibility="no"
                resizeMode="contain"
                source={updateIllustration}
                style={[styles.illustration, { height: illustrationSize, width: illustrationSize }]}
              />
            </View>

            <View style={styles.copy}>
              <View style={styles.headingCopy}>
                <AppText style={[styles.title, { color: theme.color.text }]}>{title}</AppText>
                <AppText style={[styles.body, { color: theme.color.muted }]}>{body}</AppText>
              </View>

              <View style={styles.metaRow}>
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

                <Pressable
                  accessibilityLabel={appearanceSummary}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: appearanceOpen }}
                  onPress={() => setAppearanceOpen((value) => !value)}
                  style={({ pressed }) => [
                    styles.appearancePill,
                    {
                      backgroundColor: theme.color.subtleSurface,
                      borderColor: theme.color.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText numberOfLines={1} style={[styles.appearancePillText, { color: theme.color.text }]}>
                    {appearanceSummary}
                  </AppText>
                  <AppText style={[styles.appearanceChevron, { color: theme.color.muted }]}>
                    {appearanceOpen ? '⌃' : '⌄'}
                  </AppText>
                </Pressable>
              </View>

              {appearanceOpen ? (
                <View
                  style={[
                    styles.appearancePanel,
                    {
                      backgroundColor: theme.color.subtleSurface,
                      borderColor: theme.color.border,
                    },
                  ]}
                >
                  <AppText style={[styles.appearancePanelTitle, { color: theme.color.text }]}>
                    {appearanceTitle}
                  </AppText>
                  <View style={styles.appearanceOptions}>
                    {APPEARANCE_OPTIONS.map((option) => {
                      const selected = settings.appearance === option.value;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          key={option.value}
                          onPress={() => selectAppearance(option.value)}
                          style={({ pressed }) => [
                            styles.appearanceOption,
                            {
                              backgroundColor: selected ? theme.color.text : theme.color.surface,
                              borderColor: selected ? theme.color.text : theme.color.border,
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <AppText
                            style={[
                              styles.appearanceOptionText,
                              { color: selected ? theme.color.background : theme.color.text },
                            ]}
                          >
                            {t(option.labelKey)}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

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
          </View>
        </ScrollView>

        <View
          style={[
            styles.actionsDock,
            {
              backgroundColor: updateBackground,
              borderTopColor: theme.color.border,
              paddingBottom: Math.max(16, insets.bottom + (Platform.OS === 'android' ? 8 : 0)),
            },
          ]}
        >
          <View style={styles.actions}>
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
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: 16,
  },
  hero: {
    width: '100%',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  illustration: {
    flexShrink: 0,
  },
  copy: {
    gap: 14,
  },
  headingCopy: {
    gap: 7,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.55,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  versionPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  appearancePill: {
    minHeight: 34,
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appearancePillText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
  },
  appearanceChevron: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
  },
  appearancePanel: {
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  appearancePanelTitle: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  appearanceOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  appearanceOption: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  appearanceOptionText: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
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
  actionsDock: {
    width: '100%',
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  actions: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    minHeight: 54,
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
