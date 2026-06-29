import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PlanPublicMessageDto, ReportTargetType } from '@hellowhen/contracts';
import { formatLocalizedDate, formatLocalizedDateTime, type SupportedLanguage } from '@hellowhen/i18n';
import type { ThemeTokens } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { AppActionSheet, type AppActionSheetAction } from '../../components/AppActionSheet';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { APP_SCREEN_HORIZONTAL_PADDING } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { KeyboardDoneAccessory, KEYBOARD_DONE_ACCESSORY_ID } from '../../components/KeyboardDoneAccessory';
import { MobileIcon } from '../../components/MobileIcon';
import { ReportContentPanel } from '../../components/ReportContentPanel';
import { InfoNotice } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { UserIdentityPressable } from '../users/UserIdentityPressable';
import type { TradeOwnerPreview } from '../trade/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanPublicDiscussion'>;
type MessagesResponse = { messages: PlanPublicMessageItem[] };
type MessageResponse = { message: PlanPublicMessageItem };
type PlanPublicMessageItem = PlanPublicMessageDto & { author?: TradeOwnerPreview | null };
type MessageActionTarget = { messageId: string; mode: 'edit' } | null;
type MessageActionSheet = { type: 'own'; message: PlanPublicMessageItem } | { type: 'report'; message: PlanPublicMessageItem } | null;
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

function dateSeparatorLabel(value: string | null | undefined, language: SupportedLanguage) {
  if (!value) return 'Unknown date';
  return formatLocalizedDate(value, language, 'Unknown date');
}

function timeLabel(value: string | null | undefined, language: SupportedLanguage) {
  if (!value) return '';
  return formatLocalizedDateTime(value, language, '');
}

function messageDisplayName(message: PlanPublicMessageItem, currentUserId: string | undefined) {
  if (message.authorId === currentUserId) return 'You';
  return message.author?.profile?.displayName || message.author?.profile?.handle || 'Hellowhen member';
}

export function PlanPublicDiscussionScreen({ route, navigation }: Props) {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const composerInputRef = useRef<TextInput>(null);
  const auth = useAuth();
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState<PlanPublicMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [editDraft, setEditDraft] = useState('');
  const [actionTarget, setActionTarget] = useState<MessageActionTarget>(null);
  const [actionSheet, setActionSheet] = useState<MessageActionSheet>(null);
  const [threadMenuVisible, setThreadMenuVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlanPublicMessageItem | null>(null);
  const [fullScreenMode, setFullScreenMode] = useState<FullScreenMode>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.plans.publicMessages(route.params.planId, { take: 100 }) as MessagesResponse;
      setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (caughtError) {
      setMessages([]);
      setError(getFriendlyApiErrorMessage(caughtError, 'Could not load Plan discussion.'));
    } finally {
      setLoading(false);
    }
  }, [route.params.planId]);

  useFocusEffect(useCallback(() => { void loadMessages(); }, [loadMessages]));

  const groupedRows = useMemo(() => {
    const rows: Array<{ type: 'date'; key: string; label: string } | { type: 'message'; key: string; message: PlanPublicMessageItem }> = [];
    let previousDay = '';
    for (const message of messages) {
      const nextDay = dayKey(message.createdAt);
      if (nextDay !== previousDay) {
        rows.push({ type: 'date', key: `date-${nextDay}-${message.id}`, label: dateSeparatorLabel(message.createdAt, language) });
        previousDay = nextDay;
      }
      rows.push({ type: 'message', key: message.id, message });
    }
    return rows;
  }, [language, messages]);

  async function sendMessage() {
    const body = draft.trim();
    if (body.length < 1 || sending) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.plans.sendPublicMessage(route.params.planId, { body }) as MessageResponse;
      setMessages((current) => [...current, result.message]);
      setDraft('');
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, 'Could not send your comment.'));
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
      const result = await api.plans.updatePublicMessage(route.params.planId, messageId, { body }) as MessageResponse;
      setMessages((current) => current.map((message) => message.id === messageId ? result.message : message));
      setActionTarget(null);
      setActionSheet(null);
      setEditDraft('');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, 'Could not update your comment.'));
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(messageId: string) {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.plans.deletePublicMessage(route.params.planId, messageId) as MessageResponse;
      setMessages((current) => current.map((message) => message.id === messageId ? result.message : message));
      setNotice('Comment deleted.');
      setActionTarget(null);
      setActionSheet(null);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, 'Could not delete your comment.'));
    } finally {
      setSending(false);
    }
  }

  function openOwnActions(message: PlanPublicMessageItem) {
    if (message.status === 'deleted') return;
    setActionSheet({ type: 'own', message });
  }

  function openReport(message: PlanPublicMessageItem) {
    if (message.status === 'deleted') return;
    setActionSheet({ type: 'report', message });
  }

  const openPlanDetail = useCallback(() => {
    navigation.navigate('PlanDetail', { planId: route.params.planId, title: route.params.title });
  }, [navigation, route.params.planId, route.params.title]);

  let actionSheetActions: AppActionSheetAction[] = [];
  if (actionSheet?.type === 'own') {
    const message = actionSheet.message;
    actionSheetActions = [
      {
        key: 'edit',
        label: 'Edit comment',
        icon: 'more',
        onPress: () => {
          setActionTarget({ messageId: message.id, mode: 'edit' });
          setEditDraft(message.body);
          setActionSheet(null);
        },
      },
      {
        key: 'delete',
        label: 'Delete comment',
        helper: 'Deleted comments stay as a small trace in the public discussion.',
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
        label: 'Report comment',
        helper: 'Report spam, scams, harassment, or unsafe content.',
        icon: 'report-flag',
        tone: 'danger',
        onPress: () => {
          setActionSheet(null);
          setFullScreenMode({ type: 'report', title: 'Report comment', targetType: 'public_message', targetId: message.id, labelKey: 'report.publicMessage', helperKey: 'report.helper.publicMessage' });
        },
      },
    ];
  }

  const threadMenuActions: AppActionSheetAction[] = [
    {
      key: 'details',
      label: 'See Plan details',
      helper: 'Go back to the route, details, and join actions.',
      icon: 'plan',
      onPress: () => {
        setThreadMenuVisible(false);
        openPlanDetail();
      },
    },
    {
      key: 'guide',
      label: 'How public comments work',
      helper: 'A short guide for Plan discussion.',
      icon: 'help',
      onPress: () => {
        setThreadMenuVisible(false);
        setFullScreenMode({ type: 'guide' });
      },
    },
    {
      key: 'report',
      label: 'Report this Plan',
      helper: 'Report the Plan if the public page feels unsafe or misleading.',
      icon: 'report-flag',
      tone: 'danger',
      onPress: () => {
        setThreadMenuVisible(false);
        setFullScreenMode({ type: 'report', title: 'Report Plan', targetType: 'plan', targetId: route.params.planId, labelKey: 'report.button', helperKey: 'report.helper.content' });
      },
    },
  ];

  function startReply(message: PlanPublicMessageItem) {
    if (message.status === 'deleted') return;
    const authorName = messageDisplayName(message, auth.user?.id);
    const mention = `@${authorName} `;
    setDraft((current) => current.trim().length ? `${current.trimEnd()}\n${mention}` : mention);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }

  const canSend = draft.trim().length > 0 && !sending;
  const contextTitle = route.params.title || 'Plan';

  if (fullScreenMode?.type === 'guide') {
    return <PlanThreadGuideScreen onClose={() => setFullScreenMode(null)} />;
  }

  if (fullScreenMode?.type === 'report') {
    return <PlanThreadReportScreen mode={fullScreenMode} onClose={() => setFullScreenMode(null)} />;
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Public discussion" onBack={() => navigation.goBack()} rightSlot={<ThreadMenuButton label="Discussion options" onPress={() => setThreadMenuVisible(true)} />} />}>
      <KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <PublicThreadContextStrip
          label="Plan context"
          title={contextTitle}
          actionLabel="View Plan"
          theme={theme}
          onPress={openPlanDetail}
        />
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 18 + Math.max(10, insets.bottom + 8) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadMessages(); }} />}
        >
          {error ? <InfoNotice tone="danger" title="Discussion unavailable" body={error} /> : null}
          {notice ? <AppText style={[styles.feedbackText, { color: theme.color.muted }]}>{notice}</AppText> : null}
          {groupedRows.length === 0 && loading ? <LoadingDiscussion theme={theme} label={t('common.states.loading')} /> : null}
          {groupedRows.length === 0 && !loading ? <EmptyDiscussion theme={theme} /> : null}
          {groupedRows.map((row) => row.type === 'date' ? (
            <View key={row.key} style={styles.dateSeparator}><View style={[styles.dateLine, { backgroundColor: theme.color.border }]} /><AppText style={[styles.dateText, { color: theme.color.muted }]}>{row.label}</AppText><View style={[styles.dateLine, { backgroundColor: theme.color.border }]} /></View>
          ) : (
            <PlanPublicMessageRow
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
              onReply={() => startReply(row.message)}
              onReport={() => openReport(row.message)}
            />
          ))}
        </ScrollView>
        <KeyboardDoneAccessory />
        <View style={[styles.composer, { backgroundColor: theme.color.background, borderColor: theme.color.border, paddingBottom: Math.max(10, insets.bottom + 8) }]}>
          <View style={styles.composerInner}>
            <TextInput
              ref={composerInputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Comment publicly on this Plan..."
              placeholderTextColor={theme.color.muted}
              multiline
              editable={!sending}
              textAlignVertical="top"
              inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
              returnKeyType="default"
              blurOnSubmit={false}
              style={[styles.composerInput, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]}
            />
            <Pressable accessibilityRole="button" disabled={!canSend} onPress={() => { void sendMessage(); }} style={({ pressed }) => [styles.sendButton, { backgroundColor: theme.color.text }, (!canSend) && styles.disabled, pressed && canSend && styles.pressed]}>
              <MobileIcon name="proposal" size={18} color={theme.color.background} />
              <AppText style={[styles.sendText, { color: theme.color.background }]}>{sending ? t('common.states.sending') : t('common.actions.send')}</AppText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <AppActionSheet
        visible={Boolean(actionSheet)}
        title="Comment actions"
        body={actionSheet?.type === 'own' ? 'Edit or delete your public comment.' : actionSheet?.type === 'report' ? 'Report this comment if it breaks community rules.' : undefined}
        actions={actionSheetActions}
        cancelLabel={t('common.actions.cancel')}
        onClose={() => setActionSheet(null)}
      />
      <AppActionSheet
        visible={threadMenuVisible}
        title="Public discussion"
        body="Comments are public and visible to logged-in members. Keep details safe and respectful."
        actions={threadMenuActions}
        cancelLabel={t('common.actions.cancel')}
        onClose={() => setThreadMenuVisible(false)}
      />
      <AppConfirmSheet
        visible={Boolean(deleteTarget)}
        title="Delete comment?"
        body="This removes the comment text from the public discussion."
        cancelLabel={t('common.actions.cancel')}
        confirmLabel="Delete comment"
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

function PlanThreadGuideScreen({ onClose }: { onClose: () => void }) {
  const theme = useThemeTokens();
  const items = [
    { title: 'Public by default', body: 'These comments are visible to logged-in Hellowhen members who can open this Plan.' },
    { title: 'Use it for questions', body: 'Ask about the route, timing, meeting point, or whether there is still room to join.' },
    { title: 'Stay safe', body: 'Do not post private addresses, passwords, payment details, or sensitive documents in public comments.' },
  ];

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Plan discussion" onBack={onClose} />}>
      <ScrollView contentContainerStyle={styles.infoContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        <AppText style={styles.infoTitle}>How Plan comments work</AppText>
        <AppText style={[styles.infoBody, { color: theme.color.muted }]}>Use the public discussion for visible questions and updates. Private Plan threads can come later.</AppText>
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

function PlanThreadReportScreen({ mode, onClose }: { mode: Extract<FullScreenMode, { type: 'report' }>; onClose: () => void }) {
  return (
    <AppFixedHeaderScreen header={<AppHeader title={mode.title} onBack={onClose} />}>
      <ScrollView contentContainerStyle={styles.infoContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ReportContentPanel targetType={mode.targetType} targetId={mode.targetId} labelKey={mode.labelKey} helperKey={mode.helperKey} initialOpen />
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function PublicThreadContextStrip({ label, title, actionLabel, theme, onPress }: { label: string; title: string; actionLabel: string; theme: ThemeTokens; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel}: ${title}`} onPress={onPress} style={({ pressed }) => [styles.contextStrip, { borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={[styles.contextIcon, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        <MobileIcon name="plan" size={18} color={theme.color.text} decorative />
      </View>
      <View style={styles.contextCopy}>
        <AppText style={[styles.contextLabel, { color: theme.color.muted }]}>{label}</AppText>
        <AppText style={styles.contextTitle} numberOfLines={1}>{title}</AppText>
      </View>
      <AppText style={[styles.contextAction, { color: theme.color.muted }]}>{actionLabel}</AppText>
    </Pressable>
  );
}

function LoadingDiscussion({ theme, label }: { theme: ThemeTokens; label: string }) {
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={theme.color.text} />
      <AppText style={[styles.loadingText, { color: theme.color.muted }]}>{label}</AppText>
    </View>
  );
}

function EmptyDiscussion({ theme }: { theme: ThemeTokens }) {
  return (
    <View style={styles.emptyBox}>
      <AppText style={styles.emptyTitle}>No comments yet</AppText>
      <AppText style={[styles.emptyBody, { color: theme.color.muted }]}>Ask a public question or start a friendly discussion around this Plan.</AppText>
    </View>
  );
}

function PlanPublicMessageRow({ message, currentUserId, actionTarget, editDraft, sending, theme, t, language, onChangeEdit, onSaveEdit, onCancelAction, onOwnActions, onReply, onReport }: { message: PlanPublicMessageItem; currentUserId?: string; actionTarget: MessageActionTarget; editDraft: string; sending: boolean; theme: ThemeTokens; t: TFunction; language: SupportedLanguage; onChangeEdit: (value: string) => void; onSaveEdit: () => void; onCancelAction: () => void; onOwnActions: () => void; onReply: () => void; onReport: () => void }) {
  const isOwn = message.authorId === currentUserId;
  const deleted = message.status === 'deleted' || Boolean(message.deletedAt);
  const actionMode = actionTarget?.mode ?? null;
  return (
    <Pressable onLongPress={isOwn ? onOwnActions : onReport} style={[styles.messageRow, { borderColor: theme.color.border }]}>
      <View style={styles.messageHeader}>
        <UserIdentityPressable user={message.author} userId={message.authorId} displayName={messageDisplayName(message, currentUserId)} variant="row" subtitle={timeLabel(message.createdAt, language)} style={styles.messageIdentity} />
        {deleted ? null : (
          <Pressable accessibilityRole="button" onPress={isOwn ? onOwnActions : onReport} style={({ pressed }) => [styles.messageMenuButton, pressed && styles.pressed]}>
            <MobileIcon name="more" size={19} color={theme.color.muted} />
          </Pressable>
        )}
      </View>
      {actionMode === 'edit' ? (
        <View style={styles.editBox}>
          <TextInput value={editDraft} onChangeText={onChangeEdit} multiline textAlignVertical="top" inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="default" blurOnSubmit={false} style={[styles.editInput, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
          <View style={styles.actionRow}>
            <SmallAction label={t('common.actions.save')} disabled={sending || editDraft.trim().length < 1} tone="primary" theme={theme} onPress={onSaveEdit} />
            <SmallAction label={t('common.actions.cancel')} disabled={sending} tone="ghost" theme={theme} onPress={onCancelAction} />
          </View>
        </View>
      ) : (
        <>
          <AppText style={[deleted ? styles.deletedBody : styles.messageBody, { color: deleted ? theme.color.muted : theme.color.text }]}>{deleted ? 'Comment deleted.' : message.body}</AppText>
          {message.editedAt && !deleted ? <AppText style={[styles.traceText, { color: theme.color.muted }]}>Edited {timeLabel(message.editedAt, language)}</AppText> : null}
          {!deleted ? (
            <View style={styles.messageActionRow}>
              <InlineCommentAction label={t('trade.proposals.reply')} theme={theme} onPress={onReply} />
              <InlineCommentAction label={isOwn ? 'Comment actions' : 'Report comment'} tone={isOwn ? 'default' : 'danger'} theme={theme} onPress={isOwn ? onOwnActions : onReport} />
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function InlineCommentAction({ label, tone = 'default', theme, onPress }: { label: string; tone?: 'default' | 'danger'; theme: ThemeTokens; onPress: () => void }) {
  const color = tone === 'danger' ? theme.semantic.danger.text : theme.color.muted;
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.inlineCommentAction, pressed && styles.pressed]}>
      <AppText style={[styles.inlineCommentActionText, { color }]}>{label}</AppText>
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
  shell: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  content: { paddingTop: 8, gap: 0 },
  headerMenuButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  contextStrip: { marginHorizontal: -APP_SCREEN_HORIZONTAL_PADDING, paddingHorizontal: APP_SCREEN_HORIZONTAL_PADDING, paddingTop: 2, paddingBottom: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  contextIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  contextCopy: { flex: 1, minWidth: 0, gap: 2 },
  contextLabel: { fontSize: 11, lineHeight: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.55 },
  contextTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900', letterSpacing: -0.15 },
  contextAction: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  feedbackText: { marginBottom: 8, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 34, gap: 10 },
  loadingText: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  infoContent: { paddingBottom: 28, gap: 16 },
  infoTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.45 },
  infoBody: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  infoSection: { gap: 6 },
  infoSectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.15 },
  fullBleedDivider: { height: 2, marginHorizontal: -APP_SCREEN_HORIZONTAL_PADDING },
  emptyBox: { paddingVertical: 26, gap: 8 },
  emptyTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.3 },
  emptyBody: { lineHeight: 20, fontWeight: '700' },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, marginHorizontal: -APP_SCREEN_HORIZONTAL_PADDING, paddingHorizontal: APP_SCREEN_HORIZONTAL_PADDING },
  dateLine: { flex: 1, height: 1 },
  dateText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  messageRow: { borderBottomWidth: 1, paddingVertical: 14, gap: 8, marginHorizontal: -APP_SCREEN_HORIZONTAL_PADDING, paddingHorizontal: APP_SCREEN_HORIZONTAL_PADDING },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  messageIdentity: { flex: 1 },
  messageMenuButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  messageBody: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  deletedBody: { fontSize: 15, lineHeight: 22, fontWeight: '800', fontStyle: 'italic' },
  traceText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  messageActionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 2 },
  inlineCommentAction: { minHeight: 28, justifyContent: 'center' },
  inlineCommentActionText: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  editBox: { gap: 9 },
  editInput: { minHeight: 92, borderRadius: 16, borderWidth: 1, padding: 12, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallAction: { minHeight: 38, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  smallActionText: { fontSize: 13, fontWeight: '900' },
  composer: { borderTopWidth: 1, marginHorizontal: -APP_SCREEN_HORIZONTAL_PADDING, paddingHorizontal: APP_SCREEN_HORIZONTAL_PADDING, paddingTop: 10 },
  composerInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: { flex: 1, minHeight: 48, maxHeight: 118, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  sendButton: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 13 },
  sendText: { fontWeight: '900' },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
