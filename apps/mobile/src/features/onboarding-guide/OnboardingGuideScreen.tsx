import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppSettings } from '@hellowhen/contracts';
import type { LanguagePreference } from '@hellowhen/i18n';

import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAppSettings } from '../../providers/AppSettingsProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { getOnboardingImageBackground, OnboardingSlideIllustration } from './OnboardingSlideIllustration';
import { markOnboardingGuideCompleted } from './onboardingGuideStorage';
import { ONBOARDING_GUIDE_SLIDES } from './onboardingGuide.slides';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingGuide'>;
type AppearancePreference = AppSettings['appearance'];

type PreferenceOption<T extends string> = {
  value: T;
  labelKey: string;
};

const languageOptions: Array<PreferenceOption<LanguagePreference>> = [
  { value: 'system', labelKey: 'onboarding.preferences.languageOptions.system' },
  { value: 'en', labelKey: 'onboarding.preferences.languageOptions.en' },
  { value: 'fr', labelKey: 'onboarding.preferences.languageOptions.fr' },
];

const appearanceOptions: Array<PreferenceOption<AppearancePreference>> = [
  { value: 'system', labelKey: 'onboarding.preferences.appearanceOptions.system' },
  { value: 'light', labelKey: 'onboarding.preferences.appearanceOptions.light' },
  { value: 'dark', labelKey: 'onboarding.preferences.appearanceOptions.dark' },
];

export function OnboardingGuideScreen({ navigation, route }: Props) {
  const theme = useThemeTokens();
  const { settings, setSettings } = useAppSettings();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const slide = ONBOARDING_GUIDE_SLIDES[currentIndex];
  const isCompactHeight = height < 700;
  const imageMode = theme.mode;
  const onboardingBackground = getOnboardingImageBackground(imageMode, slide.illustrationKey);
  const surfaceForPrimaryText = imageMode === 'dark' ? '#050506' : '#FFFFFF';
  const isLastSlide = currentIndex === ONBOARDING_GUIDE_SLIDES.length - 1;
  const isReplay = route.params?.replay === true;
  const progressLabel = t('onboarding.progress', { current: currentIndex + 1, total: ONBOARDING_GUIDE_SLIDES.length });
  const currentLanguageLabel = t(languageOptions.find((option) => option.value === settings.language)?.labelKey ?? languageOptions[0].labelKey);
  const currentAppearanceLabel = t(appearanceOptions.find((option) => option.value === settings.appearance)?.labelKey ?? appearanceOptions[0].labelKey);
  const preferencesSummary = t('onboarding.preferences.summary', { language: currentLanguageLabel, appearance: currentAppearanceLabel });
  const illustrationSize = useMemo(
    () => Math.max(210, Math.min(width - 40, isCompactHeight ? 250 : 330, height * 0.38)),
    [height, isCompactHeight, width]
  );

  async function closeGuide() {
    if (!isReplay) {
      await markOnboardingGuideCompleted().catch(() => undefined);
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('TradeTabs');
  }

  function goNext() {
    if (isLastSlide) {
      void closeGuide();
      return;
    }
    setCurrentIndex((value) => Math.min(value + 1, ONBOARDING_GUIDE_SLIDES.length - 1));
  }

  function goBack() {
    setCurrentIndex((value) => Math.max(value - 1, 0));
  }

  function updateOnboardingPreferences(patch: Partial<AppSettings>) {
    setSettings({ ...settings, ...patch });
  }

  function renderPreferenceOption<T extends string>(option: PreferenceOption<T>, selected: boolean, onPress: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        key={option.value}
        onPress={onPress}
        style={({ pressed }) => [
          styles.preferenceOption,
          {
            backgroundColor: selected ? theme.color.text : theme.color.surface,
            borderColor: selected ? theme.color.text : theme.color.border,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.preferenceOptionText, { color: selected ? surfaceForPrimaryText : theme.color.text }]}>
          {t(option.labelKey)}
        </Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView accessibilityLabel={t('onboarding.ariaLabel')} style={[styles.screen, { backgroundColor: onboardingBackground }]}>
      <View style={[styles.topBar, { backgroundColor: onboardingBackground }]}>
        <Text style={[styles.brand, { color: theme.color.text }]}>Hellowhen</Text>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => { void closeGuide(); }} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
          <Text style={[styles.skipText, { color: theme.color.muted }]}>{t('onboarding.actions.skip')}</Text>
        </Pressable>
      </View>

      <View style={[styles.preferenceBar, { backgroundColor: onboardingBackground }]}>
        <Pressable
          accessibilityLabel={t('onboarding.preferences.openAccessibilityLabel')}
          accessibilityRole="button"
          onPress={() => setPreferencesOpen(true)}
          style={({ pressed }) => [
            styles.preferencePill,
            { backgroundColor: theme.color.surface, borderColor: theme.color.border },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.preferencePillText, { color: theme.color.text }]}>{preferencesSummary}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ backgroundColor: onboardingBackground }}
        contentContainerStyle={[styles.scrollContent, { backgroundColor: onboardingBackground, paddingTop: isCompactHeight ? 10 : 22 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.slideWrap, { backgroundColor: onboardingBackground }]}>
          <OnboardingSlideIllustration
            slide={slide}
            mode={imageMode}
            backgroundColor={onboardingBackground}
            frameSize={illustrationSize}
          />

          <Text style={[styles.caption, { color: theme.color.muted }]}>{t(slide.illustrationCaptionKey)}</Text>
          <Text style={[styles.stepLabel, { color: theme.color.text }]}>{progressLabel}</Text>
          <Text style={[styles.title, { color: theme.color.text }]}>{t(slide.titleKey)}</Text>
          <Text style={[styles.body, { color: theme.color.muted }]}>{t(slide.bodyKey)}</Text>

          <View accessibilityLabel={progressLabel} style={styles.dotsRow}>
            {ONBOARDING_GUIDE_SLIDES.map((item, index) => {
              const active = index === currentIndex;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.dot,
                    active ? styles.activeDot : null,
                    { backgroundColor: active ? theme.color.text : theme.color.border },
                  ]}
                />
              );
            })}
          </View>

          <Text style={[styles.stepLabelMuted, { color: theme.color.muted }]}>{progressLabel}</Text>
        </View>
      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setPreferencesOpen(false)} transparent visible={preferencesOpen}>
        <Pressable accessibilityRole="button" onPress={() => setPreferencesOpen(false)} style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel={t('onboarding.preferences.title')}
            onPress={() => undefined}
            style={[styles.preferenceSheet, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}
          >
            <View style={styles.preferenceSheetHeader}>
              <View>
                <Text style={[styles.preferenceSheetTitle, { color: theme.color.text }]}>{t('onboarding.preferences.title')}</Text>
                <Text style={[styles.preferenceSheetBody, { color: theme.color.muted }]}>{t('onboarding.preferences.body')}</Text>
              </View>
              <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setPreferencesOpen(false)} style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}>
                <Text style={[styles.closeButtonText, { color: theme.color.muted }]}>{t('common.actions.close')}</Text>
              </Pressable>
            </View>

            <View style={styles.preferenceGroup}>
              <Text style={[styles.preferenceGroupTitle, { color: theme.color.text }]}>{t('onboarding.preferences.languageTitle')}</Text>
              <View style={styles.preferenceOptionsRow}>
                {languageOptions.map((option) => renderPreferenceOption(
                  option,
                  settings.language === option.value,
                  () => updateOnboardingPreferences({ language: option.value }),
                ))}
              </View>
            </View>

            <View style={styles.preferenceGroup}>
              <Text style={[styles.preferenceGroupTitle, { color: theme.color.text }]}>{t('onboarding.preferences.appearanceTitle')}</Text>
              <View style={styles.preferenceOptionsRow}>
                {appearanceOptions.map((option) => renderPreferenceOption(
                  option,
                  settings.appearance === option.value,
                  () => updateOnboardingPreferences({ appearance: option.value }),
                ))}
              </View>
            </View>

            <Pressable accessibilityRole="button" onPress={() => setPreferencesOpen(false)} style={({ pressed }) => [styles.doneButton, { backgroundColor: theme.color.text }, pressed ? styles.pressed : null]}>
              <Text style={[styles.doneButtonText, { color: surfaceForPrimaryText }]}>{t('onboarding.preferences.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.bottomBar, { backgroundColor: onboardingBackground, borderTopColor: theme.color.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: currentIndex === 0 }}
          disabled={currentIndex === 0}
          onPress={goBack}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: theme.color.border, backgroundColor: onboardingBackground },
            currentIndex === 0 ? styles.disabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: currentIndex === 0 ? theme.color.border : theme.color.text }]}>{t('onboarding.actions.back')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={goNext}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}
        >
          <Text style={[styles.primaryButtonText, { color: surfaceForPrimaryText }]}>{isLastSlide ? t('onboarding.actions.getStarted') : t('onboarding.actions.next')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    minHeight: 62,
    paddingHorizontal: 26,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  skipButton: {
    minHeight: 36,
    minWidth: 58,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  preferenceBar: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    alignItems: 'center',
  },
  preferencePill: {
    maxWidth: '100%',
    minHeight: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  preferencePillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  slideWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  caption: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  stepLabel: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  title: {
    marginTop: 16,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  body: {
    marginTop: 12,
    maxWidth: 340,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '800',
    textAlign: 'center',
  },
  dotsRow: {
    minHeight: 28,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  activeDot: {
    width: 22,
  },
  stepLabelMuted: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    padding: 16,
  },
  preferenceSheet: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    padding: 20,
    gap: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  preferenceSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  preferenceSheetTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  preferenceSheetBody: {
    maxWidth: 270,
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  closeButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  closeButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  preferenceGroup: {
    gap: 10,
  },
  preferenceGroupTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  preferenceOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preferenceOption: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  preferenceOptionText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  doneButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  doneButtonText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1.4,
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }],
  },
});
