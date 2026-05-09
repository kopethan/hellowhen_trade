import { Router } from 'express';
import { env } from '../../../config/env.js';
import { prisma } from '../../../lib/prisma.js';
import { getMoneyProvider } from './moneyProviderRegistry.js';
import { MoneyProviderError } from './moneyProvider.types.js';
import { verifyAirwallexWebhookSignature } from './airwallexClient.js';

export const airwallexWebhookRoutes = Router();

type AirwallexWebhookEvent = {
  id?: string;
  name?: string;
  account_id?: string;
  org_id?: string;
  data?: Record<string, unknown>;
  created_at?: string;
  version?: string;
  [key: string]: unknown;
};

function parseEvent(rawBody: Buffer): AirwallexWebhookEvent {
  const text = rawBody.toString('utf8');
  if (!text) return {};
  return JSON.parse(text) as AirwallexWebhookEvent;
}

function eventId(event: AirwallexWebhookEvent) {
  return event.id || `${event.name ?? 'unknown'}:${event.account_id ?? event.org_id ?? 'global'}:${event.created_at ?? Date.now()}`;
}

function eventName(event: AirwallexWebhookEvent) {
  return event.name || 'unknown';
}

function eventProviderAccountId(event: AirwallexWebhookEvent) {
  const data = event.data && typeof event.data === 'object' ? event.data : {};
  const accountId = event.account_id
    ?? (typeof data.account_id === 'string' ? data.account_id : undefined)
    ?? (typeof data.accountId === 'string' ? data.accountId : undefined)
    ?? (typeof data.id === 'string' && data.id.startsWith('acct_') ? data.id : undefined);
  return accountId ?? null;
}

async function syncAccountFromEvent(event: AirwallexWebhookEvent) {
  const providerAccountId = eventProviderAccountId(event);
  if (!providerAccountId) return null;
  const stored = await prisma.moneyProviderAccount.findUnique({ where: { provider_providerAccountId: { provider: 'airwallex', providerAccountId } } });
  if (!stored) return null;
  const provider = getMoneyProvider('airwallex');
  return provider.syncConnectedAccountStatus({ providerAccountId }).catch(() => null);
}

function eventData(event: AirwallexWebhookEvent) {
  return event.data && typeof event.data === 'object' ? event.data : {};
}

function transferIdFromEvent(event: AirwallexWebhookEvent) {
  const data = eventData(event);
  const value = data.id ?? data.transfer_id ?? data.payment_id ?? data.request_id ?? data.short_reference_id;
  return typeof value === 'string' && value.trim() ? value : null;
}

function isPayoutTransferEvent(event: AirwallexWebhookEvent) {
  const name = eventName(event).toLowerCase();
  if (name.startsWith('payout.transfer')) return true;
  const data = eventData(event);
  return Boolean(data.transfer_id || data.payment_id || data.short_reference_id || data.request_id);
}

async function syncPayoutTransferFromEvent(event: AirwallexWebhookEvent) {
  if (!isPayoutTransferEvent(event)) return null;
  const providerTransferId = transferIdFromEvent(event);
  if (!providerTransferId) return null;
  const linked = await prisma.payoutRequest.findFirst({
    where: {
      provider: 'airwallex',
      OR: [
        { providerTransferId },
        { providerPayoutId: providerTransferId },
      ],
    },
    select: { id: true },
  });
  if (!linked) return null;
  const provider = getMoneyProvider('airwallex');
  return provider.syncPayoutTransfer({ payoutId: linked.id, providerTransferId }).catch(() => null);
}

airwallexWebhookRoutes.post('/webhook', async (req, res) => {
  if (!env.moneyProviderWebhooksEnabled || !env.airwallexEnabled) return res.status(503).json({ error: 'airwallex_webhooks_disabled' });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'airwallex_webhook_raw_body_required' });

  try {
    verifyAirwallexWebhookSignature({
      rawBody: req.body,
      timestamp: req.headers['x-timestamp'],
      signature: req.headers['x-signature'],
      clientSecretKey: req.headers['client-secret-key'],
    });
  } catch (error) {
    if (error instanceof MoneyProviderError) return res.status(error.statusCode).json({ error: error.code, message: error.publicMessage });
    throw error;
  }

  let event: AirwallexWebhookEvent;
  try {
    event = parseEvent(req.body);
  } catch {
    return res.status(400).json({ error: 'airwallex_webhook_invalid_json' });
  }

  const providerEventId = eventId(event);
  const providerAccountId = eventProviderAccountId(event);
  const type = eventName(event);
  const existing = await prisma.moneyProviderEvent.findUnique({ where: { provider_providerEventId: { provider: 'airwallex', providerEventId } } });
  if (existing?.status === 'processed') return res.json({ received: true, duplicate: true });

  const record = await prisma.moneyProviderEvent.upsert({
    where: { provider_providerEventId: { provider: 'airwallex', providerEventId } },
    create: { provider: 'airwallex', providerEventId, eventType: type, providerAccountId, status: 'received', payload: JSON.parse(JSON.stringify(event)) },
    update: { eventType: type, providerAccountId, status: 'received', payload: JSON.parse(JSON.stringify(event)), error: null },
  });

  try {
    const [syncedAccount, syncedPayout] = await Promise.all([
      syncAccountFromEvent(event),
      syncPayoutTransferFromEvent(event),
    ]);
    await prisma.moneyProviderEvent.update({ where: { id: record.id }, data: { status: syncedAccount || syncedPayout ? 'processed' : 'ignored', processedAt: new Date(), error: null } });
    return res.json({ received: true, processed: Boolean(syncedAccount || syncedPayout), syncedAccount: Boolean(syncedAccount), syncedPayout: Boolean(syncedPayout) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Airwallex webhook processing failed';
    await prisma.moneyProviderEvent.update({ where: { id: record.id }, data: { status: 'failed', error: message } }).catch(() => null);
    return res.status(500).json({ error: 'airwallex_webhook_processing_failed' });
  }
});
