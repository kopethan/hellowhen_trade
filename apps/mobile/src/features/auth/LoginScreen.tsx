import React, { useState } from 'react';
import { Button, StyleSheet, TextInput, View } from 'react-native';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { useAuth } from '../../providers/AuthProvider';

export function LoginScreen() {
  const auth = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('demo@zizilia.app');
  const [password, setPassword] = useState('password123');
  const [displayName, setDisplayName] = useState('Demo User');

  async function submit() {
    try {
      if (isRegistering) {
        await auth.register(email, password, displayName.trim() || email.split('@')[0] || 'Demo User');
      } else {
        await auth.login(email, password);
      }
    } catch {
      // AuthProvider owns the user-facing error message.
    }
  }

  function toggleMode() {
    auth.clearAuthError();
    setIsRegistering((value) => !value);
  }

  return (
    <AppScreen>
      <AppCard>
        <AppText style={styles.title}>Zizilia</AppText>
        <AppText style={styles.subtitle}>{isRegistering ? 'Create a test account for local trading.' : 'Sign in to your trade workspace.'}</AppText>
        {auth.authError ? (
          <View style={styles.errorBox}>
            <AppText style={styles.errorText}>{auth.authError}</AppText>
          </View>
        ) : null}
        {isRegistering ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            style={styles.input}
          />
        ) : null}
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Email"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
        />
        <Button title={isRegistering ? 'Register' : 'Login'} disabled={auth.isSubmitting} onPress={submit} />
        <View style={styles.secondaryAction}>
          <Button
            title={isRegistering ? 'Use existing account' : 'Register'}
            disabled={auth.isSubmitting}
            onPress={toggleMode}
          />
        </View>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8
  },
  subtitle: {
    marginBottom: 16
  },
  input: {
    marginBottom: 10,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  errorBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
    marginBottom: 12
  },
  errorText: {
    color: '#991B1B'
  },
  secondaryAction: {
    marginTop: 8
  }
});
