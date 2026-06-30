import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppSettings, ContentLanguageCode } from '@hellowhen/contracts';
import type { LanguagePreference } from '@hellowhen/i18n';
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
import { useTranslation } from '../../providers/MobileI18nProvider';

type SettingsResponse = { settings: AppSettings };
type AppearanceValue = AppSettings['appearance'];

type ChoiceOption<T extends string> = { labelKey: string; value: T };

const appearanceOptions: Array<ChoiceOption<AppearanceValue>> = [
  { labelKey: 'settings.appearance.options.system.title', value: 'system' },
  { labelKey: 'settings.appearance.options.light.title', value: 'light' },
  { labelKey: 'settings.appearance.options.dark.title', value: 'dark' },
];

const languageOptions: Array<ChoiceOption<LanguagePreference>> = [
  { labelKey: 'settings.language.options.system.title', value: 'system' },
  { labelKey: 'settings.language.options.en.title', value: 'en' },
  { labelKey: 'settings.language.options.fr.title', value: 'fr' },
  { labelKey: 'settings.language.options.es.title', value: 'es' },
];

const contentLanguageOptions: Array<ChoiceOption<ContentLanguageCode>> = [
  { labelKey: 'settings.language.options.en.title', value: 'en' },
  { labelKey: 'settings.language.options.fr.title', value: 'fr' },
  { labelKey: 'settings.language.options.es.title', value: 'es' },
];

function contentLanguageTitleKey(language: ContentLanguageCode) {
  return contentLanguageOptions.find((option) => option.value === language)?.labelKey ?? 'settings.language.options.en.title';
}

function defaultContentLanguageOrder(language: LanguagePreference): ContentLanguageCode[] {
  if (language === 'fr' || language === 'es') return [language, 'en'];
  return ['en'];
}

function moveContentLanguage(order: ContentLanguageCode[], language: ContentLanguageCode, direction: -1 | 1) {
  const next = [...order];
  const index = next.indexOf(language);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= next.length) return next;
  const current = next[index]!;
  const target = next[targetIndex]!;
  next[index] = target;
  next[targetIndex] = current;
  return next;
}

function removeContentLanguage(order: ContentLanguageCode[], language: ContentLanguageCode) {
  const next = order.filter((item) => item !== language);
  return next.length ? next : order;
}

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const { settings, setSettings } = useAppSettings();
  const { t } = useTranslation();
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

  async function updateContentLanguageOrder(nextOrder: ContentLanguageCode[]) {
    await updateSettings({ contentLanguageOrder: nextOrder });
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadSettings(); }} />}>
        <AppHeader title={t('navigation.routes.settings')} onBack={() => navigation.goBack()} />
        <View style={styles.header}>
          <SemanticBadge label={t('settings.eyebrow')} tone="instruction" />
          <AppText style={styles.title}>{t('navigation.routes.settings')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('settings.body')}</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title={t('settings.unavailableTitle')} body={error} /> : null}
        {saved ? <InfoNotice tone="success" title={t('common.states.saved')} body={t('common.messages.settingsUpdated')} /> : null}

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('settings.language.title')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('settings.language.body')}</AppText>
          <View style={styles.optionRow}>
            {languageOptions.map((option) => (
              <ChoiceButton
                key={option.value}
                label={t(option.labelKey)}
                selected={settings.language === option.value}
                disabled={saving}
                onPress={() => { void updateSettings({ language: option.value }); }}
              />
            ))}
          </View>
        </AppCard>

        <AppCard>
          <SemanticBadge label={t('settings.contentLanguage.badge')} tone="info" size="sm" />
          <AppText style={styles.sectionTitle}>{t('settings.contentLanguage.title')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('settings.contentLanguage.bodyNative')}</AppText>
          <View style={styles.languageOrderList}>
            {settings.contentLanguageOrder.map((language, index) => (
              <View key={language} style={[styles.languageOrderRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
                <View style={styles.languageOrderCopy}>
                  <SemanticBadge label={`${index + 1}`} tone="muted" size="sm" />
                  <View style={styles.languageOrderText}>
                    <AppText style={styles.languageOrderTitle}>{t(contentLanguageTitleKey(language))}</AppText>
                    <AppText style={[styles.languageOrderBody, { color: theme.color.muted }]}>{index === 0 ? t('settings.contentLanguage.firstChoice') : t('settings.contentLanguage.fallbackChoice')}</AppText>
                  </View>
                </View>
                <View style={styles.languageOrderActions}>
                  <ChoiceButton label={t('settings.contentLanguage.moveUp')} selected={false} disabled={saving || index === 0} onPress={() => { void updateContentLanguageOrder(moveContentLanguage(settings.contentLanguageOrder, language, -1)); }} />
                  <ChoiceButton label={t('settings.contentLanguage.moveDown')} selected={false} disabled={saving || index === settings.contentLanguageOrder.length - 1} onPress={() => { void updateContentLanguageOrder(moveContentLanguage(settings.contentLanguageOrder, language, 1)); }} />
                  <ChoiceButton label={t('settings.contentLanguage.remove')} selected={false} disabled={saving || settings.contentLanguageOrder.length <= 1} onPress={() => { void updateContentLanguageOrder(removeContentLanguage(settings.contentLanguageOrder, language)); }} />
                </View>
              </View>
            ))}
          </View>
          <View style={styles.optionRow}>
            {contentLanguageOptions.filter((option) => !settings.contentLanguageOrder.includes(option.value)).map((option) => (
              <ChoiceButton key={option.value} label={t('settings.contentLanguage.addLanguage', { language: t(option.labelKey) })} selected={false} disabled={saving} onPress={() => { void updateContentLanguageOrder([...settings.contentLanguageOrder, option.value]); }} />
            ))}
            <ChoiceButton label={t('settings.contentLanguage.reset')} selected={false} disabled={saving} onPress={() => { void updateContentLanguageOrder(defaultContentLanguageOrder(settings.language)); }} />
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <AppText style={styles.sectionTitle}>{t('settings.notifications.title')}</AppText>
              <AppText style={[styles.body, { color: theme.color.muted }]}>{t('settings.notifications.bodyNative')}</AppText>
            </View>
            <Switch value={settings.notificationsEnabled} disabled={saving} onValueChange={(value) => { void updateSettings({ notificationsEnabled: value }); }} />
          </View>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('settings.appearance.titleNative')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('settings.appearance.bodyNative')}</AppText>
          <View style={styles.optionRow}>
            {appearanceOptions.map((option) => (
              <ChoiceButton
                key={option.value}
                label={t(option.labelKey)}
                selected={settings.appearance === option.value}
                disabled={saving}
                onPress={() => { void updateSettings({ appearance: option.value }); }}
              />
            ))}
          </View>
        </AppCard>

        <AppCard>
          <SemanticBadge label={t('settings.security.badge')} tone="time" size="sm" />
          <AppText style={styles.sectionTitle}>{t('settings.security.title')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('settings.security.bodyNative')}</AppText>
          <View style={styles.securityRows}>
            <AppText style={styles.securityLine}>{t('settings.security.email')}: {auth.user?.emailVerifiedAt ? t('settings.security.verified').toLowerCase() : t('settings.security.notVerified').toLowerCase()}</AppText>
            <AppText style={styles.securityLine}>{t('settings.security.authenticator')}: {auth.user?.twoFactorEnabled ? t('settings.security.enabled').toLowerCase() : t('settings.security.off').toLowerCase()}</AppText>
          </View>
          <View style={styles.optionRow}>
            <Pressable accessibilityRole="button" disabled={saving || Boolean(auth.user?.emailVerifiedAt)} onPress={() => { void requestEmailVerification(); }} style={({ pressed }) => [styles.choiceButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, (saving || Boolean(auth.user?.emailVerifiedAt)) && styles.disabled, pressed && styles.pressed]}>
              <AppText style={styles.choiceButtonText}>{t('common.actions.verifyEmail')}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SecurityPassword')} style={({ pressed }) => [styles.choiceButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
              <AppText style={styles.choiceButtonText}>{t('settings.security.changePasswordAction')}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('TwoFactorSecurity')} style={({ pressed }) => [styles.choiceButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
              <AppText style={styles.choiceButtonText}>{auth.user?.twoFactorEnabled ? t('settings.security.disableTwoStep') : t('settings.security.enableTwoStep')}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void logoutAllDevices(); }} style={({ pressed }) => [styles.choiceButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, saving && styles.disabled, pressed && styles.pressed]}>
              <AppText style={styles.choiceButtonText}>{t('common.actions.logoutAllDevices')}</AppText>
            </Pressable>
          </View>
        </AppCard>

        <AppCard>
          <SemanticBadge label={t('settings.policies.badge')} tone="info" size="sm" />
          <AppText style={styles.sectionTitle}>{t('settings.policies.title')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('settings.policies.bodyNative')}</AppText>
          <View style={styles.optionRow}>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('LegalPolicy')} style={({ pressed }) => [styles.choiceButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
              <AppText style={styles.choiceButtonText}>{t('settings.policies.open')}</AppText>
            </Pressable>
          </View>
        </AppCard>

        <AppCard>
          <SemanticBadge label={t('settings.privacy.badge')} tone="info" size="sm" />
          <AppText style={styles.sectionTitle}>{t('settings.privacy.title')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('settings.privacy.body')}</AppText>
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
  languageOrderList: { gap: 9 },
  languageOrderRow: { borderWidth: 1, borderRadius: 18, padding: 11, gap: 10 },
  languageOrderCopy: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  languageOrderText: { flex: 1, minWidth: 0, gap: 2 },
  languageOrderTitle: { fontWeight: '900', fontSize: 15 },
  languageOrderBody: { fontWeight: '700', fontSize: 12, lineHeight: 16 },
  languageOrderActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choiceButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  choiceButtonText: { fontWeight: '900' },
  securityRows: { gap: 6 },
  securityLine: { fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
