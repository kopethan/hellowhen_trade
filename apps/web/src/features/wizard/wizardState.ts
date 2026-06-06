export {
  WIZARD_DRAFT_MAX_AGE_DAYS,
  WIZARD_DRAFT_VERSION,
  createWizardDraftEnvelope,
  hasWizardDraftContent,
  isWizardDraftExpired,
  parseWizardDraft,
  serializeWizardDraft,
  trimWizardTextFields,
  type WizardDraftEnvelope,
} from '@hellowhen/shared';

export type WebWizardDraftScope = 'create-need' | 'create-offer' | 'create-trade';

export function buildWebWizardDraftKey(scope: WebWizardDraftScope, userId?: string | null) {
  return `hellowhen:web:wizard:${scope}:${userId ?? 'anonymous'}`;
}
