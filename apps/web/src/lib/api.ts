import { createApiClient } from '@hellowhen/api-client';
import { getAccessToken } from './webTokenStore';

export const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:4000';

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken,
});
