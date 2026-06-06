import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { getOnboardingImageBackground, OnboardingSlideIllustration } from './OnboardingSlideIllustration';
import { ONBOARDING_GUIDE_SLIDES } from './onboardingGuide.slides';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingGuide'>;

export function OnboardingGuideScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const slide = ONBOARDING_GUIDE_SLIDES[currentIndex];
  const isCompactHeight = height < 700;
  const imageMode = theme.mode;
  const onboardingBackground = getOnboardingImageBackground(imageMode, slide.illustrationKey);
  const surfaceForPrimaryText = imageMode === 'dark' ? '#050506' : '#FFFFFF';
  const isLastSlide = currentIndex === ONBOARDING_GUIDE_SLIDES.length - 1;
  const progressLabel = `${currentIndex + 1} / ${ONBOARDING_GUIDE_SLIDES.length}`;
  const illustrationSize = useMemo(
    () => Math.max(210, Math.min(width - 40, isCompactHeight ? 250 : 330, height * 0.38)),
    [height, isCompactHeight, width]
  );

  function closeGuide() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace('TradeTabs');
  }

  function goNext() {
    if (isLastSlide) {
      closeGuide();
      return;
    }
    setCurrentIndex((value) => Math.min(value + 1, ONBOARDING_GUIDE_SLIDES.length - 1));
  }

  function goBack() {
    setCurrentIndex((value) => Math.max(value - 1, 0));
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: onboardingBackground }]}>
      <View style={[styles.topBar, { backgroundColor: onboardingBackground }]}>
        <Text style={[styles.brand, { color: theme.color.text }]}>Hellowhen</Text>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={closeGuide} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
          <Text style={[styles.skipText, { color: theme.color.muted }]}>Skip</Text>
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

          <Text style={[styles.caption, { color: theme.color.muted }]}>{slide.illustrationCaption}</Text>
          <Text style={[styles.stepLabel, { color: theme.color.text }]}>{progressLabel}</Text>
          <Text style={[styles.title, { color: theme.color.text }]}>{slide.title}</Text>
          <Text style={[styles.body, { color: theme.color.muted }]}>{slide.body}</Text>

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
          <Text style={[styles.secondaryButtonText, { color: currentIndex === 0 ? theme.color.border : theme.color.text }]}>Back</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={goNext}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}
        >
          <Text style={[styles.primaryButtonText, { color: surfaceForPrimaryText }]}>{isLastSlide ? 'Get started' : 'Next'}</Text>
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
