import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@zizilia.app';
  const passwordHash = await bcrypt.hash('password123', 12);

  let user = await prisma.user.findUnique({
    where: { email },
    include: { wallet: true }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            displayName: 'Demo User',
            handle: 'demo'
          }
        },
        settings: {
          create: {}
        },
        wallet: {
          create: {
            purchasedAvailableCredits: 100
          }
        }
      },
      include: { wallet: true }
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
  }

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      displayName: 'Demo User',
      handle: 'demo'
    },
    update: {
      displayName: 'Demo User'
    }
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {}
  });

  const wallet = user.wallet ?? await prisma.wallet.create({
    data: {
      userId: user.id,
      purchasedAvailableCredits: 100
    }
  });

  const existingGrant = await prisma.creditLedgerEntry.findFirst({
    where: {
      userId: user.id,
      walletId: wallet.id,
      type: 'test_credit_grant',
      description: 'Demo seed fake starting credits'
    }
  });

  if (!existingGrant) {
    await prisma.creditLedgerEntry.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        type: 'test_credit_grant',
        balanceType: 'purchased',
        amount: 100,
        description: 'Demo seed fake starting credits'
      }
    });
  }

  console.log('Seeded demo@zizilia.app / password123');
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
