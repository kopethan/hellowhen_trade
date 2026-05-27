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

export function requireBusinessAccountsEnabled(surface = 'Business accounts'): RequestHandler {
  if (!env.businessAccountsEnabled) {
    return disabledSurface('business_accounts_disabled', `${surface} are disabled for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requireBusinessAccountsVisible(surface = 'Business accounts'): RequestHandler {
  if (!env.businessAccountsEnabled || !env.businessAccountsVisible) {
    return disabledSurface('business_accounts_hidden', `${surface} are hidden for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requireBusinessSponsoredContentEnabled(surface = 'Business sponsored content'): RequestHandler {
  if (!env.businessAccountsEnabled || !env.businessSponsoredContentEnabled) {
    return disabledSurface('business_sponsored_content_disabled', `${surface} is disabled for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requireBusinessCampaignsEnabled(surface = 'Business campaigns'): RequestHandler {
  if (!env.businessAccountsEnabled || !env.businessCampaignsEnabled) {
    return disabledSurface('business_campaigns_disabled', `${surface} are disabled for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requirePlansEnabled(surface = 'Plans'): RequestHandler {
  if (!env.plansEnabled) {
    return disabledSurface('plans_disabled', `${surface} are disabled for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requirePlansVisible(surface = 'Plans'): RequestHandler {
  if (!env.plansEnabled || !env.plansVisible) {
    return disabledSurface('plans_hidden', `${surface} are hidden for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requireSubscriptionsEnabled(surface = 'Subscriptions'): RequestHandler {
  if (!env.subscriptionsEnabled) {
    return disabledSurface('subscriptions_disabled', `${surface} are disabled for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requireProAccountsEnabled(surface = 'Professional accounts'): RequestHandler {
  if (!env.subscriptionsEnabled || !env.proAccountsEnabled) {
    return disabledSurface('pro_accounts_disabled', `${surface} are disabled for this launch.`);
  }
  return (_req, _res, next) => next();
}

export function requireProAccountsVisible(surface = 'Professional accounts'): RequestHandler {
  if (!env.subscriptionsEnabled || !env.proAccountsEnabled || !env.proAccountsVisible) {
    return disabledSurface('pro_accounts_hidden', `${surface} are hidden for this launch.`);
  }
  return (_req, _res, next) => next();
}
