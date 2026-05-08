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

type SettingsResponse = { settings: AppSettings };
type AppearanceValue = AppSettings['appearance'];
type AccentValue = AppSettings['accent'];

const appearanceOptions: Array<{ label: string; value: AppearanceValue }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const accentOptions: Array<{ label: string; value: AccentValue }> = [
  { label: 'Teal', value: 'teal' },
  { label: 'Blue', value: 'blue' },
  { label: 'Purple', value: 'purple' },
  { label: 'Orange', value: 'orange' },
];

export function SettingsScreen() {
  const { settings, setSettings } = useAppSettings();
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
          <AppText style={styles.subtitle}>Manage notifications, appearance, and privacy preferences.</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title="Settings unavailable" body={error} /> : null}
        {saved ? <InfoNotice tone="success" title="Saved" body="Your settings have been updated." /> : null}

        <AppCard>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <AppText style={styles.sectionTitle}>Notifications</AppText>
              <AppText style={styles.body}>Trade updates, proposal messages, image review, and credit activity.</AppText>
            </View>
            <Switch value={settings.notificationsEnabled} disabled={saving} onValueChange={(value) => { void updateSettings({ notificationsEnabled: value }); }} />
          </View>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Appearance</AppText>
          <AppText style={styles.body}>Choose how Hellowhen should look on this device.</AppText>
          <View style={styles.optionRow}>
            {appearanceOptions.map((option) => <ChoiceButton key={option.value} label={option.label} selected={settings.appearance === option.value} disabled={saving} onPress={() => { void updateSettings({ appearance: option.value }); }} />)}
          </View>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Accent color</AppText>
          <AppText style={styles.body}>Use a color that feels right for your trade workflow.</AppText>
          <View style={styles.optionRow}>
            {accentOptions.map((option) => <ChoiceButton key={option.value} label={option.label} selected={settings.accent === option.value} disabled={saving} onPress={() => { void updateSettings({ accent: option.value }); }} />)}
          </View>
        </AppCard>

        <AppCard>
          <SemanticBadge label="Privacy" tone="info" size="sm" />
          <AppText style={styles.sectionTitle}>Profile visibility</AppText>
          <AppText style={styles.body}>Only your public profile, active trades, and approved need/offer images appear in public trade decks.</AppText>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

function ChoiceButton({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.choiceButton, selected && styles.choiceButtonSelected, disabled && styles.disabled, pressed && styles.pressed]}>
      <AppText style={[styles.choiceButtonText, selected && styles.choiceButtonTextSelected]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: '#64748B', lineHeight: 20, fontWeight: '600' },
  sectionTitle: { color: '#0F172A', fontSize: 22, fontWeight: '900', letterSpacing: -0.35 },
  body: { color: '#64748B', lineHeight: 20, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  switchCopy: { flex: 1, gap: 5 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceButton: { borderRadius: 999, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 9 },
  choiceButtonSelected: { borderColor: '#0F766E', backgroundColor: '#CCFBF1' },
  choiceButtonText: { color: '#475569', fontWeight: '900' },
  choiceButtonTextSelected: { color: '#0F766E' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
