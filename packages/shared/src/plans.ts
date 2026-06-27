export type GeneratedPlanMode = 'local' | 'remote' | 'hybrid' | string;

export type GeneratedPlanPlaceInput = {
  title?: string | null;
  sourcePlaceTitle?: string | null;
  mode?: GeneratedPlanMode | null;
};

export type GeneratedPlanDisplayLabels = {
  newPlan: string;
  planFor: string;
  placeFallback: string;
  place: string;
  places: string;
  starts: string;
  localPlan: string;
  remotePlan: string;
  mixedPlan: string;
  freeJoin: string;
  placeFirstPlan: string;
};

export type GeneratedPlanDisplayInput = {
  places?: readonly GeneratedPlanPlaceInput[] | null;
  startsAt?: string | null;
  mode?: GeneratedPlanMode | null;
  joinApprovalMode?: string | null;
  labels?: Partial<GeneratedPlanDisplayLabels>;
};

export type GeneratedPlanDisplay = {
  title: string;
  description: string;
  summaryParts: string[];
};

const defaultGeneratedPlanDisplayLabels: GeneratedPlanDisplayLabels = {
  newPlan: 'New plan',
  planFor: 'Plan for',
  placeFallback: 'Place',
  place: 'place',
  places: 'places',
  starts: 'Starts',
  localPlan: 'Local plan',
  remotePlan: 'Online plan',
  mixedPlan: 'Mixed plan',
  freeJoin: 'Free join',
  placeFirstPlan: 'Place-first Plan',
};

function labelsFor(labels?: Partial<GeneratedPlanDisplayLabels>) {
  return { ...defaultGeneratedPlanDisplayLabels, ...labels };
}

function cleanText(value?: string | null) {
  return String(value ?? '').trim();
}

function truncateGeneratedPlanText(value: string, maxLength: number) {
  const normalized = cleanText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function safeDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatGeneratedPlanDate(value?: string | null) {
  const date = safeDate(value);
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

function formatGeneratedPlanDateTime(value?: string | null) {
  const date = safeDate(value);
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function generatedPlanPlaceTitle(place: GeneratedPlanPlaceInput | null | undefined, index: number, labels: GeneratedPlanDisplayLabels) {
  return cleanText(place?.title) || cleanText(place?.sourcePlaceTitle) || `${labels.placeFallback} ${index + 1}`;
}

function inferGeneratedPlanMode(places: readonly GeneratedPlanPlaceInput[]) {
  const modes = new Set(places.map((place) => cleanText(place.mode)).filter(Boolean));
  if (modes.size > 1) return 'hybrid';
  if (modes.has('remote')) return 'remote';
  return 'local';
}

function generatedPlanModeLabel(mode: GeneratedPlanMode | null | undefined, labels: GeneratedPlanDisplayLabels) {
  if (mode === 'remote') return labels.remotePlan;
  if (mode === 'hybrid') return labels.mixedPlan;
  return labels.localPlan;
}

export function buildGeneratedPlanTitle(input: GeneratedPlanDisplayInput) {
  const labels = labelsFor(input.labels);
  const places = input.places ?? [];
  const names = places.map((place, index) => generatedPlanPlaceTitle(place, index, labels)).filter(Boolean);
  const firstName = names[0] ?? labels.newPlan;
  const secondName = names[1] ?? `${labels.placeFallback} 2`;

  if (names.length === 1) return truncateGeneratedPlanText(firstName, 120);
  if (names.length === 2) return truncateGeneratedPlanText(`${firstName} → ${secondName}`, 120);
  if (names.length > 2) return truncateGeneratedPlanText(`${firstName} + ${names.length - 1} ${labels.places}`, 120);

  const dateLabel = formatGeneratedPlanDate(input.startsAt);
  if (dateLabel) return truncateGeneratedPlanText(`${labels.planFor} ${dateLabel}`, 120);
  return labels.newPlan;
}

export function buildGeneratedPlanSummaryParts(input: GeneratedPlanDisplayInput) {
  const labels = labelsFor(input.labels);
  const places = input.places ?? [];
  const mode = input.mode ?? inferGeneratedPlanMode(places);
  const startsAtLabel = formatGeneratedPlanDateTime(input.startsAt);
  const placeCount = places.length;
  const parts = [
    placeCount > 0 ? `${placeCount} ${placeCount === 1 ? labels.place : labels.places}` : labels.placeFirstPlan,
    startsAtLabel ? `${labels.starts} ${startsAtLabel}` : null,
    generatedPlanModeLabel(mode, labels),
    input.joinApprovalMode === 'owner_approval' ? null : labels.freeJoin,
  ];
  return parts.filter((part): part is string => Boolean(part));
}

export function buildGeneratedPlanDescription(input: GeneratedPlanDisplayInput) {
  return truncateGeneratedPlanText(buildGeneratedPlanSummaryParts(input).join(' · '), 2000);
}

export function buildGeneratedPlanDisplay(input: GeneratedPlanDisplayInput): GeneratedPlanDisplay {
  const summaryParts = buildGeneratedPlanSummaryParts(input);
  return {
    title: buildGeneratedPlanTitle(input),
    description: truncateGeneratedPlanText(summaryParts.join(' · '), 2000),
    summaryParts,
  };
}
