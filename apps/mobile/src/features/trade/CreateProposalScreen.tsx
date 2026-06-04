import React, { useMemo, useState } from 'react';
import { Button, ScrollView, StyleSheet, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import type { TradeProposalItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateProposal'>;
type ProposalResponse = { proposal: TradeProposalItem };
export function CreateProposalScreen({ route, navigation }: Props) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const placeholder = t('trade.proposals.placeholderTrade');
  const [message, setMessage] = useState(() => placeholder);
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDraft = useMemo(() => message.trim().length > 0 && message.trim() !== placeholder.trim(), [message, placeholder]);
  const messageError = attemptedSubmit && message.trim().length < 3 ? t('trade.proposals.messageTooShort') : null;

  useUnsavedChangesWarning({
    navigation,
    enabled: hasDraft && !submitting,
    title: t('inventory.form.unsavedTitle'),
    body: t('inventory.form.unsavedBody'),
    stayLabel: t('common.actions.cancel'),
    discardLabel: t('inventory.form.discardDraft'),
  });

  async function submit() {
    if (submitting) return;
    setAttemptedSubmit(true);
    if (message.trim().length < 3) {
      setError(t('trade.proposals.messageTooShort'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.trades.createProposal(route.params.tradeId, { message: message.trim() }) as ProposalResponse;
      navigation.replace('ProposalDetail', { proposalId: result.proposal.id });
    }
    catch (caughtError) {
      const body = caughtError && typeof caughtError === 'object' && 'body' in caughtError ? (caughtError as { body?: { proposal?: TradeProposalItem } }).body : undefined;
      if (body?.proposal?.id) {
        navigation.replace('ProposalDetail', { proposalId: body.proposal.id });
        return;
      }
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotSendProposal')));
    }
    finally { setSubmitting(false); }
  }
  return <AppScreen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><AppHeader title={t('trade.proposals.askToTrade')} onBack={() => navigation.goBack()} /><AppCard><SemanticBadge label={t('trade.proposals.proposalConversation')} tone="proposal" /><AppText style={styles.title}>{t('trade.proposals.tradeRequest')}</AppText><InfoNotice tone="instruction" title={t('trade.labels.message')} body={route.params.title ?? t('trade.proposals.helperNeedOffer')} /><TextInput value={message} onChangeText={(nextMessage) => { setMessage(nextMessage); if (error) setError(null); }} multiline textAlignVertical="top" placeholder={placeholder} placeholderTextColor={theme.color.muted} style={[styles.textArea, { backgroundColor: theme.color.surface, borderColor: messageError ? theme.semantic.danger.border : theme.color.border, color: theme.color.text }]} />{messageError ? <AppText style={[styles.fieldError, { color: theme.semantic.danger.text }]}>{messageError}</AppText> : null}{error ? <InfoNotice tone="danger" title={t('trade.filters.error')} body={error} /> : null}<Button title={submitting ? t('trade.proposals.sending') : t('trade.proposals.sendProposal')} disabled={submitting || message.trim().length < 3} onPress={() => { void submit(); }} /><Button title={t('common.actions.cancel')} color="#64748B" disabled={submitting} onPress={() => navigation.goBack()} /></AppCard></ScrollView></AppScreen>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 28 }, kicker: { color: '#0F766E', fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' }, title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { color: '#64748B', lineHeight: 20, fontWeight: '700' }, textArea: { minHeight: 180, borderRadius: 18, borderWidth: 1, padding: 14, fontSize: 16, lineHeight: 22 }, fieldError: { fontSize: 12, fontWeight: '800', lineHeight: 17 }, error: { color: '#B91C1C', backgroundColor: '#FEE2E2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 16, padding: 12, fontWeight: '700' } });
