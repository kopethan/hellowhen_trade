import React from 'react';
import { StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { semanticStatusTone, type SemanticColorName } from '@hellowhen/theme';
import { formatCredits, formatMoney } from '@hellowhen/shared';
import { AppText } from './AppText';
import { useThemeTokens } from '../providers/ThemeProvider';

type BadgeSize = 'sm' | 'md';

type SemanticBadgeProps = {
  label: string;
  tone?: SemanticColorName;
  size?: BadgeSize;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

function labelize(value: string) {
  return value.replaceAll('_', ' ');
}

function toneForStatus(status: string): SemanticColorName {
  return semanticStatusTone[status as keyof typeof semanticStatusTone] ?? 'muted';
}

export function SemanticBadge({ label, tone = 'muted', size = 'md', style, textStyle }: SemanticBadgeProps) {
  const theme = useThemeTokens();
  const color = theme.semantic[tone];
  return (
    <View style={[styles.badge, size === 'sm' && styles.badgeSmall, { backgroundColor: color.softBg, borderColor: color.border }, style]}>
      <AppText style={[styles.badgeText, size === 'sm' && styles.badgeTextSmall, { color: color.text }, textStyle]}>{labelize(label)}</AppText>
    </View>
  );
}

export function StatusBadge({ status, tone, size = 'md' }: { status: string; tone?: SemanticColorName; size?: BadgeSize }) {
  return <SemanticBadge label={status} tone={tone ?? toneForStatus(status)} size={size} />;
}

export function CreditPill({ amount, label = 'credits', tone = 'credits' }: { amount: number; label?: string; tone?: SemanticColorName }) {
  const theme = useThemeTokens();
  const color = theme.semantic[tone];
  return (
    <View style={[styles.creditPill, { backgroundColor: color.softBg, borderColor: color.border }]}>
      <AppText style={[styles.creditAmount, { color: color.text }]}>{formatCredits(amount)}</AppText>
      <AppText style={[styles.creditLabel, { color: color.text }]}>{label}</AppText>
    </View>
  );
}

export function MoneyPill({ amountCents, currency = 'eur', label = 'wallet', tone = 'credits' }: { amountCents: number; currency?: string; label?: string; tone?: SemanticColorName }) {
  const theme = useThemeTokens();
  const color = theme.semantic[tone];
  return (
    <View style={[styles.creditPill, { backgroundColor: color.softBg, borderColor: color.border }]}>
      <AppText style={[styles.creditAmount, { color: color.text }]}>{formatMoney(amountCents, currency)}</AppText>
      <AppText style={[styles.creditLabel, { color: color.text }]}>{label}</AppText>
    </View>
  );
}

export function InfoNotice({ title, body, tone = 'info' }: { title?: string; body: string; tone?: SemanticColorName }) {
  const theme = useThemeTokens();
  const color = theme.semantic[tone];
  return (
    <View style={[styles.notice, { backgroundColor: color.softBg, borderColor: color.border }]}>
      {title ? <AppText style={[styles.noticeTitle, { color: color.text }]}>{title}</AppText> : null}
      <AppText style={[styles.noticeBody, { color: color.text }]}>{body}</AppText>
    </View>
  );
}

export function toneForKind(kind?: 'need' | 'offer' | 'trade' | 'proposal' | string | null): SemanticColorName {
  if (kind === 'need') return 'need';
  if (kind === 'offer') return 'offer';
  if (kind === 'proposal') return 'proposal';
  if (kind === 'trade') return 'trade';
  return 'trade';
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeSmall: {
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badgeTextSmall: {
    fontSize: 11,
    letterSpacing: 0.35,
  },
  creditPill: {
    alignSelf: 'flex-start',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  creditAmount: {
    fontSize: 18,
    fontWeight: '900',
  },
  creditLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  notice: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    gap: 4,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  noticeBody: {
    lineHeight: 20,
    fontWeight: '700',
  },
});
