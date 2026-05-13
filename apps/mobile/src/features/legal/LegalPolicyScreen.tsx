import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { legalPolicyKeys, legalPolicySectionKeys, type LegalPolicyKey } from '@hellowhen/i18n';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { SemanticBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type LegalRoute = RouteProp<RootStackParamList, 'LegalPolicy'>;

function isLegalPolicyKey(value: unknown): value is LegalPolicyKey {
  return typeof value === 'string' && legalPolicyKeys.includes(value as LegalPolicyKey);
}

export function LegalPolicyScreen() {
  const route = useRoute<LegalRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const selectedPolicy = isLegalPolicyKey(route.params?.policy) ? route.params.policy : null;

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader title={selectedPolicy ? t(`legal.policies.${selectedPolicy}.shortTitle`) : t('navigation.routes.legal')} onBack={() => navigation.goBack()} />

        {selectedPolicy ? (
          <>
            <View style={styles.headerBlock}>
              <SemanticBadge label={t('legal.overview.eyebrow')} tone="instruction" />
              <AppText style={styles.title}>{t(`legal.policies.${selectedPolicy}.title`)}</AppText>
              <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t(`legal.policies.${selectedPolicy}.summary`)}</AppText>
            </View>

            <AppCard style={styles.updatedCard}>
              <SemanticBadge label={t('legal.overview.launchBadge')} tone="info" size="sm" />
              <AppText style={[styles.body, { color: theme.color.muted }]}>{t(`legal.policies.${selectedPolicy}.updated`)}</AppText>
            </AppCard>

            {legalPolicySectionKeys[selectedPolicy].map((section) => (
              <AppCard key={section} style={styles.sectionCard}>
                <AppText style={styles.sectionTitle}>{t(`legal.policies.${selectedPolicy}.sections.${section}.title`)}</AppText>
                <AppText style={[styles.body, { color: theme.color.muted }]}>{t(`legal.policies.${selectedPolicy}.sections.${section}.body`)}</AppText>
              </AppCard>
            ))}

            <AppCard style={styles.sectionCard}>
              <SemanticBadge label={t('navigation.routes.legal')} tone="info" size="sm" />
              <AppText style={styles.sectionTitle}>{t('legal.overview.title')}</AppText>
              <View style={styles.linkWrap}>{legalPolicyKeys.filter((item) => item !== selectedPolicy).map((item) => <PolicyPill key={item} policy={item} />)}</View>
            </AppCard>
          </>
        ) : (
          <>
            <View style={styles.headerBlock}>
              <SemanticBadge label={t('legal.overview.eyebrow')} tone="instruction" />
              <AppText style={styles.title}>{t('legal.overview.title')}</AppText>
              <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('legal.overview.body')}</AppText>
            </View>
            <AppCard style={styles.sectionCard}>
              <SemanticBadge label={t('legal.overview.launchBadge')} tone="info" />
              <AppText style={styles.sectionTitle}>{t('legal.overview.launchTitle')}</AppText>
              <AppText style={[styles.body, { color: theme.color.muted }]}>{t('legal.overview.launchBody')}</AppText>
            </AppCard>
            {legalPolicyKeys.map((policy) => <PolicyRow key={policy} policy={policy} />)}
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

function PolicyPill({ policy }: { policy: LegalPolicyKey }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('LegalPolicy', { policy })} style={({ pressed }) => [styles.policyPill, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <AppText style={[styles.policyPillText, { color: theme.color.text }]}>{t(`legal.policies.${policy}.shortTitle`)}</AppText>
    </Pressable>
  );
}

function PolicyRow({ policy }: { policy: LegalPolicyKey }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('LegalPolicy', { policy })} style={({ pressed }) => [styles.policyRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.policyRowCopy}>
        <AppText style={styles.policyRowTitle}>{t(`legal.policies.${policy}.title`)}</AppText>
        <AppText style={[styles.body, { color: theme.color.muted }]}>{t(`legal.policies.${policy}.summary`)}</AppText>
      </View>
      <AppText style={[styles.policyOpen, { color: theme.semantic.proposal.bg }]}>{t('legal.overview.openPolicy')}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  headerBlock: { gap: 8 },
  title: { fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { lineHeight: 21, fontWeight: '700' },
  updatedCard: { gap: 8 },
  sectionCard: { gap: 9 },
  sectionTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.35 },
  body: { lineHeight: 21, fontWeight: '600' },
  linkWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  policyPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  policyPillText: { fontWeight: '900' },
  policyRow: { borderRadius: 22, borderWidth: 1, padding: 15, gap: 10 },
  policyRowCopy: { gap: 5 },
  policyRowTitle: { fontSize: 18, fontWeight: '900' },
  policyOpen: { fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
