'use client';

import { GOOGLE_PLACE_SEARCH_MIN_QUERY_LENGTH, type GooglePlacePrediction, type GoogleResolvedPlace } from '@hellowhen/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebTranslation } from '../../providers/WebI18nProvider';

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
  autoFocus?: boolean;
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

function placeStatusLabel(place: GoogleResolvedPlace, t: ReturnType<typeof useWebTranslation>['t']) {
  if (place.validationStatus === 'confirmed') return t('places.googlePicker.status.confirmed');
  if (place.validationStatus === 'needs_review') return t('places.googlePicker.status.review');
  return t('places.googlePicker.status.selected');
}

export function GooglePlacePicker({
  value,
  onValueChange,
  onResolvedPlace,
  disabled,
  label,
  placeholder,
  helperText,
  languageCode,
  country,
  inputMaxLength = 240,
  autoFocus = false,
}: GooglePlacePickerProps) {
  const { t } = useWebTranslation();
  const resolvedLabel = label ?? t('places.googlePicker.label');
  const resolvedPlaceholder = placeholder ?? t('places.googlePicker.placeholder');
  const resolvedHelperText = helperText ?? t('places.googlePicker.helper', { count: GOOGLE_PLACE_SEARCH_MIN_QUERY_LENGTH });
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<GooglePlacePrediction[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<GoogleResolvedPlace | null>(null);
  const [searching, setSearching] = useState(false);
  const [resolvingPlaceId, setResolvingPlaceId] = useState('');
  const [notice, setNotice] = useState('');
  const sessionTokenRef = useRef('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQuery(value);
    setSelectedPlace((current) => {
      if (!current) return current;
      const selectedLabel = placeAddressLabel(current);
      return selectedLabel && selectedLabel === value ? current : null;
    });
  }, [value]);

  useEffect(() => {
    if (!autoFocus || disabled || typeof window === 'undefined') return undefined;
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!sessionTokenRef.current) sessionTokenRef.current = makeSessionToken();
    const trimmed = query.trim();
    const selectedLabel = selectedPlace ? placeAddressLabel(selectedPlace) : '';
    if (disabled || (selectedLabel && selectedLabel === trimmed)) {
      setPredictions([]);
      setSearching(false);
      setNotice('');
      return undefined;
    }
    if (trimmed.length < GOOGLE_PLACE_SEARCH_MIN_QUERY_LENGTH) {
      setPredictions([]);
      setSearching(false);
      setNotice(trimmed ? t('places.googlePicker.minCharacters', { count: GOOGLE_PLACE_SEARCH_MIN_QUERY_LENGTH }) : '');
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
          if (!(response.predictions ?? []).length) setNotice(t('places.googlePicker.noSuggestions'));
        })
        .catch((error) => {
          if (cancelled) return;
          setPredictions([]);
          setNotice(getFriendlyApiErrorMessage(error, t('places.googlePicker.searchUnavailable')));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [country, disabled, languageCode, query, selectedPlace, t]);

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
      setNotice(getFriendlyApiErrorMessage(error, t('places.googlePicker.confirmFailed')));
    } finally {
      setResolvingPlaceId('');
    }
  }

  return (
    <div className="google-place-picker">
      <label className="google-place-picker__field">
        <span>{resolvedLabel}</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => handleInputChange(event.target.value)}
          disabled={disabled}
          maxLength={inputMaxLength}
          placeholder={resolvedPlaceholder}
          autoComplete="off"
        />
      </label>
      {resolvedHelperText ? <p className="google-place-picker__helper">{resolvedHelperText}</p> : null}
      {selectedPlace && selectedAddress ? (
        <div className="google-place-picker__selected">
          <span className="semantic-badge place">{placeStatusLabel(selectedPlace, t)}</span>
          <strong>{selectedPlace.name || selectedAddress}</strong>
          {selectedPlace.name && selectedPlace.formattedAddress ? <small>{selectedPlace.formattedAddress}</small> : null}
        </div>
      ) : null}
      {predictions.length ? (
        <div className="google-place-picker__suggestions" role="listbox" aria-label={t('places.googlePicker.suggestionsAccessibility')}>
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
              <em>{resolvingPlaceId === prediction.placeId ? t('places.googlePicker.checking') : t('places.googlePicker.select')}</em>
            </button>
          ))}
        </div>
      ) : null}
      {searching ? <p className="google-place-picker__status">{t('places.googlePicker.searching')}</p> : null}
      {notice ? <p className="google-place-picker__notice">{notice}</p> : null}
    </div>
  );
}
