import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { ReportReason, ReportTargetType } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import { api } from '../lib/api';
import { getFriendlyApiErrorMessage } from '../lib/errors';
import { useAuth } from '../providers/AuthProvider';
import { useTranslation } from '../providers/MobileI18nProvider';
import { useThemeTokens } from '../providers/ThemeProvider';
import { AppText } from './AppText';
import { MobileIcon } from './MobileIcon';
import { InfoNotice } from './SemanticUI';

type ReportContentPanelProps = {
  targetType: ReportTargetType;
  targetId: string;
  labelKey?: string;
  helperKey?: string;
  initialOpen?: boolean;
};

const reportReasons: ReportReason[] = ['spam', 'scam', 'harassment', 'illegal_unsafe', 'fake_profile', 'impersonation', 'inappropriate_image', 'other'];

export function ReportContentPanel({ targetType, targetId, labelKey = 'report.button', helperKey = 'report.helper.content', initialOpen = false }: ReportContentPanelProps) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [open, setOpen] = useState(initialOpen);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'danger'; body: string } | null>(null);

  async function submitReport() {
    if (!auth.user) {
      setNotice({ tone: 'info', body: t('report.loginRequired') });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.reports.create({ targetType, targetId, reason, details: details.trim() || undefined }) as { duplicate?: boolean };
      setNotice({ tone: 'info', body: response.duplicate ? t('report.duplicate') : t('report.sent') });
      setDetails('');
      setOpen(false);
    } catch (caughtError) {
      const body = typeof caughtError === 'object' && caughtError && 'body' in caughtError ? (caughtError as { body?: { error?: string } }).body : undefined;
      setNotice({ tone: 'danger', body: body?.error === 'cannot_report_own_content' ? t('report.ownContent') : getFriendlyApiErrorMessage(caughtError, t('report.error')) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        disabled={loading}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.semantic.danger.softBg, borderColor: theme.semantic.danger.border }, pressed && styles.pressed, loading && styles.disabled]}
      >
        <MobileIcon name="report-flag" size={17} color={theme.semantic.danger.text} />
        <AppText style={[styles.buttonText, { color: theme.semantic.danger.text }]}>{open ? t('report.cancel') : t(labelKey)}</AppText>
      </Pressable>
      {notice ? <InfoNotice tone={notice.tone} title={notice.tone === 'danger' ? t('report.error') : t('report.title')} body={notice.body} /> : null}
      {open ? <ReportForm theme={theme} reason={reason} details={details} loading={loading} helper={t(helperKey)} onReasonChange={setReason} onDetailsChange={setDetails} onSubmit={submitReport} t={t} /> : null}
    </View>
  );
}

function ReportForm({ theme, reason, details, loading, helper, onReasonChange, onDetailsChange, onSubmit, t }: { theme: ThemeTokens; reason: ReportReason; details: string; loading: boolean; helper: string; onReasonChange: (reason: ReportReason) => void; onDetailsChange: (details: string) => void; onSubmit: () => void; t: (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string }) {
  return (
    <View style={[styles.form, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}> 
      <AppText style={[styles.helper, { color: theme.color.muted }]}>{helper}</AppText>
      <AppText style={styles.label}>{t('report.reason')}</AppText>
      <View style={styles.reasonGrid}>
        {reportReasons.map((item) => {
          const selected = item === reason;
          return (
            <Pressable key={item} accessibilityRole="button" onPress={() => onReasonChange(item)} style={({ pressed }) => [styles.reasonChip, { backgroundColor: selected ? theme.semantic.warning.softBg : theme.color.surface, borderColor: selected ? theme.semantic.warning.border : theme.color.border }, pressed && styles.pressed]}>
              <AppText style={[styles.reasonText, { color: selected ? theme.semantic.warning.text : theme.color.text }]}>{t(`report.reasons.${item}`)}</AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText style={styles.label}>{t('report.detailsOptional')}</AppText>
      <TextInput value={details} onChangeText={onDetailsChange} placeholder={t('report.detailsPlaceholder')} placeholderTextColor={theme.color.muted} multiline textAlignVertical="top" style={[styles.input, { color: theme.color.text, backgroundColor: theme.color.surface, borderColor: theme.color.border }]} />
      <Pressable accessibilityRole="button" disabled={loading} onPress={onSubmit} style={({ pressed }) => [styles.submit, { backgroundColor: theme.color.text }, pressed && styles.pressed, loading && styles.disabled]}>
        <AppText style={[styles.submitText, { color: theme.color.background }]}>{loading ? t('report.sending') : t('report.send')}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  button: { minHeight: 46, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { fontWeight: '900' },
  form: { borderWidth: 1, borderRadius: 22, padding: 14, gap: 10 },
  helper: { lineHeight: 20, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  reasonText: { fontSize: 12, fontWeight: '900' },
  input: { minHeight: 104, borderWidth: 1, borderRadius: 18, padding: 12, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  submit: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  submitText: { fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
