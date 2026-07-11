export const API_CONNECTION_ERROR_MESSAGE =
  'Could not connect to Hellowhen. Check your connection and try again.';

export const API_TIMEOUT_ERROR_MESSAGE =
  'The request took too long. Check your connection and try again.';

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
  if (error && typeof error === 'object') {
    return error as ApiLikeError;
  }

  return {};
}

export function getFriendlyApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const apiError = toApiLikeError(error);
  const message = apiError.message ?? '';

  if (
    apiError.code === 'HELLOWHEN_API_TIMEOUT_ERROR' ||
    message.includes('timed out') ||
    message.includes('timeout')
  ) {
    return API_TIMEOUT_ERROR_MESSAGE;
  }

  if (
    apiError.code === 'HELLOWHEN_API_CONNECTION_ERROR' ||
    message.includes('Network request failed') ||
    message.includes('Failed to fetch') ||
    message.includes('Could not connect')
  ) {
    return API_CONNECTION_ERROR_MESSAGE;
  }

  if (apiError.body?.error === 'invalid_credentials') {
    return 'Email or password is incorrect.';
  }

  if (apiError.body?.error === 'email_already_exists') return apiError.body.message ?? 'An account already exists with this email. Try logging in or resetting your password.';
  if (apiError.body?.error === 'age_confirmation_required') return apiError.body.message ?? 'Confirm that you are 18 or older before creating an account.';
  if (apiError.body?.error === 'google_not_configured') return apiError.body.message ?? 'Google sign-in is not configured yet.';
  if (apiError.body?.error === 'invalid_google_token') return apiError.body.message ?? 'Google sign-in could not be verified.';
  if (apiError.body?.error === 'invalid_or_expired_reset_token') return apiError.body.message ?? 'This reset link is invalid or expired.';

  if (apiError.body?.error === 'not_found') {
    return 'That item could not be found.';
  }

  if (apiError.body?.error === 'validation_error') {
    return apiError.body.message ?? 'Please check the form fields and try again.';
  }

  if (apiError.body?.error === 'plan_stop_gap_too_short') return apiError.body.message ?? 'Plan places must be at least 15 minutes apart.';
  if (apiError.body?.error === 'plan_deleted') return apiError.body.message ?? 'This Plan was deleted and is no longer visible.';

  if (apiError.body?.error === 'saved_library_plus_required' || apiError.body?.error === 'saved_library_limit_reached') return apiError.body.message ?? 'Saved Library is a Plus feature. Upgrade to Plus to save trades, needs, offers, and people.';
  if (apiError.body?.error === 'saved_collections_plus_required') return apiError.body.message ?? 'Saved collections are a Plus feature.';

  if (apiError.body?.error === 'insufficient_wallet_balance') {
    return apiError.body.message ?? 'This trade cannot be started right now.';
  }

  if (apiError.body?.error === 'invalid_trade_status_transition') {
    return 'This trade cannot move to that status yet.';
  }

  if (apiError.body?.error === 'cannot_propose_to_own_trade') return apiError.body.message ?? 'You cannot send a proposal to your own trade.';
  if (apiError.body?.error === 'proposal_already_exists') return apiError.body.message ?? 'You already have a proposal for this trade.';
  if (apiError.body?.error === 'invalid_proposal_status_transition') return 'This proposal cannot move to that status yet.';
  if (apiError.body?.error === 'proposal_conversation_closed') return apiError.body.message ?? 'This proposal conversation is closed.';
  if (apiError.body?.error === 'trade_already_has_provider') return apiError.body.message ?? 'This trade already has an accepted provider.';

  if (apiError.body?.error === 'support_ticket_closed') return apiError.body.message ?? 'This support ticket is closed.';
  if (apiError.body?.error === 'unsupported_user_status') return apiError.body.message ?? 'You can only reopen or close your own support ticket.';


  if (apiError.status && apiError.status >= 500) {
    return 'Hellowhen is having trouble right now. Try again in a moment.';
  }

  if (apiError.status === 401) {
    return 'Please log in again to continue.';
  }

  if (apiError.body?.message) {
    return apiError.body.message;
  }

  return fallback;
}
