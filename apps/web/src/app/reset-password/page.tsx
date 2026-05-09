'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';

export default function ResetPasswordPage() {
  const auth = useWebAuth();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nextToken = new URLSearchParams(window.location.search).get('token') ?? '';
    setToken(nextToken);
  }, []);

  async function submit() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      if (!token) throw new Error('Missing reset token. Request a new link from the login screen.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');
      const result = await auth.resetPassword(token, password, confirmPassword);
      setMessage(result.message ?? 'Password reset. You can now log in.');
      setPassword('');
      setConfirmPassword('');
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message.startsWith('Missing reset token') ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card auth-card reset-card">
      <span className="semantic-badge instruction">Password reset</span>
      <h1>Reset your Hellowhen password</h1>
      <p className="notice-box info">Choose a new password for your Hellowhen account. Reset links are one-time use and expire automatically.</p>
      {!token ? <p className="notice-box danger">Missing reset token. Open the link from your email or request a new reset link.</p> : null}
      <div className="form-stack">
        <label className="field-label">
          New password
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" type="password" autoComplete="new-password" />
        </label>
        <label className="field-label">
          Confirm new password
          <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" type="password" autoComplete="new-password" />
        </label>
        <button onClick={() => { void submit(); }} disabled={loading || !token} type="button">{loading ? 'Resetting...' : 'Reset password'}</button>
      </div>
      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}
      <Link href="/auth" className="button full">Back to login</Link>
    </section>
  );
}
