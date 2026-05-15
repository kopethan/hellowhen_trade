import type { PlanDto, PlanParticipantStatus } from '@hellowhen/contracts';
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
  if (mode === 'local') return 'In person';
  return mode.replace(/_/g, ' ');
}

export function planDateTime(value?: string | null) {
  return formatWebDateTime(value, 'No time set');
}

export function planMetadata(plan: PlanDto) {
  return [planDateTime(plan.startsAt), plan.locationLabel, planModeLabel(plan.mode), plan.category]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' · ');
}

export function planMediaSrc(media?: { url?: string | null; storageKey?: string | null } | null) {
  return resolveWebAssetUrl(media?.url, media?.storageKey);
}
