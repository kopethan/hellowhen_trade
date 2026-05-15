export type LegalPolicyKey = 'terms' | 'privacy' | 'safety' | 'refundDispute';

export const legalPolicyKeys: LegalPolicyKey[] = ['terms', 'privacy', 'safety', 'refundDispute'];

export const legalPolicyRoutes: Record<LegalPolicyKey, string> = {
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  safety: '/legal/safety',
  refundDispute: '/legal/refund-dispute',
};

export const legalPolicySectionKeys: Record<LegalPolicyKey, string[]> = {
  terms: ['starterScope', 'accountUse', 'adultUse', 'tradeRules', 'contentModeration', 'moneyDisabled', 'supportChanges'],
  privacy: ['starterScope', 'accountData', 'publicContent', 'safetySupport', 'mediaRetention', 'choices'],
  safety: ['starterScope', 'adultUse', 'allowedUse', 'notAllowed', 'reportsModeration', 'identityTrust', 'meetSafely'],
  refundDispute: ['starterScope', 'moneyDisabled', 'tradeIssues', 'adminActions', 'futureMoney', 'supportRecords'],
};
