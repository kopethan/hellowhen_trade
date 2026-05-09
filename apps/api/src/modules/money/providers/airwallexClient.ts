import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
import { MoneyProviderError } from './moneyProvider.types.js';

type AirwallexToken = {
  token: string;
  expiresAt: number;
};

let cachedToken: AirwallexToken | null = null;

function airwallexBaseUrl() {
  const baseUrl = env.airwallexBaseUrl || (env.airwallexEnv === 'production' ? 'https://api.airwallex.com' : 'https://api-demo.airwallex.com');
  return baseUrl.replace(/\/+$/, '');
}

function assertAirwallexSandbox() {
  if (env.airwallexEnv === 'production' || !airwallexBaseUrl().includes('api-demo.airwallex.com')) {
    if (env.moneyProviderSandboxOnly) {
      throw new MoneyProviderError('sandbox_only', 'Airwallex production API access is blocked. Airwallex provider scaffolding only supports sandbox/demo access right now.', 403);
    }
  }
}

function assertAirwallexConfigured() {
  if (!env.airwallexEnabled || !env.airwallexClientId || !env.airwallexApiKey) {
    throw new MoneyProviderError('provider_not_configured', 'Airwallex sandbox is not configured. Set AIRWALLEX_ENABLED=true, AIRWALLEX_CLIENT_ID, and AIRWALLEX_API_KEY.', 503);
  }
  assertAirwallexSandbox();
}

function maybeJson(value: unknown) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

async function parseAirwallexResponse(response: Response) {
  const text = await response.text();
  const body = text ? maybeJson(text) : null;
  if (!response.ok) {
    const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const code = typeof record.code === 'string' ? record.code : typeof record.error === 'string' ? record.error : 'airwallex_api_error';
    const message = typeof record.message === 'string'
      ? record.message
      : typeof record.error_description === 'string'
        ? record.error_description
        : `Airwallex API request failed with status ${response.status}.`;
    throw new MoneyProviderError(code, message, response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  return body;
}

async function getAccessToken() {
  assertAirwallexConfigured();
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > 60_000) return cachedToken.token;

  const response = await fetch(`${airwallexBaseUrl()}/api/v1/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': env.airwallexClientId,
      'x-api-key': env.airwallexApiKey,
      ...(env.airwallexPlatformAccountId ? { 'x-login-as': env.airwallexPlatformAccountId } : {}),
    },
  });
  const body = await parseAirwallexResponse(response) as { token?: string; expires_at?: string } | null;
  if (!body?.token) throw new MoneyProviderError('airwallex_token_missing', 'Airwallex did not return an access token.', 502);
  cachedToken = {
    token: body.token,
    expiresAt: body.expires_at ? Date.parse(body.expires_at) : now + 25 * 60_000,
  };
  return cachedToken.token;
}

export type AirwallexRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  onBehalfOf?: string;
  scaToken?: string;
};

export async function airwallexRequest<T>(path: string, options: AirwallexRequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${airwallexBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.onBehalfOf ? { 'x-on-behalf-of': options.onBehalfOf } : {}),
      ...(options.scaToken ? { 'x-sca-token': options.scaToken } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return await parseAirwallexResponse(response) as T;
}

export function verifyAirwallexWebhookSignature(input: { rawBody: Buffer; timestamp?: string | string[]; signature?: string | string[]; clientSecretKey?: string | string[] }) {
  const timestamp = Array.isArray(input.timestamp) ? input.timestamp[0] : input.timestamp;
  const signature = Array.isArray(input.signature) ? input.signature[0] : input.signature;
  const sandboxSecret = Array.isArray(input.clientSecretKey) ? input.clientSecretKey[0] : input.clientSecretKey;
  const secret = env.airwallexWebhookSecret || (env.nodeEnv === 'production' ? '' : sandboxSecret ?? '');
  if (!secret) throw new MoneyProviderError('airwallex_webhook_not_configured', 'Airwallex webhook secret is not configured.', 503);
  if (!timestamp || !signature) throw new MoneyProviderError('airwallex_webhook_signature_missing', 'Airwallex webhook signature headers are missing.', 400);

  const signedPayload = `${timestamp}${input.rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new MoneyProviderError('airwallex_webhook_signature_invalid', 'Airwallex webhook signature is invalid.', 400);
  }
}
