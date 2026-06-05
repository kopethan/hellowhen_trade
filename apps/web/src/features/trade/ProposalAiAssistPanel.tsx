'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AiAssistResponse, PlusAiAssistQuotaSummary } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';

type ProposalAiAssistPanelProps = {
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

export function ProposalAiAssistPanel({ message, context, disabled, onApplyMessage }: ProposalAiAssistPanelProps) {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const enabled = betaFeatures.plusSubscriptionFeatures.aiAssistEnabled;
  const [usage, setUsage] = useState<PlusAiAssistQuotaSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

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
      setNotice('');
      setError(t('trade.proposals.aiAddMessageFirst'));
      return;
    }
    setLoading(true);
    setSuggestion('');
    setNotice('');
    setError('');
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
      setError(getFriendlyApiErrorMessage(cause));
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
    <section className="mobile-card mobile-card--soft proposal-ai-assist-panel">
      <div className="inventory-ai-assist-panel__header">
        <div className="inventory-form__helper-copy">
          <strong>{t('trade.proposals.aiTitle')}</strong>
          <span>{t('trade.proposals.aiBody')}</span>
        </div>
        <span className="semantic-badge instruction">{t('inventory.aiAssist.badge')}</span>
      </div>
      <div className="inventory-ai-assist-panel__actions">
        <button type="button" className="button secondary compact" disabled={controlsDisabled} onClick={requestSuggestion}>
          {loading ? t('inventory.aiAssist.generating') : t('trade.proposals.aiImproveMessage')}
        </button>
      </div>
      <small className="inventory-ai-assist-panel__quota">{quotaExhausted ? t('inventory.aiAssist.quotaExhausted') : quotaLabel}</small>
      {!auth.isAuthenticated && auth.hydrated ? <small className="inventory-ai-assist-panel__quota">{t('inventory.aiAssist.signInRequired')}</small> : null}
      {notice ? <p className="form-message form-message--success">{notice}</p> : null}
      {error ? <p className="form-message form-message--error">{error}</p> : null}
      {suggestion ? (
        <div className="inventory-ai-assist-panel__suggestion">
          <span className="semantic-badge instruction">{t('trade.proposals.proposalNote')}</span>
          <p>{suggestion}</p>
          <div className="inventory-ai-assist-panel__suggestion-actions">
            <button type="button" className="button primary compact" onClick={applySuggestion}>{t('inventory.aiAssist.applySuggestion')}</button>
            <button type="button" className="button secondary compact" onClick={() => setSuggestion('')}>{t('inventory.aiAssist.discardSuggestion')}</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
