import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { InventoryDisplayLanguage } from '@hellowhen/contracts';
import { AppText } from './AppText';
import { SemanticBadge } from './SemanticUI';
import { useTranslation } from '../providers/MobileI18nProvider';
import { useThemeTokens } from '../providers/ThemeProvider';

type LanguageOption = NonNullable<InventoryDisplayLanguage['options']>[number];

type LanguageSelectionInput = {
  displayLanguage?: InventoryDisplayLanguage | null;
  fallbackTitle: string;
  fallbackDescription?: string | null;
};

function languageLabel(languageCode: string | null | undefined, t: ReturnType<typeof useTranslation>['t']) {
  if (languageCode === 'fr') return t('inventory.languages.fr');
  if (languageCode === 'es') return t('inventory.languages.es');
  return t('inventory.languages.en');
}

export function useContentLanguageSelection({ displayLanguage, fallbackTitle, fallbackDescription }: LanguageSelectionInput) {
  const initialLanguage = displayLanguage?.languageCode ?? '';
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);

  useEffect(() => {
    setSelectedLanguage(initialLanguage);
  }, [initialLanguage]);

  const options = useMemo(() => displayLanguage?.options ?? [], [displayLanguage?.options]);
  const activeLanguage = selectedLanguage || displayLanguage?.languageCode || '';
  const activeOption = options.find((option) => option.languageCode === activeLanguage) ?? null;

  return {
    title: activeOption?.title ?? fallbackTitle,
    description: activeOption?.description ?? fallbackDescription ?? '',
    selectedLanguage: activeLanguage,
    setSelectedLanguage,
    options,
  };
}

export function shouldShowContentLanguageControls(displayLanguage?: InventoryDisplayLanguage | null, options?: readonly LanguageOption[]) {
  if (!displayLanguage?.languageCode) return false;
  if ((options?.length ?? 0) > 1) return true;
  return displayLanguage.source === 'default' || displayLanguage.source === 'fallback' || displayLanguage.source === 'machine';
}

export function ContentLanguageControls({
  displayLanguage,
  selectedLanguage,
  onSelectLanguage,
}: {
  displayLanguage?: InventoryDisplayLanguage | null;
  selectedLanguage: string;
  onSelectLanguage: (languageCode: string) => void;
}) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const options = displayLanguage?.options ?? [];
  if (!shouldShowContentLanguageControls(displayLanguage, options)) return null;

  const activeLanguage = selectedLanguage || displayLanguage?.languageCode || options[0]?.languageCode || 'en';
  const activeOption = options.find((option) => option.languageCode === activeLanguage) ?? null;
  const firstRequested = displayLanguage?.requestedLanguages?.[0] ?? null;
  const missingRequested = Boolean(
    firstRequested
    && firstRequested !== activeLanguage
    && !(displayLanguage?.availableLanguages ?? []).includes(firstRequested as any),
  );
  const fallbackMessage = missingRequested
    ? t('inventory.languages.fallbackShowing', {
        requested: languageLabel(firstRequested, t),
        active: languageLabel(activeLanguage, t),
      })
    : (displayLanguage?.source === 'default' || displayLanguage?.source === 'fallback') && (activeOption?.isOriginal ?? true)
      ? t('inventory.languages.showingOriginal', { language: languageLabel(activeLanguage, t) })
      : null;

  return (
    <View style={styles.wrap} accessibilityLabel={t('inventory.languages.contentLanguage')}>
      {options.length > 1 ? (
        <>
          <AppText style={[styles.label, { color: theme.color.muted }]}>{t('inventory.languages.contentLanguage')}</AppText>
          <View style={styles.optionRow}>
            {options.map((option) => {
              const active = option.languageCode === activeLanguage;
              return (
                <Pressable
                  key={option.languageCode}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onSelectLanguage(option.languageCode)}
                  style={({ pressed }) => [
                    styles.optionButton,
                    {
                      backgroundColor: active ? theme.semantic.instruction.softBg : theme.color.surface,
                      borderColor: active ? theme.semantic.instruction.border : theme.color.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText style={[styles.optionText, { color: active ? theme.semantic.instruction.text : theme.color.muted }]}>{languageLabel(option.languageCode, t)}</AppText>
                </Pressable>
              );
            })}
          </View>
          {fallbackMessage ? <AppText style={[styles.fallbackText, { color: theme.color.muted }]}>{fallbackMessage}</AppText> : null}
        </>
      ) : (
        <View style={styles.summaryRow}>
          <SemanticBadge label={languageLabel(activeLanguage, t)} tone="instruction" size="sm" />
          {fallbackMessage ? <AppText style={[styles.fallbackText, { color: theme.color.muted }]}>{fallbackMessage}</AppText> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 2, marginBottom: 6 },
  label: { fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  fallbackText: { flex: 1, minWidth: 180, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  optionText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
