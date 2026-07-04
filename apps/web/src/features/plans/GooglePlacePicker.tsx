'use client';

import type { GooglePlacePrediction, GoogleResolvedPlace } from '@hellowhen/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';

type GooglePlacePickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  onResolvedPlace?: (place: GoogleResolvedPlace | null) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  helperText?: string;
  languageCode?: string;
  country?: string;
  inputMaxLength?: number;
};

function makeSessionToken() {
  if (typeof window === 'undefined') return '';
  const browserCrypto = window.crypto as Crypto & { randomUUID?: () => string };
  if (typeof browserCrypto.randomUUID === 'function') return browserCrypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function placeAddressLabel(place: GoogleResolvedPlace) {
  return place.formattedAddress || place.name || '';
}

function placeStatusLabel(place: GoogleResolvedPlace) {
  if (place.validationStatus === 'confirmed') return 'Google-confirmed address';
  if (place.validationStatus === 'needs_review') return 'Google suggestion · review details';
  return 'Google place selected';
}

export function GooglePlacePicker({
  value,
  onValueChange,
  onResolvedPlace,
  disabled,
  label = 'Address or place',
  placeholder = 'Search a real address or place',
  helperText = 'Search and select a provider suggestion. Typed text alone cannot be saved as an offline address.',
  languageCode,
  country,
  inputMaxLength = 240,
}: GooglePlacePickerProps) {
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<GooglePlacePrediction[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<GoogleResolvedPlace | null>(null);
  const [searching, setSearching] = useState(false);
  const [resolvingPlaceId, setResolvingPlaceId] = useState('');
  const [notice, setNotice] = useState('');
  const sessionTokenRef = useRef('');

  useEffect(() => {
    setQuery(value);
    setSelectedPlace((current) => {
      if (!current) return current;
      const selectedLabel = placeAddressLabel(current);
      return selectedLabel && selectedLabel === value ? current : null;
    });
  }, [value]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!sessionTokenRef.current) sessionTokenRef.current = makeSessionToken();
    const trimmed = query.trim();
    const selectedLabel = selectedPlace ? placeAddressLabel(selectedPlace) : '';
    if (disabled || trimmed.length < 2 || (selectedLabel && selectedLabel === trimmed)) {
      setPredictions([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    setNotice('');
    const timeoutId = window.setTimeout(() => {
      api.places.googleSearch({
        q: trimmed,
        languageCode,
        country,
        take: 5,
        sessionToken: sessionTokenRef.current,
      })
        .then((response) => {
          if (cancelled) return;
          setPredictions(response.predictions ?? []);
          if (!(response.predictions ?? []).length) setNotice('No confirmed suggestions yet. Try a more precise place name or address.');
        })
        .catch((error) => {
          if (cancelled) return;
          setPredictions([]);
          setNotice(getFriendlyApiErrorMessage(error, 'Address search is unavailable. Try again later or switch this Place to Online.'));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [country, disabled, languageCode, query, selectedPlace]);

  const selectedAddress = useMemo(() => selectedPlace ? placeAddressLabel(selectedPlace) : '', [selectedPlace]);

  function handleInputChange(nextValue: string) {
    setQuery(nextValue);
    setSelectedPlace(null);
    setNotice('');
    setPredictions([]);
    onResolvedPlace?.(null);
    onValueChange(nextValue);
  }

  async function selectPrediction(prediction: GooglePlacePrediction) {
    if (disabled || resolvingPlaceId) return;
    setResolvingPlaceId(prediction.placeId);
    setNotice('');
    try {
      const response = await api.places.googleDetails({
        placeId: prediction.placeId,
        languageCode,
        sessionToken: sessionTokenRef.current,
      });
      const place = response.place;
      const nextAddress = placeAddressLabel(place) || prediction.description;
      setSelectedPlace(place);
      setPredictions([]);
      setQuery(nextAddress);
      onValueChange(nextAddress);
      onResolvedPlace?.(place);
      sessionTokenRef.current = makeSessionToken();
    } catch (error) {
      setNotice(getFriendlyApiErrorMessage(error, 'Could not confirm this Google place. Try another suggestion.'));
    } finally {
      setResolvingPlaceId('');
    }
  }

  return (
    <div className="google-place-picker">
      <label className="google-place-picker__field">
        <span>{label}</span>
        <input
          value={query}
          onChange={(event) => handleInputChange(event.target.value)}
          disabled={disabled}
          maxLength={inputMaxLength}
          placeholder={placeholder}
          autoComplete="off"
        />
      </label>
      {helperText ? <p className="google-place-picker__helper">{helperText}</p> : null}
      {selectedPlace && selectedAddress ? (
        <div className="google-place-picker__selected">
          <span className="semantic-badge place">{placeStatusLabel(selectedPlace)}</span>
          <strong>{selectedPlace.name || selectedAddress}</strong>
          {selectedPlace.name && selectedPlace.formattedAddress ? <small>{selectedPlace.formattedAddress}</small> : null}
        </div>
      ) : null}
      {predictions.length ? (
        <div className="google-place-picker__suggestions" role="listbox" aria-label="Google place suggestions">
          {predictions.map((prediction) => (
            <button
              key={prediction.placeId}
              type="button"
              className="google-place-picker__suggestion"
              onClick={() => void selectPrediction(prediction)}
              disabled={disabled || Boolean(resolvingPlaceId)}
              role="option"
              aria-selected="false"
            >
              <span className="google-place-picker__pin" aria-hidden="true">⌖</span>
              <span>
                <strong>{prediction.mainText || prediction.description}</strong>
                {prediction.secondaryText ? <small>{prediction.secondaryText}</small> : null}
              </span>
              <em>{resolvingPlaceId === prediction.placeId ? 'Checking...' : 'Select'}</em>
            </button>
          ))}
        </div>
      ) : null}
      {searching ? <p className="google-place-picker__status">Searching Google places...</p> : null}
      {notice ? <p className="google-place-picker__notice">{notice}</p> : null}
    </div>
  );
}
