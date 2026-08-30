import React, { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getWizardActiveStep, type WizardStepDefinition } from '@hellowhen/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppFixedHeaderScreen } from '../../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../../components/AppHeader';
import { AppText } from '../../../components/AppText';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useAndroidFocusedInputVisibility, type AndroidFocusedInputVisibilityHandlers } from '../../../hooks/useAndroidFocusedInputVisibility';
import { WizardProgress } from './WizardProgress';

type WizardShellProps<TStepId extends string> = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightSlot?: React.ReactNode;
  steps: readonly WizardStepDefinition<TStepId>[];
  activeStepId: TStepId;
  children: React.ReactNode | ((keyboardVisibility: AndroidFocusedInputVisibilityHandlers) => React.ReactNode);
  footer?: React.ReactNode;
  stepLabel?: string;
  ofLabel?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  androidFocusedInputVisibility?: boolean;
};

export function WizardShell<TStepId extends string>({
  title,
  subtitle,
  onBack,
  rightSlot,
  steps,
  activeStepId,
  children,
  footer,
  stepLabel,
  ofLabel,
  contentContainerStyle,
  bodyStyle,
  androidFocusedInputVisibility = false,
}: WizardShellProps<TStepId>) {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const activeStep = getWizardActiveStep(steps, activeStepId);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const keyboardVisibility = useAndroidFocusedInputVisibility({
    scrollViewRef,
    safeGap: 14,
    bottomClearance: footer ? footerHeight : 0,
    enabled: androidFocusedInputVisibility,
  });
  const renderedChildren = typeof children === 'function' ? children(keyboardVisibility) : children;
  const footerBottomPadding = Platform.OS === 'android' ? Math.max(12, insets.bottom + 10) : 10;

  return (
    <AppFixedHeaderScreen
      header={(
        <View style={styles.headerStack}>
          <AppHeader title={title} onBack={onBack} rightSlot={rightSlot} />
          {subtitle ? <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{subtitle}</AppText> : null}
          <WizardProgress steps={steps} activeStepId={activeStepId} stepLabel={stepLabel} ofLabel={ofLabel} />
        </View>
      )}
      bodyStyle={[styles.body, bodyStyle]}
    >
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentContainerStyle]}
      >
        {activeStep ? (
          <View style={styles.stepIntro}>
            <AppText style={styles.stepTitle}>{activeStep.title}</AppText>
            {activeStep.description ? <AppText style={[styles.stepDescription, { color: theme.color.muted }]}>{activeStep.description}</AppText> : null}
          </View>
        ) : null}
        {renderedChildren}
      </ScrollView>
      {footer ? (
        <View
          onLayout={androidFocusedInputVisibility ? (event) => setFooterHeight(event.nativeEvent.layout.height) : undefined}
          style={[styles.footer, { backgroundColor: theme.color.background, paddingBottom: footerBottomPadding }]}
        >
          {footer}
        </View>
      ) : null}
    </AppFixedHeaderScreen>
  );
}

const styles = StyleSheet.create({
  headerStack: { gap: 9 },
  subtitle: { marginTop: -5, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  body: { gap: 0 },
  content: { gap: 14, paddingBottom: 18 },
  stepIntro: { gap: 5 },
  stepTitle: { fontSize: 23, lineHeight: 28, fontWeight: '900', letterSpacing: -0.45 },
  stepDescription: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  footer: { paddingTop: 8, paddingBottom: 10 },
});
