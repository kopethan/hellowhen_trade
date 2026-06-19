import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AgendaItemDto, AgendaItemStatus, AgendaItemType, PlusSubscriptionSnapshotResponse } from '@hellowhen/contracts';
import { AppCard } from '../../components/AppCard';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppSelect } from '../../components/AppSelect';
import { AppText } from '../../components/AppText';
import { DetailEmptyState } from '../../components/detail';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge, toneForKind } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { formatMobilePlusMonthlyPrice, getMobilePlusGate } from '../../lib/plusGate';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { KEYBOARD_DONE_ACCESSORY_ID } from '../../components/KeyboardDoneAccessory';

type AgendaScreenProps = NativeStackScreenProps<RootStackParamList, 'Agenda'>;
type AgendaFilter = 'all' | AgendaItemType;
type AgendaEditorMode = 'create' | 'edit';
type AgendaQuickView = 'all' | 'today' | 'this_week' | 'overdue';

type AgendaEditorState = {
  mode: AgendaEditorMode;
  item: AgendaItemDto | null;
  title: string;
  itemType: AgendaItemType;
  status: AgendaItemStatus;
  date: string;
  time: string;
  endTime: string;
  allDay: boolean;
  note: string;
};

const agendaTypes: AgendaItemType[] = ['reminder', 'trade', 'need', 'offer', 'proposal', 'deal', 'person'];
const agendaStatuses: AgendaItemStatus[] = ['active', 'done', 'cancelled'];
const agendaFilters: AgendaFilter[] = ['all', ...agendaTypes];
const agendaQuickViews: AgendaQuickView[] = ['all', 'today', 'this_week', 'overdue'];
const WEEK_DAY_COUNT = 7;

function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function endOfDay(date: Date) {
  const end = startOfDay(date);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateInputFromDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeInputFromDate(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultTimeInput() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return timeInputFromDate(date);
}

function parseLocalDateTime(dateInput: string, timeInput: string, allDay: boolean) {
  const dateMatch = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;
  const [, year, month, day] = dateMatch;
  const time = allDay ? '00:00' : timeInput.trim();
  const timeMatch = time.match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch) return null;
  const [, hour, minute] = timeMatch;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(date);
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
}

function formatDayNumber(date: Date) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(date);
}

function formatSelectedDay(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

function formatItemTime(item: AgendaItemDto, allDayLabel: string) {
  const start = new Date(item.startAt);
  if (Number.isNaN(start.getTime())) return item.startAt;
  if (item.allDay) return allDayLabel;
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(start);
}

function formatItemDateTime(item: AgendaItemDto) {
  const start = new Date(item.startAt);
  if (Number.isNaN(start.getTime())) return item.startAt;
  if (item.allDay) return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(start);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(start);
}

function itemTone(item: AgendaItemDto) {
  if (item.itemType === 'reminder') return 'instruction' as const;
  if (item.itemType === 'person') return 'proposal' as const;
  return toneForKind(item.itemType);
}

function itemIcon(itemType: AgendaItemType): MobileIconName {
  if (itemType === 'need') return 'need';
  if (itemType === 'offer') return 'offer';
  if (itemType === 'trade') return 'trade';
  if (itemType === 'proposal' || itemType === 'deal') return 'proposal';
  if (itemType === 'person') return 'profile';
  return 'bell';
}

function isOverdueItem(item: AgendaItemDto) {
  if (item.status !== 'active') return false;
  const start = new Date(item.startAt);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() < startOfDay(new Date()).getTime();
}

function agendaQuickViewRange(view: AgendaQuickView) {
  const todayStart = startOfDay(new Date());
  if (view === 'today') return { from: todayStart.toISOString(), to: endOfDay(todayStart).toISOString() };
  if (view === 'this_week') return { from: todayStart.toISOString(), to: endOfDay(addDays(todayStart, 6)).toISOString() };
  if (view === 'overdue') {
    const beforeToday = new Date(todayStart);
    beforeToday.setMilliseconds(beforeToday.getMilliseconds() - 1);
    return { from: undefined, to: beforeToday.toISOString() };
  }
  return { from: undefined, to: undefined };
}

function quickViewLabelKey(value: AgendaQuickView) {
  if (value === 'today') return 'account.agenda.quickViews.today';
  if (value === 'this_week') return 'account.agenda.quickViews.thisWeek';
  if (value === 'overdue') return 'account.agenda.quickViews.overdue';
  return 'account.agenda.quickViews.all';
}

function editorFromItem(item: AgendaItemDto): AgendaEditorState {
  const start = new Date(item.startAt);
  const end = item.endAt ? new Date(item.endAt) : null;
  const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
  return {
    mode: 'edit',
    item,
    title: item.title,
    itemType: item.itemType,
    status: item.status,
    date: dateInputFromDate(safeStart),
    time: item.allDay ? '' : timeInputFromDate(safeStart),
    endTime: end && !Number.isNaN(end.getTime()) ? timeInputFromDate(end) : '',
    allDay: item.allDay,
    note: item.note ?? '',
  };
}

function emptyEditorForDate(date: Date): AgendaEditorState {
  return {
    mode: 'create',
    item: null,
    title: '',
    itemType: 'reminder',
    status: 'active',
    date: dateInputFromDate(date),
    time: defaultTimeInput(),
    endTime: '',
    allDay: false,
    note: '',
  };
}

export function AgendaScreen({ navigation }: AgendaScreenProps) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [items, setItems] = useState<AgendaItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [filter, setFilter] = useState<AgendaFilter>('all');
  const [status, setStatus] = useState<AgendaItemStatus>('active');
  const [quickView, setQuickView] = useState<AgendaQuickView>('all');
  const [search, setSearch] = useState('');
  const [plusSnapshot, setPlusSnapshot] = useState<PlusSubscriptionSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(betaFeatures.agendaEnabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editor, setEditor] = useState<AgendaEditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgendaItemDto | null>(null);

  const plusGate = useMemo(() => getMobilePlusGate(plusSnapshot), [plusSnapshot]);
  const canUseAgenda = betaFeatures.agendaEnabled && plusGate.hasPlusAccess;

  const visibleItems = useMemo(() => items.filter((item) => filter === 'all' || item.itemType === filter), [filter, items]);
  const selectedDayItems = useMemo(
    () => visibleItems.filter((item) => sameDay(new Date(item.startAt), selectedDate)),
    [selectedDate, visibleItems],
  );
  const overdueItems = useMemo(() => visibleItems.filter(isOverdueItem), [visibleItems]);
  const primaryItems = quickView === 'overdue' ? overdueItems : selectedDayItems;
  const upcomingItems = useMemo(() => {
    if (quickView === 'overdue') return [];
    const selectedStart = startOfDay(selectedDate).getTime();
    return visibleItems.filter((item) => startOfDay(new Date(item.startAt)).getTime() > selectedStart).slice(0, 8);
  }, [quickView, selectedDate, visibleItems]);
  const weekDays = useMemo(() => {
    const start = startOfDay(new Date());
    return Array.from({ length: WEEK_DAY_COUNT }, (_, index) => addDays(start, index));
  }, []);

  const load = useCallback(async ({ append = false, cursor }: { append?: boolean; cursor?: string } = {}) => {
    if (!betaFeatures.agendaEnabled) return;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);

    try {
      const range = agendaQuickViewRange(quickView);
      const query = search.trim();
      const [agendaResponse, plusResponse] = await Promise.all([
        api.agenda.list({
          take: 80,
          status,
          ...(filter !== 'all' ? { itemType: filter } : {}),
          ...(range.from ? { from: range.from } : {}),
          ...(range.to ? { to: range.to } : {}),
          ...(query ? { q: query } : {}),
          ...(cursor ? { cursor } : {}),
        }),
        api.plus.me().catch(() => null),
      ]);
      if (plusResponse) setPlusSnapshot(plusResponse);
      setItems((current) => append ? [...current, ...(agendaResponse.items ?? [])] : (agendaResponse.items ?? []));
      setNextCursor(agendaResponse.nextCursor ?? null);
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.loadError')));
      if (!append) {
        setItems([]);
        setNextCursor(null);
      }
      try {
        const response = await api.plus.me();
        setPlusSnapshot(response);
      } catch {
        // Keep the API error visible; the Agenda API is still the source of truth.
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, quickView, search, status, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function openCreate() {
    setEditorError(null);
    setEditor(emptyEditorForDate(selectedDate));
  }

  function openEdit(item: AgendaItemDto) {
    setEditorError(null);
    setEditor(editorFromItem(item));
  }

  function openLinkedItem(item: AgendaItemDto) {
    if (!item.sourceId || item.sourceType === 'custom' || item.sourceType === 'saved_item') return;
    if (item.sourceType === 'trade') navigation.navigate('TradeDetail', { tradeId: item.sourceId, title: item.title });
    else if (item.sourceType === 'need') navigation.navigate('NeedDetail', { needId: item.sourceId, title: item.title });
    else if (item.sourceType === 'offer') navigation.navigate('OfferDetail', { offerId: item.sourceId, title: item.title });
    else if (item.sourceType === 'proposal') navigation.navigate('ProposalDetail', { proposalId: item.sourceId });
    else if (item.sourceType === 'user') navigation.navigate('UserProfile', { userId: item.sourceId, displayName: item.title });
  }

  async function saveEditor() {
    if (!editor) return;
    const title = editor.title.trim();
    if (!title) {
      setEditorError(t('account.agenda.editor.titleRequired'));
      return;
    }

    const start = parseLocalDateTime(editor.date, editor.time || '00:00', editor.allDay);
    if (!start) {
      setEditorError(t('account.agenda.editor.startRequired'));
      return;
    }

    const end = editor.endTime.trim() ? parseLocalDateTime(editor.date, editor.endTime, false) : null;
    if (end && end.getTime() < start.getTime()) {
      setEditorError(t('account.agenda.editor.endAfterStart'));
      return;
    }

    setBusyAction('editor-save');
    setEditorError(null);
    setError(null);
    try {
      if (editor.mode === 'edit' && editor.item) {
        const response = await api.agenda.update(editor.item.id, {
          title,
          itemType: editor.itemType,
          status: editor.status,
          note: editor.note.trim() || null,
          startAt: start.toISOString(),
          endAt: end ? end.toISOString() : null,
          allDay: editor.allDay,
          timezone: getTimezone(),
        });
        setItems((current) => current.map((item) => (item.id === response.item.id ? response.item : item)));
        setMessage(t('account.agenda.updated', { title: response.item.title }));
      } else {
        const response = await api.agenda.create({
          sourceType: 'custom',
          itemType: editor.itemType,
          title,
          note: editor.note.trim() || null,
          startAt: start.toISOString(),
          endAt: end ? end.toISOString() : null,
          allDay: editor.allDay,
          timezone: getTimezone(),
        });
        setItems((current) => [response.item, ...current].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
        setMessage(t('account.agenda.created', { title: response.item.title }));
      }
      setEditor(null);
    } catch (cause) {
      setEditorError(getFriendlyApiErrorMessage(cause, t('account.agenda.saveError')));
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteItem(item: AgendaItemDto) {
    setBusyAction(`delete-${item.id}`);
    setError(null);
    try {
      await api.agenda.remove(item.id);
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setDeleteTarget(null);
      setEditor((current) => current?.item?.id === item.id ? null : current);
      setMessage(t('account.agenda.deleted', { title: item.title }));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.deleteError')));
    } finally {
      setBusyAction(null);
    }
  }

  async function markDone(item: AgendaItemDto) {
    setBusyAction(`done-${item.id}`);
    setError(null);
    try {
      const response = await api.agenda.update(item.id, { status: 'done' });
      setItems((current) => current.map((currentItem) => (currentItem.id === response.item.id ? response.item : currentItem)));
      setMessage(t('account.agenda.statusUpdated', { title: response.item.title }));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.saveError')));
    } finally {
      setBusyAction(null);
    }
  }

  const header = (
    <AppHeader
      title={t('account.agenda.title')}
      onBack={() => navigation.goBack()}
      rightSlot={canUseAgenda ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('account.agenda.create')} onPress={openCreate} style={({ pressed }) => [styles.headerAddButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
          <MobileIcon name="add" size={20} color={theme.color.background} />
        </Pressable>
      ) : null}
    />
  );

  if (!betaFeatures.agendaEnabled) {
    return (
      <AppFixedHeaderScreen header={header}>
        <View style={styles.content}>
          <DetailEmptyState icon="bell" title={t('account.agenda.disabledTitle')} body={t('account.agenda.disabledBody')} />
        </View>
      </AppFixedHeaderScreen>
    );
  }

  if (!canUseAgenda && !loading) {
    return (
      <AppFixedHeaderScreen header={header}>
        <View style={styles.content}>
          <AppCard style={[styles.lockedCard, { backgroundColor: theme.color.subtleSurface }]}>
            <SemanticBadge label={t('account.agenda.plus.badge')} tone="instruction" />
            <AppText style={styles.lockedTitle}>{t('account.agenda.plus.title')}</AppText>
            <AppText style={[styles.lockedBody, { color: theme.color.muted }]}>{t('account.agenda.plus.body', { price: formatMobilePlusMonthlyPrice(plusGate) })}</AppText>
            {betaFeatures.plusSubscriptionFeatures.plusPublic ? (
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('ProPlans')} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
                <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{t('account.agenda.plus.action')}</AppText>
              </Pressable>
            ) : (
              <InfoNotice tone="warning" body={t('account.agenda.plus.comingSoon')} />
            )}
          </AppCard>
        </View>
      </AppFixedHeaderScreen>
    );
  }

  return (
    <AppFixedHeaderScreen header={header}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}>
        <View style={styles.hero}>
          <View style={styles.badgeRow}>
            <SemanticBadge label={t('account.agenda.privateBadge')} tone="proposal" />
            <SemanticBadge label={t('account.agenda.plus.badge')} tone="instruction" />
          </View>
          <AppText style={styles.title}>{t('account.agenda.title')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.agenda.body')}</AppText>
        </View>

        <AppCard style={[styles.summaryCard, { backgroundColor: theme.color.subtleSurface }]}>
          <View style={[styles.summaryIcon, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <MobileIcon name="bell" size={22} color={theme.semantic.proposal.text} />
          </View>
          <View style={styles.summaryCopy}>
            <AppText style={styles.summaryTitle}>{t('account.agenda.summaryTitle')}</AppText>
            <AppText style={[styles.summaryBody, { color: theme.color.muted }]}>{t('account.agenda.summaryBody')}</AppText>
          </View>
        </AppCard>

        {error ? <InfoNotice tone="warning" body={error} /> : null}
        {message ? <InfoNotice tone="success" body={message} /> : null}

        <View style={[styles.weekPanel, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <View style={styles.weekHeader}>
            <View>
              <AppText style={styles.weekTitle}>{formatMonthYear(selectedDate)}</AppText>
              <AppText style={[styles.weekBody, { color: theme.color.muted }]}>{formatSelectedDay(selectedDate)}</AppText>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setSelectedDate(startOfDay(new Date()))} style={({ pressed }) => [styles.todayButton, { borderColor: theme.color.border }, pressed && styles.pressed]}>
              <AppText style={[styles.todayButtonText, { color: theme.color.text }]}>{t('account.agenda.todayTitle')}</AppText>
            </Pressable>
          </View>
          <View style={styles.weekStrip}>
            {weekDays.map((day) => {
              const active = sameDay(day, selectedDate);
              const hasItem = visibleItems.some((item) => sameDay(new Date(item.startAt), day));
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={day.toISOString()}
                  onPress={() => setSelectedDate(startOfDay(day))}
                  style={({ pressed }) => [
                    styles.dayChip,
                    { backgroundColor: active ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: active ? theme.semantic.proposal.border : theme.color.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText style={[styles.dayName, { color: active ? theme.semantic.proposal.text : theme.color.muted }]}>{formatDayLabel(day)}</AppText>
                  <AppText style={[styles.dayNumber, { color: active ? theme.semantic.proposal.text : theme.color.text }]}>{formatDayNumber(day)}</AppText>
                  {hasItem ? <View style={[styles.dayDot, { backgroundColor: active ? theme.semantic.proposal.text : theme.color.muted }]} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.searchBox}>
          <AppText style={styles.fieldLabel}>{t('account.agenda.searchLabel')}</AppText>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('account.agenda.searchPlaceholder')}
            placeholderTextColor={theme.color.muted}
            returnKeyType="search"
            inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                      blurOnSubmit={true}
                      style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]}
          />
        </View>

        <FilterChips active={quickView} values={agendaQuickViews} labelForValue={(value) => t(quickViewLabelKey(value))} onChange={(value) => { setQuickView(value); if (value === 'overdue') setStatus('active'); }} />
        <FilterChips active={filter} values={agendaFilters} labelForValue={(value) => value === 'all' ? t('account.agenda.filters.all') : t(`account.agenda.types.${value}`)} onChange={setFilter} />
        <FilterChips active={status} values={agendaStatuses} labelForValue={(value) => t(`account.agenda.statuses.${value}`)} onChange={setStatus} />

        <View style={styles.sectionHeaderRow}>
          <View>
            <AppText style={styles.sectionTitle}>{quickView === 'overdue' ? t('account.agenda.quickViews.overdue') : t('account.agenda.todayTitle')}</AppText>
            <AppText style={[styles.sectionBody, { color: theme.color.muted }]}>{quickView === 'overdue' ? t('account.agenda.overdueSummary', { count: primaryItems.length }) : t('account.agenda.todaySummary', { count: primaryItems.length })}</AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={openCreate} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.color.border }, pressed && styles.pressed]}>
            <MobileIcon name="add" size={15} color={theme.color.text} />
            <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{t('account.agenda.create')}</AppText>
          </Pressable>
        </View>

        {loading && items.length === 0 ? (
          <View style={styles.loadingBox}><ActivityIndicator color={theme.color.text} /><AppText style={[styles.loadingText, { color: theme.color.muted }]}>{t('account.agenda.loading')}</AppText></View>
        ) : primaryItems.length === 0 ? (
          <DetailEmptyState icon="bell" title={t(search.trim() || quickView !== 'all' || filter !== 'all' || status !== 'active' ? 'account.agenda.noResultsTitle' : 'account.agenda.noTodayItems')} body={t(search.trim() || quickView !== 'all' || filter !== 'all' || status !== 'active' ? 'account.agenda.noResultsBody' : 'account.agenda.emptyBody')} actionLabel={t('account.agenda.create')} onAction={openCreate} />
        ) : (
          <View style={styles.itemList}>
            {primaryItems.map((item) => (
              <AgendaItemCard key={item.id} item={item} busyAction={busyAction} onDelete={() => setDeleteTarget(item)} onDone={() => { void markDone(item); }} onEdit={() => openEdit(item)} onOpen={() => openLinkedItem(item)} />
            ))}
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <View>
            <AppText style={styles.sectionTitle}>{t('account.agenda.upcomingTitle')}</AppText>
            <AppText style={[styles.sectionBody, { color: theme.color.muted }]}>{t('account.agenda.listLabel')}</AppText>
          </View>
        </View>

        {upcomingItems.length === 0 ? (
          <AppText style={[styles.emptyInline, { color: theme.color.muted }]}>{t('account.agenda.noUpcomingItems')}</AppText>
        ) : (
          <View style={styles.itemList}>
            {upcomingItems.map((item) => (
              <AgendaItemCard key={item.id} item={item} compact busyAction={busyAction} onDelete={() => setDeleteTarget(item)} onDone={() => { void markDone(item); }} onEdit={() => openEdit(item)} onOpen={() => openLinkedItem(item)} />
            ))}
          </View>
        )}

        {nextCursor ? (
          <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => { void load({ append: true, cursor: nextCursor }); }} style={({ pressed }) => [styles.loadMoreButton, { borderColor: theme.color.border }, (pressed || loadingMore) && styles.pressed]}>
            {loadingMore ? <ActivityIndicator color={theme.color.text} /> : <AppText style={[styles.loadMoreText, { color: theme.color.text }]}>{t('account.agenda.loadMore')}</AppText>}
          </Pressable>
        ) : null}
      </ScrollView>

      <AgendaEditorModal
        busy={busyAction === 'editor-save'}
        error={editorError}
        state={editor}
        onChange={(next) => setEditor(next)}
        onClose={() => { setEditor(null); setEditorError(null); }}
        onSave={() => { void saveEditor(); }}
      />

      <AppConfirmSheet
        visible={Boolean(deleteTarget)}
        title={deleteTarget ? t('account.agenda.confirmDelete', { title: deleteTarget.title }) : t('common.actions.remove')}
        body={t('account.agenda.editor.privacyNote')}
        cancelLabel={t('common.actions.cancel')}
        confirmLabel={t('common.actions.remove')}
        tone="danger"
        confirmDisabled={Boolean(deleteTarget && busyAction === `delete-${deleteTarget.id}`)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) void deleteItem(deleteTarget); }}
      />
    </AppFixedHeaderScreen>
  );
}

function FilterChips<TValue extends string>({ active, labelForValue, onChange, values }: { active: TValue; values: TValue[]; labelForValue: (value: TValue) => string; onChange: (value: TValue) => void }) {
  const theme = useThemeTokens();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {values.map((value) => {
        const selected = active === value;
        return (
          <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(value)} style={({ pressed }) => [styles.filterChip, { backgroundColor: selected ? theme.semantic.proposal.softBg : theme.color.surface, borderColor: selected ? theme.semantic.proposal.border : theme.color.border }, pressed && styles.pressed]}>
            <AppText style={[styles.filterChipText, { color: selected ? theme.semantic.proposal.text : theme.color.text }]}>{labelForValue(value)}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function AgendaItemCard({ busyAction, compact, item, onDelete, onDone, onEdit, onOpen }: { busyAction: string | null; compact?: boolean; item: AgendaItemDto; onDelete: () => void; onDone: () => void; onEdit: () => void; onOpen: () => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const tone = itemTone(item);
  const semantic = theme.semantic[tone];
  const canOpen = Boolean(item.sourceId && ['trade', 'need', 'offer', 'proposal', 'user'].includes(item.sourceType));
  const doneBusy = busyAction === `done-${item.id}`;
  const overdue = isOverdueItem(item);

  return (
    <View style={[styles.itemCard, compact && styles.itemCardCompact, overdue && styles.itemCardOverdue, item.status !== 'active' && styles.itemCardInactive, { backgroundColor: overdue ? theme.semantic.danger.softBg : theme.color.surface, borderColor: overdue ? theme.semantic.danger.border : theme.color.border }]}>
      <View style={styles.itemTopRow}>
        <View style={[styles.itemIcon, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}>
          <MobileIcon name={itemIcon(item.itemType)} size={18} color={semantic.text} />
        </View>
        <View style={styles.itemCopy}>
          <View style={styles.itemBadgeRow}>
            <SemanticBadge label={t(`account.agenda.types.${item.itemType}`)} tone={tone} size="sm" />
            <SemanticBadge label={t(`account.agenda.statuses.${item.status}`)} tone={item.status === 'active' ? 'success' : item.status === 'done' ? 'info' : 'warning'} size="sm" />
            {overdue ? <SemanticBadge label={t('account.agenda.overdue')} tone="warning" size="sm" /> : null}
          </View>
          <AppText style={styles.itemTitle} numberOfLines={2}>{item.title}</AppText>
          <AppText style={[styles.itemMeta, { color: theme.color.muted }]}>{formatItemDateTime(item)} · {t(`account.agenda.sourceLabels.${item.sourceType}`)} · {t('account.agenda.privateMeta')}</AppText>
        </View>
        <AppText style={[styles.itemTime, { color: semantic.text }]}>{formatItemTime(item, t('account.agenda.allDay'))}</AppText>
      </View>
      {item.note ? <AppText style={[styles.itemNote, { color: theme.color.muted }]} numberOfLines={compact ? 2 : 4}>{item.note}</AppText> : null}
      <View style={styles.itemActions}>
        {canOpen ? <SmallAction label={t('account.agenda.openLinkedItem')} onPress={onOpen} /> : null}
        <SmallAction label={t('common.actions.edit')} onPress={onEdit} />
        {item.status === 'active' ? <SmallAction label={doneBusy ? t('common.states.saving') : t('account.agenda.markDone')} disabled={doneBusy} onPress={onDone} /> : null}
        <SmallAction label={t('common.actions.remove')} danger onPress={onDelete} />
      </View>
    </View>
  );
}

function SmallAction({ danger, disabled, label, onPress }: { danger?: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.smallAction, { backgroundColor: danger ? theme.semantic.danger.softBg : theme.color.subtleSurface, borderColor: danger ? theme.semantic.danger.border : theme.color.border }, (pressed || disabled) && styles.pressed]}>
      <AppText style={[styles.smallActionText, { color: danger ? theme.semantic.danger.text : theme.color.text }]}>{label}</AppText>
    </Pressable>
  );
}

function AgendaEditorModal({ busy, error, onChange, onClose, onSave, state }: { busy: boolean; error: string | null; state: AgendaEditorState | null; onChange: (state: AgendaEditorState) => void; onClose: () => void; onSave: () => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  if (!state) return null;

  const typeOptions = agendaTypes.map((value) => ({ value, label: t(`account.agenda.types.${value}`) }));
  const statusOptions = agendaStatuses.map((value) => ({ value, label: t(`account.agenda.statuses.${value}`) }));

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalTapArea}>
          <Pressable accessibilityRole="menu" onPress={(event) => event.stopPropagation()} style={[styles.modalSheet, { backgroundColor: theme.color.elevated, borderColor: theme.color.border }]}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <SemanticBadge label={t('account.agenda.editor.badge')} tone="proposal" />
                <AppText style={styles.modalTitle}>{state.mode === 'edit' ? t('account.agenda.editor.editTitle') : t('account.agenda.editor.createTitle')}</AppText>
                <AppText style={[styles.modalBody, { color: theme.color.muted }]}>{t('account.agenda.editor.body')}</AppText>
              </View>

              <View style={styles.formFields}>
                <View style={styles.fieldGroup}>
                  <AppText style={styles.fieldLabel}>{t('account.agenda.editor.titleLabel')}</AppText>
                  <TextInput value={state.title} onChangeText={(title) => onChange({ ...state, title })} maxLength={120} placeholder={t('account.agenda.editor.titlePlaceholder')} placeholderTextColor={theme.color.muted} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="done" blurOnSubmit={true} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
                </View>

                <AppSelect label={t('account.agenda.editor.typeLabel')} value={state.itemType} options={typeOptions} onSelect={(value) => onChange({ ...state, itemType: value as AgendaItemType })} />
                {state.mode === 'edit' ? <AppSelect label={t('account.agenda.editor.statusLabel')} value={state.status} options={statusOptions} onSelect={(value) => onChange({ ...state, status: value as AgendaItemStatus })} /> : null}

                <View style={styles.inlineFields}>
                  <View style={styles.inlineField}>
                    <AppText style={styles.fieldLabel}>{t('account.agenda.editor.startLabel')}</AppText>
                    <TextInput value={state.date} onChangeText={(date) => onChange({ ...state, date })} placeholder={t('account.agenda.datePlaceholder')} placeholderTextColor={theme.color.muted} keyboardType="numbers-and-punctuation" inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="done" blurOnSubmit={true} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
                  </View>
                  <View style={styles.inlineField}>
                    <AppText style={styles.fieldLabel}>{t('account.agenda.timePlaceholder')}</AppText>
                    <TextInput value={state.time} onChangeText={(time) => onChange({ ...state, time })} editable={!state.allDay} placeholder="09:00" placeholderTextColor={theme.color.muted} keyboardType="numbers-and-punctuation" inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="done" blurOnSubmit={true} style={[styles.input, state.allDay && styles.disabledInput, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
                  </View>
                </View>

                <View style={styles.inlineFields}>
                  <Pressable accessibilityRole="switch" accessibilityState={{ checked: state.allDay }} onPress={() => onChange({ ...state, allDay: !state.allDay, time: state.allDay ? defaultTimeInput() : '' })} style={({ pressed }) => [styles.toggleRow, { backgroundColor: state.allDay ? theme.semantic.proposal.softBg : theme.color.surface, borderColor: state.allDay ? theme.semantic.proposal.border : theme.color.border }, pressed && styles.pressed]}>
                    <AppText style={[styles.toggleText, { color: state.allDay ? theme.semantic.proposal.text : theme.color.text }]}>{t('account.agenda.editor.allDayLabel')}</AppText>
                    <AppText style={[styles.toggleValue, { color: state.allDay ? theme.semantic.proposal.text : theme.color.muted }]}>{state.allDay ? t('common.states.yes') : t('common.states.no')}</AppText>
                  </Pressable>
                  <View style={styles.inlineField}>
                    <AppText style={styles.fieldLabel}>{t('account.agenda.editor.endLabel')}</AppText>
                    <TextInput value={state.endTime} onChangeText={(endTime) => onChange({ ...state, endTime })} placeholder={t('account.agenda.optionalEndPlaceholder')} placeholderTextColor={theme.color.muted} keyboardType="numbers-and-punctuation" inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="done" blurOnSubmit={true} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <AppText style={styles.fieldLabel}>{t('account.agenda.editor.noteLabel')}</AppText>
                  <TextInput value={state.note} onChangeText={(note) => onChange({ ...state, note })} maxLength={2000} multiline textAlignVertical="top" placeholder={t('account.agenda.editor.notePlaceholder')} placeholderTextColor={theme.color.muted} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="default" blurOnSubmit={false} style={[styles.input, styles.textArea, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
                </View>
              </View>

              {error ? <InfoNotice tone="warning" body={error} /> : null}
              <InfoNotice tone="info" body={t('account.agenda.editor.privacyNote')} />
            </ScrollView>

            <View style={[styles.modalActions, { borderTopColor: theme.color.border }]}>
              <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.modalButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                <AppText style={[styles.modalButtonText, { color: theme.color.text }]}>{t('common.actions.cancel')}</AppText>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={onSave} style={({ pressed }) => [styles.modalButton, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, (pressed || busy) && styles.pressed]}>
                {busy ? <ActivityIndicator color={theme.semantic.proposal.text} /> : <AppText style={[styles.modalButtonText, { color: theme.semantic.proposal.text }]}>{t('common.actions.save')}</AppText>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  headerAddButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hero: { gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  summaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, gap: 4 },
  summaryTitle: { fontSize: 18, fontWeight: '900' },
  summaryBody: { lineHeight: 19, fontWeight: '700' },
  exportNote: { marginTop: 4, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  weekPanel: { borderRadius: 24, borderWidth: 1, padding: 13, gap: 13 },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  weekTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.25 },
  weekBody: { marginTop: 2, fontWeight: '800' },
  todayButton: { minHeight: 38, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  todayButtonText: { fontSize: 12, fontWeight: '900' },
  weekStrip: { flexDirection: 'row', gap: 7 },
  dayChip: { flex: 1, minHeight: 72, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7 },
  dayName: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  dayNumber: { fontSize: 18, fontWeight: '900' },
  dayDot: { width: 5, height: 5, borderRadius: 3 },
  filterRow: { gap: 8, paddingRight: 2 },
  searchBox: { gap: 7 },
  filterChip: { minHeight: 38, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  filterChipText: { fontSize: 12, fontWeight: '900' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.25 },
  sectionBody: { marginTop: 2, fontSize: 12, fontWeight: '800' },
  secondaryButton: { minHeight: 40, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  secondaryButtonText: { fontSize: 12, fontWeight: '900' },
  itemList: { gap: 10 },
  itemCard: { borderRadius: 22, borderWidth: 1, padding: 13, gap: 11 },
  itemCardCompact: { padding: 12, gap: 8 },
  itemCardOverdue: { borderStyle: 'solid' },
  itemCardInactive: { opacity: 0.76 },
  itemTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, gap: 5, minWidth: 0 },
  itemBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  itemTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  itemMeta: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  itemTime: { fontSize: 12, fontWeight: '900', marginTop: 3 },
  itemNote: { lineHeight: 19, fontWeight: '700' },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallAction: { minHeight: 34, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11 },
  smallActionText: { fontSize: 12, fontWeight: '900' },
  loadMoreButton: { minHeight: 46, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  loadMoreText: { fontWeight: '900' },
  loadingBox: { alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 28 },
  loadingText: { fontWeight: '800' },
  emptyInline: { textAlign: 'center', lineHeight: 20, fontWeight: '700', paddingVertical: 10 },
  lockedCard: { gap: 12 },
  lockedTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  lockedBody: { lineHeight: 20, fontWeight: '700' },
  primaryButton: { minHeight: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.58)' },
  modalTapArea: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  modalSheet: { maxHeight: '88%', borderRadius: 28, borderWidth: 1, overflow: 'hidden' },
  modalContent: { padding: 16, gap: 14 },
  modalHeader: { gap: 7 },
  modalTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  modalBody: { lineHeight: 20, fontWeight: '700' },
  formFields: { gap: 12 },
  fieldGroup: { gap: 7 },
  fieldLabel: { fontSize: 13, fontWeight: '900' },
  input: { minHeight: 50, borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, fontSize: 15, fontWeight: '700' },
  textArea: { minHeight: 94 },
  disabledInput: { opacity: 0.55 },
  inlineFields: { flexDirection: 'row', gap: 10 },
  inlineField: { flex: 1, gap: 7 },
  toggleRow: { flex: 1, minHeight: 50, borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toggleText: { fontSize: 13, fontWeight: '900' },
  toggleValue: { fontSize: 12, fontWeight: '900' },
  modalActions: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
  modalButton: { flex: 1, minHeight: 48, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  modalButtonText: { fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
