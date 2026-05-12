'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getFriendlyApiErrorMessage } from '../lib/webErrors';
import { countryOptions, currencyOptions, getDefaultCurrencyForCountry, isSupportedCurrency, type SupportedCurrency } from '../lib/webMoneyPreferences';
import { useWebAuth } from '../providers/WebAuthProvider';
import { useWebTranslation } from '../providers/WebI18nProvider';

type AuthMode = 'login' | 'register' | 'forgot';

function subtitleKey(mode: AuthMode) {
  if (mode === 'register') return 'auth.subtitles.register';
  if (mode === 'forgot') return 'auth.subtitles.forgot';
  return 'auth.subtitles.login';
}

export function WebAuthPanel({ redirectTo = '/trades' }: { redirectTo?: string }) {
  const router = useRouter();
  const auth = useWebAuth();
  const { t } = useWebTranslation();
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const primaryLabel = useMemo(() => {
    if (submitting) return t('common.states.working');
    if (mode === 'register') return t('auth.actions.createAccount');
    if (mode === 'forgot') return t('auth.actions.sendResetLink');
    return t('auth.actions.login');
  }, [mode, submitting, t]);

  useEffect(() => {
    if (!auth.hydrated || !auth.isAuthenticated) return;
    router.replace(redirectTo);
    router.refresh();
  }, [auth.hydrated, auth.isAuthenticated, redirectTo, router]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  function validateLocalForm() {
    if (!email.trim()) return t('auth.errors.emailRequired');
    if (mode !== 'forgot' && password.length < 8) return t('auth.errors.passwordMin');
    if (mode === 'register' && !displayName.trim()) return t('auth.errors.nameRequired');
    if (mode === 'register' && password !== confirmPassword) return t('auth.errors.passwordsMismatch');
    if (mode === 'register' && !countryCode) return t('auth.errors.countryRequired');
    if (mode === 'register' && !preferredCurrency) return t('auth.errors.currencyRequired');
    if (mode === 'register' && !acceptedTerms) return t('auth.errors.termsRequired');
    return null;
  }

  async function submit() {
    const validationError = validateLocalForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'login') {
        await auth.login(email.trim(), password);
        router.replace(redirectTo);
        router.refresh();
      } else if (mode === 'register') {
        await auth.register({
          email: email.trim(),
          password,
          confirmPassword,
          displayName: displayName.trim(),
          acceptedTerms,
          countryCode,
          preferredCurrency,
        });
        router.replace(redirectTo);
        router.refresh();
      } else {
        await auth.forgotPassword(email.trim());
        setMessage(t('auth.reset.requested'));
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mobile-card auth-panel">
      <div className="auth-brand-block">
        <span className="semantic-badge trade">{t('auth.brandBadge')}</span>
        <h1>Hellowhen</h1>
        <p>{t(subtitleKey(mode))}</p>
      </div>

      <div className="auth-toggle-row" role="tablist" aria-label={t('auth.modes.label')}>
        <button className={mode === 'login' ? 'auth-toggle auth-toggle--active' : 'auth-toggle'} type="button" onClick={() => switchMode('login')}>{t('auth.modes.login')}</button>
        <button className={mode === 'register' ? 'auth-toggle auth-toggle--active' : 'auth-toggle'} type="button" onClick={() => switchMode('register')}>{t('auth.modes.register')}</button>
        <button className={mode === 'forgot' ? 'auth-toggle auth-toggle--active' : 'auth-toggle'} type="button" onClick={() => switchMode('forgot')}>{t('auth.modes.reset')}</button>
      </div>

      <div className="form-stack">
        {mode === 'register' ? (
          <label className="field-label">
            {t('auth.fields.fullName')}
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t('auth.placeholders.fullName')} autoComplete="name" />
          </label>
        ) : null}

        <label className="field-label">
          {t('auth.fields.email')}
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('auth.placeholders.email')} autoComplete="email" type="email" />
        </label>

        {mode !== 'forgot' ? (
          <label className="field-label">
            {t('auth.fields.password')}
            <div className="password-field">
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('auth.placeholders.passwordMin')} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} />
              <button type="button" className="inline-button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? t('common.actions.hide') : t('common.actions.show')}</button>
            </div>
          </label>
        ) : null}

        {mode === 'register' ? (
          <>
            <label className="field-label">
              {t('auth.fields.confirmPassword')}
              <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t('auth.placeholders.repeatPassword')} autoComplete="new-password" type={showPassword ? 'text' : 'password'} />
            </label>

            <div className="preference-panel">
              <div>
                <h3>{t('auth.localDisplay.title')}</h3>
                <p>{t('auth.localDisplay.body')}</p>
              </div>
              <label className="field-label">
                {t('auth.fields.country')}
                <select
                  value={countryCode}
                  onChange={(event) => {
                    const nextCountry = event.target.value;
                    setCountryCode(nextCountry);
                    setPreferredCurrency(getDefaultCurrencyForCountry(nextCountry));
                  }}
                >
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>{t(`common.locale.countries.${country.code}`)} · {t('common.locale.defaultCurrency', { currency: country.currency.toUpperCase() })}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                {t('auth.fields.displayCurrency')}
                <select
                  value={preferredCurrency}
                  onChange={(event) => {
                    if (isSupportedCurrency(event.target.value)) setPreferredCurrency(event.target.value);
                  }}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency.code} value={currency.code}>{currency.label} · {t(`common.locale.currencies.${currency.code}`)}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="checkbox-row">
              <input checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} type="checkbox" />
              <span>{t('auth.terms')}</span>
            </label>
          </>
        ) : null}
      </div>

      {mode === 'forgot' ? <p className="notice-box info">{t('auth.forgotNotice')}</p> : null}
      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}

      <div className="auth-actions">
        <button type="button" onClick={() => { void submit(); }} disabled={submitting}>{primaryLabel}</button>
        <button type="button" className="secondary" disabled title={t('auth.actions.googleUnavailableWeb')}>{t('auth.actions.continueWithGoogle')}</button>
      </div>
    </section>
  );
}
