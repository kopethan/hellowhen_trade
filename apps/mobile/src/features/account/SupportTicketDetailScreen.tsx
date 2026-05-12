import React, { useCallback, useState } from 'react';
import { Button, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { SupportTicketDto } from '@hellowhen/contracts';
import { formatLocalizedDateTime } from '@hellowhen/i18n';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { ImagePickerField } from '../trade/components/ImagePickerField';
import { MediaStrip } from '../trade/components/MediaStrip';
import { uploadSelectedImages, type SelectedLocalImage } from '../trade/mediaUpload';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';

type TicketResponse = { ticket: SupportTicketDto };
function senderLabel(senderRole: string, fallback: string | null | undefined, supportLabel: string, youLabel: string) { return senderRole === 'admin' ? supportLabel : fallback || youLabel; }

export function SupportTicketDetailScreen() {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SupportTicketDetail'>>();
  const [ticket, setTicket] = useState<SupportTicketDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [images, setImages] = useState<SelectedLocalImage[]>([]);

  const loadTicket = useCallback(async () => {
    setLoading(true); setMessage(null);
    try { const data = await api.support.ticket(route.params.ticketId) as TicketResponse; setTicket(data.ticket); }
    catch (caughtError) { setTicket(null); setMessage(getFriendlyApiErrorMessage(caughtError)); }
    finally { setLoading(false); }
  }, [route.params.ticketId]);
  useFocusEffect(useCallback(() => { void loadTicket(); }, [loadTicket]));

  async function sendMessage() {
    if (!body.trim()) return;
    setSending(true); setMessage(null);
    try {
      const mediaIds = await uploadSelectedImages(images);
      await api.support.sendMessage(route.params.ticketId, { body: body.trim(), mediaIds });
      setBody(''); setImages([]);
      await loadTicket();
    }
    catch (caughtError) { setMessage(getFriendlyApiErrorMessage(caughtError)); }
    finally { setSending(false); }
  }

  async function setStatus(status: 'open' | 'closed') {
    setSending(true); setMessage(null);
    try { const data = await api.support.updateStatus(route.params.ticketId, { status }) as TicketResponse; setTicket(data.ticket); }
    catch (caughtError) { setMessage(getFriendlyApiErrorMessage(caughtError)); }
    finally { setSending(false); }
  }

  const isClosed = ticket?.status === 'closed';
  return <AppScreen><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadTicket(); }} />}>
    <AppHeader title={t('support.ticketTitle')} onBack={() => navigation.goBack()} />
    <View style={styles.header}><SemanticBadge label={t('support.ticketTitle')} tone="instruction" /><AppText style={styles.title}>{ticket?.subject ?? route.params.subject ?? t('support.ticketTitle')}</AppText><AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('support.feedbackBody')}</AppText></View>
    {message ? <InfoNotice tone="warning" title={t('support.messageTitle')} body={message} /> : null}
    {ticket ? <><AppCard><View style={styles.badgeRow}><StatusBadge status={ticket.status} /><SemanticBadge label={t(`support.categories.${ticket.category}`)} tone="info" /><SemanticBadge label={t(`support.priorities.${ticket.priority}`)} tone={ticket.priority === 'urgent' ? 'danger' : ticket.priority === 'high' ? 'warning' : 'muted'} /></View><AppText style={[styles.cardText, { color: theme.color.muted }]}>{ticket.message}</AppText><MediaStrip media={ticket.media} size="large" />{ticket.relatedTradeId ? <SemanticBadge label={`trade ${ticket.relatedTradeId}`} tone="trade" size="sm" /> : null}{ticket.relatedProposalId ? <SemanticBadge label={`proposal ${ticket.relatedProposalId}`} tone="proposal" size="sm" /> : null}{ticket.relatedMediaId ? <SemanticBadge label={`media ${ticket.relatedMediaId}`} tone="warning" size="sm" /> : null}</AppCard>
    <AppCard><AppText style={styles.sectionTitle}>{t('support.conversation')}</AppText>{ticket.messages?.map((item) => <View key={item.id} style={[styles.messageBubble, item.senderRole === 'admin' ? styles.adminBubble : styles.userBubble]}><View style={styles.badgeRow}><SemanticBadge label={senderLabel(item.senderRole, item.sender?.profile?.displayName ?? item.sender?.email, t('support.adminSender'), t('support.youSender'))} tone={item.senderRole === 'admin' ? 'admin' : 'info'} size="sm" />{item.internal ? <SemanticBadge label={t('support.internal')} tone="warning" size="sm" /> : null}</View><AppText style={styles.messageText}>{item.body}</AppText><MediaStrip media={item.media} /><AppText style={styles.dateText}>{formatLocalizedDateTime(item.createdAt, language)}</AppText></View>)}{ticket.messages?.length === 0 ? <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('support.noMessages')}</AppText> : null}</AppCard>
    <AppCard><AppText style={styles.sectionTitle}>{isClosed ? t('support.ticketClosed') : t('support.replyToSupport')}</AppText>{isClosed ? <InfoNotice tone="admin" title={t('support.closed')} body={t('support.closedBody')} /> : <><TextInput value={body} onChangeText={setBody} placeholder={t('support.replyPlaceholderNative')} placeholderTextColor={theme.color.muted} style={[styles.input, styles.textArea, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} multiline textAlignVertical="top" /><ImagePickerField images={images} onChange={setImages} disabled={sending} label={t('support.attachImages')} hint={t('support.replyImagesHint')} /><Button title={sending ? t('common.states.sending') : t('support.reply')} disabled={sending} onPress={() => { void sendMessage(); }} /></>}<Button title={isClosed ? t('support.reopenTicket') : t('support.closeTicket')} color={isClosed ? '#0F766E' : '#B91C1C'} disabled={sending} onPress={() => { void setStatus(isClosed ? 'open' : 'closed'); }} /></AppCard></> : <AppCard><AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('support.couldNotLoad')}</AppText></AppCard>}
  </ScrollView></AppScreen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 31, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { lineHeight: 20, fontWeight: '700' },
  sectionTitle: { fontSize: 22, fontWeight: '900' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardText: { lineHeight: 20, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, fontWeight: '700' },
  textArea: { minHeight: 110 },
  messageBubble: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 7 },
  userBubble: { backgroundColor: '#E0F2FE', borderColor: '#7DD3FC' },
  adminBubble: { backgroundColor: '#E2E8F0', borderColor: '#94A3B8' },
  messageText: { color: '#0F172A', lineHeight: 20, fontWeight: '700' },
  dateText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
});
