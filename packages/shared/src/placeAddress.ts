export const PLACE_ADDRESS_PROVIDER_SOURCE = 'google_places' as const;
export const PLACE_ADDRESS_CONFIRMED_STATUS = 'confirmed' as const;
export const PLACE_OFFLINE_MODE = 'local' as const;
export const PLACE_ONLINE_MODE = 'remote' as const;

export const PLACE_OFFLINE_PROVIDER_REQUIRED_FIELDS = [
  'googlePlaceId',
  'formattedAddress',
  'latitude',
  'longitude',
  'locationSource',
  'addressValidationStatus',
] as const;

export const PLACE_ONLINE_DESTINATION_REQUIRED_FIELDS = ['onlineUrl'] as const;

export type PlaceAddressMode = typeof PLACE_OFFLINE_MODE | typeof PLACE_ONLINE_MODE;
export type PlaceAddressProviderSource = typeof PLACE_ADDRESS_PROVIDER_SOURCE | 'manual';
export type PlaceAddressValidationStatus = typeof PLACE_ADDRESS_CONFIRMED_STATUS | 'needs_review' | 'unsupported';
export type PlaceOfflineProviderRequiredField = typeof PLACE_OFFLINE_PROVIDER_REQUIRED_FIELDS[number];
export type PlaceOnlineDestinationRequiredField = typeof PLACE_ONLINE_DESTINATION_REQUIRED_FIELDS[number];

export type PlaceProviderAddressInput = {
  googlePlaceId?: string | null;
  googlePlaceName?: string | null;
  formattedAddress?: string | null;
  googleMapsUri?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: PlaceAddressProviderSource | string | null;
  addressValidationStatus?: PlaceAddressValidationStatus | string | null;
};

export type PlaceOnlineDestinationInput = {
  onlineLabel?: string | null;
  onlineUrl?: string | null;
};

export type PlaceAddressValidationInput = PlaceProviderAddressInput & PlaceOnlineDestinationInput & {
  mode?: PlaceAddressMode | string | null;
};

export type PlaceAddressValidity = {
  mode: PlaceAddressMode;
  isOffline: boolean;
  isOnline: boolean;
  hasProviderSelectedAddress: boolean;
  hasOnlineDestination: boolean;
  missingOfflineProviderFields: PlaceOfflineProviderRequiredField[];
  missingOnlineDestinationFields: PlaceOnlineDestinationRequiredField[];
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

export function hasValidCoordinatePair(input: Pick<PlaceProviderAddressInput, 'latitude' | 'longitude'>): boolean {
  return isValidLatitude(input.latitude) && isValidLongitude(input.longitude);
}

export function normalizePlaceAddressMode(mode: PlaceAddressValidationInput['mode']): PlaceAddressMode {
  return mode === PLACE_ONLINE_MODE ? PLACE_ONLINE_MODE : PLACE_OFFLINE_MODE;
}

export function getMissingOfflineProviderAddressFields(input: PlaceProviderAddressInput): PlaceOfflineProviderRequiredField[] {
  const missing: PlaceOfflineProviderRequiredField[] = [];

  if (!hasText(input.googlePlaceId)) missing.push('googlePlaceId');
  if (!hasText(input.formattedAddress)) missing.push('formattedAddress');
  if (!isValidLatitude(input.latitude)) missing.push('latitude');
  if (!isValidLongitude(input.longitude)) missing.push('longitude');
  if (input.locationSource !== PLACE_ADDRESS_PROVIDER_SOURCE) missing.push('locationSource');
  if (input.addressValidationStatus !== PLACE_ADDRESS_CONFIRMED_STATUS) missing.push('addressValidationStatus');

  return missing;
}

export function hasConfirmedProviderOfflineAddress(input: PlaceProviderAddressInput): boolean {
  return getMissingOfflineProviderAddressFields(input).length === 0;
}

export function getMissingOnlineDestinationFields(input: PlaceOnlineDestinationInput): PlaceOnlineDestinationRequiredField[] {
  return hasText(input.onlineUrl) ? [] : ['onlineUrl'];
}

export function hasOnlineDestination(input: PlaceOnlineDestinationInput): boolean {
  return getMissingOnlineDestinationFields(input).length === 0;
}

export function getPlaceAddressValidity(input: PlaceAddressValidationInput): PlaceAddressValidity {
  const mode = normalizePlaceAddressMode(input.mode);
  const missingOfflineProviderFields = getMissingOfflineProviderAddressFields(input);
  const missingOnlineDestinationFields = getMissingOnlineDestinationFields(input);

  return {
    mode,
    isOffline: mode === PLACE_OFFLINE_MODE,
    isOnline: mode === PLACE_ONLINE_MODE,
    hasProviderSelectedAddress: missingOfflineProviderFields.length === 0,
    hasOnlineDestination: missingOnlineDestinationFields.length === 0,
    missingOfflineProviderFields,
    missingOnlineDestinationFields,
  };
}

export function buildMissingOfflineProviderAddressMessage(missingFields: readonly PlaceOfflineProviderRequiredField[]): string {
  if (!missingFields.length) return 'Offline address is provider-selected and confirmed.';
  return `Offline places require a selected address from the provider. Missing: ${missingFields.join(', ')}.`;
}

export function buildMissingOnlineDestinationMessage(missingFields: readonly PlaceOnlineDestinationRequiredField[]): string {
  if (!missingFields.length) return 'Online place destination is present.';
  return `Online places require an online destination. Missing: ${missingFields.join(', ')}.`;
}

export function shouldBlockOfflinePlaceSave(input: PlaceAddressValidationInput): boolean {
  const validity = getPlaceAddressValidity(input);
  return validity.isOffline && !validity.hasProviderSelectedAddress;
}

export function shouldBlockOnlinePlaceSave(input: PlaceAddressValidationInput): boolean {
  const validity = getPlaceAddressValidity(input);
  return validity.isOnline && !validity.hasOnlineDestination;
}
