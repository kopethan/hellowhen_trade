import React from 'react';
import { Button } from 'react-native';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { useAuth } from '../../providers/AuthProvider';

export function MeScreen() {
  const auth = useAuth();
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>Me / Profile</AppText>
        <AppText>Reuse old profile foundation here: display name, handle, bio, avatar.</AppText>
        <AppText style={{ marginVertical: 12 }}>Signed in: {auth.user?.email ?? 'not yet'}</AppText>
        <Button title="Logout" onPress={auth.logout} />
      </AppCard>
    </AppScreen>
  );
}
