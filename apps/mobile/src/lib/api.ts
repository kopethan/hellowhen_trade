import { Platform } from 'react-native';
import { createApiClient } from '@hellowhen/api-client';
import { getAccessToken } from './tokenStore';

function getDefaultApiUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }

  return 'http://localhost:4000';
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || getDefaultApiUrl();

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken,
});
