import React from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { useThemeTokens } from '../providers/ThemeProvider';
import { useTranslation } from '../providers/MobileI18nProvider';

export const KEYBOARD_DONE_ACCESSORY_ID = 'hellowhen-keyboard-done-accessory';

export function KeyboardDoneAccessory() {
  const theme = useThemeTokens();
  const { t } = useTranslation();

  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ACCESSORY_ID}>
      <View style={[styles.bar, { backgroundColor: theme.color.surface, borderTopColor: theme.color.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.actions.close')} onPress={Keyboard.dismiss} hitSlop={10} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
          <AppText style={[styles.doneText, { color: theme.color.text }]}>{t('common.states.done')}</AppText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  doneButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
