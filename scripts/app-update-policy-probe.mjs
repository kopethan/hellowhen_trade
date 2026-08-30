#!/usr/bin/env node

function parseArgs(argv) {
  const values = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [rawKey, ...rest] = arg.slice(2).split('=');
    values[rawKey] = rest.join('=');
  }
  return values;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parsePositiveBuild(value) {
  const parsed = Number(value);
  assert(Number.isSafeInteger(parsed) && parsed > 0, '--build must be a positive integer.');
  return parsed;
}

function assertTarget(value, label) {
  assert(value && typeof value === 'object', `${label} must be an object.`);
  assert(typeof value.version === 'string' && /^\d+\.\d+\.\d+$/.test(value.version), `${label}.version must use x.y.z.`);
  assert(Number.isSafeInteger(value.build) && value.build > 0, `${label}.build must be a positive integer.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiUrl = args['api-url'];
  const platform = args.platform;
  const version = args.version;
  const build = parsePositiveBuild(args.build);
  const locale = args.locale || 'en';
  const expected = args.expect;

  assert(apiUrl, '--api-url is required.');
  assert(platform === 'ios' || platform === 'android', '--platform must be ios or android.');
  assert(typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version), '--version must use x.y.z.');
  assert(['en', 'fr', 'es'].includes(locale), '--locale must be en, fr, or es.');
  if (expected) assert(['current', 'optional', 'mandatory'].includes(expected), '--expect must be current, optional, or mandatory.');

  const base = new URL(apiUrl);
  const endpoint = new URL('/mobile/release-policy', base);
  endpoint.searchParams.set('platform', platform);
  endpoint.searchParams.set('version', version);
  endpoint.searchParams.set('build', String(build));
  endpoint.searchParams.set('locale', locale);

  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  assert(response.ok, `Release-policy endpoint returned HTTP ${response.status}.`);
  const cacheControl = response.headers.get('cache-control') ?? '';
  assert(cacheControl.toLowerCase().includes('no-store'), 'Release-policy endpoint must return Cache-Control: no-store.');

  const body = await response.json();
  assert(typeof body.enabled === 'boolean', 'Response enabled must be boolean.');
  assert(body.platform === platform, 'Response platform does not match the probe platform.');
  assert(['current', 'optional', 'mandatory'].includes(body.status), 'Response status is invalid.');
  assertTarget(body.installed, 'installed');
  assert(body.installed.version === version && body.installed.build === build, 'Response installed target does not echo the probed binary.');

  if (body.latest !== null) assertTarget(body.latest, 'latest');
  if (body.minimumSupported !== null) assertTarget(body.minimumSupported, 'minimumSupported');
  if (body.releaseNotes !== null) assert(typeof body.releaseNotes === 'string', 'releaseNotes must be a string or null.');
  if (expected) assert(body.status === expected, `Expected ${expected}, received ${body.status}.`);

  console.log(JSON.stringify({
    endpoint: endpoint.toString(),
    enabled: body.enabled,
    status: body.status,
    installed: body.installed,
    latest: body.latest,
    minimumSupported: body.minimumSupported,
    cacheControl,
  }, null, 2));
  console.log('App update live policy probe: PASS');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
