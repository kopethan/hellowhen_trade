import React, { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AgendaItemDto, AgendaItemSourceType, AgendaItemType } from '@hellowhen/contracts';
import { AGENDA_ITEM_NOTE_MAX_LENGTH, AGENDA_ITEM_TITLE_MAX_LENGTH } from '@hellowhen/contracts';
import { api } from '../lib/api';
import { betaFeatures } from '../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../lib/errors';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../providers/AuthProvider';
import { useTranslation } from '../providers/MobileI18nProvider';
import { useThemeTokens } from '../providers/ThemeProvider';
import { AppText } from './AppText';
import { MobileIcon } from './MobileIcon';
import { SemanticBadge, toneForKind } from './SemanticUI';
import { KEYBOARD_DONE_ACCESSORY_ID } from './KeyboardDoneAccessory';

type LinkedAgendaSourceType = Exclude<AgendaItemSourceType, 'custom'>;

type AddToAgendaButtonProps = {
  sourceType: LinkedAgendaSourceType;
  sourceId?: string | null;
  itemType: AgendaItemType;
  title?: string | null;
  note?: string | null;
  disabled?: boolean;
  hidden?: boolean;
  showLabel?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  onCreated?: (item: AgendaItemDto) => void;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function roundToNextHour(date = new Date()) {
  const rounded = new Date(date);
  rounded.setMinutes(0, 0, 0);
  if (rounded.getTime() <= date.getTime()) rounded.setHours(rounded.getHours() + 1);
  return rounded;
}

function dateInputFromDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeInputFromDate(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultDateInput() {
  return dateInputFromDate(roundToNextHour());
}

function defaultTimeInput() {
  return timeInputFromDate(roundToNextHour());
}

function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
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

function resetDateState() {
  return { date: defaultDateInput(), time: defaultTimeInput(), endTime: '', allDay: false };
}

export function AddToAgendaButton({
  sourceType,
  sourceId,
  itemType,
  title,
  note,
  disabled = false,
  hidden = false,
  showLabel = true,
  compact = false,
  style,
  onCreated,
}: AddToAgendaButtonProps) {
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => defaultDateInput());
  const [time, setTime] = useState(() => defaultTimeInput());
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [privateNote, setPrivateNote] = useState(note ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const timezone = useMemo(() => getTimezone(), []);

  if (hidden || !betaFeatures.agendaEnabled || !sourceId) return null;

  const label = t('account.agenda.add.button');
  const linkedSourceId = sourceId.trim();
  const sourceTitle = (title?.trim() || t('account.agenda.add.fallbackTitle')).slice(0, AGENDA_ITEM_TITLE_MAX_LENGTH);

  function openSheet() {
    if (disabled || saving) return;
    if (!auth.isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    const nextDate = resetDateState();
    setDate(nextDate.date);
    setTime(nextDate.time);
    setEndTime(nextDate.endTime);
    setAllDay(nextDate.allDay);
    setPrivateNote(note ?? '');
    setError(null);
    setDateError(null);
    setMessage(null);
    setOpen(true);
  }

  function closeSheet() {
    if (saving) return;
    setOpen(false);
    setError(null);
    setDateError(null);
  }

  async function addToAgenda() {
    const start = parseLocalDateTime(date, time, allDay);
    const end = !allDay && endTime.trim() ? parseLocalDateTime(date, endTime, false) : null;
    setDateError(null);
    setError(null);
    setMessage(null);

    if (!start) {
      setDateError(t('account.agenda.add.startRequired'));
      return;
    }
    if (end && end.getTime() < start.getTime()) {
      setDateError(t('account.agenda.add.endAfterStart'));
      return;
    }

    setSaving(true);
    try {
      const response = await api.agenda.create({
        sourceType,
        sourceId: linkedSourceId,
        itemType,
        title: sourceTitle,
        note: privateNote.trim() || null,
        startAt: start.toISOString(),
        endAt: end ? end.toISOString() : null,
        allDay,
        timezone,
      });
      setMessage(t('account.agenda.add.created', { title: response.item.title }));
      setOpen(false);
      onCreated?.(response.item);
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.add.saveError')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled || saving}
        onPress={openSheet}
                      style={({ pressed }) => [
          compact || !showLabel ? styles.iconButton : styles.button,
          { backgroundColor: compact || !showLabel ? theme.color.surface : theme.semantic.proposal.softBg, borderColor: compact || !showLabel ? theme.color.border : theme.semantic.proposal.border },
          pressed && !(disabled || saving) && styles.pressed,
          (disabled || saving) && styles.disabled,
          style,
        ]}
      >
        {saving ? <ActivityIndicator color={theme.semantic.proposal.text} size="small" /> : <MobileIcon name="calendar" size={showLabel ? 17 : 19} color={compact || !showLabel ? theme.color.text : theme.semantic.proposal.text} />}
        {showLabel ? <AppText style={[styles.buttonText, { color: theme.semantic.proposal.text }]}>{saving ? t('common.states.saving') : label}</AppText> : null}
      </Pressable>
      {message && showLabel ? <AppText style={[styles.inlineMessage, { color: theme.semantic.success.text }]}>{message}</AppText> : null}
      {error && !open && showLabel ? <AppText style={[styles.inlineMessage, { color: theme.semantic.danger.text }]}>{error}</AppText> : null}

      <Modal animationType="fade" onRequestClose={closeSheet} transparent visible={open}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" onPress={closeSheet} style={styles.modalTapArea}>
            <Pressable accessibilityRole="menu" onPress={(event) => event.stopPropagation()} style={[styles.sheet, { backgroundColor: theme.color.elevated, borderColor: theme.color.border }]}>
              <View style={styles.sheetHeader}>
                <SemanticBadge label={t('account.agenda.privateBadge')} tone="proposal" size="sm" />
                <AppText style={styles.sheetTitle}>{t('account.agenda.add.title')}</AppText>
                <AppText style={[styles.sheetBody, { color: theme.color.muted }]}>{t('account.agenda.add.body')}</AppText>
              </View>

              <View style={[styles.sourceBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
                <SemanticBadge label={t(`account.agenda.types.${itemType}`)} tone={itemType === 'reminder' || itemType === 'person' ? 'proposal' : toneForKind(itemType)} size="sm" />
                <AppText style={styles.sourceTitle} numberOfLines={2}>{sourceTitle}</AppText>
              </View>

              <View style={styles.formFields}>
                <View style={styles.fieldBlock}>
                  <AppText style={styles.fieldLabel}>{t('account.agenda.editor.startLabel')}</AppText>
                  <View style={styles.timeRow}>
                    <TextInput
                      value={date}
                      onChangeText={setDate}
                      placeholder={t('account.agenda.datePlaceholder')}
                      placeholderTextColor={theme.color.muted}
                      inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                      returnKeyType="done"
                      blurOnSubmit={true}
                      style={[styles.input, styles.dateInput, { backgroundColor: theme.color.surface, borderColor: dateError ? theme.semantic.danger.border : theme.color.border, color: theme.color.text }]}
                    />
                    {!allDay ? <TextInput value={time} onChangeText={setTime} placeholder={t('account.agenda.timePlaceholder')} placeholderTextColor={theme.color.muted} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="done" blurOnSubmit={true} style={[styles.input, styles.shortInput, { backgroundColor: theme.color.surface, borderColor: dateError ? theme.semantic.danger.border : theme.color.border, color: theme.color.text }]} /> : null}
                  </View>
                </View>

                {!allDay ? (
                  <View style={styles.fieldBlock}>
                    <AppText style={styles.fieldLabel}>{t('account.agenda.editor.endLabel')}</AppText>
                    <TextInput value={endTime} onChangeText={setEndTime} placeholder={t('account.agenda.optionalEndPlaceholder')} placeholderTextColor={theme.color.muted} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="done" blurOnSubmit={true} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: dateError ? theme.semantic.danger.border : theme.color.border, color: theme.color.text }]} />
                  </View>
                ) : null}

                {dateError ? <AppText style={[styles.fieldError, { color: theme.semantic.danger.text }]}>{dateError}</AppText> : null}

                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: allDay }} onPress={() => setAllDay((current) => !current)} style={({ pressed }) => [styles.checkboxRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                  <View style={[styles.checkboxBox, { backgroundColor: allDay ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: allDay ? theme.semantic.proposal.border : theme.color.border }]}>
                    {allDay ? <MobileIcon name="proposal-accepted" size={14} color={theme.semantic.proposal.text} /> : null}
                  </View>
                  <AppText style={styles.checkboxLabel}>{t('account.agenda.editor.allDayLabel')}</AppText>
                </Pressable>

                <View style={styles.fieldBlock}>
                  <AppText style={styles.fieldLabel}>{t('account.agenda.editor.noteLabel')}</AppText>
                  <TextInput
                    value={privateNote}
                    onChangeText={setPrivateNote}
                    maxLength={AGENDA_ITEM_NOTE_MAX_LENGTH}
                    multiline
                    textAlignVertical="top"
                    placeholder={t('account.agenda.add.notePlaceholder')}
                    placeholderTextColor={theme.color.muted}
                    inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                      returnKeyType="default"
                      blurOnSubmit={false}
                      style={[styles.input, styles.textArea, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]}
                  />
                </View>

                <AppText style={[styles.privacyNote, { color: theme.color.muted }]}>{t('account.agenda.editor.privacyNote')}</AppText>
                {error ? <AppText style={[styles.fieldError, { color: theme.semantic.danger.text }]}>{error}</AppText> : null}
              </View>

              <View style={styles.actions}>
                <Pressable accessibilityRole="button" disabled={saving} onPress={closeSheet} style={({ pressed }) => [styles.sheetButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && !saving && styles.pressed, saving && styles.disabled]}>
                  <AppText style={[styles.sheetButtonText, { color: theme.color.text }]}>{t('common.actions.cancel')}</AppText>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void addToAgenda(); }} style={({ pressed }) => [styles.sheetButton, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, pressed && !saving && styles.pressed, saving && styles.disabled]}>
                  <AppText style={[styles.sheetButtonText, { color: theme.semantic.proposal.text }]}>{saving ? t('common.states.saving') : t('account.agenda.add.submit')}</AppText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 46, borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '900' },
  inlineMessage: { fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.58)' },
  modalTapArea: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  sheet: { maxHeight: '92%', borderRadius: 28, borderWidth: 1, padding: 16, gap: 14 },
  sheetHeader: { gap: 6, paddingHorizontal: 2 },
  sheetTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.35 },
  sheetBody: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  sourceBox: { borderWidth: 1, borderRadius: 20, padding: 13, gap: 8 },
  sourceTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  formFields: { gap: 12 },
  fieldBlock: { gap: 7 },
  fieldLabel: { fontSize: 13, fontWeight: '900' },
  timeRow: { flexDirection: 'row', gap: 10 },
  input: { minHeight: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, fontSize: 15, fontWeight: '800' },
  dateInput: { flex: 1.45 },
  shortInput: { flex: 0.8 },
  textArea: { minHeight: 94, lineHeight: 20 },
  checkboxRow: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkboxBox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkboxLabel: { fontSize: 14, fontWeight: '900' },
  privacyNote: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  fieldError: { fontSize: 12, lineHeight: 17, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10 },
  sheetButton: { minHeight: 50, flex: 1, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  sheetButtonText: { fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
});
