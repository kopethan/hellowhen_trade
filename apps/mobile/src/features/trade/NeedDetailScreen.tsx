import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { InventoryDetailScreen } from './InventoryDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'NeedDetail'>;
export function NeedDetailScreen({ route, navigation }: Props) {
  return <InventoryDetailScreen kind="need" itemId={route.params.needId} fallbackTitle={route.params.title} navigation={navigation} />;
}
