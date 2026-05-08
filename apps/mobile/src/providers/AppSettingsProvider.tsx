import React, { createContext, useContext, useState } from 'react';
import type { AppSettings } from '@hellowhen/contracts';

const defaultSettings: AppSettings = {
  appearance: 'system',
  language: 'en',
  notificationsEnabled: true,
};

const SettingsContext = createContext({
  settings: defaultSettings,
  setSettings: (_settings: AppSettings) => {},
});

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(defaultSettings);
  return <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  return useContext(SettingsContext);
}
