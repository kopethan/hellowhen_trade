import { z } from 'zod';

export const AGENDA_ITEM_TITLE_MAX_LENGTH = 120;
export const AGENDA_ITEM_NOTE_MAX_LENGTH = 2000;
export const AGENDA_ITEM_TIMEZONE_MAX_LENGTH = 80;

export const agendaItemSourceTypeSchema = z.enum([
  'trade',
  'need',
  'offer',
  'proposal',
  'deal',
  'user',
  'saved_item',
  'custom',
]);

export const agendaItemTypeSchema = z.enum([
  'trade',
  'need',
  'offer',
  'proposal',
  'deal',
  'person',
  'reminder',
]);

export const agendaItemStatusSchema = z.enum(['active', 'done', 'cancelled']);

const optionalNullableSourceIdSchema = z.string().trim().min(1).optional().nullable();

function hasValidAgendaSourceLink(value) {
  const sourceType = value.sourceType ?? 'custom';
  const sourceId = value.sourceId?.trim() || null;
  if (sourceType === 'custom') return sourceId === null;
  return sourceId !== null;
}


function hasValidAgendaSourceLinkUpdate(value) {
  const sourceId = value.sourceId?.trim() || null;
  if (!value.sourceType) return true;
  if (value.sourceType === 'custom') return sourceId === null;
  return sourceId !== null;
}

function hasValidAgendaDateRange(value) {
  if (!value.startAt || !value.endAt) return true;
  const start = Date.parse(value.startAt);
  const end = Date.parse(value.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
  return end >= start;
}

export const listAgendaItemsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  itemType: agendaItemTypeSchema.optional(),
  sourceType: agendaItemSourceTypeSchema.optional(),
  status: agendaItemStatusSchema.optional().default('active'),
  q: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().trim().min(1).optional(),
});

export const agendaIcsExportQuerySchema = listAgendaItemsQuerySchema.omit({ cursor: true }).extend({
  take: z.coerce.number().int().min(1).max(500).optional().default(500),
});

export const createAgendaItemRequestSchema = z.object({
  sourceType: agendaItemSourceTypeSchema.optional().default('custom'),
  sourceId: optionalNullableSourceIdSchema,
  itemType: agendaItemTypeSchema.optional().default('reminder'),
  title: z.string().trim().min(1).max(AGENDA_ITEM_TITLE_MAX_LENGTH),
  note: z.string().trim().max(AGENDA_ITEM_NOTE_MAX_LENGTH).optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional().default(false),
  timezone: z.string().trim().min(1).max(AGENDA_ITEM_TIMEZONE_MAX_LENGTH).optional().default('UTC'),
}).strict()
  .refine(hasValidAgendaSourceLink, { message: 'Linked Agenda items require sourceId; custom Agenda items must not include sourceId.' })
  .refine(hasValidAgendaDateRange, { message: 'endAt must be after startAt.' });

export const updateAgendaItemRequestSchema = z.object({
  sourceType: agendaItemSourceTypeSchema.optional(),
  sourceId: optionalNullableSourceIdSchema,
  itemType: agendaItemTypeSchema.optional(),
  title: z.string().trim().min(1).max(AGENDA_ITEM_TITLE_MAX_LENGTH).optional(),
  note: z.string().trim().max(AGENDA_ITEM_NOTE_MAX_LENGTH).optional().nullable(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(AGENDA_ITEM_TIMEZONE_MAX_LENGTH).optional(),
  status: agendaItemStatusSchema.optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one Agenda item field to update.' })
  .refine(hasValidAgendaSourceLinkUpdate, { message: 'Linked Agenda updates require sourceId when changing to a linked source; custom Agenda items must not include sourceId.' })
  .refine(hasValidAgendaDateRange, { message: 'endAt must be after startAt.' });

export const agendaItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sourceType: agendaItemSourceTypeSchema,
  sourceId: z.string().nullable().optional(),
  itemType: agendaItemTypeSchema,
  title: z.string(),
  note: z.string().nullable().optional(),
  startAt: z.string(),
  endAt: z.string().nullable().optional(),
  allDay: z.boolean(),
  timezone: z.string(),
  status: agendaItemStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const agendaItemsResponseSchema = z.object({
  items: z.array(agendaItemSchema),
  nextCursor: z.string().nullable().optional(),
});

export const agendaItemResponseSchema = z.object({ item: agendaItemSchema });
