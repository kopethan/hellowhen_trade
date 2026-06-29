import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, TextInput, View, type ImageStyle } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DiscoveryLanguage, GooglePlacePrediction, GoogleResolvedPlace, InventoryTranslationDto, ListPlansQuery, MediaAssetDto, PlaceDto, PlacePresenceVerificationResponse, PlanDto, PlanParticipantDto, PlanPlaceDto, PlanPlaceMode } from '@hellowhen/contracts';
import { buildGeneratedPlanDisplay, buildPlanFeedItems, getNormalWorkspaceMenuItems, mergeRecentStarterPlanIdeaIds, parseStarterPlanIdeaKey, selectStarterPlanIdeaKeys, starterPlanIdeas, starterPlanIdeaMode, type NormalWorkspaceMenuItem, type StarterPlanIdea, type StarterPlanIdeaKey, type StarterPlanIdeaStop } from '@hellowhen/shared';
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
import { buildPublicPlanUrl } from '../../lib/publicUrls';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { resolveMediaUrl } from '../trade/mediaUrls';
import { ImagePickerField } from '../trade/components/ImagePickerField';
import type { SelectedLocalImage, SelectedImageUploadProgress } from '../trade/mediaUpload';
import { SelectedImageUploadError, uploadSelectedImages } from '../trade/mediaUpload';
import { PlanSquareDeck } from './components/PlanSquareDeck';

type PlansScreenProps = NativeStackScreenProps<RootStackParamList, 'Plans'>;
type PlanDetailProps = NativeStackScreenProps<RootStackParamList, 'PlanDetail'>;
type PlanIdeaDetailProps = NativeStackScreenProps<RootStackParamList, 'PlanIdeaDetail'>;
type SimpleScreenProps<RouteName extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, RouteName>;
type PlanListScope = 'feed' | 'mine' | 'joined';
type PlaceListScope = 'mine' | 'library';

type PlanFilterOption = { label: string; value: string; body?: string };
type PlanFilterGroup = { title: string; body: string; options: PlanFilterOption[] };

const planFilterGroups: PlanFilterGroup[] = [
  { title: 'Status', body: 'Choose which public Plan states should appear.', options: [
    { label: 'Open', value: 'status:open', body: 'Available to join' },
    { label: 'Full', value: 'status:full', body: 'Capacity reached' },
    { label: 'Started', value: 'status:started', body: 'Already underway' },
  ] },
  { title: 'Mode', body: 'Match the way the Plan happens.', options: [
    { label: 'Local / offline', value: 'mode:local', body: 'Meet in person' },
    { label: 'Online', value: 'mode:remote', body: 'Remote or link-based' },
  ] },
  { title: 'Join', body: 'Surface Plans that can be joined freely.', options: [
    { label: 'Free join', value: 'join:automatic', body: 'No approval request first' },
  ] },
  { title: 'Places', body: 'Filter by route size.', options: [
    { label: '1 place', value: 'places:one', body: 'Simple single stop' },
    { label: '2+ places', value: 'places:multiple', body: 'A route or sequence' },
  ] },
  { title: 'Time', body: 'Pick when the Plan starts.', options: [
    { label: 'Today', value: 'time:today' },
    { label: 'This week', value: 'time:week' },
    { label: 'This month', value: 'time:month' },
  ] },
];

function toggleFilterValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

type PlanFilterRouteParams = { filters?: string[]; q?: string };

type PlanFilterKey = 'status' | 'mode' | 'join' | 'places' | 'time';

const planFilterKeys: PlanFilterKey[] = ['status', 'mode', 'join', 'places', 'time'];
const allowedPlanFilterValues = new Set(planFilterGroups.flatMap((group) => group.options.map((option) => option.value)));

function normalizePlanFilters(values?: string[] | null) {
  if (!Array.isArray(values)) return [];
  const normalized: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string' || !allowedPlanFilterValues.has(value) || normalized.includes(value)) continue;
    normalized.push(value);
  }
  return normalized;
}

function normalizePlanSearchQuery(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function activePlanFilterCount(filters: string[], query?: string | null) {
  return filters.length + (normalizePlanSearchQuery(query) ? 1 : 0);
}

function planFilterValues(filters: string[], key: PlanFilterKey) {
  return filters
    .map((value) => {
      const [filterKey, filterValue] = value.split(':');
      return filterKey === key ? filterValue : null;
    })
    .filter((value): value is string => Boolean(value));
}

function buildPlanFeedQuery(filters: string[], searchQuery?: string | null): ListPlansQuery {
  const normalizedQuery = normalizePlanSearchQuery(searchQuery);
  const query: ListPlansQuery = { take: filters.length || normalizedQuery ? 100 : 50 };
  if (normalizedQuery) query.q = normalizedQuery;
  const statuses = planFilterValues(filters, 'status');
  const modes = planFilterValues(filters, 'mode');
  if (statuses.length === 1) query.status = statuses[0] as ListPlansQuery['status'];
  if (modes.length === 1) query.mode = modes[0] as ListPlansQuery['mode'];
  return query;
}

function sameLocalDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function isWithinNextDays(date: Date, days: number) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + days);
  return date.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() && date.getTime() <= end.getTime();
}

function planMatchesTimeFilter(plan: PlanDto, values: string[]) {
  if (!values.length) return true;
  const date = new Date(plan.startsAt);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return values.some((value) => {
    if (value === 'today') return sameLocalDate(date, now);
    if (value === 'week') return isWithinNextDays(date, 6);
    if (value === 'month') return date.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    return true;
  });
}

function planMatchesSearch(plan: PlanDto, query?: string | null) {
  const normalizedQuery = normalizePlanSearchQuery(query).toLowerCase();
  if (!normalizedQuery) return true;
  const searchable = [
    plan.title,
    plan.description,
    plan.category,
    plan.locationLabel,
    ...(plan.tags ?? []),
    ...(plan.places ?? []).flatMap((place) => [place.title, place.note, place.addressPublicText, place.onlineLabel, place.onlineUrl]),
  ].filter(Boolean).join(' ').toLowerCase();
  return searchable.includes(normalizedQuery);
}

function applyPlanFilters(plans: PlanDto[], filters: string[], query?: string | null) {
  const statuses = planFilterValues(filters, 'status');
  const modes = planFilterValues(filters, 'mode');
  const joinModes = planFilterValues(filters, 'join');
  const placeCounts = planFilterValues(filters, 'places');
  const timeFilters = planFilterValues(filters, 'time');
  return plans.filter((plan) => {
    if (!planMatchesSearch(plan, query)) return false;
    if (statuses.length && !statuses.includes(plan.status)) return false;
    if (modes.length && (!plan.mode || !modes.includes(plan.mode))) return false;
    if (joinModes.includes('automatic') && plan.joinApprovalMode !== 'automatic') return false;
    if (placeCounts.length) {
      const count = plan.places?.length ?? 0;
      const placeMatch = placeCounts.some((value) => value === 'one' ? count === 1 : value === 'multiple' ? count >= 2 : true);
      if (!placeMatch) return false;
    }
    if (!planMatchesTimeFilter(plan, timeFilters)) return false;
    return true;
  });
}

function filterSummary(filters: string[], query?: string | null) {
  const normalizedQuery = normalizePlanSearchQuery(query);
  if (!filters.length && !normalizedQuery) return '';
  const parts = planFilterKeys.map((key) => {
    const count = planFilterValues(filters, key).length;
    return count ? `${count} ${key}` : '';
  }).filter(Boolean);
  if (normalizedQuery) parts.unshift(`Search: “${normalizedQuery}”`);
  return parts.join(' · ');
}

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

const RECENT_PLAN_IDEA_STORAGE_KEY = 'hellowhen_recent_plan_ideas_v1';
const ANONYMOUS_PLAN_IDEA_STORAGE_KEY = 'hellowhen_plan_idea_anon_key_v1';

function createAnonymousPlanIdeaKey() {
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function planIdeaPreviewPlan(idea: StarterPlanIdea): PlanDto {
  const createdAt = new Date().toISOString();
  return {
    id: `starter-plan-idea-${idea.id}`,
    ownerId: 'starter-plan-idea',
    title: idea.title,
    description: idea.description,
    category: idea.category,
    tags: idea.tags,
    mode: starterPlanIdeaMode(idea),
    locationLabel: `${idea.stops.length} starter stops`,
    startsAt: createdAt,
    endsAt: null,
    maxParticipants: null,
    joinApprovalMode: 'automatic',
    status: 'open',
    createdAt,
    updatedAt: createdAt,
    participantCount: 0,
    places: idea.stops.map((stop, index) => ({
      id: `starter-plan-idea-${idea.id}-place-${index}`,
      planId: `starter-plan-idea-${idea.id}`,
      placeId: null,
      source: 'custom',
      order: index,
      mode: stop.mode,
      title: stop.title,
      note: null,
      addressPublicText: stop.mode === 'local' ? stop.location ?? null : null,
      addressPrivateText: null,
      onlineLabel: stop.mode === 'remote' ? stop.onlineLabel ?? null : null,
      onlineUrl: stop.mode === 'remote' ? stop.onlineUrl ?? null : null,
      startsAt: null,
      endsAt: null,
      createdAt,
      updatedAt: createdAt,
      media: [],
    })),
  } as PlanDto;
}

function selectedPlaceFromPlanIdeaStop(stop: StarterPlanIdeaStop, index: number, date = toDateInputValue()): SelectedPlanPlaceState {
  return {
    id: `mobile-plan-idea-place-${Date.now()}-${index}`,
    sourcePlaceSource: 'custom',
    mode: stop.mode,
    date,
    time: stop.time,
    title: stop.title,
    location: stop.mode === 'local' ? stop.location ?? '' : '',
    onlineLabel: stop.mode === 'remote' ? stop.onlineLabel ?? '' : '',
    onlineUrl: stop.mode === 'remote' ? stop.onlineUrl ?? '' : '',
    existingMedia: null,
  };
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
  existingMedia?: MediaAssetDto | null;
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
type PlaceCreateStep = 'details' | 'image';

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
    existingMedia: null,
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

function availablePlaceTranslationLanguages(state: PlaceCreateFormState) {
  const used = new Set([state.defaultLanguage, ...state.translations.map((translation) => translation.languageCode)]);
  return placeLanguageOptions.filter((language) => !used.has(language));
}

function addPlaceTranslationDraft(state: PlaceCreateFormState, languageCode: DiscoveryLanguage): PlaceCreateFormState {
  if (!availablePlaceTranslationLanguages(state).includes(languageCode)) return state;
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

function placeTranslationSummary(state: PlaceCreateFormState) {
  const draftCount = state.translations.length;
  if (!draftCount) return `Original: ${placeLanguageLabel(state.defaultLanguage)} · Optional`;
  return `Original: ${placeLanguageLabel(state.defaultLanguage)} · ${draftCount} translation${draftCount === 1 ? '' : 's'}`;
}

function placeHasTranslationContent(place?: PlaceDto | null) {
  return Boolean((place?.translations ?? []).some((translation) => (translation.title ?? '').trim() || (translation.description ?? '').trim()));
}

function makePlaceCreateForm(defaultLanguage: DiscoveryLanguage = 'en'): PlaceCreateFormState {
  return {
    mode: 'local',
    title: '',
    description: '',
    defaultLanguage,
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
    existingMedia: activeMedia(place.media)[0] ?? null,
  };
}

function selectedPlaceMediaIds(place: SelectedPlanPlaceState) {
  return place.existingMedia?.id ? [place.existingMedia.id] : undefined;
}

function resetSelectedPlaceToCustom(place: SelectedPlanPlaceState): SelectedPlanPlaceState {
  return {
    ...place,
    sourcePlaceId: undefined,
    sourcePlaceSource: 'custom',
    sourcePlaceTitle: undefined,
    existingMedia: null,
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

function getPlanModeLabel(plan: PlanDto) {
  if (plan.mode === 'remote') return 'Online';
  if (plan.mode === 'local') return 'Local';
  if (plan.mode === 'hybrid') return 'Local/Online';
  const places = plan.places ?? [];
  const hasRemote = places.some((place) => place.mode === 'remote');
  const hasLocal = places.some((place) => place.mode !== 'remote');
  if (hasRemote && hasLocal) return 'Local/Online';
  if (hasRemote) return 'Online';
  if (hasLocal) return 'Local';
  return 'Local/Online';
}

function formatPlanStatusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPlanStatusTone(status: string) {
  if (status === 'open' || status === 'started' || status === 'completed') return 'success' as const;
  if (status === 'full') return 'warning' as const;
  if (status === 'cancelled' || status === 'hidden') return 'danger' as const;
  if (status === 'expired') return 'time' as const;
  return 'muted' as const;
}

function getPlanJoinModeLabel(plan: PlanDto) {
  return plan.joinApprovalMode === 'automatic' ? 'Free join' : 'Request to join';
}

function getPlanJoinActionCopy(plan: PlanDto) {
  if (plan.status === 'full') return 'This plan is full right now.';
  if (plan.status === 'started') return 'This plan has already started.';
  if (plan.status !== 'open') return `This plan is ${formatPlanStatusLabel(plan.status).toLowerCase()}.`;
  return plan.joinApprovalMode === 'automatic' ? 'Free join is open. You can leave later.' : 'Send your interest to join this plan.';
}

function getPlanParticipantStateCopy(status: PlanDto['myParticipantStatus']) {
  if (status === 'pending') return 'Your join request is waiting for the owner.';
  if (status === 'left') return 'You left this plan.';
  if (status === 'removed') return 'The owner removed you from this plan.';
  if (status === 'declined') return 'The owner declined this request.';
  if (status === 'cancelled') return 'Your join request was cancelled.';
  return status ? `Your status: ${status}` : '';
}

function canJoinPlanFromParticipantStatus(status: PlanDto['myParticipantStatus']) {
  return !status || status === 'left' || status === 'cancelled' || status === 'declined';
}

function getOwnerInitial(plan: PlanDto) {
  return getOwnerName(plan).trim().slice(0, 1).toUpperCase() || 'H';
}

function activeMedia(media: MediaAssetDto[] | undefined) {
  return (media ?? []).filter((asset) => asset.status === 'active');
}

function activeMediaUrl(media?: MediaAssetDto | null) {
  if (!media?.url || media.status !== 'active') return null;
  return resolveMediaUrl(media.url);
}

function reusablePlaceMediaForEdit(place?: PlaceDto | null) {
  return (place?.media ?? []).filter((asset) => asset.status !== 'removed').slice(0, 1);
}

function formatPlaceUploadProgress(progress: SelectedImageUploadProgress | null) {
  if (!progress) return null;
  return `Uploading image ${progress.current}/${progress.total}...`;
}

function getPlaceUploadErrorMessage(error: unknown) {
  if (error instanceof SelectedImageUploadError) {
    return `Image upload failed (${error.current}/${error.total}). Try a smaller image or upload again.`;
  }
  return getFriendlyApiErrorMessage(error);
}

function getPlanPlaceMedia(place: PlanPlaceDto) {
  return activeMedia(place.media)[0] ?? activeMedia(place.sourcePlace?.media)[0] ?? null;
}

function sortedPlanPlaces(plan: PlanDto) {
  return [...(plan.places ?? [])].sort((first, second) => first.order - second.order);
}

type PlanPlaceLocationDetails = {
  kind: 'local' | 'remote';
  label: string;
  value: string;
  actionLabel?: string;
  href?: string;
};

function buildMapsSearchUrl(value: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}

function getPlanPlaceLocationDetails(place: PlanPlaceDto): PlanPlaceLocationDetails | null {
  if (place.mode === 'remote') {
    const value = place.onlineUrl || place.onlineLabel || null;
    if (!value) return null;
    return {
      kind: 'remote',
      label: place.onlineLabel && place.onlineUrl ? place.onlineLabel : 'Online place',
      value,
      href: place.onlineUrl || undefined,
      actionLabel: place.onlineUrl ? 'Open link' : undefined,
    };
  }
  const value = place.addressPublicText || place.sourcePlace?.addressPublicText || place.sourcePlace?.areaLabel || null;
  if (!value) return null;
  return {
    kind: 'local',
    label: 'Offline address',
    value,
    href: buildMapsSearchUrl(value),
    actionLabel: 'Open in Maps',
  };
}

function getPlanPlaceLocationLabel(place: PlanPlaceDto) {
  return getPlanPlaceLocationDetails(place)?.value ?? null;
}

function getPlanPlaceModeDisplay(place: PlanPlaceDto) {
  return place.mode === 'remote' ? 'Online' : 'Local';
}

function getPlanPlaceTimeLabel(place: PlanPlaceDto, planStartsAt: string) {
  const start = formatDate(place.startsAt ?? planStartsAt);
  const end = place.endsAt ? formatDate(place.endsAt) : '';
  return end && end !== start ? `${start} → ${end}` : start;
}

function getPlanPlaceLocationPrefix(place: PlanPlaceDto) {
  if (place.mode === 'remote') return place.onlineLabel && place.onlineUrl ? place.onlineLabel : 'Online';
  return 'Address';
}

async function openPlanPlaceLocation(location: PlanPlaceLocationDetails) {
  if (!location.href) return;
  try {
    await Linking.openURL(location.href);
  } catch {
    Alert.alert('Could not open location', 'Try copying the address and opening it in your maps app.');
  }
}

type PlanPlacePresenceNotice = {
  tone: 'success' | 'warning' | 'info';
  title: string;
  body: string;
};

function getPlanPlaceVerificationCoordinates(place: PlanPlaceDto) {
  const latitude = typeof place.latitude === 'number' ? place.latitude : place.sourcePlace?.latitude;
  const longitude = typeof place.longitude === 'number' ? place.longitude : place.sourcePlace?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { latitude, longitude };
}

function isOfflinePlanPlace(place: PlanPlaceDto) {
  return place.mode !== 'remote';
}

function formatPresenceDistance(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (value < 1000) return `${Math.round(value)}m away`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}km away`;
}

function presenceNoticeFromVerificationResponse(response: PlacePresenceVerificationResponse): PlanPlacePresenceNotice {
  const distanceLabel = formatPresenceDistance(response.distanceMeters ?? response.verification.distanceMeters);
  if (response.accepted) {
    return {
      tone: 'success',
      title: response.alreadyVerified ? 'Already verified here' : 'Verified at this place',
      body: distanceLabel ? `Your device location was accepted · ${distanceLabel}.` : 'Your device location was accepted for this offline place.',
    };
  }
  if (response.verification.rejectionReason === 'gps_accuracy_too_low') {
    return {
      tone: 'warning',
      title: 'GPS accuracy too low',
      body: 'Move closer to the place, step outside if possible, and try again with a stronger location signal.',
    };
  }
  if (response.verification.rejectionReason === 'too_far_from_place') {
    return {
      tone: 'warning',
      title: 'Too far from this place',
      body: distanceLabel ? `Your device seems ${distanceLabel}. Move closer and try again.` : 'Move closer to the selected offline place and try again.',
    };
  }
  if (response.verification.rejectionReason === 'mock_location_detected') {
    return {
      tone: 'warning',
      title: 'Mock location detected',
      body: 'Turn off mock location tools and try again from your real device location.',
    };
  }
  if (response.verification.rejectionReason === 'location_timestamp_stale' || response.verification.rejectionReason === 'location_timestamp_future') {
    return {
      tone: 'warning',
      title: 'Location check expired',
      body: 'Refresh your location and try again. We only accept fresh device location checks.',
    };
  }
  if (response.verification.rejectionReason === 'suspicious_location_jump') {
    return {
      tone: 'warning',
      title: 'Location jump looks unusual',
      body: 'Wait a bit before verifying again. This protects offline trust stats from impossible travel patterns.',
    };
  }
  return {
    tone: 'warning',
    title: 'Could not verify presence',
    body: 'Try again when your device has a stronger location signal.',
  };
}

function getPlanPlaceDescription(place: PlanPlaceDto) {
  return place.sourcePlace?.description?.trim() || '';
}

function getPlanPlaceSourceLabel(place: PlanPlaceDto) {
  if (place.source === 'hellowhen_library') return 'Library place';
  if (place.source === 'my_place') return 'My place';
  return 'Custom stop';
}

function DisabledPlansScreen({ onBack }: { onBack: () => void }) {
  const theme = useThemeTokens();
  return (
    <AppFixedHeaderScreen header={<AppHeader title="Plans" onBack={onBack} />}>
      <View style={styles.centerState}>
        <View style={[styles.largeIcon, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
          <MobileIcon name="plan" color={theme.semantic.plan.text} size={30} />
        </View>
        <AppText style={styles.centerTitle}>Plans are hidden</AppText>
        <AppText style={[styles.centerBody, { color: theme.color.muted }]}>The mobile Plan route skeleton is ready, but Plans stay hidden until the Plan feature flags are enabled.</AppText>
      </View>
    </AppFixedHeaderScreen>
  );
}

function HeaderAction({ icon, label, onPress, badgeCount = 0 }: { icon: MobileIconName; label: string; onPress: () => void; badgeCount?: number }) {
  const theme = useThemeTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.headerAction, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}
    >
      <MobileIcon name={icon} size={20} color={theme.color.text} />
      {badgeCount > 0 ? (
        <View style={[styles.headerActionBadge, { backgroundColor: theme.semantic.plan.text, borderColor: theme.color.surface }]}>
          <AppText style={[styles.headerActionBadgeText, { color: theme.color.background }]}>{badgeCount}</AppText>
        </View>
      ) : null}
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

function PlaceRow({
  place,
  onPress,
  onEdit,
  onArchive,
  archiving,
}: {
  place: PlaceDto;
  onPress?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  archiving?: boolean;
}) {
  const theme = useThemeTokens();
  const isLibrary = place.source === 'hellowhen_library';
  const mediaUrl = activeMediaUrl(activeMedia(place.media)[0]);
  const content = (
    <>
      <View style={styles.placeRowContent}>
        <View style={[styles.placeThumb, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}>
          {mediaUrl ? <Image source={{ uri: mediaUrl }} resizeMode="cover" style={styles.placeThumbImage as ImageStyle} /> : <MobileIcon name={place.mode === 'remote' ? 'send' : 'calendar'} size={18} color={theme.semantic.place.text} />}
        </View>
        <View style={styles.placeRowCopy}>
          <View style={styles.rowTop}>
            <SemanticBadge label={isLibrary ? 'Library place' : 'My place'} tone="place" size="sm" />
            <SemanticBadge label={place.mode === 'remote' ? 'Online' : 'Offline'} tone="muted" size="sm" />
          </View>
          <AppText style={styles.rowTitle}>{place.title}</AppText>
          <AppText style={[styles.rowBody, { color: theme.color.muted }]} numberOfLines={2}>{place.description || 'Reusable place for future Plans.'}</AppText>
          <View style={styles.metaRow}>
            <MobileIcon name={place.mode === 'remote' ? 'send' : 'calendar'} size={15} color={theme.color.muted} />
            <AppText style={[styles.metaText, { color: theme.color.muted }]} numberOfLines={1}>{place.mode === 'remote' ? (place.onlineLabel || place.onlineUrl || 'Online place') : (place.areaLabel || place.addressPublicText || 'Offline place')}</AppText>
          </View>
        </View>
      </View>
      {onEdit || onArchive ? (
        <View style={[styles.placeManageActions, { borderTopColor: theme.color.border }]}>
          {onEdit ? <SecondaryButton label="Edit" onPress={onEdit} /> : null}
          {onArchive ? (
            <Pressable
              accessibilityRole="button"
              disabled={archiving}
              onPress={onArchive}
              style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.semantic.danger.border, backgroundColor: theme.semantic.danger.bg, flex: 1 }, pressed && styles.pressed, archiving && styles.disabled]}
            >
              <AppText style={[styles.secondaryButtonText, { color: theme.semantic.danger.text }]}>{archiving ? 'Deleting...' : 'Delete'}</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.rowCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.rowCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>{content}</View>;
}

function PlanList({ scope, navigation, filters = [], searchQuery = '' }: { scope: PlanListScope; navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'>; filters?: string[]; searchQuery?: string }) {
  const theme = useThemeTokens();
  const auth = useAuth();
  const activeFilters = useMemo(() => normalizePlanFilters(filters), [filters.join('|')]);
  const activeSearchQuery = normalizePlanSearchQuery(searchQuery);
  const activeFilterSummary = filterSummary(activeFilters, activeSearchQuery);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starterRefreshKey, setStarterRefreshKey] = useState(0);
  const [recentStarterIdeaIds, setRecentStarterIdeaIds] = useState<string[]>([]);
  const [anonymousStarterKey, setAnonymousStarterKey] = useState('anonymous');

  useEffect(() => {
    let mounted = true;
    async function hydrateStarterMemory() {
      const rawRecent = await AsyncStorage.getItem(RECENT_PLAN_IDEA_STORAGE_KEY).catch(() => null);
      if (mounted && rawRecent) {
        try {
          const parsed = JSON.parse(rawRecent) as string[];
          if (Array.isArray(parsed)) setRecentStarterIdeaIds(parsed.filter((id) => parseStarterPlanIdeaKey(id)));
        } catch {
          // Ignore old or malformed local starter-memory data.
        }
      }
      const existingAnonymousKey = await AsyncStorage.getItem(ANONYMOUS_PLAN_IDEA_STORAGE_KEY).catch(() => null);
      if (existingAnonymousKey) {
        if (mounted) setAnonymousStarterKey(existingAnonymousKey);
        return;
      }
      const nextAnonymousKey = createAnonymousPlanIdeaKey();
      await AsyncStorage.setItem(ANONYMOUS_PLAN_IDEA_STORAGE_KEY, nextAnonymousKey).catch(() => undefined);
      if (mounted) setAnonymousStarterKey(nextAnonymousKey);
    }
    void hydrateStarterMemory().catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const load = useCallback(async ({ refresh = false }: { refresh?: boolean } = {}) => {
    if (!isPlansVisible()) { setLoading(false); return; }
    if (refresh) {
      setRefreshing(true);
      setStarterRefreshKey((current) => current + 1);
    } else setLoading(true);
    setError(null);
    try {
      const response = scope === 'mine' ? await api.plans.mine() : scope === 'joined' ? await api.plans.joined() : await api.plans.feed(buildPlanFeedQuery(activeFilters, activeSearchQuery));
      const nextPlans = response.plans ?? [];
      setPlans(scope === 'feed' ? applyPlanFilters(nextPlans, activeFilters, activeSearchQuery) : nextPlans);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setPlans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope, activeFilters, activeSearchQuery]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const isDeckFeed = scope === 'feed';
  const hasActiveSearchOrFilters = Boolean(activeFilters.length || activeSearchQuery);
  const starterIdeas = useMemo(() => selectStarterPlanIdeaKeys({
    realPlanCount: plans.length,
    hasActiveSearchOrFilters: !isDeckFeed || hasActiveSearchOrFilters,
    userKey: auth.user?.id ?? anonymousStarterKey,
    refreshKey: starterRefreshKey,
    recentIdeaIds: recentStarterIdeaIds,
  }), [anonymousStarterKey, auth.user?.id, hasActiveSearchOrFilters, isDeckFeed, plans.length, recentStarterIdeaIds.join('|'), starterRefreshKey]);
  const feedItems = useMemo(() => buildPlanFeedItems(plans.length, starterIdeas), [plans.length, starterIdeas.join('|')]);

  const markStarterIdeaSeen = useCallback((ideaKey: StarterPlanIdeaKey) => {
    setRecentStarterIdeaIds((current) => {
      const next = mergeRecentStarterPlanIdeaIds(current, [ideaKey]);
      void AsyncStorage.setItem(RECENT_PLAN_IDEA_STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
    navigation.navigate('PlanIdeaDetail', { ideaId: ideaKey });
  }, [navigation]);

  if (loading) {
    return <View style={styles.inlineLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Plans...</AppText></View>;
  }

  if (error) return <InfoNotice tone="warning" title="Could not load Plans" body={error} />;

  if (plans.length === 0 && starterIdeas.length === 0) {
    const body = scope === 'mine'
      ? 'Created Plans will appear here once you create one.'
      : scope === 'joined'
        ? 'Plans you join will appear here.'
        : hasActiveSearchOrFilters
          ? 'No Plans match this search and filters yet. Try changing the search words or resetting one or two filters.'
          : 'Open Plans will appear here once people start creating them.';
    return <EmptyBlock title="No Plans yet" body={body} actionLabel={scope === 'mine' ? 'Create plan' : undefined} onAction={scope === 'mine' ? () => navigation.navigate('CreatePlan') : undefined} />;
  }

  return (
    <ScrollView
      contentContainerStyle={isDeckFeed ? styles.deckFeedContent : styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load({ refresh: true }); }} />}
    >
      {scope === 'feed' && hasActiveSearchOrFilters ? (
        <InfoNotice tone="info" title={`${activePlanFilterCount(activeFilters, activeSearchQuery)} active Plan filter${activePlanFilterCount(activeFilters, activeSearchQuery) === 1 ? '' : 's'}`} body={activeFilterSummary || 'Filtered Plan results'} />
      ) : null}
      {isDeckFeed ? feedItems.map((item, index) => {
        if (item.type === 'idea') {
          return (
            <PlanIdeaDeckSection
              key={`idea-${item.ideaKey}`}
              ideaKey={item.ideaKey}
              index={index}
              total={feedItems.length}
              onPress={() => markStarterIdeaSeen(item.ideaKey)}
            />
          );
        }
        const plan = plans[item.planIndex];
        if (!plan) return null;
        return <PlanDeckSection key={plan.id} plan={plan} index={index} total={feedItems.length} onPress={() => navigation.navigate('PlanDetail', { planId: plan.id, title: plan.title })} />;
      }) : plans.map((plan) => (
        <PlanRow key={plan.id} plan={plan} onPress={() => navigation.navigate('PlanDetail', { planId: plan.id, title: plan.title })} />
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

function PlanIdeaDeckSection({ ideaKey, index, total, onPress }: { ideaKey: StarterPlanIdeaKey; index: number; total: number; onPress: () => void }) {
  const theme = useThemeTokens();
  const idea = starterPlanIdeas[ideaKey];
  const plan = useMemo(() => planIdeaPreviewPlan(idea), [idea]);
  return (
    <View style={styles.deckSection}>
      <View style={styles.deckSectionHeader}>
        <View style={styles.deckSectionCopy}>
          <AppText style={styles.deckSectionTitle} numberOfLines={1}>{idea.title}</AppText>
          <AppText style={[styles.deckSectionMeta, { color: theme.color.muted }]} numberOfLines={1}>{idea.stops.length} starter stops · Create your version</AppText>
        </View>
        <SemanticBadge label={`${index + 1}/${total}`} tone="muted" size="sm" />
      </View>
      <PlanSquareDeck plan={plan} index={index} total={total} onOpen={onPress} topBadgeLabel={`Plan idea · ${idea.pack}`} topBadgeTone="plan" showModeBadge={false} />
    </View>
  );
}

function PlaceList({ scope, navigation }: { scope: PlaceListScope; navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'> }) {
  const theme = useThemeTokens();
  const [places, setPlaces] = useState<PlaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [archivingPlaceId, setArchivingPlaceId] = useState<string | null>(null);

  const load = useCallback(async ({ refresh = false }: { refresh?: boolean } = {}) => {
    if (!isPlansVisible()) { setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const response = scope === 'library' ? await api.places.library() : await api.places.mine();
      setPlaces((response.places ?? []).filter((place) => place.status !== 'archived'));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setPlaces([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function confirmArchivePlace(place: PlaceDto) {
    if (scope !== 'mine' || place.source !== 'user') return;
    Alert.alert(
      'Delete Place?',
      'This removes the Place from My Places and future Plan pickers. Existing Plans keep their saved Place details.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { void archivePlace(place); },
        },
      ],
    );
  }

  async function archivePlace(place: PlaceDto) {
    setArchivingPlaceId(place.id);
    setError(null);
    setMessage(null);
    try {
      await api.places.archive(place.id);
      setPlaces((current) => current.filter((item) => item.id !== place.id));
      setMessage(`${place.title} was removed from My Places.`);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, 'Could not delete Place.'));
    } finally {
      setArchivingPlaceId(null);
    }
  }

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
      {message ? <InfoNotice tone="success" title="My Places" body={message} /> : null}
      {scope === 'mine' ? <InfoNotice tone="info" title="Reusable Places" body="Edit your saved Places here. Delete archives the Place from future pickers, while existing Plans keep their saved details." /> : null}
      {places.map((place) => (
        <PlaceRow
          key={place.id}
          place={place}
          onEdit={scope === 'mine' && place.source === 'user' ? () => navigation.navigate('CreatePlace', { editPlace: place }) : undefined}
          onArchive={scope === 'mine' && place.source === 'user' ? () => confirmArchivePlace(place) : undefined}
          archiving={archivingPlaceId === place.id}
        />
      ))}
    </ScrollView>
  );
}

function EmptyBlock({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.emptyBlock, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <MobileIcon name="plan" size={28} color={theme.color.muted} />
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
  const routeParams = props.route?.params as PlanFilterRouteParams | undefined;
  const activeFilters = normalizePlanFilters(routeParams?.filters);
  const activeSearchQuery = normalizePlanSearchQuery(routeParams?.q);
  const activeFilterCount = activePlanFilterCount(activeFilters, activeSearchQuery);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  const menuItems = getNormalWorkspaceMenuItems('plans');

  function openWorkspaceItem(itemId: string) {
    setMenuOpen(false);
    if (itemId === 'my_plans') {
      navigation.navigate('MyPlans');
      return;
    }
    if (itemId === 'joined_plans') {
      navigation.navigate('JoinedPlans');
      return;
    }
    if (itemId === 'my_places') {
      navigation.navigate('MyPlaces');
      return;
    }
    navigation.navigate('Plans');
  }

  const header = (
    <View style={styles.feedHeader}>
      <View style={styles.feedTitleWrap}>
        <AppText style={styles.feedTitle}>Plans</AppText>
      </View>
      <View style={styles.headerActions}>
        <HeaderAction icon="filter" label={activeFilterCount ? `Filter Plans, ${activeFilterCount} active` : 'Filter Plans'} badgeCount={activeFilterCount} onPress={() => { setMenuOpen(false); navigation.navigate('PlanFilters', { filters: activeFilters, q: activeSearchQuery || undefined }); }} />
        <HeaderAction icon="activity" label="Open Plan menu" onPress={() => setMenuOpen((value) => !value)} />
        <HeaderAction icon="add" label="Create Plan" onPress={() => navigation.navigate('CreatePlan')} />
      </View>
    </View>
  );

  return (
    <AppFixedHeaderScreen header={header}>
      <View style={styles.bodyWrap}>
        {menuOpen ? (
          <View style={[styles.menuPanel, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            {menuItems.map((item) => <MenuItem key={item.id} item={item} onPress={() => openWorkspaceItem(item.id)} />)}
          </View>
        ) : null}
        <PlanList scope="feed" navigation={navigation} filters={activeFilters} searchQuery={activeSearchQuery} />
      </View>
    </AppFixedHeaderScreen>
  );
}

export function PlanFiltersScreen(props: Partial<SimpleScreenProps<'PlanFilters'>> = {}) {
  const fallbackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigation = (props.navigation ?? fallbackNavigation) as NativeStackNavigationProp<RootStackParamList>;
  const theme = useThemeTokens();
  const incomingParams = props.route?.params as PlanFilterRouteParams | undefined;
  const incomingFilters = normalizePlanFilters(incomingParams?.filters);
  const incomingQuery = normalizePlanSearchQuery(incomingParams?.q);
  const incomingFilterKey = incomingFilters.join('|');
  const [selectedFilters, setSelectedFilters] = useState<string[]>(incomingFilters);
  const [searchQuery, setSearchQuery] = useState(incomingQuery);
  const normalizedSearchQuery = normalizePlanSearchQuery(searchQuery);
  const activeCount = activePlanFilterCount(selectedFilters, normalizedSearchQuery);

  useEffect(() => {
    setSelectedFilters(incomingFilters);
    setSearchQuery(incomingQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingFilterKey, incomingQuery]);

  function toggle(value: string) {
    setSelectedFilters((current) => toggleFilterValue(current, value));
  }

  function reset() {
    setSelectedFilters([]);
    setSearchQuery('');
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Plan filters" onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.planFilterContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, styles.planFilterHero, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
          <View style={[styles.menuIcon, { backgroundColor: theme.color.surface, borderColor: theme.semantic.plan.border }]}>
            <MobileIcon name="filter" size={18} color={theme.semantic.plan.text} />
          </View>
          <AppText style={styles.heroTitle}>Find the right Plan</AppText>
          <AppText style={[styles.heroBody, { color: theme.color.muted }]}>Search words and filter choices stay attached to the feed so we can learn what people look for later.</AppText>
        </View>

        <View style={[styles.planFilterSearchCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <AppText style={styles.formLabel}>Search</AppText>
          <View style={[styles.planFilterSearchInputWrap, { backgroundColor: theme.color.background, borderColor: theme.color.border }]}>
            <MobileIcon name="search" size={18} color={theme.color.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={(value) => setSearchQuery(value.slice(0, 120))}
              placeholder="Search plans, places, titles..."
              placeholderTextColor={theme.color.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.planFilterSearchInput, { color: theme.color.text }]}
            />
            {normalizedSearchQuery ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear Plan search" onPress={() => setSearchQuery('')} style={({ pressed }) => [styles.planFilterSearchClear, { backgroundColor: theme.semantic.plan.softBg }, pressed && styles.pressed]}>
                <AppText style={[styles.planFilterSearchClearText, { color: theme.semantic.plan.text }]}>Clear</AppText>
              </Pressable>
            ) : null}
          </View>
          <AppText style={[styles.choiceMeta, { color: theme.color.muted }]}>Search words are preserved with your filters. Result counts are logged privately for future Plan suggestions.</AppText>
        </View>

        {planFilterGroups.map((group) => (
          <View key={group.title} style={[styles.planFilterGroup, { borderColor: theme.color.border }]}>
            <View style={styles.placeCreateSectionHeader}>
              <AppText style={styles.sectionTitle}>{group.title}</AppText>
              <AppText style={[styles.heroBody, { color: theme.color.muted }]}>{group.body}</AppText>
            </View>
            <View style={styles.planFilterOptionGrid}>
              {group.options.map((option) => {
                const selected = selectedFilters.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => toggle(option.value)}
                    style={({ pressed }) => [
                      styles.planFilterOption,
                      { backgroundColor: theme.color.surface, borderColor: theme.color.border },
                      selected && { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.planFilterCheck, { borderColor: selected ? theme.semantic.plan.border : theme.color.border, backgroundColor: selected ? theme.semantic.plan.text : 'transparent' }]}>
                      {selected ? <MobileIcon name="close" size={11} color={theme.color.background} /> : null}
                    </View>
                    <View style={styles.planFilterOptionCopy}>
                      <AppText style={[styles.choiceTitle, selected && { color: theme.semantic.plan.text }]}>{option.label}</AppText>
                      {option.body ? <AppText style={[styles.choiceMeta, { color: theme.color.muted }]}>{option.body}</AppText> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.planFilterFooter}>
          <SecondaryButton label="Reset" icon="refresh" onPress={reset} disabled={activeCount === 0} />
          <PrimaryButton label={activeCount ? `Show plans (${activeCount})` : 'Show plans'} onPress={() => navigation.navigate('Plans', activeCount ? { filters: selectedFilters, q: normalizedSearchQuery || undefined } : undefined)} />
        </View>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function MenuItem({ item, onPress }: { item: NormalWorkspaceMenuItem; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuItem, { borderBottomColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={[styles.menuIcon, { backgroundColor: theme.semantic[item.tone].softBg, borderColor: theme.semantic[item.tone].border }]}><MobileIcon name={item.icon} size={17} color={theme.semantic[item.tone].text} /></View>
      <View style={styles.menuCopy}>
        <AppText style={styles.menuTitle}>{item.title}</AppText>
        <AppText style={[styles.menuBody, { color: theme.color.muted }]}>{item.body}</AppText>
      </View>
      <MobileIcon name="chevron-right" size={20} color={theme.color.muted} />
    </Pressable>
  );
}

function PlanDetailInfoRow({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.planDetailInfoRow, { borderBottomColor: theme.color.border }]}>
      <AppText style={[styles.planDetailInfoLabel, { color: theme.color.muted }]}>{label}</AppText>
      <AppText style={styles.planDetailInfoValue}>{value}</AppText>
    </View>
  );
}

function PlanOwnerRow({ plan }: { plan: PlanDto }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.planOwnerRow, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
      <View style={[styles.planOwnerAvatar, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
        <AppText style={[styles.planOwnerInitial, { color: theme.semantic.plan.text }]}>{getOwnerInitial(plan)}</AppText>
      </View>
      <View style={styles.planOwnerCopy}>
        <AppText style={[styles.planOwnerLabel, { color: theme.color.muted }]}>Posted by</AppText>
        <AppText style={styles.planOwnerName}>{getOwnerName(plan)}</AppText>
      </View>
    </View>
  );
}

function PlanSectionDivider() {
  const theme = useThemeTokens();
  return <View style={[styles.planSectionDivider, { backgroundColor: theme.color.border }]} />;
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

function PlanPlaceTimelineCard({
  place,
  index,
  planStartsAt,
  showReport,
  canVerifyPresence,
  isVerifyingPresence,
  presenceNotice,
  onVerifyPresence,
}: {
  place: PlanPlaceDto;
  index: number;
  planStartsAt: string;
  showReport: boolean;
  canVerifyPresence: boolean;
  isVerifyingPresence: boolean;
  presenceNotice?: PlanPlacePresenceNotice;
  onVerifyPresence: (place: PlanPlaceDto) => void;
}) {
  const theme = useThemeTokens();
  const mediaUrl = activeMediaUrl(getPlanPlaceMedia(place));
  const locationDetails = getPlanPlaceLocationDetails(place);
  const description = getPlanPlaceDescription(place);
  const sourceLabel = getPlanPlaceSourceLabel(place);
  const hasVerificationCoordinates = Boolean(getPlanPlaceVerificationCoordinates(place));
  const showPresenceVerification = isOfflinePlanPlace(place) && (canVerifyPresence || presenceNotice || hasVerificationCoordinates);
  const verificationDisabled = isVerifyingPresence || !hasVerificationCoordinates;

  return (
    <View style={[styles.planRouteStop, { borderBottomColor: theme.color.border }]}>
      <View style={styles.planRouteStopTop}>
        <View style={styles.planRouteTimeline}>
          <View style={[styles.planRouteNumber, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}>
            <AppText style={[styles.planRouteNumberText, { color: theme.semantic.place.text }]}>{index + 1}</AppText>
          </View>
        </View>
        <View style={styles.planRouteCopy}>
          <View style={styles.planRouteTimeRow}>
            <AppText style={[styles.planRouteTime, { color: theme.semantic.time.text }]}>{getPlanPlaceTimeLabel(place, planStartsAt)}</AppText>
            <AppText style={[styles.planRouteSource, { color: theme.color.muted }]}>{getPlanPlaceModeDisplay(place)} · {sourceLabel}</AppText>
          </View>
          <View style={styles.planRouteContentRow}>
            <View style={styles.planRouteTextBlock}>
              <AppText style={styles.planRouteTitle}>{place.title}</AppText>
              {locationDetails ? (
                <View style={[
                  styles.planRouteLocationCard,
                  {
                    backgroundColor: locationDetails.kind === 'local' ? theme.semantic.place.softBg : theme.semantic.plan.softBg,
                    borderColor: locationDetails.kind === 'local' ? theme.semantic.place.border : theme.semantic.plan.border,
                  },
                ]}>
                  <View style={[
                    styles.planRouteLocationIcon,
                    {
                      backgroundColor: theme.color.surface,
                      borderColor: locationDetails.kind === 'local' ? theme.semantic.place.border : theme.semantic.plan.border,
                    },
                  ]}>
                    <MobileIcon name={locationDetails.kind === 'local' ? 'location-on' : 'plan'} color={locationDetails.kind === 'local' ? theme.semantic.place.text : theme.semantic.plan.text} size={16} />
                  </View>
                  <View style={styles.planRouteLocationCopy}>
                    <AppText style={[styles.planRouteLocationLabel, { color: locationDetails.kind === 'local' ? theme.semantic.place.text : theme.semantic.plan.text }]}>{locationDetails.label}</AppText>
                    <AppText style={styles.planRouteLocationValue} numberOfLines={2}>{locationDetails.value}</AppText>
                  </View>
                  {locationDetails.href && locationDetails.actionLabel ? (
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={locationDetails.actionLabel}
                      onPress={() => { void openPlanPlaceLocation(locationDetails); }}
                      style={({ pressed }) => [styles.planRouteLocationAction, { backgroundColor: theme.color.surface }, pressed && styles.pressed]}
                    >
                      <AppText style={[styles.planRouteLocationActionText, { color: locationDetails.kind === 'local' ? theme.semantic.place.text : theme.semantic.plan.text }]}>{locationDetails.actionLabel}</AppText>
                      <MobileIcon name="chevron-right" color={locationDetails.kind === 'local' ? theme.semantic.place.text : theme.semantic.plan.text} size={14} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {showPresenceVerification ? (
                <View style={[
                  styles.planPresenceCard,
                  {
                    backgroundColor: presenceNotice?.tone === 'success' ? theme.semantic.success.softBg : presenceNotice?.tone === 'warning' ? theme.semantic.warning.softBg : theme.color.surface,
                    borderColor: presenceNotice?.tone === 'success' ? theme.semantic.success.border : presenceNotice?.tone === 'warning' ? theme.semantic.warning.border : theme.color.border,
                  },
                ]}>
                  <View style={styles.planPresenceHeaderRow}>
                    <View style={styles.planPresenceCopy}>
                      <AppText style={[styles.planPresenceTitle, { color: presenceNotice?.tone === 'success' ? theme.semantic.success.text : presenceNotice?.tone === 'warning' ? theme.semantic.warning.text : theme.color.text }]}>{presenceNotice?.title ?? 'Presence verification'}</AppText>
                      <AppText style={[styles.planPresenceBody, { color: theme.color.muted }]}>
                        {presenceNotice?.body ?? (hasVerificationCoordinates ? 'Use your device GPS when you reach this place.' : 'This place needs a Google-confirmed map position before GPS verification can work.')}
                      </AppText>
                    </View>
                    {hasVerificationCoordinates ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Verify I am here"
                        disabled={verificationDisabled}
                        onPress={() => onVerifyPresence(place)}
                        style={({ pressed }) => [
                          styles.planPresenceButton,
                          { backgroundColor: canVerifyPresence ? theme.semantic.place.bg : theme.color.surface, borderColor: canVerifyPresence ? theme.semantic.place.border : theme.color.border },
                          (pressed || isVerifyingPresence) && styles.pressed,
                          verificationDisabled && styles.disabled,
                        ]}
                      >
                        {isVerifyingPresence ? <ActivityIndicator size="small" color={canVerifyPresence ? theme.color.background : theme.color.muted} /> : <MobileIcon name="location-on" size={15} color={canVerifyPresence ? theme.color.background : theme.color.muted} />}
                        <AppText style={[styles.planPresenceButtonText, { color: canVerifyPresence ? theme.color.background : theme.color.muted }]}>{isVerifyingPresence ? 'Checking...' : 'Verify'}</AppText>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {description ? <AppText style={[styles.planRouteDescription, { color: theme.color.muted }]} numberOfLines={3}>{description}</AppText> : null}
            </View>
            {mediaUrl ? (
              <View style={styles.planRouteImageWrap}>
                <Image source={{ uri: mediaUrl }} resizeMode="cover" style={styles.planRouteImage as ImageStyle} />
              </View>
            ) : null}
          </View>
        </View>
      </View>
      {showReport ? <ReportContentPanel targetType="plan_place" targetId={place.id} labelKey="report.button" helperKey="report.helper.content" /> : null}
    </View>
  );
}

export function PlanDetailScreen({ route, navigation }: PlanDetailProps) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [loading, setLoading] = useState(isPlansVisible());
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [publicMessageCount, setPublicMessageCount] = useState(0);
  const [verifyingPlaceId, setVerifyingPlaceId] = useState<string | null>(null);
  const [presenceNotices, setPresenceNotices] = useState<Record<string, PlanPlacePresenceNotice>>({});

  const load = useCallback(async () => {
    if (!isPlansVisible()) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await api.plans.get(route.params.planId);
      setPlan(response.plan);
      try {
        const publicResult = await api.plans.publicMessages(route.params.planId, { take: 100 }) as { messages?: unknown[] };
        setPublicMessageCount(Array.isArray(publicResult.messages) ? publicResult.messages.length : 0);
      } catch {
        setPublicMessageCount(0);
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setPlan(null);
      setPublicMessageCount(0);
    } finally {
      setLoading(false);
    }
  }, [route.params.planId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function sharePlan() {
    if (!plan || sharing) return;
    setSharing(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const url = buildPublicPlanUrl(plan.id);
      await Share.share({ title: plan.title, message: `${plan.title}\n${url}`, url });
      setActionMessage('Share sheet opened.');
    } catch {
      setActionError('Could not open sharing on this device.');
    } finally {
      setSharing(false);
    }
  }

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

  function cancelPlan() {
    if (!plan || !canCancelPlan || busy) return;
    Alert.alert(
      'Cancel Plan?',
      'People will no longer be able to join, but the Plan will remain visible with a Cancelled status.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Plan',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              setError(null);
              setActionMessage(null);
              setActionError(null);
              try {
                await api.plans.update(plan.id, { status: 'cancelled' });
                setActionMessage('Plan cancelled. It remains visible with a Cancelled status.');
                await load();
              } catch (caughtError) {
                setActionError(getFriendlyApiErrorMessage(caughtError));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }

  async function verifyPlanPlacePresence(place: PlanPlaceDto) {
    if (!plan || verifyingPlaceId) return;
    if (!auth.user) {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'info', title: 'Log in to verify', body: 'Log in first, then use your device GPS when you reach this offline place.' },
      }));
      return;
    }
    if (!isOwner && !isJoined) {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'info', title: 'Join this plan first', body: 'Presence verification is only available to the owner or joined participants.' },
      }));
      return;
    }
    if (!isOfflinePlanPlace(place)) return;
    if (!getPlanPlaceVerificationCoordinates(place)) {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'warning', title: 'Map position needed', body: 'This offline place needs a Google-confirmed map position before GPS verification can work.' },
      }));
      return;
    }

    setVerifyingPlaceId(place.id);
    setActionError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setPresenceNotices((current) => ({
          ...current,
          [place.id]: { tone: 'warning', title: 'Location permission needed', body: 'Allow location access only when you want to verify that you are at this place.' },
        }));
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const response = await api.plans.verifyPlacePresence(plan.id, place.id, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: typeof position.coords.accuracy === 'number' ? position.coords.accuracy : undefined,
        locationCapturedAt: new Date(position.timestamp).toISOString(),
        isMockedLocation: (position as { mocked?: boolean }).mocked === true,
        platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
      });
      setPresenceNotices((current) => ({ ...current, [place.id]: presenceNoticeFromVerificationResponse(response) }));
    } catch (caughtError) {
      setPresenceNotices((current) => ({
        ...current,
        [place.id]: { tone: 'warning', title: 'Verification failed', body: getFriendlyApiErrorMessage(caughtError) },
      }));
    } finally {
      setVerifyingPlaceId(null);
    }
  }

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  const isOwner = Boolean(auth.user?.id && plan?.ownerId === auth.user.id);
  const participantStatus = plan?.myParticipantStatus ?? null;
  const isJoined = participantStatus === 'accepted';
  const canJoin = Boolean(plan && auth.user && !isOwner && canJoinPlanFromParticipantStatus(participantStatus) && plan.status === 'open');
  const canLeave = Boolean(plan && !isOwner && isJoined);
  const canCancelPlan = Boolean(plan && isOwner && plan.status !== 'cancelled');
  const participantStateCopy = !isOwner ? getPlanParticipantStateCopy(participantStatus) : '';
  const places = plan ? sortedPlanPlaces(plan) : [];
  const acceptedParticipants = plan ? getAcceptedParticipants(plan) : [];
  const joinedCount = plan?.participantCount ?? acceptedParticipants.length;
  const capacityLabel = plan?.maxParticipants ? `${joinedCount}/${plan.maxParticipants}` : String(joinedCount);
  const showReportActions = Boolean(auth.user && plan && !isOwner);
  const header = (
    <AppHeader
      title="Plan"
      onBack={() => navigation.goBack()}
      rightSlot={plan ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share Plan"
          disabled={sharing}
          onPress={() => { void sharePlan(); }}
          style={({ pressed }) => [styles.planHeaderShareButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, (pressed || sharing) && styles.pressed]}
        >
          <MobileIcon name="share" size={18} color={theme.color.text} />
        </Pressable>
      ) : undefined}
    />
  );

  return (
    <AppFixedHeaderScreen header={header}>
      {loading ? <View style={styles.inlineLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Plan...</AppText></View> : null}
      {!loading && error ? <View style={styles.contentPad}><InfoNotice tone="warning" title="Could not load Plan" body={error} /></View> : null}
      {!loading && plan ? (
        <ScrollView contentContainerStyle={styles.planDetailContent} showsVerticalScrollIndicator={false}>
          <View style={styles.planDetailHero}>
            <AppText style={[styles.planDetailEyebrow, { color: theme.semantic.plan.text }]}>{`${formatPlanStatusLabel(plan.status)} · Plan`}</AppText>
            <AppText style={styles.planDetailTitle}>{plan.title}</AppText>
            <AppText style={[styles.planDetailStart, { color: theme.color.muted }]}>Starts {formatDate(plan.startsAt)}</AppText>
            <View style={styles.planDetailOwnerLine}>
              <AppText style={[styles.planDetailOwnerPrefix, { color: theme.color.muted }]}>Posted by</AppText>
              <AppText style={styles.planDetailOwnerName}>{getOwnerName(plan)}</AppText>
            </View>
            <View style={styles.planDetailChips}>
              <SemanticBadge label={formatPlanStatusLabel(plan.status)} tone={getPlanStatusTone(plan.status)} size="sm" />
              <SemanticBadge label={getPlanJoinModeLabel(plan)} tone="proposal" size="sm" />
              <SemanticBadge label={`${places.length} ${places.length === 1 ? 'place' : 'places'}`} tone="place" size="sm" />
              <SemanticBadge label={getPlanModeLabel(plan)} tone="muted" size="sm" />
            </View>
            {plan.description ? <AppText style={[styles.planDetailDescription, { color: theme.color.text }]}>{plan.description}</AppText> : null}
          </View>

          <PlanSectionDivider />

          <View style={styles.planDetailSectionFlat}>
            <View style={styles.sectionTitleRow}>
              <AppText style={styles.sectionTitle}>Route</AppText>
              <SemanticBadge label={`${places.length}`} tone="place" size="sm" />
            </View>
            {places.length === 0 ? <EmptyBlock title="No places yet" body="This Plan does not have places attached yet." /> : null}
            {places.map((place, index) => (
              <PlanPlaceTimelineCard
                key={place.id}
                place={place}
                index={index}
                planStartsAt={plan.startsAt}
                showReport={showReportActions}
                canVerifyPresence={Boolean(auth.user && (isOwner || isJoined))}
                isVerifyingPresence={verifyingPlaceId === place.id}
                presenceNotice={presenceNotices[place.id]}
                onVerifyPresence={(nextPlace) => { void verifyPlanPlacePresence(nextPlace); }}
              />
            ))}
          </View>

          <PlanSectionDivider />

          <View style={styles.planDetailSectionFlat}>
            <AppText style={styles.sectionTitle}>Details</AppText>
            <View style={styles.planDetailInfoList}>
              <PlanDetailInfoRow label="Status" value={formatPlanStatusLabel(plan.status)} />
              <PlanDetailInfoRow label="Visibility" value={plan.status === 'hidden' ? 'Hidden' : 'Public'} />
              <PlanDetailInfoRow label="Join mode" value={getPlanJoinModeLabel(plan)} />
              <PlanDetailInfoRow label="Time" value={formatPlanDateRange(plan)} />
              <PlanDetailInfoRow label="Place mode" value={getPlanModeLabel(plan)} />
              <PlanDetailInfoRow label="Created" value={formatDate(plan.createdAt)} />
            </View>
          </View>

          <PlanSectionDivider />

          <View style={styles.planDetailSectionFlat}>
            <AppText style={styles.sectionTitle}>Owner</AppText>
            <PlanOwnerRow plan={plan} />
          </View>

          <PlanSectionDivider />

          <View style={styles.planDetailSectionFlat}>
            <View style={styles.detailSectionHeader}>
              <View style={styles.detailSectionCopy}>
                <AppText style={styles.sectionTitle}>Joined people</AppText>
                <AppText style={[styles.rowBody, { color: theme.color.muted }]}>{capacityLabel} joined · {getPlanJoinModeLabel(plan)}</AppText>
              </View>
              <SemanticBadge label={String(joinedCount)} tone="proposal" size="sm" />
            </View>
            {acceptedParticipants.length === 0 ? <AppText style={[styles.rowBody, { color: theme.color.muted }]}>No participants yet.</AppText> : null}
            {acceptedParticipants.map((participant) => <ParticipantCompactRow key={participant.id} participant={participant} />)}
          </View>

          <PlanSectionDivider />

          <View style={styles.planDetailSectionFlat}>
            <View style={styles.detailSectionHeader}>
              <View style={styles.detailSectionCopy}>
                <AppText style={styles.sectionTitle}>Public discussion</AppText>
                <AppText style={[styles.rowBody, { color: theme.color.muted }]}>{publicMessageCount} {publicMessageCount === 1 ? 'comment' : 'comments'} · visible to logged-in members</AppText>
              </View>
              <SemanticBadge label="Public" tone="plan" size="sm" />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Plan public discussion"
              onPress={() => navigation.navigate('PlanPublicDiscussion', { planId: plan.id, title: plan.title })}
              style={({ pressed }) => [styles.planDiscussionRow, { borderColor: theme.color.border, backgroundColor: theme.color.surface }, pressed && styles.pressed]}
            >
              <View style={[styles.planDiscussionIcon, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
                <MobileIcon name="proposal" size={18} color={theme.semantic.plan.text} />
              </View>
              <View style={styles.feedTitleWrap}>
                <AppText style={styles.planDiscussionTitle}>Open public comments</AppText>
                <AppText style={[styles.metaText, { color: theme.color.muted }]}>Ask questions, coordinate details, or reply to people interested in this Plan.</AppText>
              </View>
              <MobileIcon name="chevron-right" size={18} color={theme.color.muted} />
            </Pressable>
          </View>

          <PlanSectionDivider />

          <View style={styles.planDetailSectionFlat}>
            <View style={styles.detailSectionHeader}>
              <View style={styles.detailSectionCopy}>
                <AppText style={styles.sectionTitle}>Actions</AppText>
                <AppText style={[styles.rowBody, { color: theme.color.muted }]}>{isOwner ? 'Share this Plan or cancel it. Editing is locked after publishing.' : getPlanJoinActionCopy(plan)}</AppText>
              </View>
              {!isOwner ? <SemanticBadge label={getPlanJoinModeLabel(plan)} tone="proposal" size="sm" /> : <SemanticBadge label="Owner" tone="plan" size="sm" />}
            </View>
            <View style={styles.detailActionStack}>
              {isOwner ? (
                <View style={[styles.planOwnerManageRow, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
                  <MobileIcon name="profile" size={18} color={theme.semantic.plan.text} />
                  <View style={styles.feedTitleWrap}>
                    <AppText style={styles.planOwnerManageTitle}>Manage Plan</AppText>
                    <AppText style={[styles.metaText, { color: theme.color.muted }]}>Share this Plan or cancel it. Places and times are locked after publishing.</AppText>
                  </View>
                </View>
              ) : null}
              {isOwner ? (
                <Pressable disabled={sharing} accessibilityRole="button" onPress={() => { void sharePlan(); }} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed, sharing && styles.disabled]}>
                  <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{sharing ? 'Sharing...' : 'Share plan'}</AppText>
                </Pressable>
              ) : null}
              {canCancelPlan ? (
                <Pressable disabled={busy} accessibilityRole="button" onPress={cancelPlan} style={({ pressed }) => [styles.dangerButton, { backgroundColor: theme.semantic.danger.softBg, borderColor: theme.semantic.danger.border }, pressed && styles.pressed, busy && styles.disabled]}>
                  <AppText style={[styles.dangerButtonText, { color: theme.semantic.danger.text }]}>{busy ? 'Cancelling...' : 'Cancel plan'}</AppText>
                </Pressable>
              ) : null}
              {isOwner && plan.status === 'cancelled' ? (
                <View style={[styles.joinedState, { backgroundColor: theme.semantic.danger.softBg, borderColor: theme.semantic.danger.border }]}>
                  <MobileIcon name="close" size={18} color={theme.semantic.danger.text} />
                  <View style={styles.feedTitleWrap}>
                    <AppText style={[styles.joinedStateText, { color: theme.semantic.danger.text }]}>This Plan is cancelled</AppText>
                    <AppText style={[styles.metaText, { color: theme.color.muted }]}>It remains visible for context, but people can no longer join.</AppText>
                  </View>
                </View>
              ) : null}
              {canJoin ? (
                <View style={styles.planPrimaryActionBlock}>
                  <Pressable disabled={busy} accessibilityRole="button" onPress={joinPlan} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed, busy && styles.disabled]}>
                    <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{busy ? 'Joining...' : 'Join plan'}</AppText>
                  </Pressable>
                  <AppText style={[styles.metaText, styles.planActionFootnote, { color: theme.color.muted }]}>{plan.joinApprovalMode === 'automatic' ? 'Free join · leave anytime.' : 'Join request · owner review.'}</AppText>
                </View>
              ) : null}
              {isJoined ? (
                <View style={[styles.joinedState, { backgroundColor: theme.semantic.success.softBg, borderColor: theme.semantic.success.border }]}>
                  <MobileIcon name="proposal-accepted" size={18} color={theme.semantic.success.text} />
                  <View style={styles.feedTitleWrap}>
                    <AppText style={[styles.joinedStateText, { color: theme.semantic.success.text }]}>You joined this plan</AppText>
                    <AppText style={[styles.metaText, { color: theme.color.muted }]}>You can leave if this Plan is no longer useful.</AppText>
                  </View>
                </View>
              ) : null}
              {canLeave ? (
                <Pressable disabled={busy} accessibilityRole="button" onPress={leavePlan} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed, busy && styles.disabled]}>
                  <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{busy ? 'Updating...' : 'Leave plan'}</AppText>
                </Pressable>
              ) : null}
              {auth.user && participantStateCopy && !isJoined ? (
                <View style={[styles.planStatusActionRow, { borderColor: theme.color.border }]}>
                  <MobileIcon name="calendar" size={17} color={theme.color.muted} />
                  <AppText style={[styles.metaText, { color: theme.color.muted }]}>{participantStateCopy}</AppText>
                </View>
              ) : null}
              {!auth.user ? <InfoNotice tone="info" title="Log in to join" body="Log in first, then join this plan when it is open." /> : null}
              {actionMessage ? <InfoNotice tone="success" title="Done" body={actionMessage} /> : null}
              {actionError ? <InfoNotice tone="warning" title="Plan action failed" body={actionError} /> : null}
              {showReportActions ? <ReportContentPanel targetType="plan" targetId={plan.id} labelKey="report.button" helperKey="report.helper.content" /> : null}
            </View>
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

function makeGooglePlaceSessionToken() {
  return `native-place-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function resolvedGooglePlaceAddress(place: GoogleResolvedPlace) {
  return place.formattedAddress || place.name || '';
}

function googlePlaceStatusLabel(place: GoogleResolvedPlace) {
  if (place.validationStatus === 'confirmed') return 'Google-confirmed address';
  if (place.validationStatus === 'needs_review') return 'Google suggestion · review details';
  return 'Google place selected';
}

function GooglePlacePicker({
  value,
  onChangeText,
  disabled,
  label = 'Address or place',
  placeholder = 'Search a real address or place',
  helperText = 'Choose a Google suggestion when possible. The selected address is saved as the public meeting address.',
  languageCode,
  country,
  maxLength = 240,
}: {
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  helperText?: string;
  languageCode?: string;
  country?: string;
  maxLength?: number;
}) {
  const theme = useThemeTokens();
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<GooglePlacePrediction[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<GoogleResolvedPlace | null>(null);
  const [searching, setSearching] = useState(false);
  const [resolvingPlaceId, setResolvingPlaceId] = useState('');
  const [notice, setNotice] = useState('');
  const sessionTokenRef = useRef(makeGooglePlaceSessionToken());

  useEffect(() => {
    setQuery(value);
    setSelectedPlace((current) => {
      if (!current) return current;
      const selectedLabel = resolvedGooglePlaceAddress(current);
      return selectedLabel && selectedLabel === value ? current : null;
    });
  }, [value]);

  useEffect(() => {
    const trimmed = query.trim();
    const selectedLabel = selectedPlace ? resolvedGooglePlaceAddress(selectedPlace) : '';
    if (disabled || trimmed.length < 2 || (selectedLabel && selectedLabel === trimmed)) {
      setPredictions([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    setNotice('');
    const timeoutId = setTimeout(() => {
      api.places.googleSearch({
        q: trimmed,
        languageCode,
        country,
        take: 5,
        sessionToken: sessionTokenRef.current,
      })
        .then((response) => {
          if (cancelled) return;
          const nextPredictions = response.predictions ?? [];
          setPredictions(nextPredictions);
          if (!nextPredictions.length) setNotice('No confirmed suggestions yet. Try a more precise place name or address.');
        })
        .catch((caughtError) => {
          if (cancelled) return;
          setPredictions([]);
          setNotice(getFriendlyApiErrorMessage(caughtError, 'Google address suggestions are unavailable. You can keep typing for now.'));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 360);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [country, disabled, languageCode, query, selectedPlace]);

  function handleInputChange(nextValue: string) {
    setQuery(nextValue);
    setSelectedPlace(null);
    setNotice('');
    setPredictions([]);
    onChangeText(nextValue);
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
      const nextAddress = resolvedGooglePlaceAddress(place) || prediction.description;
      setSelectedPlace(place);
      setPredictions([]);
      setQuery(nextAddress);
      onChangeText(nextAddress);
      sessionTokenRef.current = makeGooglePlaceSessionToken();
    } catch (caughtError) {
      setNotice(getFriendlyApiErrorMessage(caughtError, 'Could not confirm this Google place. Try another suggestion.'));
    } finally {
      setResolvingPlaceId('');
    }
  }

  return (
    <View style={styles.googlePlacePicker}>
      <FormLabel label={label}>
        <TextInput
          value={query}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          placeholderTextColor={theme.color.muted}
          editable={!disabled}
          maxLength={maxLength}
          inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
          returnKeyType="search"
          style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]}
        />
      </FormLabel>
      {helperText ? <AppText style={[styles.googlePlaceHelper, { color: theme.color.muted }]}>{helperText}</AppText> : null}
      {selectedPlace ? (
        <View style={[styles.googlePlaceSelectedCard, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}>
          <View style={[styles.googlePlacePin, { backgroundColor: theme.color.surface, borderColor: theme.semantic.place.border }]}>
            <MobileIcon name="location-on" color={theme.semantic.place.text} size={17} />
          </View>
          <View style={styles.googlePlaceSuggestionCopy}>
            <SemanticBadge label={googlePlaceStatusLabel(selectedPlace)} tone="place" size="sm" />
            <AppText style={styles.googlePlaceSuggestionTitle}>{selectedPlace.name || resolvedGooglePlaceAddress(selectedPlace)}</AppText>
            {selectedPlace.name && selectedPlace.formattedAddress ? <AppText style={[styles.googlePlaceSuggestionBody, { color: theme.color.muted }]} numberOfLines={2}>{selectedPlace.formattedAddress}</AppText> : null}
          </View>
        </View>
      ) : null}
      {predictions.length ? (
        <View style={[styles.googlePlaceSuggestions, { borderColor: theme.color.border }]}>
          {predictions.map((prediction) => {
            const resolving = resolvingPlaceId === prediction.placeId;
            return (
              <Pressable
                key={prediction.placeId}
                accessibilityRole="button"
                disabled={disabled || Boolean(resolvingPlaceId)}
                onPress={() => { void selectPrediction(prediction); }}
                style={({ pressed }) => [styles.googlePlaceSuggestionRow, { borderBottomColor: theme.color.border, backgroundColor: theme.color.surface }, pressed && styles.pressed, resolving && styles.disabled]}
              >
                <View style={[styles.googlePlacePin, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}>
                  <MobileIcon name="location-on" color={theme.semantic.place.text} size={17} />
                </View>
                <View style={styles.googlePlaceSuggestionCopy}>
                  <AppText style={styles.googlePlaceSuggestionTitle} numberOfLines={1}>{prediction.mainText || prediction.description}</AppText>
                  {prediction.secondaryText ? <AppText style={[styles.googlePlaceSuggestionBody, { color: theme.color.muted }]} numberOfLines={2}>{prediction.secondaryText}</AppText> : null}
                </View>
                <View style={styles.googlePlaceSuggestionAction}>
                  {resolving ? <ActivityIndicator size="small" /> : <AppText style={[styles.googlePlaceSuggestionActionText, { color: theme.semantic.place.text }]}>Select</AppText>}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {searching ? <View style={styles.googlePlaceStatusRow}><ActivityIndicator size="small" /><AppText style={[styles.googlePlaceStatusText, { color: theme.color.muted }]}>Searching Google places...</AppText></View> : null}
      {notice ? <AppText style={[styles.googlePlaceNotice, { color: theme.color.muted }]}>{notice}</AppText> : null}
    </View>
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

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.place.bg }, pressed && styles.pressed, disabled && styles.disabled]}>
      <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{label}</AppText>
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
  const mediaUrl = activeMediaUrl(activeMedia(place.media)[0]);
  return (
    <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.choiceCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={[styles.choiceIcon, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}>
        {mediaUrl ? <Image source={{ uri: mediaUrl }} resizeMode="cover" style={styles.choiceImage as ImageStyle} /> : <MobileIcon name={place.mode === 'remote' ? 'send' : 'calendar'} size={18} color={theme.semantic.place.text} />}
      </View>
      <View style={styles.choiceCopy}>
        <View style={styles.rowTop}>
          <SemanticBadge label={placeSourceLabel(place)} tone="place" size="sm" />
          <SemanticBadge label={place.mode === 'remote' ? 'Online' : 'Offline'} tone="muted" size="sm" />
        </View>
        <AppText style={styles.choiceTitle}>{place.title}</AppText>
        <AppText style={[styles.choiceMeta, { color: theme.color.muted }]} numberOfLines={1}>{meta || 'Reusable Place'}</AppText>
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
  const mediaUrl = activeMediaUrl(place.existingMedia);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.placeTimelineRow, { borderColor: theme.color.border }, pressed && styles.pressed]}>
      {mediaUrl ? (
        <View style={styles.placeTimelineMedia}>
          <Image source={{ uri: mediaUrl }} resizeMode="cover" style={styles.placeTimelineMediaImage as ImageStyle} />
        </View>
      ) : null}
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

export function PlanIdeaDetailScreen({ route, navigation }: PlanIdeaDetailProps) {
  const theme = useThemeTokens();
  const auth = useAuth();
  const ideaKey = parseStarterPlanIdeaKey(route.params.ideaId);
  const idea = ideaKey ? starterPlanIdeas[ideaKey] : null;

  function createVersion() {
    if (!ideaKey) return;
    if (!auth.isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('CreatePlan', { initialPlanIdeaKey: ideaKey });
  }

  if (!idea) {
    return (
      <AppFixedHeaderScreen header={<AppHeader title="Plan idea" onBack={() => navigation.goBack()} />}>
        <View style={styles.listContent}>
          <InfoNotice tone="warning" title="Plan idea not found" body="This starter Plan idea is not available anymore. You can still create a Plan from scratch." />
          <PrimaryButton label="Create Plan" onPress={() => navigation.navigate('CreatePlan')} />
        </View>
      </AppFixedHeaderScreen>
    );
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Plan idea" onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: theme.semantic.plan.softBg, borderColor: theme.semantic.plan.border }]}>
          <SemanticBadge label={`Plan idea · ${idea.pack}`} tone="instruction" />
          <AppText style={styles.heroTitle}>{idea.title}</AppText>
          <AppText style={[styles.heroBody, { color: theme.color.muted }]}>{idea.description}</AppText>
          <View style={styles.previewInlineMeta}>
            <SemanticBadge label={`${idea.stops.length} stops`} tone="place" size="sm" />
            <SemanticBadge label={starterPlanIdeaMode(idea) === 'remote' ? 'Online' : 'Local'} tone="plan" size="sm" />
            <SemanticBadge label="Template" tone="muted" size="sm" />
          </View>
        </View>

        <InfoNotice tone="instruction" title="Customize first" body="This is a transparent starter Plan idea, not a real user Plan. Review the stops, change anything, then create your own version." />

        <View style={[styles.timelineDividerBlock, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
          {idea.stops.map((stop, index) => (
            <View key={`${idea.id}-${stop.title}`} style={[styles.previewPlaceRow, { borderTopColor: theme.color.border }]}>
              <View style={[styles.timelineNumber, { backgroundColor: theme.semantic.place.softBg }]}>
                <AppText style={[styles.timelineNumberText, { color: theme.semantic.place.text }]}>{index + 1}</AppText>
              </View>
              <View style={styles.timelineCopy}>
                <View style={styles.rowTop}>
                  <SemanticBadge label={stop.mode === 'remote' ? 'Online' : 'Offline'} tone="place" size="sm" />
                  <SemanticBadge label={stop.time} tone="time" size="sm" />
                </View>
                <AppText style={styles.rowTitle}>{stop.title}</AppText>
                <AppText style={[styles.metaText, { color: theme.color.muted }]}>{stop.mode === 'remote' ? (stop.onlineLabel || 'Online place') : (stop.location || 'Public meeting point')}</AppText>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.formCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <AppText style={styles.sectionTitle}>Next step</AppText>
          <AppText style={[styles.heroBody, { color: theme.color.muted }]}>Create your version opens the normal Create Plan flow with these stops prefilled. Nothing is published until you review and tap Create Plan.</AppText>
          <View style={styles.actionGrid}>
            <SecondaryButton label="Back to Plans" onPress={() => navigation.navigate('Plans')} />
            <PrimaryButton label="Create your version" onPress={createVersion} />
          </View>
        </View>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

export function CreatePlanScreen({ navigation, route }: SimpleScreenProps<'CreatePlan'>) {
  const theme = useThemeTokens();
  const { language } = useTranslation();
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
  const handledInitialPlanIdeaRef = useRef<string | null>(null);
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
  const validationNotice = error;
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
      media: place.existingMedia ? [place.existingMedia] : undefined,
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
    const ideaKey = parseStarterPlanIdeaKey(route.params?.initialPlanIdeaKey);
    if (!ideaKey || handledInitialPlanIdeaRef.current === ideaKey || places.length > 0) return;
    const idea = starterPlanIdeas[ideaKey];
    const date = toDateInputValue();
    handledInitialPlanIdeaRef.current = ideaKey;
    setPlaces(idea.stops.map((stop, index) => selectedPlaceFromPlanIdeaStop(stop, index, date)));
    setMessage('Starter Plan idea loaded. Review or change the stops before publishing.');
    navigation.setParams({ initialPlanIdeaKey: undefined });
  }, [navigation, places.length, route.params?.initialPlanIdeaKey]);


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
          mediaIds: selectedPlaceMediaIds(place),
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
          <View style={styles.planCreateCompactHeader}>
            <SemanticBadge label="Plan" tone="plan" />
            <AppText style={styles.heroTitle}>Create plan</AppText>
          </View>

          <View style={styles.stageSwitchRow}>
            <PillButton label="Build" active={stage === 'build'} onPress={() => setStage('build')} />
            <PillButton label="Preview" active={stage === 'preview'} onPress={showPreviewStage} />
          </View>

          {stage === 'build' ? (
            <>
              <View style={[styles.timelineDividerBlock, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
                {places.map((place, index) => (
                  <View key={place.id}>
                    <View style={[styles.planTimelineLineItem, styles.placeTimeLineItem, { borderTopColor: theme.color.border }]}>
                      <View style={styles.timelineCopy}>
                        <SemanticBadge label="Date / time" tone="time" size="sm" />
                        <AppText style={styles.sectionTitle}>Place {index + 1}</AppText>
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

                <Pressable accessibilityRole="button" onPress={() => openPlaceSourceSheet('new')} style={({ pressed }) => [styles.planAddPlaceRow, places.length === 0 && styles.planAddPlaceRowFirst, { borderTopColor: theme.color.border }, pressed && styles.pressed]}>
                  <View style={styles.timelineCopy}>
                    <AppText style={styles.sectionTitle}>+ Add place</AppText>
                    <AppText style={[styles.metaText, { color: theme.color.muted }]}>{places.length === 0 ? 'Choose the first stop' : 'Choose the next stop'}</AppText>
                  </View>
                  <MobileIcon name="chevron-right" color={theme.color.muted} size={18} />
                </Pressable>

                {places.length > 0 ? (
                  <View style={[styles.planTimelineLineItem, styles.planTimelineOptionalEnd, { borderTopColor: theme.color.border }]}>
                    <View style={styles.timelineCopy}>
                      <SemanticBadge label="Optional" tone="time" size="sm" />
                      <AppText style={styles.sectionTitle}>End time</AppText>
                    </View>
                    <View style={styles.twoColumnRow}>
                      <TextField label="End date" value={planEnd.date} onChangeText={(date) => updatePlanEnd({ date })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                      <TextField label="End time" value={planEnd.time} onChangeText={(time) => updatePlanEnd({ time })} placeholder="Optional" keyboardType="numbers-and-punctuation" />
                    </View>
                  </View>
                ) : null}
              </View>

              {validationNotice ? <InfoNotice tone="warning" title="Check plan" body={validationNotice} /> : null}
              {places.length > 0 ? (
                <Pressable accessibilityRole="button" onPress={showPreviewStage} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.plan.bg }, pressed && styles.pressed]}>
                  <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>Preview Plan</AppText>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <View style={[styles.previewConfirmStage, { borderTopColor: theme.color.border, borderBottomColor: theme.color.border }]}>
                <View style={styles.previewConfirmHero}>
                  <View style={styles.timelineCopy}>
                    <SemanticBadge label="Preview" tone="plan" size="sm" />
                    <AppText style={styles.previewConfirmTitle}>{previewTitle}</AppText>
                    <AppText style={[styles.metaText, { color: theme.color.muted }]}>{previewDescription}</AppText>
                  </View>
                  <View style={styles.previewInlineMeta}>
                    <SemanticBadge label={schedule.startsAt ? formatDate(schedule.startsAt) : 'Start not set'} tone="time" size="sm" />
                    <SemanticBadge label={`${places.length} ${places.length === 1 ? 'place' : 'places'}`} tone="place" size="sm" />
                    <SemanticBadge label="Free join" tone="plan" size="sm" />
                    <SemanticBadge label="Open" tone="plan" size="sm" />
                  </View>
                </View>

                <View style={[styles.previewSectionDivider, { borderTopColor: theme.color.border }]}>
                  <View style={styles.timelineCopy}>
                    <SemanticBadge label="Feed preview" tone="plan" size="sm" />
                  </View>
                  <PlanSquareDeck plan={previewPlan} />
                </View>

                <View style={[styles.previewSectionDivider, { borderTopColor: theme.color.border }]}>
                  <View style={styles.timelineCopy}>
                    <SemanticBadge label="Route" tone="place" size="sm" />
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

                {validationNotice ? <InfoNotice tone="warning" title="Check plan" body={validationNotice} /> : null}
              </View>

              {message ? <InfoNotice tone="success" title="Plans" body={message} /> : null}
              {error && !validationNotice ? <InfoNotice tone="warning" title="Could not save" body={error} /> : null}
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
                        <GooglePlacePicker label="Address or meeting point" value={detailPlace.location} onChangeText={(location) => updateSelectedPlace(detailPlaceIndex, { location })} placeholder="Search a real address or place" languageCode={language} />
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
            <View style={[styles.sourceSheet, styles.sourceChoiceSheet, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
              <View style={[styles.sourceSheetHandle, { backgroundColor: theme.color.border }]} />
              <View style={styles.sourceSheetTopbar}>
                <View style={styles.sourceSheetTitleBlock}>
                  <AppText style={styles.sourceSheetTitle}>{placePickerOpen ? (pickerTab === 'mine' ? 'My Places' : 'Hellowhen Library') : 'Add place'}</AppText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closePlaceSourceSheet} style={[styles.headerAction, { borderColor: theme.color.border }]}>
                  <MobileIcon name="close" color={theme.color.text} size={18} />
                </Pressable>
              </View>

              {!placePickerOpen ? (
                <View style={styles.sourceOptionList}>
                  <Pressable accessibilityRole="button" onPress={() => choosePlaceSource('mine')} style={({ pressed }) => [styles.sourceOption, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                    <View style={[styles.sourceOptionIcon, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}><MobileIcon name="save" color={theme.semantic.place.text} size={17} /></View>
                    <View style={styles.sourceOptionCopy}><AppText style={styles.sourceOptionTitle}>My Places</AppText></View>
                    <MobileIcon name="chevron-right" color={theme.color.muted} size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => choosePlaceSource('library')} style={({ pressed }) => [styles.sourceOption, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                    <View style={[styles.sourceOptionIcon, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}><MobileIcon name="search" color={theme.semantic.place.text} size={17} /></View>
                    <View style={styles.sourceOptionCopy}><AppText style={styles.sourceOptionTitle}>Hellowhen Library</AppText></View>
                    <MobileIcon name="chevron-right" color={theme.color.muted} size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => { closePlaceSourceSheet(); navigation.navigate('CreatePlace', { returnToCreatePlan: true, targetPlaceIndex: typeof placeSourceTarget === 'number' ? placeSourceTarget : undefined }); }} style={({ pressed }) => [styles.sourceOption, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                    <View style={[styles.sourceOptionIcon, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}><MobileIcon name="add" color={theme.semantic.place.text} size={17} /></View>
                    <View style={styles.sourceOptionCopy}><AppText style={styles.sourceOptionTitle}>New Place</AppText></View>
                    <MobileIcon name="chevron-right" color={theme.color.muted} size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={addCustomPlace} style={({ pressed }) => [styles.sourceOption, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                    <View style={[styles.sourceOptionIcon, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}><MobileIcon name="more" color={theme.semantic.place.text} size={17} /></View>
                    <View style={styles.sourceOptionCopy}><AppText style={styles.sourceOptionTitle}>Custom stop</AppText></View>
                    <MobileIcon name="chevron-right" color={theme.color.muted} size={18} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.sourceOptionList}>
                  <View style={styles.sourcePickerToolbar}>
                    <View style={styles.sourcePickerTabs}>
                      <PillButton label="My Places" active={pickerTab === 'mine'} onPress={() => choosePlaceSource('mine')} />
                      <PillButton label="Hellowhen Library" active={pickerTab === 'library'} onPress={() => choosePlaceSource('library')} />
                    </View>
                    <PillButton label="Refresh" onPress={() => { void loadReusablePlaces(); }} />
                  </View>
                  <TextField label="Search Places" value={placeQuery} onChangeText={setPlaceQuery} placeholder="Search Places" />
                  {loadingPlaces ? <View style={styles.inlineSmallLoading}><ActivityIndicator /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>Loading Places...</AppText></View> : null}
                  {!loadingPlaces && activeList.length === 0 ? <EmptyBlock title="No matching Places" body={pickerTab === 'mine' ? 'Create a Place or use a custom stop.' : 'No matching Library Places yet.'} /> : null}
                  <ScrollView style={styles.sourceListScroll} keyboardShouldPersistTaps="handled">
                    {activeList.map((place) => <PlaceChoiceCard key={place.id} place={place} onAdd={() => addReusablePlace(place)} />)}
                  </ScrollView>
                  <View style={[styles.sourcePickerFooter, { borderTopColor: theme.color.border }]}>
                    <SecondaryButton label="Sources" onPress={() => setPlacePickerOpen(false)} />
                  </View>
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
  const { language } = useTranslation();
  const editPlace = route.params?.editPlace;
  const copyFromPlace = route.params?.copyFromPlace;
  const returnToPlan = Boolean(route.params?.returnToCreatePlan);
  const isEditing = Boolean(editPlace);
  const [state, setState] = useState<PlaceCreateFormState>(() => editPlace ? placeCreateFormFromPlace(editPlace) : copyFromPlace ? placeCreateFormFromPlace(copyFromPlace) : makePlaceCreateForm(normalizePlaceLanguage(language)));
  const [step, setStep] = useState<PlaceCreateStep>('details');
  const [translationPanelOpen, setTranslationPanelOpen] = useState(() => placeHasTranslationContent(editPlace ?? copyFromPlace));
  const [existingMedia, setExistingMedia] = useState<MediaAssetDto[]>(() => isEditing ? reusablePlaceMediaForEdit(editPlace) : []);
  const [newImages, setNewImages] = useState<SelectedLocalImage[]>([]);
  const [uploadProgress, setUploadProgress] = useState<SelectedImageUploadProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing || copyFromPlace) return;
    const appLanguage = normalizePlaceLanguage(language);
    setState((current) => {
      if (current.defaultLanguage === appLanguage || current.translations.length) return current;
      return { ...current, defaultLanguage: appLanguage };
    });
  }, [copyFromPlace, isEditing, language]);

  if (!isPlansVisible()) return <DisabledPlansScreen onBack={() => navigation.goBack()} />;

  function goToImageStep() {
    if (state.title.trim().length < 3) { setError('Add a Place name before adding an image.'); return; }
    const translationError = validatePlaceTranslations(state);
    if (translationError) { setTranslationPanelOpen(true); setError(translationError); return; }
    setError(null);
    setMessage(null);
    setStep('image');
  }

  function removeExistingImage(mediaId: string) {
    if (saving) return;
    setExistingMedia((current) => current.filter((item) => item.id !== mediaId));
  }

  async function submit() {
    if (state.title.trim().length < 3) { setError('Add a Place name.'); setStep('details'); return; }
    const translationError = validatePlaceTranslations(state);
    if (translationError) { setTranslationPanelOpen(true); setError(translationError); setStep('details'); return; }
    setSaving(true);
    setError(null);
    setMessage(null);
    setUploadProgress(null);
    try {
      const uploadedMediaIds = await uploadSelectedImages(newImages.slice(0, 1), { onProgress: setUploadProgress });
      const mediaIds = [...existingMedia.map((item) => item.id), ...uploadedMediaIds].slice(0, 1);
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
        mediaIds,
      };
      const response = isEditing && editPlace ? await api.places.update(editPlace.id, body) : await api.places.create(body);
      setExistingMedia(reusablePlaceMediaForEdit(response.place));
      setNewImages([]);
      if (route.params?.returnToCreatePlan) {
        if (isEditing) {
          navigation.navigate('CreatePlan', { updatedPlace: response.place, updatedPlaceTargetIndex: route.params.targetPlaceIndex, updatedPlaceNonce: Date.now() });
        } else {
          navigation.navigate('CreatePlan', { createdPlace: response.place, createdPlaceTargetIndex: route.params.targetPlaceIndex, createdPlaceNonce: Date.now() });
        }
        return;
      }
      setMessage(isEditing ? `${response.place.title} was updated.` : `${response.place.title} was saved to My Places.`);
      if (!isEditing) {
        setState(makePlaceCreateForm(normalizePlaceLanguage(language)));
        setTranslationPanelOpen(false);
        setExistingMedia([]);
        setNewImages([]);
        setStep('details');
      }
    } catch (caughtError) {
      setError(getPlaceUploadErrorMessage(caughtError));
    } finally {
      setUploadProgress(null);
      setSaving(false);
    }
  }

  const uploadProgressLabel = formatPlaceUploadProgress(uploadProgress);
  const selectedExistingMedia = existingMedia[0];
  const selectedExistingMediaUrl = activeMediaUrl(selectedExistingMedia);
  const imageSlotFilled = Boolean(selectedExistingMedia || newImages.length > 0);

  return (
    <AppFixedHeaderScreen header={<AppHeader title={isEditing ? 'Edit place' : 'Create place'} onBack={() => navigation.goBack()} rightSlot={<HeaderAction icon="save" label="My Places" onPress={() => navigation.navigate('MyPlaces')} />} />}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardWrap}>
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.placeCreateCompactHeader}>
            <SemanticBadge label="My Place" tone="place" />
            <AppText style={styles.placeCreateTitle}>{isEditing ? 'Edit Place' : 'Create Place'}</AppText>
            <AppText style={[styles.placeCreateSubtitle, { color: theme.color.muted }]}>{isEditing ? 'Update details and image for this reusable Place.' : copyFromPlace ? 'Save a private copy, add an optional image, then return to your Plan.' : 'Save an offline or online Place with an optional image.'}</AppText>
          </View>
          <View style={styles.placeStepRow}>
            <PillButton label="1. Details" active={step === 'details'} disabled={saving} onPress={() => setStep('details')} />
            <PillButton label="2. Image" active={step === 'image'} disabled={saving} onPress={goToImageStep} />
          </View>
          {step === 'details' ? (
            <View style={[styles.formCard, styles.placeCreateFormCard, { backgroundColor: 'transparent', borderColor: theme.semantic.place.border }]}>
              <View style={styles.placeCreateSectionHeader}>
                <View style={styles.feedTitleWrap}>
                  <AppText style={styles.sectionTitle}>Place details</AppText>
                  <AppText style={[styles.metaText, { color: theme.color.muted }]}>Private by default.</AppText>
                </View>
              </View>
              <View style={styles.placeCreateDividerBlock}>
                <ModeSegment value={state.mode} onChange={(mode) => setState((current) => ({ ...current, mode }))} />
              </View>
              <TextField label="Place name" value={state.title} onChangeText={(title) => setState((current) => ({ ...current, title }))} placeholder="Quiet coffee near République" maxLength={120} />
              {state.mode === 'remote' ? (
                <>
                  <TextField label="Online label" value={state.onlineLabel} onChangeText={(onlineLabel) => setState((current) => ({ ...current, onlineLabel }))} placeholder="Zoom, Discord, website" maxLength={120} />
                  <TextField label="Online URL" value={state.onlineUrl} onChangeText={(onlineUrl) => setState((current) => ({ ...current, onlineUrl }))} placeholder="https://..." keyboardType="url" maxLength={500} />
                </>
              ) : (
                <GooglePlacePicker label="Area / address" value={state.location} onChangeText={(location) => setState((current) => ({ ...current, location }))} placeholder="Search a real address or place" languageCode={language} />
              )}
              <TextField label="Description (optional)" value={state.description} onChangeText={(description) => setState((current) => ({ ...current, description }))} placeholder="Useful details for this Place." multiline maxLength={2000} />
              <View style={styles.placeTranslationBlock}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: translationPanelOpen }}
                  onPress={() => setTranslationPanelOpen((open) => !open)}
                  style={({ pressed }) => [styles.placeTranslationToggle, { borderColor: theme.semantic.place.border, backgroundColor: theme.color.surface }, pressed && styles.pressed]}
                >
                  <View style={styles.feedTitleWrap}>
                    <AppText style={styles.placeTranslationAddTitle}>{translationPanelOpen ? 'Hide language options' : 'Language & translations'}</AppText>
                    <AppText style={[styles.metaText, { color: theme.color.muted }]}>{placeTranslationSummary(state)}</AppText>
                  </View>
                  <MobileIcon name={translationPanelOpen ? 'chevron-up' : 'chevron-down'} color={theme.color.muted} size={18} />
                </Pressable>

                {translationPanelOpen ? (
                  <View style={styles.placeTranslationPanel}>
                    <View style={styles.placeTranslationSummaryRow}>
                      <View style={styles.feedTitleWrap}>
                        <AppText style={styles.formLabel}>Languages</AppText>
                        <AppText style={[styles.metaText, { color: theme.color.muted }]}>Translations are optional. The original Place language follows your app language when you create a new Place.</AppText>
                      </View>
                      <SemanticBadge label={`Original content: ${placeLanguageLabel(state.defaultLanguage)}`} tone="place" />
                    </View>

                    {state.translations.map((translation) => (
                      <View key={translation.languageCode} style={[styles.placeTranslationFields, { borderColor: theme.semantic.place.border, backgroundColor: theme.semantic.place.softBg }]}>
                        <View style={styles.placeTranslationFieldsHeader}>
                          <View style={styles.feedTitleWrap}>
                            <AppText style={styles.formLabel}>Manual translation for {placeLanguageLabel(translation.languageCode)}</AppText>
                            <AppText style={[styles.metaText, { color: theme.color.muted }]}>Complete both fields, or leave both empty and remove this language.</AppText>
                          </View>
                          <SecondaryButton label="Remove" onPress={() => setState((current) => removePlaceTranslationDraft(current, translation.languageCode))} />
                        </View>
                        <TextField label="Translated Place name (optional)" value={translation.title} onChangeText={(title) => setState((current) => updatePlaceTranslationDraft(current, { ...translation, title }))} placeholder="Translated place name" maxLength={120} />
                        <TextField label="Translated description (optional)" value={translation.description} onChangeText={(description) => setState((current) => updatePlaceTranslationDraft(current, { ...translation, description }))} placeholder="Translated description" multiline maxLength={2000} />
                      </View>
                    ))}

                    {!state.translations.length ? (
                      <AppText style={[styles.metaText, styles.placeTranslationEmptyText, { color: theme.color.muted }]}>Translations are optional. Add a language only if you want to write a manual translation for this Place.</AppText>
                    ) : null}

                    {availablePlaceTranslationLanguages(state).length ? (
                      <View style={[styles.placeTranslationAddRow, { borderColor: theme.semantic.place.border, backgroundColor: theme.color.surface }]}>
                        <View style={[styles.sourceOptionIcon, { backgroundColor: theme.semantic.place.softBg, borderColor: theme.semantic.place.border }]}><MobileIcon name="add" color={theme.semantic.place.text} size={16} /></View>
                        <View style={styles.sourceOptionCopy}>
                          <AppText style={styles.placeTranslationAddTitle}>{state.translations.length ? 'Add another language' : 'Add language'}</AppText>
                          <AppText style={[styles.metaText, { color: theme.color.muted }]}>Manual translation</AppText>
                          <View style={styles.placeLanguageChips}>
                            {availablePlaceTranslationLanguages(state).map((languageCode) => (
                              <PillButton
                                key={languageCode}
                                label={placeLanguageLabel(languageCode)}
                                active={false}
                                onPress={() => setState((current) => addPlaceTranslationDraft(current, languageCode))}
                              />
                            ))}
                          </View>
                        </View>
                      </View>
                    ) : (
                      <AppText style={[styles.metaText, { color: theme.color.muted }]}>All supported languages are already added.</AppText>
                    )}
                  </View>
                ) : null}
              </View>
              {message ? <InfoNotice tone="success" body={message} /> : null}
              {error ? <InfoNotice tone="danger" body={error} /> : null}
              <View style={[styles.placeCreateActionFooter, { borderTopColor: theme.color.border, backgroundColor: theme.color.background }]}>
                <PrimaryButton label="Continue to image" onPress={goToImageStep} disabled={saving || state.title.trim().length < 3} />
              </View>
            </View>
          ) : (
            <View style={[styles.formCard, styles.placeCreateFormCard, { backgroundColor: 'transparent', borderColor: theme.semantic.place.border }]}>
              <View style={styles.placeCreateSectionHeader}>
                <View style={styles.feedTitleWrap}>
                  <AppText style={styles.sectionTitle}>Place image</AppText>
                  <AppText style={[styles.metaText, { color: theme.color.muted }]}>Optional. One image can become the background for Plan cards later.</AppText>
                </View>
              </View>
              {selectedExistingMedia && selectedExistingMediaUrl ? (
                <View style={[styles.placeImagePreviewCard, { borderColor: theme.color.border, backgroundColor: theme.color.surface }]}>
                  <Image source={{ uri: selectedExistingMediaUrl }} style={styles.placeImagePreview as ImageStyle} resizeMode="cover" />
                  <View style={styles.placeImagePreviewFooter}>
                    <View style={styles.feedTitleWrap}>
                      <AppText style={styles.formLabel}>Current image</AppText>
                      <AppText style={[styles.metaText, { color: theme.color.muted }]}>Remove it to choose a different image.</AppText>
                    </View>
                    <SecondaryButton label="Remove" disabled={saving} onPress={() => removeExistingImage(selectedExistingMedia.id)} />
                  </View>
                </View>
              ) : null}
              <ImagePickerField
                images={newImages}
                onChange={(images) => setNewImages(images.slice(0, 1))}
                disabled={saving || Boolean(selectedExistingMedia)}
                maxImages={1}
                label="Place image"
                hint={imageSlotFilled ? 'Remove the current image to choose another one.' : 'Add one photo that represents this Place.'}
                reviewBody="Place images are optional and should show the location or online context without private/sensitive information."
              />
              {uploadProgressLabel ? <InfoNotice tone="info" title="Uploading image" body={uploadProgressLabel} /> : null}
              {message ? <InfoNotice tone="success" body={message} /> : null}
              {error ? <InfoNotice tone="danger" body={error} /> : null}
              <View style={[styles.placeCreateActionFooter, { borderTopColor: theme.color.border, backgroundColor: theme.color.background }]}>
                <View style={styles.twoColumnRow}>
                  <SecondaryButton label="Back" onPress={() => setStep('details')} disabled={saving} />
                  <PrimaryButton label={saving ? uploadProgressLabel ? 'Uploading...' : 'Saving...' : returnToPlan ? isEditing ? 'Update and return' : 'Save and return' : isEditing ? 'Update Place' : 'Save Place'} onPress={() => { void submit(); }} disabled={saving || state.title.trim().length < 3} />
                </View>
              </View>
            </View>
          )}
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
  headerAction: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  headerActionBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  headerActionBadgeText: { fontSize: 10, fontWeight: '900', lineHeight: 12 },
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
  listContent: { gap: 10, paddingBottom: 34 },
  planCreateCompactHeader: { gap: 7, paddingTop: 0, paddingBottom: 0 },
  placeCreateCompactHeader: { gap: 7, paddingTop: 2, paddingBottom: 4 },
  placeCreateTitle: { fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -0.85 },
  placeCreateSubtitle: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  stageSwitchRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: -1 },
  timelineDividerBlock: { gap: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  planEmptyInline: { borderTopWidth: 0, paddingVertical: 12, gap: 3 },
  planTimelineLineItem: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 13, gap: 10 },
  placeTimeLineItem: { paddingBottom: 11 },
  planTimelinePlaceAction: { paddingVertical: 18 },
  planAddPlaceRow: { minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  planAddPlaceRowFirst: { borderTopWidth: 0 },
  planTimelineOptionalEnd: { opacity: 0.9, paddingTop: 12 },
  placeTimelineRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeDetailSheetContent: { gap: 10, paddingBottom: 12 },
  placePickerPanel: { gap: 10 },
  sourceSheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sourceSheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  sourceSheet: { maxHeight: '86%', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24, gap: 10 },
  sourceChoiceSheet: { maxHeight: '70%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 15, paddingTop: 8, paddingBottom: 14, gap: 6 },
  sourceSheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 999, marginBottom: 2, opacity: 0.9 },
  sourceSheetTopbar: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sourceSheetTitleBlock: { flex: 1, minWidth: 0 },
  sourceSheetTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.25 },
  sourceOptionList: { gap: 0 },
  sourceOption: { minHeight: 50, borderRadius: 0, borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 0, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceOptionIcon: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sourceOptionCopy: { flex: 1, minWidth: 0 },
  sourceOptionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  sourcePickerToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 2, paddingBottom: 2 },
  sourcePickerTabs: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' },
  sourcePickerFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, alignItems: 'flex-start' },
  sourceListScroll: { maxHeight: 270 },
  googlePlacePicker: { gap: 8 },
  googlePlaceHelper: { fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: -4 },
  googlePlaceSelectedCard: { borderRadius: 18, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  googlePlaceSuggestions: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  googlePlaceSuggestionRow: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  googlePlacePin: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  googlePlaceSuggestionCopy: { flex: 1, minWidth: 0, gap: 4 },
  googlePlaceSuggestionTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  googlePlaceSuggestionBody: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  googlePlaceSuggestionAction: { minWidth: 54, alignItems: 'flex-end', justifyContent: 'center' },
  googlePlaceSuggestionActionText: { fontSize: 12, lineHeight: 17, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  googlePlaceStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  googlePlaceStatusText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  googlePlaceNotice: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  deckFeedContent: { gap: 20, paddingTop: 2, paddingBottom: 34 },
  deckSection: { gap: 10 },
  deckSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 2 },
  deckSectionCopy: { flex: 1, minWidth: 0, gap: 2 },
  deckSectionTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.3 },
  deckSectionMeta: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  inlineLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontWeight: '800' },
  planHeaderShareButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  planDetailContent: { gap: 18, paddingBottom: 44 },
  planDetailHero: { gap: 10, paddingTop: 4 },
  planDetailEyebrow: { fontSize: 13, lineHeight: 18, fontWeight: '900', letterSpacing: 0.65, textTransform: 'uppercase' },
  planDetailTitle: { fontSize: 33, lineHeight: 38, fontWeight: '900', letterSpacing: -0.95 },
  planDetailStart: { fontSize: 14, lineHeight: 20, fontWeight: '900' },
  planDetailOwnerLine: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  planDetailOwnerPrefix: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  planDetailOwnerName: { fontSize: 13, lineHeight: 18, fontWeight: '900' },
  planDetailChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingTop: 2 },
  planDetailDescription: { fontSize: 15, lineHeight: 22, fontWeight: '700', paddingTop: 3 },
  planSectionDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: -2 },
  planDetailSectionFlat: { gap: 12 },
  planRouteStop: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14, gap: 10 },
  planRouteStopTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planRouteTimeline: { width: 34, alignItems: 'center' },
  planRouteNumber: { width: 31, height: 31, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  planRouteNumberText: { fontSize: 13, fontWeight: '900' },
  planRouteCopy: { flex: 1, minWidth: 0, gap: 8 },
  planRouteTimeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  planRouteTime: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 17, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  planRouteSource: { flexShrink: 0, fontSize: 11, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase' },
  planRouteContentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planRouteTextBlock: { flex: 1, minWidth: 0, gap: 5 },
  planRouteTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.25 },
  planRouteMeta: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  planRouteLocationCard: { marginTop: 4, borderRadius: 18, borderWidth: 1, padding: 10, gap: 9 },
  planRouteLocationIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  planRouteLocationCopy: { gap: 2 },
  planRouteLocationLabel: { fontSize: 11, lineHeight: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.45 },
  planRouteLocationValue: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  planRouteLocationAction: { alignSelf: 'flex-start', minHeight: 32, borderRadius: 16, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  planRouteLocationActionText: { fontSize: 12, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.35 },
  planPresenceCard: { marginTop: 4, borderRadius: 18, borderWidth: 1, padding: 11, gap: 9 },
  planPresenceHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planPresenceCopy: { flex: 1, minWidth: 0, gap: 3 },
  planPresenceTitle: { fontSize: 13, lineHeight: 18, fontWeight: '900' },
  planPresenceBody: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  planPresenceButton: { minHeight: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  planPresenceButtonText: { fontSize: 12, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.35 },
  planRouteDescription: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  planRouteImageWrap: { width: 64, height: 64, borderRadius: 19, overflow: 'hidden' },
  planRouteImage: { width: '100%', height: '100%' },
  planDetailInfoList: { gap: 0 },
  planDetailInfoRow: { minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  planDetailInfoLabel: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  planDetailInfoValue: { flex: 1, textAlign: 'right', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  planOwnerRow: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  planOwnerAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  planOwnerInitial: { fontSize: 15, fontWeight: '900' },
  planOwnerCopy: { flex: 1, minWidth: 0, gap: 2 },
  planOwnerLabel: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  planOwnerName: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  planOwnerManageRow: { borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  planOwnerManageTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  planDiscussionRow: { minHeight: 64, borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  planDiscussionIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  planDiscussionTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  rowCard: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 9 },
  placeRowContent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  placeRowCopy: { flex: 1, minWidth: 0, gap: 7 },
  placeThumb: { width: 58, height: 58, borderRadius: 18, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  placeThumbImage: { width: '100%', height: '100%' },
  choiceImage: { width: '100%', height: '100%' },
  placeTimelineMedia: { width: 54, height: 54, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  placeTimelineMediaImage: { width: '100%', height: '100%' },
  placeManageActions: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, flexDirection: 'row', gap: 8 },
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
  planPrimaryActionBlock: { gap: 7 },
  planActionFootnote: { textAlign: 'center' },
  planStatusActionRow: { minHeight: 44, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statGrid: { flexDirection: 'row', gap: 8 },
  statPill: { flex: 1, borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 11, gap: 2 },
  statValue: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  statLabel: { fontSize: 11, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.45 },
  joinedState: { minHeight: 46, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 14, paddingVertical: 10 },
  joinedStateText: { fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 13, alignSelf: 'stretch' },
  secondaryButtonText: { fontWeight: '900' },
  dangerButton: { minHeight: 48, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 13, alignSelf: 'stretch' },
  dangerButtonText: { fontWeight: '900' },
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
  placeCreateFormCard: { borderRadius: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, paddingHorizontal: 0, paddingTop: 13, gap: 14 },
  placeStepRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  placeImagePreviewCard: { borderRadius: 22, borderWidth: 1, overflow: 'hidden', gap: 0 },
  placeImagePreview: { width: '100%', height: 210 },
  placeImagePreviewFooter: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeCreateSectionHeader: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  placeCreateDividerBlock: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14 },
  placeCreateActionFooter: { marginTop: 3, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, paddingBottom: Platform.OS === 'ios' ? 4 : 0 },
  placeTranslationBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, gap: 10 },
  placeTranslationToggle: { minHeight: 58, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  placeTranslationPanel: { gap: 10 },
  placeTranslationSummaryRow: { gap: 8 },
  placeTranslationFields: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 10 },
  placeTranslationFieldsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  placeTranslationAddRow: { minHeight: 58, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeTranslationAddTitle: { fontSize: 14, fontWeight: '900' },
  placeLanguageChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  placeTranslationEmptyText: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  formField: { gap: 7, flex: 1, minWidth: 0 },
  formLabel: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, fontWeight: '700' },
  textArea: { minHeight: 92, lineHeight: 20 },
  modeSegment: { borderRadius: 18, borderWidth: 1, padding: 4, flexDirection: 'row', gap: 4 },
  modeSegmentButton: { flex: 1, minHeight: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  modeSegmentText: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  pillButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  pillButtonText: { fontSize: 12, fontWeight: '900' },
  choiceCard: { borderRadius: 0, borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  choiceIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1, minWidth: 0, gap: 3 },
  choiceTitle: { fontSize: 16, lineHeight: 20, fontWeight: '900' },
  choiceMeta: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  addMini: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
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
  previewConfirmStage: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, gap: 15, paddingVertical: 14 },
  previewConfirmHero: { gap: 12 },
  previewInlineMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  previewConfirmTitle: { fontSize: 28, lineHeight: 32, fontWeight: '900', letterSpacing: -0.75 },
  previewSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewSummaryCell: { width: '48%', minHeight: 74, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'center', gap: 4, paddingVertical: 9 },
  previewSummaryLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewSummaryValue: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  previewSectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 12 },
  previewPlaceRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  previewFinalNote: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 8 },
  supportSection: { marginTop: 2 },
  planFilterContent: { gap: 14, paddingBottom: 34 },
  planFilterHero: { borderRadius: 24 },
  planFilterSearchCard: { borderWidth: 1, borderRadius: 22, padding: 14, gap: 8 },
  planFilterSearchInputWrap: { minHeight: 48, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  planFilterSearchInput: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '800', paddingVertical: Platform.OS === 'ios' ? 12 : 8 },
  planFilterSearchClear: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  planFilterSearchClearText: { fontSize: 12, fontWeight: '900' },
  planFilterGroup: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 12 },
  planFilterOptionGrid: { gap: 8 },
  planFilterOption: { minHeight: 58, borderRadius: 18, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  planFilterCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  planFilterOptionCopy: { flex: 1, minWidth: 0, gap: 2 },
  planFilterFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
