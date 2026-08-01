export type ReusablePlaceReference = {
  source?: string | null;
  ownerId?: string | null;
  visibility?: string | null;
};

export type PlanPlaceSourceReference = {
  placeId?: string | null;
  sourcePlace?: ReusablePlaceReference | null;
};

export type PlaceUsageTarget = ReusablePlaceReference & {
  id: string;
};

export type PlanPlaceUsageRow = {
  placeId?: string | null;
  planId: string;
  plan: {
    ownerId: string;
    deletedAt?: Date | string | null;
  };
};

export function canUseReusablePlaceInPlan(place: ReusablePlaceReference | null | undefined, planOwnerId: string) {
  if (!place) return false;
  if (place.source === 'hellowhen_library') return place.visibility === 'library';
  return place.source === 'user' && place.ownerId === planOwnerId;
}

export function planPlaceSourceForOwner(place: PlanPlaceSourceReference | null | undefined, planOwnerId: string) {
  if (!place?.placeId || !place.sourcePlace) return 'custom' as const;
  if (place.sourcePlace.source === 'hellowhen_library' && place.sourcePlace.visibility === 'library') {
    return 'hellowhen_library' as const;
  }
  if (place.sourcePlace.source === 'user' && place.sourcePlace.ownerId === planOwnerId) {
    return 'my_place' as const;
  }
  return 'custom' as const;
}

export function countOwnedPlanUsageByPlace(targets: PlaceUsageTarget[], rows: PlanPlaceUsageRow[]) {
  const targetsById = new Map(targets.map((target) => [target.id, target]));
  const planIdsByPlace = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.placeId || row.plan.deletedAt) continue;
    const target = targetsById.get(row.placeId);
    if (!target) continue;

    const isLibraryPlace = target.source === 'hellowhen_library';
    if (!isLibraryPlace && (!target.ownerId || row.plan.ownerId !== target.ownerId)) continue;

    const planIds = planIdsByPlace.get(row.placeId) ?? new Set<string>();
    planIds.add(row.planId);
    planIdsByPlace.set(row.placeId, planIds);
  }

  return new Map(targets.map((target) => [target.id, planIdsByPlace.get(target.id)?.size ?? 0]));
}
