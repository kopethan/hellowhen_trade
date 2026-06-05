import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { AiAssistResponse, PlusAiAssistQuotaSummary } from '@hellowhen/contracts';
import { api } from '../../../lib/api';
import { betaFeatures } from '../../../lib/betaFeatures';
import { AppCard } from '../../../components/AppCard';
import { AppText } from '../../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../../components/SemanticUI';
import { useAuth } from '../../../providers/AuthProvider';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';

type ProposalAiAssistCardProps = {
  message: string;
  context?: string;
  disabled?: boolean;
  onApplyMessage: (value: string) => void;
};

function formatResetDate(value?: string | null) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
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

export function ProposalAiAssistCard({ message, context, disabled, onApplyMessage }: ProposalAiAssistCardProps) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const enabled = betaFeatures.plusSubscriptionFeatures.aiAssistEnabled;
  const [usage, setUsage] = useState<PlusAiAssistQuotaSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const controlsDisabled = Boolean(disabled || loading || !auth.isAuthenticated || quotaExhausted);

  async function requestSuggestion() {
    const source = message.trim() || context?.trim() || '';
    if (!source) {
      setNotice(null);
      setError(t('trade.proposals.aiAddMessageFirst'));
      return;
    }
    setLoading(true);
    setSuggestion('');
    setNotice(null);
    setError(null);
    try {
      const response = await api.ai.assist({
        taskType: 'proposal_message',
        targetType: 'proposal',
        text: source,
        context: context?.trim(),
      }) as AiAssistResponse;
      setUsage(response.usage);
      setSuggestion(response.suggestion.text.trim());
      setNotice(t('trade.proposals.aiReviewBeforeApply'));
    } catch (cause) {
      setError(getErrorMessage(cause, t('inventory.aiAssist.failed')));
    } finally {
      setLoading(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    onApplyMessage(suggestion);
    setSuggestion('');
    setNotice(t('trade.proposals.aiApplied'));
  }

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <AppText style={styles.title}>{t('trade.proposals.aiTitle')}</AppText>
          <AppText style={[styles.body, { color: theme.color.muted }]}>{t('trade.proposals.aiBody')}</AppText>
        </View>
        <SemanticBadge label={t('inventory.aiAssist.badge')} tone="instruction" />
      </View>
      <Pressable disabled={controlsDisabled} onPress={requestSuggestion} style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, controlsDisabled && styles.disabled, pressed && styles.pressed]}>
        <AppText style={styles.actionText}>{loading ? t('inventory.aiAssist.generating') : t('trade.proposals.aiImproveMessage')}</AppText>
      </Pressable>
      <AppText style={[styles.quota, { color: theme.color.muted }]}>{quotaExhausted ? t('inventory.aiAssist.quotaExhausted') : quotaLabel}</AppText>
      {notice ? <InfoNotice tone="success" title={t('inventory.aiAssist.noticeTitle')} body={notice} /> : null}
      {error ? <InfoNotice tone="danger" title={t('inventory.aiAssist.errorTitle')} body={error} /> : null}
      {suggestion ? (
        <View style={[styles.suggestion, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <AppText style={[styles.suggestionLabel, { color: theme.color.muted }]}>{t('trade.proposals.proposalNote')}</AppText>
          <AppText style={styles.suggestionText}>{suggestion}</AppText>
          <View style={styles.suggestionActions}>
            <Pressable onPress={applySuggestion} style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}>
              <AppText style={styles.applyButtonText}>{t('inventory.aiAssist.applySuggestion')}</AppText>
            </Pressable>
            <Pressable onPress={() => setSuggestion('')} style={({ pressed }) => [styles.dismissButton, { borderColor: theme.color.border }, pressed && styles.pressed]}>
              <AppText style={styles.dismissButtonText}>{t('inventory.aiAssist.discardSuggestion')}</AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  body: { lineHeight: 20, fontWeight: '700' },
  actionButton: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  actionText: { fontWeight: '900', color: '#0F172A' },
  quota: { fontSize: 12, fontWeight: '800', lineHeight: 17 },
  suggestion: { borderRadius: 18, borderWidth: 1, padding: 13, gap: 9 },
  suggestionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  suggestionText: { color: '#0F172A', fontWeight: '700', lineHeight: 20 },
  suggestionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  applyButton: { borderRadius: 999, backgroundColor: '#0F172A', paddingHorizontal: 13, paddingVertical: 10 },
  applyButtonText: { color: '#FFFFFF', fontWeight: '900' },
  dismissButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  dismissButtonText: { color: '#0F172A', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.76 },
});
