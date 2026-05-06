import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-change-me',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  mobileOrigin: process.env.MOBILE_ORIGIN ?? 'exp://127.0.0.1:8081'
};
