import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppSelect } from '../../components/AppSelect';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { countryOptions } from '../../lib/moneyPreferences';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type AuthMode = 'login' | 'register' | 'forgot';
type TwoFactorChallenge = { challengeToken: string; message?: string };


function authSubtitleKey(mode: AuthMode) {
  if (mode === 'register') return 'auth.subtitles.register';
  if (mode === 'forgot') return 'auth.subtitles.forgotNative';
  return 'auth.subtitles.login';
}

export function LoginScreen() {
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [countryCode, setCountryCode] = useState('FR');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<TwoFactorChallenge | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countrySelectOptions = useMemo(() => countryOptions.map((country) => ({
    value: country.code,
    label: t(`common.locale.countries.${country.code}`),
  })), [t]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    setAuthCompleted(true);
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'TradeTabs' }] }));
  }, [auth.isAuthenticated, navigation]);

  function finishAuthNavigation() {
    setAuthCompleted(true);
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'TradeTabs' }] }));
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setTwoFactorChallenge(null);
    setTwoFactorCode('');
  }

  function validateLocalForm() {
    if (twoFactorChallenge) {
      if (!twoFactorCode.trim()) return t('auth.errors.twoFactorCodeRequired');
      return null;
    }
    if (!email.trim()) return t('auth.errors.emailRequired');
    if (mode !== 'forgot' && password.length < 8) return t('auth.errors.passwordMin');
    if (mode === 'register' && !displayName.trim()) return t('auth.errors.nameRequired');
    if (mode === 'register' && password !== confirmPassword) return t('auth.errors.passwordsMismatch');
    if (mode === 'register' && !countryCode) return t('auth.errors.countryRequired');
    if (mode === 'register' && !acceptedTerms) return t('auth.errors.termsRequired');
    if (mode === 'register' && !ageConfirmed) return t('auth.errors.ageRequired');
    return null;
  }

  async function handleSubmit() {
    if (submitting || authCompleted) return;
    const validationError = validateLocalForm();
    if (validationError) { setError(validationError); return; }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    let completed = false;
    try {
      if (mode === 'login') {
        if (twoFactorChallenge) {
          await auth.completeTwoFactorLogin({ challengeToken: twoFactorChallenge.challengeToken, code: twoFactorCode.trim() });
          finishAuthNavigation();
          completed = true;
          return;
        }

        const challenge = await auth.login(email.trim(), password);
        if (challenge) {
          setTwoFactorChallenge({ challengeToken: challenge.challengeToken, message: challenge.message });
          setMessage(challenge.message || t('auth.twoFactorNotice'));
          setTwoFactorCode('');
          return;
        }

        finishAuthNavigation();
        completed = true;
      } else if (mode === 'register') {
        await auth.register(email.trim(), password, displayName, confirmPassword, acceptedTerms, ageConfirmed, countryCode);
        finishAuthNavigation();
        completed = true;
      } else {
        await auth.forgotPassword(email);
        setMessage(t('auth.reset.requested'));
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      if (!completed) setSubmitting(false);
    }
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.shell} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppCard style={styles.authCard}>
          <View style={styles.brandBlock}>
            <SemanticBadge label={t('auth.brandBadge')} tone="trade" />
            <AppText style={styles.logo}>Hellowhen</AppText>
            <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t(authSubtitleKey(mode))}</AppText>
          </View>

          <View style={[styles.toggleRow, { backgroundColor: theme.color.subtleSurface }]}>
            <ModeButton label={t('auth.modes.login')} active={mode === 'login'} onPress={() => switchMode('login')} />
            <ModeButton label={t('auth.modes.register')} active={mode === 'register'} onPress={() => switchMode('register')} />
            <ModeButton label={t('auth.modes.reset')} active={mode === 'forgot'} onPress={() => switchMode('forgot')} />
          </View>

          <View style={styles.formStack}>
            {twoFactorChallenge ? (
              <View style={[styles.twoFactorBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
                <SemanticBadge label={t('auth.modes.verifyCode')} tone="time" size="sm" />
                <AppText style={styles.twoFactorTitle}>{t('auth.twoFactorNotice')}</AppText>
                <AppText style={[styles.twoFactorBody, { color: theme.color.muted }]}>{t('auth.twoFactorRecoveryHint')}</AppText>
                <AuthInput value={twoFactorCode} onChangeText={(value) => setTwoFactorCode(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder={t('auth.placeholders.twoFactorOrRecoveryCode')} />
                <AppText style={[styles.twoFactorBody, { color: theme.color.muted }]}>{t('auth.twoFactorLostAccessPrefix')} {t('auth.twoFactorLostAccessLink')}.</AppText>
                <Pressable accessibilityRole="button" onPress={() => { setTwoFactorChallenge(null); setTwoFactorCode(''); setPassword(''); setMessage(null); }} style={({ pressed }) => [styles.inlineButton, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, pressed && styles.pressed]}>
                  <AppText style={styles.inlineButtonText}>{t('auth.actions.backToLogin')}</AppText>
                </Pressable>
              </View>
            ) : null}

            {!twoFactorChallenge && mode === 'register' ? <AuthInput value={displayName} onChangeText={setDisplayName} placeholder={t('auth.fields.fullName')} /> : null}
            {!twoFactorChallenge ? <AuthInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder={t('auth.fields.email')} /> : null}
            {!twoFactorChallenge && mode !== 'forgot' ? <PasswordInput value={password} onChangeText={setPassword} placeholder={t('auth.fields.password')} showPassword={showPassword} onToggle={() => setShowPassword((value) => !value)} /> : null}
            {!twoFactorChallenge && mode === 'register' ? <AuthInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('auth.fields.confirmPassword')} secureTextEntry={!showPassword} /> : null}

            {!twoFactorChallenge && mode === 'register' ? (
              <View style={[styles.preferenceBlock, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
                <View style={styles.preferenceHeader}>
                  <AppText style={styles.preferenceTitle}>{t('auth.localDisplay.title')}</AppText>
                  <AppText style={[styles.preferenceBody, { color: theme.color.muted }]}>{t('auth.localDisplay.bodyNative')}</AppText>
                </View>
                <AppSelect
                  label={t('auth.fields.country')}
                  value={countryCode}
                  options={countrySelectOptions}
                  onSelect={setCountryCode}
                />
              </View>
            ) : null}

            {!twoFactorChallenge && mode === 'register' ? (
              <View style={styles.termsBlock}>
                <Pressable accessibilityRole="checkbox" accessibilityLabel={t('auth.terms')} accessibilityState={{ checked: acceptedTerms }} onPress={() => setAcceptedTerms((value) => !value)} style={styles.termsRow}>
                  <View style={[styles.checkbox, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, acceptedTerms && { backgroundColor: theme.semantic.proposal.bg, borderColor: theme.semantic.proposal.bg }]}>{acceptedTerms ? <AppText style={styles.checkboxMark}>✓</AppText> : null}</View>
                  <AppText style={[styles.termsText, { color: theme.color.muted }]}>{t('auth.terms')}</AppText>
                </Pressable>
                <Pressable accessibilityRole="checkbox" accessibilityLabel={t('auth.ageConfirmation')} accessibilityState={{ checked: ageConfirmed }} onPress={() => setAgeConfirmed((value) => !value)} style={styles.termsRow}>
                  <View style={[styles.checkbox, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, ageConfirmed && { backgroundColor: theme.semantic.proposal.bg, borderColor: theme.semantic.proposal.bg }]}>{ageConfirmed ? <AppText style={styles.checkboxMark}>✓</AppText> : null}</View>
                  <AppText style={[styles.termsText, { color: theme.color.muted }]}>{t('auth.ageConfirmation')}</AppText>
                </Pressable>
                <View style={styles.policyLinkRow}>
                  <Pressable accessibilityRole="button" onPress={() => navigation.navigate('LegalPolicy', { policy: 'terms' })}><AppText style={[styles.policyLinkText, { color: theme.semantic.proposal.bg }]}>{t('legal.authLinks.viewTerms')}</AppText></Pressable>
                  <Pressable accessibilityRole="button" onPress={() => navigation.navigate('LegalPolicy', { policy: 'privacy' })}><AppText style={[styles.policyLinkText, { color: theme.semantic.proposal.bg }]}>{t('legal.authLinks.viewPrivacy')}</AppText></Pressable>
                </View>
              </View>
            ) : null}
          </View>

          {mode === 'forgot' ? <InfoNotice tone="info" title={t('auth.reset.badge')} body={t('auth.forgotNotice')} /> : null}
          {error ? <InfoNotice tone="danger" title={t('auth.errors.signIn')} body={error} /> : null}
          {message ? <InfoNotice tone="success" title={t('common.states.done')} body={message} /> : null}

          <View style={styles.actionStack}>
            <AuthActionButton label={authCompleted ? t('auth.actions.openingApp') : submitting ? t('common.states.working') : twoFactorChallenge ? t('auth.actions.verifyCode') : mode === 'login' ? t('auth.actions.login') : mode === 'register' ? t('auth.actions.createAccount') : t('auth.actions.sendResetLink')} disabled={submitting || authCompleted} onPress={() => { void handleSubmit(); }} />
            <InfoNotice tone="info" title={t('auth.googleDisabledTitle')} body={t('auth.googleDisabledFirstLaunch')} />
          </View>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useThemeTokens();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.modeButton, active && { backgroundColor: theme.color.text }, pressed && styles.pressed]}><AppText style={[styles.modeButtonText, { color: active ? theme.color.background : theme.color.muted }]}>{label}</AppText></Pressable>;
}

function AuthInput(props: React.ComponentProps<typeof TextInput>) {
  const theme = useThemeTokens();
  return <TextInput accessibilityLabel={props.accessibilityLabel ?? props.placeholder} {...props} placeholderTextColor={theme.color.muted} style={[styles.input, { color: theme.color.text, backgroundColor: theme.color.surface, borderColor: theme.color.border }, props.style]} />;
}

function PasswordInput({ value, onChangeText, placeholder, showPassword, onToggle }: { value: string; onChangeText: (value: string) => void; placeholder: string; showPassword: boolean; onToggle: () => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={styles.passwordRow}>
      <AuthInput value={value} onChangeText={onChangeText} placeholder={placeholder} secureTextEntry={!showPassword} style={styles.passwordInput} />
      <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? t('auth.actions.hidePassword') : t('auth.actions.showPassword')} onPress={onToggle} style={({ pressed }) => [styles.showButton, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, pressed && styles.pressed]}>
        <AppText style={[styles.showButtonText, { color: theme.color.text }]}>{showPassword ? t('common.actions.hide') : t('common.actions.show')}</AppText>
      </Pressable>
    </View>
  );
}

function AuthActionButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}><AppText style={styles.primaryButtonText}>{label}</AppText></Pressable>;
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
  termsBlock: { gap: 8 },
  termsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  policyLinkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingLeft: 33 },
  policyLinkText: { fontWeight: '900', textDecorationLine: 'underline' },
  checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  termsText: { flex: 1, fontWeight: '700', lineHeight: 19 },
  actionStack: { gap: 10 },
  twoFactorBox: { borderRadius: 22, borderWidth: 1, padding: 12, gap: 10 },
  twoFactorTitle: { fontSize: 18, fontWeight: '900' },
  twoFactorBody: { lineHeight: 19, fontWeight: '700' },
  inlineButton: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  inlineButtonText: { fontWeight: '900' },
  primaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  disabledButton: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
