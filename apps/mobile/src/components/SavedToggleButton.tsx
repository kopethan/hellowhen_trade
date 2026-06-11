import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SavedItemType } from '@hellowhen/contracts';
import { api } from '../lib/api';
import { betaFeatures } from '../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../lib/errors';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../providers/AuthProvider';
import { useThemeTokens } from '../providers/ThemeProvider';
import { useTranslation } from '../providers/MobileI18nProvider';
import { AppText } from './AppText';
import { MobileIcon } from './MobileIcon';

type SavedToggleButtonProps = {
  itemType: SavedItemType;
  itemId: string;
  showLabel?: boolean;
  iconSize?: number;
  disabled?: boolean;
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SavedToggleButton({
  itemType,
  itemId,
  showLabel = true,
  iconSize = 17,
  disabled = false,
  hidden = false,
  style,
}: SavedToggleButtonProps) {
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadSavedStatus() {
      if (!auth.isAuthenticated || !itemId || hidden || !betaFeatures.savedLibraryEnabled) {
        setSavedItemId(null);
        return;
      }

      try {
        const result = await api.saved.status({ itemType, itemId });
        if (!mounted) return;
        setSavedItemId(result.isSaved ? result.savedItem?.id ?? null : null);
      } catch {
        if (mounted) setSavedItemId(null);
      }
    }

    void loadSavedStatus();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, hidden, itemId, itemType]);

  async function toggleSaved() {
    if (busy || disabled || hidden || !betaFeatures.savedLibraryEnabled) return;
    if (!auth.isAuthenticated) {
      navigation.navigate('Login');
      return;
    }

    setBusy(true);
    setUpgradePrompt(null);
    try {
      if (savedItemId) {
        const currentSavedItemId = savedItemId;
        setSavedItemId(null);
        await api.saved.remove(currentSavedItemId);
      } else {
        const result = await api.saved.create({ itemType, itemId });
        setSavedItemId(result.item.id);
      }
    } catch (caughtError) {
      setUpgradePrompt(getFriendlyApiErrorMessage(caughtError, t('account.saved.plus.savePrompt')));
      try {
        const result = await api.saved.status({ itemType, itemId });
        setSavedItemId(result.isSaved ? result.savedItem?.id ?? null : null);
      } catch {
        // Keep the button usable even if the status refresh fails.
      }
    } finally {
      setBusy(false);
    }
  }

  if (hidden || !betaFeatures.savedLibraryEnabled) return null;

  const isSaved = Boolean(savedItemId);
  const label = busy ? t('common.states.saving') : isSaved ? t('common.states.saved') : t('common.actions.save');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy, disabled: disabled || busy, selected: isSaved }}
        disabled={disabled || busy}
        onPress={() => { void toggleSaved(); }}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: isSaved ? theme.semantic.proposal.softBg : theme.color.surface,
            borderColor: isSaved ? theme.semantic.proposal.border : theme.color.border,
          },
          !showLabel && styles.iconOnly,
          (pressed || busy) && styles.pressed,
          style,
        ]}
      >
        <MobileIcon name="save" size={iconSize} color={isSaved ? theme.semantic.proposal.text : theme.color.text} />
        {showLabel ? <AppText style={[styles.label, { color: isSaved ? theme.semantic.proposal.text : theme.color.text }]}>{label}</AppText> : null}
      </Pressable>
      {upgradePrompt ? (
        <View style={[styles.prompt, { backgroundColor: theme.semantic.warning.softBg, borderColor: theme.semantic.warning.border }]}>
          <AppText style={[styles.promptText, { color: theme.semantic.warning.text }]}>{upgradePrompt}</AppText>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  iconOnly: {
    width: 42,
    height: 42,
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 0,
  },
  label: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  prompt: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  promptText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
});
