import type { GoogleResolvedPlace } from '@hellowhen/contracts';
import {
  PLACE_ADDRESS_CONFIRMED_STATUS,
  PLACE_ADDRESS_PROVIDER_SOURCE,
  buildMissingOfflineProviderAddressMessage,
  buildMissingOnlineDestinationMessage,
  getMissingOfflineProviderAddressFields,
  getMissingOnlineDestinationFields,
  hasConfirmedProviderOfflineAddress,
  hasOnlineDestination,
} from '@hellowhen/shared';

export type WebProviderAddressFormState = {
  googlePlaceId: string;
  googlePlaceName: string;
  formattedAddress: string;
  googleMapsUri: string;
  latitude: number | null;
  longitude: number | null;
  locationSource: 'google_places' | '';
  addressValidationStatus: 'confirmed' | '';
};


type StoredProviderAddressLike = {
  googlePlaceId?: string | null;
  googlePlaceName?: string | null;
  formattedAddress?: string | null;
  googleMapsUri?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: string | null;
  addressValidationStatus?: string | null;
};

export type WebProviderAddressPayload = {
  googlePlaceId: string;
  googlePlaceName?: string;
  formattedAddress: string;
  googleMapsUri?: string;
  latitude: number;
  longitude: number;
  locationSource: 'google_places';
  addressValidationStatus: 'confirmed';
};

export function emptyProviderAddressFormState(): WebProviderAddressFormState {
  return {
    googlePlaceId: '',
    googlePlaceName: '',
    formattedAddress: '',
    googleMapsUri: '',
    latitude: null,
    longitude: null,
    locationSource: '',
    addressValidationStatus: '',
  };
}

export function providerAddressFormStateFromGooglePlace(place: GoogleResolvedPlace | null): WebProviderAddressFormState {
  if (!place || !place.placeId || !place.formattedAddress || place.latitude === null || place.latitude === undefined || place.longitude === null || place.longitude === undefined || place.validationStatus !== PLACE_ADDRESS_CONFIRMED_STATUS) return emptyProviderAddressFormState();
  return {
    googlePlaceId: place.placeId,
    googlePlaceName: place.name ?? '',
    formattedAddress: place.formattedAddress,
    googleMapsUri: place.googleMapsUri ?? '',
    latitude: place.latitude,
    longitude: place.longitude,
    locationSource: PLACE_ADDRESS_PROVIDER_SOURCE,
    addressValidationStatus: PLACE_ADDRESS_CONFIRMED_STATUS,
  };
}

export function providerAddressFormStateFromStoredPlace(place: StoredProviderAddressLike): WebProviderAddressFormState {
  if (!hasConfirmedProviderOfflineAddress(place)) return emptyProviderAddressFormState();
  return {
    googlePlaceId: place.googlePlaceId ?? '',
    googlePlaceName: place.googlePlaceName ?? '',
    formattedAddress: place.formattedAddress ?? '',
    googleMapsUri: place.googleMapsUri ?? '',
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    locationSource: PLACE_ADDRESS_PROVIDER_SOURCE,
    addressValidationStatus: PLACE_ADDRESS_CONFIRMED_STATUS,
  };
}

export function providerAddressPayloadFromFormState(state: WebProviderAddressFormState): WebProviderAddressPayload | null {
  if (!hasConfirmedProviderOfflineAddress(state)) return null;
  return {
    googlePlaceId: state.googlePlaceId.trim(),
    googlePlaceName: state.googlePlaceName.trim() || undefined,
    formattedAddress: state.formattedAddress.trim(),
    googleMapsUri: state.googleMapsUri.trim() || undefined,
    latitude: Number(state.latitude),
    longitude: Number(state.longitude),
    locationSource: PLACE_ADDRESS_PROVIDER_SOURCE,
    addressValidationStatus: PLACE_ADDRESS_CONFIRMED_STATUS,
  };
}

export function offlineProviderAddressError(state: WebProviderAddressFormState): string {
  const missingFields = getMissingOfflineProviderAddressFields(state);
  return missingFields.length ? buildMissingOfflineProviderAddressMessage(missingFields) : '';
}

export function onlineDestinationError(input: { onlineUrl?: string | null }): string {
  const missingFields = getMissingOnlineDestinationFields(input);
  if (missingFields.length) return buildMissingOnlineDestinationMessage(missingFields);
  if (!hasOnlineDestination(input)) return 'Online places require an online link.';
  try {
    const parsedUrl = new URL(String(input.onlineUrl ?? '').trim());
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return 'Add a valid online URL.';
  } catch {
    return 'Add a valid online URL.';
  }
  return '';
}

export function providerAddressStatusLabel(state: WebProviderAddressFormState): string {
  if (!hasConfirmedProviderOfflineAddress(state)) return '';
  return state.googlePlaceName.trim() || state.formattedAddress.trim();
}
