import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function requireContains(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`${label}: missing ${needle}`);
}

function requireAbsent(source, needle, label) {
  if (source.includes(needle)) throw new Error(`${label}: found stale ${needle}`);
}

const planCreate = read('apps/web/src/features/plans/PlanCreateClient.tsx');
const planDetail = read('apps/web/src/features/plans/PlanDetailClient.tsx');
const planDiscussion = read('apps/web/src/features/plans/PlanPublicDiscussionClient.tsx');
const planList = read('apps/web/src/features/plans/PlansListClient.tsx');
const planFilters = read('apps/web/src/features/plans/planFilters.ts');
const placeCreate = read('apps/web/src/features/plans/PlaceCreateClient.tsx');
const placePicker = read('apps/web/src/features/plans/GooglePlacePicker.tsx');

for (const [needle, label] of [
  ["t('plans.create.edit.ownerOnly')", 'Plan Create owner guard'],
  ["t('plans.create.sourcePicker.editSavedFirst')", 'Plan Create reusable Place guard'],
  ["t('plans.create.validation.chooseStartForDuration')", 'Plan Create duration validation'],
  ["t('plans.create.joinDeadline", 'Plan Create join deadline'],
  ["t('plans.create.capacity", 'Plan Create capacity'],
  ["t('plans.create.customStop", 'Plan Create custom stops'],
]) requireContains(planCreate, needle, label);

for (const stale of [
  'Only the Plan owner can edit this Plan.',
  'Finish this Plan edit before editing the reusable Place itself.',
  'Choose a start date and time before selecting a duration.',
]) requireAbsent(planCreate, stale, 'Plan Create hardcoded copy');

for (const needle of [
  "t('plans.detail.values.local')",
  "t('plans.detail.values.online')",
  "t('plans.detail.sections.route')",
  "t('plans.detail.sections.details')",
  "t('plans.detail.actions.removeParticipant')",
  "t('plans.detail.presence.title')",
]) requireContains(planDetail, needle, 'Plan Detail translations');

requireContains(planDiscussion, "t('plans.discussion.title')", 'Plan discussion title');
requireContains(planDiscussion, "t('plans.discussion.composer.label')", 'Plan discussion composer');
requireContains(planList, "t('plans.deck.requirementsNeeded'", 'Plan idea requirement summary');
requireContains(planFilters, "label: 'In person'", 'Plan filter in-person terminology');
requireContains(planFilters, "label: 'Online'", 'Plan filter online terminology');
requireAbsent(planFilters, 'Local / offline', 'Plan filter stale terminology');

requireContains(placeCreate, "t('places.editor", 'Place editor translations');
requireContains(placeCreate, "t(`places.list.mapTemplate.families.${templateFamily}.label`)", 'Place map-template translations');
requireContains(placePicker, "t('places.googlePicker", 'Google Place picker translations');

const locales = {
  enPlans: read('packages/i18n/src/locales/en/plans.ts'),
  frPlans: read('packages/i18n/src/locales/fr/plans.ts'),
  esPlans: read('packages/i18n/src/locales/es/plans.ts'),
  enPlaces: read('packages/i18n/src/locales/en/places.ts'),
  frPlaces: read('packages/i18n/src/locales/fr/places.ts'),
  esPlaces: read('packages/i18n/src/locales/es/places.ts'),
};

requireContains(locales.enPlans, "local: { label: 'In person'", 'English Plan terminology');
requireContains(locales.enPlans, "remote: { label: 'Online'", 'English Plan terminology');
requireContains(locales.frPlans, "local: { label: 'Sur place'", 'French Plan terminology');
requireContains(locales.frPlans, "remote: { label: 'En ligne'", 'French Plan terminology');
requireContains(locales.esPlans, "local: { label: 'Presencial'", 'Spanish Plan terminology');
requireContains(locales.esPlans, "remote: { label: 'En línea'", 'Spanish Plan terminology');

for (const [name, source] of Object.entries(locales)) {
  requireAbsent(source.toLowerCase(), 'hors ligne', `${name} physical-place terminology`);
  requireAbsent(source.toLowerCase(), 'sin conexión', `${name} physical-place terminology`);
}

for (const source of [locales.enPlans, locales.frPlans, locales.esPlans]) {
  for (const key of ['ownerOnly:', 'editSavedFirst:', 'joinDeadline:', 'capacity:', 'participantStatus:', 'discussion:']) {
    requireContains(source, key, `Plan locale key parity ${key}`);
  }
}
for (const source of [locales.enPlaces, locales.frPlaces, locales.esPlaces]) {
  for (const key of ['googlePicker:', 'mapTemplate:', 'editor:']) {
    requireContains(source, key, `Place locale key parity ${key}`);
  }
}

console.log('Plan Create / Detail / Discussion i18n wiring: PASS');
console.log('Place editor / Google picker i18n wiring: PASS');
console.log('In person / Online terminology parity (EN/FR/ES): PASS');
console.log('WEB-PARITY-FIX3 Plan/Place i18n + terminology parity smoke: PASS');
