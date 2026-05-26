import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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

export function SecurityPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changePassword() {
    if (saving) return;
    const normalizedCode = code.trim();
    setMessage(null);
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('settings.security.changePasswordRequired'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('settings.security.changePasswordLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('settings.security.changePasswordMismatch'));
      return;
    }
    if (currentPassword === newPassword) {
      setError(t('settings.security.changePasswordSame'));
      return;
    }
    if (auth.user?.twoFactorEnabled && !normalizedCode) {
      setError(t('settings.security.changePasswordCodeRequired'));
      return;
    }

    setSaving(true);
    try {
      const response = await api.auth.changePassword({ currentPassword, newPassword, confirmPassword, code: normalizedCode || undefined }) as { message?: string };
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCode('');
      setMessage(response.message ?? t('settings.security.passwordChanged'));
      await auth.refreshMe().catch(() => undefined);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppHeader title={t('settings.security.changePasswordTitle')} onBack={() => navigation.goBack()} />
        <View style={styles.header}>
          <SemanticBadge label={t('settings.security.passwordAccountTitle')} tone="warning" />
          <AppText style={styles.title}>{t('settings.security.changePasswordTitle')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('settings.security.changePasswordBody')}</AppText>
        </View>

        {message ? <InfoNotice tone="success" title={t('common.states.done')} body={message} /> : null}
        {error ? <InfoNotice tone="danger" title={t('settings.unavailableTitle')} body={error} /> : null}

        <AppCard style={styles.card}>
          <AppText style={styles.sectionTitle}>{t('settings.security.passwordPageHelp')}</AppText>
          <SecurityInput value={currentPassword} onChangeText={setCurrentPassword} placeholder={t('settings.security.currentPassword')} secureTextEntry={!showPasswords} />
          <SecurityInput value={newPassword} onChangeText={setNewPassword} placeholder={t('settings.security.newPassword')} secureTextEntry={!showPasswords} />
          <SecurityInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('settings.security.confirmNewPassword')} secureTextEntry={!showPasswords} />
          {auth.user?.twoFactorEnabled ? (
            <SecurityInput value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder={t('settings.security.authenticatorOrRecovery')} autoCapitalize="characters" autoCorrect={false} />
          ) : null}
          <View style={styles.buttonRow}>
            <Pressable accessibilityRole="button" onPress={() => setShowPasswords((value) => !value)} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
              <AppText style={styles.secondaryButtonText}>{showPasswords ? t('common.actions.hide') : t('common.actions.show')}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void changePassword(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, saving && styles.disabled, pressed && !saving && styles.pressed]}>
              <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{saving ? t('common.states.saving') : t('settings.security.changePasswordAction')}</AppText>
            </Pressable>
          </View>
        </AppCard>
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
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  input: { minHeight: 54, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 16, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 11 },
  primaryButtonText: { fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 11 },
  secondaryButtonText: { fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
