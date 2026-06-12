'use client';

import type { AgendaItemSourceType, AgendaItemType } from '@hellowhen/contracts';
import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { betaFeatures } from '../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../lib/webErrors';
import { useWebAuth } from '../providers/WebAuthProvider';
import { useWebTranslation } from '../providers/WebI18nProvider';
import { WebIcon } from './WebIcon';

const AGENDA_ITEM_TITLE_MAX_LENGTH = 120;
const AGENDA_ITEM_NOTE_MAX_LENGTH = 2000;

type AddToAgendaButtonProps = {
  sourceType: Exclude<AgendaItemSourceType, 'custom'>;
  sourceId: string;
  itemType: AgendaItemType;
  title: string;
  note?: string | null;
  className?: string;
  iconSize?: number;
  showLabel?: boolean;
  disabled?: boolean;
  hidden?: boolean;
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

function toDateTimeLocal(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
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

function nextAuthUrl() {
  if (typeof window === 'undefined') return '/auth';
  return `/auth?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;
}

export function AddToAgendaButton({
  sourceType,
  sourceId,
  itemType,
  title,
  note,
  className = 'button secondary add-to-agenda-button',
  iconSize = 16,
  showLabel = true,
  disabled = false,
  hidden = false,
}: AddToAgendaButtonProps) {
  const auth = useWebAuth();
  const router = useRouter();
  const { t } = useWebTranslation();
  const [open, setOpen] = useState(false);
  const [startAt, setStartAt] = useState(() => toDateTimeLocal(roundToNextHour()));
  const [endAt, setEndAt] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [privateNote, setPrivateNote] = useState(note ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const timezone = useMemo(() => browserTimezone(), []);

  if (hidden || !betaFeatures.agendaEnabled) return null;

  function openSheet() {
    if (disabled || saving) return;
    if (!auth.isAuthenticated) {
      router.push(nextAuthUrl());
      return;
    }
    setStartAt(toDateTimeLocal(roundToNextHour()));
    setEndAt('');
    setAllDay(false);
    setPrivateNote(note ?? '');
    setDateError(null);
    setError(null);
    setMessage(null);
    setOpen(true);
  }

  function closeSheet() {
    if (saving) return;
    setOpen(false);
    setDateError(null);
    setError(null);
  }

  async function addToAgenda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const apiStartAt = toApiDateTime(startAt);
    const apiEndAt = endAt ? toApiDateTime(endAt) : '';
    setDateError(null);
    setError(null);
    setMessage(null);

    if (!apiStartAt) {
      setDateError(t('account.agenda.add.startRequired'));
      return;
    }
    if (apiEndAt && new Date(apiEndAt).getTime() < new Date(apiStartAt).getTime()) {
      setDateError(t('account.agenda.add.endAfterStart'));
      return;
    }

    setSaving(true);
    try {
      const agendaTitle = (title.trim() || t('account.agenda.add.fallbackTitle')).slice(0, AGENDA_ITEM_TITLE_MAX_LENGTH);
      const response = await api.agenda.create({
        sourceType,
        sourceId,
        itemType,
        title: agendaTitle,
        note: privateNote.trim() || null,
        startAt: apiStartAt,
        endAt: apiEndAt || null,
        allDay,
        timezone,
      });
      setMessage(t('account.agenda.add.created', { title: response.item.title }));
      setOpen(false);
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause, t('account.agenda.add.saveError')));
    } finally {
      setSaving(false);
    }
  }

  const label = t('account.agenda.add.button');

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label}
        title={label}
        disabled={disabled || saving}
        onClick={openSheet}
      >
        <WebIcon name="calendar" size={iconSize} decorative />
        {showLabel ? <span>{saving ? t('common.states.saving') : label}</span> : null}
      </button>
      {message ? <span className="add-to-agenda-inline-message" role="status">{message}</span> : null}
      {open ? (
        <div className="add-to-agenda-sheet" role="dialog" aria-modal="true" aria-labelledby="add-to-agenda-title" onMouseDown={closeSheet}>
          <form className="add-to-agenda-sheet__panel" onSubmit={(event) => { void addToAgenda(event); }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="add-to-agenda-sheet__header">
              <span className="semantic-badge proposal">{t('account.agenda.privateBadge')}</span>
              <h2 id="add-to-agenda-title">{t('account.agenda.add.title')}</h2>
              <p>{t('account.agenda.add.body')}</p>
            </div>
            <div className="add-to-agenda-sheet__source">
              <span className="semantic-badge instruction">{t(`account.agenda.types.${itemType}`)}</span>
              <strong>{title}</strong>
            </div>
            <div className="add-to-agenda-sheet__time-grid">
              <label>
                <span>{t('account.agenda.editor.startLabel')}</span>
                <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
              </label>
              <label>
                <span>{t('account.agenda.editor.endLabel')}</span>
                <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
              </label>
            </div>
            {dateError ? <p className="field-error">{dateError}</p> : null}
            <label className="add-to-agenda-sheet__checkbox">
              <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
              <span>{t('account.agenda.editor.allDayLabel')}</span>
            </label>
            <label>
              <span>{t('account.agenda.editor.noteLabel')}</span>
              <textarea rows={4} maxLength={AGENDA_ITEM_NOTE_MAX_LENGTH} value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} placeholder={t('account.agenda.add.notePlaceholder')} />
            </label>
            <p className="add-to-agenda-sheet__privacy-note">{t('account.agenda.editor.privacyNote')}</p>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="add-to-agenda-sheet__actions">
              <button type="button" className="button secondary" onClick={closeSheet} disabled={saving}>{t('common.actions.cancel')}</button>
              <button type="submit" className="button primary" disabled={saving}>{saving ? t('common.states.saving') : t('account.agenda.add.submit')}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
