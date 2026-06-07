import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReportTargetType, TradePublicMessageDto } from '@hellowhen/contracts';
import { formatLocalizedDate, formatLocalizedDateTime, type SupportedLanguage } from '@hellowhen/i18n';
import type { ThemeTokens } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppActionSheet, type AppActionSheetAction } from '../../components/AppActionSheet';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { APP_SCREEN_HORIZONTAL_PADDING } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice } from '../../components/SemanticUI';
import { ReportContentPanel } from '../../components/ReportContentPanel';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { UserIdentityPressable } from '../users/UserIdentityPressable';
import type { TradeOwnerPreview } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'TradePublicDiscussion'>;
type MessagesResponse = { messages: TradePublicMessageItem[] };
type MessageResponse = { message: TradePublicMessageItem };
type TradePublicMessageItem = TradePublicMessageDto & { author?: TradeOwnerPreview | null };
type MessageActionTarget = { messageId: string; mode: 'edit' } | null;
type MessageActionSheet = { type: 'own'; message: TradePublicMessageItem } | { type: 'report'; message: TradePublicMessageItem } | null;
type FullScreenMode =
  | { type: 'guide' }
  | { type: 'report'; title: string; targetType: ReportTargetType; targetId: string; labelKey: string; helperKey: string }
  | null;

type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

function dayKey(value: string | null | undefined) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toISOString().slice(0, 10);
}

function dateSeparatorLabel(value: string | null | undefined, language: SupportedLanguage, t: TFunction) {
  if (!value) return t('trade.publicDiscussion.unknownDate');
  return formatLocalizedDate(value, language, t('trade.publicDiscussion.unknownDate'));
}

function timeLabel(value: string | null | undefined, language: SupportedLanguage) {
  if (!value) return '';
  return formatLocalizedDateTime(value, language, '');
}

function messageDisplayName(message: TradePublicMessageItem, currentUserId: string | undefined, t: TFunction) {
  if (message.authorId === currentUserId) return t('trade.labels.you');
  return message.author?.profile?.displayName || message.author?.profile?.handle || t('trade.labels.member');
}

export function TradePublicDiscussionScreen({ route, navigation }: Props) {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState<TradePublicMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [editDraft, setEditDraft] = useState('');
  const [actionTarget, setActionTarget] = useState<MessageActionTarget>(null);
  const [actionSheet, setActionSheet] = useState<MessageActionSheet>(null);
  const [threadMenuVisible, setThreadMenuVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TradePublicMessageItem | null>(null);
  const [fullScreenMode, setFullScreenMode] = useState<FullScreenMode>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.publicMessages(route.params.tradeId, { take: 100 }) as MessagesResponse;
      setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (caughtError) {
      setMessages([]);
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.publicDiscussion.couldNotLoad')));
    } finally {
      setLoading(false);
    }
  }, [route.params.tradeId, t]);

  useFocusEffect(useCallback(() => { void loadMessages(); }, [loadMessages]));

  const groupedRows = useMemo(() => {
    const rows: Array<{ type: 'date'; key: string; label: string } | { type: 'message'; key: string; message: TradePublicMessageItem }> = [];
    let previousDay = '';
    for (const message of messages) {
      const nextDay = dayKey(message.createdAt);
      if (nextDay !== previousDay) {
        rows.push({ type: 'date', key: `date-${nextDay}-${message.id}`, label: dateSeparatorLabel(message.createdAt, language, t) });
        previousDay = nextDay;
      }
      rows.push({ type: 'message', key: message.id, message });
    }
    return rows;
  }, [language, messages, t]);

  async function sendMessage() {
    const body = draft.trim();
    if (body.length < 1 || sending) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.trades.sendPublicMessage(route.params.tradeId, { body }) as MessageResponse;
      setMessages((current) => [...current, result.message]);
      setDraft('');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.publicDiscussion.couldNotSend')));
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(messageId: string) {
    const body = editDraft.trim();
    if (body.length < 1) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.trades.updatePublicMessage(route.params.tradeId, messageId, { body }) as MessageResponse;
      setMessages((current) => current.map((message) => message.id === messageId ? result.message : message));
      setActionTarget(null);
      setActionSheet(null);
      setEditDraft('');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.publicDiscussion.couldNotUpdate')));
    } finally {
      setSending(false);
    }
  }


  async function deleteMessage(messageId: string) {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.trades.deletePublicMessage(route.params.tradeId, messageId) as MessageResponse;
      setMessages((current) => current.map((message) => message.id === messageId ? result.message : message));
      setNotice(t('trade.publicDiscussion.messageDeleted'));
      setActionTarget(null);
      setActionSheet(null);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.publicDiscussion.couldNotDelete')));
    } finally {
      setSending(false);
    }
  }

  function openOwnActions(message: TradePublicMessageItem) {
    if (message.status === 'deleted') return;
    setActionSheet({ type: 'own', message });
  }

  function openReport(message: TradePublicMessageItem) {
    if (message.status === 'deleted') return;
    setActionSheet({ type: 'report', message });
  }

  const openTradeDetail = useCallback(() => {
    navigation.navigate('TradeDetail', { tradeId: route.params.tradeId, title: route.params.title });
  }, [navigation, route.params.title, route.params.tradeId]);

  let actionSheetActions: AppActionSheetAction[] = [];
  if (actionSheet?.type === 'own') {
    const message = actionSheet.message;
    actionSheetActions = [
      {
        key: 'edit',
        label: t('trade.publicDiscussion.editMessage'),
        icon: 'more',
        onPress: () => {
          setActionTarget({ messageId: message.id, mode: 'edit' });
          setEditDraft(message.body);
          setActionSheet(null);
        },
      },
      {
        key: 'delete',
        label: t('trade.publicDiscussion.deleteMessage'),
        helper: t('trade.publicDiscussion.deleteConfirmShort'),
        icon: 'report-flag',
        tone: 'danger',
        onPress: () => {
          setActionSheet(null);
          setDeleteTarget(message);
        },
      },
    ];
  } else if (actionSheet?.type === 'report') {
    const message = actionSheet.message;
    actionSheetActions = [
      {
        key: 'report',
        label: t('trade.publicDiscussion.reportMessage'),
        helper: t('trade.publicDiscussion.messageMenuHintOther'),
        icon: 'report-flag',
        tone: 'danger',
        onPress: () => {
          setActionSheet(null);
          setFullScreenMode({
            type: 'report',
            title: t('trade.publicDiscussion.reportMessage'),
            targetType: 'public_message',
            targetId: message.id,
            labelKey: 'report.publicMessage',
            helperKey: 'report.helper.publicMessage',
          });
        },
      },
    ];
  }

  const threadMenuActions: AppActionSheetAction[] = [
    {
      key: 'details',
      label: t('trade.publicDiscussion.seeDetails'),
      icon: 'chevron-right',
      onPress: () => {
        setThreadMenuVisible(false);
        openTradeDetail();
      },
    },
    {
      key: 'guide',
      label: t('trade.publicDiscussion.seeGuide'),
      icon: 'proposal',
      onPress: () => {
        setThreadMenuVisible(false);
        setFullScreenMode({ type: 'guide' });
      },
    },
    {
      key: 'report',
      label: t('trade.publicDiscussion.reportThread'),
      helper: t('report.helper.trade'),
      icon: 'report-flag',
      tone: 'danger',
      onPress: () => {
        setThreadMenuVisible(false);
        setFullScreenMode({ type: 'report', title: t('trade.publicDiscussion.reportThread'), targetType: 'trade', targetId: route.params.tradeId, labelKey: 'report.trade', helperKey: 'report.helper.trade' });
      },
    },
  ];

  const canSend = draft.trim().length > 0 && !sending;

  if (fullScreenMode?.type === 'guide') {
    return <PublicThreadGuideScreen onClose={() => setFullScreenMode(null)} t={t} />;
  }

  if (fullScreenMode?.type === 'report') {
    return <PublicThreadReportScreen mode={fullScreenMode} onClose={() => setFullScreenMode(null)} />;
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('trade.publicDiscussion.title')} onBack={() => navigation.goBack()} rightSlot={<ThreadMenuButton label={t('trade.publicDiscussion.threadMenuTitle')} onPress={() => setThreadMenuVisible(true)} />} />}>
      <KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadMessages(); }} />}
        >
          {error ? <InfoNotice tone="danger" title={t('trade.detail.tradeError')} body={error} /> : null}
          {notice ? <AppText style={[styles.feedbackText, { color: theme.color.muted }]}>{notice}</AppText> : null}
          {groupedRows.length === 0 && !loading ? <EmptyDiscussion theme={theme} t={t} /> : null}
          {groupedRows.map((row) => row.type === 'date' ? (
            <View key={row.key} style={styles.dateSeparator}><View style={[styles.dateLine, { backgroundColor: theme.color.border }]} /><AppText style={[styles.dateText, { color: theme.color.muted }]}>{row.label}</AppText><View style={[styles.dateLine, { backgroundColor: theme.color.border }]} /></View>
          ) : (
            <PublicMessageRow
              key={row.key}
              message={row.message}
              currentUserId={auth.user?.id}
              actionTarget={actionTarget?.messageId === row.message.id ? actionTarget : null}
              editDraft={editDraft}
              sending={sending}
              theme={theme}
              t={t}
              language={language}
              onChangeEdit={setEditDraft}
              onSaveEdit={() => { void saveEdit(row.message.id); }}
              onCancelAction={() => { setActionTarget(null); setEditDraft(''); }}
              onOwnActions={() => openOwnActions(row.message)}
              onReport={() => openReport(row.message)}
            />
          ))}
        </ScrollView>
        <View style={[styles.composer, { backgroundColor: theme.color.background, borderColor: theme.color.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('trade.publicDiscussion.placeholder')}
            placeholderTextColor={theme.color.muted}
            multiline
            textAlignVertical="top"
            style={[styles.composerInput, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]}
          />
          <Pressable accessibilityRole="button" disabled={!canSend} onPress={() => { void sendMessage(); }} style={({ pressed }) => [styles.sendButton, { backgroundColor: theme.color.text }, (!canSend) && styles.disabled, pressed && canSend && styles.pressed]}>
            <MobileIcon name="proposal" size={18} color={theme.color.background} />
            <AppText style={[styles.sendText, { color: theme.color.background }]}>{sending ? t('common.states.sending') : t('common.actions.send')}</AppText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <AppActionSheet
        visible={Boolean(actionSheet)}
        title={t('trade.publicDiscussion.messageActions')}
        body={actionSheet?.type === 'own' ? t('trade.publicDiscussion.messageMenuHintOwn') : actionSheet?.type === 'report' ? t('trade.publicDiscussion.messageMenuHintOther') : undefined}
        actions={actionSheetActions}
        cancelLabel={t('common.actions.cancel')}
        onClose={() => setActionSheet(null)}
      />
      <AppActionSheet
        visible={threadMenuVisible}
        title={t('trade.publicDiscussion.threadMenuTitle')}
        actions={threadMenuActions}
        cancelLabel={t('common.actions.cancel')}
        onClose={() => setThreadMenuVisible(false)}
      />
      <AppConfirmSheet
        visible={Boolean(deleteTarget)}
        title={t('trade.publicDiscussion.deleteConfirmTitle')}
        body={t('trade.publicDiscussion.deleteConfirm')}
        cancelLabel={t('common.actions.cancel')}
        confirmLabel={t('trade.publicDiscussion.deleteMessage')}
        tone="danger"
        confirmDisabled={sending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteMessage(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </AppFixedHeaderScreen>
  );
}

function ThreadMenuButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.headerMenuButton, pressed && styles.pressed]}>
      <MobileIcon name="more" size={23} color={theme.color.text} />
    </Pressable>
  );
}

function PublicThreadGuideScreen({ onClose, t }: { onClose: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const items = [
    { title: t('trade.publicDiscussion.guideVisibleTitle'), body: t('trade.publicDiscussion.guideVisibleBody') },
    { title: t('trade.publicDiscussion.guidePrivateTitle'), body: t('trade.publicDiscussion.guidePrivateBody') },
    { title: t('trade.publicDiscussion.guideModerationTitle'), body: t('trade.publicDiscussion.guideModerationBody') },
  ];

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('trade.publicDiscussion.guideTitle')} onBack={onClose} />}>
      <ScrollView contentContainerStyle={styles.infoContent} showsVerticalScrollIndicator={false}>
        <AppText style={styles.infoTitle}>{t('trade.publicDiscussion.guideIntroTitle')}</AppText>
        <AppText style={[styles.infoBody, { color: theme.color.muted }]}>{t('trade.publicDiscussion.guideIntroBody')}</AppText>
        <View style={[styles.fullBleedDivider, { backgroundColor: theme.color.border }]} />
        {items.map((item) => (
          <View key={item.title} style={styles.infoSection}>
            <AppText style={styles.infoSectionTitle}>{item.title}</AppText>
            <AppText style={[styles.infoBody, { color: theme.color.muted }]}>{item.body}</AppText>
          </View>
        ))}
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function PublicThreadReportScreen({ mode, onClose }: { mode: Extract<FullScreenMode, { type: 'report' }>; onClose: () => void }) {
  return (
    <AppFixedHeaderScreen header={<AppHeader title={mode.title} onBack={onClose} />}>
      <ScrollView contentContainerStyle={styles.infoContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ReportContentPanel targetType={mode.targetType} targetId={mode.targetId} labelKey={mode.labelKey} helperKey={mode.helperKey} initialOpen />
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function EmptyDiscussion({ theme, t }: { theme: ThemeTokens; t: TFunction }) {
  return (
    <View style={styles.emptyBox}>
      <AppText style={styles.emptyTitle}>{t('trade.publicDiscussion.emptyTitle')}</AppText>
      <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{t('trade.publicDiscussion.emptyBody')}</AppText>
    </View>
  );
}

function PublicMessageRow({ message, currentUserId, actionTarget, editDraft, sending, theme, t, language, onChangeEdit, onSaveEdit, onCancelAction, onOwnActions, onReport }: { message: TradePublicMessageItem; currentUserId?: string; actionTarget: MessageActionTarget; editDraft: string; sending: boolean; theme: ThemeTokens; t: TFunction; language: SupportedLanguage; onChangeEdit: (value: string) => void; onSaveEdit: () => void; onCancelAction: () => void; onOwnActions: () => void; onReport: () => void }) {
  const isOwn = message.authorId === currentUserId;
  const deleted = message.status === 'deleted' || Boolean(message.deletedAt);
  const actionMode = actionTarget?.mode ?? null;
  return (
    <Pressable onLongPress={isOwn ? onOwnActions : onReport} style={[styles.messageRow, { borderColor: theme.color.border }]}>
      <View style={styles.messageHeader}>
        <UserIdentityPressable user={message.author} userId={message.authorId} displayName={messageDisplayName(message, currentUserId, t)} variant="row" subtitle={timeLabel(message.createdAt, language)} style={styles.messageIdentity} />
        {deleted ? null : (
          <Pressable accessibilityRole="button" onPress={isOwn ? onOwnActions : onReport} style={({ pressed }) => [styles.messageMenuButton, pressed && styles.pressed]}>
            <MobileIcon name="more" size={19} color={theme.color.muted} />
          </Pressable>
        )}
      </View>
      {actionMode === 'edit' ? (
        <View style={styles.editBox}>
          <TextInput value={editDraft} onChangeText={onChangeEdit} multiline textAlignVertical="top" style={[styles.editInput, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
          <View style={styles.actionRow}>
            <SmallAction label={t('common.actions.save')} disabled={sending || editDraft.trim().length < 1} tone="primary" theme={theme} onPress={onSaveEdit} />
            <SmallAction label={t('common.actions.cancel')} disabled={sending} tone="ghost" theme={theme} onPress={onCancelAction} />
          </View>
        </View>
      ) : (
        <>
          <AppText style={[deleted ? styles.deletedBody : styles.messageBody, { color: deleted ? theme.color.muted : theme.color.text }]}>{deleted ? t('trade.publicDiscussion.messageDeleted') : message.body}</AppText>
          {message.editedAt && !deleted ? <AppText style={[styles.traceText, { color: theme.color.muted }]}>{t('trade.publicDiscussion.edited', { date: timeLabel(message.editedAt, language) })}</AppText> : null}
        </>
      )}
    </Pressable>
  );
}

function SmallAction({ label, tone, disabled, theme, onPress }: { label: string; tone: 'primary' | 'ghost' | 'danger'; disabled?: boolean; theme: ThemeTokens; onPress: () => void }) {
  const backgroundColor = tone === 'primary' ? theme.color.text : tone === 'danger' ? theme.semantic.danger.softBg : theme.color.surface;
  const borderColor = tone === 'primary' ? theme.color.text : tone === 'danger' ? theme.semantic.danger.border : theme.color.border;
  const color = tone === 'primary' ? theme.color.background : tone === 'danger' ? theme.semantic.danger.text : theme.color.text;
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.smallAction, { backgroundColor, borderColor }, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><AppText style={[styles.smallActionText, { color }]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: { paddingTop: 4, paddingBottom: 18, gap: 0 },
  headerMenuButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  feedbackText: { marginBottom: 8, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  infoContent: { paddingBottom: 28, gap: 16 },
  infoTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.45 },
  infoBody: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  infoSection: { gap: 6 },
  infoSectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.15 },
  fullBleedDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: -APP_SCREEN_HORIZONTAL_PADDING },
  emptyBox: { paddingVertical: 26, gap: 8 },
  emptyTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.3 },
  emptyBody: { lineHeight: 20, fontWeight: '700' },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, marginHorizontal: -APP_SCREEN_HORIZONTAL_PADDING, paddingHorizontal: APP_SCREEN_HORIZONTAL_PADDING },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  messageRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 13, gap: 8, marginHorizontal: -APP_SCREEN_HORIZONTAL_PADDING, paddingHorizontal: APP_SCREEN_HORIZONTAL_PADDING },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  messageIdentity: { flex: 1 },
  messageMenuButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  messageBody: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  deletedBody: { fontSize: 15, lineHeight: 22, fontWeight: '800', fontStyle: 'italic' },
  traceText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  editBox: { gap: 9 },
  editInput: { minHeight: 92, borderRadius: 16, borderWidth: 1, padding: 12, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallAction: { minHeight: 38, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  smallActionText: { fontSize: 13, fontWeight: '900' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: -APP_SCREEN_HORIZONTAL_PADDING, paddingHorizontal: APP_SCREEN_HORIZONTAL_PADDING, paddingTop: 10, paddingBottom: 10, gap: 8 },
  composerInput: { minHeight: 48, maxHeight: 118, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  sendButton: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  sendText: { fontWeight: '900' },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
