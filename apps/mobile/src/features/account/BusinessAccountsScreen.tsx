import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessAccounts'>;
type BusinessProfile = { id: string; displayName: string; type: string; status: string; preferredCurrency?: string; countryCode?: string | null; updatedAt?: string };
type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

function localizedBusinessType(type: string, t: TFunction) {
  const key = `account.business.types.${type}`;
  const label = t(key);
  return label === key ? type.replaceAll('_', ' ') : label;
}

function localizedBusinessStatus(status: string, t: TFunction) {
  const key = `account.business.statuses.${status}`;
  const label = t(key);
  return label === key ? status.replaceAll('_', ' ') : label;
}

export function BusinessAccountsScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!betaFeatures.businessAccountsVisible) { setProfiles([]); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await api.business.mine() as { businessProfiles?: BusinessProfile[] };
      setProfiles(result.businessProfiles ?? []);
    } catch (caughtError) {
      setProfiles([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadProfiles(); }, [loadProfiles]));

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('account.business.title')} onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProfiles(); }} />}>
        {!betaFeatures.businessAccountsVisible ? (
          <InfoNotice tone="info" title={t('account.business.hiddenTitle')} body={t('account.business.hiddenBody')} />
        ) : error ? (
          <InfoNotice tone="danger" title={t('account.business.loadErrorTitle')} body={error} />
        ) : profiles.length ? (
          profiles.map((profile) => (
            <AppCard key={profile.id}>
              <View style={styles.row}>
                <View style={styles.copy}>
                  <SemanticBadge label={localizedBusinessType(profile.type, t)} tone={profile.status === 'verified' ? 'success' : 'instruction'} />
                  <AppText style={styles.title}>{profile.displayName}</AppText>
                  <AppText style={[styles.meta, { color: theme.color.muted }]}>{localizedBusinessStatus(profile.status, t)} · {(profile.preferredCurrency ?? 'eur').toUpperCase()}{profile.countryCode ? ` · ${profile.countryCode}` : ''}</AppText>
                </View>
              </View>
            </AppCard>
          ))
        ) : (
          <InfoNotice tone="info" title={t('account.business.emptyTitle')} body={t('account.business.emptyBody')} />
        )}
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 6 },
  title: { fontSize: 18, fontWeight: '900' },
  meta: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
});
