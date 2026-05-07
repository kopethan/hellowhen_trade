import { createApiClient } from '@zizilia/api-client';
import { getAccessToken } from './tokenStore';

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export const api = createApiClient({
  baseUrl: apiBaseUrl,
  getAccessToken,
});
