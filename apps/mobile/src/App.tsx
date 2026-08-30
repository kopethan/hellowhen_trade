import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AppSettingsProvider } from './providers/AppSettingsProvider';
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { MobileI18nProvider } from './providers/MobileI18nProvider';
import { RootNavigator } from './navigation/RootNavigator';
import { AppUpdatePolicyProvider } from './features/app-update/AppUpdatePolicyProvider';
import { AppUpdatePrompt } from './features/app-update/AppUpdatePrompt';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge preload={false}>
          <AppSettingsProvider>
            <MobileI18nProvider>
              <ThemeProvider>
                <AppUpdatePolicyProvider>
                  <AuthProvider>
                    <NavigationContainer>
                      <StatusBar style="auto" />
                      <RootNavigator />
                    </NavigationContainer>
                  </AuthProvider>
                  <AppUpdatePrompt />
                </AppUpdatePolicyProvider>
              </ThemeProvider>
            </MobileI18nProvider>
          </AppSettingsProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
