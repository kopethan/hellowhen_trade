export function isArchiveOnlyPlaceUpdate(input: Record<string, unknown>) {
  const keys = Object.keys(input);
  return keys.length === 1 && input.status === 'archived';
}

export function isTranslationOnlyPlaceUpdate(input: Record<string, unknown>) {
  const keys = Object.keys(input);
  return keys.length === 1 && Object.prototype.hasOwnProperty.call(input, 'translations');
}

export function canUpdatePlaceLockedByPlan(input: Record<string, unknown>) {
  return isArchiveOnlyPlaceUpdate(input) || isTranslationOnlyPlaceUpdate(input);
}
