import React, { useCallback, useState } from 'react';
import { Button, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SupportTicketCategory, SupportTicketDto, SupportTicketPriority } from '@hellowhen/contracts';
import { formatLocalizedDateTime } from '@hellowhen/i18n';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { ImagePickerField } from '../trade/components/ImagePickerField';
import { MediaStrip } from '../trade/components/MediaStrip';
import { uploadSelectedImages, type SelectedLocalImage } from '../trade/mediaUpload';

type TicketsResponse = { tickets: SupportTicketDto[] };
type CreateTicketResponse = { ticket: SupportTicketDto };

const categories: SupportTicketCategory[] = ['general_feedback', 'trade_issue', 'media_issue', 'bug_report', 'account_issue', 'safety_concern'];
const priorities: SupportTicketPriority[] = ['low', 'normal', 'high', 'urgent'];

function categoryTone(category: SupportTicketCategory) {
  if (category === 'trade_issue') return 'trade' as const;
  if (category === 'media_issue') return 'warning' as const;
  if (category === 'safety_concern') return 'danger' as const;
  if (category === 'bug_report') return 'instruction' as const;
  return 'info' as const;
}
function priorityTone(priority: SupportTicketPriority) {
  if (priority === 'urgent') return 'danger' as const;
  if (priority === 'high') return 'warning' as const;
  if (priority === 'low') return 'muted' as const;
  return 'info' as const;
}

export function SupportCenterScreen() {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<SupportTicketCategory>('general_feedback');
  const [priority, setPriority] = useState<SupportTicketPriority>('normal');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<SelectedLocalImage[]>([]);

  const loadTickets = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.support.ticketsMine() as TicketsResponse;
      setTickets(data.tickets);
    } catch (caughtError) {
      setTickets([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void loadTickets(); }, [loadTickets]));

  async function createTicket() {
    setSubmitting(true); setError(null);
    try {
      const mediaIds = await uploadSelectedImages(images);
      const result = await api.support.createTicket({ category, priority, subject: subject.trim(), message: message.trim(), mediaIds }) as CreateTicketResponse;
      setSubject(''); setMessage(''); setImages([]); setCategory('general_feedback'); setPriority('normal');
      await loadTickets();
      navigation.navigate('SupportTicketDetail', { ticketId: result.ticket.id, subject: result.ticket.subject });
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally { setSubmitting(false); }
  }

  return <AppScreen><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadTickets(); }} />}>
    <AppHeader title={t('support.title')} onBack={() => navigation.goBack()} />
    <View style={styles.header}><SemanticBadge label={t('support.title')} tone="instruction" /><AppText style={styles.title}>{t('support.feedbackTitle')}</AppText><AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('support.feedbackBody')}</AppText></View>
    <InfoNotice tone="info" title={t('support.purposeTitle')} body={t('support.purposeBody')} />
    {error ? <InfoNotice tone="warning" title={t('support.messageTitle')} body={error} /> : null}
    <AppCard><AppText style={styles.sectionTitle}>{t('support.createTicketShort')}</AppText>
      <AppText style={styles.label}>{t('support.category')}</AppText><View style={styles.wrap}>{categories.map((item) => <TouchableOpacity key={item} onPress={() => setCategory(item)}><SemanticBadge label={t(`support.categories.${item}`)} tone={category === item ? categoryTone(item) : 'muted'} /></TouchableOpacity>)}</View>
      <AppText style={styles.label}>{t('support.priority')}</AppText><View style={styles.wrap}>{priorities.map((item) => <TouchableOpacity key={item} onPress={() => setPriority(item)}><SemanticBadge label={t(`support.priorities.${item}`)} tone={priority === item ? priorityTone(item) : 'muted'} /></TouchableOpacity>)}</View>
      <TextInput value={subject} onChangeText={setSubject} placeholder={t('support.subjectPlaceholderShort')} placeholderTextColor={theme.color.muted} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
      <TextInput value={message} onChangeText={setMessage} placeholder={t('support.messagePlaceholderNative')} placeholderTextColor={theme.color.muted} style={[styles.input, styles.textArea, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} multiline textAlignVertical="top" />
      <ImagePickerField images={images} onChange={setImages} disabled={submitting} label={t('support.screenshots')} hint={t('support.screenshotsHint')} />
      <Button title={submitting ? t('common.states.submitting') : t('support.submitTicket')} disabled={submitting} onPress={() => { void createTicket(); }} />
    </AppCard>
    <AppCard><AppText style={styles.sectionTitle}>{t('support.myTickets')}</AppText>{tickets.length === 0 ? <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('support.noTicketsNative')}</AppText> : tickets.map((ticket) => <TouchableOpacity key={ticket.id} onPress={() => navigation.navigate('SupportTicketDetail', { ticketId: ticket.id, subject: ticket.subject })} style={[styles.ticketCard, { borderTopColor: theme.color.border }]}><View style={styles.ticketHeader}><StatusBadge status={ticket.status} size="sm" /><SemanticBadge label={t(`support.categories.${ticket.category}`)} tone={categoryTone(ticket.category)} size="sm" /><SemanticBadge label={t(`support.priorities.${ticket.priority}`)} tone={priorityTone(ticket.priority)} size="sm" /></View><AppText style={styles.ticketTitle}>{ticket.subject}</AppText><AppText style={[styles.cardText, { color: theme.color.muted }]} numberOfLines={2}>{ticket.message}</AppText><MediaStrip media={ticket.media} /><AppText style={styles.dateText}>{formatLocalizedDateTime(ticket.updatedAt, language)}</AppText></TouchableOpacity>)}</AppCard>
  </ScrollView></AppScreen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { lineHeight: 20, fontWeight: '700' },
  sectionTitle: { fontSize: 22, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, fontWeight: '700' },
  textArea: { minHeight: 110 },
  cardText: { lineHeight: 20, fontWeight: '600' },
  ticketCard: { borderTopWidth: 1, paddingTop: 12, gap: 7 },
  ticketHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ticketTitle: { fontSize: 17, fontWeight: '900' },
  dateText: { fontSize: 12, fontWeight: '800' },
});
