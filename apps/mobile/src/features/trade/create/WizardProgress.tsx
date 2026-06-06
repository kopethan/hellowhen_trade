import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getWizardProgressLabel, getWizardProgressPercent, type WizardStepDefinition } from '@hellowhen/shared';
import { AppText } from '../../../components/AppText';
import { useThemeTokens } from '../../../providers/ThemeProvider';

type WizardProgressProps<TStepId extends string> = {
  steps: readonly WizardStepDefinition<TStepId>[];
  activeStepId: TStepId;
  label?: string;
  stepLabel?: string;
  ofLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function WizardProgress<TStepId extends string>({ steps, activeStepId, label, stepLabel, ofLabel, style }: WizardProgressProps<TStepId>) {
  const theme = useThemeTokens();
  const progressPercent = getWizardProgressPercent(steps, activeStepId);
  const progressLabel = label ?? getWizardProgressLabel(steps, activeStepId, { step: stepLabel, of: ofLabel });

  return (
    <View style={[styles.wrap, style]} accessibilityLabel={progressLabel}>
      <AppText style={[styles.progressLabel, { color: theme.color.muted }]}>{progressLabel}</AppText>
      <View style={[styles.track, { backgroundColor: theme.color.subtleSurface }]}>
        <View style={[styles.fill, { width: `${progressPercent}%`, backgroundColor: theme.semantic.proposal.bg }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  progressLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' },
  track: { height: 5, overflow: 'hidden', borderRadius: 999 },
  fill: { height: '100%', borderRadius: 999 },
});
