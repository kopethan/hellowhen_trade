import type { MediaAssetDto, PlanDto, PlanParticipantStatus } from '@hellowhen/contracts';
import { resolveWebAssetUrl } from '../../lib/api';
import { formatWebDateTime } from '../../lib/webFormat';

export function planOwnerName(plan: PlanDto) {
  return plan.owner?.profile?.displayName || plan.owner?.profile?.handle || 'Hellowhen user';
}

export function planStatusLabel(status?: string | null) {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ');
}

export function planParticipantStatusLabel(status?: PlanParticipantStatus | null) {
  if (!status) return 'Not joined';
  return status.replace(/_/g, ' ');
}

export function planModeLabel(mode?: string | null) {
  if (!mode) return '';
  if (mode === 'local') return 'Local';
  if (mode === 'remote') return 'Remote';
  if (mode === 'hybrid') return 'Mixed';
  return mode.replace(/_/g, ' ');
}

export function planPlaceModeLabel(mode?: string | null) {
  return mode === 'remote' ? 'Remote' : 'Local';
}

export function planDateTime(value?: string | null) {
  return formatWebDateTime(value, 'No time set');
}

export function planRangeLabel(plan: PlanDto) {
  const start = planDateTime(plan.startsAt);
  const end = plan.endsAt ? planDateTime(plan.endsAt) : '';
  return end && end !== start ? `${start} → ${end}` : start;
}

export function planMetadata(plan: PlanDto) {
  return [planRangeLabel(plan), plan.category]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' · ');
}

export function planMediaSrc(media?: MediaAssetDto | null, preferredVariant: 'thumb' | 'card' | 'full' = 'full') {
  if (!media) return '';
  const variant = media.variants?.[preferredVariant] ?? (preferredVariant !== 'full' ? media.variants?.full : undefined);
  if (variant) return resolveWebAssetUrl(variant.url, variant.storageKey);
  return resolveWebAssetUrl(media.url, media.storageKey);
}
