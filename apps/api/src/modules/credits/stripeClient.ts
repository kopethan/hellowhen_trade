import Stripe from 'stripe';
import { env } from '../../config/env.js';

let stripe: Stripe | null = null;

export function isStripeConfigured() {
  return Boolean(env.stripeSecretKey && env.stripeSecretKey.startsWith('sk_test_') && !env.stripeSecretKey.includes('replace_me'));
}

export function getStripe() {
  if (!isStripeConfigured()) return null;
  if (!stripe) {
    stripe = new Stripe(env.stripeSecretKey);
  }
  return stripe;
}
