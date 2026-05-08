# Patch 9 — Perfect Auth: Email, Google Login, Password Reset via Resend

Patch 9 improves Hellowhen authentication while keeping the product Trade-first.

## Added

- Polished mobile login/register/reset shell.
- Full name field, confirm password, show/hide password, local validation, terms placeholder, and demo login shortcuts.
- Google sign-in button for mobile.
- Backend `/auth/google` endpoint that verifies Google identity tokens and returns a normal Hellowhen JWT.
- Safe account linking: a verified Google email can link to an existing Hellowhen account.
- `UserIdentity` model for provider identities so Apple or other providers can be added later.
- `emailVerifiedAt` and `lastLoginAt` on users.
- Forgot password flow on mobile.
- Resend-backed password reset email delivery when `RESEND_API_KEY` is configured.
- Hashed one-time `PasswordResetToken` model with expiry and consumed state.
- Web reset page at `/reset-password?token=...`.

## Important notes

- Google sign-in on Expo requires a development build because `@react-native-google-signin/google-signin` uses native code. It will not work in plain Expo Go.
- Password reset stores only a SHA-256 hash of the reset token.
- Forgot password always returns a neutral message so the API does not reveal which emails are registered.
- In development, if Resend is not configured, the forgot-password API returns a `devResetUrl` to make local testing possible.

## Environment variables

```env
GOOGLE_WEB_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
GOOGLE_ANDROID_CLIENT_ID=
RESEND_API_KEY=
EMAIL_FROM=Hellowhen <support@hellowhen.app>
PASSWORD_RESET_TTL_MINUTES=45
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

## Not added

- Apple login
- phone login
- 2FA
- magic links
- global SSO
- newsletters/marketing emails
- real-money production payment changes
