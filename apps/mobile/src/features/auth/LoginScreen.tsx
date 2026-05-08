import React, { useMemo, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useAuth } from '../../providers/AuthProvider';

type AuthMode = 'login' | 'register' | 'forgot';
type SupportedCurrency = 'eur' | 'usd' | 'gbp';

const countryOptions = [
  { code: 'FR', label: 'France', currency: 'eur' as SupportedCurrency },
  { code: 'US', label: 'United States', currency: 'usd' as SupportedCurrency },
  { code: 'GB', label: 'United Kingdom', currency: 'gbp' as SupportedCurrency },
  { code: 'DE', label: 'Germany', currency: 'eur' as SupportedCurrency },
  { code: 'ES', label: 'Spain', currency: 'eur' as SupportedCurrency },
  { code: 'IT', label: 'Italy', currency: 'eur' as SupportedCurrency },
];
const currencyOptions: SupportedCurrency[] = ['eur', 'usd', 'gbp'];

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? '';

export function LoginScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [countryCode, setCountryCode] = useState('FR');
  const [preferredCurrency, setPreferredCurrency] = useState<SupportedCurrency>('eur');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const googleConfigured = useMemo(() => Boolean(googleWebClientId || googleIosClientId || googleAndroidClientId), []);

  function validateLocalForm() {
    if (!email.trim()) return 'Enter your email.';
    if (mode !== 'forgot' && password.length < 8) return 'Password must be at least 8 characters.';
    if (mode === 'register' && !displayName.trim()) return 'Enter your name.';
    if (mode === 'register' && password !== confirmPassword) return 'Passwords do not match.';
    if (mode === 'register' && !countryCode) return 'Choose your country.';
    if (mode === 'register' && !acceptedTerms) return 'Please agree to the terms to continue.';
    return null;
  }

  async function handleSubmit() {
    const validationError = validateLocalForm();
    if (validationError) { setError(validationError); return; }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'login') await auth.login(email, password);
      else if (mode === 'register') await auth.register(email, password, displayName, confirmPassword, acceptedTerms, countryCode, preferredCurrency);
      else {
        const result = await auth.forgotPassword(email);
        setMessage(result.message);
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    if (!googleConfigured) { setError('Google sign-in is not available in this build.'); return; }
    setGoogleSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({
        webClientId: googleWebClientId || undefined,
        iosClientId: googleIosClientId || undefined,
        scopes: ['profile', 'email']
      });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      const idToken = (result as { idToken?: string; data?: { idToken?: string } }).idToken ?? (result as { data?: { idToken?: string } }).data?.idToken;
      if (!idToken) throw new Error('Google sign-in could not be completed.');
      await auth.loginWithGoogleIdToken(idToken);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, caughtError instanceof Error ? caughtError.message : 'Google sign-in failed.'));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return <AppScreen><ScrollView contentContainerStyle={styles.shell} keyboardShouldPersistTaps="handled"><AppCard>
    <SemanticBadge label="Trade" tone="trade" />
    <AppText style={styles.logo}>Hellowhen</AppText>
    <AppText style={styles.subtitle}>Sign in to create needs, offers, and trades.</AppText>

    <View style={styles.toggleRow}><ModeButton label="Login" active={mode === 'login'} onPress={() => setMode('login')} /><ModeButton label="Register" active={mode === 'register'} onPress={() => setMode('register')} /><ModeButton label="Reset" active={mode === 'forgot'} onPress={() => setMode('forgot')} /></View>

    {mode === 'register' ? <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Full name" style={styles.input} /> : null}
    <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" style={styles.input} />
    {mode !== 'forgot' ? <View style={styles.passwordRow}><TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={!showPassword} style={[styles.input, styles.passwordInput]} /><Pressable onPress={() => setShowPassword((value) => !value)} style={styles.showButton}><AppText style={styles.showButtonText}>{showPassword ? 'Hide' : 'Show'}</AppText></Pressable></View> : null}
    {mode === 'register' ? <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" secureTextEntry={!showPassword} style={styles.input} /> : null}
    {mode === 'register' ? <View style={styles.preferenceBlock}><AppText style={styles.preferenceTitle}>Money preferences</AppText><AppText style={styles.preferenceBody}>Used for wallet money and future Stripe demo flows. You can change this from Profile later.</AppText><View style={styles.optionWrap}>{countryOptions.map((option) => <Pressable key={option.code} accessibilityRole="button" onPress={() => { setCountryCode(option.code); setPreferredCurrency(option.currency); }} style={({ pressed }) => [styles.preferenceChip, countryCode === option.code && styles.preferenceChipActive, pressed && styles.pressed]}><AppText style={[styles.preferenceChipText, countryCode === option.code && styles.preferenceChipTextActive]}>{option.label}</AppText></Pressable>)}</View><View style={styles.optionWrap}>{currencyOptions.map((currency) => <Pressable key={currency} accessibilityRole="button" onPress={() => setPreferredCurrency(currency)} style={({ pressed }) => [styles.preferenceChip, preferredCurrency === currency && styles.preferenceChipActive, pressed && styles.pressed]}><AppText style={[styles.preferenceChipText, preferredCurrency === currency && styles.preferenceChipTextActive]}>{currency.toUpperCase()}</AppText></Pressable>)}</View></View> : null}
    {mode === 'register' ? <Pressable onPress={() => setAcceptedTerms((value) => !value)} style={styles.termsRow}><View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]} /><AppText style={styles.termsText}>I agree to the Terms and Privacy Policy.</AppText></Pressable> : null}

    {mode === 'forgot' ? <InfoNotice tone="info" title="Password reset" body="Enter your account email and we will send a reset link if the account exists." /> : null}
    {error ? <InfoNotice tone="danger" title="Sign-in error" body={error} /> : null}
    {message ? <InfoNotice tone="success" title="Done" body={message} /> : null}

    <Button title={submitting ? 'Working...' : mode === 'login' ? 'Login' : mode === 'register' ? 'Create account' : 'Send reset link'} disabled={submitting || googleSubmitting} onPress={handleSubmit} />
    <Pressable accessibilityRole="button" onPress={() => { void handleGoogle(); }} disabled={googleSubmitting || submitting || !googleConfigured} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, (!googleConfigured || googleSubmitting) && styles.disabledButton]}><AppText style={styles.googleButtonText}>{googleSubmitting ? 'Opening Google...' : 'Continue with Google'}</AppText></Pressable>
  </AppCard></ScrollView></AppScreen>;
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.modeButton, active && styles.modeButtonActive, pressed && styles.pressed]}><AppText style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  shell: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  logo: { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: '#64748B', lineHeight: 20, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: 8, padding: 4, borderRadius: 18, backgroundColor: '#F1F5F9' },
  modeButton: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  modeButtonActive: { backgroundColor: '#111827' },
  modeButtonText: { color: '#334155', fontWeight: '900' },
  modeButtonTextActive: { color: '#FFFFFF' },
  input: { borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', padding: 12, fontSize: 16 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passwordInput: { flex: 1 },
  showButton: { borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#F8FAFC' },
  showButtonText: { fontWeight: '900', color: '#0F172A' },
  preferenceBlock: { gap: 8 },
  preferenceTitle: { color: '#0F172A', fontWeight: '900' },
  preferenceBody: { color: '#64748B', lineHeight: 18, fontWeight: '700' },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preferenceChip: { borderRadius: 999, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8 },
  preferenceChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  preferenceChipText: { color: '#334155', fontWeight: '900' },
  preferenceChipTextActive: { color: '#FFFFFF' },
  termsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#94A3B8', backgroundColor: '#FFFFFF' },
  checkboxActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  termsText: { flex: 1, color: '#334155', fontWeight: '700', lineHeight: 19 },
  googleButton: { borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 13, alignItems: 'center', backgroundColor: '#FFFFFF' },
  googleButtonText: { color: '#0F172A', fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
});
