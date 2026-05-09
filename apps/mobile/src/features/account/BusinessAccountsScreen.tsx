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
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessAccounts'>;
type BusinessProfile = { id: string; displayName: string; type: string; status: string; preferredCurrency?: string; countryCode?: string | null; updatedAt?: string };

export function BusinessAccountsScreen({ navigation }: Props) {
  const theme = useThemeTokens();
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
    <AppFixedHeaderScreen header={<AppHeader title="Business / brand" onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProfiles(); }} />}>
        {!betaFeatures.businessAccountsVisible ? (
          <InfoNotice tone="info" title="Business accounts hidden" body="Business and brand profiles are controlled by the current beta feature flags." />
        ) : error ? (
          <InfoNotice tone="danger" title="Could not load profiles" body={error} />
        ) : profiles.length ? (
          profiles.map((profile) => (
            <AppCard key={profile.id}>
              <View style={styles.row}>
                <View style={styles.copy}>
                  <SemanticBadge label={profile.type.replaceAll('_', ' ')} tone={profile.status === 'verified' ? 'success' : 'instruction'} />
                  <AppText style={styles.title}>{profile.displayName}</AppText>
                  <AppText style={[styles.meta, { color: theme.color.muted }]}>{profile.status.replaceAll('_', ' ')} · {(profile.preferredCurrency ?? 'eur').toUpperCase()}{profile.countryCode ? ` · ${profile.countryCode}` : ''}</AppText>
                </View>
              </View>
            </AppCard>
          ))
        ) : (
          <InfoNotice tone="info" title="No business profiles yet" body="Business and brand account creation is available through the API during this phase." />
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
