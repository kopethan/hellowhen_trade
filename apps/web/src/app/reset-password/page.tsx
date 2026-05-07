'use client';

import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function ResetPasswordPage() {
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
      if (!token) throw new Error('Missing reset token. Request a new link from the app login screen.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');
      const response = await fetch(`${apiBase}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword })
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? 'Could not reset password.');
      setMessage(body.message ?? 'Password reset. You can now return to Hellowhen and log in.');
      setPassword('');
      setConfirmPassword('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card auth-card">
      <span className="semantic-badge instruction">Password reset</span>
      <h1>Reset your Hellowhen password</h1>
      <p className="notice-box info">Choose a new password for your Hellowhen account. Reset links are one-time use and expire automatically.</p>
      {!token ? <p className="notice-box danger">Missing reset token. Open the link from your email or request a new password reset.</p> : null}
      <div className="form-row single">
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" type="password" />
        <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" type="password" />
        <button onClick={() => { void submit(); }} disabled={loading || !token}>{loading ? 'Resetting...' : 'Reset password'}</button>
      </div>
      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}
    </section>
  );
}
