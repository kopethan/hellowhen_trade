import { createApp } from './app.js';
import { env, validateProductionEnv } from './config/env.js';

validateProductionEnv();

const app = createApp();

app.listen(env.port, () => {
  console.log(`Hellowhen API listening on ${env.port}`);
});
