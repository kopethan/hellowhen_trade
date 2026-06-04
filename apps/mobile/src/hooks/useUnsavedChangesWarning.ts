import { useEffect } from 'react';
import { Alert } from 'react-native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

export function useUnsavedChangesWarning<ParamList extends ParamListBase>({
  navigation,
  enabled,
  title,
  body,
  stayLabel,
  discardLabel,
}: {
  navigation: Pick<NavigationProp<ParamList>, 'addListener' | 'dispatch'>;
  enabled: boolean;
  title: string;
  body: string;
  stayLabel: string;
  discardLabel: string;
}) {
  useEffect(() => {
    if (!enabled) return undefined;

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!enabled) return;
      event.preventDefault();
      Alert.alert(title, body, [
        { text: stayLabel, style: 'cancel' },
        {
          text: discardLabel,
          style: 'destructive',
          onPress: () => navigation.dispatch(event.data.action),
        },
      ]);
    });

    return unsubscribe;
  }, [body, discardLabel, enabled, navigation, stayLabel, title]);
}
