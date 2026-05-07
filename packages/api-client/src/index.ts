import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  UpdateProfileRequest,
  UpdateSettingsRequest,
  CreateNeedRequest,
  CreateOfferRequest,
  CreateTradeRequest
} from '@hellowhen/contracts';
import { requestJson, type ApiClientOptions } from './http';

export function createApiClient(options: ApiClientOptions) {
  return {
    auth: {
      login: (body: LoginRequest) => requestJson<AuthResponse>(options, '/auth/login', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
      register: (body: RegisterRequest) => requestJson<AuthResponse>(options, '/auth/register', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
      me: () => requestJson<AuthResponse>(options, '/auth/me')
    },
    profile: {
      updateMe: (body: UpdateProfileRequest) => requestJson(options, '/profile/me', {
        method: 'PATCH',
        body: JSON.stringify(body)
      })
    },
    settings: {
      updateMe: (body: UpdateSettingsRequest) => requestJson(options, '/settings/me', {
        method: 'PATCH',
        body: JSON.stringify(body)
      })
    },
    needs: {
      create: (body: CreateNeedRequest) => requestJson(options, '/needs', { method: 'POST', body: JSON.stringify(body) }),
      mine: () => requestJson(options, '/needs/mine')
    },
    offers: {
      create: (body: CreateOfferRequest) => requestJson(options, '/offers', { method: 'POST', body: JSON.stringify(body) }),
      mine: () => requestJson(options, '/offers/mine')
    },
    trades: {
      feed: () => requestJson(options, '/trades/feed'),
      get: (tradeId: string) => requestJson(options, `/trades/${tradeId}`),
      create: (body: CreateTradeRequest) => requestJson(options, '/trades', { method: 'POST', body: JSON.stringify(body) }),
      close: (tradeId: string) => requestJson(options, `/trades/${tradeId}/close`, { method: 'POST' }),
      mine: () => requestJson(options, '/trades/mine')
    },
    wallet: {
      me: () => requestJson(options, '/wallet/me')
    }
  };
}

export type HellowhenApiClient = ReturnType<typeof createApiClient>;
