import { createPrivateKey, sign as signPayload } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const WEATHERKIT_BASE_URL = 'https://weatherkit.apple.com';
const DEFAULT_TIMEOUT_MS = 12_000;

function usage() {
  console.log(`Hellowhen WeatherKit deployment verifier\n\nUsage:\n  node scripts/weatherkit-deployment-check.mjs config\n  node scripts/weatherkit-deployment-check.mjs apple\n  node scripts/weatherkit-deployment-check.mjs api\n\nCommands:\n  config  Validate production weather environment shape and private-key signing. No network.\n  apple   Validate config, then make authenticated WeatherKit availability + hourly requests.\n  api     Validate a deployed Hellowhen Plan-Place weather response end to end.\n\nWeatherKit environment:\n  WEATHER_ENABLED=true\n  WEATHER_PROVIDER=weatherkit\n  WEATHERKIT_TEAM_ID=...\n  WEATHERKIT_SERVICE_ID=...\n  WEATHERKIT_KEY_ID=...\n  WEATHERKIT_PRIVATE_KEY=...\n\nVerifier-only convenience:\n  WEATHERKIT_PRIVATE_KEY_FILE=/secure/path/AuthKey_XXXXXXXXXX.p8\n  If WEATHERKIT_PRIVATE_KEY is absent, the verifier may read this file. The API runtime itself\n  still uses WEATHERKIT_PRIVATE_KEY.\n\nHellowhen API verification environment:\n  HELLOWHEN_API_BASE_URL=https://api.example.com\n  HELLOWHEN_ACCESS_TOKEN=...\n  HELLOWHEN_PLAN_ID=...\n  HELLOWHEN_PLAN_PLACE_ID=...\n\nSecrets are never printed by this script.`);
}

function fail(message) {
  console.error(`WeatherKit deployment check: FAIL\n${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`${message}: PASS`);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function normalizePrivateKey(value) {
  return value.trim().replace(/\\n/g, '\n');
}

async function loadPrivateKey() {
  const inline = process.env.WEATHERKIT_PRIVATE_KEY;
  if (inline?.trim()) return normalizePrivateKey(inline);

  const filePath = process.env.WEATHERKIT_PRIVATE_KEY_FILE?.trim();
  if (!filePath) {
    throw new Error('WEATHERKIT_PRIVATE_KEY is required. For this verifier only, WEATHERKIT_PRIVATE_KEY_FILE may point to the downloaded .p8 file.');
  }
  const file = await readFile(filePath, 'utf8');
  return normalizePrivateKey(file);
}

function assertTenCharacterAppleId(name, value) {
  if (!/^[A-Z0-9]{10}$/i.test(value)) {
    throw new Error(`${name} must be the 10-character Apple identifier shown in Certificates, Identifiers & Profiles.`);
  }
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function createDeveloperToken({ teamId, serviceId, keyId, privateKey }, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = { alg: 'ES256', kid: keyId, id: `${teamId}.${serviceId}` };
  const payload = { iss: teamId, iat: issuedAt, exp: issuedAt + 10 * 60, sub: serviceId };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const key = createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== 'ec') throw new Error('WEATHERKIT_PRIVATE_KEY is not an EC private key.');
  const namedCurve = key.asymmetricKeyDetails?.namedCurve;
  if (namedCurve && namedCurve !== 'prime256v1' && namedCurve !== 'P-256') {
    throw new Error(`WEATHERKIT_PRIVATE_KEY uses ${namedCurve}; WeatherKit requires the P-256 curve.`);
  }
  const signature = signPayload('sha256', Buffer.from(signingInput, 'utf8'), {
    key,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${signature.toString('base64url')}`;
}

async function loadWeatherKitCredentials() {
  if (process.env.WEATHER_ENABLED?.trim().toLowerCase() !== 'true') {
    throw new Error('WEATHER_ENABLED must be true for production WeatherKit verification.');
  }
  if (process.env.WEATHER_PROVIDER?.trim().toLowerCase() !== 'weatherkit') {
    throw new Error('WEATHER_PROVIDER must be weatherkit when weather is enabled.');
  }

  const teamId = required('WEATHERKIT_TEAM_ID');
  const serviceId = required('WEATHERKIT_SERVICE_ID');
  const keyId = required('WEATHERKIT_KEY_ID');
  assertTenCharacterAppleId('WEATHERKIT_TEAM_ID', teamId);
  assertTenCharacterAppleId('WEATHERKIT_KEY_ID', keyId);
  if (!serviceId.includes('.') || /\s/.test(serviceId)) {
    throw new Error('WEATHERKIT_SERVICE_ID should be the registered reverse-domain-style Apple Services ID.');
  }

  const privateKey = await loadPrivateKey();
  const credentials = { teamId, serviceId, keyId, privateKey };
  createDeveloperToken(credentials);
  return credentials;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function responseBodyForError(response) {
  const text = await response.text().catch(() => '');
  return text ? text.slice(0, 500) : '(empty response body)';
}

async function checkConfig() {
  await loadWeatherKitCredentials();
  pass('WeatherKit production environment shape');
  pass('WeatherKit P-256 private-key signing');
}

async function checkApple() {
  const credentials = await loadWeatherKitCredentials();
  const token = createDeveloperToken(credentials);
  const headers = { Authorization: `Bearer ${token}` };

  const availabilityUrl = new URL('/api/v1/availability/48.8566/2.3522', WEATHERKIT_BASE_URL);
  availabilityUrl.searchParams.set('country', 'FR');
  const availabilityResponse = await fetchWithTimeout(availabilityUrl, { headers });
  if (!availabilityResponse.ok) {
    throw new Error(`WeatherKit availability request returned HTTP ${availabilityResponse.status}: ${await responseBodyForError(availabilityResponse)}`);
  }
  await availabilityResponse.json().catch(() => null);
  pass('WeatherKit authenticated availability request');

  const start = new Date();
  const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
  const weatherUrl = new URL('/api/v1/weather/en/48.8566/2.3522', WEATHERKIT_BASE_URL);
  weatherUrl.searchParams.set('dataSets', 'forecastHourly');
  weatherUrl.searchParams.set('timezone', 'Europe/Paris');
  weatherUrl.searchParams.set('hourlyStart', start.toISOString());
  weatherUrl.searchParams.set('hourlyEnd', end.toISOString());
  const weatherResponse = await fetchWithTimeout(weatherUrl, { headers });
  if (!weatherResponse.ok) {
    throw new Error(`WeatherKit hourly request returned HTTP ${weatherResponse.status}: ${await responseBodyForError(weatherResponse)}`);
  }
  const body = await weatherResponse.json();
  if (!Array.isArray(body?.forecastHourly?.hours) || body.forecastHourly.hours.length === 0) {
    throw new Error('WeatherKit authenticated successfully, but the hourly response did not contain forecastHourly.hours for the verification location.');
  }
  pass('WeatherKit hourly forecast request');
  console.log('Apple live verification used the Paris sample coordinate only; no Hellowhen user or Plan location was sent.');
}

function assertHttpsUrl(name, value) {
  if (typeof value !== 'string') throw new Error(`${name} is missing.`);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} is not a valid URL.`); }
  if (parsed.protocol !== 'https:') throw new Error(`${name} must use HTTPS.`);
}

async function checkApi() {
  const baseUrl = required('HELLOWHEN_API_BASE_URL').replace(/\/+$/, '');
  const accessToken = required('HELLOWHEN_ACCESS_TOKEN');
  const planId = required('HELLOWHEN_PLAN_ID');
  const planPlaceId = required('HELLOWHEN_PLAN_PLACE_ID');

  const parsedBase = new URL(baseUrl);
  const localHost = parsedBase.hostname === 'localhost' || parsedBase.hostname === '127.0.0.1' || parsedBase.hostname === '::1';
  if (parsedBase.protocol !== 'https:' && !localHost) {
    throw new Error('HELLOWHEN_API_BASE_URL must use HTTPS unless it points to localhost.');
  }

  const url = new URL(`/plans/${encodeURIComponent(planId)}/places/${encodeURIComponent(planPlaceId)}/weather`, `${baseUrl}/`);
  const response = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Hellowhen weather endpoint returned HTTP ${response.status}: ${await responseBodyForError(response)}`);
  }
  const body = await response.json();
  pass('Hellowhen authenticated Plan-Place weather endpoint');

  const weather = body?.weather;
  if (!weather) {
    throw new Error('The endpoint returned weather: null. Use an eligible local Plan Place with its own startsAt in the next seven days and stored coordinates, then run the check again.');
  }
  if (weather.provider !== 'weatherkit') throw new Error('The deployed endpoint did not return provider=weatherkit.');
  if (!Number.isFinite(weather.temperatureC)) throw new Error('The deployed endpoint did not return a finite temperatureC.');
  if (weather.attributionRequired !== true) throw new Error('The deployed endpoint did not require WeatherKit attribution.');
  if ('latitude' in weather || 'longitude' in weather) throw new Error('The deployed weather payload unexpectedly exposed coordinates.');
  assertHttpsUrl('weather.attribution.legalUrl', weather.attribution?.legalUrl);
  assertHttpsUrl('weather.attribution.logoLightUrl', weather.attribution?.logoLightUrl);
  assertHttpsUrl('weather.attribution.logoDarkUrl', weather.attribution?.logoDarkUrl);
  if (typeof weather.attribution?.serviceName !== 'string' || !weather.attribution.serviceName.trim()) {
    throw new Error('weather.attribution.serviceName is missing.');
  }
  pass('WeatherKit temperature payload');
  pass('WeatherKit attribution payload');
  pass('Weather payload coordinate privacy');
  console.log('End-to-end deployment verification: PASS');
}

const command = process.argv[2] ?? 'help';
try {
  if (command === 'help' || command === '--help' || command === '-h') usage();
  else if (command === 'config') await checkConfig();
  else if (command === 'apple') await checkApple();
  else if (command === 'api') await checkApi();
  else throw new Error(`Unknown command: ${command}. Run with --help for usage.`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
