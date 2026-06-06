import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { InventoryCreateWizardScreen } from './InventoryCreateWizardScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateNeed'>;

export function CreateNeedScreen({ route, navigation }: Props) {
  return <InventoryCreateWizardScreen kind="need" routeParams={route.params} navigation={navigation} />;
}
