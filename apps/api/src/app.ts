import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { routes } from './routes.js';
import { serveUploadedMedia } from './modules/media/media.routes.js';
import { airwallexWebhookRoutes } from './modules/money/providers/airwallexWebhook.routes.js';
import { stripeWebhookRoutes } from './modules/stripe/stripeWebhook.routes.js';
import { stripeMembershipWebhookRoutes } from './modules/subscriptions/stripeMembershipWebhook.js';
import { requireMoneyFeaturesVisible } from './middleware/featureGates.js';
import { recordApiRequestMetric } from './middleware/apiRequestMetrics.js';

const allowedOrigins = new Set([env.webOrigin, env.mobileOrigin].filter(Boolean));

class CorsOriginError extends Error {
  statusCode = 403;
  code = 'cors_origin_not_allowed';
  publicMessage = 'This origin is not allowed to access the API.';

  constructor() {
    super('CORS origin not allowed.');
  }
}
function isPrivateLanHostname(hostname: string) {
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d{1,2})\./);
  if (!match) return false;
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isAllowedDevOrigin(origin: string) {
  if (env.nodeEnv !== 'development') return false;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin.startsWith('http://10.0.2.2:') || origin.startsWith('exp://')) return true;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && isPrivateLanHostname(parsed.hostname);
  } catch {
    return false;
  }
}
export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || isAllowedDevOrigin(origin)) return callback(null, true);
      return callback(new CorsOriginError());
    },
    credentials: true,
    optionsSuccessStatus: 204
  }));
  app.use('/stripe', requireMoneyFeaturesVisible('Stripe webhook features'), express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhookRoutes);
  app.use('/subscriptions/stripe', express.raw({ type: 'application/json', limit: '1mb' }), stripeMembershipWebhookRoutes);
  app.use('/airwallex', requireMoneyFeaturesVisible('Airwallex webhook features'), express.raw({ type: 'application/json', limit: '1mb' }), airwallexWebhookRoutes);
  app.use(express.json({ limit: '1mb' }));
  app.use(recordApiRequestMetric);
  app.get('/uploads/:storageKey', serveUploadedMedia);
  app.use('/uploads', (_req, res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return res.status(404).json({ error: 'not_found' });
  });
  app.use(routes);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: 'validation_error', message: 'Please check the form fields and try again.', issues: err.issues });
    if (err instanceof Error && 'statusCode' in err) {
      const statusCode = Number((err as Error & { statusCode?: unknown }).statusCode);
      const error = 'code' in err ? String((err as Error & { code?: unknown }).code) : 'request_error';
      const hasPublicMessage = 'publicMessage' in err;
      const message = hasPublicMessage
        ? String((err as Error & { publicMessage?: unknown }).publicMessage)
        : err.message;
      if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) return res.status(statusCode).json({ error, message });
      if (Number.isInteger(statusCode) && statusCode >= 500 && statusCode < 600 && hasPublicMessage) {
        console.error(err);
        return res.status(statusCode).json({ error, message });
      }
    }
    if (err instanceof Error && err.message === 'unsupported_image_type') return res.status(400).json({ error: 'unsupported_image_type', message: 'Upload a JPEG, PNG, or WEBP image.' });
    if (err instanceof Error && err.name === 'MulterError') return res.status(400).json({ error: 'upload_error', message: 'Image upload failed. Check file size and try again.' });
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  });
  return app;
}
