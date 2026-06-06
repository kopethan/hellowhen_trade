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

export type WizardDraftScope = 'create-need' | 'create-offer' | 'create-trade';

export function buildMobileWizardDraftKey(scope: WizardDraftScope, userId?: string | null) {
  return `hellowhen:mobile:wizard:${scope}:${userId ?? 'anonymous'}`;
}
