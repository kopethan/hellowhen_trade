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
type SeedInventoryTemplateData = Omit<Prisma.InventoryTemplateUncheckedCreateInput, 'id' | 'createdAt' | 'updatedAt'>;

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

async function upsertInventoryTemplate(data: SeedInventoryTemplateData) {
  return prisma.inventoryTemplate.upsert({
    where: { key: data.key },
    update: data as Prisma.InventoryTemplateUncheckedUpdateInput,
    create: data as Prisma.InventoryTemplateUncheckedCreateInput,
  });
}

const starterInventoryTemplates: SeedInventoryTemplateData[] = [
  {
    key: 'starter-need-landing-page-design',
    kind: 'need',
    sourceType: 'hellowhen',
    title: 'Landing page design',
    description: 'Start from this when you need a simple landing page layout, hero section, and clear call to action.',
    itemType: 'service',
    category: 'Design',
    timing: 'This week',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['design', 'landing', 'web'],
    status: 'active',
    sortOrder: 10,
  },
  {
    key: 'starter-need-homepage-copy-cleanup',
    kind: 'need',
    sourceType: 'hellowhen',
    title: 'Homepage copy cleanup',
    description: 'Use this when your homepage text needs to become clearer, shorter, and easier to understand.',
    itemType: 'service',
    category: 'Copywriting',
    timing: 'Next few days',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['copy', 'homepage', 'writing'],
    status: 'active',
    sortOrder: 20,
  },
  {
    key: 'starter-need-short-form-video-edit',
    kind: 'need',
    sourceType: 'hellowhen',
    title: 'Short-form video edit',
    description: 'Start from this when you need a short vertical video cleaned up with a stronger hook, cuts, captions, or export.',
    itemType: 'service',
    category: 'Video',
    timing: '48 hours',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['video', 'editing', 'social'],
    status: 'active',
    sortOrder: 30,
  },
  {
    key: 'starter-need-product-photo-retouching',
    kind: 'need',
    sourceType: 'hellowhen',
    title: 'Product photo retouching',
    description: 'Use this when product photos need cleanup, color correction, background polishing, or light retouching.',
    itemType: 'service',
    category: 'Photography',
    timing: 'This week',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['photo', 'retouch', 'product'],
    status: 'active',
    sortOrder: 40,
  },
  {
    key: 'starter-need-mobile-web-beta-test',
    kind: 'need',
    sourceType: 'hellowhen',
    title: 'Mobile web beta test',
    description: 'Use this when you need someone to test a mobile web flow and send clear notes about bugs or confusing steps.',
    itemType: 'service',
    category: 'Testing',
    timing: 'Today or tomorrow',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['testing', 'mobile', 'qa'],
    status: 'active',
    sortOrder: 50,
  },
  {
    key: 'starter-need-intro-email-polish',
    kind: 'need',
    sourceType: 'hellowhen',
    title: 'Intro email polish',
    description: 'Start from this when an introduction, outreach, or pitch email needs to feel clearer and friendlier.',
    itemType: 'service',
    category: 'Email',
    timing: 'Tomorrow',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['email', 'copy', 'outreach'],
    status: 'active',
    sortOrder: 60,
  },
  {
    key: 'starter-need-product-sample-pack',
    kind: 'need',
    sourceType: 'hellowhen',
    title: 'Product sample pack',
    description: 'Use this when you need small product samples for testing, styling, content, or feedback.',
    itemType: 'goods',
    category: 'Goods',
    timing: 'This month',
    mode: 'hybrid',
    locationLabel: 'Local or shipped',
    tags: ['samples', 'goods', 'product'],
    status: 'active',
    sortOrder: 110,
  },
  {
    key: 'starter-need-photo-backdrop-kit',
    kind: 'need',
    sourceType: 'hellowhen',
    title: 'Photo backdrop kit',
    description: 'Start from this when you need a simple backdrop, props, or styling materials for product photos.',
    itemType: 'goods',
    category: 'Photography',
    timing: 'This week',
    mode: 'local',
    locationLabel: 'Local pickup',
    tags: ['backdrop', 'photo', 'props'],
    status: 'active',
    sortOrder: 120,
  },
  {
    key: 'starter-need-local-pickup-help',
    kind: 'need',
    sourceType: 'hellowhen',
    title: 'Local pickup help',
    description: 'Use this when you need someone nearby to pick up a small item, package, or material.',
    itemType: 'other',
    category: 'Errand',
    timing: 'Flexible',
    mode: 'local',
    locationLabel: 'Local area',
    tags: ['local', 'pickup', 'errand'],
    status: 'active',
    sortOrder: 210,
  },
  {
    key: 'starter-need-event-table-setup',
    kind: 'need',
    sourceType: 'hellowhen',
    title: 'Event table setup',
    description: 'Start from this when you need help setting up a small table, booth, display, or local event corner.',
    itemType: 'other',
    category: 'Event',
    timing: 'Event day',
    mode: 'local',
    locationLabel: 'Local venue',
    tags: ['event', 'setup', 'local'],
    status: 'active',
    sortOrder: 220,
  },
  {
    key: 'starter-offer-ui-polish-review',
    kind: 'offer',
    sourceType: 'hellowhen',
    title: 'UI polish review',
    description: 'Use this when you can review a screen and give clear notes about layout, spacing, hierarchy, and visual polish.',
    itemType: 'service',
    category: 'Design',
    availability: 'This week',
    mode: 'remote',
    locationLabel: 'Remote',
    includes: ['UI notes', 'Spacing review', 'Priority fixes'],
    tags: ['ui', 'design', 'review'],
    status: 'active',
    sortOrder: 10,
  },
  {
    key: 'starter-offer-product-photography',
    kind: 'offer',
    sourceType: 'hellowhen',
    title: 'Product photography',
    description: 'Use this when you can shoot or improve clean product photos for a launch page, shop, or social post.',
    itemType: 'service',
    category: 'Photography',
    availability: 'Weekend',
    mode: 'hybrid',
    locationLabel: 'Local or remote brief',
    includes: ['Shot list', 'Edited photos'],
    tags: ['photo', 'product', 'content'],
    status: 'active',
    sortOrder: 20,
  },
  {
    key: 'starter-offer-brand-naming-feedback',
    kind: 'offer',
    sourceType: 'hellowhen',
    title: 'Brand naming feedback',
    description: 'Start from this when you can review name ideas and give concise feedback about clarity, tone, and positioning.',
    itemType: 'service',
    category: 'Branding',
    availability: 'This week',
    mode: 'remote',
    locationLabel: 'Remote',
    includes: ['Name review', 'Positioning notes'],
    tags: ['brand', 'naming', 'feedback'],
    status: 'active',
    sortOrder: 30,
  },
  {
    key: 'starter-offer-seo-quick-audit',
    kind: 'offer',
    sourceType: 'hellowhen',
    title: 'SEO quick audit',
    description: 'Use this when you can check page titles, descriptions, headings, or basic SEO issues for a small site.',
    itemType: 'service',
    category: 'Marketing',
    availability: 'Next few days',
    mode: 'remote',
    locationLabel: 'Remote',
    includes: ['SEO notes', 'Priority fixes'],
    tags: ['seo', 'marketing', 'audit'],
    status: 'active',
    sortOrder: 40,
  },
  {
    key: 'starter-offer-bug-reproduction-notes',
    kind: 'offer',
    sourceType: 'hellowhen',
    title: 'Bug reproduction notes',
    description: 'Use this when you can test a flow and write clear reproduction steps with device/browser details.',
    itemType: 'service',
    category: 'QA',
    availability: 'Today or tomorrow',
    mode: 'remote',
    locationLabel: 'Remote',
    includes: ['Reproduction steps', 'Screenshots if needed'],
    tags: ['qa', 'testing', 'bugs'],
    status: 'active',
    sortOrder: 50,
  },
  {
    key: 'starter-offer-profile-bio-rewrite',
    kind: 'offer',
    sourceType: 'hellowhen',
    title: 'Profile bio rewrite',
    description: 'Start from this when you can rewrite a short creator, freelancer, or business profile bio.',
    itemType: 'service',
    category: 'Writing',
    availability: 'This week',
    mode: 'remote',
    locationLabel: 'Remote',
    includes: ['Bio rewrite', 'One revision'],
    tags: ['bio', 'writing', 'profile'],
    status: 'active',
    sortOrder: 60,
  },
  {
    key: 'starter-offer-shipping-box-bundle',
    kind: 'offer',
    sourceType: 'hellowhen',
    title: 'Shipping box bundle',
    description: 'Use this when you can provide small shipping boxes, envelopes, or reusable packaging supplies.',
    itemType: 'goods',
    category: 'Packaging',
    availability: 'This week',
    mode: 'local',
    locationLabel: 'Local pickup',
    includes: ['Small boxes', 'Packing material'],
    tags: ['packaging', 'shipping', 'goods'],
    status: 'active',
    sortOrder: 110,
  },
  {
    key: 'starter-offer-display-stand-loan',
    kind: 'offer',
    sourceType: 'hellowhen',
    title: 'Display stand loan',
    description: 'Start from this when you can lend a simple stand, holder, or display object for photos or events.',
    itemType: 'goods',
    category: 'Display',
    availability: 'Flexible',
    mode: 'local',
    locationLabel: 'Local pickup',
    includes: ['Display stand', 'Return details'],
    tags: ['display', 'stand', 'goods'],
    status: 'active',
    sortOrder: 120,
  },
  {
    key: 'starter-offer-local-delivery-run',
    kind: 'offer',
    sourceType: 'hellowhen',
    title: 'Local delivery run',
    description: 'Use this when you can help with a small local delivery, pickup, or drop-off.',
    itemType: 'other',
    category: 'Errand',
    availability: 'Flexible',
    mode: 'local',
    locationLabel: 'Local area',
    includes: ['Pickup', 'Drop-off'],
    tags: ['delivery', 'local', 'errand'],
    status: 'active',
    sortOrder: 210,
  },
  {
    key: 'starter-offer-workspace-access',
    kind: 'offer',
    sourceType: 'hellowhen',
    title: 'Workspace access',
    description: 'Start from this when you can offer short access to a desk, quiet corner, studio, or small workspace.',
    itemType: 'other',
    category: 'Workspace',
    availability: 'By appointment',
    mode: 'local',
    locationLabel: 'Local workspace',
    includes: ['Workspace slot', 'Basic setup'],
    tags: ['workspace', 'local', 'studio'],
    status: 'active',
    sortOrder: 220,
  },
];

async function seedStarterInventoryTemplates() {
  for (const template of starterInventoryTemplates) {
    await upsertInventoryTemplate(template);
  }
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
  await seedStarterInventoryTemplates();

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


  const stressTradeFixtures = [
    {
      ownerId: demo.id,
      needTitle: 'Need editor for short product video',
      needDescription: 'I need a clean edit for a vertical product video with captions, light sound cleanup, and a punchy hook.',
      needType: 'service' as const,
      needCategory: 'Video',
      needTiming: 'This weekend',
      needMode: 'remote' as const,
      needLocation: 'Remote',
      needTags: ['video', 'editing', 'remote'],
      offerTitle: 'UI polish for web app',
      offerDescription: 'I can review a web app screen and send a clear UI polish checklist with spacing, hierarchy, and copy notes.',
      offerType: 'service' as const,
      offerCategory: 'Design',
      offerAvailability: 'Any time',
      offerMode: 'remote' as const,
      offerLocation: 'Remote',
      offerIncludes: ['UI notes', 'Spacing review', 'One screen'],
      offerTags: ['design', 'ui', 'web'],
    },
    {
      ownerId: demo.id,
      needTitle: 'Need homepage copy cleanup',
      needDescription: 'I need someone to tighten homepage copy and make the first section easier to understand.',
      needType: 'service' as const,
      needCategory: 'Copywriting',
      needTiming: 'Next 3 days',
      needMode: 'remote' as const,
      needLocation: 'Remote',
      needTags: ['copy', 'homepage'],
      offerTitle: 'Figma component tidy-up',
      offerDescription: 'I can organize a small Figma file, rename layers, and clean up a starter component set.',
      offerType: 'service' as const,
      offerCategory: 'Design',
      offerAvailability: 'Evenings',
      offerMode: 'remote' as const,
      offerLocation: 'Remote',
      offerIncludes: ['Layer cleanup', 'Component naming'],
      offerTags: ['figma', 'design'],
    },
    {
      ownerId: demo.id,
      needTitle: 'Need marketplace onboarding review',
      needDescription: 'I need feedback on a short onboarding flow for first-time marketplace users.',
      needType: 'service' as const,
      needCategory: 'Product',
      needTiming: 'This week',
      needMode: 'remote' as const,
      needLocation: 'Remote',
      needTags: ['product', 'ux'],
      offerTitle: 'Landing page hero mockup',
      offerDescription: 'I can create one quick landing page hero mockup with headline, CTA, and a simple layout direction.',
      offerType: 'service' as const,
      offerCategory: 'Design',
      offerAvailability: 'This week',
      offerMode: 'remote' as const,
      offerLocation: 'Remote',
      offerIncludes: ['Hero mockup', 'CTA direction'],
      offerTags: ['landing', 'mockup'],
    },
    {
      ownerId: demo.id,
      needTitle: 'Need product photo retouching',
      needDescription: 'I need five product photos cleaned up with background and light color correction.',
      needType: 'service' as const,
      needCategory: 'Photography',
      needTiming: '48 hours',
      needMode: 'remote' as const,
      needLocation: 'Remote',
      needTags: ['photo', 'retouch'],
      offerTitle: 'Short app store copy',
      offerDescription: 'I can write a short app store description and three concise feature bullets.',
      offerType: 'service' as const,
      offerCategory: 'Copywriting',
      offerAvailability: 'Tomorrow',
      offerMode: 'remote' as const,
      offerLocation: 'Remote',
      offerIncludes: ['App description', 'Feature bullets'],
      offerTags: ['copy', 'app'],
    },
    {
      ownerId: demo.id,
      needTitle: 'Need simple icon concepts',
      needDescription: 'I need three simple monochrome icon concept directions for a mobile tab bar.',
      needType: 'service' as const,
      needCategory: 'Icon design',
      needTiming: 'Flexible',
      needMode: 'remote' as const,
      needLocation: 'Remote',
      needTags: ['icons', 'mobile'],
      offerTitle: 'Bug reproduction notes',
      offerDescription: 'I can test a web page on mobile and desktop and write clean reproduction notes for visible bugs.',
      offerType: 'service' as const,
      offerCategory: 'QA',
      offerAvailability: 'Weekend',
      offerMode: 'remote' as const,
      offerLocation: 'Remote',
      offerIncludes: ['Bug notes', 'Screenshots'],
      offerTags: ['qa', 'testing'],
    },
    {
      ownerId: demo.id,
      needTitle: 'Need local pickup help',
      needDescription: 'I need someone nearby to pick up a small package and bring it to a local studio.',
      needType: 'other' as const,
      needCategory: 'Errand',
      needTiming: 'Friday',
      needMode: 'local' as const,
      needLocation: 'Paris area',
      needTags: ['local', 'pickup'],
      offerTitle: 'Product listing cleanup',
      offerDescription: 'I can clean up product listing text and make the title, bullets, and description easier to scan.',
      offerType: 'service' as const,
      offerCategory: 'Ecommerce',
      offerAvailability: 'This week',
      offerMode: 'remote' as const,
      offerLocation: 'Remote',
      offerIncludes: ['Title cleanup', 'Bullet rewrite'],
      offerTags: ['ecommerce', 'copy'],
    },
    {
      ownerId: demo.id,
      needTitle: 'Need beta tester for mobile web',
      needDescription: 'I need someone to test mobile web layout with multiple trades, long text, and form scrolling.',
      needType: 'service' as const,
      needCategory: 'Testing',
      needTiming: 'Today',
      needMode: 'remote' as const,
      needLocation: 'Remote',
      needTags: ['testing', 'mobile'],
      offerTitle: 'Profile bio rewrite',
      offerDescription: 'I can rewrite a short creator or freelancer profile bio with a clearer offer and tone.',
      offerType: 'service' as const,
      offerCategory: 'Writing',
      offerAvailability: 'Today',
      offerMode: 'remote' as const,
      offerLocation: 'Remote',
      offerIncludes: ['Bio rewrite', 'One revision'],
      offerTags: ['bio', 'writing'],
    },
    {
      ownerId: helper.id,
      needTitle: 'Need quick SEO title audit',
      needDescription: 'I need help checking page titles and descriptions for a small marketing site.',
      needType: 'service' as const,
      needCategory: 'Marketing',
      needTiming: 'Next week',
      needMode: 'remote' as const,
      needLocation: 'Remote',
      needTags: ['seo', 'marketing'],
      offerTitle: 'Video thumbnail feedback',
      offerDescription: 'I can review three video thumbnails and suggest better hierarchy and contrast.',
      offerType: 'service' as const,
      offerCategory: 'Video',
      offerAvailability: 'Evenings',
      offerMode: 'remote' as const,
      offerLocation: 'Remote',
      offerIncludes: ['Thumbnail review', 'Contrast notes'],
      offerTags: ['video', 'thumbnail'],
    },
    {
      ownerId: helper.id,
      needTitle: 'Need product sample styling',
      needDescription: 'I need styling ideas for a small product sample pack before taking photos.',
      needType: 'goods' as const,
      needCategory: 'Goods',
      needTiming: 'This month',
      needMode: 'hybrid' as const,
      needLocation: 'Local or remote',
      needTags: ['goods', 'styling'],
      offerTitle: 'Remote usability notes',
      offerDescription: 'I can give usability notes for one mobile flow with screenshots and priority fixes.',
      offerType: 'service' as const,
      offerCategory: 'UX',
      offerAvailability: 'This week',
      offerMode: 'remote' as const,
      offerLocation: 'Remote',
      offerIncludes: ['UX notes', 'Priority fixes'],
      offerTags: ['ux', 'mobile'],
    },
    {
      ownerId: helper.id,
      needTitle: 'Need intro email polish',
      needDescription: 'I need a concise intro email polished so it feels friendly and clear.',
      needType: 'service' as const,
      needCategory: 'Email',
      needTiming: 'Tomorrow',
      needMode: 'remote' as const,
      needLocation: 'Remote',
      needTags: ['email', 'copy'],
      offerTitle: 'Small logo direction notes',
      offerDescription: 'I can give notes on simple logo directions and help choose the cleanest option.',
      offerType: 'service' as const,
      offerCategory: 'Branding',
      offerAvailability: 'Tomorrow',
      offerMode: 'remote' as const,
      offerLocation: 'Remote',
      offerIncludes: ['Logo notes', 'Direction choice'],
      offerTags: ['logo', 'brand'],
    },
  ];

  for (const [index, fixture] of stressTradeFixtures.entries()) {
    const need = await upsertNeed(fixture.ownerId, fixture.needTitle, {
      description: fixture.needDescription,
      itemType: fixture.needType,
      category: fixture.needCategory,
      timing: fixture.needTiming,
      mode: fixture.needMode,
      locationLabel: fixture.needLocation,
      tags: fixture.needTags,
      status: 'active',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * (6 + index)),
    });
    const offer = await upsertOffer(fixture.ownerId, fixture.offerTitle, {
      description: fixture.offerDescription,
      itemType: fixture.offerType,
      category: fixture.offerCategory,
      availability: fixture.offerAvailability,
      mode: fixture.offerMode,
      locationLabel: fixture.offerLocation,
      includes: fixture.offerIncludes,
      tags: fixture.offerTags,
      status: 'active',
    });
    await upsertTrade(fixture.ownerId, `${fixture.needTitle} ↔ ${fixture.offerTitle}`, {
      needId: need.id,
      offerId: offer.id,
      description: `${fixture.needDescription} In exchange, ${fixture.offerDescription.toLowerCase()}`,
      status: 'active',
      isPublic: true,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * (6 + index)),
    });
  }

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

  console.log('Seeded beta-safe demo accounts, starter Need/Offer templates, expanded inventory, stress-test trades, proposal flow, and support ticket flow.');
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
