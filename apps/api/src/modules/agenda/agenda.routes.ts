import { Router } from 'express';
import type { AgendaItemSourceType, Prisma } from '@prisma/client';
import { canUseAgendaFeature, getPlusPrivateFeatureBlockers, normalizeSubscriptionStatus, normalizeSubscriptionTier } from '@hellowhen/shared';
import {
  agendaIcsExportQuerySchema,
  createAgendaItemRequestSchema,
  listAgendaItemsQuerySchema,
  updateAgendaItemRequestSchema,
  type AgendaItemDto,
} from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { requireAgendaEnabled } from '../../middleware/featureGates.js';
import { publicTradeVisibilityWhere } from '../trades/trades.routes.js';
import { usersHaveBlockBetween } from '../users/userBlocks.js';

export const agendaRoutes = Router();

agendaRoutes.use(requireAuth);
agendaRoutes.use(requireAgendaEnabled());
agendaRoutes.use(requireActiveAccount);

type AgendaSourceInput = {
  sourceType: AgendaItemSourceType;
  sourceId?: string | null;
};

type AgendaDateRangeInput = {
  startAt: Date;
  endAt?: Date | null;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}



type AgendaListQueryInput = {
  from?: string;
  to?: string;
  itemType?: string;
  sourceType?: AgendaItemSourceType;
  status?: string;
  q?: string;
};

function foldIcsLine(line: string) {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
}

function escapeIcsText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toIcsUtcDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}


function dateInTimezone(value: Date | string, timezone: string) {
  const date = value instanceof Date ? value : new Date(value);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (year && month && day) return `${year}${month}${day}`;
  } catch {
    // Fall back to UTC formatting when an old runtime does not know the timezone.
  }
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function sanitizeIcsFilenamePart(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'agenda';
}

function buildAgendaWhere(userId: string, input: AgendaListQueryInput) {
  const from = input.from ? parseDate(input.from) : null;
  const to = input.to ? parseDate(input.to) : null;
  const and: Prisma.AgendaItemWhereInput[] = [{ userId }];
  if (input.status) and.push({ status: input.status as any });
  if (input.itemType) and.push({ itemType: input.itemType as any });
  if (input.sourceType) and.push({ sourceType: input.sourceType });
  if (input.q) {
    and.push({
      OR: [
        { title: { contains: input.q, mode: 'insensitive' as const } },
        { note: { contains: input.q, mode: 'insensitive' as const } },
        { sourceId: { contains: input.q, mode: 'insensitive' as const } },
      ],
    });
  }
  if (from) {
    and.push({
      OR: [
        { endAt: { gte: from } },
        { endAt: null, startAt: { gte: from } },
      ],
    });
  }
  if (to) and.push({ startAt: { lte: to } });
  return { where: { AND: and }, from, to };
}

function agendaItemToIcsEvent(item: {
  id: string;
  itemType: string;
  title: string;
  note: string | null;
  startAt: Date | string;
  endAt: Date | string | null;
  allDay: boolean;
  timezone: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(`${item.id}@hellowhen-agenda`)}`,
    `DTSTAMP:${toIcsUtcDateTime(new Date())}`,
    `CREATED:${toIcsUtcDateTime(item.createdAt)}`,
    `LAST-MODIFIED:${toIcsUtcDateTime(item.updatedAt)}`,
    `SUMMARY:${escapeIcsText(item.title)}`,
    `CLASS:PRIVATE`,
    `TRANSP:TRANSPARENT`,
    `STATUS:${item.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    `CATEGORIES:${escapeIcsText(`Hellowhen Agenda,${item.itemType}`)}`,
    'X-HELLOWHEN-PRIVATE:TRUE',
    'X-HELLOWHEN-AGENDA-TYPE:' + escapeIcsText(item.itemType),
  ];

  const description = [
    item.note?.trim() || null,
    'Private Hellowhen Agenda item. Exporting this file may copy it to an external calendar app.',
  ].filter(Boolean).join('\n\n');
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);

  if (item.allDay) {
    const start = new Date(item.startAt);
    const end = addDays(new Date(item.endAt ?? item.startAt), 1);
    lines.push(`DTSTART;VALUE=DATE:${dateInTimezone(start, item.timezone)}`);
    lines.push(`DTEND;VALUE=DATE:${dateInTimezone(end, item.timezone)}`);
  } else {
    const start = new Date(item.startAt);
    lines.push(`DTSTART:${toIcsUtcDateTime(start)}`);
    if (item.endAt) lines.push(`DTEND:${toIcsUtcDateTime(item.endAt)}`);
  }

  lines.push('END:VEVENT');
  return lines.map(foldIcsLine).join('\r\n');
}

function agendaItemsToIcs(items: Parameters<typeof agendaItemToIcsEvent>[0][], calendarName = 'Hellowhen Agenda') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hellowhen//Agenda//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:UTC',
    ...items.map(agendaItemToIcsEvent),
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

function sendAgendaIcs(res: any, filename: string, items: Parameters<typeof agendaItemsToIcs>[0], calendarName?: string) {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).send(agendaItemsToIcs(items, calendarName));
}

function toAgendaItemDto(item: {
  id: string;
  userId: string;
  sourceType: AgendaItemSourceType;
  sourceId: string | null;
  itemType: string;
  title: string;
  note: string | null;
  startAt: Date | string;
  endAt: Date | string | null;
  allDay: boolean;
  timezone: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): AgendaItemDto {
  return {
    id: item.id,
    userId: item.userId,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    itemType: item.itemType as AgendaItemDto['itemType'],
    title: item.title,
    note: item.note,
    startAt: toIso(item.startAt)!,
    endAt: toIso(item.endAt),
    allDay: item.allDay,
    timezone: item.timezone,
    status: item.status as AgendaItemDto['status'],
    createdAt: toIso(item.createdAt)!,
    updatedAt: toIso(item.updatedAt)!,
  };
}

function normalizeSourceLink(input: AgendaSourceInput) {
  const sourceId = input.sourceId?.trim() || null;
  if (input.sourceType === 'custom') return { sourceType: input.sourceType, sourceId: null };
  return { sourceType: input.sourceType, sourceId };
}

function hasValidSourceLink(input: AgendaSourceInput) {
  const normalized = normalizeSourceLink(input);
  if (normalized.sourceType === 'custom') return normalized.sourceId === null;
  return Boolean(normalized.sourceId);
}

function hasValidDateRange(input: AgendaDateRangeInput) {
  if (!input.endAt) return true;
  return input.endAt.getTime() >= input.startAt.getTime();
}

function parseDate(value: string) {
  return new Date(value);
}

function agendaSourceNotFoundPayload() {
  return {
    error: 'agenda_source_not_found',
    message: 'This item cannot be added to Agenda or is no longer available.',
  };
}

function agendaPlusRequiredPayload(owner: { subscriptionTier?: string | null; subscriptionStatus?: string | null } | null) {
  return {
    error: 'agenda_plus_required',
    message: 'Agenda is a Plus feature. Upgrade to Plus to organize trades, reminders, follow-ups, and deadlines privately.',
    upgradeRequired: true,
    feature: 'agenda',
    blockers: getPlusPrivateFeatureBlockers({
      plusEnabled: env.plusEnabled,
      featureEnabled: env.agendaEnabled,
      state: {
        subscriptionTier: normalizeSubscriptionTier(owner?.subscriptionTier),
        subscriptionStatus: normalizeSubscriptionStatus(owner?.subscriptionStatus),
      },
    }),
  };
}

async function requireAgendaPlus(ownerId: string, res: any) {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  const allowed = canUseAgendaFeature({
    plusEnabled: env.plusEnabled,
    agendaEnabled: env.agendaEnabled,
    state: {
      subscriptionTier: owner?.subscriptionTier ?? 'free',
      subscriptionStatus: owner?.subscriptionStatus ?? 'none',
    },
  });
  if (allowed) return true;
  res.status(403).json(agendaPlusRequiredPayload(owner));
  return false;
}

async function canLinkTrade(ownerId: string, sourceId: string) {
  const trade = await prisma.trade.findFirst({
    where: {
      id: sourceId,
      OR: [
        { ownerId },
        { providerId: ownerId },
        publicTradeVisibilityWhere(),
      ],
    },
    select: { ownerId: true, providerId: true },
  });
  if (!trade) return false;
  return !(await usersHaveBlockBetween(ownerId, trade.ownerId)) && !(await usersHaveBlockBetween(ownerId, trade.providerId));
}

async function canLinkNeed(ownerId: string, sourceId: string) {
  const need = await prisma.need.findFirst({
    where: {
      id: sourceId,
      OR: [
        { ownerId },
        { status: 'active', owner: { trustTier: { not: 'restricted' } } },
      ],
    },
    select: { ownerId: true },
  });
  if (!need) return false;
  return !(await usersHaveBlockBetween(ownerId, need.ownerId));
}

async function canLinkOffer(ownerId: string, sourceId: string) {
  const offer = await prisma.offer.findFirst({
    where: {
      id: sourceId,
      OR: [
        { ownerId },
        { status: 'active', owner: { trustTier: { not: 'restricted' } } },
      ],
    },
    select: { ownerId: true },
  });
  if (!offer) return false;
  return !(await usersHaveBlockBetween(ownerId, offer.ownerId));
}

async function canLinkProposal(ownerId: string, sourceId: string) {
  const proposal = await prisma.tradeProposal.findFirst({
    where: {
      id: sourceId,
      OR: [
        { applicantId: ownerId },
        { trade: { ownerId } },
        { trade: { providerId: ownerId } },
      ],
    },
    select: { id: true },
  });
  return Boolean(proposal);
}

async function canLinkDeal(ownerId: string, sourceId: string) {
  const deal = await prisma.acceptedDealSnapshot.findFirst({
    where: {
      OR: [
        { id: sourceId },
        { tradeId: sourceId },
        { proposalId: sourceId },
      ],
      AND: [{ OR: [{ ownerId }, { applicantId: ownerId }] }],
    },
    select: { id: true },
  });
  return Boolean(deal);
}

async function canLinkUser(ownerId: string, sourceId: string) {
  const user = await prisma.user.findUnique({
    where: { id: sourceId },
    select: { id: true, trustTier: true },
  });
  if (!user || user.trustTier === 'restricted') return false;
  return !(await usersHaveBlockBetween(ownerId, user.id));
}

async function canLinkSavedItem(ownerId: string, sourceId: string) {
  const savedItem = await prisma.savedItem.findFirst({
    where: { id: sourceId, ownerId },
    select: { id: true },
  });
  return Boolean(savedItem);
}

async function canLinkAgendaSource(ownerId: string, input: AgendaSourceInput) {
  const normalized = normalizeSourceLink(input);
  if (normalized.sourceType === 'custom') return normalized.sourceId === null;
  if (!normalized.sourceId) return false;

  switch (normalized.sourceType) {
    case 'trade':
      return canLinkTrade(ownerId, normalized.sourceId);
    case 'need':
      return canLinkNeed(ownerId, normalized.sourceId);
    case 'offer':
      return canLinkOffer(ownerId, normalized.sourceId);
    case 'proposal':
      return canLinkProposal(ownerId, normalized.sourceId);
    case 'deal':
      return canLinkDeal(ownerId, normalized.sourceId);
    case 'user':
      return canLinkUser(ownerId, normalized.sourceId);
    case 'saved_item':
      return canLinkSavedItem(ownerId, normalized.sourceId);
  }
}

agendaRoutes.get('/', asyncRoute(async (req, res) => {
  if (!(await requireAgendaPlus(req.user!.id, res))) return;
  const input = listAgendaItemsQuerySchema.parse(req.query);
  const { where, from, to } = buildAgendaWhere(req.user!.id, input);
  if (from && to && to.getTime() < from.getTime()) {
    return res.status(400).json({ error: 'invalid_date_range', message: 'The Agenda date range is invalid.' });
  }

  if (input.cursor) {
    const cursor = await prisma.agendaItem.findFirst({ where: { id: input.cursor, userId: req.user!.id }, select: { id: true } });
    if (!cursor) return res.status(400).json({ error: 'invalid_cursor', message: 'This Agenda cursor is no longer available.' });
  }

  const items = await prisma.agendaItem.findMany({
    where,
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    take: input.take + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });
  const page = items.slice(0, input.take);
  const nextCursor = items.length > input.take ? items[input.take]?.id ?? null : null;

  res.json({ items: page.map(toAgendaItemDto), nextCursor });
}));

agendaRoutes.get('/ics', asyncRoute(async (req, res) => {
  if (!(await requireAgendaPlus(req.user!.id, res))) return;
  const input = agendaIcsExportQuerySchema.parse(req.query);
  const { where, from, to } = buildAgendaWhere(req.user!.id, input);
  if (from && to && to.getTime() < from.getTime()) {
    return res.status(400).json({ error: 'invalid_date_range', message: 'The Agenda date range is invalid.' });
  }

  const items = await prisma.agendaItem.findMany({
    where,
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    take: input.take,
  });

  sendAgendaIcs(res, 'hellowhen-agenda.ics', items, 'Hellowhen Agenda');
}));

agendaRoutes.get('/:itemId/ics', asyncRoute(async (req, res) => {
  if (!(await requireAgendaPlus(req.user!.id, res))) return;
  const item = await prisma.agendaItem.findFirst({ where: { id: req.params.itemId, userId: req.user!.id } });
  if (!item) return res.status(404).json({ error: 'agenda_item_not_found', message: 'Agenda item not found.' });

  const filename = `hellowhen-agenda-${sanitizeIcsFilenamePart(item.title)}.ics`;
  sendAgendaIcs(res, filename, [item], item.title);
}));

agendaRoutes.post('/', asyncRoute(async (req, res) => {
  if (!(await requireAgendaPlus(req.user!.id, res))) return;
  const input = createAgendaItemRequestSchema.parse(req.body);
  const source = normalizeSourceLink({ sourceType: input.sourceType, sourceId: input.sourceId });
  const dates = { startAt: parseDate(input.startAt), endAt: input.endAt ? parseDate(input.endAt) : null };

  if (!hasValidSourceLink(source)) {
    return res.status(400).json({ error: 'invalid_agenda_source', message: 'Linked Agenda items require a source. Custom Agenda items cannot include a source.' });
  }
  if (!hasValidDateRange(dates)) {
    return res.status(400).json({ error: 'invalid_date_range', message: 'Agenda end time must be after the start time.' });
  }
  if (!(await canLinkAgendaSource(req.user!.id, source))) {
    return res.status(404).json(agendaSourceNotFoundPayload());
  }

  const item = await prisma.agendaItem.create({
    data: {
      userId: req.user!.id,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      itemType: input.itemType,
      title: input.title,
      note: input.note ?? null,
      startAt: dates.startAt,
      endAt: dates.endAt,
      allDay: input.allDay,
      timezone: input.timezone,
    },
  });

  res.status(201).json({ item: toAgendaItemDto(item) });
}));

agendaRoutes.patch('/:itemId', asyncRoute(async (req, res) => {
  if (!(await requireAgendaPlus(req.user!.id, res))) return;
  const input = updateAgendaItemRequestSchema.parse(req.body);
  const existing = await prisma.agendaItem.findFirst({ where: { id: req.params.itemId, userId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'agenda_item_not_found', message: 'Agenda item not found.' });

  const source = normalizeSourceLink({
    sourceType: (input.sourceType ?? existing.sourceType) as AgendaItemSourceType,
    sourceId: input.sourceType === 'custom' ? null : input.sourceId === undefined ? existing.sourceId : input.sourceId,
  });
  const dates = {
    startAt: input.startAt ? parseDate(input.startAt) : existing.startAt,
    endAt: input.endAt === undefined ? existing.endAt : input.endAt ? parseDate(input.endAt) : null,
  };

  if (!hasValidSourceLink(source)) {
    return res.status(400).json({ error: 'invalid_agenda_source', message: 'Linked Agenda items require a source. Custom Agenda items cannot include a source.' });
  }
  if (!hasValidDateRange(dates)) {
    return res.status(400).json({ error: 'invalid_date_range', message: 'Agenda end time must be after the start time.' });
  }
  if (input.sourceType !== undefined || input.sourceId !== undefined) {
    if (!(await canLinkAgendaSource(req.user!.id, source))) return res.status(404).json(agendaSourceNotFoundPayload());
  }

  const data: Prisma.AgendaItemUncheckedUpdateInput = {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
  };
  if (input.itemType !== undefined) data.itemType = input.itemType;
  if (input.title !== undefined) data.title = input.title;
  if (input.note !== undefined) data.note = input.note ?? null;
  if (input.startAt !== undefined) data.startAt = dates.startAt;
  if (input.endAt !== undefined) data.endAt = dates.endAt;
  if (input.allDay !== undefined) data.allDay = input.allDay;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.status !== undefined) data.status = input.status;

  const item = await prisma.agendaItem.update({ where: { id: existing.id }, data });
  res.json({ item: toAgendaItemDto(item) });
}));

agendaRoutes.delete('/:itemId', asyncRoute(async (req, res) => {
  if (!(await requireAgendaPlus(req.user!.id, res))) return;
  const item = await prisma.agendaItem.findFirst({ where: { id: req.params.itemId, userId: req.user!.id }, select: { id: true } });
  if (!item) return res.status(404).json({ error: 'agenda_item_not_found', message: 'Agenda item not found.' });
  await prisma.agendaItem.delete({ where: { id: item.id } });
  res.status(204).send();
}));
