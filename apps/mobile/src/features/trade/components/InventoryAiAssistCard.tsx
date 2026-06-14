import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { AiAssistResponse, DiscoveryLanguage, PlusAiAssistQuotaSummary, PlusAiAssistTaskType } from '@hellowhen/contracts';
import { getAlternateInventoryLanguage } from '@hellowhen/shared';
import { INVENTORY_DESCRIPTION_MAX_LENGTH, INVENTORY_TITLE_MAX_LENGTH } from '@hellowhen/contracts/src/inventoryLimits';
import { api } from '../../../lib/api';
import { betaFeatures } from '../../../lib/betaFeatures';
import { AppCard } from '../../../components/AppCard';
import { AppText } from '../../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../../components/SemanticUI';
import { useAuth } from '../../../providers/AuthProvider';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';

type InventoryKind = 'need' | 'offer';
type AiAssistField = 'title' | 'description';

type InventoryAiAssistCardProps = {
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

function compactList(value?: string) {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function getErrorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error && cause.message) return cause.message;
  if (cause && typeof cause === 'object') {
    const maybeMessage = (cause as { publicMessage?: unknown; message?: unknown; error?: unknown }).publicMessage
      ?? (cause as { message?: unknown }).message
      ?? (cause as { error?: unknown }).error;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
  }
  return fallback;
}

export function InventoryAiAssistCard({ kind, title, description, defaultLanguage, category, tags, disabled, onApplyTitle, onApplyDescription, onApplyTranslation, onApplyCategoryTags }: InventoryAiAssistCardProps) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const enabled = betaFeatures.plusSubscriptionFeatures.aiAssistEnabled;
  const [usage, setUsage] = useState<PlusAiAssistQuotaSummary | null>(null);
  const [loadingTask, setLoadingTask] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<PendingSuggestion | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targetLanguage = getAlternateInventoryLanguage(defaultLanguage) as DiscoveryLanguage;

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
      setMessage(null);
      setError(t('inventory.aiAssist.addTextFirst'));
      return;
    }

    setLoadingTask(field);
    setError(null);
    setMessage(null);
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
      setError(getErrorMessage(cause, t('inventory.aiAssist.failed')));
    } finally {
      setLoadingTask(null);
    }
  }

  async function requestTranslation() {
    if (!sourceText()) {
      setMessage(null);
      setError(t('inventory.aiAssist.addTextFirst'));
      return;
    }
    setLoadingTask('translation');
    setError(null);
    setMessage(null);
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
      setError(getErrorMessage(cause, t('inventory.aiAssist.failed')));
    } finally {
      setLoadingTask(null);
    }
  }

  async function requestCategoryTags() {
    if (!sourceText()) {
      setMessage(null);
      setError(t('inventory.aiAssist.addTextFirst'));
      return;
    }
    setLoadingTask('category_tags');
    setError(null);
    setMessage(null);
    setSuggestion(null);
    try {
      const response = await api.ai.assist({
        taskType: 'category_tags',
        targetType: 'category_tags',
        text: sourceText(),
        context: [category, ...compactList(tags)].filter(Boolean).join(', '),
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
      setError(getErrorMessage(cause, t('inventory.aiAssist.failed')));
    } finally {
      setLoadingTask(null);
    }
  }

  async function requestSafetyReadability() {
    if (!sourceText()) {
      setMessage(null);
      setError(t('inventory.aiAssist.addTextFirst'));
      return;
    }
    setLoadingTask('safety_readability');
    setError(null);
    setMessage(null);
    setSuggestion(null);
    try {
      const response = await api.ai.assist({
        taskType: 'safety_readability',
        targetType: 'safety_readability',
        text: sourceText(),
        context: [category, ...compactList(tags)].filter(Boolean).join(', '),
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
      setError(getErrorMessage(cause, t('inventory.aiAssist.failed')));
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
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <AppText style={styles.title}>{t('inventory.aiAssist.title')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('inventory.aiAssist.body')}</AppText>
        </View>
        <SemanticBadge label={t('inventory.aiAssist.badge')} tone="instruction" />
      </View>

      <View style={styles.actions}>
        <AssistButton disabled={controlsDisabled} loading={loadingTask === 'title'} label={kind === 'need' ? t('inventory.aiAssist.improveNeedTitle') : t('inventory.aiAssist.improveOfferTitle')} onPress={() => requestSuggestion('title')} />
        <AssistButton disabled={controlsDisabled} loading={loadingTask === 'description'} label={kind === 'need' ? t('inventory.aiAssist.improveNeedDescription') : t('inventory.aiAssist.improveOfferDescription')} onPress={() => requestSuggestion('description')} />
        <AssistButton disabled={controlsDisabled} loading={loadingTask === 'translation'} label={t('inventory.aiAssist.translateTo', { language: t(`inventory.languages.${targetLanguage}`) })} onPress={requestTranslation} />
        <AssistButton disabled={controlsDisabled} loading={loadingTask === 'category_tags'} label={t('inventory.aiAssist.suggestCategoryTags')} onPress={requestCategoryTags} />
        <AssistButton disabled={controlsDisabled} loading={loadingTask === 'safety_readability'} label={t('inventory.aiAssist.checkSafetyReadability')} onPress={requestSafetyReadability} />
      </View>

      <AppText style={[styles.quota, { color: theme.color.muted }]}>{quotaExhausted ? t('inventory.aiAssist.quotaExhausted') : quotaLabel}</AppText>
      {!auth.isAuthenticated && auth.hydrated ? <AppText style={[styles.quota, { color: theme.color.muted }]}>{t('inventory.aiAssist.signInRequired')}</AppText> : null}

      {message ? <InfoNotice tone="success" title={t('inventory.aiAssist.noticeTitle')} body={message} /> : null}
      {error ? <InfoNotice tone="danger" title={t('inventory.aiAssist.errorTitle')} body={error} /> : null}

      {suggestion ? (
        <View style={[styles.suggestion, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <AppText style={[styles.suggestionLabel, { color: theme.color.muted }]}>{suggestionLabel()}</AppText>
          {suggestion.kind === 'translation' ? (
            <>
              <AppText style={styles.suggestionText}>{t('inventory.labels.title')}: {suggestion.title}</AppText>
              <AppText style={styles.suggestionText}>{t('inventory.labels.description')}: {suggestion.description}</AppText>
            </>
          ) : suggestion.kind === 'category_tags' ? (
            <>
              <AppText style={styles.suggestionText}>{t('inventory.labels.category')}: {suggestion.category}</AppText>
              <AppText style={styles.suggestionText}>{t('inventory.labels.tags')}: {suggestion.tags.join(', ') || t('inventory.labels.notSpecified')}</AppText>
            </>
          ) : suggestion.kind === 'safety_readability' ? (
            <>
              <AppText style={styles.suggestionText}>{suggestion.text}</AppText>
              {[...suggestion.safetyNotes, ...suggestion.readabilityNotes].map((note) => <AppText key={note} style={styles.noteText}>• {note}</AppText>)}
            </>
          ) : (
            <AppText style={styles.suggestionText}>{suggestion.text}</AppText>
          )}
          <View style={styles.suggestionActions}>
            {suggestion.kind !== 'safety_readability' ? (
              <Pressable onPress={applySuggestion} style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}>
                <AppText style={styles.applyButtonText}>{t('inventory.aiAssist.applySuggestion')}</AppText>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setSuggestion(null)} style={({ pressed }) => [styles.dismissButton, { borderColor: theme.color.border }, pressed && styles.pressed]}>
              <AppText style={styles.dismissButtonText}>{t('inventory.aiAssist.discardSuggestion')}</AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </AppCard>
  );
}

function AssistButton({ disabled, loading, label, onPress }: { disabled: boolean; loading: boolean; label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, disabled && styles.disabled, pressed && styles.pressed]}>
      <AppText style={styles.actionText}>{loading ? t('inventory.aiAssist.generating') : label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  body: {
    lineHeight: 20,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  actionText: {
    fontWeight: '900',
    color: '#0F172A',
  },
  quota: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  suggestion: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    gap: 9,
  },
  suggestionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  suggestionText: {
    color: '#0F172A',
    fontWeight: '700',
    lineHeight: 20,
  },
  noteText: {
    color: '#334155',
    fontWeight: '700',
    lineHeight: 19,
  },
  suggestionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  applyButton: {
    borderRadius: 999,
    backgroundColor: '#0F172A',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dismissButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  dismissButtonText: {
    color: '#0F172A',
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.76,
  },
});
