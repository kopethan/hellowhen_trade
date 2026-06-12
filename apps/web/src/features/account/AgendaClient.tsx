'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { AgendaItemDto, AgendaItemStatus, AgendaItemType, PlusSubscriptionSnapshotResponse } from '@hellowhen/contracts';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { formatWebPlusMonthlyPrice } from '../../lib/plusGate';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { formatDateTime } from './accountPresentation';

const AGENDA_ITEM_TITLE_MAX_LENGTH = 120;
const AGENDA_ITEM_NOTE_MAX_LENGTH = 2000;

type AgendaFilter = 'all' | AgendaItemType;
type AgendaEditorMode = 'create' | 'edit';
type AgendaQuickView = 'all' | 'today' | 'this_week' | 'overdue';

type AgendaEditorState = {
  id?: string;
  title: string;
  itemType: AgendaItemType;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: AgendaItemStatus;
  note: string;
};

const agendaTypes: { value: AgendaFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'account.agenda.filters.all' },
  { value: 'reminder', labelKey: 'account.agenda.types.reminder' },
  { value: 'trade', labelKey: 'account.agenda.types.trade' },
  { value: 'need', labelKey: 'account.agenda.types.need' },
  { value: 'offer', labelKey: 'account.agenda.types.offer' },
  { value: 'proposal', labelKey: 'account.agenda.types.proposal' },
  { value: 'deal', labelKey: 'account.agenda.types.deal' },
  { value: 'person', labelKey: 'account.agenda.types.person' },
];

const statusFilters: { value: AgendaItemStatus; labelKey: string }[] = [
  { value: 'active', labelKey: 'account.agenda.statuses.active' },
  { value: 'done', labelKey: 'account.agenda.statuses.done' },
  { value: 'cancelled', labelKey: 'account.agenda.statuses.cancelled' },
];

const quickViews: { value: AgendaQuickView; labelKey: string }[] = [
  { value: 'all', labelKey: 'account.agenda.quickViews.all' },
  { value: 'today', labelKey: 'account.agenda.quickViews.today' },
  { value: 'this_week', labelKey: 'account.agenda.quickViews.thisWeek' },
  { value: 'overdue', labelKey: 'account.agenda.quickViews.overdue' },
];

const editableTypes: { value: AgendaItemType; labelKey: string }[] = [
  { value: 'reminder', labelKey: 'account.agenda.types.reminder' },
  { value: 'trade', labelKey: 'account.agenda.types.trade' },
  { value: 'need', labelKey: 'account.agenda.types.need' },
  { value: 'offer', labelKey: 'account.agenda.types.offer' },
  { value: 'proposal', labelKey: 'account.agenda.types.proposal' },
  { value: 'deal', labelKey: 'account.agenda.types.deal' },
  { value: 'person', labelKey: 'account.agenda.types.person' },
];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function roundToNextHour(date = new Date()) {
  const rounded = new Date(date);
  rounded.setMinutes(0, 0, 0);
  if (rounded.getTime() <= date.getTime()) rounded.setHours(rounded.getHours() + 1);
  return rounded;
}

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date = new Date()) {
  const end = startOfLocalDay(date);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateTimeLocal(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toApiDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function sameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function itemDayKey(item: AgendaItemDto) {
  const date = new Date(item.startAt);
  if (!Number.isFinite(date.getTime())) return item.startAt.slice(0, 10);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultEditorState(): AgendaEditorState {
  return {
    title: '',
    itemType: 'reminder',
    startAt: toDateTimeLocal(roundToNextHour()),
    endAt: '',
    allDay: false,
    status: 'active',
    note: '',
  };
}

function editorStateFromItem(item: AgendaItemDto): AgendaEditorState {
  return {
    id: item.id,
    title: item.title,
    itemType: item.itemType,
    startAt: toDateTimeLocal(item.startAt),
    endAt: item.endAt ? toDateTimeLocal(item.endAt) : '',
    allDay: item.allDay,
    status: item.status,
    note: item.note ?? '',
  };
}

function agendaTypeClass(type: AgendaItemType) {
  if (type === 'need') return 'semantic-badge need';
  if (type === 'offer') return 'semantic-badge offer';
  if (type === 'trade') return 'semantic-badge trade';
  if (type === 'proposal') return 'semantic-badge proposal';
  if (type === 'deal') return 'semantic-badge success';
  return 'semantic-badge instruction';
}

function agendaStatusClass(status: AgendaItemStatus) {
  if (status === 'done') return 'semantic-badge success';
  if (status === 'cancelled') return 'semantic-badge danger';
  return 'semantic-badge instruction';
}

function sourceLabel(item: AgendaItemDto, t: (key: string) => string) {
  if (item.sourceType === 'custom') return t('account.agenda.sourceLabels.custom');
  return t(`account.agenda.sourceLabels.${item.sourceType}`);
}

function isOverdueItem(item: AgendaItemDto) {
  if (item.status !== 'active') return false;
  const start = new Date(item.startAt);
  if (!Number.isFinite(start.getTime())) return false;
  return start.getTime() < startOfLocalDay().getTime();
}

function agendaQuickViewRange(view: AgendaQuickView) {
  const todayStart = startOfLocalDay();
  if (view === 'today') return { from: todayStart.toISOString(), to: endOfLocalDay(todayStart).toISOString() };
  if (view === 'this_week') return { from: todayStart.toISOString(), to: endOfLocalDay(addDays(todayStart, 6)).toISOString() };
  if (view === 'overdue') {
    const beforeToday = new Date(todayStart);
    beforeToday.setMilliseconds(beforeToday.getMilliseconds() - 1);
    return { from: undefined, to: beforeToday.toISOString() };
  }
  return { from: undefined, to: undefined };
}

function groupByDay(items: AgendaItemDto[]) {
  return items.reduce<Record<string, AgendaItemDto[]>>((groups, item) => {
    const key = itemDayKey(item);
    groups[key] = groups[key] ? [...groups[key], item] : [item];
    return groups;
  }, {});
}

function agendaItemHref(item: AgendaItemDto) {
  if (!item.sourceId) return '';
  if (item.sourceType === 'trade') return `/trades/${item.sourceId}`;
  if (item.sourceType === 'need') return `/needs/${item.sourceId}`;
  if (item.sourceType === 'offer') return `/offers/${item.sourceId}`;
  if (item.sourceType === 'user') return `/users/${item.sourceId}`;
  return '';
}

function agendaIcsFilename(title: string) {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'agenda';
  return `hellowhen-agenda-${slug}.ics`;
}

function downloadAgendaIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toGoogleUtcDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function toGoogleAllDayDate(value: Date) {
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}`;
}

function googleCalendarDates(item: AgendaItemDto) {
  const start = new Date(item.startAt);
  const safeStart = Number.isFinite(start.getTime()) ? start : new Date();
  const parsedEnd = item.endAt ? new Date(item.endAt) : null;
  const safeEnd = parsedEnd && Number.isFinite(parsedEnd.getTime()) ? parsedEnd : null;
  if (item.allDay) {
    const end = addDays(safeEnd ?? safeStart, 1);
    return `${toGoogleAllDayDate(safeStart)}/${toGoogleAllDayDate(end)}`;
  }
  const end = safeEnd ?? new Date(safeStart.getTime() + 60 * 60 * 1000);
  return `${toGoogleUtcDate(safeStart)}/${toGoogleUtcDate(end)}`;
}

function googleCalendarUrl(item: AgendaItemDto, details: string) {
  const entries: [string, string][] = [
    ['action', 'TEMPLATE'],
    ['text', item.title],
    ['dates', googleCalendarDates(item)],
    ['details', details],
  ];
  const params = entries.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function AgendaClient() {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [plusSnapshot, setPlusSnapshot] = useState<PlusSubscriptionSnapshotResponse | null>(null);
  const [plusLoading, setPlusLoading] = useState(true);
  const [items, setItems] = useState<AgendaItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<AgendaFilter>('all');
  const [status, setStatus] = useState<AgendaItemStatus>('active');
  const [quickView, setQuickView] = useState<AgendaQuickView>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<AgendaEditorMode | null>(null);
  const [editor, setEditor] = useState<AgendaEditorState>(() => defaultEditorState());
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const agendaEnabled = betaFeatures.agendaEnabled;
  const plusPublic = betaFeatures.plusSubscriptionFeatures.plusPublic;
  const plusPrice = useMemo(() => formatWebPlusMonthlyPrice(), []);
  const timezone = useMemo(() => browserTimezone(), []);
  const hasPlusAccess = Boolean(plusSnapshot?.access.hasPlusAccess);

  async function load({ append = false, cursor }: { append?: boolean; cursor?: string } = {}) {
    if (!auth.hydrated || !auth.isAuthenticated || !agendaEnabled || !hasPlusAccess) {
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const range = agendaQuickViewRange(quickView);
      const query = search.trim();
      const response = await api.agenda.list({
        take: 80,
        status,
        ...(filter !== 'all' ? { itemType: filter } : {}),
        ...(range.from ? { from: range.from } : {}),
        ...(range.to ? { to: range.to } : {}),
        ...(query ? { q: query } : {}),
        ...(cursor ? { cursor } : {}),
      });
      setItems((current) => append ? [...current, ...(response.items ?? [])] : (response.items ?? []));
      setNextCursor(response.nextCursor ?? null);
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.loadError')));
      if (!append) {
        setItems([]);
        setNextCursor(null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!auth.hydrated || !agendaEnabled) {
      setPlusLoading(false);
      return;
    }
    if (!auth.isAuthenticated) {
      setPlusSnapshot(null);
      setPlusLoading(false);
      return;
    }
    let mounted = true;
    async function loadPlus() {
      setPlusLoading(true);
      try {
        const response = await api.plus.me();
        if (mounted) setPlusSnapshot(response);
      } catch {
        if (mounted) setPlusSnapshot(null);
      } finally {
        if (mounted) setPlusLoading(false);
      }
    }
    void loadPlus();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated, agendaEnabled]);

  useEffect(() => { void load(); }, [auth.hydrated, auth.isAuthenticated, agendaEnabled, hasPlusAccess, filter, status, quickView, search]);

  const todayItems = useMemo(() => {
    const today = new Date();
    return items.filter((item) => sameLocalDay(new Date(item.startAt), today));
  }, [items]);

  const overdueItems = useMemo(() => items.filter(isOverdueItem), [items]);
  const weekItems = useMemo(() => {
    const todayStart = startOfLocalDay();
    const weekEnd = endOfLocalDay(addDays(todayStart, 6));
    return items.filter((item) => {
      const start = new Date(item.startAt);
      return Number.isFinite(start.getTime()) && start.getTime() >= todayStart.getTime() && start.getTime() <= weekEnd.getTime();
    });
  }, [items]);
  const grouped = useMemo(() => groupByDay(items), [items]);
  const groupedEntries = useMemo(() => Object.entries(grouped), [grouped]);
  const hasItems = items.length > 0;
  const hasCustomFilters = filter !== 'all' || status !== 'active' || quickView !== 'all' || Boolean(search.trim());
  const editorTitle = editorMode === 'edit' ? t('account.agenda.editor.editTitle') : t('account.agenda.editor.createTitle');

  function openCreateEditor() {
    setEditor(defaultEditorState());
    setEditorMode('create');
    setTitleError(null);
    setDateError(null);
    setError(null);
    setMessage(null);
  }

  function openEditEditor(item: AgendaItemDto) {
    setEditor(editorStateFromItem(item));
    setEditorMode('edit');
    setTitleError(null);
    setDateError(null);
    setError(null);
    setMessage(null);
  }

  function closeEditor() {
    setEditorMode(null);
    setEditor(defaultEditorState());
    setTitleError(null);
    setDateError(null);
  }

  function clearAgendaFilters() {
    setFilter('all');
    setStatus('active');
    setQuickView('all');
    setSearch('');
    setNextCursor(null);
  }

  function currentExportQuery() {
    const range = agendaQuickViewRange(quickView);
    const query = search.trim();
    return {
      take: 500,
      status,
      ...(filter !== 'all' ? { itemType: filter } : {}),
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
      ...(query ? { q: query } : {}),
    };
  }

  async function exportAgendaView() {
    setExportingId('view');
    setError(null);
    setMessage(null);
    try {
      const ics = await api.agenda.exportIcs(currentExportQuery());
      downloadAgendaIcs('hellowhen-agenda.ics', ics);
      setMessage(t('account.agenda.export.exported'));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.export.error')));
    } finally {
      setExportingId(null);
    }
  }

  async function exportAgendaItem(item: AgendaItemDto) {
    setExportingId(item.id);
    setError(null);
    setMessage(null);
    try {
      const ics = await api.agenda.exportItemIcs(item.id);
      downloadAgendaIcs(agendaIcsFilename(item.title), ics);
      setMessage(t('account.agenda.export.itemExported', { title: item.title }));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.export.error')));
    } finally {
      setExportingId(null);
    }
  }

  function openGoogleCalendar(item: AgendaItemDto) {
    const details = [
      item.note?.trim() || null,
      t('account.agenda.export.externalDescription'),
    ].filter(Boolean).join('\n\n');
    window.open(googleCalendarUrl(item, details), '_blank', 'noopener,noreferrer');
  }

  function validateEditor() {
    const title = editor.title.trim();
    const startAt = toApiDateTime(editor.startAt);
    const endAt = editor.endAt ? toApiDateTime(editor.endAt) : '';
    setTitleError(null);
    setDateError(null);
    if (!title) {
      setTitleError(t('account.agenda.editor.titleRequired'));
      return null;
    }
    if (!startAt) {
      setDateError(t('account.agenda.editor.startRequired'));
      return null;
    }
    if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
      setDateError(t('account.agenda.editor.endAfterStart'));
      return null;
    }
    return { title, startAt, endAt: endAt || null };
  }

  async function saveAgendaItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = validateEditor();
    if (!validated) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (editorMode === 'edit' && editor.id) {
        const response = await api.agenda.update(editor.id, {
          itemType: editor.itemType,
          title: validated.title,
          note: editor.note.trim() || null,
          startAt: validated.startAt,
          endAt: validated.endAt,
          allDay: editor.allDay,
          timezone,
          status: editor.status,
        });
        setItems((current) => current.map((item) => item.id === response.item.id ? response.item : item));
        setMessage(t('account.agenda.updated', { title: response.item.title }));
      } else {
        const response = await api.agenda.create({
          sourceType: 'custom',
          itemType: editor.itemType,
          title: validated.title,
          note: editor.note.trim() || null,
          startAt: validated.startAt,
          endAt: validated.endAt,
          allDay: editor.allDay,
          timezone,
        });
        setItems((current) => [response.item, ...current].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
        setMessage(t('account.agenda.created', { title: response.item.title }));
      }
      closeEditor();
      void load();
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.saveError')));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgendaItem(item: AgendaItemDto) {
    const confirmed = window.confirm(t('account.agenda.confirmDelete', { title: item.title }));
    if (!confirmed) return;
    setDeletingId(item.id);
    setError(null);
    setMessage(null);
    try {
      await api.agenda.remove(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setMessage(t('account.agenda.deleted', { title: item.title }));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.deleteError')));
    } finally {
      setDeletingId(null);
    }
  }

  async function updateItemStatus(item: AgendaItemDto, nextStatus: AgendaItemStatus) {
    setDeletingId(item.id);
    setError(null);
    setMessage(null);
    try {
      const response = await api.agenda.update(item.id, { status: nextStatus });
      setItems((current) => current.map((entry) => entry.id === item.id ? response.item : entry).filter((entry) => entry.status === status));
      setMessage(t('account.agenda.statusUpdated', { title: response.item.title }));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.saveError')));
    } finally {
      setDeletingId(null);
    }
  }

  if (!agendaEnabled) {
    return (
      <section className="agenda-locked-card">
        <span className="semantic-badge instruction">{t('account.agenda.plus.badge')}</span>
        <h3>{t('account.agenda.disabledTitle')}</h3>
        <p>{t('account.agenda.disabledBody')}</p>
        <code>AGENDA_ENABLED=false · NEXT_PUBLIC_AGENDA_ENABLED=false</code>
      </section>
    );
  }

  if (!auth.hydrated || plusLoading) {
    return <section className="mobile-card mobile-card--soft"><p>{t('account.agenda.loading')}</p></section>;
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
        <h3>{t('account.agenda.signedOutTitle')}</h3>
        <p>{t('account.agenda.signedOutBody')}</p>
        <Link href="/auth?next=/account/agenda" className="button primary">{t('common.actions.loginOrRegister')}</Link>
      </section>
    );
  }

  if (!hasPlusAccess) {
    return (
      <section className="agenda-locked-card">
        <span className="semantic-badge success">{t('account.agenda.plus.badge')}</span>
        <h3>{t('account.agenda.plus.title')}</h3>
        <p>{t('account.agenda.plus.body', { price: plusPrice })}</p>
        {plusPublic ? <Link href="/account/plans" className="button primary">{t('account.agenda.plus.action')}</Link> : <span>{t('account.agenda.plus.comingSoon')}</span>}
      </section>
    );
  }

  return (
    <div className="agenda-panel">
      <section className="agenda-hero-card">
        <div className="agenda-hero-card__icon" aria-hidden="true">
          <WebIcon name="calendar" size={25} decorative />
        </div>
        <div>
          <span className="semantic-badge proposal">{t('account.agenda.privateBadge')}</span>
          <h3>{t('account.agenda.summaryTitle')}</h3>
          <p>{t('account.agenda.summaryBody')}</p>
          <p className="agenda-export-note">{t('account.agenda.export.privacyNote')}</p>
        </div>
        <button type="button" className="button primary" onClick={openCreateEditor}>{t('account.agenda.create')}</button>
      </section>

      <section className="agenda-toolbar" aria-label={t('account.agenda.filtersLabel')}>
        <div className="agenda-toolbar__header">
          <div>
            <strong>{t('account.agenda.quickSummaryTitle')}</strong>
            <span>{t('account.agenda.quickSummaryBody', { today: todayItems.length, week: weekItems.length, overdue: overdueItems.length })}</span>
          </div>
          <div className="agenda-toolbar__actions">
            {hasCustomFilters ? <button type="button" className="button secondary" onClick={clearAgendaFilters}>{t('account.agenda.clearFilters')}</button> : null}
            <button type="button" className="button secondary" disabled={exportingId === 'view'} onClick={() => { void exportAgendaView(); }}>{exportingId === 'view' ? t('account.agenda.export.exporting') : t('account.agenda.export.view')}</button>
            <button type="button" className="button secondary" onClick={() => { void load(); }}>{t('common.actions.tryAgain')}</button>
          </div>
        </div>

        <div className="agenda-insight-strip" aria-label={t('account.agenda.quickSummaryTitle')}>
          <button type="button" className={quickView === 'today' ? 'is-active' : ''} onClick={() => { setQuickView('today'); setNextCursor(null); }}>
            <strong>{todayItems.length}</strong>
            <span>{t('account.agenda.quickViews.today')}</span>
          </button>
          <button type="button" className={quickView === 'this_week' ? 'is-active' : ''} onClick={() => { setQuickView('this_week'); setNextCursor(null); }}>
            <strong>{weekItems.length}</strong>
            <span>{t('account.agenda.quickViews.thisWeek')}</span>
          </button>
          <button type="button" className={quickView === 'overdue' ? 'is-active' : ''} onClick={() => { setQuickView('overdue'); setStatus('active'); setNextCursor(null); }}>
            <strong>{overdueItems.length}</strong>
            <span>{t('account.agenda.quickViews.overdue')}</span>
          </button>
        </div>

        <label className="agenda-search">
          <span>{t('account.agenda.searchLabel')}</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setNextCursor(null); }} placeholder={t('account.agenda.searchPlaceholder')} />
        </label>

        <div className="agenda-quick-tabs" role="tablist" aria-label={t('account.agenda.quickViewsLabel')}>
          {quickViews.map((option) => (
            <button key={option.value} type="button" className={quickView === option.value ? 'is-active' : ''} aria-pressed={quickView === option.value} onClick={() => { setQuickView(option.value); if (option.value === 'overdue') setStatus('active'); setNextCursor(null); }}>
              {t(option.labelKey)}
            </button>
          ))}
        </div>
        <div className="agenda-status-tabs" role="tablist" aria-label={t('account.agenda.statusFiltersLabel')}>
          {statusFilters.map((option) => (
            <button key={option.value} type="button" className={status === option.value ? 'is-active' : ''} aria-pressed={status === option.value} onClick={() => { setStatus(option.value); setNextCursor(null); }}>
              {t(option.labelKey)}
            </button>
          ))}
        </div>
        <div className="agenda-type-tabs" role="tablist" aria-label={t('account.agenda.filtersLabel')}>
          {agendaTypes.map((tab) => (
            <button key={tab.value} type="button" className={filter === tab.value ? 'is-active' : ''} aria-pressed={filter === tab.value} onClick={() => { setFilter(tab.value); setNextCursor(null); }}>
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </section>

      {editorMode ? (
        <form className="agenda-editor" onSubmit={(event) => { void saveAgendaItem(event); }}>
          <div className="agenda-editor__header">
            <span className="semantic-badge instruction">{t('account.agenda.editor.badge')}</span>
            <h3>{editorTitle}</h3>
            <p>{t('account.agenda.editor.body')}</p>
          </div>
          <label>
            <span>{t('account.agenda.editor.titleLabel')}</span>
            <input value={editor.title} maxLength={AGENDA_ITEM_TITLE_MAX_LENGTH} onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))} placeholder={t('account.agenda.editor.titlePlaceholder')} />
          </label>
          {titleError ? <p className="field-error">{titleError}</p> : null}
          <label>
            <span>{t('account.agenda.editor.typeLabel')}</span>
            <select value={editor.itemType} onChange={(event) => setEditor((current) => ({ ...current, itemType: event.target.value as AgendaItemType }))}>
              {editableTypes.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
            </select>
          </label>
          <div className="agenda-editor__time-grid">
            <label>
              <span>{t('account.agenda.editor.startLabel')}</span>
              <input type="datetime-local" value={editor.startAt} onChange={(event) => setEditor((current) => ({ ...current, startAt: event.target.value }))} />
            </label>
            <label>
              <span>{t('account.agenda.editor.endLabel')}</span>
              <input type="datetime-local" value={editor.endAt} onChange={(event) => setEditor((current) => ({ ...current, endAt: event.target.value }))} />
            </label>
          </div>
          {dateError ? <p className="field-error">{dateError}</p> : null}
          <label className="agenda-editor__checkbox">
            <input type="checkbox" checked={editor.allDay} onChange={(event) => setEditor((current) => ({ ...current, allDay: event.target.checked }))} />
            <span>{t('account.agenda.editor.allDayLabel')}</span>
          </label>
          {editorMode === 'edit' ? (
            <label>
              <span>{t('account.agenda.editor.statusLabel')}</span>
              <select value={editor.status} onChange={(event) => setEditor((current) => ({ ...current, status: event.target.value as AgendaItemStatus }))}>
                {statusFilters.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
              </select>
            </label>
          ) : null}
          <label>
            <span>{t('account.agenda.editor.noteLabel')}</span>
            <textarea value={editor.note} maxLength={AGENDA_ITEM_NOTE_MAX_LENGTH} rows={4} onChange={(event) => setEditor((current) => ({ ...current, note: event.target.value }))} placeholder={t('account.agenda.editor.notePlaceholder')} />
          </label>
          <p className="agenda-editor__privacy-note">{t('account.agenda.editor.privacyNote')}</p>
          <div className="agenda-editor__actions">
            <button type="button" className="button secondary" onClick={closeEditor}>{t('common.actions.cancel')}</button>
            <button type="submit" className="button primary" disabled={saving}>{saving ? t('common.states.saving') : t('common.actions.save')}</button>
          </div>
        </form>
      ) : null}

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <section className="mobile-card mobile-card--soft"><p>{t('account.agenda.loading')}</p></section>
      ) : !hasItems ? (
        <section className="agenda-empty-state">
          <WebIcon name="calendar" size={34} decorative />
          <h3>{t(hasCustomFilters ? 'account.agenda.noResultsTitle' : 'account.agenda.emptyTitle')}</h3>
          <p>{t(hasCustomFilters ? 'account.agenda.noResultsBody' : 'account.agenda.emptyBody')}</p>
          <button type="button" className="button primary" onClick={openCreateEditor}>{t('account.agenda.create')}</button>
        </section>
      ) : (
        <div className="agenda-layout">
          <aside className="agenda-day-drawer">
            <span className="semantic-badge instruction">{t('account.agenda.todayTitle')}</span>
            <h3>{formatDateTime(new Date().toISOString(), language)}</h3>
            {todayItems.length ? (
              <div className="agenda-mini-list">
                {todayItems.slice(0, 4).map((item) => (
                  <button key={item.id} type="button" onClick={() => openEditEditor(item)}>
                    <span className={agendaTypeClass(item.itemType)}>{t(`account.agenda.types.${item.itemType}`)}</span>
                    <strong>{item.title}</strong>
                  </button>
                ))}
              </div>
            ) : <p>{t('account.agenda.noTodayItems')}</p>}
          </aside>

          <div className="agenda-list" aria-label={t('account.agenda.listLabel')}>
            {groupedEntries.map(([day, dayItems]) => (
              <section key={day} className="agenda-day-section">
                <h3>{formatDateTime(dayItems[0]?.startAt, language)}</h3>
                <div className="agenda-day-section__items">
                  {dayItems.map((item) => {
                    const href = agendaItemHref(item);
                    return (
                      <article key={item.id} className={`agenda-item-card agenda-item-card--${item.itemType} agenda-item-card--${item.status}${isOverdueItem(item) ? ' agenda-item-card--overdue' : ''}`}>
                        <div className="agenda-item-card__main">
                          <div className="agenda-item-card__badges">
                            <span className={agendaTypeClass(item.itemType)}>{t(`account.agenda.types.${item.itemType}`)}</span>
                            <span className={agendaStatusClass(item.status)}>{t(`account.agenda.statuses.${item.status}`)}</span>
                            {isOverdueItem(item) ? <span className="semantic-badge danger">{t('account.agenda.overdue')}</span> : null}
                          </div>
                          <h4>{item.title}</h4>
                          {item.note ? <p>{item.note}</p> : <p>{t('account.agenda.noNote')}</p>}
                          <div className="agenda-item-card__meta">
                            <span>{item.allDay ? t('account.agenda.allDay') : formatDateTime(item.startAt, language)}</span>
                            {item.endAt ? <span>{t('account.agenda.endsAt', { date: formatDateTime(item.endAt, language) })}</span> : null}
                            <span>{sourceLabel(item, t)}</span>
                            <span>{t('account.agenda.privateMeta')}</span>
                          </div>
                        </div>
                        <div className="agenda-item-card__actions">
                          {href ? <Link href={href} className="button secondary">{t('common.actions.open')}</Link> : null}
                          <button type="button" className="button secondary" onClick={() => openEditEditor(item)}>{t('common.actions.edit')}</button>
                          <button type="button" className="button secondary" disabled={exportingId === item.id} onClick={() => { void exportAgendaItem(item); }}>{exportingId === item.id ? t('account.agenda.export.exporting') : t('account.agenda.export.item')}</button>
                          <button type="button" className="button secondary" onClick={() => openGoogleCalendar(item)}>{t('account.agenda.export.google')}</button>
                          {item.status === 'active' ? (
                            <button type="button" className="ghost-button" disabled={deletingId === item.id} onClick={() => { void updateItemStatus(item, 'done'); }}>
                              {deletingId === item.id ? t('common.states.working') : t('account.agenda.markDone')}
                            </button>
                          ) : null}
                          <button type="button" className="ghost-button danger" disabled={deletingId === item.id} onClick={() => { void deleteAgendaItem(item); }}>
                            {deletingId === item.id ? t('common.states.working') : t('common.actions.remove')}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {nextCursor ? (
        <button type="button" className="button secondary full" disabled={loadingMore} onClick={() => { void load({ append: true, cursor: nextCursor }); }}>
          {loadingMore ? t('common.states.loading') : t('account.agenda.loadMore')}
        </button>
      ) : null}
    </div>
  );
}
