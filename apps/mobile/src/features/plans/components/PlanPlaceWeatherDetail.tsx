import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import type { PlanPlaceDto } from '@hellowhen/contracts';
import { AppText } from '../../../components/AppText';
import { useAuth } from '../../../providers/AuthProvider';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import { formatPlanTemperature, isSyntheticPlanWeatherPlanId } from '../planWeatherModel';
import { usePlanPlaceWeather, useTemperatureUnitPreference } from '../planWeatherMobile';

type PlanPlaceWeatherDetailProps = {
  planId: string;
  place: PlanPlaceDto;
};

export function PlanPlaceWeatherDetail({ planId, place }: PlanPlaceWeatherDetailProps) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const { unit: temperatureUnit, toggleUnit: toggleTemperatureUnit } = useTemperatureUnitPreference();
  const weatherCandidate = usePlanPlaceWeather(
    planId,
    place,
    auth.user?.id,
    Boolean(auth.user && !isSyntheticPlanWeatherPlanId(planId)),
  );
  const attributionLogoUrl = weatherCandidate
    ? (theme.mode === 'dark' ? weatherCandidate.attribution.logoDarkUrl : weatherCandidate.attribution.logoLightUrl)
    : null;
  const [attributionLogoReady, setAttributionLogoReady] = useState(false);
  const [attributionLogoFailed, setAttributionLogoFailed] = useState(false);

  useEffect(() => {
    setAttributionLogoReady(false);
    setAttributionLogoFailed(false);
  }, [attributionLogoUrl]);

  if (!weatherCandidate || !attributionLogoUrl || attributionLogoFailed) return null;

  if (!attributionLogoReady) {
    return (
      <Image
        source={{ uri: attributionLogoUrl }}
        resizeMode="contain"
        style={styles.attributionProbe}
        onLoad={() => setAttributionLogoReady(true)}
        onError={() => setAttributionLogoFailed(true)}
      />
    );
  }

  const temperatureLabel = formatPlanTemperature(weatherCandidate.temperatureC, temperatureUnit);

  return (
    <View style={[styles.row, { borderColor: theme.color.border, backgroundColor: theme.color.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('plans.deck.weather.temperatureAccessibility', { temperature: temperatureLabel })}
        accessibilityHint={t(temperatureUnit === 'celsius' ? 'plans.deck.weather.switchToFahrenheit' : 'plans.deck.weather.switchToCelsius')}
        onPress={() => { void toggleTemperatureUnit(); }}
        style={({ pressed }) => [styles.temperatureButton, pressed && styles.pressed]}
      >
        <AppText style={styles.temperature}>{temperatureLabel}</AppText>
        <AppText style={[styles.provider, { color: theme.color.muted }]}>{weatherCandidate.attribution.serviceName}</AppText>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('plans.deck.weather.openAttribution')}
        hitSlop={6}
        onPress={() => { void Linking.openURL(weatherCandidate.attribution.legalUrl).catch(() => undefined); }}
        style={({ pressed }) => [styles.attribution, pressed && styles.pressed]}
      >
        <Image
          source={{ uri: attributionLogoUrl }}
          resizeMode="contain"
          style={styles.attributionLogo}
          onError={() => setAttributionLogoFailed(true)}
        />
        <AppText style={[styles.sources, { color: theme.color.muted }]}>{t('plans.deck.weather.sources')}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  attributionProbe: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  row: { minHeight: 54, borderRadius: 18, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  temperatureButton: { flex: 1, minWidth: 0, gap: 1 },
  temperature: { fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: -0.2 },
  provider: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  attribution: { minHeight: 34, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8 },
  attributionLogo: { width: 82, height: 15 },
  sources: { fontSize: 10, lineHeight: 13, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
