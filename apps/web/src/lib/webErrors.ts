export const API_CONNECTION_ERROR_MESSAGE =
  'Could not connect to Hellowhen. Check the API URL and try again.';

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

  if (apiError.body?.error === 'invalid_credentials') return 'Email or password is incorrect.';
  if (apiError.body?.error === 'email_already_exists') return apiError.body.message ?? 'An account already exists with this email. Try logging in or resetting your password.';
  if (apiError.body?.error === 'google_not_configured') return apiError.body.message ?? 'Google sign-in is not configured yet.';
  if (apiError.body?.error === 'invalid_google_token') return apiError.body.message ?? 'Google sign-in could not be verified.';
  if (apiError.body?.error === 'invalid_or_expired_reset_token') return apiError.body.message ?? 'This reset link is invalid or expired.';
  if (apiError.body?.error === 'validation_error') return apiError.body.message ?? 'Please check the form fields and try again.';
  if (apiError.body?.error === 'not_found') return 'That item could not be found.';
  if (apiError.status === 401) return 'Please log in again to continue.';
  if (apiError.body?.message) return apiError.body.message;

  return fallback;
}
