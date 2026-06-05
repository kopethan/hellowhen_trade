import { useCallback, useEffect, useState } from 'react';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

type DispatchAction<ParamList extends ParamListBase> = Parameters<Pick<NavigationProp<ParamList>, 'dispatch'>['dispatch']>[0];

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
  const [pendingAction, setPendingAction] = useState<DispatchAction<ParamList> | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!enabled) return;
      event.preventDefault();
      setPendingAction(() => event.data.action as DispatchAction<ParamList>);
    });

    return unsubscribe;
  }, [enabled, navigation]);

  const cancel = useCallback(() => {
    setPendingAction(null);
  }, []);

  const confirm = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    if (action) navigation.dispatch(action);
  }, [navigation, pendingAction]);

  return {
    visible: Boolean(pendingAction),
    title,
    body,
    cancelLabel: stayLabel,
    confirmLabel: discardLabel,
    tone: 'danger' as const,
    onCancel: cancel,
    onConfirm: confirm,
  };
}
