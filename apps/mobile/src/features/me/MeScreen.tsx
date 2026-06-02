import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileDto } from '@hellowhen/contracts';
import { normalizeUsername, publicUserPath, usernameChangeAvailableAt, validateUsername } from '@hellowhen/shared';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppSelect } from '../../components/AppSelect';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { countryOptions, currencyOptions, type SupportedCurrency } from '../../lib/moneyPreferences';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { resolveMediaUrl } from '../trade/mediaUrls';
import { uploadSelectedImages, type SelectedLocalImage } from '../trade/mediaUpload';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountProfile'>;
type ProfileResponse = { profile: ProfileDto };

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalUsername(value: string) {
  const normalized = value.trim() ? normalizeUsername(value) : '';
  return normalized.length > 0 ? normalized : undefined;
}

function getStoredAvatarSource(url?: string | null) {
  if (!url) return null;
  if (/^https?:/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  return resolveMediaUrl(url) || null;
}

function getLocalAvatarSource(url?: string | null) {
  if (!url) return null;
  return /^(file|content):/i.test(url) ? url : null;
}

export function ProfileScreen({ navigation }: Props) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(auth.user?.profile?.displayName ?? '');
  const [handle, setHandle] = useState(auth.user?.profile?.handle ?? '');
  const [bio, setBio] = useState(auth.user?.profile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(auth.user?.profile?.avatarUrl ?? null);
  const [countryCode, setCountryCode] = useState(auth.user?.profile?.countryCode ?? 'FR');
  const [preferredCurrency, setPreferredCurrency] = useState<SupportedCurrency>((auth.user?.profile?.preferredCurrency as SupportedCurrency | null) ?? 'eur');
  const [avatarImage, setAvatarImage] = useState<SelectedLocalImage | null>(null);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const avatarSource = avatarImage?.uri ? getLocalAvatarSource(avatarImage.uri) : getStoredAvatarSource(avatarUrl);
  const publicProfilePath = publicUserPath(handle);
  const usernameAvailableAt = usernameChangeAvailableAt(auth.user?.profile?.handleChangedAt ?? null);
  const usernameCooldownHint = usernameAvailableAt && usernameAvailableAt.getTime() > Date.now()
    ? t('profile.edit.handleCooldownHint', { date: usernameAvailableAt.toLocaleDateString() })
    : null;
  const countrySelectOptions = useMemo(() => countryOptions.map((country) => ({
    value: country.code,
    label: t(`common.locale.countries.${country.code}`),
    helper: t('common.locale.defaultCurrency', { currency: country.currency.toUpperCase() }),
  })), [t]);
  const currencySelectOptions = useMemo(() => currencyOptions.map((currency) => ({
    value: currency.code,
    label: currency.label,
    helper: t(`common.locale.currencies.${currency.code}`),
  })), [t]);

  async function pickAvatar() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError(t('profile.edit.photoPermission')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: false, quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAvatarImage({ uri: asset.uri, name: asset.fileName ?? `profile-avatar-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
    setSaved(false);
  }

  async function handleSave() {
    if (displayName.trim().length < 1) {
      setError(t('validation.displayNameRequired'));
      return;
    }
    const normalizedHandle = optionalUsername(handle);
    if (normalizedHandle && !validateUsername(normalizedHandle).ok) {
      setError(t('profile.edit.invalidHandle'));
      return;
    }

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const avatarMediaIds = avatarImage ? await uploadSelectedImages([avatarImage]) : [];
      const result = await api.profile.updateMe({ displayName: displayName.trim(), handle: normalizedHandle, bio: optionalText(bio), countryCode, preferredCurrency, ...(avatarMediaIds[0] ? { avatarMediaId: avatarMediaIds[0] } : {}) }) as ProfileResponse;
      setAvatarImage(null);
      setAvatarUrl(result.profile.avatarUrl ?? null);
      auth.updateLocalProfile({ displayName: result.profile.displayName, handle: result.profile.handle, bio: result.profile.bio, avatarUrl: result.profile.avatarUrl, avatarMediaId: result.profile.avatarMediaId, countryCode: result.profile.countryCode, preferredCurrency: result.profile.preferredCurrency });
      setSaved(true);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveAvatar() {
    setRemovingAvatar(true);
    setSaved(false);
    setError(null);

    try {
      const result = await api.profile.updateMe({ removeAvatar: true }) as ProfileResponse;
      setAvatarImage(null);
      setAvatarUrl(null);
      auth.updateLocalProfile({ avatarUrl: null, avatarMediaId: null, displayName: result.profile.displayName, handle: result.profile.handle, bio: result.profile.bio, countryCode: result.profile.countryCode, preferredCurrency: result.profile.preferredCurrency });
      setSaved(true);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setRemovingAvatar(false);
    }
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <AppHeader title={t('profile.title')} onBack={() => navigation.goBack()} />
        <View style={styles.header}>
          <SemanticBadge label={t('profile.title')} tone="info" />
          <AppText style={styles.title}>{t('profile.title')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('profile.edit.body')}</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title={t('profile.edit.couldNotSaveTitle')} body={error} /> : null}
        {saved ? <InfoNotice tone="success" title={t('common.states.saved')} body={t('profile.edit.updated')} /> : null}

        <AppCard>
          <View style={styles.avatarPanel}>
            <View style={styles.avatar}>
              {avatarSource ? <Image source={{ uri: avatarSource }} style={styles.avatarImage} /> : <AppText style={styles.avatarText}>{(displayName || auth.user?.email || 'H').slice(0, 1).toUpperCase()}</AppText>}
            </View>
            <View style={styles.previewCopy}>
              <AppText style={styles.previewName}>{displayName.trim() || t('profile.edit.displayNamePreview')}</AppText>
              <AppText style={styles.previewHandle}>{handle.trim() ? `@${handle.trim()}` : t('profile.edit.addHandle')}</AppText>
              <AppText style={styles.previewEmail}>{auth.user?.email ?? t('common.states.signedIn')}</AppText>
            </View>
          </View>
          <View style={styles.avatarActions}>
            <Pressable accessibilityRole="button" disabled={saving || removingAvatar} onPress={pickAvatar} style={({ pressed }) => [styles.avatarButton, (saving || removingAvatar) && styles.disabled, pressed && styles.pressed]}>
              <AppText style={styles.avatarButtonText}>{avatarSource ? t('profile.edit.changePhoto') : t('profile.edit.addPhoto')}</AppText>
            </Pressable>
            {avatarSource ? (
              <Pressable accessibilityRole="button" disabled={saving || removingAvatar} onPress={handleRemoveAvatar} style={({ pressed }) => [styles.avatarRemoveButton, (saving || removingAvatar) && styles.disabled, pressed && styles.pressed]}>
                <AppText style={styles.avatarRemoveButtonText}>{removingAvatar ? t('profile.edit.removing') : t('common.actions.remove')}</AppText>
              </Pressable>
            ) : null}
          </View>
          <InfoNotice tone="info" body={t('profile.edit.profilePictureNotice')} />
        </AppCard>

        <AppCard>
          <ProfileField label={t('profile.edit.fields.displayName')} value={displayName} onChangeText={setDisplayName} placeholder="Kopy" disabled={saving} />
          <ProfileField label={t('profile.edit.fields.handle')} hint={usernameCooldownHint ?? (publicProfilePath ? t('profile.edit.publicUrlHint', { path: publicProfilePath }) : t('profile.edit.handlePolicyHint'))} value={handle} onChangeText={setHandle} placeholder="kopy" disabled={saving} autoCapitalize="none" />
          <ProfileField label={t('profile.edit.fields.bio')} hint={t('inventory.labels.optional')} value={bio} onChangeText={setBio} placeholder={t('profile.edit.bioPlaceholderNative')} disabled={saving} multiline />
        </AppCard>

        <AppCard>
          <SemanticBadge label={t('profile.edit.localDisplayTitle')} tone="info" size="sm" />
          <AppText style={styles.sectionTitle}>{t('profile.edit.localDisplayTitle')}</AppText>
          <AppText style={[styles.preferenceBody, { color: theme.color.muted }]}>{t('profile.edit.localDisplayBody')}</AppText>
          <AppSelect
            label={t('profile.edit.fields.country')}
            helper={t('profile.edit.countryHelper')}
            value={countryCode}
            options={countrySelectOptions}
            disabled={saving}
            onSelect={(value) => {
              const selectedCountry = countryOptions.find((country) => country.code === value);
              setCountryCode(value);
              if (selectedCountry) setPreferredCurrency(selectedCountry.currency);
            }}
          />
          <AppSelect
            label={t('profile.edit.fields.displayCurrency')}
            helper={t('profile.edit.displayOnly')}
            value={preferredCurrency}
            options={currencySelectOptions}
            disabled={saving}
            onSelect={(value) => setPreferredCurrency(value as SupportedCurrency)}
          />
        </AppCard>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={handleSave} style={({ pressed }) => [styles.primaryButton, saving && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{saving ? t('common.states.saving') : t('profile.edit.saveProfile')}</AppText>
          </Pressable>

        </View>
      </ScrollView>
    </AppScreen>
  );
}

export function MeScreen(props: Props) {
  return <ProfileScreen {...props} />;
}

function ProfileField({ label, hint, value, onChangeText, placeholder, disabled, multiline, autoCapitalize }: { label: string; hint?: string; value: string; onChangeText: (value: string) => void; placeholder: string; disabled?: boolean; multiline?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={[styles.label, { color: theme.color.text }]}>{label}</AppText>
        {hint ? <AppText style={[styles.hint, { color: theme.color.muted }]}>{hint}</AppText> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.muted}
        editable={!disabled}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }, multiline && styles.textarea]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  avatarPanel: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  avatar: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden', backgroundColor: '#CCFBF1', borderWidth: 1, borderColor: '#5EEAD4', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 38 },
  avatarText: { color: '#0F766E', fontSize: 25, fontWeight: '900' },
  previewCopy: { flex: 1 },
  previewName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  previewHandle: { marginTop: 3, color: '#0F766E', fontWeight: '900' },
  previewEmail: { marginTop: 3, color: '#64748B', fontWeight: '600' },
  sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.35 },
  preferenceBody: { lineHeight: 20, fontWeight: '700' },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preferenceChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  preferenceChipText: { fontWeight: '900' },
  field: { gap: 8 },
  labelRow: { gap: 3 },
  label: { color: '#0F172A', fontWeight: '900' },
  hint: { color: '#64748B', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  input: { borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 12, color: '#0F172A', fontSize: 16, fontWeight: '600' },
  textarea: { minHeight: 118, lineHeight: 22 },
  actions: { gap: 10 },
  avatarButton: { borderRadius: 999, backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10 },
  avatarButtonText: { color: '#FFFFFF', fontWeight: '900' },
  avatarRemoveButton: { borderRadius: 999, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', paddingHorizontal: 14, paddingVertical: 10 },
  avatarRemoveButtonText: { color: '#991B1B', fontWeight: '900' },
  primaryButton: { borderRadius: 18, backgroundColor: '#0F766E', paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderRadius: 18, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#334155', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
