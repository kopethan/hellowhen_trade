import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { MobileIcon } from './MobileIcon';
import { useThemeTokens } from '../providers/ThemeProvider';
import { useTranslation } from '../providers/MobileI18nProvider';

type AppHeaderProps = {
  title: string;
  onBack: () => void;
  rightSlot?: React.ReactNode;
};

export function AppHeader({ title, onBack, rightSlot }: AppHeaderProps) {
  const theme = useThemeTokens();
  const { t } = useTranslation();

  return (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('navigation.goBack')}
        onPress={onBack}
        style={({ pressed }) => [
          styles.backButton,
          { backgroundColor: theme.color.surface, borderColor: theme.color.border },
          pressed && styles.pressed,
        ]}
      >
        <MobileIcon name="back" size={21} color={theme.color.text} />
      </Pressable>
      <AppText style={styles.title} numberOfLines={1}>{title}</AppText>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.45 },
  rightSlot: { marginLeft: 'auto' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
