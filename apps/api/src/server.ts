import { createApp } from './app.js';
import { env, validateProductionEnv } from './config/env.js';
import { assertAccountDeletionRuntimeConfigSafe, startAccountDeletionLifecycle } from './modules/account/accountDeletion.lifecycle.js';

validateProductionEnv();
assertAccountDeletionRuntimeConfigSafe();

const app = createApp();

app.listen(env.port, () => {
  console.log(`Hellowhen API listening on ${env.port}`);
  startAccountDeletionLifecycle();
});
