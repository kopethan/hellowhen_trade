import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppSelect } from '../../components/AppSelect';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { countryOptions, currencyOptions, type SupportedCurrency } from '../../lib/moneyPreferences';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type AuthMode = 'login' | 'register' | 'forgot';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? '';

const countrySelectOptions = countryOptions.map((country) => ({ value: country.code, label: country.label, helper: `Default currency ${country.currency.toUpperCase()}` }));
const currencySelectOptions = currencyOptions.map((currency) => ({ value: currency.code, label: currency.label, helper: currency.helper }));

function authSubtitle(mode: AuthMode) {
  if (mode === 'register') return 'Create your account and set local display preferences for the beta.';
  if (mode === 'forgot') return 'Reset your password using your account email.';
  return 'Sign in to create needs, offers, and trades.';
}

export function LoginScreen() {
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
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

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'TradeTabs' }] }));
  }, [auth.isAuthenticated, navigation]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  function validateLocalForm() {
    if (!email.trim()) return 'Enter your email.';
    if (mode !== 'forgot' && password.length < 8) return 'Password must be at least 8 characters.';
    if (mode === 'register' && !displayName.trim()) return 'Enter your name.';
    if (mode === 'register' && password !== confirmPassword) return 'Passwords do not match.';
    if (mode === 'register' && !countryCode) return 'Choose your country.';
    if (mode === 'register' && !preferredCurrency) return 'Choose your display currency.';
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

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.shell} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppCard style={styles.authCard}>
          <View style={styles.brandBlock}>
            <SemanticBadge label="Trade" tone="trade" />
            <AppText style={styles.logo}>Hellowhen</AppText>
            <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{authSubtitle(mode)}</AppText>
          </View>

          <View style={[styles.toggleRow, { backgroundColor: theme.color.subtleSurface }]}>
            <ModeButton label="Login" active={mode === 'login'} onPress={() => switchMode('login')} />
            <ModeButton label="Register" active={mode === 'register'} onPress={() => switchMode('register')} />
            <ModeButton label="Reset" active={mode === 'forgot'} onPress={() => switchMode('forgot')} />
          </View>

          <View style={styles.formStack}>
            {mode === 'register' ? <AuthInput value={displayName} onChangeText={setDisplayName} placeholder="Full name" /> : null}
            <AuthInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" />
            {mode !== 'forgot' ? <PasswordInput value={password} onChangeText={setPassword} placeholder="Password" showPassword={showPassword} onToggle={() => setShowPassword((value) => !value)} /> : null}
            {mode === 'register' ? <AuthInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" secureTextEntry={!showPassword} /> : null}

            {mode === 'register' ? (
              <View style={[styles.preferenceBlock, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
                <View style={styles.preferenceHeader}>
                  <AppText style={styles.preferenceTitle}>Local display</AppText>
                  <AppText style={[styles.preferenceBody, { color: theme.color.muted }]}>Used to localize trade display. You can change this from Profile later.</AppText>
                </View>
                <AppSelect
                  label="Country"
                  value={countryCode}
                  options={countrySelectOptions}
                  onSelect={(value) => {
                    const selectedCountry = countryOptions.find((country) => country.code === value);
                    setCountryCode(value);
                    if (selectedCountry) setPreferredCurrency(selectedCountry.currency);
                  }}
                />
                <AppSelect
                  label="Display currency"
                  value={preferredCurrency}
                  options={currencySelectOptions}
                  onSelect={(value) => setPreferredCurrency(value as SupportedCurrency)}
                />
              </View>
            ) : null}

            {mode === 'register' ? <Pressable onPress={() => setAcceptedTerms((value) => !value)} style={styles.termsRow}><View style={[styles.checkbox, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, acceptedTerms && { backgroundColor: theme.semantic.proposal.bg, borderColor: theme.semantic.proposal.bg }]}>{acceptedTerms ? <AppText style={styles.checkboxMark}>✓</AppText> : null}</View><AppText style={[styles.termsText, { color: theme.color.muted }]}>I agree to the Terms and Privacy Policy.</AppText></Pressable> : null}
          </View>

          {mode === 'forgot' ? <InfoNotice tone="info" title="Password reset" body="Enter your account email and we will send a reset link if the account exists." /> : null}
          {error ? <InfoNotice tone="danger" title="Sign-in error" body={error} /> : null}
          {message ? <InfoNotice tone="success" title="Done" body={message} /> : null}

          <View style={styles.actionStack}>
            <AuthActionButton label={submitting ? 'Working...' : mode === 'login' ? 'Login' : mode === 'register' ? 'Create account' : 'Send reset link'} disabled={submitting || googleSubmitting} onPress={() => { void handleSubmit(); }} />
            <Pressable accessibilityRole="button" onPress={() => { void handleGoogle(); }} disabled={googleSubmitting || submitting || !googleConfigured} style={({ pressed }) => [styles.googleButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed, (!googleConfigured || googleSubmitting) && styles.disabledButton]}><AppText style={[styles.googleButtonText, { color: theme.color.text }]}>{googleSubmitting ? 'Opening Google...' : 'Continue with Google'}</AppText></Pressable>
          </View>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useThemeTokens();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.modeButton, active && { backgroundColor: theme.color.text }, pressed && styles.pressed]}><AppText style={[styles.modeButtonText, { color: active ? theme.color.background : theme.color.muted }]}>{label}</AppText></Pressable>;
}

function AuthInput(props: React.ComponentProps<typeof TextInput>) {
  const theme = useThemeTokens();
  return <TextInput {...props} placeholderTextColor={theme.color.muted} style={[styles.input, { color: theme.color.text, backgroundColor: theme.color.surface, borderColor: theme.color.border }, props.style]} />;
}

function PasswordInput({ value, onChangeText, placeholder, showPassword, onToggle }: { value: string; onChangeText: (value: string) => void; placeholder: string; showPassword: boolean; onToggle: () => void }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.passwordRow}>
      <AuthInput value={value} onChangeText={onChangeText} placeholder={placeholder} secureTextEntry={!showPassword} style={styles.passwordInput} />
      <Pressable onPress={onToggle} style={({ pressed }) => [styles.showButton, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, pressed && styles.pressed]}>
        <AppText style={[styles.showButtonText, { color: theme.color.text }]}>{showPassword ? 'Hide' : 'Show'}</AppText>
      </Pressable>
    </View>
  );
}

function AuthActionButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}><AppText style={styles.primaryButtonText}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  shell: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  authCard: { gap: 16 },
  brandBlock: { gap: 9 },
  logo: { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  subtitle: { lineHeight: 20, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 18 },
  modeButton: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  modeButtonText: { fontWeight: '900' },
  formStack: { gap: 11 },
  input: { minHeight: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16, fontWeight: '600' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passwordInput: { flex: 1 },
  showButton: { minHeight: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  showButtonText: { fontWeight: '900' },
  preferenceBlock: { borderRadius: 22, borderWidth: 1, padding: 12, gap: 12 },
  preferenceHeader: { gap: 4 },
  preferenceTitle: { fontSize: 16, fontWeight: '900' },
  preferenceBody: { lineHeight: 18, fontWeight: '700' },
  termsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  termsText: { flex: 1, fontWeight: '700', lineHeight: 19 },
  actionStack: { gap: 10 },
  primaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  googleButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  googleButtonText: { fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
