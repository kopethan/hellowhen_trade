import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { AppSettings } from '@hellowhen/contracts';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useAppSettings } from '../../providers/AppSettingsProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';

type SettingsResponse = { settings: AppSettings };
type AppearanceValue = AppSettings['appearance'];

const appearanceOptions: Array<{ label: string; value: AppearanceValue }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export function SettingsScreen() {
  const { settings, setSettings } = useAppSettings();
  const theme = useThemeTokens();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.settings.me() as SettingsResponse;
      setSettings(result.settings);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [setSettings]);

  useFocusEffect(useCallback(() => { void loadSettings(); }, [loadSettings]));

  async function updateSettings(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const result = await api.settings.updateMe(patch) as SettingsResponse;
      setSettings(result.settings);
      setSaved(true);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadSettings(); }} />}>
        <View style={styles.header}>
          <SemanticBadge label="Settings" tone="instruction" />
          <AppText style={styles.title}>Settings</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>Manage notifications, appearance, and privacy preferences.</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title="Settings unavailable" body={error} /> : null}
        {saved ? <InfoNotice tone="success" title="Saved" body="Your settings have been updated." /> : null}

        <AppCard>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <AppText style={styles.sectionTitle}>Notifications</AppText>
              <AppText style={[styles.body, { color: theme.color.muted }]}>Trade updates, proposal messages, image review, and wallet activity.</AppText>
            </View>
            <Switch value={settings.notificationsEnabled} disabled={saving} onValueChange={(value) => { void updateSettings({ notificationsEnabled: value }); }} />
          </View>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Appearance</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>Use your system theme, or choose light or dark mode for this device.</AppText>
          <View style={styles.optionRow}>
            {appearanceOptions.map((option) => (
              <ChoiceButton
                key={option.value}
                label={option.label}
                selected={settings.appearance === option.value}
                disabled={saving}
                onPress={() => { void updateSettings({ appearance: option.value }); }}
              />
            ))}
          </View>
        </AppCard>

        <AppCard>
          <SemanticBadge label="Privacy" tone="info" size="sm" />
          <AppText style={styles.sectionTitle}>Profile visibility</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>Only your public profile, active trades, and approved need/offer images appear in public trade decks.</AppText>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

function ChoiceButton({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const theme = useThemeTokens();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceButton,
        { backgroundColor: theme.color.surface, borderColor: theme.color.border },
        selected && { backgroundColor: theme.color.text, borderColor: theme.color.text },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <AppText style={[styles.choiceButtonText, { color: selected ? theme.color.background : theme.color.text }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.35 },
  body: { lineHeight: 20, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  switchCopy: { flex: 1, gap: 5 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  choiceButtonText: { fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
