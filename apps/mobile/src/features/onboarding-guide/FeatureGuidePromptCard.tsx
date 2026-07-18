import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SemanticColorName } from '@hellowhen/theme';

import { AppText } from '../../components/AppText';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';

type FeatureGuidePromptCardProps = {
  title: string;
  body: string;
  icon: MobileIconName;
  tone: SemanticColorName;
  onStart: () => void;
  onDismiss: () => void;
};

export function FeatureGuidePromptCard({ title, body, icon, tone, onStart, onDismiss }: FeatureGuidePromptCardProps) {
  const theme = useThemeTokens();
  const semanticTone = theme.semantic[tone];
  const { t } = useTranslation();

  return (
    <View style={[styles.card, { backgroundColor: theme.color.surface, borderColor: semanticTone.border }]}>
      <View style={styles.copyRow}>
        <View style={[styles.iconWrap, { backgroundColor: semanticTone.softBg, borderColor: semanticTone.border }]}>
          <MobileIcon name={icon} size={18} color={semanticTone.text} />
        </View>
        <View style={styles.copy}>
          <AppText style={styles.title}>{title}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{body}</AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.prompt.startAccessibility', { title })}
          onPress={onStart}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}
        >
          <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{t('onboarding.prompt.start')}</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.prompt.dismissAccessibility', { title })}
          onPress={onDismiss}
          style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.color.border, backgroundColor: theme.color.subtleSurface }, pressed && styles.pressed]}
        >
          <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{t('onboarding.prompt.dismiss')}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 14, gap: 13 },
  copyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.25 },
  body: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 9 },
  primaryButton: { flex: 1, minHeight: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryButton: { flex: 1, minHeight: 42, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryButtonText: { fontSize: 13, fontWeight: '900' },
  secondaryButtonText: { fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
