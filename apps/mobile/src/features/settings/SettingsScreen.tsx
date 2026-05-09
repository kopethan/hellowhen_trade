import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppSettings } from '@hellowhen/contracts';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAppSettings } from '../../providers/AppSettingsProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';

type SettingsResponse = { settings: AppSettings };
type AppearanceValue = AppSettings['appearance'];

const appearanceOptions: Array<{ label: string; value: AppearanceValue }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
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


  async function requestEmailVerification() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.auth.requestEmailVerification();
      setSaved(true);
      await auth.refreshMe().catch(() => undefined);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function logoutAllDevices() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await auth.logoutAll();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

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
        <AppHeader title="Settings" onBack={() => navigation.goBack()} />
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
              <AppText style={[styles.body, { color: theme.color.muted }]}>Trade updates, proposal messages, image review, and support activity.</AppText>
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
          <SemanticBadge label="Security" tone="time" size="sm" />
          <AppText style={styles.sectionTitle}>Account protection</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>Email verification and fresh password confirmation protect payout actions. Authenticator app setup is available on web first.</AppText>
          <View style={styles.securityRows}>
            <AppText style={styles.securityLine}>Email: {auth.user?.emailVerifiedAt ? 'verified' : 'not verified'}</AppText>
            <AppText style={styles.securityLine}>Authenticator: {auth.user?.twoFactorEnabled ? 'enabled' : 'off'}</AppText>
          </View>
          <View style={styles.optionRow}>
            <Pressable accessibilityRole="button" disabled={saving || Boolean(auth.user?.emailVerifiedAt)} onPress={() => { void requestEmailVerification(); }} style={({ pressed }) => [styles.choiceButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, (saving || Boolean(auth.user?.emailVerifiedAt)) && styles.disabled, pressed && styles.pressed]}>
              <AppText style={styles.choiceButtonText}>Verify email</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void logoutAllDevices(); }} style={({ pressed }) => [styles.choiceButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, saving && styles.disabled, pressed && styles.pressed]}>
              <AppText style={styles.choiceButtonText}>Logout all devices</AppText>
            </Pressable>
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
  securityRows: { gap: 6 },
  securityLine: { fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
