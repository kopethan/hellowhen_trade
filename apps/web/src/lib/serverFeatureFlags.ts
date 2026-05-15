import fs from 'node:fs';
import path from 'node:path';

function findRepoRoot(startDir: string) {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, 'package.json')) && fs.existsSync(path.join(current, 'apps'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return startDir;
    current = parent;
  }
}

const repoRoot = findRepoRoot(process.cwd());
const rootEnvPath = path.join(repoRoot, '.env');

function parseRootEnv() {
  const values: Record<string, string> = {};
  let raw = '';
  try {
    raw = fs.readFileSync(rootEnvPath, 'utf8');
  } catch {
    return values;
  }

  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2] ?? '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    const key = match[1];
    if (key) values[key] = value;
  }

  return values;
}

function rootEnvValue(name: string) {
  return parseRootEnv()[name] ?? process.env[name];
}

function enabled(value: string | undefined) {
  return value?.toLowerCase() === 'true';
}

export function getPlansWebFlags() {
  const plansEnabled = enabled(rootEnvValue('NEXT_PUBLIC_PLANS_ENABLED'));
  return {
    plansEnabled,
    plansVisible: plansEnabled && enabled(rootEnvValue('NEXT_PUBLIC_PLANS_VISIBLE')),
  };
}
