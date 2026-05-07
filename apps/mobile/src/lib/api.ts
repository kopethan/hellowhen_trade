import { createApiClient } from '@hellowhen/api-client';
import { getAccessToken } from './tokenStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken,
});
