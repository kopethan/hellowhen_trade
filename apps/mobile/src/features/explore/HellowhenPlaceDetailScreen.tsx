import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CreatePlaceRequest, DiscoveryLanguage, PlaceDto, PlaceResponse } from '@hellowhen/contracts';
import { resolveInventoryOriginalCopy } from '@hellowhen/shared';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import {
  DetailBottomActionBar,
  DetailEmptyState,
  DetailHero,
  DetailImageGrid,
  DetailInfoList,
  DetailMetadataChips,
  DetailSection,
} from '../../components/detail';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { resolveMediaVariantUrl } from '../trade/mediaUrls';


function normalizeDiscoveryLanguage(value?: string | null): DiscoveryLanguage {
  if (value === 'fr' || value === 'es') return value;
  return 'en';
}

function buildPrivatePlaceCopyRequest(place: PlaceDto): CreatePlaceRequest {
  const mode = place.mode === 'remote' ? 'remote' : 'local';
  const original = resolveInventoryOriginalCopy(place);
  const defaultLanguage = normalizeDiscoveryLanguage(original.defaultLanguage);
  const translations: NonNullable<CreatePlaceRequest['translations']> = [];
  for (const translation of original.translations ?? []) {
    const languageCode = translation.languageCode === 'en' || translation.languageCode === 'fr' || translation.languageCode === 'es'
      ? translation.languageCode
      : null;
    const title = translation.title?.trim();
    const description = translation.description?.trim();
    if (!languageCode || languageCode === defaultLanguage || !title || !description) continue;
    translations.push({ languageCode, title, description });
  }

  return {
    source: 'user',
    visibility: 'private',
    status: 'active',
    mode,
    title: original.title,
    description: original.description?.trim() || undefined,
    defaultLanguage,
    translations,
    category: place.category ?? undefined,
    tags: place.tags ?? undefined,
    defaultDurationMinutes: place.defaultDurationMinutes ?? undefined,
    defaultNote: place.defaultNote ?? undefined,
    ...(mode === 'remote' ? {
      onlineLabel: place.onlineLabel ?? undefined,
      onlineUrl: place.onlineUrl ?? undefined,
    } : {
      areaLabel: place.areaLabel ?? undefined,
      addressPublicText: place.formattedAddress ?? place.addressPublicText ?? undefined,
      googlePlaceId: place.googlePlaceId ?? undefined,
      googlePlaceName: place.googlePlaceName ?? undefined,
      formattedAddress: place.formattedAddress ?? undefined,
      googleMapsUri: place.googleMapsUri ?? undefined,
      latitude: place.latitude ?? undefined,
      longitude: place.longitude ?? undefined,
      locationSource: place.locationSource ?? undefined,
      addressValidationStatus: place.addressValidationStatus ?? undefined,
    }),
  };
}

function placeImages(place: PlaceDto | null) {
  return (place?.media ?? [])
    .filter((media) => media.status === undefined || media.status === 'active')
    .map((media, index) => ({
      id: media.id,
      uri: resolveMediaVariantUrl(media, 'full'),
      accessibilityLabel: `${place?.title ?? ''} ${index + 1}`.trim(),
    }))
    .filter((image) => Boolean(image.uri));
}

export function HellowhenPlaceDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'HellowhenPlaceDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t } = useTranslation();
  const [place, setPlace] = useState<PlaceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedPlace, setCopiedPlace] = useState<PlaceDto | null>(null);
  const [action, setAction] = useState<'add' | 'plan' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadPlace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.places.get(route.params.placeId) as PlaceResponse;
      const nextPlace = response.place;
      if (!nextPlace || nextPlace.source !== 'hellowhen_library' || nextPlace.visibility !== 'library' || nextPlace.status !== 'active') {
        throw new Error(t('places.list.errors.load'));
      }
      setPlace(nextPlace);
    } catch (caughtError) {
      setPlace(null);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [route.params.placeId, t]);

  useEffect(() => {
    void loadPlace();
  }, [loadPlace]);

  useEffect(() => {
    setCopiedPlace(null);
    setActionError(null);
  }, [route.params.placeId]);

  const ensurePrivateCopy = useCallback(async () => {
    if (copiedPlace) return copiedPlace;
    if (!place) throw new Error(t('places.list.errors.load'));

    const response = await api.places.create(buildPrivatePlaceCopyRequest(place)) as PlaceResponse;
    const nextPlace = response.place;
    if (!nextPlace || nextPlace.source !== 'user' || nextPlace.visibility !== 'private') {
      throw new Error(t('places.list.errors.load'));
    }
    setCopiedPlace(nextPlace);
    return nextPlace;
  }, [copiedPlace, place, t]);

  const requireSignedIn = useCallback(() => {
    if (auth.isAuthenticated) return true;
    navigation.navigate('Login');
    return false;
  }, [auth.isAuthenticated, navigation]);

  const addToMyPlaces = useCallback(async () => {
    if (!requireSignedIn() || copiedPlace || action) return;
    setAction('add');
    setActionError(null);
    try {
      await ensurePrivateCopy();
    } catch (caughtError) {
      setActionError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setAction(null);
    }
  }, [action, copiedPlace, ensurePrivateCopy, requireSignedIn]);

  const startPlan = useCallback(async () => {
    if (!requireSignedIn() || action) return;
    setAction('plan');
    setActionError(null);
    try {
      const privatePlace = await ensurePrivateCopy();
      navigation.navigate('CreatePlan', { createdPlace: privatePlace, createdPlaceNonce: Date.now() });
    } catch (caughtError) {
      setActionError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setAction(null);
    }
  }, [action, ensurePrivateCopy, navigation, requireSignedIn]);

  const images = useMemo(() => placeImages(place), [place]);
  const modeLabel = place?.mode === 'remote' ? t('places.list.badges.online') : t('places.list.badges.offline');
  const publicAddress = place?.addressPublicText || place?.formattedAddress || place?.areaLabel || '';

  return (
    <AppFixedHeaderScreen
      header={<AppHeader title={t('places.list.segments.library')} onBack={() => navigation.goBack()} />}
      bodyStyle={styles.body}
    >
      {loading ? (
        <View style={styles.centered} accessibilityRole="progressbar">
          <ActivityIndicator color={theme.color.text} />
          <AppText style={[styles.loadingText, { color: theme.color.muted }]}>{t('common.states.loading')}</AppText>
        </View>
      ) : error || !place ? (
        <View style={styles.stateWrap}>
          <DetailEmptyState
            icon="location-on"
            title={t('places.list.empty.libraryTitle')}
            body={error ?? t('places.list.errors.load')}
            actionLabel={t('common.actions.tryAgain')}
            onAction={() => { void loadPlace(); }}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <DetailHero
            eyebrow={t('places.list.segments.library')}
            title={place.title || route.params.title || t('places.list.badges.library')}
            subtitle={place.description || t('places.list.fallback.description')}
            meta={t('places.list.badges.library')}
          >
            <DetailMetadataChips
              compact
              chips={[
                modeLabel,
                place.category ?? '',
                place.areaLabel ?? '',
              ].filter(Boolean)}
            />
          </DetailHero>

          <DetailSection title={t('inventory.labels.details')}>
            <DetailInfoList
              rows={[
                { label: t('inventory.labels.category'), value: place.category },
                { label: t('places.editor.fields.address'), value: place.mode === 'remote' ? null : publicAddress },
                { label: t('places.editor.fields.onlineLabel'), value: place.mode === 'remote' ? (place.onlineLabel || place.onlineUrl) : null },
                { label: t('inventory.libraryFilters.duration'), value: place.defaultDurationMinutes ? `${place.defaultDurationMinutes} min` : null },
              ]}
            />
          </DetailSection>

          {place.tags?.length ? (
            <DetailSection title={t('inventory.labels.tags')}>
              <DetailMetadataChips chips={place.tags} compact />
            </DetailSection>
          ) : null}

          {place.defaultMeetingInstructions ? (
            <DetailSection title={t('places.editor.fields.description')} description={place.defaultMeetingInstructions} />
          ) : null}

          {images.length ? (
            <DetailSection title={t('places.editor.image.title')}>
              <DetailImageGrid images={images} maxVisible={6} />
            </DetailSection>
          ) : null}

          <DetailBottomActionBar
            layout="primaryBelow"
            helper={actionError ?? (copiedPlace ? t('common.exploreActions.addedHelper') : t('common.exploreActions.helper'))}
            secondary={[{
              label: copiedPlace
                ? t('common.exploreActions.addedPlace')
                : action === 'add'
                  ? t('common.states.saving')
                  : t('common.exploreActions.addPlace'),
              disabled: Boolean(copiedPlace || action),
              onPress: () => { void addToMyPlaces(); },
            }]}
            primary={{
              label: t('common.exploreActions.startPlan'),
              loading: action === 'plan',
              disabled: Boolean(action === 'add'),
              onPress: () => { void startPlan(); },
            }}
          />
        </ScrollView>
      )}
    </AppFixedHeaderScreen>
  );
}

const styles = StyleSheet.create({
  body: { minHeight: 0 },
  content: { paddingBottom: 36 },
  centered: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 14, fontWeight: '700' },
  stateWrap: { flex: 1, justifyContent: 'center', paddingVertical: 24 },
});
