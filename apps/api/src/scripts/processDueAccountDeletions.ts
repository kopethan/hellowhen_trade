import { prisma } from '../lib/prisma.js';
import {
  assertAccountDeletionRuntimeConfigSafe,
  processDueAccountDeletions,
} from '../modules/account/accountDeletion.lifecycle.js';

async function main() {
  assertAccountDeletionRuntimeConfigSafe();
  const result = await processDueAccountDeletions(new Date());
  console.log(`Account deletion due sweep: scanned=${result.scanned} completed=${result.completed} failed=${result.failed}`);
  if (result.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Account deletion due sweep failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
