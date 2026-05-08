import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileDto } from '@hellowhen/contracts';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountProfile'>;
type ProfileResponse = { profile: ProfileDto };

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function ProfileScreen({ navigation }: Props) {
  const auth = useAuth();
  const [displayName, setDisplayName] = useState(auth.user?.profile?.displayName ?? '');
  const [handle, setHandle] = useState(auth.user?.profile?.handle ?? '');
  const [bio, setBio] = useState(auth.user?.profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (displayName.trim().length < 1) {
      setError('Add a display name.');
      return;
    }
    if (handle.trim() && !/^[a-zA-Z0-9_]{3,32}$/.test(handle.trim())) {
      setError('Handles can use letters, numbers, and underscores, with 3 to 32 characters.');
      return;
    }

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const result = await api.profile.updateMe({ displayName: displayName.trim(), handle: optionalText(handle), bio: optionalText(bio) }) as ProfileResponse;
      auth.updateLocalProfile({ displayName: result.profile.displayName, handle: result.profile.handle, bio: result.profile.bio });
      setSaved(true);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <SemanticBadge label="Profile" tone="info" />
          <AppText style={styles.title}>Profile</AppText>
          <AppText style={styles.subtitle}>Your public identity for trades, needs, and offers.</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title="Could not save" body={error} /> : null}
        {saved ? <InfoNotice tone="success" title="Saved" body="Your profile has been updated." /> : null}

        <AppCard>
          <View style={styles.previewRow}>
            <View style={styles.avatar}><AppText style={styles.avatarText}>{(displayName || auth.user?.email || 'H').slice(0, 1).toUpperCase()}</AppText></View>
            <View style={styles.previewCopy}>
              <AppText style={styles.previewName}>{displayName.trim() || 'Display name'}</AppText>
              <AppText style={styles.previewHandle}>{handle.trim() ? `@${handle.trim()}` : 'Add a handle'}</AppText>
              <AppText style={styles.previewEmail}>{auth.user?.email ?? 'Signed in'}</AppText>
            </View>
          </View>
        </AppCard>

        <AppCard>
          <ProfileField label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Kopy" disabled={saving} />
          <ProfileField label="Handle" hint="Letters, numbers, underscores" value={handle} onChangeText={setHandle} placeholder="kopy" disabled={saving} autoCapitalize="none" />
          <ProfileField label="Bio" hint="Optional" value={bio} onChangeText={setBio} placeholder="What do you trade, need, or offer?" disabled={saving} multiline />
        </AppCard>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={handleSave} style={({ pressed }) => [styles.primaryButton, saving && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save Profile'}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => navigation.goBack()} style={({ pressed }) => [styles.secondaryButton, saving && styles.disabled, pressed && styles.pressed]}>
            <AppText style={styles.secondaryButtonText}>Back</AppText>
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
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={styles.label}>{label}</AppText>
        {hint ? <AppText style={styles.hint}>{hint}</AppText> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        editable={!disabled}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { gap: 8 },
  title: { color: '#0F172A', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: '#64748B', lineHeight: 20, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#CCFBF1', borderWidth: 1, borderColor: '#5EEAD4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#0F766E', fontSize: 25, fontWeight: '900' },
  previewCopy: { flex: 1 },
  previewName: { color: '#0F172A', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  previewHandle: { marginTop: 3, color: '#0F766E', fontWeight: '900' },
  previewEmail: { marginTop: 3, color: '#64748B', fontWeight: '600' },
  field: { gap: 8 },
  labelRow: { gap: 3 },
  label: { color: '#0F172A', fontWeight: '900' },
  hint: { color: '#64748B', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  input: { borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 12, color: '#0F172A', fontSize: 16, fontWeight: '600' },
  textarea: { minHeight: 118, lineHeight: 22 },
  actions: { gap: 10 },
  primaryButton: { borderRadius: 18, backgroundColor: '#0F766E', paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderRadius: 18, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#334155', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
