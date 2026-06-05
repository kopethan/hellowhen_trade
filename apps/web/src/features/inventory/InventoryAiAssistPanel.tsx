'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AiAssistResponse, DiscoveryLanguage, PlusAiAssistQuotaSummary, PlusAiAssistTaskType } from '@hellowhen/contracts';
import { INVENTORY_DESCRIPTION_MAX_LENGTH, INVENTORY_TITLE_MAX_LENGTH } from '@hellowhen/contracts/src/inventoryLimits';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import type { InventoryKind } from './inventoryPresentation';

type AiAssistField = 'title' | 'description';

type InventoryAiAssistPanelProps = {
  kind: InventoryKind;
  title: string;
  description: string;
  defaultLanguage: DiscoveryLanguage;
  category?: string;
  tags?: string;
  disabled?: boolean;
  onApplyTitle: (value: string) => void;
  onApplyDescription: (value: string) => void;
  onApplyTranslation: (languageCode: DiscoveryLanguage, title: string, description: string) => void;
  onApplyCategoryTags: (category: string, tags: string[]) => void;
};

type PendingSuggestion =
  | { kind: 'field'; field: AiAssistField; text: string }
  | { kind: 'translation'; language: DiscoveryLanguage; title: string; description: string }
  | { kind: 'category_tags'; category: string; tags: string[]; text: string }
  | { kind: 'safety_readability'; safetyNotes: string[]; readabilityNotes: string[]; text: string };

const TASK_BY_KIND_AND_FIELD: Record<InventoryKind, Record<AiAssistField, PlusAiAssistTaskType>> = {
  need: {
    title: 'need_title',
    description: 'need_description',
  },
  offer: {
    title: 'offer_title',
    description: 'offer_description',
  },
};

function trimForField(field: AiAssistField, value: string) {
  const maxLength = field === 'title' ? INVENTORY_TITLE_MAX_LENGTH : INVENTORY_DESCRIPTION_MAX_LENGTH;
  return value.trim().slice(0, maxLength);
}

function formatResetDate(value?: string | null) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function alternateLanguage(language: DiscoveryLanguage): DiscoveryLanguage {
  return language === 'fr' ? 'en' : 'fr';
}

function compactList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

export function InventoryAiAssistPanel({ kind, title, description, defaultLanguage, category, tags, disabled, onApplyTitle, onApplyDescription, onApplyTranslation, onApplyCategoryTags }: InventoryAiAssistPanelProps) {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const enabled = betaFeatures.plusSubscriptionFeatures.aiAssistEnabled;
  const [usage, setUsage] = useState<PlusAiAssistQuotaSummary | null>(null);
  const [loadingTask, setLoadingTask] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<PendingSuggestion | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const targetLanguage = alternateLanguage(defaultLanguage);
  const quotaLabel = useMemo(() => {
    if (!usage) return t('inventory.aiAssist.quotaUnknown');
    return t('inventory.aiAssist.quotaLabel', { used: usage.used, quota: usage.quota, remaining: usage.remaining, reset: formatResetDate(usage.resetAt) });
  }, [t, usage]);

  useEffect(() => {
    if (!enabled || !auth.hydrated || !auth.isAuthenticated) return;
    let mounted = true;
    async function loadSnapshot() {
      try {
        const response = await api.plus.me();
        if (mounted) setUsage(response.aiAssistUsage);
      } catch {
        // The assist endpoint still performs the authoritative quota check.
      }
    }
    void loadSnapshot();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated, enabled]);

  if (!enabled) return null;

  const quotaExhausted = usage ? usage.remaining <= 0 : false;
  const controlsDisabled = Boolean(disabled || loadingTask || !auth.isAuthenticated || quotaExhausted);

  function sourceText() {
    return [title.trim(), description.trim()].filter(Boolean).join('\n\n').trim();
  }

  async function requestSuggestion(field: AiAssistField) {
    const text = (field === 'title' ? title || description : description || title).trim();
    if (!text) {
      setMessage('');
      setError(t('inventory.aiAssist.addTextFirst'));
      return;
    }

    setLoadingTask(field);
    setError('');
    setMessage('');
    setSuggestion(null);
    try {
      const response = await api.ai.assist({
        taskType: TASK_BY_KIND_AND_FIELD[kind][field],
        targetType: kind,
        text,
        context: field === 'title' ? description.trim() : title.trim(),
      }) as AiAssistResponse;
      const nextText = trimForField(field, field === 'title'
        ? response.suggestion.title ?? response.suggestion.text
        : response.suggestion.description ?? response.suggestion.text);
      setUsage(response.usage);
      setSuggestion({ kind: 'field', field, text: nextText });
      setMessage(t('inventory.aiAssist.reviewBeforeApply'));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause));
    } finally {
      setLoadingTask(null);
    }
  }

  async function requestTranslation() {
    if (!sourceText()) {
      setMessage('');
      setError(t('inventory.aiAssist.addTextFirst'));
      return;
    }
    setLoadingTask('translation');
    setError('');
    setMessage('');
    setSuggestion(null);
    try {
      const response = await api.ai.assist({
        taskType: 'translate_text',
        targetType: 'translation',
        text: JSON.stringify({ title: title.trim(), description: description.trim() }),
        sourceLanguage: defaultLanguage,
        targetLanguage,
      }) as AiAssistResponse;
      setUsage(response.usage);
      setSuggestion({
        kind: 'translation',
        language: targetLanguage,
        title: trimForField('title', response.suggestion.title ?? response.suggestion.text),
        description: trimForField('description', response.suggestion.description ?? response.suggestion.text),
      });
      setMessage(t('inventory.aiAssist.reviewBeforeApply'));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause));
    } finally {
      setLoadingTask(null);
    }
  }

  async function requestCategoryTags() {
    if (!sourceText()) {
      setMessage('');
      setError(t('inventory.aiAssist.addTextFirst'));
      return;
    }
    setLoadingTask('category_tags');
    setError('');
    setMessage('');
    setSuggestion(null);
    try {
      const response = await api.ai.assist({
        taskType: 'category_tags',
        targetType: 'category_tags',
        text: sourceText(),
        context: [category, ...compactList(tags ?? '')].filter(Boolean).join(', '),
      }) as AiAssistResponse;
      setUsage(response.usage);
      setSuggestion({
        kind: 'category_tags',
        category: response.suggestion.category ?? 'Other',
        tags: response.suggestion.tags ?? [],
        text: response.suggestion.text,
      });
      setMessage(t('inventory.aiAssist.reviewBeforeApply'));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause));
    } finally {
      setLoadingTask(null);
    }
  }

  async function requestSafetyReadability() {
    if (!sourceText()) {
      setMessage('');
      setError(t('inventory.aiAssist.addTextFirst'));
      return;
    }
    setLoadingTask('safety_readability');
    setError('');
    setMessage('');
    setSuggestion(null);
    try {
      const response = await api.ai.assist({
        taskType: 'safety_readability',
        targetType: 'safety_readability',
        text: sourceText(),
        context: [category, ...compactList(tags ?? '')].filter(Boolean).join(', '),
      }) as AiAssistResponse;
      setUsage(response.usage);
      setSuggestion({
        kind: 'safety_readability',
        safetyNotes: response.suggestion.safetyNotes ?? [],
        readabilityNotes: response.suggestion.readabilityNotes ?? [],
        text: response.suggestion.text,
      });
      setMessage(t('inventory.aiAssist.checkReady'));
    } catch (cause) {
      setError(getFriendlyApiErrorMessage(cause));
    } finally {
      setLoadingTask(null);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    if (suggestion.kind === 'field') {
      if (suggestion.field === 'title') onApplyTitle(suggestion.text);
      else onApplyDescription(suggestion.text);
    }
    if (suggestion.kind === 'translation') onApplyTranslation(suggestion.language, suggestion.title, suggestion.description);
    if (suggestion.kind === 'category_tags') onApplyCategoryTags(suggestion.category, suggestion.tags);
    setSuggestion(null);
    setMessage(t('inventory.aiAssist.applied'));
  }

  function suggestionLabel() {
    if (!suggestion) return '';
    if (suggestion.kind === 'field') return suggestion.field === 'title' ? t('inventory.labels.title') : t('inventory.labels.description');
    if (suggestion.kind === 'translation') return t('inventory.aiAssist.translationLabel', { language: t(`inventory.languages.${suggestion.language}`) });
    if (suggestion.kind === 'category_tags') return t('inventory.aiAssist.categoryTagsLabel');
    return t('inventory.aiAssist.safetyReadabilityLabel');
  }

  return (
    <section className="mobile-card mobile-card--soft inventory-ai-assist-panel">
      <div className="inventory-ai-assist-panel__header">
        <div className="inventory-form__helper-copy">
          <strong>{t('inventory.aiAssist.title')}</strong>
          <span>{t('inventory.aiAssist.body')}</span>
        </div>
        <span className="semantic-badge instruction">{t('inventory.aiAssist.badge')}</span>
      </div>

      <div className="inventory-ai-assist-panel__actions">
        <button type="button" className="button secondary compact" onClick={() => requestSuggestion('title')} disabled={controlsDisabled}>
          {loadingTask === 'title' ? t('inventory.aiAssist.generating') : kind === 'need' ? t('inventory.aiAssist.improveNeedTitle') : t('inventory.aiAssist.improveOfferTitle')}
        </button>
        <button type="button" className="button secondary compact" onClick={() => requestSuggestion('description')} disabled={controlsDisabled}>
          {loadingTask === 'description' ? t('inventory.aiAssist.generating') : kind === 'need' ? t('inventory.aiAssist.improveNeedDescription') : t('inventory.aiAssist.improveOfferDescription')}
        </button>
        <button type="button" className="button secondary compact" onClick={requestTranslation} disabled={controlsDisabled}>
          {loadingTask === 'translation' ? t('inventory.aiAssist.generating') : t('inventory.aiAssist.translateTo', { language: t(`inventory.languages.${targetLanguage}`) })}
        </button>
        <button type="button" className="button secondary compact" onClick={requestCategoryTags} disabled={controlsDisabled}>
          {loadingTask === 'category_tags' ? t('inventory.aiAssist.generating') : t('inventory.aiAssist.suggestCategoryTags')}
        </button>
        <button type="button" className="button secondary compact" onClick={requestSafetyReadability} disabled={controlsDisabled}>
          {loadingTask === 'safety_readability' ? t('inventory.aiAssist.generating') : t('inventory.aiAssist.checkSafetyReadability')}
        </button>
      </div>

      <small className="inventory-ai-assist-panel__quota">{quotaExhausted ? t('inventory.aiAssist.quotaExhausted') : quotaLabel}</small>
      {!auth.isAuthenticated && auth.hydrated ? <small className="inventory-ai-assist-panel__quota">{t('inventory.aiAssist.signInRequired')}</small> : null}
      {message ? <p className="form-message form-message--success">{message}</p> : null}
      {error ? <p className="form-message form-message--error">{error}</p> : null}

      {suggestion ? (
        <div className="inventory-ai-assist-panel__suggestion">
          <span className="semantic-badge instruction">{suggestionLabel()}</span>
          {suggestion.kind === 'translation' ? (
            <>
              <p><strong>{t('inventory.labels.title')}:</strong> {suggestion.title}</p>
              <p><strong>{t('inventory.labels.description')}:</strong> {suggestion.description}</p>
            </>
          ) : suggestion.kind === 'category_tags' ? (
            <>
              <p><strong>{t('inventory.labels.category')}:</strong> {suggestion.category}</p>
              <p><strong>{t('inventory.labels.tags')}:</strong> {suggestion.tags.join(', ') || t('inventory.labels.notSpecified')}</p>
            </>
          ) : suggestion.kind === 'safety_readability' ? (
            <>
              <p>{suggestion.text}</p>
              {suggestion.safetyNotes.length ? <ul>{suggestion.safetyNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
              {suggestion.readabilityNotes.length ? <ul>{suggestion.readabilityNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
            </>
          ) : (
            <p>{suggestion.text}</p>
          )}
          <div className="inventory-ai-assist-panel__suggestion-actions">
            {suggestion.kind !== 'safety_readability' ? <button type="button" className="button primary compact" onClick={applySuggestion}>{t('inventory.aiAssist.applySuggestion')}</button> : null}
            <button type="button" className="button secondary compact" onClick={() => setSuggestion(null)}>{t('inventory.aiAssist.discardSuggestion')}</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
