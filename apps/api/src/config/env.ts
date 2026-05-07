import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-change-me',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  mobileOrigin: process.env.MOBILE_ORIGIN ?? 'exp://127.0.0.1:8081',
  uploadDir: process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads'),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripeCurrency: (process.env.STRIPE_CURRENCY ?? 'eur').toLowerCase(),
  webAppUrl: process.env.WEB_APP_URL ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  mobileAppUrl: process.env.MOBILE_APP_URL ?? 'hellowhen://',
  googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? '',
  googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Hellowhen <support@hellowhen.app>',
  passwordResetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 45)
};
