import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { InventoryCreateWizardScreen } from './InventoryCreateWizardScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateOffer'>;

export function CreateOfferScreen({ route, navigation }: Props) {
  return <InventoryCreateWizardScreen kind="offer" routeParams={route.params} navigation={navigation} />;
}
