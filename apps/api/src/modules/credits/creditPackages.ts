import { env } from '../../config/env.js';

export type CreditPackage = {
  id: string;
  label: string;
  creditAmount: number;
  amountCents: number;
  currency: string;
  description: string;
};

export function getCreditPackages(): CreditPackage[] {
  const currency = env.stripeCurrency;
  return [
    { id: 'credits_50', label: '50 credits', creditAmount: 50, amountCents: 500, currency, description: 'Small test top-up for trying the trade flow.' },
    { id: 'credits_100', label: '100 credits', creditAmount: 100, amountCents: 1000, currency, description: 'Starter test balance for a few trades.' },
    { id: 'credits_250', label: '250 credits', creditAmount: 250, amountCents: 2500, currency, description: 'More room to test proposal accept and escrow flows.' },
    { id: 'credits_500', label: '500 credits', creditAmount: 500, amountCents: 5000, currency, description: 'Large fake/test credit pack for demos.' },
  ];
}

export function findCreditPackage(packageId: string) {
  return getCreditPackages().find((item) => item.id === packageId) ?? null;
}
