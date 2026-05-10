import bcrypt from 'bcryptjs';
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const passwordHashPromise = bcrypt.hash('password123', 12);

type DemoUserInput = {
  email: string;
  displayName: string;
  handle: string;
  bio: string;
  role?: 'user' | 'admin';
};

async function upsertDemoUser(input: DemoUserInput) {
  const passwordHash = await passwordHashPromise;
  const role = input.role ?? 'user';

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      passwordHash,
      role,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: input.email,
      passwordHash,
      role,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          displayName: input.displayName,
          handle: input.handle,
          bio: input.bio,
          countryCode: 'FR',
          preferredCurrency: 'eur',
        },
      },
      settings: { create: {} },
      identities: {
        create: {
          provider: 'email',
          providerUserId: input.email,
          email: input.email,
        },
      },
    },
    include: { profile: true, settings: true },
  });

  await prisma.userIdentity.upsert({
    where: { provider_providerUserId: { provider: 'email', providerUserId: input.email } },
    update: { userId: user.id, email: input.email },
    create: { userId: user.id, provider: 'email', providerUserId: input.email, email: input.email },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      displayName: input.displayName,
      handle: input.handle,
      bio: input.bio,
      countryCode: 'FR',
      preferredCurrency: 'eur',
    },
    create: {
      userId: user.id,
      displayName: input.displayName,
      handle: input.handle,
      bio: input.bio,
      countryCode: 'FR',
      preferredCurrency: 'eur',
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  return user;
}

async function removeLegacyMoneyDemoData(userIds: string[]) {
  const legacyTickets = await prisma.supportTicket.findMany({
    where: {
      userId: { in: userIds },
      OR: [
        { category: 'credits_issue' },
        { subject: { contains: 'credit', mode: 'insensitive' } },
        { subject: { contains: 'Stripe', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  const legacyTicketIds = legacyTickets.map((ticket) => ticket.id);

  if (legacyTicketIds.length) {
    await prisma.supportTicketMessage.deleteMany({ where: { ticketId: { in: legacyTicketIds } } });
    await prisma.supportTicket.deleteMany({ where: { id: { in: legacyTicketIds } } });
  }

  await prisma.creditLedgerEntry.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.creditPurchase.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });

  await prisma.trade.deleteMany({
    where: {
      ownerId: { in: userIds },
      OR: [
        { creditAmount: { gt: 0 } },
        { amountCents: { gt: 0 } },
        { title: { in: ['Need logo concept directions', 'Offer: profile bio rewrite'] } },
        { description: { contains: 'fake credit', mode: 'insensitive' } },
      ],
    },
  });
}

type SeedNeedData = Omit<Prisma.NeedUncheckedCreateInput, 'id' | 'ownerId' | 'title' | 'createdAt' | 'updatedAt'>;
type SeedOfferData = Omit<Prisma.OfferUncheckedCreateInput, 'id' | 'ownerId' | 'title' | 'createdAt' | 'updatedAt'>;
type SeedTradeData = Omit<Prisma.TradeUncheckedCreateInput, 'id' | 'ownerId' | 'title' | 'createdAt' | 'updatedAt' | 'creditAmount' | 'amountCents' | 'currency'>;

async function upsertNeed(ownerId: string, title: string, data: SeedNeedData) {
  const existing = await prisma.need.findFirst({ where: { ownerId, title } });
  if (existing) return prisma.need.update({ where: { id: existing.id }, data: data as Prisma.NeedUncheckedUpdateInput });
  return prisma.need.create({ data: { ownerId, title, ...data } as Prisma.NeedUncheckedCreateInput });
}

async function upsertOffer(ownerId: string, title: string, data: SeedOfferData) {
  const existing = await prisma.offer.findFirst({ where: { ownerId, title } });
  if (existing) return prisma.offer.update({ where: { id: existing.id }, data: data as Prisma.OfferUncheckedUpdateInput });
  return prisma.offer.create({ data: { ownerId, title, ...data } as Prisma.OfferUncheckedCreateInput });
}

async function upsertTrade(ownerId: string, title: string, data: SeedTradeData) {
  const safeData = {
    ...data,
    creditAmount: 0,
    amountCents: 0,
    currency: 'eur',
  };
  const existing = await prisma.trade.findFirst({ where: { ownerId, title } });
  if (existing) return prisma.trade.update({ where: { id: existing.id }, data: safeData as Prisma.TradeUncheckedUpdateInput });
  return prisma.trade.create({ data: { ownerId, title, ...safeData } as Prisma.TradeUncheckedCreateInput });
}

async function main() {
  const demo = await upsertDemoUser({
    email: 'demo@hellowhen.app',
    displayName: 'Demo Owner',
    handle: 'demo',
    bio: 'Demo owner account for testing Need, Offer, Trade, and proposal flows.',
  });

  const helper = await upsertDemoUser({
    email: 'helper@hellowhen.app',
    displayName: 'Helper User',
    handle: 'helper',
    bio: 'Demo helper account for sending proposals and completing service or goods exchanges.',
  });

  const admin = await upsertDemoUser({
    email: 'admin@hellowhen.app',
    displayName: 'Admin Reviewer',
    handle: 'admin',
    bio: 'Demo admin account for reviewing support tickets and safety reports.',
    role: 'admin',
  });

  await removeLegacyMoneyDemoData([demo.id, helper.id, admin.id]);

  const demoNeed = await upsertNeed(demo.id, 'Landing page hero review', {
    description: 'I need feedback on headline, CTA, and first fold for a small product launch page.',
    itemType: 'service',
    category: 'Design',
    timing: 'This week',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['design', 'launch'],
    status: 'active',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  });

  const demoOffer = await upsertOffer(demo.id, 'Product photo notes', {
    description: 'I can review product photos and suggest a cleaner shot list for a launch page or social post.',
    itemType: 'service',
    category: 'Photography',
    availability: 'Weekend',
    mode: 'remote',
    locationLabel: 'Remote',
    includes: ['Shot-list feedback', 'Simple composition notes'],
    tags: ['photos', 'launch'],
    status: 'active',
  });

  const helperNeed = await upsertNeed(helper.id, 'Short launch video edit', {
    description: 'I need help polishing a 45-second launch video and exporting it for mobile and social.',
    itemType: 'service',
    category: 'Video',
    timing: '24–48 hours',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['video', 'launch'],
    status: 'active',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
  });

  const helperOffer = await upsertOffer(helper.id, 'Brand naming feedback', {
    description: 'I can review names and give concise positioning feedback for early product ideas.',
    itemType: 'service',
    category: 'Branding',
    availability: 'This week',
    mode: 'remote',
    locationLabel: 'Remote',
    includes: ['Name shortlist review', 'Positioning notes'],
    tags: ['branding', 'naming'],
    status: 'active',
  });

  const goodsNeed = await upsertNeed(helper.id, 'Need simple product styling props', {
    description: 'I need a few clean styling props for a small product photo session.',
    itemType: 'goods',
    category: 'Goods',
    timing: 'Next week',
    mode: 'local',
    locationLabel: 'Local pickup',
    tags: ['props', 'photos'],
    status: 'active',
  });

  const goodsOffer = await upsertOffer(helper.id, 'Offer sample product pack', {
    description: 'I can provide a small sample pack for content testing or styling reference.',
    itemType: 'goods',
    category: 'Goods',
    availability: 'This week',
    mode: 'local',
    locationLabel: 'Local pickup',
    includes: ['Sample pack', 'Pickup details after acceptance'],
    tags: ['samples', 'goods'],
    status: 'active',
  });

  const openTrade = await upsertTrade(demo.id, 'Landing page hero review ↔ Product photo notes', {
    needId: demoNeed.id,
    offerId: demoOffer.id,
    description: 'I need a clearer landing page hero and can offer product photo notes in return.',
    status: 'active',
    isPublic: true,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  });

  const helperTrade = await upsertTrade(helper.id, 'Short launch video edit ↔ Brand naming feedback', {
    needId: helperNeed.id,
    offerId: helperOffer.id,
    description: 'I need help editing a short launch video and can offer brand naming feedback in return.',
    status: 'active',
    isPublic: true,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
  });

  await upsertTrade(helper.id, 'Product styling props ↔ Sample product pack', {
    needId: goodsNeed.id,
    offerId: goodsOffer.id,
    description: 'I need simple styling props and can offer a sample product pack for content testing.',
    status: 'active',
    isPublic: true,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
  });

  const existingProposal = await prisma.tradeProposal.findUnique({
    where: { tradeId_applicantId: { tradeId: openTrade.id, applicantId: helper.id } },
  });

  if (!existingProposal) {
    const proposal = await prisma.tradeProposal.create({
      data: {
        tradeId: openTrade.id,
        applicantId: helper.id,
        message: 'I can review the hero section and send a concise set of layout and copy notes tomorrow.',
      },
    });
    await prisma.proposalMessage.create({ data: { proposalId: proposal.id, senderId: helper.id, body: proposal.message } });
    await prisma.proposalMessage.create({ data: { proposalId: proposal.id, senderId: demo.id, body: 'Great — please focus on clarity and the first call to action.' } });
  }

  const existingSupportTicket = await prisma.supportTicket.findFirst({
    where: { userId: demo.id, subject: 'Need help with a trade proposal' },
  });

  if (!existingSupportTicket) {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: demo.id,
        category: 'trade_issue',
        priority: 'normal',
        subject: 'Need help with a trade proposal',
        message: 'I want to understand whether I should accept a proposal before the other person has confirmed the timeline.',
        relatedTradeId: openTrade.id,
      },
    });
    await prisma.supportTicketMessage.create({ data: { ticketId: ticket.id, senderId: demo.id, senderRole: 'user', body: ticket.message } });
    await prisma.supportTicketMessage.create({ data: { ticketId: ticket.id, senderId: admin.id, senderRole: 'admin', body: 'Ask for a clear delivery timeline in the proposal thread before accepting.' } });
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'waiting_for_user', assignedAdminId: admin.id } });
  }

  console.log('Seeded beta-safe demo accounts, Need/Offer inventory, one-to-one trades, proposal flow, and support ticket flow.');
  console.log('Owner:  demo@hellowhen.app / password123');
  console.log('Helper: helper@hellowhen.app / password123');
  console.log('Admin:  admin@hellowhen.app / password123');
  console.log(`Sample trades: ${openTrade.title}; ${helperTrade.title}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
