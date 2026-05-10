'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getFriendlyApiErrorMessage } from '../lib/webErrors';
import { countryOptions, currencyOptions, getDefaultCurrencyForCountry, isSupportedCurrency, type SupportedCurrency } from '../lib/webMoneyPreferences';
import { useWebAuth } from '../providers/WebAuthProvider';

type AuthMode = 'login' | 'register' | 'forgot';

function authSubtitle(mode: AuthMode) {
  if (mode === 'register') return 'Create your account and set local display preferences for the beta.';
  if (mode === 'forgot') return 'Request a reset link for your Hellowhen account.';
  return 'Sign in to create needs, offers, trades, and proposals.';
}

export function WebAuthPanel({ redirectTo = '/trades' }: { redirectTo?: string }) {
  const router = useRouter();
  const auth = useWebAuth();
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
    if (submitting) return 'Working...';
    if (mode === 'register') return 'Create account';
    if (mode === 'forgot') return 'Send reset link';
    return 'Login';
  }, [mode, submitting]);

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
    if (!email.trim()) return 'Enter your email.';
    if (mode !== 'forgot' && password.length < 8) return 'Password must be at least 8 characters.';
    if (mode === 'register' && !displayName.trim()) return 'Enter your name.';
    if (mode === 'register' && password !== confirmPassword) return 'Passwords do not match.';
    if (mode === 'register' && !countryCode) return 'Choose your country.';
    if (mode === 'register' && !preferredCurrency) return 'Choose your display currency.';
    if (mode === 'register' && !acceptedTerms) return 'Please agree to the terms to continue.';
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
        const result = await auth.forgotPassword(email.trim());
        setMessage(result.message);
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
        <span className="semantic-badge trade">Trade</span>
        <h1>Hellowhen</h1>
        <p>{authSubtitle(mode)}</p>
      </div>

      <div className="auth-toggle-row" role="tablist" aria-label="Auth mode">
        <button className={mode === 'login' ? 'auth-toggle auth-toggle--active' : 'auth-toggle'} type="button" onClick={() => switchMode('login')}>Login</button>
        <button className={mode === 'register' ? 'auth-toggle auth-toggle--active' : 'auth-toggle'} type="button" onClick={() => switchMode('register')}>Register</button>
        <button className={mode === 'forgot' ? 'auth-toggle auth-toggle--active' : 'auth-toggle'} type="button" onClick={() => switchMode('forgot')}>Reset</button>
      </div>

      <div className="form-stack">
        {mode === 'register' ? (
          <label className="field-label">
            Full name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Mina Chen" autoComplete="name" />
          </label>
        ) : null}

        <label className="field-label">
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" type="email" />
        </label>

        {mode !== 'forgot' ? (
          <label className="field-label">
            Password
            <div className="password-field">
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} />
              <button type="button" className="inline-button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </label>
        ) : null}

        {mode === 'register' ? (
          <>
            <label className="field-label">
              Confirm password
              <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" autoComplete="new-password" type={showPassword ? 'text' : 'password'} />
            </label>

            <div className="preference-panel">
              <div>
                <h3>Local display</h3>
                <p>Used to localize trade display. Full address details are not collected in this beta.</p>
              </div>
              <label className="field-label">
                Country
                <select
                  value={countryCode}
                  onChange={(event) => {
                    const nextCountry = event.target.value;
                    setCountryCode(nextCountry);
                    setPreferredCurrency(getDefaultCurrencyForCountry(nextCountry));
                  }}
                >
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>{country.label} · default {country.currency.toUpperCase()}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Display currency
                <select
                  value={preferredCurrency}
                  onChange={(event) => {
                    if (isSupportedCurrency(event.target.value)) setPreferredCurrency(event.target.value);
                  }}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency.code} value={currency.code}>{currency.label} · {currency.helper}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="checkbox-row">
              <input checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} type="checkbox" />
              <span>I agree to the Terms and Privacy Policy.</span>
            </label>
          </>
        ) : null}
      </div>

      {mode === 'forgot' ? <p className="notice-box info">Enter your account email and we will send a reset link if the account exists.</p> : null}
      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}

      <div className="auth-actions">
        <button type="button" onClick={() => { void submit(); }} disabled={submitting}>{primaryLabel}</button>
        <button type="button" className="secondary" disabled title="Google sign-in is not wired for web yet">Continue with Google</button>
      </div>
    </section>
  );
}
