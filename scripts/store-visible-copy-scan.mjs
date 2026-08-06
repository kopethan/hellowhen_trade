#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const SOURCE_ROOTS = [
  'apps/mobile/src',
  'apps/web/src',
  'packages/i18n/src/locales',
];

const SINGLE_FILES = [
  'apps/mobile/app.json',
  'packages/i18n/src/legalPolicies.ts',
];

const OPTIONAL_PUBLIC_ROOTS = [
  'apps/web/public',
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const PUBLIC_TEXT_EXTENSIONS = new Set(['.json', '.html', '.htm', '.txt', '.webmanifest']);

const EXCLUDED_PATH_PARTS = [
  '/apps/web/src/app/admin/',
  '/__tests__/',
  '/fixtures/',
];

const EXCLUDED_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/i,
  /\.spec\.[cm]?[jt]sx?$/i,
];

const FORBIDDEN_PATTERNS = [
  {
    id: 'beta-label',
    description: 'production copy must not present the app or a feature as beta',
    regex: /\b(?:beta|bêta)\b/iu,
  },
  {
    id: 'demo-feed',
    description: 'production copy must not present public content as a demo feed/inventory/detail',
    regex: /\b(?:(?:demo|démo)\s+(?:feed|inventory|detail|flux|inventaire|détail|fuente|inventario|detalle)|(?:feed|inventory|detail|flux|inventaire|détail|fuente|inventario|detalle)\s+(?:demo|démo))\b/iu,
  },
  {
    id: 'prototype-label',
    description: 'production copy must not expose prototype-only presentation',
    regex: /(?:^|\s)(?:hidden\s+prototype|prototype\s+only|prototype)(?:\s|$)/iu,
  },
  {
    id: 'testing-flow',
    description: 'production copy must not describe a user flow as a test harness',
    regex: /\b(?:testing\s+the\s+flow|test\s+the\s+flow|tester\s+le\s+flux|flux\s+de\s+test|probar\s+el\s+flujo|flujo\s+de\s+prueba)\b/iu,
  },
  {
    id: 'before-launch',
    description: 'production policy and product copy must not read as unfinished pre-launch content',
    regex: /\b(?:before\s+(?:public\s+)?launch|avant\s+(?:le\s+)?lancement|antes\s+del\s+lanzamiento)\b/iu,
  },
  {
    id: 'test-build',
    description: 'production copy must not identify the submitted binary as a test build',
    regex: /\b(?:test(?:ing)?\s+build|build\s+de\s+test|version\s+de\s+test|compilation\s+de\s+prueba)\b/iu,
  },
];

function normalizeRelativePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function normalizeVisibleText(value) {
  return value
    .replace(/\\[nrt]/g, ' ')
    .replace(/\$\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractQuotedLiterals(source) {
  const literals = [];
  let index = 0;
  let line = 1;

  while (index < source.length) {
    const character = source[index];
    if (character !== "'" && character !== '"' && character !== '`') {
      if (character === '\n') line += 1;
      index += 1;
      continue;
    }

    const quote = character;
    const startIndex = index;
    const startLine = line;
    let value = '';
    index += 1;

    while (index < source.length) {
      const current = source[index];
      if (current === '\\') {
        value += current;
        index += 1;
        if (index < source.length) {
          if (source[index] === '\n') line += 1;
          value += source[index];
          index += 1;
        }
        continue;
      }
      if (current === quote) {
        index += 1;
        literals.push({ value, line: startLine, index: startIndex });
        break;
      }
      if (current === '\n') line += 1;
      value += current;
      index += 1;
    }
  }

  return literals;
}

function extractJsxText(source) {
  const literals = [];
  const regex = />([^<>{]+)</g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const value = normalizeVisibleText(match[1]);
    if (!value) continue;
    literals.push({ value, line: lineNumberAt(source, match.index + 1), index: match.index + 1 });
  }
  return literals;
}

function extractJsonStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractJsonStrings(item, output);
    return output;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) extractJsonStrings(item, output);
  }
  return output;
}

function isExcluded(relativePath) {
  const normalized = `/${relativePath}`;
  return EXCLUDED_PATH_PARTS.some((part) => normalized.includes(part))
    || EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function collectFiles(directory, allowedExtensions, files = []) {
  const absolute = path.join(root, directory);
  if (!existsSync(absolute)) return files;

  for (const entry of readdirSync(absolute)) {
    const candidate = path.join(absolute, entry);
    const stats = statSync(candidate);
    if (stats.isDirectory()) {
      collectFiles(path.relative(root, candidate), allowedExtensions, files);
      continue;
    }
    const relativePath = normalizeRelativePath(candidate);
    if (isExcluded(relativePath)) continue;
    if (allowedExtensions.has(path.extname(candidate).toLowerCase())) files.push(candidate);
  }
  return files;
}

function inspectVisibleText(relativePath, visibleText, line, findings) {
  const normalized = normalizeVisibleText(visibleText);
  if (!normalized) return;

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (!pattern.regex.test(normalized)) continue;
    findings.push({
      file: relativePath,
      line,
      rule: pattern.id,
      description: pattern.description,
      text: normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized,
    });
  }
}

function scanSourceFile(filePath, findings) {
  const relativePath = normalizeRelativePath(filePath);
  const source = readFileSync(filePath, 'utf8');
  const seen = new Set();

  for (const literal of [...extractQuotedLiterals(source), ...extractJsxText(source)]) {
    const key = `${literal.line}:${literal.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    inspectVisibleText(relativePath, literal.value, literal.line, findings);
  }
}

function scanJsonFile(filePath, findings) {
  const relativePath = normalizeRelativePath(filePath);
  const source = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(source);
  for (const value of extractJsonStrings(parsed)) {
    const index = source.indexOf(JSON.stringify(value));
    inspectVisibleText(relativePath, value, index >= 0 ? lineNumberAt(source, index) : 1, findings);
  }
}

function scanPublicTextFile(filePath, findings) {
  const relativePath = normalizeRelativePath(filePath);
  const source = readFileSync(filePath, 'utf8');
  for (const [offset, line] of source.split(/\r?\n/).entries()) {
    inspectVisibleText(relativePath, line, offset + 1, findings);
  }
}

function runPatternSelfTest() {
  const blocked = [
    'Beta',
    'Bêta privée',
    'Demo feed',
    'Inventaire démo',
    'Hidden prototype',
    'Testing the flow',
    'Before public launch',
    'Test build',
  ];
  const allowed = [
    'I need someone to test my app like a normal user',
    'Testing · Remote',
    'betaFeatures',
    'demo-top-up',
    'Reviewer demo account',
  ];

  for (const sample of blocked) {
    if (!FORBIDDEN_PATTERNS.some((pattern) => pattern.regex.test(sample))) {
      throw new Error(`Store copy scanner self-test failed to block: ${sample}`);
    }
  }
  for (const sample of allowed) {
    if (FORBIDDEN_PATTERNS.some((pattern) => pattern.regex.test(sample))) {
      throw new Error(`Store copy scanner self-test incorrectly blocked: ${sample}`);
    }
  }
}

function main() {
  runPatternSelfTest();

  const findings = [];
  const sourceFiles = SOURCE_ROOTS.flatMap((directory) => collectFiles(directory, SOURCE_EXTENSIONS));
  for (const relativePath of SINGLE_FILES) {
    const filePath = path.join(root, relativePath);
    if (!existsSync(filePath)) throw new Error(`Required store-copy scan target is missing: ${relativePath}`);
    if (path.extname(filePath).toLowerCase() === '.json') scanJsonFile(filePath, findings);
    else scanSourceFile(filePath, findings);
  }
  for (const filePath of sourceFiles) scanSourceFile(filePath, findings);

  const publicFiles = OPTIONAL_PUBLIC_ROOTS.flatMap((directory) => collectFiles(directory, PUBLIC_TEXT_EXTENSIONS));
  for (const filePath of publicFiles) {
    if (path.extname(filePath).toLowerCase() === '.json' || path.extname(filePath).toLowerCase() === '.webmanifest') scanJsonFile(filePath, findings);
    else scanPublicTextFile(filePath, findings);
  }

  const uniqueFindings = [...new Map(findings.map((finding) => [
    `${finding.file}:${finding.line}:${finding.rule}:${finding.text}`,
    finding,
  ])).values()];

  if (uniqueFindings.length > 0) {
    console.error('Store-visible copy scan: FAIL');
    for (const finding of uniqueFindings) {
      console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.text}`);
      console.error(`  ${finding.description}.`);
    }
    console.error('\nRemove or rewrite the production-visible wording. Keep internal identifiers, test fixtures, reviewer-account notes, and TestFlight documentation outside store-visible source copy.');
    process.exitCode = 1;
    return;
  }

  console.log(`Store-visible copy scan: PASS (${sourceFiles.length + publicFiles.length + SINGLE_FILES.length} files checked)`);
}

main();
