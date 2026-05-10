import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

function disabledSurface(error: string, message: string): RequestHandler {
  return (_req, res) => {
    res.status(404).json({ error, message });
  };
}

export function requireMoneyFeaturesVisible(surface = 'Money features'): RequestHandler {
  if (!env.moneyFeaturesVisible || env.moneyLaunchMode === 'disabled') {
    return disabledSurface('money_launch_disabled', `${surface} are disabled for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requireWalletVisible(surface = 'Wallet features'): RequestHandler {
  if (!env.moneyFeaturesVisible || !env.walletVisible || env.moneyLaunchMode === 'disabled') {
    return disabledSurface('wallet_disabled', `${surface} are disabled for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requirePayoutsVisible(surface = 'Payout features'): RequestHandler {
  if (!env.moneyFeaturesVisible || !env.payoutsVisible || env.moneyLaunchMode === 'disabled') {
    return disabledSurface('payouts_disabled', `${surface} are disabled for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requireBusinessAccountsVisible(surface = 'Business accounts'): RequestHandler {
  if (!env.businessAccountsVisible) {
    return disabledSurface('business_accounts_disabled', `${surface} are disabled for this launch.`);
  }
  return (_req, _res, next) => next();
}
