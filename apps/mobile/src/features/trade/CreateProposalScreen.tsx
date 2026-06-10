import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateProposal'>;

export function CreateProposalScreen({ route, navigation }: Props) {
  useEffect(() => {
    navigation.replace('TradePrivateProposals', {
      tradeId: route.params.tradeId,
      title: route.params.title,
    });
  }, [navigation, route.params.title, route.params.tradeId]);

  return null;
}
