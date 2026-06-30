import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { InventoryDisplayLanguage } from '@hellowhen/contracts';
import { AppText } from './AppText';
import { SemanticBadge } from './SemanticUI';
import { useThemeTokens } from '../providers/ThemeProvider';

type LanguageOption = NonNullable<InventoryDisplayLanguage['options']>[number];

type LanguageSelectionInput = {
  displayLanguage?: InventoryDisplayLanguage | null;
  fallbackTitle: string;
  fallbackDescription?: string | null;
};

function languageLabel(languageCode?: string | null) {
  if (languageCode === 'fr') return 'French';
  if (languageCode === 'es') return 'Spanish';
  return 'English';
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

function shouldShowControls(displayLanguage?: InventoryDisplayLanguage | null, options?: readonly LanguageOption[]) {
  if (!displayLanguage?.languageCode) return false;
  if ((options?.length ?? 0) > 1) return true;
  return displayLanguage.source !== 'exact';
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
  const options = displayLanguage?.options ?? [];
  if (!shouldShowControls(displayLanguage, options)) return null;

  const activeLanguage = selectedLanguage || displayLanguage?.languageCode || options[0]?.languageCode || 'en';
  const firstRequested = displayLanguage?.requestedLanguages?.[0] ?? null;
  const missingRequested = firstRequested && firstRequested !== activeLanguage && !(displayLanguage?.availableLanguages ?? []).includes(firstRequested as any)
    ? languageLabel(firstRequested)
    : null;

  return (
    <View style={styles.wrap} accessibilityLabel="Content language">
      <View style={styles.summaryRow}>
        <SemanticBadge label={languageLabel(activeLanguage)} tone="instruction" size="sm" />
        {missingRequested ? <AppText style={[styles.missingText, { color: theme.color.muted }]}>{missingRequested} not available</AppText> : null}
      </View>
      {options.length > 1 ? (
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
                <AppText style={[styles.optionText, { color: active ? theme.semantic.instruction.text : theme.color.muted }]}>{languageLabel(option.languageCode)}</AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 2, marginBottom: 6 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  missingText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  optionText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
