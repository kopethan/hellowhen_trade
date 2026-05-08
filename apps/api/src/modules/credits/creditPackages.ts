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
    { id: 'money_50', label: '€5 wallet', creditAmount: 50, amountCents: 500, currency, description: 'Small wallet top-up for trying the trade flow.' },
    { id: 'money_100', label: '€10 wallet', creditAmount: 100, amountCents: 1000, currency, description: 'Starter test balance for a few trades.' },
    { id: 'money_250', label: '€25 wallet', creditAmount: 250, amountCents: 2500, currency, description: 'More room to test proposal accept and escrow flows.' },
    { id: 'money_500', label: '€50 wallet', creditAmount: 500, amountCents: 5000, currency, description: 'Large wallet money pack for demos.' },
  ];
}

export function findCreditPackage(packageId: string) {
  return getCreditPackages().find((item) => item.id === packageId) ?? null;
}
