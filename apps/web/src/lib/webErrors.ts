export const API_CONNECTION_ERROR_MESSAGE =
  'Hellowhen is temporarily unavailable. Please try again in a moment.';

type ApiLikeError = {
  code?: string;
  status?: number;
  body?: {
    error?: string;
    message?: string;
  };
  message?: string;
};

function toApiLikeError(error: unknown): ApiLikeError {
  if (error && typeof error === 'object') return error as ApiLikeError;
  return {};
}

export function getFriendlyApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const apiError = toApiLikeError(error);
  const message = apiError.message ?? '';

  if (
    apiError.code === 'HELLOWHEN_API_CONNECTION_ERROR' ||
    message.includes('Network request failed') ||
    message.includes('Failed to fetch') ||
    message.includes('Could not connect')
  ) {
    return API_CONNECTION_ERROR_MESSAGE;
  }

  if (apiError.body?.error === 'invalid_credentials') return apiError.body.message ?? 'Email or password is incorrect.';
  if (apiError.body?.error === 'password_login_unavailable') return apiError.body.message ?? 'This account does not have a password to change.';
  if (apiError.body?.error === 'invalid_two_factor_code') return apiError.body.message ?? 'That authenticator or recovery code was not accepted. Wait for a new code and try again.';
  if (apiError.body?.error === 'invalid_two_factor_challenge') return apiError.body.message ?? 'This two-step login challenge expired. Log in again.';
  if (apiError.body?.error === 'two_factor_code_required') return apiError.body.message ?? 'Enter an authenticator or recovery code.';
  if (apiError.body?.error === 'two_factor_setup_required') return apiError.body.message ?? 'Start two-step setup first.';
  if (apiError.body?.error === 'fresh_auth_required') return apiError.body.message ?? 'Confirm your password or authenticator code and try again.';
  if (apiError.body?.error === 'email_already_exists') return apiError.body.message ?? 'An account already exists with this email. Try logging in or resetting your password.';
  if (apiError.body?.error === 'age_confirmation_required') return apiError.body.message ?? 'Confirm that you are 18 or older before creating an account.';
  if (apiError.body?.error === 'google_not_configured') return apiError.body.message ?? 'Google sign-in is not configured yet.';
  if (apiError.body?.error === 'invalid_google_token') return apiError.body.message ?? 'Google sign-in could not be verified.';
  if (apiError.body?.error === 'invalid_or_expired_reset_token') return apiError.body.message ?? 'This reset link is invalid or expired.';
  if (apiError.body?.error === 'validation_error') return apiError.body.message ?? 'Please check the form fields and try again.';
  if (apiError.body?.error === 'plans_disabled') return 'Plans are disabled by the API flag. Set PLANS_ENABLED=true in the root .env file and restart the API dev server.';
  if (apiError.body?.error === 'plans_hidden') return 'Plans are hidden by the API visibility flag.';
  if (apiError.body?.error === 'saved_library_limit_reached') return apiError.body.message ?? 'Free accounts can keep up to 10 saved items. Upgrade to Plus for unlimited saved items and custom collections.';
  if (apiError.body?.error === 'saved_collections_plus_required') return apiError.body.message ?? 'Custom saved collections are a Plus feature.';
  if (apiError.body?.error === 'not_found') return 'That item could not be found.';
  if (apiError.body?.message) return apiError.body.message;
  if (apiError.status === 401) return 'Please log in again to continue.';
  if (apiError.status && apiError.status >= 500) return 'Hellowhen is temporarily unavailable. Please try again in a moment.';

  return fallback;
}
