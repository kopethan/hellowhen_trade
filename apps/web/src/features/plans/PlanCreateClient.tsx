'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import type { GoogleResolvedPlace, MediaAssetDto, PlaceDto, PlaceStaticMapDto, PlanDto, PlanPlaceDto, PlanPlaceKind, PlanPlaceMode } from '@hellowhen/contracts';
import { buildGeneratedPlanDisplay, cascadePlanStopDateTimeChange, getOnlinePlaceProviderMetadata, isPlanJoinClosed, parseStarterPlanIdeaKey, PLAN_MIN_STOP_START_GAP_MINUTES, reorderPlanStopsPreservingTimeline, starterPlanIdeas, type StarterPlanIdeaStop } from '@hellowhen/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { buildWebUserSessionStorageKey } from '../../lib/webUserSessionStorage';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { GooglePlacePicker } from './GooglePlacePicker';
import { emptyProviderAddressFormState, offlineProviderAddressError, onlineDestinationError, providerAddressFormStateFromGooglePlace, providerAddressFormStateFromStoredPlace, providerAddressPayloadFromFormState, providerAddressStatusLabel, type WebProviderAddressFormState } from './placeAddressForm';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { PlanPreviewDeck } from './PlanPreviewDeck';
import { buildPlanSchedule, toDateInputValue, toTimeInputValue } from './planSchedule';
import { planMediaSrc } from './plansPresentation';

type Translator = ReturnType<typeof useWebTranslation>['t'];

type PlaceFormState = {
  id: string;
  kind: PlanPlaceKind;
  sourcePlaceId?: string;
  sourcePlaceSource?: 'custom' | 'my_place' | 'hellowhen_library';
  sourcePlaceTitle?: string;
  mode: PlanPlaceMode;
  date: string;
  time: string;
  title: string;
  location: string;
  providerAddress: WebProviderAddressFormState;
  onlineLabel: string;
  onlineUrl: string;
  existingMedia: MediaAssetDto | null;
  existingMediaBelongsToPlanPlace?: boolean;
  existingStaticMap: PlaceStaticMapDto | null;
  media: MediaAssetDto | null;
  uploading: boolean;
};

function makePlace(index: number, date = toDateInputValue(), time?: string): PlaceFormState {
  return {
    id: `place-${Date.now()}-${index}`,
    sourcePlaceSource: 'custom',
    kind: 'place',
    mode: 'local',
    date,
    time: time ?? (index === 0 ? '13:00' : ''),
    title: '',
    location: '',
    providerAddress: emptyProviderAddressFormState(),
    onlineLabel: '',
    onlineUrl: '',
    existingMedia: null,
    existingMediaBelongsToPlanPlace: false,
    existingStaticMap: null,
    media: null,
    uploading: false,
  };
}

function isCustomPlanStop(place: Pick<PlaceFormState, 'kind'>) {
  return (place.kind ?? 'place') !== 'place';
}


function localizedOnlineProviderHint(value: string, t: Translator) {
  const rawUrl = value.trim();
  if (!rawUrl) return t('places.editor.provider.empty');
  const metadata = getOnlinePlaceProviderMetadata(rawUrl);
  if (!metadata) return t('places.editor.provider.invalid');
  return t('places.editor.provider.detected', { provider: metadata.label });
}

function customPlanStopTitle(kind: CustomPlanStopKind, t: Translator) {
  if (kind === 'pause') return t('plans.create.customStop.pause');
  if (kind === 'free_time') return t('plans.create.customStop.freeTime');
  if (kind === 'meeting_point') return t('plans.create.customStop.meetingPoint');
  return t('plans.create.customStop.custom');
}

function makeCustomPlanStop(kind: CustomPlanStopKind, index: number, date = toDateInputValue(), time?: string): PlaceFormState {
  return {
    id: `custom-stop-${Date.now()}-${index}`,
    sourcePlaceSource: 'custom',
    kind,
    mode: 'local',
    date,
    time: time ?? (index === 0 ? '13:00' : ''),
    title: '',
    location: '',
    providerAddress: emptyProviderAddressFormState(),
    onlineLabel: '',
    onlineUrl: '',
    existingMedia: null,
    existingMediaBelongsToPlanPlace: false,
    existingStaticMap: null,
    media: null,
    uploading: false,
  };
}


function parsePlaceStartParts(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim()) || !/^\d{2}:\d{2}$/.test(timeValue.trim())) return null;
  const parsed = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startPartsFromDate(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0');
  return {
    date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}

function nextPlaceStartParts(places: PlaceFormState[]) {
  const previous = places[places.length - 1];
  const previousStart = previous ? parsePlaceStartParts(previous.date, previous.time) : null;
  if (!previousStart) return { date: previous?.date || toDateInputValue(), time: places.length === 0 ? '13:00' : '' };
  const nextStart = new Date(previousStart);
  nextStart.setMinutes(nextStart.getMinutes() + PLAN_MIN_STOP_START_GAP_MINUTES);
  return startPartsFromDate(nextStart);
}

function makePlaceFromPlanIdeaStop(stop: StarterPlanIdeaStop, index: number, date = toDateInputValue()): PlaceFormState {
  return {
    id: `plan-idea-place-${Date.now()}-${index}`,
    sourcePlaceSource: 'custom',
    kind: 'place',
    mode: stop.mode,
    date,
    time: stop.time,
    title: stop.title,
    location: '',
    providerAddress: emptyProviderAddressFormState(),
    onlineLabel: stop.mode === 'remote' ? stop.onlineLabel ?? '' : '',
    onlineUrl: stop.mode === 'remote' ? stop.onlineUrl ?? '' : '',
    existingMedia: null,
    existingMediaBelongsToPlanPlace: false,
    existingStaticMap: null,
    media: null,
    uploading: false,
  };
}

function placeFormFromPublishedPlanPlace(place: PlanPlaceDto, index: number): PlaceFormState {
  const customStop = (place.kind ?? 'place') !== 'place';
  const providerAddress = customStop || place.mode === 'remote'
    ? emptyProviderAddressFormState()
    : providerAddressFormStateFromStoredPlace(place);
  const sourcePlaceSource = customStop ? 'custom' : place.source ?? (place.placeId ? 'my_place' : 'custom');
  const localLocation = providerAddress.formattedAddress || place.formattedAddress || place.addressPublicText || '';
  const onlineLabel = customStop ? '' : place.onlineLabel ?? '';
  const onlineUrl = customStop ? '' : place.onlineUrl ?? '';
  return {
    id: place.id || `published-place-${index}`,
    kind: place.kind ?? 'place',
    sourcePlaceId: customStop ? undefined : place.placeId ?? undefined,
    sourcePlaceSource,
    sourcePlaceTitle: customStop ? undefined : place.sourcePlace?.title ?? place.title,
    mode: customStop ? 'local' : place.mode ?? 'local',
    date: toDateInputValue(place.startsAt ?? undefined),
    time: toTimeInputValue(place.startsAt ?? undefined, ''),
    title: place.title,
    location: customStop ? '' : place.mode === 'remote' ? onlineLabel || onlineUrl : localLocation,
    providerAddress,
    onlineLabel,
    onlineUrl,
    existingMedia: customStop ? null : place.media?.[0] ?? place.sourcePlace?.media?.[0] ?? null,
    existingMediaBelongsToPlanPlace: Boolean(!customStop && place.media?.[0]),
    existingStaticMap: customStop ? null : place.staticMap ?? place.sourcePlace?.staticMap ?? null,
    media: null,
    uploading: false,
  };
}


const PLAN_CREATE_DRAFT_SCOPE = 'plan-create-draft';
const PLAN_CREATE_PENDING_PLACE_INDEX_SCOPE = 'plan-create-pending-place-index';

type StoredPlaceFormState = Omit<PlaceFormState, 'uploading'>;

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

type PlanJoinDeadlinePreset = 'start' | '1h' | '3h' | '1d' | 'custom';

type PlanJoinDeadlineState = {
  preset: PlanJoinDeadlinePreset;
  date: string;
  time: string;
};

type PlanParticipantCapacityState = {
  mode: 'unlimited' | 'limited';
  limit: string;
};

type PlanCreateStage = 'build' | 'preview';
type PlacePickerTarget = number | 'new';
type PlacePickerView = 'source' | 'list' | 'custom_stop';

type CustomPlanStopKind = Exclude<PlanPlaceKind, 'place'>;

const EMPTY_ADVANCED_PLAN_DETAILS: AdvancedPlanDetailsState = {
  title: '',
  description: '',
  category: '',
  tags: '',
};

const EMPTY_PLAN_END_STATE: PlanEndState = {
  date: '',
  time: '',
};

const DEFAULT_PLAN_JOIN_DEADLINE: PlanJoinDeadlineState = {
  preset: 'start',
  date: '',
  time: '',
};

const DEFAULT_PLAN_PARTICIPANT_CAPACITY: PlanParticipantCapacityState = {
  mode: 'unlimited',
  limit: '8',
};

function safeReadAdvancedPlanDetails(storageKey: string | null): AdvancedPlanDetailsState {
  if (typeof window === 'undefined' || !storageKey) return EMPTY_ADVANCED_PLAN_DETAILS;
  try {
    const rawDraft = window.sessionStorage.getItem(storageKey);
    if (!rawDraft) return EMPTY_ADVANCED_PLAN_DETAILS;
    const parsed = JSON.parse(rawDraft) as { advanced?: Partial<AdvancedPlanDetailsState> };
    return {
      title: typeof parsed.advanced?.title === 'string' ? parsed.advanced.title : '',
      description: typeof parsed.advanced?.description === 'string' ? parsed.advanced.description : '',
      category: typeof parsed.advanced?.category === 'string' ? parsed.advanced.category : '',
      tags: typeof parsed.advanced?.tags === 'string' ? parsed.advanced.tags : '',
    };
  } catch {
    return EMPTY_ADVANCED_PLAN_DETAILS;
  }
}

function safeReadPlanEndState(storageKey: string | null): PlanEndState {
  if (typeof window === 'undefined' || !storageKey) return EMPTY_PLAN_END_STATE;
  try {
    const rawDraft = window.sessionStorage.getItem(storageKey);
    if (!rawDraft) return EMPTY_PLAN_END_STATE;
    const parsed = JSON.parse(rawDraft) as { end?: Partial<PlanEndState> };
    return {
      date: typeof parsed.end?.date === 'string' ? parsed.end.date : '',
      time: typeof parsed.end?.time === 'string' ? parsed.end.time : '',
    };
  } catch {
    return EMPTY_PLAN_END_STATE;
  }
}

function safeReadPlanJoinDeadline(storageKey: string | null): PlanJoinDeadlineState {
  if (typeof window === 'undefined' || !storageKey) return DEFAULT_PLAN_JOIN_DEADLINE;
  try {
    const rawDraft = window.sessionStorage.getItem(storageKey);
    if (!rawDraft) return DEFAULT_PLAN_JOIN_DEADLINE;
    const parsed = JSON.parse(rawDraft) as { joinDeadline?: Partial<PlanJoinDeadlineState> };
    const preset = parsed.joinDeadline?.preset;
    return {
      preset: preset === '1h' || preset === '3h' || preset === '1d' || preset === 'custom' ? preset : 'start',
      date: typeof parsed.joinDeadline?.date === 'string' ? parsed.joinDeadline.date : '',
      time: typeof parsed.joinDeadline?.time === 'string' ? parsed.joinDeadline.time : '',
    };
  } catch {
    return DEFAULT_PLAN_JOIN_DEADLINE;
  }
}

function safeReadPlanParticipantCapacity(storageKey: string | null): PlanParticipantCapacityState {
  if (typeof window === 'undefined' || !storageKey) return DEFAULT_PLAN_PARTICIPANT_CAPACITY;
  try {
    const rawDraft = window.sessionStorage.getItem(storageKey);
    if (!rawDraft) return DEFAULT_PLAN_PARTICIPANT_CAPACITY;
    const parsed = JSON.parse(rawDraft) as { participantCapacity?: Partial<PlanParticipantCapacityState> };
    return {
      mode: parsed.participantCapacity?.mode === 'limited' ? 'limited' : 'unlimited',
      limit: typeof parsed.participantCapacity?.limit === 'string' && parsed.participantCapacity.limit ? parsed.participantCapacity.limit : '8',
    };
  } catch {
    return DEFAULT_PLAN_PARTICIPANT_CAPACITY;
  }
}

function safeReadPlanDraft(storageKey: string | null): PlaceFormState[] {
  if (typeof window === 'undefined' || !storageKey) return [];
  try {
    const rawDraft = window.sessionStorage.getItem(storageKey);
    if (!rawDraft) return [];
    const parsed = JSON.parse(rawDraft) as { places?: StoredPlaceFormState[] };
    if (!Array.isArray(parsed.places)) return [];
    return parsed.places.map((place, index) => ({
      id: typeof place.id === 'string' ? place.id : `place-${Date.now()}-${index}`,
      sourcePlaceId: place.sourcePlaceId,
      sourcePlaceSource: place.sourcePlaceSource ?? 'custom',
      sourcePlaceTitle: place.sourcePlaceTitle,
      kind: place.kind === 'pause' || place.kind === 'free_time' || place.kind === 'meeting_point' || place.kind === 'custom' ? place.kind : 'place',
      mode: place.mode === 'remote' ? 'remote' : 'local',
      date: place.date || toDateInputValue(),
      time: place.time || '',
      title: place.title || '',
      location: place.location || '',
      providerAddress: place.providerAddress ?? emptyProviderAddressFormState(),
      onlineLabel: place.onlineLabel || '',
      onlineUrl: place.onlineUrl || '',
      existingMedia: place.existingMedia ?? null,
      existingStaticMap: place.existingStaticMap ?? null,
      media: place.media ?? null,
      uploading: false,
    }));
  } catch {
    return [];
  }
}

function storePlanDraft(storageKey: string | null, places: PlaceFormState[], advanced: AdvancedPlanDetailsState = EMPTY_ADVANCED_PLAN_DETAILS, end: PlanEndState = EMPTY_PLAN_END_STATE, joinDeadline: PlanJoinDeadlineState = DEFAULT_PLAN_JOIN_DEADLINE, participantCapacity: PlanParticipantCapacityState = DEFAULT_PLAN_PARTICIPANT_CAPACITY) {
  if (typeof window === 'undefined' || !storageKey) return;
  const safePlaces: StoredPlaceFormState[] = places.map(({ uploading: _uploading, ...place }) => place);
  window.sessionStorage.setItem(storageKey, JSON.stringify({ places: safePlaces, advanced, end, joinDeadline, participantCapacity }));
}

function clearPlanDraft(storageKey: string | null, pendingPlaceIndexKey: string | null) {
  if (typeof window === 'undefined') return;
  if (storageKey) window.sessionStorage.removeItem(storageKey);
  if (pendingPlaceIndexKey) window.sessionStorage.removeItem(pendingPlaceIndexKey);
}

function setPendingCreatedPlaceIndex(storageKey: string | null, index: number | null) {
  if (typeof window === 'undefined' || !storageKey) return;
  if (index === null) window.sessionStorage.removeItem(storageKey);
  else window.sessionStorage.setItem(storageKey, String(index));
}

function takePendingCreatedPlaceIndex(storageKey: string | null) {
  if (typeof window === 'undefined' || !storageKey) return null;
  const rawIndex = window.sessionStorage.getItem(storageKey);
  window.sessionStorage.removeItem(storageKey);
  if (rawIndex === null) return null;
  const index = Number(rawIndex);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function normalizePlanMediaUpload(value: unknown): MediaAssetDto | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { media?: unknown; id?: unknown; url?: unknown };
  if (record.media && typeof record.media === 'object') return record.media as MediaAssetDto;
  if (typeof record.id === 'string' && typeof record.url === 'string') return value as MediaAssetDto;
  return null;
}

function selectedMediaIds(media: MediaAssetDto | null) {
  return media?.id ? [media.id] : undefined;
}

function selectedPlanPlaceMediaIds(place: PlaceFormState) {
  if (isCustomPlanStop(place)) return undefined;
  // Saved Place images already belong to the source Place. Plan Places can
  // display them through the existing source-place media fallback. Preserve an
  // existing Plan-specific image while editing, but never try to reattach a
  // source Place image to the Plan Place.
  return selectedMediaIds(place.media ?? (place.existingMediaBelongsToPlanPlace ? place.existingMedia : null));
}

function planJoinDeadlinePresetOffsetMinutes(preset: PlanJoinDeadlinePreset) {
  if (preset === '1h') return 60;
  if (preset === '3h') return 180;
  if (preset === '1d') return 24 * 60;
  return 0;
}

function planJoinDeadlinePresetLabel(preset: PlanJoinDeadlinePreset, t: Translator) {
  if (preset === '1h') return t('plans.create.joinDeadline.oneHourBefore');
  if (preset === '3h') return t('plans.create.joinDeadline.threeHoursBefore');
  if (preset === '1d') return t('plans.create.joinDeadline.oneDayBefore');
  if (preset === 'custom') return t('plans.create.joinDeadline.custom');
  return t('plans.create.joinDeadline.atStart');
}

function planJoinDeadlineStateFromPublishedPlan(plan: PlanDto): PlanJoinDeadlineState {
  const startsAt = new Date(plan.startsAt);
  const joinClosesAt = new Date(plan.joinClosesAt ?? plan.startsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(joinClosesAt.getTime())) return DEFAULT_PLAN_JOIN_DEADLINE;
  const diffMinutes = Math.round((startsAt.getTime() - joinClosesAt.getTime()) / 60_000);
  if (diffMinutes === 0) return DEFAULT_PLAN_JOIN_DEADLINE;
  if (diffMinutes === 60) return { preset: '1h', date: '', time: '' };
  if (diffMinutes === 180) return { preset: '3h', date: '', time: '' };
  if (diffMinutes === 24 * 60) return { preset: '1d', date: '', time: '' };
  return { preset: 'custom', date: toDateInputValue(plan.joinClosesAt ?? plan.startsAt), time: toTimeInputValue(plan.joinClosesAt ?? plan.startsAt, '') };
}

function resolvePlanJoinDeadline(state: PlanJoinDeadlineState, startsAt: string, t: Translator) {
  const presetLabel = planJoinDeadlinePresetLabel(state.preset, t);
  if (!startsAt) return { joinClosesAt: '', presetLabel, deadlineLabel: '', error: t('plans.create.joinDeadline.startFirst') };
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return { joinClosesAt: '', presetLabel, deadlineLabel: '', error: t('plans.create.joinDeadline.startFirst') };

  let deadline = start;
  if (state.preset === 'custom') {
    if (!state.date.trim() || !state.time.trim()) return { joinClosesAt: '', presetLabel, deadlineLabel: '', error: t('plans.create.joinDeadline.customBoth') };
    const custom = parseLocalPlanInput(state.date, state.time);
    if (!custom) return { joinClosesAt: '', presetLabel, deadlineLabel: '', error: t('plans.create.joinDeadline.customInvalid') };
    deadline = custom;
  } else {
    deadline = new Date(start.getTime() - planJoinDeadlinePresetOffsetMinutes(state.preset) * 60_000);
  }

  const deadlineLabel = formatPlanDateTime(deadline.toISOString());
  if (deadline.getTime() > start.getTime()) return { joinClosesAt: '', presetLabel, deadlineLabel, error: t('plans.create.joinDeadline.afterStart') };
  if (isPlanJoinClosed({ startsAt, joinClosesAt: deadline }, new Date())) return { joinClosesAt: '', presetLabel, deadlineLabel, error: t('plans.create.joinDeadline.past') };
  return { joinClosesAt: deadline.toISOString(), presetLabel, deadlineLabel, error: '' };
}

function resolvePlanParticipantCapacity(state: PlanParticipantCapacityState, t: Translator) {
  if (state.mode === 'unlimited') return { maxParticipants: null as number | null, label: t('plans.create.capacity.unlimited'), previewLabel: t('plans.create.capacity.previewUnlimited'), error: '' };
  const normalized = state.limit.trim();
  if (!/^\d+$/.test(normalized)) return { maxParticipants: null as number | null, label: t('plans.create.capacity.limited'), previewLabel: '', error: t('plans.create.capacity.invalid') };
  const maxParticipants = Number(normalized);
  if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 100) return { maxParticipants: null as number | null, label: t('plans.create.capacity.limited'), previewLabel: '', error: t('plans.create.capacity.range') };
  return { maxParticipants, label: t('plans.create.capacity.limitedSummary', { count: maxParticipants }), previewLabel: t('plans.create.capacity.previewLimited', { count: maxParticipants }), error: '' };
}

function planEndStateFromPublishedPlan(plan: PlanDto): PlanEndState {
  if (!plan.endsAt) return EMPTY_PLAN_END_STATE;
  const planEnd = new Date(plan.endsAt);
  if (Number.isNaN(planEnd.getTime())) return EMPTY_PLAN_END_STATE;
  const routeEnd = (plan.places ?? [])
    .map((place) => place.endsAt ? new Date(place.endsAt) : null)
    .filter((value): value is Date => Boolean(value && !Number.isNaN(value.getTime())))
    .sort((left, right) => right.getTime() - left.getTime())[0];
  if (routeEnd && Math.abs(routeEnd.getTime() - planEnd.getTime()) < 1000) return EMPTY_PLAN_END_STATE;
  return { date: toDateInputValue(plan.endsAt), time: toTimeInputValue(plan.endsAt, '') };
}

function isPlanEditLockedError(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as { body?: { error?: string } }).body?.error === 'plan_edit_locked');
}

function parsePlanTagsInput(value: string) {
  return Array.from(new Set(value.split(/[,\n]/).map((tag) => tag.trim()).filter(Boolean)));
}

function planModeFromPlaces(places: PlaceFormState[]) {
  const actualPlaces = places.filter((place) => !isCustomPlanStop(place));
  const modes = new Set(actualPlaces.map((place) => place.mode));
  if (modes.size > 1) return 'hybrid' as const;
  return modes.has('remote') ? 'remote' as const : 'local' as const;
}

function rangeLabelFromSchedule(schedule: ReturnType<typeof buildPlanSchedule>) {
  if (!schedule.startsAt) return '';
  return `${new Date(schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} → ${new Date(schedule.endsAt || schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function parseOptionalPlanEnd(end: PlanEndState, fallbackStartAt: string, t: Translator) {
  if (!end.date.trim() && !end.time.trim()) return { endsAt: '', error: '' };
  if (!end.date.trim() || !end.time.trim()) return { endsAt: '', error: t('plans.create.validation.endBoth') };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end.date.trim()) || !/^\d{2}:\d{2}$/.test(end.time.trim())) return { endsAt: '', error: t('plans.create.validation.invalidEnd') };
  const parsed = new Date(`${end.date}T${end.time}:00`);
  if (Number.isNaN(parsed.getTime())) return { endsAt: '', error: t('plans.create.validation.invalidEnd') };
  if (fallbackStartAt && parsed.getTime() < new Date(fallbackStartAt).getTime()) return { endsAt: '', error: t('plans.create.validation.endAfterStart') };
  return { endsAt: parsed.toISOString(), error: '' };
}

function parsePlanEndOverride(end: PlanEndState, fallbackStartAt: string, t: Translator) {
  return parseOptionalPlanEnd(end, fallbackStartAt, t);
}

function rangeLabelWithEnd(schedule: ReturnType<typeof buildPlanSchedule>, end: PlanEndState, t: Translator) {
  if (!schedule.startsAt) return '';
  const parsedEnd = parseOptionalPlanEnd(end, schedule.startsAt, t);
  return rangeLabelFromSchedule({ ...schedule, endsAt: parsedEnd.endsAt || schedule.endsAt });
}

function hasPlanEndOverride(end: PlanEndState) {
  return Boolean(end.date.trim() || end.time.trim());
}

function formatPlanDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function parseLocalPlanInput(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim()) || !/^\d{2}:\d{2}$/.test(timeValue.trim())) return null;
  const date = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function padPlanDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function dateInputFromDate(date: Date) {
  return `${date.getFullYear()}-${padPlanDatePart(date.getMonth() + 1)}-${padPlanDatePart(date.getDate())}`;
}

function planDatePresetValue(preset: 'today' | 'tomorrow' | 'weekend' | 'next_week') {
  const today = new Date();
  if (preset === 'today') return dateInputFromDate(today);
  if (preset === 'tomorrow') return dateInputFromDate(addDays(today, 1));
  if (preset === 'weekend') {
    const day = today.getDay();
    return dateInputFromDate(day === 6 || day === 0 ? today : addDays(today, 6 - day));
  }
  const day = today.getDay();
  const daysUntilNextMonday = ((8 - day) % 7) || 7;
  return dateInputFromDate(addDays(today, daysUntilNextMonday));
}

function planTimePresetValue(preset: 'morning' | 'afternoon' | 'evening') {
  if (preset === 'morning') return '09:00';
  if (preset === 'afternoon') return '13:00';
  return '18:00';
}

function formatPlanInputDate(value: string, t: Translator) {
  const parsed = parseLocalPlanInput(value, '12:00');
  if (!parsed) return value || t('plans.create.quick.dateNotSet');
  return parsed.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatPlanInputTime(value: string, t: Translator) {
  const parsed = parseLocalPlanInput(dateInputFromDate(new Date()), value);
  if (!parsed) return value || t('plans.create.quick.timeNotSet');
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function durationLabel(minutes: number) {
  if (minutes === 30) return '30 min';
  if (minutes === 60) return '1h';
  if (minutes === 90) return '1h30';
  if (minutes === 120) return '2h';
  return `${minutes} min`;
}

function endStateFromDuration(startsAt: string, minutes: number) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return EMPTY_PLAN_END_STATE;
  date.setMinutes(date.getMinutes() + minutes);
  return { date: dateInputFromDate(date), time: `${padPlanDatePart(date.getHours())}:${padPlanDatePart(date.getMinutes())}` };
}

function selectedPlanRange(schedule: ReturnType<typeof buildPlanSchedule>, explicitEnd: ReturnType<typeof parsePlanEndOverride>) {
  if (!schedule.startsAt) return null;
  const start = new Date(schedule.startsAt);
  const end = new Date(explicitEnd.endsAt || schedule.endsAt || schedule.startsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) return null;
  return { start, end };
}

function createPlanConflictWarning(plans: PlanDto[], schedule: ReturnType<typeof buildPlanSchedule>, explicitEnd: ReturnType<typeof parsePlanEndOverride>, t: Translator, excludePlanId?: string) {
  const selected = selectedPlanRange(schedule, explicitEnd);
  if (!selected) return '';
  const oneHour = 60 * 60 * 1000;
  for (const plan of plans) {
    if (excludePlanId && plan.id === excludePlanId) continue;
    if (plan.status === 'cancelled') continue;
    const start = new Date(plan.startsAt);
    const end = new Date(plan.endsAt || plan.startsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const bufferedStart = start.getTime() - oneHour;
    const bufferedEnd = Math.max(start.getTime(), end.getTime()) + oneHour;
    if (selected.start.getTime() < bufferedEnd && selected.end.getTime() > bufferedStart) {
      return t('plans.create.validation.timeConflict', { plan: plan.title || t('plans.create.validation.anotherPlan') });
    }
  }
  return '';
}

function QuickDateTimeButtons({ date, time, onChange }: { date: string; time: string; onChange: (patch: Partial<Pick<PlaceFormState, 'date' | 'time'>>) => void }) {
  const { t } = useWebTranslation();
  const today = planDatePresetValue('today');
  const tomorrow = planDatePresetValue('tomorrow');
  const weekend = planDatePresetValue('weekend');
  const nextWeek = planDatePresetValue('next_week');
  return (
    <div className="plan-quick-time-card">
      <div className="plan-quick-time-card__summary">
        <strong>{formatPlanInputDate(date, t)}</strong>
        <span>{formatPlanInputTime(time, t)}</span>
      </div>
      <div className="plan-quick-picker-group">
        <span>{t('plans.create.quick.date')}</span>
        <div className="plan-quick-button-row">
          <button type="button" className={date === today ? 'is-active' : ''} onClick={() => onChange({ date: today })}>{t('plans.create.quick.today')}</button>
          <button type="button" className={date === tomorrow ? 'is-active' : ''} onClick={() => onChange({ date: tomorrow })}>{t('plans.create.quick.tomorrow')}</button>
          <button type="button" className={date === weekend ? 'is-active' : ''} onClick={() => onChange({ date: weekend })}>{t('plans.create.quick.weekend')}</button>
          <button type="button" className={date === nextWeek ? 'is-active' : ''} onClick={() => onChange({ date: nextWeek })}>{t('plans.create.quick.nextWeek')}</button>
        </div>
      </div>
      <div className="plan-quick-picker-group">
        <span>{t('plans.create.quick.time')}</span>
        <div className="plan-quick-button-row">
          <button type="button" className={time === planTimePresetValue('morning') ? 'is-active' : ''} onClick={() => onChange({ time: planTimePresetValue('morning') })}>{t('plans.create.quick.morning')}</button>
          <button type="button" className={time === planTimePresetValue('afternoon') ? 'is-active' : ''} onClick={() => onChange({ time: planTimePresetValue('afternoon') })}>{t('plans.create.quick.afternoon')}</button>
          <button type="button" className={time === planTimePresetValue('evening') ? 'is-active' : ''} onClick={() => onChange({ time: planTimePresetValue('evening') })}>{t('plans.create.quick.evening')}</button>
        </div>
      </div>
      <div className="plan-timeline-row__fields plan-timeline-row__fields--compact">
        <label>
          <span>{t('plans.create.quick.customDate')}</span>
          <input type="date" value={date} onChange={(event) => onChange({ date: event.target.value })} required />
        </label>
        <label>
          <span>{t('plans.create.quick.customTime')}</span>
          <input type="time" value={time} onChange={(event) => onChange({ time: event.target.value })} required />
        </label>
      </div>
    </div>
  );
}

function DurationButtons({ startsAt, onSelect }: { startsAt: string; onSelect: (minutes: number) => void }) {
  const { t } = useWebTranslation();
  return (
    <div className="plan-quick-picker-group plan-quick-picker-group--duration">
      <span>{t('plans.create.duration.helper')}</span>
      <div className="plan-quick-button-row">
        {[30, 60, 90, 120].map((minutes) => <button key={minutes} type="button" disabled={!startsAt} onClick={() => onSelect(minutes)}>{durationLabel(minutes)}</button>)}
        <button type="button" disabled={!startsAt}>{t('plans.create.duration.custom')}</button>
      </div>
    </div>
  );
}

function formatDurationMinutes(minutes?: number | null) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return '';
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return `${remainder}m`;
}

function planEndSummary(schedule: ReturnType<typeof buildPlanSchedule>, end: PlanEndState, t: Translator) {
  if (!schedule.startsAt) return null;
  const parsedEnd = parseOptionalPlanEnd(end, schedule.startsAt, t);
  const hasManualInput = hasPlanEndOverride(end);
  if (hasManualInput && parsedEnd.error) return null;
  const manual = hasManualInput && Boolean(parsedEnd.endsAt);
  const endsAt = manual ? parsedEnd.endsAt : schedule.endsAt;
  if (!endsAt) return null;
  const endLabel = formatPlanDateTime(endsAt);
  const estimatedDuration = formatDurationMinutes(schedule.estimatedFinalEnd?.roundedGapMinutes);
  const detail = manual
    ? t('plans.create.duration.manualDetail')
    : schedule.estimatedFinalEnd?.placeCount === 1
      ? t('plans.create.duration.singleEstimate', { duration: estimatedDuration ? ` (${estimatedDuration})` : '' })
      : t('plans.create.duration.multipleEstimate', { duration: estimatedDuration ? ` (${estimatedDuration})` : '' });
  return {
    label: manual ? t('plans.create.duration.manualLabel') : t('plans.create.duration.estimatedLabel'),
    endsAt,
    endLabel,
    detail,
    manual,
  };
}

function placeSourceLabel(place: PlaceDto, t: Translator) {
  return place.source === 'hellowhen_library' ? t('plans.create.placeDetail.sourceLibrary') : t('plans.create.placeDetail.sourceMine');
}

function libraryPlaceSource(place: PlaceDto): PlaceFormState['sourcePlaceSource'] {
  return place.source === 'hellowhen_library' ? 'hellowhen_library' : 'my_place';
}

function placeLocationForForm(place: PlaceDto) {
  return place.mode === 'remote' ? '' : place.formattedAddress ?? place.addressPublicText ?? place.areaLabel ?? '';
}

function placePreviewLocation(place: PlaceFormState, t: Translator) {
  if (isCustomPlanStop(place)) return t('plans.create.customStop.noAddressRequired');
  if (place.mode === 'remote') return place.onlineLabel.trim() || place.onlineUrl.trim() || place.location.trim();
  return place.location.trim();
}


function planPreviewTimeLabel(place: PlaceFormState, t: Translator) {
  if (place.date && place.time) return `${place.date} · ${place.time}`;
  if (place.time) return place.time;
  return t('plans.create.time.timeRequired');
}

function planPreviewPlaceTitle(place: PlaceFormState, index: number, t: Translator) {
  return place.title.trim() || place.sourcePlaceTitle?.trim() || (isCustomPlanStop(place) ? customPlanStopTitle(place.kind as CustomPlanStopKind, t) : t('plans.create.place.label', { index: index + 1 }));
}

function incompleteOfflinePlaceIndexes(places: PlaceFormState[]) {
  return places.reduce<number[]>((indexes, place, index) => {
    if (!isCustomPlanStop(place) && place.mode === 'local' && offlineProviderAddressError(place.providerAddress)) indexes.push(index);
    return indexes;
  }, []);
}

function mergeUniquePlaceIds(currentIds: string[], nextIds: string[]) {
  return Array.from(new Set([...currentIds, ...nextIds]));
}

function applyReusablePlacePatch(place: PlaceDto): Partial<PlaceFormState> {
  return {
    sourcePlaceId: place.id,
    sourcePlaceSource: libraryPlaceSource(place),
    sourcePlaceTitle: place.title,
    kind: 'place',
    mode: place.mode ?? 'local',
    title: place.title,
    location: placeLocationForForm(place),
    providerAddress: place.mode === 'remote' ? emptyProviderAddressFormState() : providerAddressFormStateFromStoredPlace(place),
    onlineLabel: place.onlineLabel ?? '',
    onlineUrl: place.onlineUrl ?? '',
    existingMedia: place.media?.[0] ?? null,
    existingMediaBelongsToPlanPlace: false,
    existingStaticMap: place.staticMap ?? null,
    media: null,
  };
}

function resetToCustomPatch(): Partial<PlaceFormState> {
  return {
    sourcePlaceId: undefined,
    kind: 'place',
    sourcePlaceSource: 'custom',
    sourcePlaceTitle: undefined,
    existingMedia: null,
    existingMediaBelongsToPlanPlace: false,
    existingStaticMap: null,
    providerAddress: emptyProviderAddressFormState(),
  };
}

function filterPlaces(places: PlaceDto[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return places;
  return places.filter((place) => [place.title, place.description, place.category, place.areaLabel, place.addressPublicText, place.onlineLabel]
    .some((value) => value?.toLowerCase().includes(normalized)));
}

function PlaceModeSegment({ value, onChange }: { value: PlanPlaceMode; onChange: (value: PlanPlaceMode) => void }) {
  const { t } = useWebTranslation();
  return (
    <div className="plan-mode-segment" aria-label={t('plans.filters.groups.mode.title')}>
      <button type="button" className={value === 'local' ? 'is-active' : ''} onClick={() => onChange('local')}>{t('plans.detail.values.local')}</button>
      <button type="button" className={value === 'remote' ? 'is-active' : ''} onClick={() => onChange('remote')}>{t('plans.detail.values.online')}</button>
    </div>
  );
}

function PlaceImagePicker({ place, onUpload, onRemove }: { place: PlaceFormState; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) {
  const { t } = useWebTranslation();
  const visibleMedia = place.media ?? place.existingMedia;
  return (
    <div className="plan-place-image-picker">
      <label className="image-upload-button">
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={place.uploading || Boolean(visibleMedia)} onChange={onUpload} />
        {place.uploading ? t('plans.create.image.uploading') : visibleMedia ? t('plans.create.image.selected') : t('plans.create.image.add')}
      </label>
      {visibleMedia ? (
        <figure>
          <img src={planMediaSrc(visibleMedia)} alt={visibleMedia.filename ?? t('plans.create.place.name')} />
          <figcaption>
            <span className="semantic-badge instruction">{t('plans.create.image.selectedBadge')}</span>
            {place.media ? <button type="button" className="secondary" onClick={onRemove}>{t('plans.create.image.removeNew')}</button> : <span className="meta">{t('plans.create.image.saved')}</span>}
          </figcaption>
        </figure>
      ) : <p className="meta">{t('plans.create.image.firstVersion')}</p>}
    </div>
  );
}

function PlanPlaceTimelineButton({ place, index, onOpen }: { place: PlaceFormState; index: number; onOpen: () => void }) {
  const { t } = useWebTranslation();
  const customStop = isCustomPlanStop(place);
  const imageSrc = customStop ? '' : planMediaSrc(place.media ?? place.existingMedia);
  return (
    <button type="button" className="plan-timeline-row__main plan-timeline-row__main--button plan-place-summary-button" onClick={onOpen}>
      <span className="plan-place-summary-button__media" aria-hidden="true">
        {imageSrc ? <img src={imageSrc} alt="" loading="lazy" /> : <WebIcon name={customStop && place.kind === 'meeting_point' ? 'location-on' : customStop ? 'plan' : 'location-on'} size={24} decorative />}
      </span>
      <span className="plan-place-summary-button__copy">
        <span className="plan-timeline-row__heading">
          <span className={`semantic-badge ${customStop ? 'time' : 'place'}`}>{customStop ? t('plans.create.customStop.detailTitle', { index: index + 1 }) : t('plans.create.place.label', { index: index + 1 })}</span>
          {customStop ? <span className="semantic-badge time">{customPlanStopTitle(place.kind as CustomPlanStopKind, t)}</span> : place.sourcePlaceId ? <span className="semantic-badge place">{place.sourcePlaceSource === 'hellowhen_library' ? t('plans.create.placeDetail.sourceLibrary') : t('plans.create.placeDetail.sourceMine')}</span> : <span className="semantic-badge place">{t('plans.create.placeDetail.sourceCustom')}</span>}
        </span>
        <strong>{planPreviewPlaceTitle(place, index, t)}</strong>
        <small>{placePreviewLocation(place, t) || (customStop ? t('plans.create.customStop.noAddressTitle') : t('plans.create.place.noLocation'))}</small>
      </span>
    </button>
  );
}

function reusablePlaceAddressError(place: PlaceDto, t: Translator) {
  if (place.mode === 'remote') return onlineDestinationError({ onlineUrl: place.onlineUrl }) ? t('plans.create.sourcePicker.addOnlineUrl') : '';
  return offlineProviderAddressError(providerAddressFormStateFromStoredPlace(place)) ? t('plans.create.sourcePicker.fixAddress') : '';
}

function PlacePickerList({
  places,
  emptyLabel,
  onChoose,
}: {
  places: PlaceDto[];
  emptyLabel: string;
  onChoose: (place: PlaceDto) => void;
}) {
  const { t } = useWebTranslation();
  if (!places.length) return <p className="meta">{emptyLabel}</p>;
  return (
    <div className="plan-place-picker-list">
      {places.map((place) => {
        const media = place.media?.[0] ?? null;
        const addressError = reusablePlaceAddressError(place, t);
        const meta = [place.mode === 'remote' ? t('plans.detail.values.online') : t('plans.detail.values.local'), place.category, place.formattedAddress || place.addressPublicText || place.onlineLabel]
          .filter((value): value is string => Boolean(value && value.trim()))
          .join(' · ');
        return (
          <button type="button" className="plan-place-picker-card" key={place.id} onClick={() => onChoose(place)} disabled={Boolean(addressError)}>
            <span className="plan-place-picker-card__media">
              {media ? <img src={planMediaSrc(media)} alt={media.filename ?? place.title} /> : <WebIcon name="location-on" size={20} decorative />}
            </span>
            <span className="plan-place-picker-card__body">
              <strong>{place.title}</strong>
              <small>{addressError || meta || placeSourceLabel(place, t)}</small>
            </span>
            <span className="semantic-badge instruction">{addressError ? t('plans.create.place.fix') : t('common.actions.continue')}</span>
          </button>
        );
      })}
    </div>
  );
}

type PlanCreateClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
  editingPlanId?: string;
};

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
  const { t } = useWebTranslation();
  return (
    <section className="plan-advanced-details">
      <button
        type="button"
        className="plan-advanced-details__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{t('plans.create.advanced.title')}</span>
        <small>{open ? t('plans.create.advanced.hide') : t('plans.create.advanced.show')}</small>
        <strong>{open ? '−' : '+'}</strong>
      </button>
      {open ? (
        <div className="plan-advanced-details__panel">
          <label>
            <span>{t('plans.create.advanced.planTitle')}</span>
            <input value={details.title} onChange={(event) => onChange({ title: event.target.value })} minLength={3} maxLength={120} placeholder={generatedTitle} />
          </label>
          <label>
            <span>{t('plans.create.advanced.planDescription')}</span>
            <textarea value={details.description} onChange={(event) => onChange({ description: event.target.value })} minLength={10} maxLength={2000} placeholder={generatedDescription} />
          </label>
          <div className="plan-form__row">
            <label>
              <span>{t('plans.create.advanced.category')}</span>
              <input value={details.category} onChange={(event) => onChange({ category: event.target.value })} maxLength={80} placeholder={t('plans.create.advanced.categoryPlaceholder')} />
            </label>
            <label>
              <span>{t('plans.create.advanced.tags')}</span>
              <input value={details.tags} onChange={(event) => onChange({ tags: event.target.value })} maxLength={280} placeholder={t('plans.create.advanced.tagsPlaceholder')} />
            </label>
          </div>
          <p className="meta">{t('plans.create.advanced.help')}</p>
        </div>
      ) : null}
    </section>
  );
}

export function PlanCreateClient({ plansEnabled, plansVisible, editingPlanId }: PlanCreateClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const isEditing = Boolean(editingPlanId);
  const authenticatedUserId = auth.user?.id ?? null;
  const planDraftStorageKey = useMemo(() => authenticatedUserId ? buildWebUserSessionStorageKey(authenticatedUserId, PLAN_CREATE_DRAFT_SCOPE) : null, [authenticatedUserId]);
  const pendingPlaceIndexStorageKey = useMemo(() => authenticatedUserId ? buildWebUserSessionStorageKey(authenticatedUserId, PLAN_CREATE_PENDING_PLACE_INDEX_SCOPE) : null, [authenticatedUserId]);
  const createdPlaceId = searchParams.get('createdPlaceId');
  const updatedPlaceId = searchParams.get('updatedPlaceId');
  const initialPlanIdeaKey = parseStarterPlanIdeaKey(searchParams.get('idea'));
  const handledPlanIdeaKeyRef = useRef<string | null>(null);
  const handledCreatedPlaceIdRef = useRef<string | null>(null);
  const handledUpdatedPlaceIdRef = useRef<string | null>(null);
  const creatingPlanRef = useRef(false);
  const reusablePlacesLoadVersionRef = useRef(0);
  const [draftHydratedUserId, setDraftHydratedUserId] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceFormState[]>([]);
  const [advancedDetails, setAdvancedDetails] = useState<AdvancedPlanDetailsState>(EMPTY_ADVANCED_PLAN_DETAILS);
  const [planEnd, setPlanEnd] = useState<PlanEndState>(EMPTY_PLAN_END_STATE);
  const [joinDeadline, setJoinDeadline] = useState<PlanJoinDeadlineState>(DEFAULT_PLAN_JOIN_DEADLINE);
  const [participantCapacity, setParticipantCapacity] = useState<PlanParticipantCapacityState>(DEFAULT_PLAN_PARTICIPANT_CAPACITY);
  const [stage, setStage] = useState<PlanCreateStage>('build');
  const [advancedDetailsOpen, setAdvancedDetailsOpen] = useState(false);
  const [myPlaces, setMyPlaces] = useState<PlaceDto[]>([]);
  const [libraryPlaces, setLibraryPlaces] = useState<PlaceDto[]>([]);
  const [myPlansForConflict, setMyPlansForConflict] = useState<PlanDto[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PlacePickerTarget | null>(null);
  const [pickerView, setPickerView] = useState<PlacePickerView>('source');
  const [pickerTab, setPickerTab] = useState<'mine' | 'library'>('mine');
  const [detailPlaceIndex, setDetailPlaceIndex] = useState<number | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanDto | null>(null);
  const [editingPlanLoading, setEditingPlanLoading] = useState(Boolean(editingPlanId));
  const [editingPlanLocked, setEditingPlanLocked] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [addressGuidanceNotice, setAddressGuidanceNotice] = useState('');
  const [expandedAddressPlaceIds, setExpandedAddressPlaceIds] = useState<string[]>([]);
  const [addressFocusPlaceId, setAddressFocusPlaceId] = useState<string | null>(null);
  const firstMissingOfflinePlaceRef = useRef<HTMLDivElement | null>(null);

  const placesForGeneratedDisplay = useMemo(() => places.filter((place) => place.title.trim() || place.sourcePlaceTitle?.trim()), [places]);
  const schedulablePlaces = useMemo(() => places.filter((place) => place.title.trim() || place.sourcePlaceId), [places]);
  const schedule = useMemo(() => buildPlanSchedule(schedulablePlaces), [schedulablePlaces]);
  const explicitPlanEnd = useMemo(() => parsePlanEndOverride(planEnd, schedule.startsAt, t), [planEnd, schedule.startsAt, t]);
  const endSummary = useMemo(() => planEndSummary(schedule, planEnd, t), [schedule, planEnd, t]);
  const joinDeadlineSummary = useMemo(() => resolvePlanJoinDeadline(joinDeadline, schedule.startsAt, t), [joinDeadline, schedule.startsAt, t]);
  const participantCapacitySummary = useMemo(() => resolvePlanParticipantCapacity(participantCapacity, t), [participantCapacity, t]);
  const conflictWarning = useMemo(() => createPlanConflictWarning(myPlansForConflict, schedule, explicitPlanEnd, t, editingPlanId), [editingPlanId, explicitPlanEnd, myPlansForConflict, schedule, t]);
  const rangeLabel = rangeLabelWithEnd(schedule, planEnd, t);
  const generatedPlanDisplay = useMemo(() => buildGeneratedPlanDisplay({
    places: placesForGeneratedDisplay,
    startsAt: schedule.startsAt,
    mode: planModeFromPlaces(placesForGeneratedDisplay),
    joinApprovalMode: 'automatic',
  }), [placesForGeneratedDisplay, schedule.startsAt]);
  const generatedTitle = generatedPlanDisplay.title;
  const generatedDescription = generatedPlanDisplay.description;
  const previewTitle = advancedDetails.title.trim() || generatedTitle;
  const previewDescription = advancedDetails.description.trim() || generatedDescription;
  const filteredMyPlaces = useMemo(() => filterPlaces(myPlaces, placeQuery), [myPlaces, placeQuery]);
  const filteredLibraryPlaces = useMemo(() => filterPlaces(libraryPlaces, placeQuery), [libraryPlaces, placeQuery]);
  const incompleteOfflineIndexes = useMemo(() => incompleteOfflinePlaceIndexes(places), [places]);
  const incompleteOfflineIds = useMemo(() => incompleteOfflineIndexes.map((index) => places[index]?.id).filter((id): id is string => Boolean(id)), [incompleteOfflineIndexes, places]);
  const validationNotice = error || addressGuidanceNotice;

  useEffect(() => {
    handledPlanIdeaKeyRef.current = null;
    handledCreatedPlaceIdRef.current = null;
    handledUpdatedPlaceIdRef.current = null;
    if (!isEditing) {
      setStage('build');
      setMessage('');
      setError('');
    }
  }, [authenticatedUserId, isEditing]);

  useEffect(() => {
    if (isEditing || !auth.hydrated) return;
    if (!authenticatedUserId || !planDraftStorageKey) {
      setDraftHydratedUserId(null);
      setPlaces([]);
      setAdvancedDetails(EMPTY_ADVANCED_PLAN_DETAILS);
      setPlanEnd(EMPTY_PLAN_END_STATE);
      setJoinDeadline(DEFAULT_PLAN_JOIN_DEADLINE);
      setParticipantCapacity(DEFAULT_PLAN_PARTICIPANT_CAPACITY);
      return;
    }
    setPlaces(safeReadPlanDraft(planDraftStorageKey));
    setAdvancedDetails(safeReadAdvancedPlanDetails(planDraftStorageKey));
    setPlanEnd(safeReadPlanEndState(planDraftStorageKey));
    setJoinDeadline(safeReadPlanJoinDeadline(planDraftStorageKey));
    setParticipantCapacity(safeReadPlanParticipantCapacity(planDraftStorageKey));
    setDraftHydratedUserId(authenticatedUserId);
  }, [auth.hydrated, authenticatedUserId, isEditing, planDraftStorageKey]);

  async function loadReusablePlaces() {
    const loadVersion = reusablePlacesLoadVersionRef.current + 1;
    reusablePlacesLoadVersionRef.current = loadVersion;
    setLoadingPlaces(true);
    try {
      const [mineResponse, libraryResponse, plansResponse] = await Promise.all([
        api.places.mine({ take: 100 }),
        api.places.library({ take: 100 }),
        api.plans.mine(),
      ]);
      if (loadVersion !== reusablePlacesLoadVersionRef.current) return;
      setMyPlaces(mineResponse.places);
      setLibraryPlaces(libraryResponse.places);
      setMyPlansForConflict(plansResponse.plans ?? []);
    } catch (loadError) {
      if (loadVersion !== reusablePlacesLoadVersionRef.current) return;
      setError(getFriendlyApiErrorMessage(loadError, t('plans.create.sourcePicker.loadFailed')));
    } finally {
      if (loadVersion === reusablePlacesLoadVersionRef.current) setLoadingPlaces(false);
    }
  }

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!auth.isAuthenticated || !authenticatedUserId) {
      reusablePlacesLoadVersionRef.current += 1;
      setLoadingPlaces(false);
      setMyPlaces([]);
      setLibraryPlaces([]);
      setMyPlansForConflict([]);
      return;
    }
    setMyPlaces([]);
    setLibraryPlaces([]);
    setMyPlansForConflict([]);
    void loadReusablePlaces();
  }, [auth.hydrated, auth.isAuthenticated, authenticatedUserId]);

  useEffect(() => {
    if (!editingPlanId) {
      setEditingPlanLoading(false);
      return undefined;
    }
    if (!auth.hydrated) return undefined;
    if (!auth.isAuthenticated) {
      setEditingPlanLoading(false);
      return undefined;
    }
    let active = true;
    setEditingPlanLoading(true);
    setEditingPlanLocked(false);
    setError('');
    setMessage('');
    void (async () => {
      try {
        const response = await api.plans.get(editingPlanId);
        if (!active) return;
        const publishedPlan = response.plan;
        setEditingPlan(publishedPlan);
        if (publishedPlan.ownerId !== auth.user?.id) {
          setEditingPlanLocked(true);
          setError(t('plans.create.edit.ownerOnly'));
          setPlaces([]);
          return;
        }
        if (!publishedPlan.ownerCanEdit) {
          setEditingPlanLocked(true);
          setError(t('plans.create.edit.locked'));
          setPlaces([]);
          return;
        }
        setPlaces([...(publishedPlan.places ?? [])]
          .sort((left, right) => left.order - right.order)
          .map((place, index) => placeFormFromPublishedPlanPlace(place, index)));
        setAdvancedDetails({
          title: publishedPlan.title ?? '',
          description: publishedPlan.description ?? '',
          category: publishedPlan.category ?? '',
          tags: (publishedPlan.tags ?? []).join(', '),
        });
        setPlanEnd(planEndStateFromPublishedPlan(publishedPlan));
        setJoinDeadline(planJoinDeadlineStateFromPublishedPlan(publishedPlan));
        setParticipantCapacity(publishedPlan.maxParticipants ? { mode: 'limited', limit: String(publishedPlan.maxParticipants) } : DEFAULT_PLAN_PARTICIPANT_CAPACITY);
        setAdvancedDetailsOpen(Boolean(publishedPlan.title || publishedPlan.description || publishedPlan.category || publishedPlan.tags?.length));
        setStage('build');
        setMessage(t('plans.create.edit.loaded'));
      } catch (loadError) {
        if (!active) return;
        setEditingPlan(null);
        setError(getFriendlyApiErrorMessage(loadError, t('plans.create.edit.loadFailed')));
      } finally {
        if (active) setEditingPlanLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [auth.hydrated, auth.isAuthenticated, auth.user?.id, editingPlanId]);

  useEffect(() => {
    if (isEditing || !authenticatedUserId || draftHydratedUserId !== authenticatedUserId || !initialPlanIdeaKey || handledPlanIdeaKeyRef.current === initialPlanIdeaKey || places.length > 0) return;
    const idea = starterPlanIdeas[initialPlanIdeaKey];
    const date = toDateInputValue();
    handledPlanIdeaKeyRef.current = initialPlanIdeaKey;
    setPlaces(idea.stops.map((stop, index) => makePlaceFromPlanIdeaStop(stop, index, date)));
    setMessage(t('plans.create.feedback.starterLoaded'));
  }, [authenticatedUserId, draftHydratedUserId, initialPlanIdeaKey, isEditing, places.length]);

  useEffect(() => {
    if (isEditing || !authenticatedUserId || draftHydratedUserId !== authenticatedUserId) return;
    storePlanDraft(planDraftStorageKey, places, advancedDetails, planEnd, joinDeadline, participantCapacity);
  }, [advancedDetails, authenticatedUserId, draftHydratedUserId, isEditing, joinDeadline, participantCapacity, places, planDraftStorageKey, planEnd]);


  useEffect(() => {
    setExpandedAddressPlaceIds((current) => {
      const next = current.filter((id) => incompleteOfflineIds.includes(id));
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
    if (addressGuidanceNotice && !incompleteOfflineIds.length) setAddressGuidanceNotice('');
    if (addressFocusPlaceId && !incompleteOfflineIds.includes(addressFocusPlaceId)) setAddressFocusPlaceId(null);
  }, [addressFocusPlaceId, addressGuidanceNotice, incompleteOfflineIds]);

  useEffect(() => {
    if (!addressFocusPlaceId || stage !== 'build') return undefined;
    const timeoutId = window.setTimeout(() => {
      firstMissingOfflinePlaceRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [addressFocusPlaceId, expandedAddressPlaceIds.length, stage]);

  useEffect(() => {
    if (isEditing) return;
    const returnedPlaceId = createdPlaceId || updatedPlaceId;
    const isUpdateReturn = Boolean(updatedPlaceId);
    const handledRef = isUpdateReturn ? handledUpdatedPlaceIdRef : handledCreatedPlaceIdRef;
    if (!returnedPlaceId || handledRef.current === returnedPlaceId) return;
    const returnedPlace = myPlaces.find((place) => place.id === returnedPlaceId);
    if (!returnedPlace) return;
    handledRef.current = returnedPlaceId;
    const pendingIndex = takePendingCreatedPlaceIndex(pendingPlaceIndexStorageKey);
    setPlaces((current) => {
      if (pendingIndex !== null && current[pendingIndex]) {
        return current.map((place, placeIndex) => placeIndex === pendingIndex ? { ...place, ...applyReusablePlacePatch(returnedPlace) } : place);
      }
      if (isUpdateReturn) {
        return current.map((place) => place.sourcePlaceId === returnedPlace.id ? { ...place, ...applyReusablePlacePatch(returnedPlace) } : place);
      }
      const nextStart = nextPlaceStartParts(current);
      return [
        ...current,
        {
          ...makePlace(current.length, nextStart.date, nextStart.time),
          ...applyReusablePlacePatch(returnedPlace),
        },
      ];
    });
    setMessage(isUpdateReturn ? t('plans.create.feedback.placeUpdated') : t('plans.create.feedback.placeAdded'));
    router.replace('/plans/new', { scroll: false });
  }, [createdPlaceId, isEditing, myPlaces, pendingPlaceIndexStorageKey, router, updatedPlaceId]);

  function updatePlace(index: number, update: Partial<PlaceFormState>) {
    setPlaces((current) => current.map((place, placeIndex) => placeIndex === index ? { ...place, ...update } : place));
    setError('');
  }

  function updatePlaceSchedule(index: number, update: Partial<Pick<PlaceFormState, 'date' | 'time'>>) {
    setPlaces((current) => cascadePlanStopDateTimeChange(current, index, update));
    setError('');
  }

  function addPlaceAndOpenPicker() {
    setPickerTarget('new');
    setPickerView('source');
    setPickerTab(myPlaces.length ? 'mine' : 'library');
    setPlaceQuery('');
  }

  function closePlacePicker() {
    setPickerTarget(null);
    setPickerView('source');
    setPlaceQuery('');
  }

  function openPickerList(source: 'mine' | 'library') {
    setPickerTab(source);
    setPickerView('list');
    setPlaceQuery('');
  }

  function openCustomStopPicker() {
    setPickerView('custom_stop');
    setPlaceQuery('');
  }

  function useCustomPlaceFromPicker() {
    if (pickerTarget === 'new') {
      const nextIndex = places.length;
      setPlaces((current) => {
        const nextStart = nextPlaceStartParts(current);
        return [...current, makePlace(current.length, nextStart.date, nextStart.time)];
      });
      setDetailPlaceIndex(nextIndex);
    }
    if (typeof pickerTarget === 'number') {
      updatePlace(pickerTarget, resetToCustomPatch());
      setDetailPlaceIndex(pickerTarget);
    }
    closePlacePicker();
  }

  function useCustomStopFromPicker(kind: CustomPlanStopKind) {
    if (pickerTarget === null) return;
    if (pickerTarget === 'new') {
      const nextIndex = places.length;
      setPlaces((current) => {
        const nextStart = nextPlaceStartParts(current);
        return [...current, makeCustomPlanStop(kind, current.length, nextStart.date, nextStart.time)];
      });
      setDetailPlaceIndex(nextIndex);
    } else {
      const targetIndex = pickerTarget;
      setPlaces((current) => current.map((item, index) => {
        if (index !== targetIndex) return item;
        const next = makeCustomPlanStop(kind, index, item.date || toDateInputValue(), item.time);
        return { ...next, id: item.id, date: item.date || next.date, time: item.time || next.time };
      }));
      setDetailPlaceIndex(targetIndex);
    }
    closePlacePicker();
    setMessage(t('plans.create.feedback.customStopAdded'));
    setError('');
  }

  function removePlace(index: number) {
    setPlaces((current) => current.filter((_, placeIndex) => placeIndex !== index));
    setDetailPlaceIndex(null);
  }

  function movePlace(index: number, direction: -1 | 1) {
    setPlaces((current) => reorderPlanStopsPreservingTimeline(current, index, direction));
  }

  function openPicker(index: number) {
    setDetailPlaceIndex(null);
    setPickerTarget(index);
    setPickerView('source');
    setPickerTab(myPlaces.length ? 'mine' : 'library');
    setPlaceQuery('');
  }

  function openCreatePlaceFromPicker() {
    if (isEditing) {
      setError(t('plans.create.sourcePicker.finishEditFirst'));
      closePlacePicker();
      return;
    }
    storePlanDraft(planDraftStorageKey, places, advancedDetails, planEnd, joinDeadline, participantCapacity);
    setPendingCreatedPlaceIndex(pendingPlaceIndexStorageKey, typeof pickerTarget === 'number' ? pickerTarget : null);
    router.push('/places/new?returnTo=plan');
  }

  function openEditMyPlaceFromDetail(index: number) {
    const place = places[index];
    if (!place?.sourcePlaceId || place.sourcePlaceSource !== 'my_place') return;
    if (isEditing) {
      setError(t('plans.create.sourcePicker.editSavedFirst'));
      setDetailPlaceIndex(null);
      return;
    }
    storePlanDraft(planDraftStorageKey, places, advancedDetails, planEnd, joinDeadline, participantCapacity);
    setPendingCreatedPlaceIndex(pendingPlaceIndexStorageKey, index);
    setDetailPlaceIndex(null);
    router.push(`/places/${encodeURIComponent(place.sourcePlaceId)}/edit?returnTo=plan`);
  }

  function openCopyLibraryPlaceFromDetail(index: number) {
    const place = places[index];
    if (!place?.sourcePlaceId || place.sourcePlaceSource !== 'hellowhen_library') return;
    if (isEditing) {
      setError(t('plans.create.sourcePicker.copyEditFirst'));
      setDetailPlaceIndex(null);
      return;
    }
    storePlanDraft(planDraftStorageKey, places, advancedDetails, planEnd, joinDeadline, participantCapacity);
    setPendingCreatedPlaceIndex(pendingPlaceIndexStorageKey, index);
    setDetailPlaceIndex(null);
    router.push(`/places/new?returnTo=plan&copyFromPlaceId=${encodeURIComponent(place.sourcePlaceId)}`);
  }

  function chooseReusablePlace(place: PlaceDto) {
    if (pickerTarget === null) return;
    if (pickerTarget === 'new') {
      setPlaces((current) => {
        const nextStart = nextPlaceStartParts(current);
        return [
          ...current,
          {
            ...makePlace(current.length, nextStart.date, nextStart.time),
            ...applyReusablePlacePatch(place),
          },
        ];
      });
    } else {
      updatePlace(pickerTarget, applyReusablePlacePatch(place));
    }
    closePlacePicker();
    setMessage(t('plans.create.feedback.placeAddedFrom', { place: place.title, source: placeSourceLabel(place, t) }));
  }

  function updateAdvancedDetails(update: Partial<AdvancedPlanDetailsState>) {
    setAdvancedDetails((current) => ({ ...current, ...update }));
  }

  function updatePlanEnd(update: Partial<PlanEndState>) {
    setPlanEnd((current) => ({ ...current, ...update }));
    setError('');
  }

  function applyDuration(minutes: number) {
    if (!schedule.startsAt) {
      setError(t('plans.create.validation.chooseStartForDuration'));
      return;
    }
    updatePlanEnd(endStateFromDuration(schedule.startsAt, minutes));
  }

  function focusMissingOfflineAddresses() {
    const nextMissingIds = incompleteOfflinePlaceIndexes(places)
      .map((index) => places[index]?.id)
      .filter((id): id is string => Boolean(id));
    if (!nextMissingIds.length) return false;
    setStage('build');
    setDetailPlaceIndex(null);
    setPickerTarget(null);
    setExpandedAddressPlaceIds((current) => mergeUniquePlaceIds(current, nextMissingIds));
    setAddressFocusPlaceId(nextMissingIds[0] ?? null);
    setError('');
    setAddressGuidanceNotice(t('plans.create.validation.offlineTop'));
    return true;
  }

  function showPreviewStage() {
    setError('');
    if (places.length === 0) { setError(t('plans.create.validation.addBeforePreview')); return; }
    if (!places.some((place) => !isCustomPlanStop(place))) { setError(t('plans.create.validation.addRealPlace')); return; }
    if (schedule.error) { setError(schedule.error); return; }
    if (explicitPlanEnd.error) { setError(explicitPlanEnd.error); return; }
    if (joinDeadlineSummary.error) { setError(joinDeadlineSummary.error); return; }
    if (participantCapacitySummary.error) { setError(participantCapacitySummary.error); return; }
    if (focusMissingOfflineAddresses()) return;
    const destinationError = validatePlaceDestinations(schedulablePlaces);
    if (destinationError) { setError(destinationError); return; }
    setStage('preview');
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  async function uploadPlaceImage(index: number, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    updatePlace(index, { uploading: true });
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.media.uploadImage(formData);
      const uploaded = normalizePlanMediaUpload(response);
      if (uploaded) updatePlace(index, { media: uploaded, existingMedia: null });
      setMessage(t('plans.create.image.uploaded'));
    } catch (uploadError) {
      setError(getFriendlyApiErrorMessage(uploadError, t('plans.create.image.uploadFailed')));
    } finally {
      updatePlace(index, { uploading: false });
    }
  }

  function updatePlaceManualLocation(index: number, location: string) {
    updatePlace(index, { location, providerAddress: emptyProviderAddressFormState() });
  }

  function updatePlaceResolvedAddress(index: number, place: GoogleResolvedPlace | null) {
    const currentPlaceId = places[index]?.id;
    updatePlace(index, {
      location: place?.formattedAddress || places[index]?.location || '',
      providerAddress: providerAddressFormStateFromGooglePlace(place),
    });
    if (currentPlaceId && place?.validationStatus === 'confirmed') {
      setExpandedAddressPlaceIds((current) => current.filter((id) => id !== currentPlaceId));
      if (addressFocusPlaceId === currentPlaceId) setAddressFocusPlaceId(null);
    }
  }

  function updateCustomPlaceMode(index: number, mode: PlanPlaceMode) {
    const currentPlace = places[index];
    updatePlace(index, {
      mode,
      location: mode === 'remote' ? '' : currentPlace?.location ?? '',
      providerAddress: mode === 'remote' ? emptyProviderAddressFormState() : currentPlace?.providerAddress ?? emptyProviderAddressFormState(),
      onlineLabel: mode === 'local' ? '' : currentPlace?.onlineLabel ?? '',
      onlineUrl: mode === 'local' ? '' : currentPlace?.onlineUrl ?? '',
    });
    if (mode === 'remote' && currentPlace?.id) {
      setExpandedAddressPlaceIds((current) => current.filter((id) => id !== currentPlace.id));
      if (addressFocusPlaceId === currentPlace.id) setAddressFocusPlaceId(null);
    }
  }

  function validatePlaceDestinations(usablePlaces: PlaceFormState[]) {
    for (const [index, place] of usablePlaces.entries()) {
      if (isCustomPlanStop(place)) continue;
      if (place.mode === 'remote') {
        const destinationError = onlineDestinationError({ onlineUrl: place.onlineUrl });
        if (destinationError) return `${t('plans.create.place.label', { index: index + 1 })}: ${t('plans.create.sourcePicker.addOnlineUrl')}`;
      } else {
        const addressError = offlineProviderAddressError(place.providerAddress);
        if (addressError) return `${t('plans.create.place.label', { index: index + 1 })}: ${t('plans.create.validation.offlineInline')}`;
      }
    }
    return '';
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createdPlanId) {
      router.replace(`/plans/${encodeURIComponent(createdPlanId)}`);
      return;
    }
    if (creatingPlanRef.current) return;
    if (!auth.isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(editingPlanId ? `/plans/${editingPlanId}/edit` : '/plans/new')}`);
      return;
    }
    if (isEditing && (!editingPlan || editingPlanLocked)) {
      setError(t('plans.create.edit.locked'));
      return;
    }
    const usablePlaces = places.filter((place) => place.title.trim() || place.sourcePlaceId);
    const nextSchedule = buildPlanSchedule(usablePlaces);
    const customTitle = advancedDetails.title.trim();
    const customDescription = advancedDetails.description.trim();
    const customCategory = advancedDetails.category.trim();
    const customTags = parsePlanTagsInput(advancedDetails.tags);
    const nextExplicitEnd = parsePlanEndOverride(planEnd, nextSchedule.startsAt, t);
    const nextJoinDeadline = resolvePlanJoinDeadline(joinDeadline, nextSchedule.startsAt, t);
    const nextParticipantCapacity = resolvePlanParticipantCapacity(participantCapacity, t);
    if (nextSchedule.error || !nextSchedule.startsAt || usablePlaces.length === 0) {
      setError(nextSchedule.error || t('plans.create.validation.addValidPlace'));
      return;
    }
    if (!usablePlaces.some((place) => !isCustomPlanStop(place))) {
      setError(t('plans.create.validation.addRealPlace'));
      return;
    }
    if (nextExplicitEnd.error) {
      setError(nextExplicitEnd.error);
      return;
    }
    if (nextJoinDeadline.error) {
      setError(nextJoinDeadline.error);
      return;
    }
    if (nextParticipantCapacity.error) {
      setError(nextParticipantCapacity.error);
      return;
    }
    if (customTitle && customTitle.length < 3) {
      setError(t('plans.create.validation.titleTooShort'));
      return;
    }
    if (customDescription && customDescription.length < 10) {
      setError(t('plans.create.validation.descriptionTooShort'));
      return;
    }
    if (customTags.length > 8 || customTags.some((tag) => tag.length > 32)) {
      setError(t('plans.create.validation.tagsInvalid'));
      return;
    }
    if (focusMissingOfflineAddresses()) return;
    const destinationError = validatePlaceDestinations(usablePlaces);
    if (destinationError) {
      setError(destinationError);
      return;
    }
    creatingPlanRef.current = true;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const generatedPlanPayload = buildGeneratedPlanDisplay({
        places: usablePlaces,
        startsAt: nextSchedule.startsAt,
        mode: planModeFromPlaces(usablePlaces),
        joinApprovalMode: 'automatic',
      });
      const planPayload = {
        title: customTitle || generatedPlanPayload.title,
        description: customDescription || generatedPlanPayload.description,
        category: customCategory || undefined,
        tags: customTags.length ? customTags : undefined,
        mode: planModeFromPlaces(usablePlaces),
        locationLabel: editingPlan?.locationLabel ?? undefined,
        startsAt: nextSchedule.startsAt,
        joinClosesAt: nextJoinDeadline.joinClosesAt || nextSchedule.startsAt,
        endsAt: nextExplicitEnd.endsAt || nextSchedule.endsAt,
        maxParticipants: nextParticipantCapacity.maxParticipants ?? undefined,
        joinApprovalMode: isEditing ? editingPlan?.joinApprovalMode ?? 'automatic' : 'automatic',
        status: 'open' as const,
        mediaIds: isEditing && editingPlan?.media?.length ? editingPlan.media.map((media) => media.id) : undefined,
        places: usablePlaces.map((place, index) => {
          const customStop = isCustomPlanStop(place);
          const providerAddressPayload = !customStop && place.mode === 'local' ? providerAddressPayloadFromFormState(place.providerAddress) : null;
          return {
            kind: place.kind,
            placeId: customStop ? undefined : place.sourcePlaceId,
            mode: place.mode,
            title: place.title,
            addressPublicText: !customStop && place.mode === 'local' ? providerAddressPayload?.formattedAddress : undefined,
            googlePlaceId: providerAddressPayload?.googlePlaceId,
            googlePlaceName: providerAddressPayload?.googlePlaceName,
            formattedAddress: providerAddressPayload?.formattedAddress,
            googleMapsUri: providerAddressPayload?.googleMapsUri,
            latitude: providerAddressPayload?.latitude,
            longitude: providerAddressPayload?.longitude,
            locationSource: providerAddressPayload?.locationSource,
            addressValidationStatus: providerAddressPayload?.addressValidationStatus,
            onlineLabel: !customStop && place.mode === 'remote' ? place.onlineLabel.trim() || undefined : undefined,
            onlineUrl: !customStop && place.mode === 'remote' ? place.onlineUrl.trim() || undefined : undefined,
            startsAt: nextSchedule.placeStartsAt[index],
            endsAt: nextSchedule.placeEndsAt[index],
            order: index,
            mediaIds: selectedPlanPlaceMediaIds(place),
          };
        }),
      };
      const response = editingPlanId
        ? await api.plans.replace(editingPlanId, planPayload)
        : await api.plans.create(planPayload);
      const nextPlanId = response.plan.id;
      setCreatedPlanId(nextPlanId);
      if (!isEditing) clearPlanDraft(planDraftStorageKey, pendingPlaceIndexStorageKey);
      setMessage(isEditing ? t('plans.create.feedback.updated') : t('plans.create.feedback.created'));
      router.replace(`/plans/${encodeURIComponent(nextPlanId)}`);
    } catch (saveError) {
      creatingPlanRef.current = false;
      if (isPlanEditLockedError(saveError)) {
        setEditingPlanLocked(true);
        setError(t('plans.create.edit.saveLocked'));
      } else {
        setError(getFriendlyApiErrorMessage(saveError, isEditing ? t('plans.create.edit.updateFailed') : t('plans.create.feedback.createFailed')));
      }
      setSaving(false);
    }
  }

  const pickerIsOpen = pickerTarget !== null;
  const pickerTitle = pickerTarget === 'new' ? t('plans.create.timeline.addStop') : t('plans.create.customStop.detailTitle', { index: typeof pickerTarget === 'number' ? pickerTarget + 1 : '' });
  const detailPlace = detailPlaceIndex !== null ? places[detailPlaceIndex] : null;

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page web-app-page web-app-page--create web-app-page--plans app-create-shell app-create-shell--plan">
        <header className="app-create-header">
          <div className="app-create-header__title-row">
            <Link className="web-back-button app-create-back" href={editingPlanId ? `/plans/${editingPlanId}` : '/plans'} aria-label={editingPlanId ? t('plans.create.intro.backToPlan') : t('plans.create.intro.backToPlans')}><WebIcon name="back" size={18} decorative /></Link>
            <div className="app-create-header__copy">
              <div className="app-create-header__eyebrow">
                <PlansInternalBadge plansVisible={plansVisible} />
              </div>
              <h1>{isEditing ? t('plans.create.edit.headerTitle') : t('plans.create.headerTitle')}</h1>
              <p>{isEditing ? t('plans.create.intro.edit') : t('plans.create.intro.create')}</p>
            </div>
          </div>
          <div className="app-create-progress" aria-label={stage === 'build' ? t('plans.create.intro.stepOne') : t('plans.create.intro.stepTwo')}>
            <div className="app-create-progress__label-row">
              <span>{stage === 'build' ? t('plans.create.intro.stepOne') : t('plans.create.intro.stepTwo')}</span>
            </div>
            <div className="app-create-progress__track" aria-hidden="true">
              <span className="app-create-progress__fill" style={{ width: stage === 'build' ? '50%' : '100%' }} />
            </div>
          </div>
        </header>

        {!auth.hydrated || editingPlanLoading ? <section className="mobile-card"><p className="meta">{isEditing ? t('plans.create.edit.loadingTitle') : t('plans.create.intro.checkingSession')}</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <h3>{t('plans.create.intro.loginRequired')}</h3>
            <p>{isEditing ? t('plans.create.intro.loginEdit') : t('plans.create.intro.loginCreate')}</p>
            <button type="button" className="button primary" onClick={() => router.push(`/auth?next=${encodeURIComponent(editingPlanId ? `/plans/${editingPlanId}/edit` : '/plans/new')}`)}>{t('plans.create.intro.login')}</button>
          </section>
        ) : null}

        {auth.isAuthenticated && isEditing && editingPlanLocked ? (
          <section className="mobile-card mobile-card--soft">
            <h3>{t('plans.create.edit.locked')}</h3>
            <p>{error || t('plans.create.edit.lockedBody')}</p>
            <Link className="button secondary" href={`/plans/${editingPlanId}`}>{t('plans.create.intro.backToPlan')}</Link>
          </section>
        ) : null}

        {auth.isAuthenticated && (!isEditing || (!editingPlanLoading && !editingPlanLocked && editingPlan)) ? (
          <form className="plan-form plan-form--timeline plan-form--clean" onSubmit={submit}>
            <div className="plan-stage-tabs" aria-label={t('plans.create.optionsAccessibility')}>
              <button type="button" className={stage === 'build' ? 'is-active' : ''} onClick={() => setStage('build')}>{t('plans.create.stages.build')}</button>
              <button type="button" className={stage === 'preview' ? 'is-active' : ''} onClick={showPreviewStage}>{t('plans.create.stages.preview')}</button>
            </div>

            {stage === 'build' ? (
              <>
                {addressGuidanceNotice ? <p className="form-error">{addressGuidanceNotice}</p> : null}
                <section className="plan-build-timeline" aria-label={t('plans.create.timeline.buildAccessibility')}>
                  {places.map((place, index) => (
                    <div className="plan-place-time-group" key={place.id}>
                      <div className="plan-timeline-row plan-timeline-row--time plan-timeline-row--place-time">
                        <div className="plan-timeline-row__main">
                          <span className="semantic-badge time">{t('plans.create.timeline.dateTime')}</span>
                          <h3>{isCustomPlanStop(place) ? t('plans.create.customStop.detailTitle', { index: index + 1 }) : t('plans.create.place.label', { index: index + 1 })}</h3>
                        </div>
                        <QuickDateTimeButtons date={place.date} time={place.time} onChange={(patch) => updatePlaceSchedule(index, patch)} />
                      </div>

                      <div className="plan-timeline-row plan-timeline-row--place">
                        <PlanPlaceTimelineButton place={place} index={index} onOpen={() => setDetailPlaceIndex(index)} />
                        <div className="plan-timeline-row__actions">
                          <button type="button" className="button secondary" onClick={() => setDetailPlaceIndex(index)}>{t('plans.create.place.openDetails')}</button>
                        </div>
                      </div>

                      {expandedAddressPlaceIds.includes(place.id) && !isCustomPlanStop(place) && place.mode === 'local' ? (
                        <div
                          className="plan-starter-address-guidance"
                          ref={addressFocusPlaceId === place.id ? firstMissingOfflinePlaceRef : undefined}
                          tabIndex={-1}
                        >
                          <div className="plan-starter-address-guidance__copy">
                            <span className="semantic-badge place">{t('plans.create.timeline.addressNeeded')}</span>
                            <p className="form-error">{t('plans.create.validation.offlineInline')}</p>
                          </div>
                          <GooglePlacePicker
                            value={place.location}
                            onValueChange={(location) => updatePlaceManualLocation(index, location)}
                            onResolvedPlace={(resolvedPlace) => updatePlaceResolvedAddress(index, resolvedPlace)}
                            disabled={saving || place.uploading}
                            label={t('plans.create.place.verifiedAddress', { index: index + 1 })}
                            placeholder={t('plans.create.google.defaultPlaceholder')}
                            helperText={t('plans.create.place.starterAddressHelp')}
                            autoFocus={addressFocusPlaceId === place.id}
                          />
                          <div className="plan-starter-address-guidance__actions">
                            <button type="button" className="button secondary" onClick={() => removePlace(index)}>{t('plans.create.place.deleteThis')}</button>
                            <button type="button" className="button secondary" onClick={() => setDetailPlaceIndex(index)}>{t('plans.create.place.openDetails')}</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}

                  <div className="plan-timeline-row plan-timeline-row--add">
                    <button type="button" className={`plan-add-place-row ${places.length === 0 ? 'plan-add-place-row--first' : ''}`} onClick={addPlaceAndOpenPicker}>
                      <span>{t('plans.create.timeline.addStop')}</span>
                      <small>{places.length === 0 ? t('plans.create.timeline.firstStop') : t('plans.create.timeline.nextStop')}</small>
                    </button>
                  </div>

                  {places.length > 0 ? (
                    <div className="plan-timeline-row plan-timeline-row--time plan-timeline-row--optional-end">
                      <div className="plan-timeline-row__main">
                        <span className="semantic-badge time">{t('plans.create.timeline.optional')}</span>
                        <h3>{t('plans.create.timeline.planEndTitle')}</h3>
                        <p className="meta">{t('plans.create.timeline.planEndBody')}</p>
                      </div>
                      <DurationButtons startsAt={schedule.startsAt} onSelect={applyDuration} />
                      <div className="plan-timeline-row__fields">
                        <label>
                          <span>{t('plans.create.duration.endDate')}</span>
                          <input type="date" value={planEnd.date} onChange={(event) => updatePlanEnd({ date: event.target.value })} />
                        </label>
                        <label>
                          <span>{t('plans.create.duration.endTime')}</span>
                          <input type="time" value={planEnd.time} onChange={(event) => updatePlanEnd({ time: event.target.value })} />
                        </label>
                      </div>
                      {endSummary ? (
                        <div className="plan-end-summary">
                          <div>
                            <span className="semantic-badge time">{endSummary.label}</span>
                            <strong>{endSummary.endLabel}</strong>
                            <p>{endSummary.detail}</p>
                          </div>
                          {endSummary.manual ? <button type="button" className="button secondary" onClick={() => updatePlanEnd(EMPTY_PLAN_END_STATE)}>{t('plans.create.duration.useEstimate')}</button> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {places.length > 0 ? (
                    <div className="plan-timeline-row plan-timeline-row--time plan-timeline-row--optional-end">
                      <div className="plan-timeline-row__main">
                        <span className="semantic-badge plan">{t('plans.create.timeline.joining')}</span>
                        <h3>{t('plans.create.timeline.joinDeadlineTitle')}</h3>
                        <p className="meta">{t('plans.create.timeline.joinDeadlineBody')}</p>
                      </div>
                      <div className="plan-quick-picker-group">
                        <span>{t('plans.create.timeline.closeJoining')}</span>
                        <div className="plan-quick-button-row">
                          {(['start', '1h', '3h', '1d'] as PlanJoinDeadlinePreset[]).map((preset) => (
                            <button key={preset} type="button" className={joinDeadline.preset === preset ? 'is-active' : ''} onClick={() => setJoinDeadline({ preset, date: '', time: '' })}>{planJoinDeadlinePresetLabel(preset, t)}</button>
                          ))}
                          <button type="button" className={joinDeadline.preset === 'custom' ? 'is-active' : ''} onClick={() => setJoinDeadline((current) => ({ ...current, preset: 'custom' }))}>{t('plans.create.joinDeadline.custom')}</button>
                        </div>
                      </div>
                      {joinDeadline.preset === 'custom' ? (
                        <div className="plan-timeline-row__fields">
                          <label>
                            <span>{t('plans.create.joinDeadline.date')}</span>
                            <input type="date" value={joinDeadline.date} onChange={(event) => setJoinDeadline((current) => ({ ...current, date: event.target.value }))} />
                          </label>
                          <label>
                            <span>{t('plans.create.joinDeadline.time')}</span>
                            <input type="time" value={joinDeadline.time} onChange={(event) => setJoinDeadline((current) => ({ ...current, time: event.target.value }))} />
                          </label>
                        </div>
                      ) : null}
                      <p className={joinDeadlineSummary.error ? 'form-error' : 'meta'}>{joinDeadlineSummary.error || `${joinDeadlineSummary.presetLabel} · ${joinDeadlineSummary.deadlineLabel}`}</p>
                    </div>
                  ) : null}

                  {places.length > 0 ? (
                    <div className="plan-timeline-row plan-timeline-row--time plan-timeline-row--optional-end">
                      <div className="plan-timeline-row__main">
                        <span className="semantic-badge proposal">{t('plans.create.timeline.people')}</span>
                        <h3>{t('plans.create.capacity.title')}</h3>
                        <p className="meta">{t('plans.create.timeline.capacityBody')}</p>
                      </div>
                      <div className="plan-quick-picker-group">
                        <span>{t('plans.create.timeline.capacity')}</span>
                        <div className="plan-quick-button-row">
                          <button type="button" className={participantCapacity.mode === 'unlimited' ? 'is-active' : ''} onClick={() => setParticipantCapacity((current) => ({ ...current, mode: 'unlimited' }))}>{t('plans.create.capacity.unlimited')}</button>
                          <button type="button" className={participantCapacity.mode === 'limited' ? 'is-active' : ''} onClick={() => setParticipantCapacity((current) => ({ ...current, mode: 'limited', limit: current.limit || '8' }))}>{t('plans.create.capacity.limited')}</button>
                        </div>
                      </div>
                      {participantCapacity.mode === 'limited' ? (
                        <div className="plan-timeline-row__fields plan-timeline-row__fields--optional">
                          <label>
                            <span>{t('plans.create.capacity.maximum')}</span>
                            <input type="number" min={1} max={100} inputMode="numeric" value={participantCapacity.limit} onChange={(event) => setParticipantCapacity((current) => ({ ...current, limit: event.target.value.replace(/\D/g, '').slice(0, 3) }))} placeholder="8" />
                          </label>
                        </div>
                      ) : null}
                      <p className={participantCapacitySummary.error ? 'form-error' : 'meta'}>{participantCapacitySummary.error || (participantCapacity.mode === 'unlimited' ? t('plans.create.capacity.unlimitedHelp') : participantCapacitySummary.label)}</p>
                    </div>
                  ) : null}
                </section>

                {conflictWarning ? <p className="form-error">{conflictWarning}</p> : null}
                {error ? <p className="form-error">{error}</p> : null}
                {places.length > 0 ? <button className="button primary full" type="button" onClick={showPreviewStage} disabled={places.some((place) => place.uploading)}>{t('plans.create.edit.previewChanges')}</button> : null}
              </>
            ) : (
              <>
                <section className="plan-form__preview plan-preview-stage">
                  <div className="plan-preview-confirm-hero plan-preview-confirm-hero--simple">
                    <div className="plan-preview-confirm-hero__copy">
                      <span className="semantic-badge plan">{t('plans.create.stages.preview')}</span>
                      <h3>{previewTitle}</h3>
                      <p>{previewDescription}</p>
                    </div>
                    <div className="plan-preview-inline-meta" aria-label={t('plans.create.preview.summaryAccessibility')}>
                      <span>{schedule.startsAt ? new Date(schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : t('plans.create.preview.startNotSet')}</span>
                      {endSummary ? <span>{endSummary.label}: {endSummary.endLabel}</span> : null}
                      <span>{places.some((place) => isCustomPlanStop(place)) ? (places.length === 1 ? t('plans.row.stopOne', { count: places.length }) : t('plans.row.stopMany', { count: places.length })) : (places.length === 1 ? t('plans.row.placeOne', { count: places.length }) : t('plans.row.placeMany', { count: places.length }))}</span>
                      <span>{t('plans.detail.fields.joinCloses')}: {joinDeadlineSummary.deadlineLabel || t('plans.detail.values.notSet')}</span>
                      <span>{participantCapacitySummary.previewLabel}</span>
                      <span>{t('plans.detail.values.freeJoin')}</span>
                    </div>
                  </div>

                  <div className="plan-preview-deck-section">
                    <div className="plan-preview-section-heading">
                      <span className="semantic-badge plan">{t('plans.create.preview.feedPreview')}</span>
                    </div>
                    <div className="trade-create-preview__deck">
                      <PlanPreviewDeck
                        title={previewTitle}
                        description={previewDescription}
                        rangeLabel={rangeLabel}
                        places={places.map((place, index) => ({ id: place.id, kind: place.kind, mode: place.mode, title: planPreviewPlaceTitle(place, index, t), location: placePreviewLocation(place, t), date: place.date, time: place.time, media: isCustomPlanStop(place) ? null : place.media ?? place.existingMedia, staticMap: isCustomPlanStop(place) ? null : place.existingStaticMap }))}
                        className="trade-stack-deck--create-preview"
                      />
                    </div>
                  </div>

                  {endSummary ? (
                    <div className="plan-end-preview-card">
                      <span className="semantic-badge time">{endSummary.label}</span>
                      <strong>{endSummary.endLabel}</strong>
                      <p>{endSummary.detail}</p>
                    </div>
                  ) : null}

                  <div className="plan-preview-itinerary" aria-label={t('plans.create.preview.itineraryAccessibility')}>
                    <div className="plan-preview-section-heading">
                      <span className="semantic-badge place">{t('plans.create.preview.route')}</span>
                    </div>
                    {places.map((place, index) => (
                      <div className="plan-preview-itinerary-row" key={`confirm-${place.id}`}>
                        <span className="plan-preview-itinerary-row__number">{index + 1}</span>
                        <div>
                          <strong>{planPreviewPlaceTitle(place, index, t)}</strong>
                          <small>{planPreviewTimeLabel(place, t)}{placePreviewLocation(place, t) ? ` · ${placePreviewLocation(place, t)}` : ''}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                {message ? <p className="success-message">{message}</p> : null}
                {validationNotice ? <p className="form-error">{validationNotice}</p> : null}
                <div className="plan-preview-actions">
                  <button type="button" className="button secondary" disabled={saving || Boolean(createdPlanId)} onClick={() => setStage('build')}>{t('plans.create.preview.back')}</button>
                  {createdPlanId ? (
                    <Link className="button primary" href={`/plans/${encodeURIComponent(createdPlanId)}`}>{t('plans.create.preview.openCreated')}</Link>
                  ) : (
                    <button className="button primary" type="submit" disabled={saving || places.some((place) => place.uploading)}>{saving ? (isEditing ? t('plans.create.edit.saving') : t('plans.create.preview.creating')) : (isEditing ? t('plans.create.edit.save') : t('plans.create.preview.create'))}</button>
                  )}
                </div>
              </>
            )}
          </form>
        ) : null}

        {detailPlace && detailPlaceIndex !== null ? (
          <div className="plan-place-source-overlay" role="presentation">
            <button type="button" className="plan-place-source-backdrop" aria-label={t('plans.create.placeDetail.closeAccessibility')} onClick={() => setDetailPlaceIndex(null)} />
            <section className="plan-place-source-sheet plan-place-detail-sheet" role="dialog" aria-modal="true" aria-label={isCustomPlanStop(detailPlace) ? t('plans.create.customStop.detailTitle', { index: detailPlaceIndex + 1 }) : t('plans.create.place.label', { index: detailPlaceIndex + 1 })}>
              <div className="plan-detail-topbar">
                <div>
                  <h3>{isCustomPlanStop(detailPlace) ? t('plans.create.customStop.detailTitle', { index: detailPlaceIndex + 1 }) : t('plans.create.place.label', { index: detailPlaceIndex + 1 })}</h3>
                </div>
                <button type="button" className="plans-feed-icon-button" onClick={() => setDetailPlaceIndex(null)} aria-label={t('plans.create.placeDetail.closeAccessibility')}>×</button>
              </div>
              <div className="plan-place-picker-panel">
                <div className="plan-timeline-row__heading">
                  {isCustomPlanStop(detailPlace) ? <span className="semantic-badge time">{t('plans.create.customStop.badge')}</span> : detailPlace.sourcePlaceId ? <span className="semantic-badge place">{detailPlace.sourcePlaceSource === 'hellowhen_library' ? t('plans.create.placeDetail.sourceLibrary') : t('plans.create.placeDetail.sourceMine')}</span> : <span className="semantic-badge place">{t('plans.create.sourcePicker.customPlace')}</span>}
                </div>
                {isCustomPlanStop(detailPlace) ? (
                  <>
                    <div>
                      <span className="meta">{t('plans.create.customStop.type')}</span>
                      <div className="plans-tabs" role="group" aria-label={t('plans.create.customStop.type')}>
                        {(['pause', 'free_time', 'meeting_point', 'custom'] as CustomPlanStopKind[]).map((kind) => (
                          <button
                            type="button"
                            key={kind}
                            className={detailPlace.kind === kind ? 'is-active' : ''}
                            onClick={() => updatePlace(detailPlaceIndex, {
                              kind,
                              mode: 'local',
                              sourcePlaceId: undefined,
                              sourcePlaceTitle: undefined,
                              location: '',
                              providerAddress: emptyProviderAddressFormState(),
                              onlineLabel: '',
                              onlineUrl: '',
                              existingMedia: null,
                              existingStaticMap: null,
                              media: null,
                              title: detailPlace.title.trim() ? detailPlace.title : kind === 'custom' ? '' : customPlanStopTitle(kind, t),
                            })}
                          >
                            {customPlanStopTitle(kind, t)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label>
                      <span>{t('plans.create.customStop.label')}</span>
                      <input value={detailPlace.title} onChange={(event) => updatePlace(detailPlaceIndex, { title: event.target.value })} minLength={3} maxLength={120} required placeholder={t('plans.create.customStop.labelPlaceholder')} />
                    </label>
                    <section className="notice-box info">
                      <strong>{t('plans.create.customStop.noAddressTitle')}</strong> {t('plans.create.customStop.noAddressBody')}
                    </section>
                  </>
                ) : !detailPlace.sourcePlaceId ? (
                  <>
                    <PlaceModeSegment value={detailPlace.mode} onChange={(mode) => updateCustomPlaceMode(detailPlaceIndex, mode)} />
                    <label>
                      <span>{t('plans.create.place.name')}</span>
                      <input value={detailPlace.title} onChange={(event) => updatePlace(detailPlaceIndex, { title: event.target.value })} minLength={3} maxLength={120} required placeholder={detailPlace.mode === 'remote' ? t('plans.create.place.nameOnlinePlaceholder') : t('plans.create.place.nameOfflinePlaceholder')} />
                    </label>
                    {detailPlace.mode === 'remote' ? (
                      <div className="plan-form__row">
                        <label>
                          <span>{t('plans.create.place.onlineLabel')}</span>
                          <input value={detailPlace.onlineLabel} onChange={(event) => updatePlace(detailPlaceIndex, { onlineLabel: event.target.value })} maxLength={120} placeholder={t('plans.create.place.onlineLabelPlaceholder')} />
                        </label>
                        <label>
                          <span>{t('plans.create.place.onlineUrl')}</span>
                          <input type="url" value={detailPlace.onlineUrl} onChange={(event) => updatePlace(detailPlaceIndex, { onlineUrl: event.target.value })} maxLength={500} placeholder="https://..." />
                          <small>{localizedOnlineProviderHint(detailPlace.onlineUrl, t)}</small>
                        </label>
                      </div>
                    ) : (
                      <>
                        <GooglePlacePicker
                          value={detailPlace.location}
                          onValueChange={(location) => updatePlaceManualLocation(detailPlaceIndex, location)}
                          onResolvedPlace={(place) => updatePlaceResolvedAddress(detailPlaceIndex, place)}
                          disabled={saving || detailPlace.uploading}
                          label={t('plans.create.google.defaultLabel')}
                          placeholder={t('plans.create.google.defaultPlaceholder')}
                          helperText={t('plans.create.google.defaultHelp', { count: 3 })}
                        />
                        {detailPlace.location.trim() && !providerAddressStatusLabel(detailPlace.providerAddress) ? <p className="form-error">{t('plans.create.validation.offlineInline')}</p> : null}
                      </>
                    )}
                  </>
                ) : (
                  <div className="plan-source-place-strip">
                    <strong>{detailPlace.sourcePlaceTitle || detailPlace.title}</strong>
                    <span>{detailPlace.sourcePlaceSource === 'my_place' ? t('plans.create.placeDetail.savedUpdateBody') : t('plans.create.placeDetail.libraryCopyBody')}</span>
                    <div className="cta-row">
                      {detailPlace.sourcePlaceSource === 'my_place' ? (
                        <button type="button" className="button secondary" onClick={() => openEditMyPlaceFromDetail(detailPlaceIndex)}>{t('plans.create.placeDetail.editSaved')}</button>
                      ) : null}
                      {detailPlace.sourcePlaceSource === 'hellowhen_library' ? (
                        <button type="button" className="button secondary" onClick={() => openCopyLibraryPlaceFromDetail(detailPlaceIndex)}>{t('plans.create.placeDetail.copyToEdit')}</button>
                      ) : null}
                      <button type="button" className="button secondary" onClick={() => updatePlace(detailPlaceIndex, resetToCustomPatch())}>{t('plans.create.placeDetail.makeCustom')}</button>
                    </div>
                  </div>
                )}
                {!isCustomPlanStop(detailPlace) ? (
                  <PlaceImagePicker
                    place={detailPlace}
                    onUpload={(event) => { const files = event.target.files; event.currentTarget.value = ''; void uploadPlaceImage(detailPlaceIndex, files); }}
                    onRemove={() => updatePlace(detailPlaceIndex, { media: null })}
                  />
                ) : null}
                <div className="plan-place-detail-actions">
                  <button type="button" className="button secondary" disabled={detailPlaceIndex === 0} onClick={() => { movePlace(detailPlaceIndex, -1); setDetailPlaceIndex(detailPlaceIndex - 1); }}>{t('plans.create.placeDetail.moveUp')}</button>
                  <button type="button" className="button secondary" disabled={detailPlaceIndex === places.length - 1} onClick={() => { movePlace(detailPlaceIndex, 1); setDetailPlaceIndex(detailPlaceIndex + 1); }}>{t('plans.create.placeDetail.moveDown')}</button>
                  <button type="button" className="button secondary" onClick={() => openPicker(detailPlaceIndex)}>{isCustomPlanStop(detailPlace) ? t('plans.create.time.changeStopType') : t('plans.create.placeDetail.changePlace')}</button>
                  <button type="button" className="button secondary" onClick={() => removePlace(detailPlaceIndex)}>{t('plans.create.placeDetail.remove')}</button>
                  <button type="button" className="button primary" onClick={() => setDetailPlaceIndex(null)}>{t('plans.create.placeDetail.done')}</button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {pickerIsOpen ? (
          <div className="plan-place-source-overlay" role="presentation">
            <button type="button" className="plan-place-source-backdrop" aria-label={t('plans.create.sourcePicker.closeAccessibility')} onClick={closePlacePicker} />
            <section className="plan-place-source-sheet plan-place-source-sheet--compact" role="dialog" aria-modal="true" aria-label={pickerTitle}>
              <div className="plan-detail-topbar">
                <div>
                  <h3>{pickerView === 'source' ? t('plans.create.timeline.addStop') : pickerView === 'custom_stop' ? t('plans.create.sourcePicker.customStop') : pickerTab === 'mine' ? t('plans.create.sourcePicker.myPlaces') : t('plans.create.sourcePicker.library')}</h3>
                </div>
                <button type="button" className="plans-feed-icon-button" onClick={closePlacePicker} aria-label={t('plans.create.sourcePicker.closeAccessibility')}>×</button>
              </div>

              {pickerView === 'source' ? (
                <div className="plan-place-source-grid">
                  <button type="button" className="plan-place-source-option plan-place-source-option--primary" onClick={() => openPickerList('mine')}>
                    <span className="plan-place-source-option__icon"><WebIcon name="location-on" size={16} decorative /></span>
                    <span><strong>{t('plans.create.sourcePicker.myPlaces')}</strong></span>
                  </button>
                  <button type="button" className="plan-place-source-option" onClick={() => openPickerList('library')}>
                    <span className="plan-place-source-option__icon">✦</span>
                    <span><strong>{t('plans.create.sourcePicker.library')}</strong></span>
                  </button>
                  <button type="button" className="plan-place-source-option" onClick={openCreatePlaceFromPicker}>
                    <span className="plan-place-source-option__icon"><WebIcon name="location-on" size={16} decorative /></span>
                    <span><strong>{t('plans.create.sourcePicker.newPlace')}</strong></span>
                  </button>
                  <button type="button" className="plan-place-source-option" onClick={useCustomPlaceFromPicker}>
                    <span className="plan-place-source-option__icon"><WebIcon name="location-on" size={16} decorative /></span>
                    <span><strong>{t('plans.create.sourcePicker.customPlace')}</strong></span>
                  </button>
                  <button type="button" className="plan-place-source-option" onClick={openCustomStopPicker}>
                    <span className="plan-place-source-option__icon">•••</span>
                    <span><strong>{t('plans.create.sourcePicker.customStop')}</strong></span>
                  </button>
                </div>
              ) : pickerView === 'custom_stop' ? (
                <div className="plan-place-picker-panel">
                  <p className="meta">{t('plans.create.customStop.helper')}</p>
                  <div className="plan-place-source-grid">
                    {(['pause', 'free_time', 'meeting_point', 'custom'] as CustomPlanStopKind[]).map((kind) => (
                      <button type="button" className="plan-place-source-option" key={kind} onClick={() => useCustomStopFromPicker(kind)}>
                        <span className="plan-place-source-option__icon"><WebIcon name={kind === 'meeting_point' ? 'location-on' : 'plan'} size={16} decorative /></span>
                        <span><strong>{customPlanStopTitle(kind, t)}</strong><small>{kind === 'pause' ? t('plans.create.customStop.pauseBody') : kind === 'free_time' ? t('plans.create.customStop.freeTimeBody') : kind === 'meeting_point' ? t('plans.create.customStop.meetingPointBody') : t('plans.create.customStop.customBody')}</small></span>
                      </button>
                    ))}
                  </div>
                  <div className="plan-place-picker-actions">
                    <button type="button" className="button secondary" onClick={() => setPickerView('source')}>{t('plans.create.sourcePicker.sources')}</button>
                  </div>
                </div>
              ) : (
                <div className="plan-place-picker-panel">
                  <div className="plan-place-picker-toolbar">
                    <div className="plans-tabs" role="tablist" aria-label={t('plans.create.sourcePicker.library')}>
                      <button type="button" className={pickerTab === 'mine' ? 'is-active' : ''} onClick={() => openPickerList('mine')}>{t('plans.create.sourcePicker.myPlaces')}</button>
                      <button type="button" className={pickerTab === 'library' ? 'is-active' : ''} onClick={() => openPickerList('library')}>{t('plans.create.sourcePicker.library')}</button>
                    </div>
                    <button type="button" className="button secondary plan-place-picker-refresh" onClick={loadReusablePlaces}>{t('plans.create.sourcePicker.refresh')}</button>
                  </div>
                  <label>
                    <span>{t('plans.create.sourcePicker.searchLabel')}</span>
                    <input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder={t('plans.create.sourcePicker.searchPlaceholder')} />
                  </label>
                  {pickerTab === 'mine' ? (
                    <PlacePickerList places={filteredMyPlaces} emptyLabel={t('plans.create.sourcePicker.noMineBody')} onChoose={chooseReusablePlace} />
                  ) : (
                    <PlacePickerList places={filteredLibraryPlaces} emptyLabel={t('plans.create.sourcePicker.noLibraryBody')} onChoose={chooseReusablePlace} />
                  )}
                  <div className="plan-place-picker-actions">
                    <button type="button" className="button secondary" onClick={() => setPickerView('source')}>{t('plans.create.sourcePicker.sources')}</button>
                    <button type="button" className="button secondary" onClick={openCreatePlaceFromPicker}>{t('plans.create.sourcePicker.newPlace')}</button>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
