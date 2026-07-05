'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import type { GoogleResolvedPlace, MediaAssetDto, PlaceDto, PlaceStaticMapDto, PlanPlaceMode } from '@hellowhen/contracts';
import { buildGeneratedPlanDisplay, parseStarterPlanIdeaKey, starterPlanIdeas, type StarterPlanIdeaStop } from '@hellowhen/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { GooglePlacePicker } from './GooglePlacePicker';
import { emptyProviderAddressFormState, offlineProviderAddressError, onlineDestinationError, onlineProviderHint, providerAddressFormStateFromGooglePlace, providerAddressFormStateFromStoredPlace, providerAddressPayloadFromFormState, providerAddressStatusLabel, type WebProviderAddressFormState } from './placeAddressForm';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';
import { PlanPreviewDeck } from './PlanPreviewDeck';
import { buildPlanSchedule, toDateInputValue } from './planSchedule';
import { planMediaSrc, planPlaceModeLabel } from './plansPresentation';

type PlaceFormState = {
  id: string;
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
  existingStaticMap: PlaceStaticMapDto | null;
  media: MediaAssetDto | null;
  uploading: boolean;
};

function makePlace(index: number, date = toDateInputValue()): PlaceFormState {
  return {
    id: `place-${Date.now()}-${index}`,
    sourcePlaceSource: 'custom',
    mode: 'local',
    date,
    time: index === 0 ? '13:00' : '',
    title: '',
    location: '',
    providerAddress: emptyProviderAddressFormState(),
    onlineLabel: '',
    onlineUrl: '',
    existingMedia: null,
    existingStaticMap: null,
    media: null,
    uploading: false,
  };
}

function makePlaceFromPlanIdeaStop(stop: StarterPlanIdeaStop, index: number, date = toDateInputValue()): PlaceFormState {
  return {
    id: `plan-idea-place-${Date.now()}-${index}`,
    sourcePlaceSource: 'custom',
    mode: stop.mode,
    date,
    time: stop.time,
    title: stop.title,
    location: '',
    providerAddress: emptyProviderAddressFormState(),
    onlineLabel: stop.mode === 'remote' ? stop.onlineLabel ?? '' : '',
    onlineUrl: stop.mode === 'remote' ? stop.onlineUrl ?? '' : '',
    existingMedia: null,
    existingStaticMap: null,
    media: null,
    uploading: false,
  };
}


const PLAN_CREATE_DRAFT_STORAGE_KEY = 'hellowhen.planCreateDraft.v1';
const PLAN_CREATE_PENDING_PLACE_INDEX_KEY = 'hellowhen.planCreateDraft.pendingPlaceIndex.v1';

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

type PlanCreateStage = 'build' | 'preview';
type PlacePickerTarget = number | 'new';
type PlacePickerView = 'source' | 'list';

const PLAN_OFFLINE_ADDRESS_TOP_ERROR = 'Some offline places need an address. Choose a verified address for each offline place, or delete the places you do not want to use.';
const PLAN_OFFLINE_ADDRESS_INLINE_ERROR = 'Choose a verified address for this place, or delete it.';

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

function safeReadAdvancedPlanDetails(): AdvancedPlanDetailsState {
  if (typeof window === 'undefined') return EMPTY_ADVANCED_PLAN_DETAILS;
  try {
    const rawDraft = window.sessionStorage.getItem(PLAN_CREATE_DRAFT_STORAGE_KEY);
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

function safeReadPlanEndState(): PlanEndState {
  if (typeof window === 'undefined') return EMPTY_PLAN_END_STATE;
  try {
    const rawDraft = window.sessionStorage.getItem(PLAN_CREATE_DRAFT_STORAGE_KEY);
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

function safeReadPlanDraft(): PlaceFormState[] {
  if (typeof window === 'undefined') return [];
  try {
    const rawDraft = window.sessionStorage.getItem(PLAN_CREATE_DRAFT_STORAGE_KEY);
    if (!rawDraft) return [];
    const parsed = JSON.parse(rawDraft) as { places?: StoredPlaceFormState[] };
    if (!Array.isArray(parsed.places)) return [];
    return parsed.places.map((place, index) => ({
      id: typeof place.id === 'string' ? place.id : `place-${Date.now()}-${index}`,
      sourcePlaceId: place.sourcePlaceId,
      sourcePlaceSource: place.sourcePlaceSource ?? 'custom',
      sourcePlaceTitle: place.sourcePlaceTitle,
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

function storePlanDraft(places: PlaceFormState[], advanced: AdvancedPlanDetailsState = EMPTY_ADVANCED_PLAN_DETAILS, end: PlanEndState = EMPTY_PLAN_END_STATE) {
  if (typeof window === 'undefined') return;
  const safePlaces: StoredPlaceFormState[] = places.map(({ uploading: _uploading, ...place }) => place);
  window.sessionStorage.setItem(PLAN_CREATE_DRAFT_STORAGE_KEY, JSON.stringify({ places: safePlaces, advanced, end }));
}

function clearPlanDraft() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PLAN_CREATE_DRAFT_STORAGE_KEY);
  window.sessionStorage.removeItem(PLAN_CREATE_PENDING_PLACE_INDEX_KEY);
}

function setPendingCreatedPlaceIndex(index: number | null) {
  if (typeof window === 'undefined') return;
  if (index === null) window.sessionStorage.removeItem(PLAN_CREATE_PENDING_PLACE_INDEX_KEY);
  else window.sessionStorage.setItem(PLAN_CREATE_PENDING_PLACE_INDEX_KEY, String(index));
}

function takePendingCreatedPlaceIndex() {
  if (typeof window === 'undefined') return null;
  const rawIndex = window.sessionStorage.getItem(PLAN_CREATE_PENDING_PLACE_INDEX_KEY);
  window.sessionStorage.removeItem(PLAN_CREATE_PENDING_PLACE_INDEX_KEY);
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
  // Saved Place images already belong to the source Place. Plan Places can
  // display them through the existing source-place media fallback, so only
  // newly uploaded Plan-specific images should be attached to the Plan Place.
  return selectedMediaIds(place.media);
}

function parsePlanTagsInput(value: string) {
  return Array.from(new Set(value.split(/[,\n]/).map((tag) => tag.trim()).filter(Boolean)));
}

function planModeFromPlaces(places: PlaceFormState[]) {
  const modes = new Set(places.map((place) => place.mode));
  if (modes.size > 1) return 'hybrid' as const;
  return modes.has('remote') ? 'remote' as const : 'local' as const;
}

function rangeLabelFromSchedule(schedule: ReturnType<typeof buildPlanSchedule>) {
  if (!schedule.startsAt) return '';
  return `${new Date(schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} → ${new Date(schedule.endsAt || schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function parseOptionalPlanEnd(end: PlanEndState, fallbackStartAt: string) {
  if (!end.date.trim() && !end.time.trim()) return { endsAt: '', error: '' };
  if (!end.date.trim() || !end.time.trim()) return { endsAt: '', error: 'Add both an end date and end time, or leave the end empty.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end.date.trim()) || !/^\d{2}:\d{2}$/.test(end.time.trim())) return { endsAt: '', error: 'Add a valid end date and time, or leave the end empty.' };
  const parsed = new Date(`${end.date}T${end.time}:00`);
  if (Number.isNaN(parsed.getTime())) return { endsAt: '', error: 'Add a valid end date and time, or leave the end empty.' };
  if (fallbackStartAt && parsed.getTime() < new Date(fallbackStartAt).getTime()) return { endsAt: '', error: 'End time must be after the Plan start.' };
  return { endsAt: parsed.toISOString(), error: '' };
}

function parsePlanEndOverride(end: PlanEndState, fallbackStartAt: string) {
  return parseOptionalPlanEnd(end, fallbackStartAt);
}

function rangeLabelWithEnd(schedule: ReturnType<typeof buildPlanSchedule>, end: PlanEndState) {
  if (!schedule.startsAt) return '';
  const parsedEnd = parseOptionalPlanEnd(end, schedule.startsAt);
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

function formatDurationMinutes(minutes?: number | null) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return '';
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return `${remainder}m`;
}

function planEndSummary(schedule: ReturnType<typeof buildPlanSchedule>, end: PlanEndState) {
  if (!schedule.startsAt) return null;
  const parsedEnd = parseOptionalPlanEnd(end, schedule.startsAt);
  const hasManualInput = hasPlanEndOverride(end);
  if (hasManualInput && parsedEnd.error) return null;
  const manual = hasManualInput && Boolean(parsedEnd.endsAt);
  const endsAt = manual ? parsedEnd.endsAt : schedule.endsAt;
  if (!endsAt) return null;
  const endLabel = formatPlanDateTime(endsAt);
  const estimatedDuration = formatDurationMinutes(schedule.estimatedFinalEnd?.roundedGapMinutes);
  const detail = manual
    ? 'Manual override is active. Clear it to use the automatic estimate from the place times.'
    : schedule.estimatedFinalEnd?.placeCount === 1
      ? `Estimated from the single-place default${estimatedDuration ? ` (${estimatedDuration})` : ''}.`
      : `Estimated from the average gap between places${estimatedDuration ? ` (${estimatedDuration})` : ''}.`;
  return {
    label: manual ? 'Manual end' : 'Estimated end',
    endsAt,
    endLabel,
    detail,
    manual,
  };
}

function placeSourceLabel(place: PlaceDto) {
  return place.source === 'hellowhen_library' ? 'hellowhen library' : 'my place';
}

function libraryPlaceSource(place: PlaceDto): PlaceFormState['sourcePlaceSource'] {
  return place.source === 'hellowhen_library' ? 'hellowhen_library' : 'my_place';
}

function placeLocationForForm(place: PlaceDto) {
  return place.mode === 'remote' ? '' : place.formattedAddress ?? place.addressPublicText ?? place.areaLabel ?? '';
}

function placePreviewLocation(place: PlaceFormState) {
  if (place.mode === 'remote') return place.onlineLabel.trim() || place.onlineUrl.trim() || place.location.trim();
  return place.location.trim();
}


function planPreviewTimeLabel(place: PlaceFormState) {
  if (place.date && place.time) return `${place.date} · ${place.time}`;
  if (place.time) return place.time;
  return 'Time required';
}

function planPreviewPlaceTitle(place: PlaceFormState, index: number) {
  return place.title.trim() || place.sourcePlaceTitle?.trim() || `Place ${index + 1}`;
}

function incompleteOfflinePlaceIndexes(places: PlaceFormState[]) {
  return places.reduce<number[]>((indexes, place, index) => {
    if (place.mode === 'local' && offlineProviderAddressError(place.providerAddress)) indexes.push(index);
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
    mode: place.mode ?? 'local',
    title: place.title,
    location: placeLocationForForm(place),
    providerAddress: place.mode === 'remote' ? emptyProviderAddressFormState() : providerAddressFormStateFromStoredPlace(place),
    onlineLabel: place.onlineLabel ?? '',
    onlineUrl: place.onlineUrl ?? '',
    existingMedia: place.media?.[0] ?? null,
    existingStaticMap: place.staticMap ?? null,
    media: null,
  };
}

function resetToCustomPatch(): Partial<PlaceFormState> {
  return {
    sourcePlaceId: undefined,
    sourcePlaceSource: 'custom',
    sourcePlaceTitle: undefined,
    existingMedia: null,
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
  return (
    <div className="plan-mode-segment" aria-label="Place type">
      <button type="button" className={value === 'local' ? 'is-active' : ''} onClick={() => onChange('local')}>Local</button>
      <button type="button" className={value === 'remote' ? 'is-active' : ''} onClick={() => onChange('remote')}>Remote</button>
    </div>
  );
}

function PlaceImagePicker({ place, onUpload, onRemove }: { place: PlaceFormState; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) {
  const visibleMedia = place.media ?? place.existingMedia;
  return (
    <div className="plan-place-image-picker">
      <label className="image-upload-button">
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={place.uploading || Boolean(visibleMedia)} onChange={onUpload} />
        {place.uploading ? 'Uploading...' : visibleMedia ? 'One image selected' : 'Add place image'}
      </label>
      {visibleMedia ? (
        <figure>
          <img src={planMediaSrc(visibleMedia)} alt={visibleMedia.filename ?? 'Place image'} />
          <figcaption>
            <span className="semantic-badge instruction">1 image</span>
            {place.media ? <button type="button" className="secondary" onClick={onRemove}>Remove new image</button> : <span className="meta">Saved place image</span>}
          </figcaption>
        </figure>
      ) : <p className="meta">One image per place for this first version.</p>}
    </div>
  );
}

function PlanPlaceTimelineButton({ place, index, onOpen }: { place: PlaceFormState; index: number; onOpen: () => void }) {
  const imageSrc = planMediaSrc(place.media ?? place.existingMedia);
  return (
    <button type="button" className="plan-timeline-row__main plan-timeline-row__main--button plan-place-summary-button" onClick={onOpen}>
      <span className="plan-place-summary-button__media" aria-hidden="true">
        {imageSrc ? <img src={imageSrc} alt="" loading="lazy" /> : <WebIcon name="location-on" size={24} decorative />}
      </span>
      <span className="plan-place-summary-button__copy">
        <span className="plan-timeline-row__heading">
          <span className="semantic-badge place">Place {index + 1}</span>
          {place.sourcePlaceId ? <span className="semantic-badge place">{place.sourcePlaceSource === 'hellowhen_library' ? 'Library' : 'My Place'}</span> : <span className="semantic-badge place">Custom</span>}
        </span>
        <strong>{planPreviewPlaceTitle(place, index)}</strong>
        <small>{placePreviewLocation(place) || 'No location yet'}</small>
      </span>
    </button>
  );
}

function reusablePlaceAddressError(place: PlaceDto) {
  if (place.mode === 'remote') return onlineDestinationError({ onlineUrl: place.onlineUrl });
  return offlineProviderAddressError(providerAddressFormStateFromStoredPlace(place));
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
  if (!places.length) return <p className="meta">{emptyLabel}</p>;
  return (
    <div className="plan-place-picker-list">
      {places.map((place) => {
        const media = place.media?.[0] ?? null;
        const addressError = reusablePlaceAddressError(place);
        const meta = [planPlaceModeLabel(place.mode), place.category, place.formattedAddress || place.addressPublicText || place.onlineLabel]
          .filter((value): value is string => Boolean(value && value.trim()))
          .join(' · ');
        return (
          <button type="button" className="plan-place-picker-card" key={place.id} onClick={() => onChoose(place)} disabled={Boolean(addressError)}>
            <span className="plan-place-picker-card__media">
              {media ? <img src={planMediaSrc(media)} alt={media.filename ?? place.title} /> : <WebIcon name="location-on" size={20} decorative />}
            </span>
            <span className="plan-place-picker-card__body">
              <strong>{place.title}</strong>
              <small>{addressError || meta || placeSourceLabel(place)}</small>
            </span>
            <span className="semantic-badge instruction">{addressError ? 'Fix first' : 'Use'}</span>
          </button>
        );
      })}
    </div>
  );
}

type PlanCreateClientProps = {
  plansEnabled?: boolean;
  plansVisible?: boolean;
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
  return (
    <section className="plan-advanced-details">
      <button
        type="button"
        className="plan-advanced-details__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>More options</span>
        <small>{open ? 'Hide custom Plan details' : 'Optional title, description, category, tags'}</small>
        <strong>{open ? '−' : '+'}</strong>
      </button>
      {open ? (
        <div className="plan-advanced-details__panel">
          <label>
            <span>Custom Plan title</span>
            <input value={details.title} onChange={(event) => onChange({ title: event.target.value })} minLength={3} maxLength={120} placeholder={generatedTitle} />
          </label>
          <label>
            <span>Custom Plan description</span>
            <textarea value={details.description} onChange={(event) => onChange({ description: event.target.value })} minLength={10} maxLength={2000} placeholder={generatedDescription} />
          </label>
          <div className="plan-form__row">
            <label>
              <span>Category</span>
              <input value={details.category} onChange={(event) => onChange({ category: event.target.value })} maxLength={80} placeholder="Culture, food, startup..." />
            </label>
            <label>
              <span>Tags</span>
              <input value={details.tags} onChange={(event) => onChange({ tags: event.target.value })} maxLength={280} placeholder="Paris, coffee, weekend" />
            </label>
          </div>
          <p className="meta">Leave these empty to use the generated place/time summary. Tags can be separated by commas.</p>
        </div>
      ) : null}
    </section>
  );
}

export function PlanCreateClient({ plansEnabled, plansVisible }: PlanCreateClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useWebAuth();
  const createdPlaceId = searchParams.get('createdPlaceId');
  const updatedPlaceId = searchParams.get('updatedPlaceId');
  const initialPlanIdeaKey = parseStarterPlanIdeaKey(searchParams.get('idea'));
  const handledPlanIdeaKeyRef = useRef<string | null>(null);
  const handledCreatedPlaceIdRef = useRef<string | null>(null);
  const handledUpdatedPlaceIdRef = useRef<string | null>(null);
  const creatingPlanRef = useRef(false);
  const [places, setPlaces] = useState<PlaceFormState[]>(() => safeReadPlanDraft());
  const [advancedDetails, setAdvancedDetails] = useState<AdvancedPlanDetailsState>(() => safeReadAdvancedPlanDetails());
  const [planEnd, setPlanEnd] = useState<PlanEndState>(() => safeReadPlanEndState());
  const [stage, setStage] = useState<PlanCreateStage>('build');
  const [advancedDetailsOpen, setAdvancedDetailsOpen] = useState(false);
  const [myPlaces, setMyPlaces] = useState<PlaceDto[]>([]);
  const [libraryPlaces, setLibraryPlaces] = useState<PlaceDto[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PlacePickerTarget | null>(null);
  const [pickerView, setPickerView] = useState<PlacePickerView>('source');
  const [pickerTab, setPickerTab] = useState<'mine' | 'library'>('mine');
  const [detailPlaceIndex, setDetailPlaceIndex] = useState<number | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [addressGuidanceNotice, setAddressGuidanceNotice] = useState('');
  const [expandedAddressPlaceIds, setExpandedAddressPlaceIds] = useState<string[]>([]);
  const [addressFocusPlaceId, setAddressFocusPlaceId] = useState<string | null>(null);
  const firstMissingOfflinePlaceRef = useRef<HTMLDivElement | null>(null);

  const placesForGeneratedDisplay = useMemo(() => places.filter((place) => place.title.trim() || place.sourcePlaceTitle?.trim()), [places]);
  const schedulablePlaces = useMemo(() => places.filter((place) => place.title.trim() || place.sourcePlaceId), [places]);
  const schedule = useMemo(() => buildPlanSchedule(schedulablePlaces), [schedulablePlaces]);
  const explicitPlanEnd = useMemo(() => parsePlanEndOverride(planEnd, schedule.startsAt), [planEnd, schedule.startsAt]);
  const endSummary = useMemo(() => planEndSummary(schedule, planEnd), [schedule, planEnd]);
  const rangeLabel = rangeLabelWithEnd(schedule, planEnd);
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

  async function loadReusablePlaces() {
    setLoadingPlaces(true);
    try {
      const [mineResponse, libraryResponse] = await Promise.all([
        api.places.mine({ take: 100 }),
        api.places.library({ take: 100 }),
      ]);
      setMyPlaces(mineResponse.places);
      setLibraryPlaces(libraryResponse.places);
    } catch (loadError) {
      setError(getFriendlyApiErrorMessage(loadError, 'Could not load Place Library. You can still add custom places.'));
    } finally {
      setLoadingPlaces(false);
    }
  }

  useEffect(() => {
    if (!auth.hydrated || !auth.isAuthenticated) return;
    void loadReusablePlaces();
  }, [auth.hydrated, auth.isAuthenticated]);

  useEffect(() => {
    if (!initialPlanIdeaKey || handledPlanIdeaKeyRef.current === initialPlanIdeaKey || places.length > 0) return;
    const idea = starterPlanIdeas[initialPlanIdeaKey];
    const date = toDateInputValue();
    handledPlanIdeaKeyRef.current = initialPlanIdeaKey;
    setPlaces(idea.stops.map((stop, index) => makePlaceFromPlanIdeaStop(stop, index, date)));
    setMessage('Starter Plan idea loaded. Offline stops are prompts only: select real address suggestions, and add online links before publishing.');
  }, [initialPlanIdeaKey, places.length]);

  useEffect(() => {
    storePlanDraft(places, advancedDetails, planEnd);
  }, [places, advancedDetails, planEnd]);


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
    const returnedPlaceId = createdPlaceId || updatedPlaceId;
    const isUpdateReturn = Boolean(updatedPlaceId);
    const handledRef = isUpdateReturn ? handledUpdatedPlaceIdRef : handledCreatedPlaceIdRef;
    if (!returnedPlaceId || handledRef.current === returnedPlaceId) return;
    const returnedPlace = myPlaces.find((place) => place.id === returnedPlaceId);
    if (!returnedPlace) return;
    handledRef.current = returnedPlaceId;
    const pendingIndex = takePendingCreatedPlaceIndex();
    setPlaces((current) => {
      if (pendingIndex !== null && current[pendingIndex]) {
        return current.map((place, placeIndex) => placeIndex === pendingIndex ? { ...place, ...applyReusablePlacePatch(returnedPlace) } : place);
      }
      if (isUpdateReturn) {
        return current.map((place) => place.sourcePlaceId === returnedPlace.id ? { ...place, ...applyReusablePlacePatch(returnedPlace) } : place);
      }
      const previous = current[current.length - 1];
      return [
        ...current,
        {
          ...makePlace(current.length, previous?.date || toDateInputValue()),
          ...applyReusablePlacePatch(returnedPlace),
        },
      ];
    });
    setMessage(isUpdateReturn ? 'Place updated in this Plan.' : 'Place saved and added to this Plan.');
    router.replace('/plans/new', { scroll: false });
  }, [createdPlaceId, myPlaces, router, updatedPlaceId]);

  function updatePlace(index: number, update: Partial<PlaceFormState>) {
    setPlaces((current) => current.map((place, placeIndex) => placeIndex === index ? { ...place, ...update } : place));
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

  function useCustomPlaceFromPicker() {
    if (pickerTarget === 'new') {
      const nextIndex = places.length;
      setPlaces((current) => {
        const previous = current[current.length - 1];
        return [...current, makePlace(current.length, previous?.date || toDateInputValue())];
      });
      setDetailPlaceIndex(nextIndex);
    }
    if (typeof pickerTarget === 'number') {
      updatePlace(pickerTarget, resetToCustomPatch());
      setDetailPlaceIndex(pickerTarget);
    }
    closePlacePicker();
  }

  function removePlace(index: number) {
    setPlaces((current) => current.filter((_, placeIndex) => placeIndex !== index));
    setDetailPlaceIndex(null);
  }

  function movePlace(index: number, direction: -1 | 1) {
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

  function openPicker(index: number) {
    setDetailPlaceIndex(null);
    setPickerTarget(index);
    setPickerView('source');
    setPickerTab(myPlaces.length ? 'mine' : 'library');
    setPlaceQuery('');
  }

  function openCreatePlaceFromPicker() {
    storePlanDraft(places, advancedDetails, planEnd);
    setPendingCreatedPlaceIndex(typeof pickerTarget === 'number' ? pickerTarget : null);
    router.push('/places/new?returnTo=plan');
  }

  function openEditMyPlaceFromDetail(index: number) {
    const place = places[index];
    if (!place?.sourcePlaceId || place.sourcePlaceSource !== 'my_place') return;
    storePlanDraft(places, advancedDetails, planEnd);
    setPendingCreatedPlaceIndex(index);
    setDetailPlaceIndex(null);
    router.push(`/places/${encodeURIComponent(place.sourcePlaceId)}/edit?returnTo=plan`);
  }

  function openCopyLibraryPlaceFromDetail(index: number) {
    const place = places[index];
    if (!place?.sourcePlaceId || place.sourcePlaceSource !== 'hellowhen_library') return;
    storePlanDraft(places, advancedDetails, planEnd);
    setPendingCreatedPlaceIndex(index);
    setDetailPlaceIndex(null);
    router.push(`/places/new?returnTo=plan&copyFromPlaceId=${encodeURIComponent(place.sourcePlaceId)}`);
  }

  function chooseReusablePlace(place: PlaceDto) {
    if (pickerTarget === null) return;
    if (pickerTarget === 'new') {
      setPlaces((current) => {
        const previous = current[current.length - 1];
        return [
          ...current,
          {
            ...makePlace(current.length, previous?.date || toDateInputValue()),
            ...applyReusablePlacePatch(place),
          },
        ];
      });
    } else {
      updatePlace(pickerTarget, applyReusablePlacePatch(place));
    }
    closePlacePicker();
    setMessage(`Added ${place.title} from ${placeSourceLabel(place)}.`);
  }

  function updateAdvancedDetails(update: Partial<AdvancedPlanDetailsState>) {
    setAdvancedDetails((current) => ({ ...current, ...update }));
  }

  function updatePlanEnd(update: Partial<PlanEndState>) {
    setPlanEnd((current) => ({ ...current, ...update }));
    setError('');
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
    setAddressGuidanceNotice(PLAN_OFFLINE_ADDRESS_TOP_ERROR);
    return true;
  }

  function showPreviewStage() {
    setError('');
    if (places.length === 0) { setError('Add at least one place before preview.'); return; }
    if (schedule.error) { setError(schedule.error); return; }
    if (explicitPlanEnd.error) { setError(explicitPlanEnd.error); return; }
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
      setMessage('Place image uploaded.');
    } catch (uploadError) {
      setError(getFriendlyApiErrorMessage(uploadError, 'Could not upload place image.'));
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
      if (place.mode === 'remote') {
        const destinationError = onlineDestinationError({ onlineUrl: place.onlineUrl });
        if (destinationError) return `Place ${index + 1}: ${destinationError}`;
      } else {
        const addressError = offlineProviderAddressError(place.providerAddress);
        if (addressError) return `Place ${index + 1}: select a confirmed address suggestion before creating this offline stop.`;
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
      router.push('/auth?next=/plans/new');
      return;
    }
    const usablePlaces = places.filter((place) => place.title.trim() || place.sourcePlaceId);
    const nextSchedule = buildPlanSchedule(usablePlaces);
    const customTitle = advancedDetails.title.trim();
    const customDescription = advancedDetails.description.trim();
    const customCategory = advancedDetails.category.trim();
    const customTags = parsePlanTagsInput(advancedDetails.tags);
    const nextExplicitEnd = parsePlanEndOverride(planEnd, nextSchedule.startsAt);
    if (nextSchedule.error || !nextSchedule.startsAt || usablePlaces.length === 0) {
      setError(nextSchedule.error || 'Add at least one place with a valid date and time.');
      return;
    }
    if (nextExplicitEnd.error) {
      setError(nextExplicitEnd.error);
      return;
    }
    if (customTitle && customTitle.length < 3) {
      setError('Custom Plan title must be at least 3 characters.');
      return;
    }
    if (customDescription && customDescription.length < 10) {
      setError('Custom Plan description must be at least 10 characters, or leave it empty.');
      return;
    }
    if (customTags.length > 8 || customTags.some((tag) => tag.length > 32)) {
      setError('Use up to 8 tags, each 32 characters or less.');
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
      const response = await api.plans.create({
        title: customTitle || generatedPlanPayload.title,
        description: customDescription || generatedPlanPayload.description,
        category: customCategory || undefined,
        tags: customTags.length ? customTags : undefined,
        mode: planModeFromPlaces(usablePlaces),
        startsAt: nextSchedule.startsAt,
        endsAt: nextExplicitEnd.endsAt || nextSchedule.endsAt,
        joinApprovalMode: 'automatic',
        status: 'open',
        places: usablePlaces.map((place, index) => {
          const providerAddressPayload = place.mode === 'local' ? providerAddressPayloadFromFormState(place.providerAddress) : null;
          return {
            placeId: place.sourcePlaceId,
            mode: place.mode,
            title: place.title,
            addressPublicText: place.mode === 'local' ? providerAddressPayload?.formattedAddress : undefined,
            googlePlaceId: providerAddressPayload?.googlePlaceId,
            googlePlaceName: providerAddressPayload?.googlePlaceName,
            formattedAddress: providerAddressPayload?.formattedAddress,
            googleMapsUri: providerAddressPayload?.googleMapsUri,
            latitude: providerAddressPayload?.latitude,
            longitude: providerAddressPayload?.longitude,
            locationSource: providerAddressPayload?.locationSource,
            addressValidationStatus: providerAddressPayload?.addressValidationStatus,
            onlineLabel: place.mode === 'remote' ? place.onlineLabel.trim() || undefined : undefined,
            onlineUrl: place.mode === 'remote' ? place.onlineUrl.trim() || undefined : undefined,
            startsAt: nextSchedule.placeStartsAt[index],
            endsAt: nextSchedule.placeEndsAt[index],
            order: index,
            mediaIds: selectedPlanPlaceMediaIds(place),
          };
        }),
      });
      const nextPlanId = response.plan.id;
      setCreatedPlanId(nextPlanId);
      clearPlanDraft();
      setMessage('Plan created. Opening the detail page...');
      router.replace(`/plans/${encodeURIComponent(nextPlanId)}`);
    } catch (saveError) {
      creatingPlanRef.current = false;
      setError(getFriendlyApiErrorMessage(saveError, 'Could not create Plan.'));
      setSaving(false);
    }
  }

  const pickerIsOpen = pickerTarget !== null;
  const pickerTitle = pickerTarget === 'new' ? 'Add place' : `Place ${typeof pickerTarget === 'number' ? pickerTarget + 1 : ''}`;
  const detailPlace = detailPlaceIndex !== null ? places[detailPlaceIndex] : null;

  return (
    <PlansFeatureGate plansEnabled={plansEnabled}>
      <main className="mobile-page plans-page web-app-page web-app-page--create web-app-page--plans app-create-shell app-create-shell--plan">
        <header className="app-create-header">
          <div className="app-create-header__title-row">
            <Link className="web-back-button app-create-back" href="/plans" aria-label="Back to Plans"><WebIcon name="back" size={18} decorative /></Link>
            <div className="app-create-header__copy">
              <div className="app-create-header__eyebrow">
                <PlansInternalBadge plansVisible={plansVisible} />
              </div>
              <h1>Create Plan</h1>
              <p>Build a simple plan from places, dates, and times.</p>
            </div>
          </div>
          <div className="app-create-progress" aria-label={stage === 'build' ? 'Step 1 of 2' : 'Step 2 of 2'}>
            <div className="app-create-progress__label-row">
              <span>{stage === 'build' ? 'Step 1 of 2' : 'Step 2 of 2'}</span>
            </div>
            <div className="app-create-progress__track" aria-hidden="true">
              <span className="app-create-progress__fill" style={{ width: stage === 'build' ? '50%' : '100%' }} />
            </div>
          </div>
        </header>

        {!auth.hydrated ? <section className="mobile-card"><p className="meta">Checking session...</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <h3>Log in required</h3>
            <p>Use a demo or internal account to create hidden Plans.</p>
            <button type="button" className="button primary" onClick={() => router.push('/auth?next=/plans/new')}>Log in</button>
          </section>
        ) : null}

        {auth.isAuthenticated ? (
          <form className="plan-form plan-form--timeline plan-form--clean" onSubmit={submit}>
            <div className="plan-stage-tabs" aria-label="Create Plan stages">
              <button type="button" className={stage === 'build' ? 'is-active' : ''} onClick={() => setStage('build')}>Build</button>
              <button type="button" className={stage === 'preview' ? 'is-active' : ''} onClick={showPreviewStage}>Preview</button>
            </div>

            {stage === 'build' ? (
              <>
                {addressGuidanceNotice ? <p className="form-error">{addressGuidanceNotice}</p> : null}
                <section className="plan-build-timeline" aria-label="Build Plan timeline">
                  {places.map((place, index) => (
                    <div className="plan-place-time-group" key={place.id}>
                      <div className="plan-timeline-row plan-timeline-row--time plan-timeline-row--place-time">
                        <div className="plan-timeline-row__main">
                          <span className="semantic-badge time">Date / time</span>
                          <h3>Place {index + 1}</h3>
                        </div>
                        <div className="plan-timeline-row__fields">
                          <label>
                            <span>Date</span>
                            <input type="date" value={place.date} onChange={(event) => updatePlace(index, { date: event.target.value })} required />
                          </label>
                          <label>
                            <span>Time</span>
                            <input type="time" value={place.time} onChange={(event) => updatePlace(index, { time: event.target.value })} required />
                          </label>
                        </div>
                      </div>

                      <div className="plan-timeline-row plan-timeline-row--place">
                        <PlanPlaceTimelineButton place={place} index={index} onOpen={() => setDetailPlaceIndex(index)} />
                        <div className="plan-timeline-row__actions">
                          <button type="button" className="button secondary" onClick={() => setDetailPlaceIndex(index)}>Details</button>
                        </div>
                      </div>

                      {expandedAddressPlaceIds.includes(place.id) && place.mode === 'local' ? (
                        <div
                          className="plan-starter-address-guidance"
                          ref={addressFocusPlaceId === place.id ? firstMissingOfflinePlaceRef : undefined}
                          tabIndex={-1}
                        >
                          <div className="plan-starter-address-guidance__copy">
                            <span className="semantic-badge place">Address needed</span>
                            <p className="form-error">{PLAN_OFFLINE_ADDRESS_INLINE_ERROR}</p>
                          </div>
                          <GooglePlacePicker
                            value={place.location}
                            onValueChange={(location) => updatePlaceManualLocation(index, location)}
                            onResolvedPlace={(resolvedPlace) => updatePlaceResolvedAddress(index, resolvedPlace)}
                            disabled={saving || place.uploading}
                            label={`Verified address for Place ${index + 1}`}
                            placeholder="Café, park, address, station..."
                            helperText="Type at least 3 characters, then select a provider suggestion. Starter offline stops cannot use placeholder addresses."
                            autoFocus={addressFocusPlaceId === place.id}
                          />
                          <div className="plan-starter-address-guidance__actions">
                            <button type="button" className="button secondary" onClick={() => removePlace(index)}>Delete this place</button>
                            <button type="button" className="button secondary" onClick={() => setDetailPlaceIndex(index)}>Open details</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}

                  <div className="plan-timeline-row plan-timeline-row--add">
                    <button type="button" className={`plan-add-place-row ${places.length === 0 ? 'plan-add-place-row--first' : ''}`} onClick={addPlaceAndOpenPicker}>
                      <span>+ Add place</span>
                      <small>{places.length === 0 ? 'Choose the first stop' : 'Choose the next stop'}</small>
                    </button>
                  </div>

                  {places.length > 0 ? (
                    <div className="plan-timeline-row plan-timeline-row--time plan-timeline-row--optional-end">
                      <div className="plan-timeline-row__main">
                        <span className="semantic-badge time">Optional</span>
                        <h3>Plan end time</h3>
                        <p className="meta">Leave empty to use the estimated end from your place times.</p>
                      </div>
                      <div className="plan-timeline-row__fields">
                        <label>
                          <span>End date</span>
                          <input type="date" value={planEnd.date} onChange={(event) => updatePlanEnd({ date: event.target.value })} />
                        </label>
                        <label>
                          <span>End time</span>
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
                          {endSummary.manual ? <button type="button" className="button secondary" onClick={() => updatePlanEnd(EMPTY_PLAN_END_STATE)}>Use estimate</button> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                {error ? <p className="form-error">{error}</p> : null}
                {places.length > 0 ? <button className="button primary full" type="button" onClick={showPreviewStage} disabled={places.some((place) => place.uploading)}>Preview Plan</button> : null}
              </>
            ) : (
              <>
                <section className="plan-form__preview plan-preview-stage">
                  <div className="plan-preview-confirm-hero plan-preview-confirm-hero--simple">
                    <div className="plan-preview-confirm-hero__copy">
                      <span className="semantic-badge plan">Preview</span>
                      <h3>{previewTitle}</h3>
                      <p>{previewDescription}</p>
                    </div>
                    <div className="plan-preview-inline-meta" aria-label="Plan confirmation summary">
                      <span>{schedule.startsAt ? new Date(schedule.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Start not set'}</span>
                      {endSummary ? <span>{endSummary.label}: {endSummary.endLabel}</span> : null}
                      <span>{places.length} {places.length === 1 ? 'place' : 'places'}</span>
                      <span>Free join</span>
                      <span>Open</span>
                    </div>
                  </div>

                  <div className="plan-preview-deck-section">
                    <div className="plan-preview-section-heading">
                      <span className="semantic-badge plan">Feed preview</span>
                    </div>
                    <div className="trade-create-preview__deck">
                      <PlanPreviewDeck
                        title={previewTitle}
                        description={previewDescription}
                        rangeLabel={rangeLabel}
                        places={places.map((place, index) => ({ id: place.id, mode: place.mode, title: planPreviewPlaceTitle(place, index), location: placePreviewLocation(place), date: place.date, time: place.time, media: place.media ?? place.existingMedia, staticMap: place.existingStaticMap }))}
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

                  <div className="plan-preview-itinerary" aria-label="Plan itinerary confirmation">
                    <div className="plan-preview-section-heading">
                      <span className="semantic-badge place">Route</span>
                    </div>
                    {places.map((place, index) => (
                      <div className="plan-preview-itinerary-row" key={`confirm-${place.id}`}>
                        <span className="plan-preview-itinerary-row__number">{index + 1}</span>
                        <div>
                          <strong>{planPreviewPlaceTitle(place, index)}</strong>
                          <small>{planPreviewTimeLabel(place)}{placePreviewLocation(place) ? ` · ${placePreviewLocation(place)}` : ''}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                {message ? <p className="success-message">{message}</p> : null}
                {validationNotice ? <p className="form-error">{validationNotice}</p> : null}
                <div className="plan-preview-actions">
                  <button type="button" className="button secondary" disabled={saving || Boolean(createdPlanId)} onClick={() => setStage('build')}>Back</button>
                  {createdPlanId ? (
                    <Link className="button primary" href={`/plans/${encodeURIComponent(createdPlanId)}`}>Open created Plan</Link>
                  ) : (
                    <button className="button primary" type="submit" disabled={saving || places.some((place) => place.uploading)}>{saving ? 'Creating Plan...' : 'Create Plan'}</button>
                  )}
                </div>
              </>
            )}
          </form>
        ) : null}

        {detailPlace && detailPlaceIndex !== null ? (
          <div className="plan-place-source-overlay" role="presentation">
            <button type="button" className="plan-place-source-backdrop" aria-label="Close place details" onClick={() => setDetailPlaceIndex(null)} />
            <section className="plan-place-source-sheet plan-place-detail-sheet" role="dialog" aria-modal="true" aria-label={`Place ${detailPlaceIndex + 1} details`}>
              <div className="plan-detail-topbar">
                <div>
                  <h3>Place {detailPlaceIndex + 1}</h3>
                </div>
                <button type="button" className="plans-feed-icon-button" onClick={() => setDetailPlaceIndex(null)} aria-label="Close Place details">×</button>
              </div>
              <div className="plan-place-picker-panel">
                <div className="plan-timeline-row__heading">
                  {detailPlace.sourcePlaceId ? <span className="semantic-badge place">{detailPlace.sourcePlaceSource === 'hellowhen_library' ? 'Library' : 'My Place'}</span> : <span className="semantic-badge place">Custom</span>}
                </div>
                {!detailPlace.sourcePlaceId ? (
                  <>
                    <PlaceModeSegment value={detailPlace.mode} onChange={(mode) => updateCustomPlaceMode(detailPlaceIndex, mode)} />
                    <label>
                      <span>Place name</span>
                      <input value={detailPlace.title} onChange={(event) => updatePlace(detailPlaceIndex, { title: event.target.value })} minLength={3} maxLength={120} required placeholder={detailPlace.mode === 'remote' ? 'Planning call' : 'Coffee meeting point'} />
                    </label>
                    {detailPlace.mode === 'remote' ? (
                      <div className="plan-form__row">
                        <label>
                          <span>Online label</span>
                          <input value={detailPlace.onlineLabel} onChange={(event) => updatePlace(detailPlaceIndex, { onlineLabel: event.target.value })} maxLength={120} placeholder="Zoom, Discord, website" />
                        </label>
                        <label>
                          <span>Online URL</span>
                          <input type="url" value={detailPlace.onlineUrl} onChange={(event) => updatePlace(detailPlaceIndex, { onlineUrl: event.target.value })} maxLength={500} placeholder="https://..." />
                          <small>{onlineProviderHint({ onlineUrl: detailPlace.onlineUrl })}</small>
                        </label>
                      </div>
                    ) : (
                      <>
                        <GooglePlacePicker
                          value={detailPlace.location}
                          onValueChange={(location) => updatePlaceManualLocation(detailPlaceIndex, location)}
                          onResolvedPlace={(place) => updatePlaceResolvedAddress(detailPlaceIndex, place)}
                          disabled={saving || detailPlace.uploading}
                          label="Search and select address or place"
                          placeholder="Café, park, address, station..."
                          helperText="Type at least 3 characters, then select a provider suggestion. Typed text alone cannot be saved as an offline Plan stop."
                        />
                        {detailPlace.location.trim() && !providerAddressStatusLabel(detailPlace.providerAddress) ? <p className="form-error">Select a confirmed address suggestion before publishing.</p> : null}
                      </>
                    )}
                  </>
                ) : (
                  <div className="plan-source-place-strip">
                    <strong>{detailPlace.sourcePlaceTitle || detailPlace.title}</strong>
                    <span>{detailPlace.sourcePlaceSource === 'my_place' ? 'Updates your saved Place.' : 'Copied into My Places before editing.'}</span>
                    <div className="cta-row">
                      {detailPlace.sourcePlaceSource === 'my_place' ? (
                        <button type="button" className="button secondary" onClick={() => openEditMyPlaceFromDetail(detailPlaceIndex)}>Edit saved</button>
                      ) : null}
                      {detailPlace.sourcePlaceSource === 'hellowhen_library' ? (
                        <button type="button" className="button secondary" onClick={() => openCopyLibraryPlaceFromDetail(detailPlaceIndex)}>Copy to edit</button>
                      ) : null}
                      <button type="button" className="button secondary" onClick={() => updatePlace(detailPlaceIndex, resetToCustomPatch())}>Make custom</button>
                    </div>
                  </div>
                )}
                <PlaceImagePicker
                  place={detailPlace}
                  onUpload={(event) => { const files = event.target.files; event.currentTarget.value = ''; void uploadPlaceImage(detailPlaceIndex, files); }}
                  onRemove={() => updatePlace(detailPlaceIndex, { media: null })}
                />
                <div className="plan-place-detail-actions">
                  <button type="button" className="button secondary" disabled={detailPlaceIndex === 0} onClick={() => { movePlace(detailPlaceIndex, -1); setDetailPlaceIndex(detailPlaceIndex - 1); }}>Move up</button>
                  <button type="button" className="button secondary" disabled={detailPlaceIndex === places.length - 1} onClick={() => { movePlace(detailPlaceIndex, 1); setDetailPlaceIndex(detailPlaceIndex + 1); }}>Move down</button>
                  <button type="button" className="button secondary" onClick={() => openPicker(detailPlaceIndex)}>Change place</button>
                  <button type="button" className="button secondary" onClick={() => removePlace(detailPlaceIndex)}>Remove</button>
                  <button type="button" className="button primary" onClick={() => setDetailPlaceIndex(null)}>Done</button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {pickerIsOpen ? (
          <div className="plan-place-source-overlay" role="presentation">
            <button type="button" className="plan-place-source-backdrop" aria-label="Close place source" onClick={closePlacePicker} />
            <section className="plan-place-source-sheet plan-place-source-sheet--compact" role="dialog" aria-modal="true" aria-label={pickerTitle}>
              <div className="plan-detail-topbar">
                <div>
                  <h3>{pickerView === 'source' ? 'Add place' : pickerTab === 'mine' ? 'My Places' : 'Hellowhen Library'}</h3>
                </div>
                <button type="button" className="plans-feed-icon-button" onClick={closePlacePicker} aria-label="Close Place picker">×</button>
              </div>

              {pickerView === 'source' ? (
                <div className="plan-place-source-grid">
                  <button type="button" className="plan-place-source-option plan-place-source-option--primary" onClick={() => openPickerList('mine')}>
                    <span className="plan-place-source-option__icon"><WebIcon name="location-on" size={16} decorative /></span>
                    <span><strong>My Places</strong></span>
                  </button>
                  <button type="button" className="plan-place-source-option" onClick={() => openPickerList('library')}>
                    <span className="plan-place-source-option__icon">✦</span>
                    <span><strong>Hellowhen Library</strong></span>
                  </button>
                  <button type="button" className="plan-place-source-option" onClick={openCreatePlaceFromPicker}>
                    <span className="plan-place-source-option__icon"><WebIcon name="location-on" size={16} decorative /></span>
                    <span><strong>New Place</strong></span>
                  </button>
                  <button type="button" className="plan-place-source-option" onClick={useCustomPlaceFromPicker}>
                    <span className="plan-place-source-option__icon">•••</span>
                    <span><strong>Custom stop</strong></span>
                  </button>
                </div>
              ) : (
                <div className="plan-place-picker-panel">
                  <div className="plan-place-picker-toolbar">
                    <div className="plans-tabs" role="tablist" aria-label="Place Library source">
                      <button type="button" className={pickerTab === 'mine' ? 'is-active' : ''} onClick={() => openPickerList('mine')}>My Places</button>
                      <button type="button" className={pickerTab === 'library' ? 'is-active' : ''} onClick={() => openPickerList('library')}>Hellowhen Library</button>
                    </div>
                    <button type="button" className="button secondary plan-place-picker-refresh" onClick={loadReusablePlaces}>Refresh</button>
                  </div>
                  <label>
                    <span>Search Places</span>
                    <input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="Search Places" />
                  </label>
                  {pickerTab === 'mine' ? (
                    <PlacePickerList places={filteredMyPlaces} emptyLabel="No matching My Places yet." onChoose={chooseReusablePlace} />
                  ) : (
                    <PlacePickerList places={filteredLibraryPlaces} emptyLabel="No matching Hellowhen Library Places yet." onChoose={chooseReusablePlace} />
                  )}
                  <div className="plan-place-picker-actions">
                    <button type="button" className="button secondary" onClick={() => setPickerView('source')}>Sources</button>
                    <button type="button" className="button secondary" onClick={openCreatePlaceFromPicker}>New Place</button>
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
