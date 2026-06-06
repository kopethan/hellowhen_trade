import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '../../../components/AppText';
import { useThemeTokens } from '../../../providers/ThemeProvider';

type WizardFooterProps = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryLoadingLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  tertiaryLabel?: string;
  onTertiary?: () => void;
  tertiaryDisabled?: boolean;
  helperText?: string;
  style?: StyleProp<ViewStyle>;
};

export function WizardFooter({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  primaryLoadingLabel,
  secondaryLabel,
  onSecondary,
  secondaryDisabled = false,
  tertiaryLabel,
  onTertiary,
  tertiaryDisabled = false,
  helperText,
  style,
}: WizardFooterProps) {
  const theme = useThemeTokens();
  const isPrimaryDisabled = primaryDisabled || primaryLoading;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.color.background, borderColor: theme.color.border }, style]}>
      {helperText ? <AppText style={[styles.helper, { color: theme.color.muted }]}>{helperText}</AppText> : null}
      <View style={styles.actions}>
        {secondaryLabel && onSecondary ? (
          <Pressable
            accessibilityRole="button"
            disabled={secondaryDisabled || primaryLoading}
            onPress={onSecondary}
            style={({ pressed }) => [
              styles.secondaryButton,
              { backgroundColor: theme.color.surface, borderColor: theme.color.border },
              (secondaryDisabled || primaryLoading) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <AppText style={[styles.secondaryText, { color: theme.color.text }]}>{secondaryLabel}</AppText>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={isPrimaryDisabled}
          onPress={onPrimary}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.semantic.proposal.bg },
            isPrimaryDisabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <AppText style={styles.primaryText}>{primaryLoading ? primaryLoadingLabel ?? primaryLabel : primaryLabel}</AppText>
        </Pressable>
      </View>
      {tertiaryLabel && onTertiary ? (
        <Pressable
          accessibilityRole="button"
          disabled={tertiaryDisabled || primaryLoading}
          onPress={onTertiary}
          style={({ pressed }) => [styles.tertiaryButton, (tertiaryDisabled || primaryLoading) && styles.disabled, pressed && styles.pressed]}
        >
          <AppText style={[styles.tertiaryText, { color: theme.color.muted }]}>{tertiaryLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, paddingTop: 12, gap: 10 },
  helper: { fontSize: 12, fontWeight: '700', lineHeight: 17, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  primaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 18, paddingHorizontal: 16 },
  secondaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 18, borderWidth: 1, paddingHorizontal: 16 },
  tertiaryButton: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryText: { fontSize: 15, fontWeight: '900' },
  tertiaryText: { fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
