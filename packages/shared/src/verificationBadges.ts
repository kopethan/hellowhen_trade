export type VerificationBadgeTone = 'neutral' | 'success' | 'trusted' | 'professional' | 'business' | 'enterprise';

export type UserVerificationBadgeKind = 'email_verified' | 'professional' | 'trusted';
export type BusinessVerificationBadgeKind = 'business' | 'verified_business' | 'brand' | 'agency' | 'enterprise';
export type VerificationBadgeKind = UserVerificationBadgeKind | BusinessVerificationBadgeKind;

export type PublicVerificationBadge = {
  kind: VerificationBadgeKind;
  label: string;
  tone: VerificationBadgeTone;
  title?: string;
};

type UserBadgeInput = {
  emailVerifiedAt?: string | Date | null;
  trustTier?: string | null;
  professionalStatus?: string | null;
};

type BusinessBadgeInput = {
  type?: string | null;
  status?: string | null;
  verifiedAt?: string | Date | null;
};

export const userVerificationBadgeLabels: Record<UserVerificationBadgeKind, string> = {
  email_verified: 'Email verified',
  professional: 'Professional',
  trusted: 'Trusted member',
};

export const businessVerificationBadgeLabels: Record<BusinessVerificationBadgeKind, string> = {
  business: 'Business',
  verified_business: 'Verified business',
  brand: 'Brand',
  agency: 'Agency',
  enterprise: 'Enterprise',
};

function userBadge(kind: UserVerificationBadgeKind, tone: VerificationBadgeTone, title?: string): PublicVerificationBadge {
  return { kind, label: userVerificationBadgeLabels[kind], tone, ...(title ? { title } : {}) };
}

function businessBadge(kind: BusinessVerificationBadgeKind, tone: VerificationBadgeTone, title?: string): PublicVerificationBadge {
  return { kind, label: businessVerificationBadgeLabels[kind], tone, ...(title ? { title } : {}) };
}

export function getUserVerificationBadges(input: UserBadgeInput): PublicVerificationBadge[] {
  if (input.trustTier === 'restricted') return [];

  const badges: PublicVerificationBadge[] = [];
  if (input.emailVerifiedAt || input.trustTier === 'email_verified' || input.trustTier === 'stripe_verified' || input.trustTier === 'trusted') {
    badges.push(userBadge('email_verified', 'success', 'This member has verified their email address.'));
  }
  if (input.professionalStatus === 'verified') {
    badges.push(userBadge('professional', 'professional', 'This member has an admin-reviewed professional status.'));
  }
  if (input.trustTier === 'trusted') {
    badges.push(userBadge('trusted', 'trusted', 'This member has been manually marked trusted by Hellowhen admins.'));
  }
  return badges;
}

export function getBusinessVerificationBadges(input: BusinessBadgeInput): PublicVerificationBadge[] {
  const badges: PublicVerificationBadge[] = [];
  const type = input.type ?? 'business';

  badges.push(businessBadge('business', 'business', 'This is a Business profile namespace, separate from personal usernames.'));

  if (type === 'brand') badges.push(businessBadge('brand', 'business', 'This Business profile is marked as a brand.'));
  if (type === 'agency') badges.push(businessBadge('agency', 'business', 'This Business profile is marked as an agency.'));
  if (type === 'enterprise') badges.push(businessBadge('enterprise', 'enterprise', 'This Business profile is marked as an enterprise.'));

  if (input.status === 'verified' || input.verifiedAt) {
    badges.push(businessBadge('verified_business', 'success', 'This Business profile was verified by Hellowhen admins.'));
  }

  return badges;
}
