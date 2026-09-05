import type { PlanDto } from '@hellowhen/contracts';
import { isPlanJoinClosed } from '@hellowhen/shared';
import type { SemanticColorName } from '@hellowhen/theme';

export type PlanPresentationState =
  | 'open'
  | 'full'
  | 'join_closed'
  | 'started'
  | 'completed'
  | 'cancelled'
  | 'draft'
  | 'expired'
  | 'hidden';

function timeValue(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function acceptedParticipantCount(plan: PlanDto) {
  return plan.participantCount ?? plan.participants?.filter((participant) => participant.status === 'accepted').length ?? 0;
}

export function getPlanPresentationState(plan: PlanDto, now: Date = new Date()): PlanPresentationState {
  if (plan.status === 'cancelled' || plan.status === 'draft' || plan.status === 'expired' || plan.status === 'hidden') {
    return plan.status;
  }
  if (plan.status === 'completed') return 'completed';

  const nowTime = now.getTime();
  const startsAt = timeValue(plan.startsAt);
  const endsAt = timeValue(plan.endsAt ?? plan.startsAt);
  if (Number.isFinite(nowTime) && endsAt !== null && nowTime >= endsAt) return 'completed';
  if (plan.status === 'started') return 'started';
  if (Number.isFinite(nowTime) && startsAt !== null && nowTime >= startsAt) return 'started';

  if (isPlanJoinClosed(plan, now)) return 'join_closed';

  const participantCount = acceptedParticipantCount(plan);
  if (plan.status === 'full' || (plan.maxParticipants && participantCount >= plan.maxParticipants)) return 'full';
  return 'open';
}

export function planPresentationLabelKey(state: PlanPresentationState) {
  return state === 'join_closed' ? 'plans.status.joinClosed' : `plans.status.${state}`;
}

export function getPlanPresentationTone(state: PlanPresentationState): SemanticColorName {
  if (state === 'open') return 'success';
  if (state === 'full') return 'warning';
  if (state === 'join_closed') return 'time';
  if (state === 'started') return 'plan';
  if (state === 'cancelled' || state === 'hidden') return 'danger';
  if (state === 'expired') return 'time';
  return 'muted';
}

export function isPlanDiscussionWritableStatus(status: PlanDto['status'] | null | undefined) {
  return status === 'open' || status === 'full' || status === 'started';
}
