import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  PlaceAddressValidationStatus,
  PlaceLocationSource,
  PlaceStatus,
  PlanPlaceMode,
  PrismaClient,
  type Prisma,
} from '@prisma/client';
import { getMissingOfflineProviderAddressFields, hasOnlineDestination } from '@hellowhen/shared';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
dotenv.config({ path: path.resolve(repoRoot, '.env') });

const prisma = new PrismaClient();

const SAMPLE_LIMIT = 20;

const invalidOfflinePlaceAddressClauses: Prisma.PlaceWhereInput[] = [
  { googlePlaceId: null },
  { googlePlaceId: '' },
  { formattedAddress: null },
  { formattedAddress: '' },
  { latitude: null },
  { longitude: null },
  { locationSource: null },
  { locationSource: { not: PlaceLocationSource.google_places } },
  { addressValidationStatus: null },
  { addressValidationStatus: { not: PlaceAddressValidationStatus.confirmed } },
];

const invalidOfflinePlanPlaceAddressClauses: Prisma.PlanPlaceWhereInput[] = [
  { googlePlaceId: null },
  { googlePlaceId: '' },
  { formattedAddress: null },
  { formattedAddress: '' },
  { latitude: null },
  { longitude: null },
  { locationSource: null },
  { locationSource: { not: PlaceLocationSource.google_places } },
  { addressValidationStatus: null },
  { addressValidationStatus: { not: PlaceAddressValidationStatus.confirmed } },
];

const invalidOfflinePlaceWhere: Prisma.PlaceWhereInput = {
  mode: PlanPlaceMode.local,
  OR: invalidOfflinePlaceAddressClauses,
};

const invalidOfflinePlanPlaceWhere: Prisma.PlanPlaceWhereInput = {
  mode: PlanPlaceMode.local,
  OR: invalidOfflinePlanPlaceAddressClauses,
};

const invalidPlaceSelect = {
  id: true,
  title: true,
  description: true,
  ownerId: true,
  source: true,
  status: true,
  visibility: true,
  mode: true,
  googlePlaceId: true,
  formattedAddress: true,
  latitude: true,
  longitude: true,
  locationSource: true,
  addressValidationStatus: true,
  onlineUrl: true,
  onlineLabel: true,
  defaultNote: true,
  defaultMeetingInstructions: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  owner: { select: { email: true } },
} satisfies Prisma.PlaceSelect;

const invalidPlanPlaceSelect = {
  id: true,
  planId: true,
  placeId: true,
  order: true,
  title: true,
  mode: true,
  googlePlaceId: true,
  formattedAddress: true,
  latitude: true,
  longitude: true,
  locationSource: true,
  addressValidationStatus: true,
  onlineUrl: true,
  onlineLabel: true,
  staticMapTemplateFamily: true,
  staticMapTemplateSeed: true,
  createdAt: true,
  updatedAt: true,
  plan: {
    select: {
      id: true,
      title: true,
      status: true,
      ownerId: true,
      owner: { select: { email: true } },
    },
  },
} satisfies Prisma.PlanPlaceSelect;

type Options = {
  dryRun: boolean;
  apply: boolean;
  convertOnlineWhenUrl: boolean;
  archivePlaces: boolean;
  markPlanStopsUnsupported: boolean;
  deleteTestOnly: boolean;
  json: boolean;
  limit?: number;
};

type PlaceCandidate = Prisma.PlaceGetPayload<{ select: typeof invalidPlaceSelect }>;
type PlanPlaceCandidate = Prisma.PlanPlaceGetPayload<{ select: typeof invalidPlanPlaceSelect }>;

type CleanupAction = 'convert_online' | 'archive' | 'mark_unsupported' | 'delete_test_only' | 'skip';

type CleanupRecord = {
  id: string;
  title: string;
  action: CleanupAction;
  reason: string;
};

function parseOptions(argv: string[]): Options {
  const flags = new Set<string>();
  let limit: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg || !arg.startsWith('--')) continue;

    if (arg.startsWith('--limit=')) {
      const raw = arg.slice('--limit='.length);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) limit = Math.trunc(parsed);
      continue;
    }

    if (arg === '--limit') {
      const raw = argv[index + 1];
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) limit = Math.trunc(parsed);
      index += 1;
      continue;
    }

    flags.add(arg);
  }

  const apply = flags.has('--apply');
  const dryRun = flags.has('--dry-run') || !apply;

  return {
    dryRun,
    apply,
    convertOnlineWhenUrl: flags.has('--convert-online-when-url'),
    archivePlaces: flags.has('--archive-places'),
    markPlanStopsUnsupported: flags.has('--mark-plan-stops-unsupported'),
    deleteTestOnly: flags.has('--delete-test-only'),
    json: flags.has('--json'),
    limit,
  };
}

function hasMutationAction(options: Options) {
  return options.convertOnlineWhenUrl || options.archivePlaces || options.markPlanStopsUnsupported || options.deleteTestOnly;
}

function hasUsableOnlineUrl(value: string | null | undefined): boolean {
  if (!hasOnlineDestination({ onlineUrl: value })) return false;
  try {
    const parsed = new URL(value ?? '');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function getOfflineMissingFields(candidate: {
  googlePlaceId: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: string | null;
  addressValidationStatus: string | null;
}) {
  return getMissingOfflineProviderAddressFields(candidate).join(', ') || 'unknown';
}

function isProbablyTestPlace(place: PlaceCandidate): boolean {
  const text = [
    place.title,
    place.description,
    place.defaultNote,
    place.defaultMeetingInstructions,
    place.owner?.email,
  ]
    .filter(Boolean)
    .join(' ');

  return /\b(smoke|test|tests|seed|demo|fixture|dev-only|dev only)\b/i.test(text);
}

function countBy<T>(items: readonly T[], getKey: (item: T) => string | null | undefined) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = getKey(item) || 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function loadInvalidPlaces(limit?: number): Promise<PlaceCandidate[]> {
  return prisma.place.findMany({
    where: invalidOfflinePlaceWhere,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: invalidPlaceSelect,
  });
}

async function loadInvalidPlanPlaces(limit?: number): Promise<PlanPlaceCandidate[]> {
  return prisma.planPlace.findMany({
    where: invalidOfflinePlanPlaceWhere,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: invalidPlanPlaceSelect,
  });
}
function samplePlaces(places: readonly PlaceCandidate[]) {
  return places.slice(0, SAMPLE_LIMIT).map((place) => ({
    id: place.id,
    title: place.title,
    source: place.source,
    status: place.status,
    ownerEmail: place.owner?.email ?? null,
    onlineUrl: place.onlineUrl ?? null,
    missing: getOfflineMissingFields(place),
  }));
}

function samplePlanPlaces(planPlaces: readonly PlanPlaceCandidate[]) {
  return planPlaces.slice(0, SAMPLE_LIMIT).map((planPlace) => ({
    id: planPlace.id,
    title: planPlace.title,
    planId: planPlace.planId,
    planTitle: planPlace.plan.title,
    planStatus: planPlace.plan.status,
    ownerEmail: planPlace.plan.owner?.email ?? null,
    onlineUrl: planPlace.onlineUrl ?? null,
    missing: getOfflineMissingFields(planPlace),
  }));
}

async function cleanupPlaces(places: readonly PlaceCandidate[], options: Options) {
  const records: CleanupRecord[] = [];
  const now = new Date();

  for (const place of places) {
    const reason = `missing ${getOfflineMissingFields(place)}`;

    if (options.convertOnlineWhenUrl && hasUsableOnlineUrl(place.onlineUrl)) {
      records.push({ id: place.id, title: place.title, action: 'convert_online', reason });
      if (!options.dryRun) {
        await prisma.place.update({
          where: { id: place.id },
          data: {
            mode: PlanPlaceMode.remote,
            locationSource: null,
            addressValidationStatus: PlaceAddressValidationStatus.unsupported,
            staticMapTemplateFamily: null,
            staticMapTemplateSeed: null,
          },
        });
      }
      continue;
    }

    if (options.deleteTestOnly && isProbablyTestPlace(place)) {
      records.push({ id: place.id, title: place.title, action: 'delete_test_only', reason });
      if (!options.dryRun) {
        await prisma.place.delete({ where: { id: place.id } });
      }
      continue;
    }

    if (options.archivePlaces && place.status !== PlaceStatus.archived) {
      records.push({ id: place.id, title: place.title, action: 'archive', reason });
      if (!options.dryRun) {
        await prisma.place.update({
          where: { id: place.id },
          data: { status: PlaceStatus.archived, archivedAt: place.archivedAt ?? now },
        });
      }
      continue;
    }

    records.push({ id: place.id, title: place.title, action: 'skip', reason });
  }

  return records;
}

async function cleanupPlanPlaces(planPlaces: readonly PlanPlaceCandidate[], options: Options) {
  const records: CleanupRecord[] = [];

  for (const planPlace of planPlaces) {
    const reason = `missing ${getOfflineMissingFields(planPlace)}`;

    if (options.convertOnlineWhenUrl && hasUsableOnlineUrl(planPlace.onlineUrl)) {
      records.push({ id: planPlace.id, title: planPlace.title, action: 'convert_online', reason });
      if (!options.dryRun) {
        await prisma.planPlace.update({
          where: { id: planPlace.id },
          data: {
            mode: PlanPlaceMode.remote,
            locationSource: null,
            addressValidationStatus: PlaceAddressValidationStatus.unsupported,
            staticMapTemplateFamily: null,
            staticMapTemplateSeed: null,
          },
        });
      }
      continue;
    }

    if (options.markPlanStopsUnsupported) {
      records.push({ id: planPlace.id, title: planPlace.title, action: 'mark_unsupported', reason });
      if (!options.dryRun) {
        await prisma.planPlace.update({
          where: { id: planPlace.id },
          data: {
            addressValidationStatus: PlaceAddressValidationStatus.unsupported,
            staticMapTemplateFamily: null,
            staticMapTemplateSeed: null,
          },
        });
      }
      continue;
    }

    records.push({ id: planPlace.id, title: planPlace.title, action: 'skip', reason });
  }

  return records;
}

function actionCounts(records: readonly CleanupRecord[]) {
  return countBy(records, (record) => record.action);
}

function printTextReport(input: {
  options: Options;
  places: readonly PlaceCandidate[];
  planPlaces: readonly PlanPlaceCandidate[];
  placeActions: readonly CleanupRecord[];
  planPlaceActions: readonly CleanupRecord[];
}) {
  const mode = input.options.dryRun ? 'DRY RUN' : 'APPLY';
  console.log(`Invalid offline Places audit/cleanup: ${mode}`);
  if (input.options.limit) console.log(`Limit: ${input.options.limit}`);
  console.log('');

  console.log(`Invalid reusable Place rows: ${input.places.length}`);
  console.log(`  by source: ${JSON.stringify(countBy(input.places, (place) => place.source))}`);
  console.log(`  by status: ${JSON.stringify(countBy(input.places, (place) => place.status))}`);
  console.log(`  actions: ${JSON.stringify(actionCounts(input.placeActions))}`);
  if (input.places.length) {
    console.log('  sample:');
    for (const place of samplePlaces(input.places)) {
      console.log(`    - ${place.id} | ${place.title} | ${place.source}/${place.status} | missing ${place.missing}`);
    }
  }
  console.log('');

  console.log(`Invalid PlanPlace rows: ${input.planPlaces.length}`);
  console.log(`  by plan status: ${JSON.stringify(countBy(input.planPlaces, (planPlace) => planPlace.plan.status))}`);
  console.log(`  actions: ${JSON.stringify(actionCounts(input.planPlaceActions))}`);
  if (input.planPlaces.length) {
    console.log('  sample:');
    for (const planPlace of samplePlanPlaces(input.planPlaces)) {
      console.log(`    - ${planPlace.id} | ${planPlace.title} | plan ${planPlace.planTitle} | missing ${planPlace.missing}`);
    }
  }
  console.log('');

  if (input.options.dryRun) {
    console.log('No rows were changed. Add --apply with explicit action flags to mutate data.');
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  if (options.apply && !hasMutationAction(options)) {
    throw new Error('Refusing to run --apply without at least one action flag. Add --convert-online-when-url, --archive-places, --mark-plan-stops-unsupported, or --delete-test-only.');
  }

  const [places, planPlaces] = await Promise.all([
    loadInvalidPlaces(options.limit),
    loadInvalidPlanPlaces(options.limit),
  ]);

  const placeActions = await cleanupPlaces(places, options);
  const planPlaceActions = await cleanupPlanPlaces(planPlaces, options);

  if (options.json) {
    console.log(JSON.stringify({
      dryRun: options.dryRun,
      counts: {
        places: places.length,
        planPlaces: planPlaces.length,
      },
      placeActions: actionCounts(placeActions),
      planPlaceActions: actionCounts(planPlaceActions),
      samples: {
        places: samplePlaces(places),
        planPlaces: samplePlanPlaces(planPlaces),
      },
    }, null, 2));
    return;
  }

  printTextReport({ options, places, planPlaces, placeActions, planPlaceActions });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
