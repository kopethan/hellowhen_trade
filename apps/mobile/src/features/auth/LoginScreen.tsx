import React, { useEffect, useMemo, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { API_URL } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useAuth } from '../../providers/AuthProvider';

type AuthMode = 'login' | 'register' | 'forgot';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? '';

export function LoginScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('Demo User');
  const [email, setEmail] = useState('demo@hellowhen.app');
  const [password, setPassword] = useState('password123');
  const [confirmPassword, setConfirmPassword] = useState('password123');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const googleConfigured = useMemo(() => Boolean(googleWebClientId || googleIosClientId || googleAndroidClientId), []);

  useEffect(() => {
    if (!googleConfigured) return;
    GoogleSignin.configure({
      webClientId: googleWebClientId || undefined,
      iosClientId: googleIosClientId || undefined,
      scopes: ['profile', 'email']
    });
  }, [googleConfigured]);

  function validateLocalForm() {
    if (!email.trim()) return 'Enter your email.';
    if (mode !== 'forgot' && password.length < 8) return 'Password must be at least 8 characters.';
    if (mode === 'register' && password !== confirmPassword) return 'Passwords do not match.';
    if (mode === 'register' && !acceptedTerms) return 'Please accept the terms placeholder to continue.';
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
      else if (mode === 'register') await auth.register(email, password, displayName, confirmPassword, acceptedTerms);
      else {
        const result = await auth.forgotPassword(email);
        setMessage(result.devResetUrl ? `${result.message} Dev reset link: ${result.devResetUrl}` : result.message);
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    if (!googleConfigured) { setError('Google sign-in needs EXPO_PUBLIC_GOOGLE_* client IDs and API GOOGLE_* client IDs.'); return; }
    setGoogleSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      const idToken = (result as { idToken?: string; data?: { idToken?: string } }).idToken ?? (result as { data?: { idToken?: string } }).data?.idToken;
      if (!idToken) throw new Error('Google did not return an identity token. Check Google client ID configuration.');
      await auth.loginWithGoogleIdToken(idToken);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, caughtError instanceof Error ? caughtError.message : 'Google sign-in failed.'));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  function fillDemo(nextEmail: string) {
    setMode('login');
    setEmail(nextEmail);
    setPassword('password123');
    setConfirmPassword('password123');
    setError(null);
    setMessage(null);
  }

  return <AppScreen><ScrollView contentContainerStyle={styles.shell} keyboardShouldPersistTaps="handled"><AppCard>
    <SemanticBadge label="Perfect Auth" tone="trade" />
    <AppText style={styles.logo}>Hellowhen</AppText>
    <InfoNotice tone="info" title="Trade-first account" body="Create an account, sign in with Google, or reset your password. Google sign-in requires a development build, not Expo Go." />

    <View style={styles.toggleRow}><ModeButton label="Login" active={mode === 'login'} onPress={() => setMode('login')} /><ModeButton label="Register" active={mode === 'register'} onPress={() => setMode('register')} /><ModeButton label="Reset" active={mode === 'forgot'} onPress={() => setMode('forgot')} /></View>

    {mode === 'register' ? <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Full name" style={styles.input} /> : null}
    <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" style={styles.input} />
    {mode !== 'forgot' ? <View style={styles.passwordRow}><TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={!showPassword} style={[styles.input, styles.passwordInput]} /><Pressable onPress={() => setShowPassword((value) => !value)} style={styles.showButton}><AppText style={styles.showButtonText}>{showPassword ? 'Hide' : 'Show'}</AppText></Pressable></View> : null}
    {mode === 'register' ? <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" secureTextEntry={!showPassword} style={styles.input} /> : null}
    {mode === 'register' ? <Pressable onPress={() => setAcceptedTerms((value) => !value)} style={styles.termsRow}><View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]} /><AppText style={styles.termsText}>I understand this is a test MVP with fake credits and placeholder terms.</AppText></Pressable> : null}

    {mode === 'forgot' ? <InfoNotice tone="instruction" title="Password reset" body="Enter your account email. If it exists, Hellowhen will send a reset link through Resend when email is configured." /> : <InfoNotice tone="instruction" title="Password hint" body="Use at least 8 characters. Keep fake test accounts separate from real passwords." />}
    {error ? <InfoNotice tone="danger" title="Auth error" body={error} /> : null}
    {message ? <InfoNotice tone="success" title="Done" body={message} /> : null}

    <Button title={submitting ? 'Working...' : mode === 'login' ? 'Login' : mode === 'register' ? 'Create account' : 'Send reset link'} disabled={submitting || googleSubmitting} onPress={handleSubmit} />
    <Pressable accessibilityRole="button" onPress={() => { void handleGoogle(); }} disabled={googleSubmitting || submitting} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, (!googleConfigured || googleSubmitting) && styles.disabledButton]}><AppText style={styles.googleButtonText}>{googleSubmitting ? 'Opening Google...' : 'Continue with Google'}</AppText></Pressable>

    <View style={styles.demoRow}><Pressable onPress={() => fillDemo('demo@hellowhen.app')}><AppText style={styles.demoLink}>Demo</AppText></Pressable><Pressable onPress={() => fillDemo('helper@hellowhen.app')}><AppText style={styles.demoLink}>Helper</AppText></Pressable><Pressable onPress={() => fillDemo('admin@hellowhen.app')}><AppText style={styles.demoLink}>Admin</AppText></Pressable></View>
    <AppText style={styles.apiHint}>Password for demo users: password123</AppText>
    <AppText style={styles.apiHint}>API URL: {API_URL}</AppText>
  </AppCard></ScrollView></AppScreen>;
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.modeButton, active && styles.modeButtonActive, pressed && styles.pressed]}><AppText style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  shell: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  logo: { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
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
  termsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#94A3B8', backgroundColor: '#FFFFFF' },
  checkboxActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  termsText: { flex: 1, color: '#334155', fontWeight: '700', lineHeight: 19 },
  googleButton: { borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 13, alignItems: 'center', backgroundColor: '#FFFFFF' },
  googleButtonText: { color: '#0F172A', fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  demoRow: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  demoLink: { color: '#0F766E', fontWeight: '900' },
  apiHint: { color: '#64748B', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.78 },
});
