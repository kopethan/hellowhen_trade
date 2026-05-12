import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from '../providers/MobileI18nProvider';
import { AppText } from './AppText';
import { useThemeTokens } from '../providers/ThemeProvider';

export type AppSelectOption = {
  value: string;
  label: string;
  helper?: string;
};

export function AppSelect({ label, value, options, onSelect, disabled, helper, placeholder = 'Select' }: { label: string; value?: string | null; options: AppSelectOption[]; onSelect: (value: string) => void; disabled?: boolean; helper?: string; placeholder?: string }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <AppText style={[styles.label, { color: theme.color.text }]}>{label}</AppText>
        {helper ? <AppText style={[styles.helper, { color: theme.color.muted }]}>{helper}</AppText> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      >
        <View style={styles.triggerCopy}>
          <AppText style={[styles.triggerLabel, { color: selected ? theme.color.text : theme.color.muted }]}>{selected?.label ?? placeholder}</AppText>
          {selected?.helper ? <AppText style={[styles.triggerHelper, { color: theme.color.muted }]}>{selected.helper}</AppText> : null}
        </View>
        <AppText style={[styles.chevron, { color: theme.color.muted }]}>⌄</AppText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.color.elevated, borderColor: theme.color.border }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View>
                <AppText style={styles.sheetTitle}>{label}</AppText>
                <AppText style={[styles.sheetSubtitle, { color: theme.color.muted }]}>{t('common.messages.chooseOneOption')}</AppText>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={({ pressed }) => [styles.closeButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
                <AppText style={styles.closeText}>×</AppText>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.optionList} showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    onPress={() => { onSelect(option.value); setOpen(false); }}
                    style={({ pressed }) => [styles.optionRow, { backgroundColor: active ? theme.semantic.proposal.softBg : theme.color.surface, borderColor: active ? theme.semantic.proposal.border : theme.color.border }, pressed && styles.pressed]}
                  >
                    <View style={styles.optionCopy}>
                      <AppText style={[styles.optionLabel, { color: active ? theme.semantic.proposal.text : theme.color.text }]}>{option.label}</AppText>
                      {option.helper ? <AppText style={[styles.optionHelper, { color: theme.color.muted }]}>{option.helper}</AppText> : null}
                    </View>
                    {active ? <AppText style={[styles.checkmark, { color: theme.semantic.proposal.text }]}>✓</AppText> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  labelRow: { gap: 3 },
  label: { fontWeight: '900' },
  helper: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  trigger: { minHeight: 58, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  triggerCopy: { flex: 1, gap: 2 },
  triggerLabel: { fontSize: 16, fontWeight: '900' },
  triggerHelper: { fontSize: 12, fontWeight: '700' },
  chevron: { fontSize: 22, fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.48)', justifyContent: 'flex-end', padding: 18 },
  sheet: { maxHeight: '74%', borderRadius: 28, borderWidth: 1, padding: 16, gap: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  sheetTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  sheetSubtitle: { marginTop: 2, fontWeight: '700' },
  closeButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 26, lineHeight: 28, fontWeight: '800' },
  optionList: { gap: 9, paddingBottom: 2 },
  optionRow: { minHeight: 58, borderRadius: 18, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionCopy: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 16, fontWeight: '900' },
  optionHelper: { fontSize: 12, fontWeight: '700' },
  checkmark: { fontSize: 18, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
