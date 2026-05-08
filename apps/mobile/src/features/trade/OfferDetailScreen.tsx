import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { InventoryDetailScreen } from './InventoryDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'OfferDetail'>;
export function OfferDetailScreen({ route, navigation }: Props) {
  return <InventoryDetailScreen kind="offer" itemId={route.params.offerId} fallbackTitle={route.params.title} navigation={navigation} />;
}
