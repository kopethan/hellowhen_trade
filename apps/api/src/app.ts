import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { routes } from './routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: [env.webOrigin, env.mobileOrigin], credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(routes);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
