import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DiscoveryLanguage, InventoryTranslationDto, MediaAssetDto, PlaceDto, PlanDto, PlanParticipantDto, PlanPlaceDto, PlanPlaceMode } from '@hellowhen/contracts';
import { buildGeneratedPlanDisplay } from '@hellowhen/shared';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { KeyboardDoneAccessory, KEYBOARD_DONE_ACCESSORY_ID } from '../../components/KeyboardDoneAccessory';
import { ReportContentPanel } from '../../components/ReportContentPanel';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { resolveMediaUrl } from '../trade/mediaUrls';
import { PlanSquareDeck } from './components/PlanSquareDeck';

type PlansScreenProps = NativeStackScreenProps<RootStackParamList, 'Plans'>;
type PlanDetailProps = NativeStackScreenProps<RootStackParamList, 'PlanDetail'>;
type SimpleScreenProps<RouteName extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, RouteName>;
type PlanListScope = 'feed' | 'mine' | 'joined';
type PlaceListScope = 'mine' | 'library';

type PlanMenuItem = {
  title: string;
  body: string;
  icon: MobileIconName;
  onPress: () => void;
};

function isPlansVisible() {
  return betaFeatures.plansEnabled && betaFeatures.plansVisible;
}

function formatDate(value?: string | null) {
  if (!value) return 'Flexible time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function getOwnerName(plan: PlanDto) {
  return plan.owner?.profile?.displayName || plan.owner?.profile?.handle || 'Hellowhen member';
}

function getPlanMeta(plan: PlanDto) {
  const placeCount = plan.places?.length ?? 0;
  const participantCount = plan.participantCount ?? plan.participants?.filter((participant) => participant.status === 'accepted').length ?? 0;
  return `${placeCount} ${placeCount === 1 ? 'place' : 'places'} · ${participantCount} joined`;
}



type SelectedPlanPlaceState = {
  id: string;
  sourcePlaceId?: string;
  sourcePlaceSource?: 'custom' | 'my_place' | 'hellowhen_library';
  sourcePlaceTitle?: string;
  mode: PlanPlaceMode;
  date: string;
  time: string;
  title: string;
  location: string;
  onlineLabel: string;
  onlineUrl: string;
};

type AdvancedPlanDetailsState = {
  title: string;
  description: string;
  category: string;
  tags: string;
};

type PlanEndState = {
  date: string;
  time: string;
};

type PlanCreateStage = 'build' | 'preview';

type PlaceTranslationFormValue = { languageCode: DiscoveryLanguage; title: string; description: string };

type PlaceCreateFormState = {
  mode: PlanPlaceMode;
  title: string;
  description: string;
  defaultLanguage: DiscoveryLanguage;
  translations: PlaceTranslationFormValue[];
  location: string;
  onlineLabel: string;
  onlineUrl: string;
};

type PlacePickerTab = 'mine' | 'library';
type PlaceSourceTarget = number | 'new';

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function toDateInputValue(value?: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function makeSelectedPlanPlace(index: number, date = toDateInputValue()): SelectedPlanPlaceState {
  return {
    id: `mobile-plan-place-${Date.now()}-${index}`,
    sourcePlaceSource: 'custom',
    mode: 'local',
    date,
    time: index === 0 ? '13:00' : '',
    title: '',
    location: '',
    onlineLabel: '',
    onlineUrl: '',
  };
}


const placeLanguageOptions: DiscoveryLanguage[] = ['en', 'fr', 'es'];

function normalizePlaceLanguage(value?: string | null): DiscoveryLanguage {
  if (value === 'fr' || value === 'es') return value;
  return 'en';
}

function placeLanguageLabel(language: DiscoveryLanguage) {
  if (language === 'fr') return 'French';
  if (language === 'es') return 'Spanish';
  return 'English';
}

function nextPlaceTranslationLanguage(state: PlaceCreateFormState) {
  const used = new Set([state.defaultLanguage, ...state.translations.map((translation) => translation.languageCode)]);
  return placeLanguageOptions.find((language) => !used.has(language));
}

function addPlaceTranslationDraft(state: PlaceCreateFormState): PlaceCreateFormState {
  const languageCode = nextPlaceTranslationLanguage(state);
  if (!languageCode) return state;
  return { ...state, translations: [...state.translations, { languageCode, title: '', description: '' }] };
}

function updatePlaceTranslationDraft(state: PlaceCreateFormState, draft: PlaceTranslationFormValue): PlaceCreateFormState {
  return { ...state, translations: state.translations.map((translation) => translation.languageCode === draft.languageCode ? draft : translation) };
}

function removePlaceTranslationDraft(state: PlaceCreateFormState, languageCode: DiscoveryLanguage): PlaceCreateFormState {
  return { ...state, translations: state.translations.filter((translation) => translation.languageCode !== languageCode) };
}

function normalizePlaceTranslationsForPayload(state: PlaceCreateFormState) {
  return state.translations
    .filter((translation) => translation.languageCode !== state.defaultLanguage)
    .filter((translation) => translation.title.trim() || translation.description.trim())
    .map((translation) => ({ languageCode: translation.languageCode, title: translation.title.trim(), description: translation.description.trim() }));
}

function validatePlaceTranslations(state: PlaceCreateFormState) {
  for (const translation of normalizePlaceTranslationsForPayload(state)) {
    if (!translation.title || !translation.description) return 'Complete both translated title and description, or remove that language.';
    if (translation.title.length < 3) return 'Translated Place name must be at least 3 characters.';
  }
  return '';
}

function makePlaceCreateForm(): PlaceCreateFormState {
  return {
    mode: 'local',
    title: '',
    description: '',
    defaultLanguage: 'en',
    translations: [],
    location: '',
    onlineLabel: '',
    onlineUrl: '',
  };
}

function placeCreateFormFromPlace(place: PlaceDto): PlaceCreateFormState {
  const mode = place.mode === 'remote' ? 'remote' : 'local';
  return {
    mode,
    title: place.title ?? '',
    description: place.description ?? '',
    defaultLanguage: normalizePlaceLanguage(place.defaultLanguage),
    translations: ((place.translations ?? []) as InventoryTranslationDto[]).map((translation) => ({ languageCode: normalizePlaceLanguage(translation.languageCode), title: translation.title ?? '', description: translation.description ?? '' })),
    location: mode === 'local' ? place.addressPublicText ?? place.areaLabel ?? '' : '',
    onlineLabel: mode === 'remote' ? place.onlineLabel ?? '' : '',
    onlineUrl: mode === 'remote' ? place.onlineUrl ?? '' : '',
  };
}

function makeAdvancedPlanDetails(): AdvancedPlanDetailsState {
  return { title: '', description: '', category: '', tags: '' };
}

function parsePlanTagsInput(value: string) {
  return Array.from(new Set(value.split(/[,\n]/).map((tag) => tag.trim()).filter(Boolean)));
}

function libraryPlaceSource(place: PlaceDto): SelectedPlanPlaceState['sourcePlaceSource'] {
  return place.source === 'hellowhen_library' ? 'hellowhen_library' : 'my_place';
}

function placeSourceLabel(place: PlaceDto) {
  return place.source === 'hellowhen_library' ? 'Hellowhen Library' : 'My Place';
}

function placeLocationForSelectedPlace(place: PlaceDto) {
  return place.mode === 'remote' ? '' : place.addressPublicText ?? place.areaLabel ?? '';
}

function selectedPlaceFromReusable(place: PlaceDto, index: number, date = toDateInputValue()): SelectedPlanPlaceState {
  return {
    id: `mobile-plan-place-${place.id}-${Date.now()}-${index}`,
    sourcePlaceId: place.id,
    sourcePlaceSource: libraryPlaceSource(place),
    sourcePlaceTitle: place.title,
    mode: place.mode ?? 'local',
    date,
    time: index === 0 ? '13:00' : '',
    title: place.title,
    location: placeLocationForSelectedPlace(place),
    onlineLabel: place.onlineLabel ?? '',
    onlineUrl: place.onlineUrl ?? '',
  };
}

function resetSelectedPlaceToCustom(place: SelectedPlanPlaceState): SelectedPlanPlaceState {
  return {
    ...place,
    sourcePlaceId: undefined,
    sourcePlaceSource: 'custom',
    sourcePlaceTitle: undefined,
  };
}

function filterPlaces(places: PlaceDto[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return places;
  return places.filter((place) => [place.title, place.description, place.category, place.areaLabel, place.addressPublicText, place.onlineLabel, place.onlineUrl]
    .some((value) => value?.toLowerCase().includes(normalized)));
}

function parseLocalDateTime(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim()) || !/^\d{2}:\d{2}$/.test(timeValue.trim())) return null;
  const date = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildMobilePlanSchedule(places: SelectedPlanPlaceState[]) {
  if (places.length === 0) {
    return { startsAt: '', endsAt: '', placeStartsAt: [] as Array<string | undefined>, error: 'Add at least one place with a valid date and time.' };
  }

  const firstPlace = places[0];
  const firstDateTime = firstPlace ? parseLocalDateTime(firstPlace.date, firstPlace.time) : null;
  if (!firstDateTime) {
    return { startsAt: '', endsAt: '', placeStartsAt: [] as Array<string | undefined>, error: 'Add a valid date and time for Place 1.' };
  }

  let previousDateTime = firstDateTime;
  let lastDateTime = firstDateTime;
  const placeStartsAt: Array<string | undefined> = [firstDateTime.toISOString()];

  for (let index = 1; index < places.length; index += 1) {
    const place = places[index];
    if (!place) continue;
    const currentDateTime = parseLocalDateTime(place.date, place.time);
    if (!currentDateTime) {
      return { startsAt: '', endsAt: '', placeStartsAt: [] as Array<string | undefined>, error: `Add a valid date and time for Place ${index + 1}.` };
    }
    if (currentDateTime.getTime() < previousDateTime.getTime()) {
      return { startsAt: '', endsAt: '', placeStartsAt: [] as Array<string | undefined>, error: 'Each place time must be at the same time or after the previous place.' };
    }
    placeStartsAt[index] = currentDateTime.toISOString();
    previousDateTime = currentDateTime;
    lastDateTime = currentDateTime;
  }

  return {
    startsAt: firstDateTime.toISOString(),
    endsAt: lastDateTime.toISOString(),
    placeStartsAt,
    error: '',
  };
}

function parseOptionalMobilePlanEnd(end: PlanEndState, startsAt: string) {
  if (!end.date.trim() && !end.time.trim()) return { endsAt: '', error: '' };
  if (!end.date.trim() || !end.time.trim()) return { endsAt: '', error: 'Add both an end date and end time, or leave the end empty.' };
  const parsed = parseLocalDateTime(end.date, end.time);
  if (!parsed) return { endsAt: '', error: 'Add a valid end date and time, or leave the end empty.' };
  if (startsAt && parsed.getTime() < new Date(startsAt).getTime()) return { endsAt: '', error: 'End time must be after the Plan start.' };
  return { endsAt: parsed.toISOString(), error: '' };
}

function planModeFromSelectedPlaces(places: SelectedPlanPlaceState[]) {
  const modes = new Set(places.map((place) => place.mode));
  if (modes.size > 1) return 'hybrid' as const;
  return modes.has('remote') ? 'remote' as const : 'local' as const;
}

function placePreviewLocation(place: SelectedPlanPlaceState) {
  if (place.mode === 'remote') return place.onlineLabel.trim() || place.onlineUrl.trim() || place.location.trim() || 'Online place';
  return place.location.trim() || 'Offline place';
}


function planPreviewPlaceTitle(place: SelectedPlanPlaceState, index: number) {
  return place.title.trim() || place.sourcePlaceTitle?.trim() || `Place ${index + 1}`;
}

function planPreviewTimeLabel(place: SelectedPlanPlaceState) {
  if (place.date && place.time) return `${place.date} · ${place.time}`;
  if (place.time) return place.time;
  return 'Time required';
}

function getAcceptedParticipants(plan: PlanDto) {
  return [...(plan.participants ?? [])].filter((participant) => participant.status === 'accepted').sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());
}

function getParticipantName(participant: PlanParticipantDto) {
  return participant.user?.profile?.displayName || participant.user?.profile?.handle || 'Hellowhen user';
}

function getParticipantInitial(participant: PlanParticipantDto) {
  return getParticipantName(participant).trim().slice(0, 1).toUpperCase() || 'H';
}

function formatPlanDateRange(plan: PlanDto) {
  if (!plan.endsAt) return formatDate(plan.startsAt);
  return `${formatDate(plan.startsAt)} – ${formatDate(plan.endsAt)}`;
}

function getPlanLocationLabel(plan: PlanDto) {
  if (plan.locationLabel) return plan.locationLabel;
  const firstPlace = [...(plan.places ?? [])].sort((first, second) => first.order - second.order)[0];
  if (!firstPlace) return 'Places selected by the organizer';
  if (firstPlace.mode === 'remote') return firstPlace.onlineLabel || firstPlace.onlineUrl || 'Online Plan';
  return firstPlace.addressPublicText || firstPlace.sourcePlace?.areaLabel || 'Offline Plan';
}

function activeMedia(media: MediaAssetDto[] | undefined) {
  return (media ?? []).filter((asset) => asset.status === 'active');
}

function activeMediaUrl(media?: MediaAssetDto | null) {
  if (!media?.url || media.status !== 'active') return null;
  return resolveMediaUrl(media.url);
}

function getPlanPlaceMedia(place: PlanPlaceDto) {
  return activeMedia(place.media)[0] ?? activeMedia(place.sourcePlace?.media)[0] ?? null;
}

function sortedPlanPlaces(plan: PlanDto) {
  return [...(plan.places ?? [])].sort((first, second) => first.order - second.order);
}

function getPlanPlaceLocationLabel(place: PlanPlaceDto) {
  if (place.mode === 'remote') return place.onlineLabel || place.onlineUrl || 'Online place';
  return place.addressPublicText || place.sourcePlace?.areaLabel || 'Offline place';
}

function getPlanPlaceSourceLabel(place: PlanPlaceDto) {
  if (place.source === 'hellowhen_library') return 'Library place';
  if (place.source === 'my_place') return 'My place';
  return 'Custom';
}

function DisabledPlansScreen({ onBack }: { onBack: () => void }) {
  const theme = useThemeTokens();
  return (
    <AppFixedHeaderScreen header={<AppHeader title="Plans" onBack={onBack} />}>
      <View style={styles.centerState}>
        <View style={[styles.largeIcon, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
          <MobileIcon name="calendar" color={theme.semantic.plan.text} size={30} />
        </View>
        <AppText style={styles.centerTitle}>Plans are hidden</AppText>
        <AppText style={[styles.centerBody, { color: theme.color.muted }]}>The mobile Plan route skeleton is ready, but Plans stay hidden until the Plan feature flags are enabled.</AppText>
      </View>
    </AppFixedHeaderScreen>
  );
}

function HeaderAction({ icon, label, onPress }: { icon: MobileIconName; label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.headerAction, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}
    >
      <MobileIcon name={icon} size={20} color={theme.color.text} />
    </Pressable>
  );
}

function PlanRow({ plan, onPress }: { plan: PlanDto; onPress: () => void }) {
  const theme = useThemeTokens();
  const firstPlace = plan.places?.[0];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.rowCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.rowTop}>
        <SemanticBadge label={plan.status} tone={plan.status === 'open' ? 'success' : 'muted'} size="sm" />
        {plan.myParticipantStatus ? <SemanticBadge label={plan.myParticipantStatus === 'accepted' ? 'Joined' : plan.myParticipantStatus} tone="proposal" size="sm" /> : null}
      </View>
      <AppText style={styles.rowTitle}>{plan.title}</AppText>
      <AppText style={[styles.rowBody, { color: theme.color.muted }]} numberOfLines={2}>{plan.description}</AppText>
      <View style={styles.metaRow}>
        <MobileIcon name="profile" size={15} color={theme.color.muted} />
        <AppText style={[styles.metaText, { color: theme.color.muted }]}>{getOwnerName(plan)}</AppText>
      </View>
      <View style={styles.metaRow}>
        <MobileIcon name="calendar" size={15} color={theme.color.muted} />
        <AppText style={[styles.metaText, { color: theme.color.muted }]}>{formatDate(plan.startsAt)}</AppText>
      </View>
      <View style={styles.metaRow}>
        <MobileIcon name="activity" size={15} color={theme.color.muted} />
        <AppText style={[styles.metaText, { color: theme.color.muted }]}>{getPlanMeta(plan)}</AppText>
      </View>
      {firstPlace ? <AppText style={[styles.placePreview, { color: theme.semantic.plan.text }]}>Starts with {firstPlace.title}</AppText> : null}
    </Pressable>
  );
}

function PlaceRow({ place, onPress }: { place: PlaceDto; onPress?: () => void }) {
  const theme = useThemeTokens();
  const isLibrary = place.source === 'hellowhen_library';
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={({ pressed }) => [styles.rowCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && onPress && styles.pressed]}>
      <View style={styles.rowTop}>
        <SemanticBadge label={isLibrary ? 'Library place' : 'My place'} tone="place" size="sm" />
        <SemanticBadge label={place.mode === 'remote' ? 'Online' : 'Offline'} tone="muted" size="sm" />
      </View>
      <AppText style={styles.rowTitle}>{place.title}</AppText>
      <AppText style={[styles.rowBody, { color: theme.color.muted }]} numberOfLines={2}>{place.description || 'Reusable place for future Plans.'}</AppText>
      <View style={styles.metaRow}>
        <MobileIcon name={place.mode === 'remote' ? 'send' : 'calendar'} size={15} color={theme.color.muted} />
        <AppText style={[styles.metaText, { color: theme.color.muted }]}>{place.mode === 'remote' ? (place.onlineLabel || place.onlineUrl || 'Online place') : (place.areaLabel || place.addressPublicText || 'Offline place')}</AppText>
      </View>
    </Pressable>
  );
}

function PlanList({ scope, navigation }: { scope: PlanListScope; navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'> }) {
  const theme = useThemeTokens();
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async ({ refresh = false }: { refresh?: boolean } = {}) => {
    if (!isPlansVisible()) { setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const response = scope === 'mine' ? await api.plans.mine() : scope === 'joined' ? await api.plans.joined() : await api.plans.feed();
      setPlans(response.plans ?? []);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setPlans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return <View style={styles.inlineLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Plans...</AppText></View>;
  }

  if (error) return <InfoNotice tone="warning" title="Could not load Plans" body={error} />;

  if (plans.length === 0) {
    const body = scope === 'mine'
      ? 'Created Plans will appear here once you create one.'
      : scope === 'joined'
        ? 'Plans you join will appear here.'
        : 'Open Plans will appear here once people start creating them.';
    return <EmptyBlock title="No Plans yet" body={body} actionLabel={scope === 'mine' ? 'Create plan' : undefined} onAction={scope === 'mine' ? () => navigation.navigate('CreatePlan') : undefined} />;
  }

  const isDeckFeed = scope === 'feed';

  return (
    <ScrollView
      contentContainerStyle={isDeckFeed ? styles.deckFeedContent : styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load({ refresh: true }); }} />}
    >
      {plans.map((plan, index) => (
        isDeckFeed
          ? <PlanDeckSection key={plan.id} plan={plan} index={index} total={plans.length} onPress={() => navigation.navigate('PlanDetail', { planId: plan.id, title: plan.title })} />
          : <PlanRow key={plan.id} plan={plan} onPress={() => navigation.navigate('PlanDetail', { planId: plan.id, title: plan.title })} />
      ))}
    </ScrollView>
  );
}


function PlanDeckSection({ plan, index, total, onPress }: { plan: PlanDto; index: number; total: number; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.deckSection}>
      <View style={styles.deckSectionHeader}>
        <View style={styles.deckSectionCopy}>
          <AppText style={styles.deckSectionTitle} numberOfLines={1}>{plan.title}</AppText>
          <AppText style={[styles.deckSectionMeta, { color: theme.color.muted }]} numberOfLines={1}>{getOwnerName(plan)} · {getPlanMeta(plan)}</AppText>
        </View>
        <SemanticBadge label={`${index + 1}/${total}`} tone="muted" size="sm" />
      </View>
      <PlanSquareDeck plan={plan} index={index} total={total} onOpen={onPress} />
    </View>
  );
}

function PlaceList({ scope, navigation }: { scope: PlaceListScope; navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'> }) {
  const theme = useThemeTokens();
  const [places, setPlaces] = useState<PlaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async ({ refresh = false }: { refresh?: boolean } = {}) => {
    if (!isPlansVisible()) { setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const response = scope === 'library' ? await api.places.library() : await api.places.mine();
      setPlaces(response.places ?? []);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setPlaces([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return <View style={styles.inlineLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Places...</AppText></View>;
  }

  if (error) return <InfoNotice tone="warning" title="Could not load Places" body={error} />;

  if (places.length === 0) {
    return <EmptyBlock title={scope === 'library' ? 'Library is empty' : 'No Places yet'} body={scope === 'library' ? 'Hellowhen Place Library items will appear here later.' : 'Create reusable Places first, then pick them while creating a Plan.'} actionLabel={scope === 'mine' ? 'Create place' : undefined} onAction={scope === 'mine' ? () => navigation.navigate('CreatePlace') : undefined} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load({ refresh: true }); }} />}
    >
      {places.map((place) => <PlaceRow key={place.id} place={place} />)}
    </ScrollView>
  );
}

function EmptyBlock({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.emptyBlock, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <MobileIcon name="calendar" size={28} color={theme.color.muted} />
      <AppText style={styles.emptyTitle}>{title}</AppText>
      <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{body}</AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
          <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function SkeletonNotice({ title, body }: { title: string; body: string }) {
  return (
    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      <InfoNotice tone="instruction" title={title} body={body} />
      <EmptyBlock title="Coming in the next Plan patch" body="This mobile route is intentionally wired now so later Plan feed/detail/create patches can attach real UI without changing navigation again." />
    </ScrollView>
  );
}

export function PlansScreen(props: Partial<PlansScreenProps> = {}) {
  const fallbackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigation = (props.navigation ?? fallbackNavigation) as NativeStackNavigationProp<RootStackParamList>;
  const theme = useThemeTokens();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  const menuItems: PlanMenuItem[] = [
    { title: 'My plans', body: 'Plans you created.', icon: 'calendar', onPress: () => { setMenuOpen(false); navigation.navigate('MyPlans'); } },
    { title: 'Joined plans', body: 'Plans you joined freely.', icon: 'activity', onPress: () => { setMenuOpen(false); navigation.navigate('JoinedPlans'); } },
    { title: 'My places', body: 'Reusable offline or online places.', icon: 'save', onPress: () => { setMenuOpen(false); navigation.navigate('MyPlaces'); } },
    { title: 'Hellowhen Place Library', body: 'Starter/library places for Plans.', icon: 'search', onPress: () => { setMenuOpen(false); navigation.navigate('PlaceLibrary'); } },
    { title: 'Create place', body: 'Prepare a reusable place.', icon: 'add', onPress: () => { setMenuOpen(false); navigation.navigate('CreatePlace'); } },
    { title: 'Create plan', body: 'Choose places and arrange them.', icon: 'add', onPress: () => { setMenuOpen(false); navigation.navigate('CreatePlan'); } },
  ];

  const header = (
    <View style={styles.feedHeader}>
      <View style={styles.feedTitleWrap}>
        <AppText style={styles.feedTitle}>Plans</AppText>
      </View>
      <View style={styles.headerActions}>
        <HeaderAction icon="filter" label="Filter Plans" onPress={() => { setFiltersOpen((value) => !value); setMenuOpen(false); }} />
        <HeaderAction icon="more" label="Open Plan menu" onPress={() => { setMenuOpen((value) => !value); setFiltersOpen(false); }} />
        <HeaderAction icon="add" label="Create Plan" onPress={() => navigation.navigate('CreatePlan')} />
      </View>
    </View>
  );

  return (
    <AppFixedHeaderScreen header={header}>
      <View style={styles.bodyWrap}>
        {filtersOpen ? (
          <View style={[styles.filterNotice, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <View style={[styles.menuIcon, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
              <MobileIcon name="filter" size={17} color={theme.semantic.plan.text} />
            </View>
            <View style={styles.menuCopy}>
              <AppText style={styles.menuTitle}>Open Plans feed</AppText>
              <AppText style={[styles.menuBody, { color: theme.color.muted }]}>This feed shows public Plans. My plans, joined Plans, and Places live in the menu.</AppText>
            </View>
          </View>
        ) : null}
        {menuOpen ? (
          <View style={[styles.menuPanel, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            {menuItems.map((item) => <MenuItem key={item.title} item={item} />)}
          </View>
        ) : null}
        <PlanList scope="feed" navigation={navigation} />
      </View>
    </AppFixedHeaderScreen>
  );
}

function MenuItem({ item }: { item: PlanMenuItem }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" onPress={item.onPress} style={({ pressed }) => [styles.menuItem, { borderBottomColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={[styles.menuIcon, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}><MobileIcon name={item.icon} size={17} color={theme.semantic.plan.text} /></View>
      <View style={styles.menuCopy}>
        <AppText style={styles.menuTitle}>{item.title}</AppText>
        <AppText style={[styles.menuBody, { color: theme.color.muted }]}>{item.body}</AppText>
      </View>
      <MobileIcon name="chevron-right" size={20} color={theme.color.muted} />
    </Pressable>
  );
}

function PlanStatPill({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.statPill, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={[styles.statLabel, { color: theme.color.muted }]}>{label}</AppText>
    </View>
  );
}

function ParticipantCompactRow({ participant }: { participant: PlanParticipantDto }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.participantRow, { borderBottomColor: theme.color.border }]}>
      <View style={[styles.participantAvatar, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
        <AppText style={[styles.participantInitial, { color: theme.semantic.plan.text }]}>{getParticipantInitial(participant)}</AppText>
      </View>
      <View style={styles.participantCopy}>
        <AppText style={styles.participantName}>{getParticipantName(participant)}</AppText>
        <AppText style={[styles.participantStatus, { color: theme.color.muted }]}>{participant.status === 'accepted' ? 'Joined' : participant.status}</AppText>
      </View>
    </View>
  );
}

function PlanPlaceTimelineCard({ place, index, showReport }: { place: PlanPlaceDto; index: number; showReport: boolean }) {
  const theme = useThemeTokens();
  const mediaUrl = activeMediaUrl(getPlanPlaceMedia(place));
  const locationLabel = getPlanPlaceLocationLabel(place);

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineNumber, { backgroundColor: theme.color.text }]}>
          <AppText style={[styles.timelineNumberText, { color: theme.color.background }]}>{index + 1}</AppText>
        </View>
        <View style={[styles.timelineLine, { backgroundColor: theme.color.border }]} />
      </View>
      <View style={[styles.timelineCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        <View style={styles.timelineCardHeader}>
          <View style={styles.timelineCopy}>
            <View style={styles.rowTop}>
              <SemanticBadge label={`Place ${index + 1}`} tone="place" size="sm" />
              <SemanticBadge label={place.mode === 'remote' ? 'Online' : 'Offline'} tone="muted" size="sm" />
              <SemanticBadge label={getPlanPlaceSourceLabel(place)} tone="muted" size="sm" />
            </View>
            <AppText style={styles.rowTitle}>{place.title}</AppText>
          </View>
          <View style={[styles.timelineMedia, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}>
            {mediaUrl ? <Image source={{ uri: mediaUrl }} resizeMode="cover" style={styles.timelineImage} /> : <MobileIcon name="calendar" size={24} color={theme.semantic.place.text} />}
          </View>
        </View>
        <View style={styles.detailMetaStack}>
          <View style={styles.metaRow}>
            <MobileIcon name={place.mode === 'remote' ? 'send' : 'calendar'} size={15} color={theme.color.muted} />
            <AppText style={[styles.metaText, { color: theme.color.muted }]}>{locationLabel}</AppText>
          </View>
          <View style={styles.metaRow}>
            <MobileIcon name="activity" size={15} color={theme.color.muted} />
            <AppText style={[styles.metaText, { color: theme.color.muted }]}>{formatDate(place.startsAt)}</AppText>
          </View>
        </View>
        {showReport ? <ReportContentPanel targetType="plan_place" targetId={place.id} labelKey="report.button" helperKey="report.helper.content" /> : null}
      </View>
    </View>
  );
}

export function PlanDetailScreen({ route, navigation }: PlanDetailProps) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [loading, setLoading] = useState(isPlansVisible());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isPlansVisible()) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await api.plans.get(route.params.planId);
      setPlan(response.plan);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [route.params.planId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function joinPlan() {
    if (!plan || busy) return;
    setBusy(true);
    setError(null);
    setActionMessage(null);
    setActionError(null);
    try {
      await api.plans.join(plan.id);
      setActionMessage('You joined this Plan.');
      await load();
    } catch (caughtError) {
      setActionError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setBusy(false);
    }
  }

  async function leavePlan() {
    if (!plan || busy) return;
    setBusy(true);
    setError(null);
    setActionMessage(null);
    setActionError(null);
    try {
      await api.plans.leave(plan.id);
      setActionMessage('You left this Plan.');
      await load();
    } catch (caughtError) {
      setActionError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setBusy(false);
    }
  }

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  const isOwner = Boolean(auth.user?.id && plan?.ownerId === auth.user.id);
  const isJoined = plan?.myParticipantStatus === 'accepted';
  const canJoin = Boolean(plan && auth.user && !isOwner && !isJoined && plan.status === 'open');
  const canLeave = Boolean(plan && !isOwner && isJoined);
  const places = plan ? sortedPlanPlaces(plan) : [];
  const acceptedParticipants = plan ? getAcceptedParticipants(plan) : [];
  const joinedCount = plan?.participantCount ?? acceptedParticipants.length;
  const capacityLabel = plan?.maxParticipants ? `${joinedCount}/${plan.maxParticipants}` : String(joinedCount);
  const showReportActions = Boolean(auth.user && plan && !isOwner);

  return (
    <AppFixedHeaderScreen header={<AppHeader title={route.params.title ?? 'Plan'} onBack={() => navigation.goBack()} />}>
      {loading ? <View style={styles.inlineLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Plan...</AppText></View> : null}
      {!loading && error ? <View style={styles.contentPad}><InfoNotice tone="warning" title="Could not load Plan" body={error} /></View> : null}
      {!loading && plan ? (
        <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <View style={styles.rowTop}>
              <SemanticBadge label="Plan" tone="trade" />
              <SemanticBadge label={plan.status} tone={plan.status === 'open' ? 'success' : 'muted'} />
              {isJoined ? <SemanticBadge label="Joined" tone="proposal" /> : null}
            </View>
            <AppText style={styles.heroTitle}>{plan.title}</AppText>
            <AppText style={[styles.heroBody, { color: theme.color.muted }]}>{plan.description}</AppText>
            <View style={styles.detailMetaStack}>
              <View style={styles.metaRow}><MobileIcon name="profile" size={16} color={theme.color.muted} /><AppText style={[styles.metaText, { color: theme.color.muted }]}>By {getOwnerName(plan)}</AppText></View>
              <View style={styles.metaRow}><MobileIcon name="calendar" size={16} color={theme.color.muted} /><AppText style={[styles.metaText, { color: theme.color.muted }]}>{formatPlanDateRange(plan)}</AppText></View>
              <View style={styles.metaRow}><MobileIcon name="activity" size={16} color={theme.color.muted} /><AppText style={[styles.metaText, { color: theme.color.muted }]}>{getPlanLocationLabel(plan)}</AppText></View>
            </View>
            <View style={styles.statGrid}>
              <PlanStatPill value={capacityLabel} label="joined" />
              <PlanStatPill value={String(places.length)} label="places" />
              <PlanStatPill value="Free" label="join" />
            </View>
            <View style={styles.detailActionStack}>
              {isOwner ? <InfoNotice tone="info" title="You own this Plan" body="People can join freely while this first production Plan flow is hidden behind the feature flags." /> : null}
              {canJoin ? (
                <Pressable disabled={busy} accessibilityRole="button" onPress={joinPlan} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed, busy && styles.disabled]}>
                  <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{busy ? 'Joining...' : 'Join plan'}</AppText>
                </Pressable>
              ) : null}
              {isJoined ? (
                <View style={[styles.joinedState, { backgroundColor: theme.semantic.success.softBg, borderColor: theme.semantic.success.border }]}>
                  <MobileIcon name="proposal-accepted" size={18} color={theme.semantic.success.text} />
                  <AppText style={[styles.joinedStateText, { color: theme.semantic.success.text }]}>Joined</AppText>
                </View>
              ) : null}
              {canLeave ? (
                <Pressable disabled={busy} accessibilityRole="button" onPress={leavePlan} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed, busy && styles.disabled]}>
                  <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{busy ? 'Updating...' : 'Leave plan'}</AppText>
                </Pressable>
              ) : null}
              {!auth.user ? <InfoNotice tone="info" title="Log in to join" body="Plans use the same protected account session as Trade. Log in first, then join freely." /> : null}
              {actionMessage ? <InfoNotice tone="success" title="Plan updated" body={actionMessage} /> : null}
              {actionError ? <InfoNotice tone="warning" title="Plan action failed" body={actionError} /> : null}
            </View>
          </View>

          <View style={styles.sectionTitleRow}><AppText style={styles.sectionTitle}>Plan route</AppText><SemanticBadge label={`${places.length}`} tone="place" size="sm" /></View>
          {places.length === 0 ? <EmptyBlock title="No places yet" body="This Plan does not have places attached yet." /> : null}
          {places.map((place, index) => <PlanPlaceTimelineCard key={place.id} place={place} index={index} showReport={showReportActions} />)}

          <View style={[styles.detailSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <View style={styles.detailSectionHeader}>
              <View style={styles.detailSectionCopy}>
                <AppText style={styles.sectionTitle}>Joined people</AppText>
                <AppText style={[styles.rowBody, { color: theme.color.muted }]}>Free join is enabled for this first hidden production version.</AppText>
              </View>
              <SemanticBadge label={String(joinedCount)} tone="proposal" size="sm" />
            </View>
            {acceptedParticipants.length === 0 ? <AppText style={[styles.rowBody, { color: theme.color.muted }]}>No participants yet.</AppText> : null}
            {acceptedParticipants.map((participant) => <ParticipantCompactRow key={participant.id} participant={participant} />)}
          </View>

          <View style={[styles.detailSection, styles.supportSection, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
            <View style={styles.detailSectionCopy}>
              <AppText style={styles.sectionTitle}>Safety and support</AppText>
              <AppText style={[styles.rowBody, { color: theme.color.muted }]}>Plans are still hidden and internal while testing. Public discussion is intentionally postponed for this first production version.</AppText>
            </View>
            {showReportActions ? <ReportContentPanel targetType="plan" targetId={plan.id} labelKey="report.button" helperKey="report.helper.content" /> : null}
          </View>
        </ScrollView>
      ) : null}
    </AppFixedHeaderScreen>
  );
}

export function MyPlansScreen({ navigation }: SimpleScreenProps<'MyPlans'>) {
  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;
  return <AppFixedHeaderScreen header={<AppHeader title="My plans" onBack={() => navigation.goBack()} rightSlot={<HeaderAction icon="add" label="Create Plan" onPress={() => navigation.navigate('CreatePlan')} />} />}><PlanList scope="mine" navigation={navigation} /></AppFixedHeaderScreen>;
}

export function JoinedPlansScreen({ navigation }: SimpleScreenProps<'JoinedPlans'>) {
  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;
  return <AppFixedHeaderScreen header={<AppHeader title="Joined plans" onBack={() => navigation.goBack()} />}><PlanList scope="joined" navigation={navigation} /></AppFixedHeaderScreen>;
}

export function MyPlacesScreen({ navigation }: SimpleScreenProps<'MyPlaces'>) {
  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;
  return <AppFixedHeaderScreen header={<AppHeader title="My places" onBack={() => navigation.goBack()} rightSlot={<HeaderAction icon="add" label="Create Place" onPress={() => navigation.navigate('CreatePlace')} />} />}><PlaceList scope="mine" navigation={navigation} /></AppFixedHeaderScreen>;
}

export function PlaceLibraryScreen({ navigation }: SimpleScreenProps<'PlaceLibrary'>) {
  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;
  return <AppFixedHeaderScreen header={<AppHeader title="Place Library" onBack={() => navigation.goBack()} />}><PlaceList scope="library" navigation={navigation} /></AppFixedHeaderScreen>;
}

function ModeSegment({ value, onChange }: { value: PlanPlaceMode; onChange: (value: PlanPlaceMode) => void }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.modeSegment, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      {(['local', 'remote'] as PlanPlaceMode[]).map((mode) => {
        const active = value === mode;
        return (
          <Pressable key={mode} accessibilityRole="button" onPress={() => onChange(mode)} style={({ pressed }) => [styles.modeSegmentButton, { backgroundColor: active ? theme.semantic.place.bg : 'transparent' }, pressed && styles.pressed]}>
            <AppText style={[styles.modeSegmentText, { color: active ? theme.color.background : theme.color.text }]}>{mode === 'remote' ? 'Online' : 'Offline'}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function FormLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.formField}>
      <AppText style={styles.formLabel}>{label}</AppText>
      {children}
    </View>
  );
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numbers-and-punctuation' | 'url';
  maxLength?: number;
}) {
  const theme = useThemeTokens();
  return (
    <FormLabel label={label}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.muted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : undefined}
        keyboardType={keyboardType}
        maxLength={maxLength}
        inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
        returnKeyType={multiline ? 'default' : 'done'}
        blurOnSubmit={!multiline}
        style={[styles.input, multiline && styles.textArea, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]}
      />
    </FormLabel>
  );
}

function PillButton({ label, onPress, active, disabled }: { label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.pillButton, { borderColor: active ? theme.semantic.plan.border : theme.color.border, backgroundColor: active ? theme.semantic.plan.softBg : theme.color.surface }, pressed && styles.pressed, disabled && styles.disabled]}>
      <AppText style={[styles.pillButtonText, { color: active ? theme.semantic.plan.text : theme.color.text }]}>{label}</AppText>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, disabled, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: MobileIconName }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed, disabled && styles.disabled]}>
      {icon ? <MobileIcon name={icon} size={16} color={theme.color.text} /> : null}
      <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{label}</AppText>
    </Pressable>
  );
}

function PlaceChoiceCard({ place, onAdd }: { place: PlaceDto; onAdd: () => void }) {
  const theme = useThemeTokens();
  const meta = [place.mode === 'remote' ? 'Online' : 'Offline', place.category, place.areaLabel || place.addressPublicText || place.onlineLabel]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' · ');
  return (
    <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.choiceCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={[styles.choiceIcon, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}>
        <MobileIcon name={place.mode === 'remote' ? 'send' : 'calendar'} size={18} color={theme.semantic.place.text} />
      </View>
      <View style={styles.choiceCopy}>
        <View style={styles.rowTop}>
          <SemanticBadge label={placeSourceLabel(place)} tone="place" size="sm" />
          <SemanticBadge label={place.mode === 'remote' ? 'Online' : 'Offline'} tone="muted" size="sm" />
        </View>
        <AppText style={styles.choiceTitle}>{place.title}</AppText>
        <AppText style={[styles.choiceMeta, { color: theme.color.muted }]} numberOfLines={2}>{meta || place.description || 'Reusable Place'}</AppText>
      </View>
      <View style={[styles.addMini, { backgroundColor: theme.semantic.place.bg }]}>
        <MobileIcon name="add" size={16} color={theme.color.background} />
      </View>
    </Pressable>
  );
}

function PlaceTimelineRow({ place, index, onPress }: { place: SelectedPlanPlaceState; index: number; onPress: () => void }) {
  const theme = useThemeTokens();
  const meta = placePreviewLocation(place) || 'No location yet';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.placeTimelineRow, { borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.timelineCopy}>
        <View style={styles.rowTop}>
          <SemanticBadge label={`Place ${index + 1}`} tone="place" size="sm" />
          {place.sourcePlaceId ? <SemanticBadge label={place.sourcePlaceSource === 'hellowhen_library' ? 'Library' : 'My Place'} tone="place" size="sm" /> : <SemanticBadge label="Custom" tone="place" size="sm" />}
        </View>
        <AppText style={styles.rowTitle}>{place.title || place.sourcePlaceTitle || `Place ${index + 1}`}</AppText>
        <AppText style={[styles.metaText, { color: theme.color.muted }]} numberOfLines={2}>{meta}</AppText>
      </View>
      <MobileIcon name="chevron-right" color={theme.color.muted} size={18} />
    </Pressable>
  );
}

function PlanTimeCard({
  place,
  index,
  onChange,
}: {
  place: SelectedPlanPlaceState;
  index: number;
  onChange: (patch: Partial<SelectedPlanPlaceState>) => void;
}) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.timeCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.timeCardHeader}>
        <SemanticBadge label={`Place ${index + 1}`} tone="place" size="sm" />
        <View style={styles.timelineCopy}>
          <AppText style={styles.rowTitle}>{place.title || place.sourcePlaceTitle || `Place ${index + 1}`}</AppText>
          <AppText style={[styles.metaText, { color: theme.color.muted }]}>{index === 0 ? 'Plan start · required' : 'Optional · same time or after the previous timed place'}</AppText>
        </View>
      </View>
      <View style={styles.twoColumnRow}>
        <TextField label="Date" value={place.date} onChangeText={(date) => onChange({ date })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <TextField label="Time" value={place.time} onChangeText={(time) => onChange({ time })} placeholder="13:00" keyboardType="numbers-and-punctuation" />
      </View>
    </View>
  );
}

function AdvancedPlanDetailsCard({
  open,
  details,
  generatedTitle,
  generatedDescription,
  onToggle,
  onChange,
}: {
  open: boolean;
  details: AdvancedPlanDetailsState;
  generatedTitle: string;
  generatedDescription: string;
  onToggle: () => void;
  onChange: (patch: Partial<AdvancedPlanDetailsState>) => void;
}) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.advancedCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={({ pressed }) => [styles.advancedToggle, pressed && styles.pressed]}>
        <View style={styles.timelineCopy}>
          <AppText style={styles.rowTitle}>More options</AppText>
          <AppText style={[styles.metaText, { color: theme.color.muted }]}>{open ? 'Hide custom Plan details' : 'Optional title, description, category, and tags'}</AppText>
        </View>
        <SemanticBadge label={open ? '−' : '+'} tone="plan" size="sm" />
      </Pressable>
      {open ? (
        <View style={styles.advancedPanel}>
          <TextField label="Custom Plan title" value={details.title} onChangeText={(title) => onChange({ title })} placeholder={generatedTitle} maxLength={120} />
          <TextField label="Custom Plan description" value={details.description} onChangeText={(description) => onChange({ description })} placeholder={generatedDescription} multiline maxLength={2000} />
          <View style={styles.twoColumnRow}>
            <TextField label="Category" value={details.category} onChangeText={(category) => onChange({ category })} placeholder="Culture, food..." maxLength={80} />
            <TextField label="Tags" value={details.tags} onChangeText={(tags) => onChange({ tags })} placeholder="Paris, coffee" maxLength={280} />
          </View>
          <AppText style={[styles.metaText, { color: theme.color.muted }]}>Leave empty to use the generated place/time summary. Separate tags with commas.</AppText>
        </View>
      ) : null}
    </View>
  );
}

export function CreatePlanScreen({ navigation, route }: SimpleScreenProps<'CreatePlan'>) {
  const theme = useThemeTokens();
  const [places, setPlaces] = useState<SelectedPlanPlaceState[]>([]);
  const [myPlaces, setMyPlaces] = useState<PlaceDto[]>([]);
  const [libraryPlaces, setLibraryPlaces] = useState<PlaceDto[]>([]);
  const [pickerTab, setPickerTab] = useState<PlacePickerTab>('mine');
  const [placeQuery, setPlaceQuery] = useState('');
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [saving, setSaving] = useState(false);
  const [advancedDetails, setAdvancedDetails] = useState<AdvancedPlanDetailsState>(() => makeAdvancedPlanDetails());
  const [planEnd, setPlanEnd] = useState<PlanEndState>({ date: '', time: '' });
  const [stage, setStage] = useState<PlanCreateStage>('build');
  const [placeSourceSheetOpen, setPlaceSourceSheetOpen] = useState(false);
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const [placeSourceTarget, setPlaceSourceTarget] = useState<PlaceSourceTarget>('new');
  const [detailPlaceIndex, setDetailPlaceIndex] = useState<number | null>(null);
  const [advancedDetailsOpen, setAdvancedDetailsOpen] = useState(false);
  const handledCreatedPlaceNonceRef = useRef<number | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredMyPlaces = useMemo(() => filterPlaces(myPlaces, placeQuery), [myPlaces, placeQuery]);
  const filteredLibraryPlaces = useMemo(() => filterPlaces(libraryPlaces, placeQuery), [libraryPlaces, placeQuery]);
  const placesForGeneratedDisplay = useMemo(() => places.filter((place) => place.title.trim() || place.sourcePlaceTitle?.trim()), [places]);
  const schedulablePlaces = useMemo(() => places.filter((place) => place.title.trim() || place.sourcePlaceId), [places]);
  const schedule = useMemo(() => buildMobilePlanSchedule(schedulablePlaces), [schedulablePlaces]);
  const explicitPlanEnd = useMemo(() => parseOptionalMobilePlanEnd(planEnd, schedule.startsAt), [planEnd, schedule.startsAt]);
  const generatedPlanDisplay = useMemo(() => buildGeneratedPlanDisplay({
    places: placesForGeneratedDisplay,
    startsAt: schedule.startsAt,
    mode: planModeFromSelectedPlaces(placesForGeneratedDisplay),
    joinApprovalMode: 'automatic',
  }), [placesForGeneratedDisplay, schedule.startsAt]);
  const generatedTitle = generatedPlanDisplay.title;
  const generatedDescription = generatedPlanDisplay.description;
  const previewTitle = advancedDetails.title.trim() || generatedTitle;
  const previewDescription = advancedDetails.description.trim() || generatedDescription;
  const previewPlan = useMemo(() => ({
    id: 'create-plan-preview',
    ownerId: 'preview',
    title: previewTitle,
    description: previewDescription,
    category: advancedDetails.category.trim() || null,
    tags: parsePlanTagsInput(advancedDetails.tags),
    mode: planModeFromSelectedPlaces(placesForGeneratedDisplay),
    locationLabel: placesForGeneratedDisplay.length === 0 ? null : `${placesForGeneratedDisplay.length} ${placesForGeneratedDisplay.length === 1 ? 'place' : 'places'}`,
    startsAt: schedule.startsAt || new Date().toISOString(),
    endsAt: explicitPlanEnd.endsAt || schedule.endsAt || null,
    joinApprovalMode: 'automatic',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participantCount: 0,
    places: places.map((place, index) => ({
      id: `preview-place-${index}`,
      planId: 'create-plan-preview',
      placeId: place.sourcePlaceId,
      source: place.sourcePlaceId ? (place.sourcePlaceSource === 'hellowhen_library' ? 'hellowhen_library' : 'my_place') : 'custom',
      order: index,
      mode: place.mode,
      title: planPreviewPlaceTitle(place, index),
      addressPublicText: place.mode === 'local' ? place.location.trim() || null : null,
      onlineLabel: place.mode === 'remote' ? place.onlineLabel.trim() || place.location.trim() || null : null,
      onlineUrl: place.mode === 'remote' ? place.onlineUrl.trim() || null : null,
      startsAt: schedule.placeStartsAt[index] ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  }) as PlanDto, [advancedDetails.category, advancedDetails.tags, explicitPlanEnd.endsAt, places, placesForGeneratedDisplay, previewDescription, previewTitle, schedule.endsAt, schedule.placeStartsAt, schedule.startsAt]);

  const loadReusablePlaces = useCallback(async () => {
    if (!isPlansVisible()) return;
    setLoadingPlaces(true);
    setError(null);
    try {
      const [mineResponse, libraryResponse] = await Promise.all([api.places.mine({ take: 100 }), api.places.library({ take: 100 })]);
      setMyPlaces(mineResponse.places ?? []);
      setLibraryPlaces(libraryResponse.places ?? []);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoadingPlaces(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadReusablePlaces(); }, [loadReusablePlaces]));


  useEffect(() => {
    const createdPlace = route.params?.createdPlace;
    const createdPlaceNonce = route.params?.createdPlaceNonce;
    if (!createdPlace || !createdPlaceNonce || handledCreatedPlaceNonceRef.current === createdPlaceNonce) return;
    handledCreatedPlaceNonceRef.current = createdPlaceNonce;
    setMyPlaces((current) => [createdPlace, ...current.filter((place) => place.id !== createdPlace.id)]);
    addReusablePlace(createdPlace, route.params?.createdPlaceTargetIndex ?? placeSourceTarget);
    navigation.setParams({ createdPlace: undefined, createdPlaceTargetIndex: undefined, createdPlaceNonce: undefined });
  }, [navigation, placeSourceTarget, route.params?.createdPlace, route.params?.createdPlaceNonce, route.params?.createdPlaceTargetIndex]);

  useEffect(() => {
    const updatedPlace = route.params?.updatedPlace;
    const updatedPlaceNonce = route.params?.updatedPlaceNonce;
    if (!updatedPlace || !updatedPlaceNonce || handledCreatedPlaceNonceRef.current === updatedPlaceNonce) return;
    handledCreatedPlaceNonceRef.current = updatedPlaceNonce;
    setMyPlaces((current) => [updatedPlace, ...current.filter((place) => place.id !== updatedPlace.id)]);
    setPlaces((current) => {
      const targetIndex = route.params?.updatedPlaceTargetIndex;
      if (typeof targetIndex === 'number' && current[targetIndex]) {
        return current.map((item, index) => index === targetIndex ? { ...selectedPlaceFromReusable(updatedPlace, index, item.date || toDateInputValue()), id: item.id, date: item.date, time: item.time } : item);
      }
      return current.map((item, index) => item.sourcePlaceId === updatedPlace.id ? { ...selectedPlaceFromReusable(updatedPlace, index, item.date || toDateInputValue()), id: item.id, date: item.date, time: item.time } : item);
    });
    setMessage('Place updated in this Plan.');
    navigation.setParams({ updatedPlace: undefined, updatedPlaceTargetIndex: undefined, updatedPlaceNonce: undefined });
  }, [navigation, route.params?.updatedPlace, route.params?.updatedPlaceNonce, route.params?.updatedPlaceTargetIndex]);

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  function closePlaceSourceSheet() {
    setPlaceSourceSheetOpen(false);
    setPlacePickerOpen(false);
    setPlaceQuery('');
  }

  function openPlaceSourceSheet(target: PlaceSourceTarget = 'new') {
    setPlaceSourceTarget(target);
    setDetailPlaceIndex(null);
    setPlaceSourceSheetOpen(true);
    setPlacePickerOpen(false);
    setPlaceQuery('');
  }

  function choosePlaceSource(source: PlacePickerTab) {
    setPickerTab(source);
    setPlacePickerOpen(true);
    setPlaceQuery('');
  }

  function addCustomPlace() {
    if (placeSourceTarget === 'new') {
      const nextIndex = places.length;
      setPlaces((current) => [...current, makeSelectedPlanPlace(current.length, current[current.length - 1]?.date || toDateInputValue())]);
      setDetailPlaceIndex(nextIndex);
    } else {
      const targetIndex = placeSourceTarget;
      setPlaces((current) => current.map((item, index) => {
        if (index !== targetIndex) return item;
        return { ...makeSelectedPlanPlace(index, item.date || toDateInputValue()), id: item.id, date: item.date, time: item.time };
      }));
      setDetailPlaceIndex(targetIndex);
    }
    closePlaceSourceSheet();
  }

  function addReusablePlace(place: PlaceDto, explicitTarget: PlaceSourceTarget = placeSourceTarget) {
    if (explicitTarget === 'new') {
      setPlaces((current) => [...current, selectedPlaceFromReusable(place, current.length, current[current.length - 1]?.date || toDateInputValue())]);
    } else {
      const targetIndex = explicitTarget;
      setPlaces((current) => current.map((item, index) => {
        if (index !== targetIndex) return item;
        const next = selectedPlaceFromReusable(place, index, item.date || toDateInputValue());
        return { ...next, id: item.id, date: item.date || next.date, time: item.time || next.time };
      }));
    }
    closePlaceSourceSheet();
    setMessage(null);
    setError(null);
  }

  function updateSelectedPlace(index: number, patch: Partial<SelectedPlanPlaceState>) {
    setPlaces((current) => current.map((place, placeIndex) => placeIndex === index ? { ...place, ...patch } : place));
    setError(null);
  }

  function moveSelectedPlace(index: number, direction: -1 | 1) {
    setPlaces((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const currentPlace = next[index];
      const targetPlace = next[nextIndex];
      if (!currentPlace || !targetPlace) return current;
      next[index] = targetPlace;
      next[nextIndex] = currentPlace;
      return next;
    });
  }

  function editMyPlaceFromDetail(index: number) {
    const place = places[index];
    const savedPlace = place?.sourcePlaceId ? myPlaces.find((item) => item.id === place.sourcePlaceId) : undefined;
    if (!savedPlace) return;
    setDetailPlaceIndex(null);
    navigation.navigate('CreatePlace', { returnToCreatePlan: true, editPlace: savedPlace, targetPlaceIndex: index });
  }

  function copyLibraryPlaceFromDetail(index: number) {
    const place = places[index];
    const libraryPlace = place?.sourcePlaceId ? libraryPlaces.find((item) => item.id === place.sourcePlaceId) : undefined;
    if (!libraryPlace) return;
    setDetailPlaceIndex(null);
    navigation.navigate('CreatePlace', { returnToCreatePlan: true, copyFromPlace: libraryPlace, targetPlaceIndex: index });
  }

  function updateAdvancedDetails(patch: Partial<AdvancedPlanDetailsState>) {
    setAdvancedDetails((current) => ({ ...current, ...patch }));
  }

  function updatePlanEnd(patch: Partial<PlanEndState>) {
    setPlanEnd((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function showPreviewStage() {
    setError(null);
    if (places.length === 0) { setError('Add at least one place before preview.'); return; }
    if (schedule.error) { setError(schedule.error); return; }
    if (explicitPlanEnd.error) { setError(explicitPlanEnd.error); return; }
    setStage('preview');
  }

  async function submit() {
    const usablePlaces = places.filter((place) => place.title.trim() || place.sourcePlaceId);
    const nextSchedule = buildMobilePlanSchedule(usablePlaces);
    const customTitle = advancedDetails.title.trim();
    const customDescription = advancedDetails.description.trim();
    const customCategory = advancedDetails.category.trim();
    const customTags = parsePlanTagsInput(advancedDetails.tags);
    const nextExplicitEnd = parseOptionalMobilePlanEnd(planEnd, nextSchedule.startsAt);
    if (nextSchedule.error || !nextSchedule.startsAt || usablePlaces.length === 0) { setError(nextSchedule.error || 'Add at least one place.'); return; }
    if (nextExplicitEnd.error) { setError(nextExplicitEnd.error); return; }
    if (customTitle && customTitle.length < 3) { setError('Custom Plan title must be at least 3 characters.'); return; }
    if (customDescription && customDescription.length < 10) { setError('Custom Plan description must be at least 10 characters, or leave it empty.'); return; }
    if (customTags.length > 8 || customTags.some((tag) => tag.length > 32)) { setError('Use up to 8 tags, each 32 characters or less.'); return; }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const generatedPlanPayload = buildGeneratedPlanDisplay({
        places: usablePlaces,
        startsAt: nextSchedule.startsAt,
        mode: planModeFromSelectedPlaces(usablePlaces),
        joinApprovalMode: 'automatic',
      });
      const response = await api.plans.create({
        title: customTitle || generatedPlanPayload.title,
        description: customDescription || generatedPlanPayload.description,
        category: customCategory || undefined,
        tags: customTags.length ? customTags : undefined,
        mode: planModeFromSelectedPlaces(usablePlaces),
        startsAt: nextSchedule.startsAt,
        endsAt: nextExplicitEnd.endsAt || nextSchedule.endsAt || nextSchedule.startsAt,
        joinApprovalMode: 'automatic',
        status: 'open',
        places: usablePlaces.map((place, index) => ({
          placeId: place.sourcePlaceId,
          mode: place.mode,
          title: place.title,
          addressPublicText: place.mode === 'local' ? place.location.trim() || undefined : undefined,
          onlineLabel: place.mode === 'remote' ? place.onlineLabel.trim() || placePreviewLocation(place) || undefined : undefined,
          onlineUrl: place.mode === 'remote' ? place.onlineUrl.trim() || undefined : undefined,
          startsAt: nextSchedule.placeStartsAt[index],
          order: index,
        })),
      });
      navigation.replace('PlanDetail', { planId: response.plan.id, title: response.plan.title });
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  const activeList = pickerTab === 'mine' ? filteredMyPlaces : filteredLibraryPlaces;
  const detailPlace = detailPlaceIndex !== null ? places[detailPlaceIndex] : null;

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Create plan" onBack={() => navigation.goBack()} />}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardWrap}>
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.hero, styles.planCreateHero, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
            <SemanticBadge label="Plan" tone="plan" />
            <AppText style={styles.heroTitle}>Create plan</AppText>
            <AppText style={[styles.heroBody, { color: theme.color.muted }]}>Add places, set times, preview.</AppText>
          </View>

          <View style={styles.stageSwitchRow}>
            <PillButton label="Build" active={stage === 'build'} onPress={() => setStage('build')} />
            <PillButton label="Preview" active={stage === 'preview'} onPress={showPreviewStage} />
          </View>

          {stage === 'build' ? (
            <>
              <View style={[styles.timelineDividerBlock, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
                {places.length === 0 ? <EmptyBlock title="No places yet" body="Add your first place to set its date and time." /> : null}
                {places.map((place, index) => (
                  <View key={place.id}>
                    <View style={[styles.planTimelineLineItem, styles.placeTimeLineItem, { borderTopColor: theme.color.border }]}>
                      <View style={styles.timelineCopy}>
                        <SemanticBadge label="Date / time" tone="time" size="sm" />
                        <AppText style={styles.sectionTitle}>Place {index + 1} time</AppText>
                        <AppText style={[styles.metaText, { color: theme.color.muted }]}>{index === 0 ? 'This becomes the Plan start.' : 'Same time or after the previous place.'}</AppText>
                      </View>
                      <View style={styles.twoColumnRow}>
                        <TextField label="Date" value={place.date} onChangeText={(date) => updateSelectedPlace(index, { date })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                        <TextField label="Time" value={place.time} onChangeText={(time) => updateSelectedPlace(index, { time })} placeholder="13:00" keyboardType="numbers-and-punctuation" />
                      </View>
                    </View>
                    <PlaceTimelineRow
                      place={place}
                      index={index}
                      onPress={() => setDetailPlaceIndex(index)}
                    />
                  </View>
                ))}

                <View style={[styles.planTimelineLineItem, styles.planTimelinePlaceAction, { borderTopColor: theme.color.border }]}>
                  <View style={styles.timelineCopy}>
                    <AppText style={styles.sectionTitle}>Add a place</AppText>
                    <AppText style={[styles.metaText, { color: theme.color.muted }]}>Choose the next stop.</AppText>
                  </View>
                  <View style={styles.actionGrid}>
                    <SecondaryButton label="Add place" icon="add" onPress={() => openPlaceSourceSheet('new')} />
                  </View>
                </View>

                <View style={[styles.planTimelineLineItem, { borderTopColor: theme.color.border }]}>
                  <View style={styles.timelineCopy}>
                    <SemanticBadge label="Optional" tone="time" size="sm" />
                    <AppText style={styles.sectionTitle}>End date / time</AppText>
                    <AppText style={[styles.metaText, { color: theme.color.muted }]}>Leave empty to end at the last place.</AppText>
                  </View>
                  <View style={styles.twoColumnRow}>
                    <TextField label="End date" value={planEnd.date} onChangeText={(date) => updatePlanEnd({ date })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                    <TextField label="End time" value={planEnd.time} onChangeText={(time) => updatePlanEnd({ time })} placeholder="Optional" keyboardType="numbers-and-punctuation" />
                  </View>
                </View>
              </View>


              {error ? <InfoNotice tone="warning" title="Check plan" body={error} /> : null}
              <Pressable accessibilityRole="button" onPress={showPreviewStage} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.plan.bg }, pressed && styles.pressed]}>
                <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>Preview Plan</AppText>
              </Pressable>
            </>
          ) : (
            <>
              <View style={[styles.previewConfirmStage, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
                <View style={styles.previewConfirmHero}>
                  <View style={styles.timelineCopy}>
                    <SemanticBadge label="Ready to publish" tone="plan" size="sm" />
                    <AppText style={styles.previewConfirmTitle}>{previewTitle}</AppText>
                    <AppText style={[styles.metaText, { color: theme.semantic.plan.text }]}>{previewDescription}</AppText>
                  </View>
                  <SecondaryButton label="Back to build" onPress={() => setStage('build')} />
                </View>

                <View style={styles.previewSummaryGrid}>
                  <View style={[styles.previewSummaryCell, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
                    <AppText style={[styles.previewSummaryLabel, { color: theme.color.muted }]}>Starts</AppText>
                    <AppText style={styles.previewSummaryValue}>{schedule.startsAt ? formatDate(schedule.startsAt) : 'Not set'}</AppText>
                  </View>
                  <View style={[styles.previewSummaryCell, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
                    <AppText style={[styles.previewSummaryLabel, { color: theme.color.muted }]}>Places</AppText>
                    <AppText style={styles.previewSummaryValue}>{places.length} {places.length === 1 ? 'place' : 'places'}</AppText>
                  </View>
                  <View style={[styles.previewSummaryCell, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
                    <AppText style={[styles.previewSummaryLabel, { color: theme.color.muted }]}>Join mode</AppText>
                    <AppText style={styles.previewSummaryValue}>Free join</AppText>
                  </View>
                  <View style={[styles.previewSummaryCell, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
                    <AppText style={[styles.previewSummaryLabel, { color: theme.color.muted }]}>Visibility</AppText>
                    <AppText style={styles.previewSummaryValue}>Open / Public</AppText>
                  </View>
                </View>

                <View style={[styles.previewSectionDivider, { borderTopColor: theme.color.border }]}>
                  <View style={styles.timelineCopy}>
                    <SemanticBadge label="Feed deck preview" tone="plan" size="sm" />
                    <AppText style={[styles.metaText, { color: theme.color.muted }]}>Feed deck preview.</AppText>
                  </View>
                  <PlanSquareDeck plan={previewPlan} />
                </View>

                <View style={[styles.previewSectionDivider, { borderTopColor: theme.color.border }]}>
                  <View style={styles.timelineCopy}>
                    <SemanticBadge label="Place order" tone="place" size="sm" />
                    <AppText style={[styles.metaText, { color: theme.color.muted }]}>Order and times.</AppText>
                  </View>
                  {places.map((place, index) => (
                    <View key={`preview-${place.id}`} style={[styles.previewPlaceRow, { borderTopColor: theme.color.border }]}>
                      <View style={[styles.timelineNumber, { backgroundColor: theme.semantic.place.softBg }]}>
                        <AppText style={[styles.timelineNumberText, { color: theme.semantic.place.text }]}>{index + 1}</AppText>
                      </View>
                      <View style={styles.timelineCopy}>
                        <AppText style={styles.rowTitle}>{planPreviewPlaceTitle(place, index)}</AppText>
                        <AppText style={[styles.metaText, { color: theme.color.muted }]}>{planPreviewTimeLabel(place)} · {placePreviewLocation(place)}</AppText>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={[styles.previewFinalNote, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
                  <SemanticBadge label="Confirm" tone="plan" size="sm" />
                  <AppText style={[styles.metaText, { color: theme.semantic.plan.text }]}>This creates an open public Plan with free join. You can still go back before publishing.</AppText>
                </View>

                {schedule.error && places.length > 0 ? <InfoNotice tone="warning" title="Schedule check" body={schedule.error} /> : null}
                {explicitPlanEnd.error ? <InfoNotice tone="warning" title="End time" body={explicitPlanEnd.error} /> : null}
              </View>

              {message ? <InfoNotice tone="success" title="Plans" body={message} /> : null}
              {error ? <InfoNotice tone="warning" title="Could not save" body={error} /> : null}
              <View style={styles.actionGrid}>
                <SecondaryButton label="Back" onPress={() => setStage('build')} />
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void submit(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.plan.bg, flex: 1 }, pressed && styles.pressed, saving && styles.disabled]}>
                  <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{saving ? 'Creating...' : 'Create Plan'}</AppText>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
        <Modal visible={Boolean(detailPlace)} transparent animationType="slide" onRequestClose={() => setDetailPlaceIndex(null)}>
          <View style={styles.sourceSheetOverlay}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close place details" onPress={() => setDetailPlaceIndex(null)} style={styles.sourceSheetScrim} />
            {detailPlace && detailPlaceIndex !== null ? (
              <View style={[styles.sourceSheet, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
                <View style={styles.wizardStepRow}>
                  <View style={styles.timelineCopy}>
                    <AppText style={styles.sectionTitle}>Place {detailPlaceIndex + 1}</AppText>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setDetailPlaceIndex(null)} style={[styles.headerAction, { borderColor: theme.color.border }]}>
                    <MobileIcon name="close" color={theme.color.text} size={18} />
                  </Pressable>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" style={styles.sourceListScroll} contentContainerStyle={styles.placeDetailSheetContent}>
                  <View style={styles.rowTop}>
                    {detailPlace.sourcePlaceId ? <SemanticBadge label={detailPlace.sourcePlaceSource === 'hellowhen_library' ? 'Library' : 'My Place'} tone="place" size="sm" /> : <SemanticBadge label="Custom" tone="place" size="sm" />}
                  </View>
                  {detailPlace.sourcePlaceId ? (
                    <View style={[styles.snapshotStrip, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}>
                      <AppText style={[styles.snapshotText, { color: theme.semantic.place.text }]} numberOfLines={3}>
                        {detailPlace.sourcePlaceSource === 'my_place' ? 'Updates your saved Place.' : 'Copied into My Places before editing.'}
                      </AppText>
                      {detailPlace.sourcePlaceSource === 'my_place' ? <SecondaryButton label="Edit saved" onPress={() => editMyPlaceFromDetail(detailPlaceIndex)} /> : null}
                      {detailPlace.sourcePlaceSource === 'hellowhen_library' ? <SecondaryButton label="Copy to edit" onPress={() => copyLibraryPlaceFromDetail(detailPlaceIndex)} /> : null}
                      <SecondaryButton label="Make custom" onPress={() => updateSelectedPlace(detailPlaceIndex, resetSelectedPlaceToCustom(detailPlace))} />
                    </View>
                  ) : (
                    <>
                      <ModeSegment value={detailPlace.mode} onChange={(mode) => updateSelectedPlace(detailPlaceIndex, { mode, location: mode === 'remote' ? '' : detailPlace.location })} />
                      <TextField label="Place name" value={detailPlace.title} onChangeText={(title) => updateSelectedPlace(detailPlaceIndex, { title })} placeholder={detailPlace.mode === 'remote' ? 'Planning call' : 'Coffee meeting point'} maxLength={120} />
                      {detailPlace.mode === 'remote' ? (
                        <>
                          <TextField label="Online label" value={detailPlace.onlineLabel} onChangeText={(onlineLabel) => updateSelectedPlace(detailPlaceIndex, { onlineLabel })} placeholder="Zoom, Discord, website" maxLength={120} />
                          <TextField label="Online URL" value={detailPlace.onlineUrl} onChangeText={(onlineUrl) => updateSelectedPlace(detailPlaceIndex, { onlineUrl })} placeholder="https://..." keyboardType="url" maxLength={500} />
                        </>
                      ) : (
                        <TextField label="Address or meeting point" value={detailPlace.location} onChangeText={(location) => updateSelectedPlace(detailPlaceIndex, { location })} placeholder="Paris 11 or a public meeting point" maxLength={240} />
                      )}
                    </>
                  )}
                  <View style={styles.actionGrid}>
                    <SecondaryButton label="Move up" disabled={detailPlaceIndex === 0} onPress={() => { moveSelectedPlace(detailPlaceIndex, -1); setDetailPlaceIndex(detailPlaceIndex - 1); }} />
                    <SecondaryButton label="Move down" disabled={detailPlaceIndex === places.length - 1} onPress={() => { moveSelectedPlace(detailPlaceIndex, 1); setDetailPlaceIndex(detailPlaceIndex + 1); }} />
                    <SecondaryButton label="Change place" onPress={() => openPlaceSourceSheet(detailPlaceIndex)} />
                    <SecondaryButton label="Remove" icon="close" onPress={() => { setPlaces((current) => current.filter((_, placeIndex) => placeIndex !== detailPlaceIndex)); setDetailPlaceIndex(null); }} />
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => setDetailPlaceIndex(null)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
                    <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>Done</AppText>
                  </Pressable>
                </ScrollView>
              </View>
            ) : null}
          </View>
        </Modal>
        <Modal visible={placeSourceSheetOpen} transparent animationType="slide" onRequestClose={closePlaceSourceSheet}>
          <View style={styles.sourceSheetOverlay}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close place source" onPress={closePlaceSourceSheet} style={styles.sourceSheetScrim} />
            <View style={[styles.sourceSheet, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
              <View style={styles.wizardStepRow}>
                <View style={styles.timelineCopy}>
                  <AppText style={styles.sectionTitle}>{placePickerOpen ? (pickerTab === 'mine' ? 'My Places' : 'Hellowhen Library') : 'Add place'}</AppText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closePlaceSourceSheet} style={[styles.headerAction, { borderColor: theme.color.border }]}>
                  <MobileIcon name="close" color={theme.color.text} size={18} />
                </Pressable>
              </View>

              {!placePickerOpen ? (
                <View style={styles.sourceOptionList}>
                  <Pressable accessibilityRole="button" onPress={() => choosePlaceSource('mine')} style={({ pressed }) => [styles.sourceOption, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }, pressed && styles.pressed]}>
                    <View style={[styles.sourceOptionIcon, { backgroundColor: theme.color.surface, borderColor: theme.semantic.place.border }]}><MobileIcon name="save" color={theme.semantic.place.text} size={19} /></View>
                    <View style={styles.timelineCopy}><AppText style={styles.sourceOptionTitle}>My Places</AppText><AppText style={[styles.metaText, { color: theme.color.muted }]}>Saved places you created.</AppText></View>
                    <MobileIcon name="chevron-right" color={theme.color.muted} size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => choosePlaceSource('library')} style={({ pressed }) => [styles.sourceOption, { backgroundColor: theme.color.surface, borderColor: theme.semantic.place.border }, pressed && styles.pressed]}>
                    <View style={[styles.sourceOptionIcon, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}><MobileIcon name="search" color={theme.semantic.place.text} size={19} /></View>
                    <View style={styles.timelineCopy}><AppText style={styles.sourceOptionTitle}>Hellowhen Library</AppText><AppText style={[styles.metaText, { color: theme.color.muted }]}>Reusable place templates.</AppText></View>
                    <MobileIcon name="chevron-right" color={theme.color.muted} size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => { closePlaceSourceSheet(); navigation.navigate('CreatePlace', { returnToCreatePlan: true, targetPlaceIndex: typeof placeSourceTarget === 'number' ? placeSourceTarget : undefined }); }} style={({ pressed }) => [styles.sourceOption, { backgroundColor: theme.color.surface, borderColor: theme.semantic.place.border }, pressed && styles.pressed]}>
                    <View style={[styles.sourceOptionIcon, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}><MobileIcon name="add" color={theme.semantic.place.text} size={19} /></View>
                    <View style={styles.timelineCopy}><AppText style={styles.sourceOptionTitle}>New Place</AppText><AppText style={[styles.metaText, { color: theme.color.muted }]}>Save and return here.</AppText></View>
                    <MobileIcon name="chevron-right" color={theme.color.muted} size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={addCustomPlace} style={({ pressed }) => [styles.sourceOption, { backgroundColor: theme.color.surface, borderColor: theme.semantic.place.border }, pressed && styles.pressed]}>
                    <View style={[styles.sourceOptionIcon, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}><MobileIcon name="more" color={theme.semantic.place.text} size={19} /></View>
                    <View style={styles.timelineCopy}><AppText style={styles.sourceOptionTitle}>Custom stop</AppText><AppText style={[styles.metaText, { color: theme.color.muted }]}>Only for this Plan.</AppText></View>
                    <MobileIcon name="chevron-right" color={theme.color.muted} size={18} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.sourceOptionList}>
                  <View style={styles.filterRow}>
                    <PillButton label="My Places" active={pickerTab === 'mine'} onPress={() => choosePlaceSource('mine')} />
                    <PillButton label="Hellowhen Library" active={pickerTab === 'library'} onPress={() => choosePlaceSource('library')} />
                    <PillButton label="Refresh" onPress={() => { void loadReusablePlaces(); }} />
                  </View>
                  <TextField label="Search Places" value={placeQuery} onChangeText={setPlaceQuery} placeholder="Search Places" />
                  {loadingPlaces ? <View style={styles.inlineSmallLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Places...</AppText></View> : null}
                  {!loadingPlaces && activeList.length === 0 ? <EmptyBlock title="No matching Places" body={pickerTab === 'mine' ? 'Create a Place or use a custom stop.' : 'No matching Library Places yet.'} /> : null}
                  <ScrollView style={styles.sourceListScroll} keyboardShouldPersistTaps="handled">
                    {activeList.map((place) => <PlaceChoiceCard key={place.id} place={place} onAdd={() => addReusablePlace(place)} />)}
                  </ScrollView>
                  <SecondaryButton label="Sources" onPress={() => setPlacePickerOpen(false)} />
                </View>
              )}
            </View>
          </View>
        </Modal>
        <KeyboardDoneAccessory />
      </KeyboardAvoidingView>
    </AppFixedHeaderScreen>
  );
}

export function CreatePlaceScreen({ navigation, route }: SimpleScreenProps<'CreatePlace'>) {
  const theme = useThemeTokens();
  const editPlace = route.params?.editPlace;
  const copyFromPlace = route.params?.copyFromPlace;
  const isEditing = Boolean(editPlace);
  const [state, setState] = useState<PlaceCreateFormState>(() => editPlace ? placeCreateFormFromPlace(editPlace) : copyFromPlace ? placeCreateFormFromPlace(copyFromPlace) : makePlaceCreateForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  async function submit() {
    if (state.title.trim().length < 3) { setError('Add a Place name.'); return; }
    const translationError = validatePlaceTranslations(state);
    if (translationError) { setError(translationError); return; }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body = {
        mode: state.mode,
        title: state.title,
        description: state.description.trim() || undefined,
        defaultLanguage: state.defaultLanguage,
        translations: normalizePlaceTranslationsForPayload(state),
        visibility: 'private' as const,
        status: 'active' as const,
        addressPublicText: state.mode === 'local' ? state.location.trim() || undefined : undefined,
        onlineLabel: state.mode === 'remote' ? state.onlineLabel.trim() || undefined : undefined,
        onlineUrl: state.mode === 'remote' ? state.onlineUrl.trim() || undefined : undefined,
      };
      const response = isEditing && editPlace ? await api.places.update(editPlace.id, body) : await api.places.create(body);
      if (route.params?.returnToCreatePlan) {
        if (isEditing) {
          navigation.navigate('CreatePlan', { updatedPlace: response.place, updatedPlaceTargetIndex: route.params.targetPlaceIndex, updatedPlaceNonce: Date.now() });
        } else {
          navigation.navigate('CreatePlan', { createdPlace: response.place, createdPlaceTargetIndex: route.params.targetPlaceIndex, createdPlaceNonce: Date.now() });
        }
        return;
      }
      setMessage(isEditing ? `${response.place.title} was updated.` : `${response.place.title} was saved to My Places.`);
      if (!isEditing) setState(makePlaceCreateForm());
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title={isEditing ? 'Edit place' : 'Create place'} onBack={() => navigation.goBack()} rightSlot={<HeaderAction icon="save" label="My Places" onPress={() => navigation.navigate('MyPlaces')} />} />}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardWrap}>
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.hero, styles.placeCreateHero, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}>
            <SemanticBadge label="My Place" tone="place" />
            <AppText style={styles.heroTitle}>{isEditing ? 'Edit Place' : 'Create Place'}</AppText>
            <AppText style={[styles.heroBody, { color: theme.semantic.place.text }]}>{isEditing ? 'Update your reusable Place for future Plans.' : copyFromPlace ? 'Save a private copy, then return to your Plan.' : 'Save an offline or online Place for Plans.'}</AppText>
          </View>
          <View style={[styles.formCard, styles.placeCreateFormCard, { backgroundColor: theme.color.surface, borderColor: theme.semantic.place.border }]}>
            <ModeSegment value={state.mode} onChange={(mode) => setState((current) => ({ ...current, mode }))} />
            <TextField label="Place name" value={state.title} onChangeText={(title) => setState((current) => ({ ...current, title }))} placeholder="Quiet coffee near République" maxLength={120} />
            {state.mode === 'remote' ? (
              <>
                <TextField label="Online label" value={state.onlineLabel} onChangeText={(onlineLabel) => setState((current) => ({ ...current, onlineLabel }))} placeholder="Zoom, Discord, website" maxLength={120} />
                <TextField label="Online URL" value={state.onlineUrl} onChangeText={(onlineUrl) => setState((current) => ({ ...current, onlineUrl }))} placeholder="https://..." keyboardType="url" maxLength={500} />
              </>
            ) : (
              <TextField label="Area / address" value={state.location} onChangeText={(location) => setState((current) => ({ ...current, location }))} placeholder="Paris 11 or a public meeting point" maxLength={240} />
            )}
            <TextField label="Description" value={state.description} onChangeText={(description) => setState((current) => ({ ...current, description }))} placeholder="Describe this place for later Plans." multiline maxLength={2000} />
            <View style={styles.placeTranslationBlock}>
              <AppText style={styles.formLabel}>Original language</AppText>
              <View style={styles.filterRow}>
                {placeLanguageOptions.map((languageCode) => (
                  <PillButton
                    key={languageCode}
                    label={placeLanguageLabel(languageCode)}
                    active={state.defaultLanguage === languageCode}
                    onPress={() => setState((current) => ({ ...current, defaultLanguage: languageCode, translations: current.translations.filter((translation) => translation.languageCode !== languageCode) }))}
                  />
                ))}
              </View>
              {state.translations.map((translation) => (
                <View key={translation.languageCode} style={[styles.placeTranslationFields, { borderColor: theme.semantic.place.border, backgroundColor: theme.semantic.place.softBg }]}>
                  <View style={styles.feedHeader}>
                    <View style={styles.feedTitleWrap}>
                      <AppText style={styles.formLabel}>{placeLanguageLabel(translation.languageCode)} translation</AppText>
                      <AppText style={[styles.metaText, { color: theme.color.muted }]}>Translate the Place name and description.</AppText>
                    </View>
                    <Pressable accessibilityRole="button" onPress={() => setState((current) => removePlaceTranslationDraft(current, translation.languageCode))} style={({ pressed }) => [styles.pillButton, { borderColor: theme.semantic.danger.border, backgroundColor: theme.color.surface }, pressed && styles.pressed]}>
                      <AppText style={[styles.pillButtonText, { color: theme.semantic.danger.text }]}>Remove</AppText>
                    </Pressable>
                  </View>
                  <TextField label="Translated Place name" value={translation.title} onChangeText={(title) => setState((current) => updatePlaceTranslationDraft(current, { ...translation, title }))} placeholder="Translated place name" maxLength={120} />
                  <TextField label="Translated description" value={translation.description} onChangeText={(description) => setState((current) => updatePlaceTranslationDraft(current, { ...translation, description }))} placeholder="Translated description" multiline maxLength={2000} />
                </View>
              ))}
              {nextPlaceTranslationLanguage(state) ? (
                <SecondaryButton label={state.translations.length ? 'Add another language' : 'Add language'} onPress={() => setState(addPlaceTranslationDraft)} />
              ) : null}
            </View>
            {message ? <InfoNotice tone="success" title="Place saved" body={message} /> : null}
            {error ? <InfoNotice tone="warning" title="Could not save Place" body={error} /> : null}
            <Pressable accessibilityRole="button" disabled={saving || state.title.trim().length < 3} onPress={() => { void submit(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.place.bg }, pressed && styles.pressed, (saving || state.title.trim().length < 3) && styles.disabled]}>
              <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{saving ? 'Saving...' : route.params?.returnToCreatePlan ? isEditing ? 'Update and return to Plan' : 'Save and return to Plan' : isEditing ? 'Update Place' : 'Save Place'}</AppText>
            </Pressable>
          </View>
        </ScrollView>
        <KeyboardDoneAccessory />
      </KeyboardAvoidingView>
    </AppFixedHeaderScreen>
  );
}

const styles = StyleSheet.create({
  bodyWrap: { flex: 1, minHeight: 0, gap: 10 },
  contentPad: { paddingVertical: 12 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  largeIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  centerTitle: { fontSize: 25, fontWeight: '900', textAlign: 'center', letterSpacing: -0.4 },
  centerBody: { textAlign: 'center', lineHeight: 21, fontWeight: '700' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  feedTitleWrap: { flex: 1, gap: 6 },
  feedTitle: { fontSize: 35, lineHeight: 40, fontWeight: '900', letterSpacing: -1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAction: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  filterChipText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  filterNotice: { borderRadius: 22, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 11, alignItems: 'center' },
  menuPanel: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  menuItem: { minHeight: 70, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  menuIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, minWidth: 0, gap: 2 },
  menuTitle: { fontSize: 16, fontWeight: '900' },
  menuBody: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  listContent: { gap: 12, paddingBottom: 34 },
  stageSwitchRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  timelineDividerBlock: { gap: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  planTimelineLineItem: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 16, gap: 12 },
  placeTimeLineItem: { paddingBottom: 12 },
  planTimelinePlaceAction: { paddingVertical: 18 },
  placeTimelineRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeDetailSheetContent: { gap: 10, paddingBottom: 12 },
  placePickerPanel: { gap: 10 },
  sourceSheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sourceSheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  sourceSheet: { maxHeight: '86%', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24, gap: 10 },
  sourceOptionList: { gap: 0 },
  sourceOption: { minHeight: 62, borderRadius: 0, borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 0, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sourceOptionIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sourceOptionTitle: { fontSize: 15, fontWeight: '900' },
  sourceListScroll: { maxHeight: 340 },
  deckFeedContent: { gap: 20, paddingTop: 2, paddingBottom: 34 },
  deckSection: { gap: 10 },
  deckSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 2 },
  deckSectionCopy: { flex: 1, minWidth: 0, gap: 2 },
  deckSectionTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.3 },
  deckSectionMeta: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  inlineLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontWeight: '800' },
  rowCard: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 9 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  rowTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.3 },
  rowBody: { lineHeight: 20, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  placePreview: { fontSize: 13, fontWeight: '900' },
  emptyBlock: { borderRadius: 24, borderWidth: 1, alignItems: 'center', padding: 22, gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  emptyBody: { textAlign: 'center', lineHeight: 21, fontWeight: '700' },
  primaryButton: { minHeight: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 13, alignSelf: 'stretch' },
  primaryButtonText: { fontWeight: '900' },
  hero: { borderRadius: 28, borderWidth: 1, padding: 18, gap: 12 },
  planCreateHero: { borderRadius: 24 },
  placeCreateHero: { borderRadius: 24 },
  heroTitle: { fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.9 },
  heroBody: { lineHeight: 21, fontWeight: '700' },
  detailContent: { gap: 14, paddingBottom: 34 },
  detailMetaStack: { gap: 8 },
  detailActionStack: { gap: 10 },
  statGrid: { flexDirection: 'row', gap: 8 },
  statPill: { flex: 1, borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 11, gap: 2 },
  statValue: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  statLabel: { fontSize: 11, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.45 },
  joinedState: { minHeight: 46, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  joinedStateText: { fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 13, alignSelf: 'stretch' },
  secondaryButtonText: { fontWeight: '900' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  wizardStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 },
  sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  timelineRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  timelineRail: { alignItems: 'center', width: 34 },
  timelineCard: { flex: 1, borderRadius: 24, borderWidth: 1, padding: 14, gap: 12 },
  timelineCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  timelineMedia: { width: 62, height: 62, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  timelineImage: { width: '100%', height: '100%' },
  timelineNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  timelineNumberText: { fontSize: 13, fontWeight: '900' },
  timelineLine: { flex: 1, width: 2, marginTop: 6, borderRadius: 999 },
  timelineCopy: { flex: 1, gap: 7, minWidth: 0 },
  detailSection: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 12 },
  detailSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  detailSectionCopy: { flex: 1, gap: 5 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  participantAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  participantInitial: { fontSize: 14, fontWeight: '900' },
  participantCopy: { flex: 1, gap: 2 },
  participantName: { fontSize: 15, fontWeight: '900' },
  participantStatus: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  keyboardWrap: { flex: 1, minHeight: 0 },
  inlineSmallLoading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  formCard: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 13 },
  placeCreateFormCard: { borderRadius: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, paddingHorizontal: 0 },
  placeTranslationBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, gap: 10 },
  placeTranslationFields: { borderRadius: 22, borderWidth: 1, padding: 12, gap: 10 },
  formField: { gap: 7, flex: 1, minWidth: 0 },
  formLabel: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, fontWeight: '700' },
  textArea: { minHeight: 104, lineHeight: 20 },
  modeSegment: { borderRadius: 18, borderWidth: 1, padding: 4, flexDirection: 'row', gap: 4 },
  modeSegmentButton: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  modeSegmentText: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  pillButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  pillButtonText: { fontSize: 12, fontWeight: '900' },
  choiceCard: { borderRadius: 22, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  choiceIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1, minWidth: 0, gap: 5 },
  choiceTitle: { fontSize: 17, lineHeight: 21, fontWeight: '900' },
  choiceMeta: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  addMini: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  placeEditorCard: { borderRadius: 0, borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 15, gap: 12 },
  placeEditorHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  smallButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  snapshotStrip: { borderRadius: 18, borderWidth: 1, padding: 11, gap: 8 },
  snapshotText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  twoColumnRow: { flexDirection: 'row', gap: 10 },
  timeCard: { borderRadius: 22, borderWidth: 1, padding: 12, gap: 11 },
  timeCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  advancedCard: { borderRadius: 0, borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, gap: 10 },
  advancedToggle: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  advancedPanel: { gap: 12, paddingTop: 2 },
  previewCard: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 12 },
  previewConfirmStage: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, gap: 16, paddingVertical: 14 },
  previewConfirmHero: { gap: 12 },
  previewConfirmTitle: { fontSize: 31, lineHeight: 34, fontWeight: '900', letterSpacing: -0.9 },
  previewSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewSummaryCell: { width: '48%', minHeight: 74, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'center', gap: 4, paddingVertical: 9 },
  previewSummaryLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewSummaryValue: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  previewSectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 12 },
  previewPlaceRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  previewFinalNote: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 8 },
  supportSection: { marginTop: 2 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
