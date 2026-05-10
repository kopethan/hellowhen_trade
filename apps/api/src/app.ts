import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { routes } from './routes.js';
import { airwallexWebhookRoutes } from './modules/money/providers/airwallexWebhook.routes.js';
import { stripeWebhookRoutes } from './modules/stripe/stripeWebhook.routes.js';
import { requireMoneyFeaturesVisible } from './middleware/featureGates.js';

const allowedOrigins = new Set([env.webOrigin, env.mobileOrigin].filter(Boolean));
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
  app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.has(origin) || isAllowedDevOrigin(origin)) return callback(null, true); return callback(new Error(`CORS origin not allowed: ${origin}`)); }, credentials: true }));
  app.use('/stripe', requireMoneyFeaturesVisible('Stripe webhook features'), express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhookRoutes);
  app.use('/airwallex', requireMoneyFeaturesVisible('Airwallex webhook features'), express.raw({ type: 'application/json', limit: '1mb' }), airwallexWebhookRoutes);
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', (_req, res, next) => {
    // Apply to existing files and fallthrough 404s so missing uploads report as
    // missing files instead of misleading browser CORP failures.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(env.uploadDir, {
    maxAge: env.nodeEnv === 'production' ? '1d' : 0,
    setHeaders(res) {
      // Web runs on a different origin from the API in local/dev and in many
      // deployments. Helmet's default Cross-Origin-Resource-Policy is
      // same-origin, which allows the upload to succeed but blocks the saved
      // image when the browser later renders it from /uploads.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }));
  app.use(routes);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: 'validation_error', message: 'Please check the form fields and try again.', issues: err.issues });
    if (err instanceof Error && 'statusCode' in err) {
      const statusCode = Number((err as Error & { statusCode?: unknown }).statusCode);
      const error = 'code' in err ? String((err as Error & { code?: unknown }).code) : 'request_error';
      const message = 'publicMessage' in err
        ? String((err as Error & { publicMessage?: unknown }).publicMessage)
        : err.message;
      if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) return res.status(statusCode).json({ error, message });
    }
    if (err instanceof Error && err.message === 'unsupported_image_type') return res.status(400).json({ error: 'unsupported_image_type', message: 'Upload a JPEG, PNG, or WEBP image.' });
    if (err instanceof Error && err.name === 'MulterError') return res.status(400).json({ error: 'upload_error', message: 'Image upload failed. Check file size and try again.' });
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  });
  return app;
}
