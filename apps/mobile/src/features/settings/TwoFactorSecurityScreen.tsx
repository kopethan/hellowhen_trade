import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';

type TwoFactorSetupResponse = { secret: string; otpauthUrl: string; message?: string };
type TwoFactorEnableResponse = { recoveryCodes?: string[] };

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

export function TwoFactorSecurityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [otpAuthUrl, setOtpAuthUrl] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryCodesSaved, setRecoveryCodesSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const twoFactorEnabled = Boolean(auth.user?.twoFactorEnabled);
  const normalizedCode = normalizeCode(code);

  async function startSetup() {
    if (saving) return;
    setMessage(null);
    setError(null);
    setRecoveryCodes([]);
    setRecoveryCodesSaved(false);
    if (!password.trim()) {
      setError(t('settings.security.passwordRequiredForSetup'));
      return;
    }

    setSaving(true);
    try {
      await auth.reauthenticate({ password: password.trim() });
      const response = await api.auth.twoFactorSetup() as TwoFactorSetupResponse;
      setSecret(response.secret);
      setOtpAuthUrl(response.otpauthUrl);
      setMessage(response.message ?? t('settings.security.setupStarted'));
      setCode('');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function enableTwoFactor() {
    if (saving) return;
    setMessage(null);
    setError(null);
    if (!normalizedCode || normalizedCode.length < 6) {
      setError(t('settings.security.codeFormatHint'));
      return;
    }

    setSaving(true);
    try {
      const response = await api.auth.twoFactorEnable({ code: normalizedCode }) as TwoFactorEnableResponse;
      setRecoveryCodes(response.recoveryCodes ?? []);
      setMessage(t('settings.security.twoFactorEnabled'));
      setPassword('');
      setCode('');
      await auth.refreshMe();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function disableTwoFactor() {
    if (saving) return;
    setMessage(null);
    setError(null);
    if (!password.trim() || !normalizedCode) {
      setError(t('settings.security.passwordAndCodeRequired'));
      return;
    }

    setSaving(true);
    try {
      await api.auth.twoFactorDisable({ password: password.trim(), code: normalizedCode });
      setPassword('');
      setCode('');
      setSecret('');
      setOtpAuthUrl('');
      setRecoveryCodes([]);
      setRecoveryCodesSaved(false);
      setMessage(t('settings.security.twoFactorDisabled'));
      await auth.refreshMe();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function openAuthenticator() {
    if (!otpAuthUrl) return;
    await Linking.openURL(otpAuthUrl).catch(() => undefined);
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppHeader title={t('settings.security.setupAuthenticator')} onBack={() => navigation.goBack()} />
        <View style={styles.header}>
          <SemanticBadge label={t('settings.security.badge')} tone="time" />
          <AppText style={styles.title}>{t('settings.security.setupAuthenticator')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('settings.security.bodyNative')}</AppText>
        </View>

        {message ? <InfoNotice tone="success" title={t('common.states.done')} body={message} /> : null}
        {error ? <InfoNotice tone="danger" title={t('settings.unavailableTitle')} body={error} /> : null}

        <AppCard style={styles.card}>
          <View style={styles.statusRow}>
            <SemanticBadge label={twoFactorEnabled ? t('settings.security.enabled') : t('settings.security.off')} tone={twoFactorEnabled ? 'success' : 'muted'} size="sm" />
            <AppText style={styles.sectionTitle}>{t('settings.security.authenticator')}</AppText>
          </View>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('settings.security.lostAccessHint')}</AppText>
        </AppCard>

        {!twoFactorEnabled ? (
          <AppCard style={styles.card}>
            <AppText style={styles.sectionTitle}>{t('settings.security.passwordForSetup')}</AppText>
            <SecurityInput value={password} onChangeText={setPassword} placeholder={t('settings.security.password')} secureTextEntry />
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void startSetup(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, saving && styles.disabled, pressed && !saving && styles.pressed]}>
              <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{saving ? t('common.states.working') : t('settings.security.setupAuthenticator')}</AppText>
            </Pressable>
          </AppCard>
        ) : null}

        {!twoFactorEnabled && secret ? (
          <AppCard style={styles.card}>
            <SemanticBadge label={t('settings.security.authenticatorSecret')} tone="instruction" size="sm" />
            <AppText style={styles.sectionTitle}>{t('settings.security.setupStarted')}</AppText>
            <AppText style={[styles.body, { color: theme.color.muted }]}>{t('settings.security.manualKeyHelp')}</AppText>
            <View style={[styles.secretBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
              <AppText selectable style={styles.secretText}>{secret}</AppText>
            </View>
            <View style={styles.buttonRow}>
              {otpAuthUrl ? (
                <Pressable accessibilityRole="button" onPress={() => { void openAuthenticator(); }} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                  <AppText style={styles.secondaryButtonText}>{t('settings.security.openAuthenticator')}</AppText>
                </Pressable>
              ) : null}
            </View>
            <SecurityInput value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder={t('settings.security.code6Digit')} autoCapitalize="characters" autoCorrect={false} keyboardType="number-pad" />
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void enableTwoFactor(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, saving && styles.disabled, pressed && !saving && styles.pressed]}>
              <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{saving ? t('common.states.saving') : t('settings.security.enableTwoStep')}</AppText>
            </Pressable>
          </AppCard>
        ) : null}

        {twoFactorEnabled ? (
          <AppCard style={styles.card}>
            <SemanticBadge label={t('settings.security.disableTwoStep')} tone="warning" size="sm" />
            <AppText style={[styles.body, { color: theme.color.muted }]}>{t('settings.security.disableTwoStepBodyNative')}</AppText>
            <SecurityInput value={password} onChangeText={setPassword} placeholder={t('settings.security.password')} secureTextEntry />
            <SecurityInput value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder={t('settings.security.authenticatorOrRecovery')} autoCapitalize="characters" autoCorrect={false} />
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void disableTwoFactor(); }} style={({ pressed }) => [styles.secondaryButton, styles.dangerButton, { backgroundColor: theme.color.surface, borderColor: theme.semantic.danger.border }, saving && styles.disabled, pressed && !saving && styles.pressed]}>
              <AppText style={[styles.secondaryButtonText, { color: theme.semantic.danger.text }]}>{saving ? t('common.states.working') : t('settings.security.disableTwoStep')}</AppText>
            </Pressable>
          </AppCard>
        ) : null}

        {recoveryCodes.length && !recoveryCodesSaved ? (
          <AppCard style={styles.card}>
            <SemanticBadge label={t('settings.security.recoveryCodesTitle')} tone="warning" size="sm" />
            <AppText style={styles.sectionTitle}>{t('settings.security.recoveryCodesBody')}</AppText>
            <InfoNotice tone="warning" title={t('settings.security.recoveryCodesTitle')} body={t('settings.security.recoveryCodesOneTime')} />
            <View style={styles.recoveryGrid}>
              {recoveryCodes.map((item) => <AppText selectable key={item} style={[styles.recoveryCode, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>{item}</AppText>)}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setRecoveryCodesSaved(true)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
              <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{t('settings.security.recoveryCodesSavedAction')}</AppText>
            </Pressable>
          </AppCard>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function SecurityInput(props: React.ComponentProps<typeof TextInput>) {
  const theme = useThemeTokens();
  return <TextInput {...props} placeholderTextColor={theme.color.muted} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }, props.style]} />;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { lineHeight: 20, fontWeight: '700' },
  card: { gap: 11 },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  body: { lineHeight: 20, fontWeight: '700' },
  input: { minHeight: 54, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 16, fontWeight: '700' },
  secretBox: { borderWidth: 1, borderRadius: 18, padding: 13 },
  secretText: { fontSize: 13, lineHeight: 19, fontWeight: '900', letterSpacing: 0.6 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 11 },
  primaryButtonText: { fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 11 },
  secondaryButtonText: { fontWeight: '900' },
  dangerButton: { borderWidth: 1 },
  recoveryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recoveryCode: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
