import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { WeatherKitProvider, createWeatherKitDeveloperToken } from '../weatherKitProvider.js';

function testCredentials() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    teamId: 'TEAM123456',
    serviceId: 'com.hellowhen.weather',
    keyId: 'KEY1234567',
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
  };
}

function decodeSegment(token: string, index: number) {
  const segment = token.split('.')[index];
  assert.ok(segment);
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;
}

test('WeatherKit developer token contains only the documented header and payload claims', () => {
  const credentials = testCredentials();
  const token = createWeatherKitDeveloperToken(credentials, new Date('2026-09-02T12:00:00.000Z'));
  const header = decodeSegment(token, 0);
  const payload = decodeSegment(token, 1);

  assert.deepEqual(Object.keys(header).sort(), ['alg', 'id', 'kid']);
  assert.equal(header.alg, 'ES256');
  assert.equal(header.kid, credentials.keyId);
  assert.equal(header.id, `${credentials.teamId}.${credentials.serviceId}`);
  assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'iss', 'sub']);
  assert.equal(payload.iss, credentials.teamId);
  assert.equal(payload.sub, credentials.serviceId);
});

test('WeatherKit adapter requests hourly-only data and required attribution assets', async () => {
  const requests: URL[] = [];
  const provider = new WeatherKitProvider({
    credentials: testCredentials(),
    requestTimeoutMs: 2_000,
    now: () => new Date('2026-09-02T12:00:00.000Z'),
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.pathname === '/attribution/en') {
        return new Response(JSON.stringify({
          serviceName: 'Apple Weather',
          'logoLight@2x': '/assets/attribution/Apple_Weather_light_2x.png',
          'logoDark@2x': '/assets/attribution/Apple_Weather_dark_2x.png',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        forecastHourly: {
          metadata: {
            attributionURL: 'https://weatherkit.apple.com/legal-attribution.html',
            providerName: 'Apple Weather',
          },
          hours: [
            { forecastStart: '2026-09-02T12:00:00Z', temperature: 18.25 },
            { forecastStart: 'invalid', temperature: 99 },
          ],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  const request = {
    latitude: 48.8566,
    longitude: 2.3522,
    hourlyStart: new Date('2026-09-02T12:00:00.000Z'),
    hourlyEnd: new Date('2026-09-09T12:00:00.000Z'),
    timezone: 'Europe/Paris',
    language: 'en',
  };
  const result = await provider.getHourlyForecast(request);
  await provider.getHourlyForecast(request);

  assert.equal(requests.length, 3);
  const weatherRequest = requests[0];
  const attributionRequest = requests[1];
  assert.equal(weatherRequest?.origin, 'https://weatherkit.apple.com');
  assert.equal(weatherRequest?.pathname, '/api/v1/weather/en/48.8566/2.3522');
  assert.equal(weatherRequest?.searchParams.get('dataSets'), 'forecastHourly');
  assert.equal(weatherRequest?.searchParams.get('timezone'), 'Europe/Paris');
  assert.equal(weatherRequest?.searchParams.get('hourlyStart'), '2026-09-02T12:00:00.000Z');
  assert.equal(weatherRequest?.searchParams.get('hourlyEnd'), '2026-09-09T12:00:00.000Z');
  assert.equal(attributionRequest?.pathname, '/attribution/en');
  assert.equal(requests[2]?.pathname, '/api/v1/weather/en/48.8566/2.3522');
  assert.equal(result?.provider, 'weatherkit');
  assert.equal(result?.attributionRequired, true);
  assert.deepEqual(result?.attribution, {
    serviceName: 'Apple Weather',
    legalUrl: 'https://weatherkit.apple.com/legal-attribution.html',
    logoLightUrl: 'https://weatherkit.apple.com/assets/attribution/Apple_Weather_light_2x.png',
    logoDarkUrl: 'https://weatherkit.apple.com/assets/attribution/Apple_Weather_dark_2x.png',
  });
  assert.deepEqual(result?.hours, [{ forecastStart: '2026-09-02T12:00:00Z', temperatureC: 18.25 }]);
});

test('WeatherKit adapter refuses display data when required attribution is incomplete', async () => {
  const provider = new WeatherKitProvider({
    credentials: testCredentials(),
    requestTimeoutMs: 2_000,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.startsWith('/attribution/')) {
        return new Response(JSON.stringify({ serviceName: 'Apple Weather' }), { status: 200 });
      }
      return new Response(JSON.stringify({
        forecastHourly: {
          metadata: { attributionURL: 'https://weatherkit.apple.com/legal-attribution.html' },
          hours: [{ forecastStart: '2026-09-02T12:00:00Z', temperature: 18 }],
        },
      }), { status: 200 });
    },
  });

  const result = await provider.getHourlyForecast({
    latitude: 48.8566,
    longitude: 2.3522,
    hourlyStart: new Date('2026-09-02T12:00:00.000Z'),
    hourlyEnd: new Date('2026-09-09T12:00:00.000Z'),
    timezone: 'Europe/Paris',
    language: 'en',
  });
  assert.equal(result, null);
});
