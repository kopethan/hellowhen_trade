export type SupportedCurrency = 'eur' | 'usd' | 'gbp';

export type CountryOption = {
  code: string;
  label: string;
  currency: SupportedCurrency;
};

export const countryOptions: CountryOption[] = [
  { code: 'FR', label: 'France', currency: 'eur' },
  { code: 'US', label: 'United States', currency: 'usd' },
  { code: 'GB', label: 'United Kingdom', currency: 'gbp' },
  { code: 'DE', label: 'Germany', currency: 'eur' },
  { code: 'ES', label: 'Spain', currency: 'eur' },
  { code: 'IT', label: 'Italy', currency: 'eur' },
];

export const currencyOptions: Array<{ code: SupportedCurrency; label: string; helper: string }> = [
  { code: 'eur', label: 'EUR', helper: 'Euro' },
  { code: 'usd', label: 'USD', helper: 'US dollar' },
  { code: 'gbp', label: 'GBP', helper: 'British pound' },
];

export function getCountryLabel(code?: string | null) {
  return countryOptions.find((country) => country.code === code)?.label ?? 'Select country';
}

export function getCurrencyLabel(currency?: string | null) {
  return currencyOptions.find((option) => option.code === currency)?.label ?? 'Select currency';
}

export function getDefaultCurrencyForCountry(code?: string | null): SupportedCurrency {
  return countryOptions.find((country) => country.code === code)?.currency ?? 'eur';
}
