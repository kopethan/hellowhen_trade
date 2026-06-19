import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountDeletionRequestDto } from '@hellowhen/contracts';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { KEYBOARD_DONE_ACCESSORY_ID } from '../../components/KeyboardDoneAccessory';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountDeletion'>;

function normalizeRequest(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { request?: unknown };
  return record.request && typeof record.request === 'object' ? record.request as AccountDeletionRequestDto : null;
}

export function AccountDeletionScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [request, setRequest] = useState<AccountDeletionRequestDto | null>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRequest = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setRequest(normalizeRequest(await api.account.deletionRequest()));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadRequest(); }, [loadRequest]));

  async function submitRequest() {
    setSaving(true); setNotice(null); setError(null);
    try {
      const response = await api.account.requestDeletion({ reason: reason.trim() || undefined, details: details.trim() || undefined });
      setRequest(normalizeRequest(response));
      setReason(''); setDetails(''); setNotice(t('account.deletion.requestCreated'));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest() {
    setSaving(true); setNotice(null); setError(null);
    try {
      const response = await api.account.cancelDeletionRequest();
      setRequest(normalizeRequest(response));
      setNotice(t('account.deletion.requestCancelled'));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  const active = request && ['requested', 'in_review'].includes(request.status);

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadRequest(); }} />}>
        <AppHeader title={t('account.deletion.title')} onBack={() => navigation.goBack()} />

        <View style={styles.header}>
          <SemanticBadge label={t('account.deletion.badge')} tone="warning" />
          <AppText style={styles.title}>{t('account.deletion.title')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.deletion.body')}</AppText>
        </View>

        {notice ? <InfoNotice tone="success" title={t('common.states.done')} body={notice} /> : null}
        {error ? <InfoNotice tone="danger" title={t('account.deletion.couldNotUpdate')} body={error} /> : null}

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('account.deletion.whatHappensTitle')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('account.deletion.whatHappensBody')}</AppText>
          <View style={styles.bulletList}>
            <AppText style={[styles.bullet, { color: theme.color.muted }]}>• {t('account.deletion.pointProfile')}</AppText>
            <AppText style={[styles.bullet, { color: theme.color.muted }]}>• {t('account.deletion.pointSafety')}</AppText>
            <AppText style={[styles.bullet, { color: theme.color.muted }]}>• {t('account.deletion.pointSupport')}</AppText>
          </View>
        </AppCard>

        {active ? (
          <AppCard>
            <SemanticBadge label={request.status} tone="instruction" size="sm" />
            <AppText style={styles.sectionTitle}>{t('account.deletion.activeTitle')}</AppText>
            <AppText style={[styles.body, { color: theme.color.muted }]}>{t('account.deletion.activeBody')}</AppText>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void cancelRequest(); }} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, saving && styles.disabled, pressed && styles.pressed]}>
              <AppText style={styles.secondaryButtonText}>{t('account.deletion.cancelRequest')}</AppText>
            </Pressable>
          </AppCard>
        ) : (
          <AppCard>
            <AppText style={styles.sectionTitle}>{t('account.deletion.formTitle')}</AppText>
            <AppText style={[styles.body, { color: theme.color.muted }]}>{t('account.deletion.formBody')}</AppText>
            <AppText style={styles.label}>{t('account.deletion.reason')}</AppText>
            <TextInput value={reason} onChangeText={setReason} maxLength={120} placeholder={t('account.deletion.reasonPlaceholder')} placeholderTextColor={theme.color.muted} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="done" blurOnSubmit={true} style={[styles.input, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
            <AppText style={styles.label}>{t('account.deletion.details')}</AppText>
            <TextInput value={details} onChangeText={setDetails} maxLength={2000} multiline placeholder={t('account.deletion.detailsPlaceholder')} placeholderTextColor={theme.color.muted} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="default" blurOnSubmit={false} style={[styles.textarea, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void submitRequest(); }} style={({ pressed }) => [styles.dangerButton, saving && styles.disabled, pressed && styles.pressed]}>
              <AppText style={styles.dangerButtonText}>{saving ? t('common.states.submitting') : t('account.deletion.submitRequest')}</AppText>
            </Pressable>
          </AppCard>
        )}

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('account.deletion.needHelpTitle')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('account.deletion.needHelpBody')}</AppText>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SupportCenter')} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, pressed && styles.pressed]}>
            <AppText style={styles.secondaryButtonText}>{t('account.items.support.title')}</AppText>
          </Pressable>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  sectionTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', letterSpacing: -0.25 },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '900', marginBottom: -6 },
  bulletList: { gap: 6 },
  bullet: { fontWeight: '700', lineHeight: 20 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, fontWeight: '800' },
  textarea: { minHeight: 118, borderWidth: 1, borderRadius: 18, padding: 14, textAlignVertical: 'top', fontWeight: '700' },
  dangerButton: { minHeight: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#DC2626' },
  dangerButtonText: { color: 'white', fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
