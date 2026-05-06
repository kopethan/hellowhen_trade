import React, { useState } from 'react';
import { Button, TextInput } from 'react-native';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { useAuth } from '../../providers/AuthProvider';

export function LoginScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('demo@zizilia.app');
  const [password, setPassword] = useState('password123');

  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 34, fontWeight: '800', marginBottom: 8 }}>Zizilia</AppText>
        <AppText style={{ marginBottom: 16 }}>Patch 1 auth shell. Wire old auth flow in Patch 2.</AppText>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="Email" style={{ marginBottom: 10, padding: 12, backgroundColor: 'white', borderRadius: 12 }} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={{ marginBottom: 12, padding: 12, backgroundColor: 'white', borderRadius: 12 }} />
        <Button title="Login" onPress={() => auth.login(email, password)} />
      </AppCard>
    </AppScreen>
  );
}
