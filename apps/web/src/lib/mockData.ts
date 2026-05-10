import type { MediaAssetDto, NeedDto, OfferDto, TradeDto } from '@hellowhen/contracts';

const now = '2026-05-09T12:00:00.000Z';
const inThreeDays = '2026-05-12T23:59:59.000Z';
const inSixDays = '2026-05-15T23:59:59.000Z';

function demoImage(id: string, ownerId: string, entityType: 'need' | 'offer', entityId: string, label: string, tone: string): MediaAssetDto {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${tone}"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs><rect width="900" height="900" fill="url(#g)"/><circle cx="710" cy="180" r="130" fill="rgba(255,255,255,.16)"/><circle cx="160" cy="730" r="210" fill="rgba(255,255,255,.10)"/><text x="72" y="450" fill="white" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="800" letter-spacing="-2">${label}</text></svg>`;
  return {
    id,
    ownerId,
    entityType,
    entityId,
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    storageKey: `demo/${id}.svg`,
    filename: `${id}.svg`,
    mimeType: 'image/svg+xml',
    sizeBytes: svg.length,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

export const mockNeeds: NeedDto[] = [
  {
    id: 'demo-need-1',
    ownerId: 'demo-user-1',
    title: 'Landing page design',
    description: 'I need a clean landing page for a small product launch with hero copy, sections, and a simple CTA.',
    itemType: 'service',
    category: 'Design',
    timing: 'This week',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['design', 'launch'],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    expiresAt: inThreeDays,
    media: [],
  },
  {
    id: 'demo-need-2',
    ownerId: 'demo-user-2',
    title: 'Short launch video edit',
    description: 'Looking for someone to polish a 45-second launch video and export it for mobile and social.',
    itemType: 'service',
    category: 'Video',
    timing: '24–48 hours',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['video', 'launch'],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    expiresAt: inSixDays,
    media: [],
  },
  {
    id: 'demo-need-3',
    ownerId: 'demo-user-3',
    title: 'Email launch copy',
    description: 'I need three concise emails for a small product launch: announcement, reminder, and last call.',
    itemType: 'service',
    category: 'Copywriting',
    timing: 'Next week',
    mode: 'remote',
    locationLabel: 'Remote',
    tags: ['copy', 'email'],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    media: [],
  },
];

export const mockOffers: OfferDto[] = [
  {
    id: 'demo-offer-1',
    ownerId: 'demo-user-1',
    title: 'Product photography',
    description: 'I can shoot and edit a clean set of ecommerce-style product photos for your website or social launch.',
    itemType: 'service',
    category: 'Photography',
    availability: 'Weekend',
    mode: 'local',
    locationLabel: 'Local',
    includes: ['10 edited shots', 'One revision'],
    tags: ['photos', 'ecommerce'],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    media: [],
  },
  {
    id: 'demo-offer-3',
    ownerId: 'demo-user-3',
    title: 'SEO audit',
    description: 'I can review one site and send a prioritized SEO checklist with technical and content quick wins.',
    itemType: 'service',
    category: 'Marketing',
    availability: 'This month',
    mode: 'remote',
    locationLabel: 'Remote',
    includes: ['One site review', 'Priority checklist'],
    tags: ['seo', 'audit'],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    media: [],
  },
];

const needLandingMedia = [demoImage('demo-media-need-landing-1', 'demo-user-1', 'need', 'demo-need-1', 'Landing page', '#2563eb')];
const offerPhotoMedia = [
  demoImage('demo-media-offer-photo-1', 'demo-user-1', 'offer', 'demo-offer-1', 'Product photo', '#16a34a'),
  demoImage('demo-media-offer-photo-2', 'demo-user-1', 'offer', 'demo-offer-1', 'Clean shots', '#0f766e'),
];
const needVideoMedia = [demoImage('demo-media-need-video-1', 'demo-user-2', 'need', 'demo-need-2', 'Launch video', '#7c3aed')];
const needCopyMedia = [demoImage('demo-media-need-copy-1', 'demo-user-3', 'need', 'demo-need-3', 'Email copy', '#ea580c')];
const offerAuditMedia = [demoImage('demo-media-offer-audit-1', 'demo-user-3', 'offer', 'demo-offer-3', 'SEO audit', '#0891b2')];

mockNeeds[0]!.media = needLandingMedia;
mockNeeds[1]!.media = needVideoMedia;
mockNeeds[2]!.media = needCopyMedia;
mockOffers[0]!.media = offerPhotoMedia;
mockOffers[1]!.media = offerAuditMedia;

export const mockTrades: TradeDto[] = [
  {
    id: 'demo-trade-1',
    ownerId: 'demo-user-1',
    title: 'Landing page design ↔ Product photography',
    description: 'A Need + Offer exchange: I need a clean landing page design and I offer product photography for launch assets.',
    creditAmount: 0,
    amountCents: 0,
    currency: 'eur',
    status: 'active',
    isPublic: true,
    createdAt: now,
    updatedAt: now,
    expiresAt: inThreeDays,
    owner: { id: 'demo-user-1', profile: { displayName: 'Mina', handle: 'mina', avatarUrl: null } },
    need: {
      id: 'demo-need-1',
      ownerId: 'demo-user-1',
      title: 'Landing page design',
      description: 'I need a clean landing page for a small product launch with hero copy, sections, and a simple CTA.',
      itemType: 'service',
      category: 'Design',
      timing: 'This week',
      mode: 'remote',
      locationLabel: 'Remote',
      tags: ['design', 'launch'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt: inThreeDays,
      media: needLandingMedia,
    },
    offer: {
      id: 'demo-offer-1',
      ownerId: 'demo-user-1',
      title: 'Product photography',
      description: 'I can shoot and edit a clean set of ecommerce-style product photos for your website or social launch.',
      itemType: 'service',
      category: 'Photography',
      availability: 'Weekend',
      mode: 'local',
      locationLabel: 'Local',
      includes: ['10 edited shots', 'One revision'],
      tags: ['photos', 'ecommerce'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
      media: offerPhotoMedia,
    },
  },
  {
    id: 'demo-trade-2',
    ownerId: 'demo-user-2',
    title: 'Short launch video edit ↔ Product samples',
    description: 'I need help polishing a short launch video and I offer product samples for content testing.',
    creditAmount: 0,
    amountCents: 0,
    currency: 'eur',
    status: 'active',
    isPublic: true,
    createdAt: now,
    updatedAt: now,
    expiresAt: inSixDays,
    owner: { id: 'demo-user-2', profile: { displayName: 'Noah', handle: 'noah', avatarUrl: null } },
    need: {
      id: 'demo-need-2',
      ownerId: 'demo-user-2',
      title: 'Short launch video edit',
      description: 'Looking for someone to polish a 45-second launch video and export it for mobile and social.',
      itemType: 'service',
      category: 'Video',
      timing: '24–48 hours',
      mode: 'remote',
      locationLabel: 'Remote',
      tags: ['video', 'launch'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt: inSixDays,
      media: needVideoMedia,
    },
    offer: {
      id: 'demo-offer-2',
      ownerId: 'demo-user-2',
      title: 'Product samples',
      description: 'I can send small product samples for content testing or styling reference.',
      itemType: 'goods',
      category: 'Goods',
      availability: 'This week',
      mode: 'local',
      locationLabel: 'Local pickup',
      includes: ['Sample pack', 'Pickup details after acceptance'],
      tags: ['samples', 'goods'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
      media: [],
    },
  },
  {
    id: 'demo-trade-3',
    ownerId: 'demo-user-3',
    title: 'Email launch copy ↔ SEO audit',
    description: 'I need a short launch email sequence. I can offer a focused SEO audit with quick wins and a simple action list.',
    creditAmount: 0,
    amountCents: 0,
    currency: 'eur',
    status: 'active',
    isPublic: true,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    owner: { id: 'demo-user-3', profile: { displayName: 'Sara', handle: 'sara', avatarUrl: null } },
    need: {
      id: 'demo-need-3',
      ownerId: 'demo-user-3',
      title: 'Email launch copy',
      description: 'I need three concise emails for a small product launch: announcement, reminder, and last call.',
      itemType: 'service',
      category: 'Copywriting',
      timing: 'Next week',
      mode: 'remote',
      locationLabel: 'Remote',
      tags: ['copy', 'email'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
      media: needCopyMedia,
    },
    offer: {
      id: 'demo-offer-3',
      ownerId: 'demo-user-3',
      title: 'SEO audit',
      description: 'I can review one site and send a prioritized SEO checklist with technical and content quick wins.',
      itemType: 'service',
      category: 'Marketing',
      availability: 'This month',
      mode: 'remote',
      locationLabel: 'Remote',
      includes: ['One site review', 'Priority checklist'],
      tags: ['seo', 'audit'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
      media: offerAuditMedia,
    },
  },
];

type StressMockFixture = {
  ownerId: string;
  ownerName: string;
  ownerHandle: string;
  needTitle: string;
  needDescription: string;
  needCategory: string;
  needTiming: string;
  needMode: NonNullable<NeedDto['mode']>;
  needLocation: string;
  needTags: string[];
  offerTitle: string;
  offerDescription: string;
  offerCategory: string;
  offerAvailability: string;
  offerMode: NonNullable<OfferDto['mode']>;
  offerLocation: string;
  offerIncludes: string[];
  offerTags: string[];
  needTone: string;
  offerTone: string;
};

const stressMockFixtures: StressMockFixture[] = [
  {
    ownerId: 'demo-user-1', ownerName: 'Mina', ownerHandle: 'mina',
    needTitle: 'Need editor for short product video', needDescription: 'I need a clean edit for a vertical product video with captions, light sound cleanup, and a punchy hook.', needCategory: 'Video', needTiming: 'This weekend', needMode: 'remote', needLocation: 'Remote', needTags: ['video', 'editing', 'remote'], needTone: '#7c3aed',
    offerTitle: 'UI polish for web app', offerDescription: 'I can review a web app screen and send a clear UI polish checklist with spacing, hierarchy, and copy notes.', offerCategory: 'Design', offerAvailability: 'Any time', offerMode: 'remote', offerLocation: 'Remote', offerIncludes: ['UI notes', 'Spacing review', 'One screen'], offerTags: ['design', 'ui', 'web'], offerTone: '#0f766e',
  },
  {
    ownerId: 'demo-user-1', ownerName: 'Mina', ownerHandle: 'mina',
    needTitle: 'Need homepage copy cleanup', needDescription: 'I need someone to tighten homepage copy and make the first section easier to understand.', needCategory: 'Copywriting', needTiming: 'Next 3 days', needMode: 'remote', needLocation: 'Remote', needTags: ['copy', 'homepage'], needTone: '#ea580c',
    offerTitle: 'Figma component tidy-up', offerDescription: 'I can organize a small Figma file, rename layers, and clean up a starter component set.', offerCategory: 'Design', offerAvailability: 'Evenings', offerMode: 'remote', offerLocation: 'Remote', offerIncludes: ['Layer cleanup', 'Component naming'], offerTags: ['figma', 'design'], offerTone: '#2563eb',
  },
  {
    ownerId: 'demo-user-1', ownerName: 'Mina', ownerHandle: 'mina',
    needTitle: 'Need marketplace onboarding review', needDescription: 'I need feedback on a short onboarding flow for first-time marketplace users.', needCategory: 'Product', needTiming: 'This week', needMode: 'remote', needLocation: 'Remote', needTags: ['product', 'ux'], needTone: '#0891b2',
    offerTitle: 'Landing page hero mockup', offerDescription: 'I can create one quick landing page hero mockup with headline, CTA, and a simple layout direction.', offerCategory: 'Design', offerAvailability: 'This week', offerMode: 'remote', offerLocation: 'Remote', offerIncludes: ['Hero mockup', 'CTA direction'], offerTags: ['landing', 'mockup'], offerTone: '#16a34a',
  },
  {
    ownerId: 'demo-user-1', ownerName: 'Mina', ownerHandle: 'mina',
    needTitle: 'Need product photo retouching', needDescription: 'I need five product photos cleaned up with background and light color correction.', needCategory: 'Photography', needTiming: '48 hours', needMode: 'remote', needLocation: 'Remote', needTags: ['photo', 'retouch'], needTone: '#db2777',
    offerTitle: 'Short app store copy', offerDescription: 'I can write a short app store description and three concise feature bullets.', offerCategory: 'Copywriting', offerAvailability: 'Tomorrow', offerMode: 'remote', offerLocation: 'Remote', offerIncludes: ['App description', 'Feature bullets'], offerTags: ['copy', 'app'], offerTone: '#9333ea',
  },
  {
    ownerId: 'demo-user-1', ownerName: 'Mina', ownerHandle: 'mina',
    needTitle: 'Need simple icon concepts', needDescription: 'I need three simple monochrome icon concept directions for a mobile tab bar.', needCategory: 'Icon design', needTiming: 'Flexible', needMode: 'remote', needLocation: 'Remote', needTags: ['icons', 'mobile'], needTone: '#334155',
    offerTitle: 'Bug reproduction notes', offerDescription: 'I can test a web page on mobile and desktop and write clean reproduction notes for visible bugs.', offerCategory: 'QA', offerAvailability: 'Weekend', offerMode: 'remote', offerLocation: 'Remote', offerIncludes: ['Bug notes', 'Screenshots'], offerTags: ['qa', 'testing'], offerTone: '#dc2626',
  },
  {
    ownerId: 'demo-user-1', ownerName: 'Mina', ownerHandle: 'mina',
    needTitle: 'Need local pickup help', needDescription: 'I need someone nearby to pick up a small package and bring it to a local studio.', needCategory: 'Errand', needTiming: 'Friday', needMode: 'local', needLocation: 'Paris area', needTags: ['local', 'pickup'], needTone: '#ca8a04',
    offerTitle: 'Product listing cleanup', offerDescription: 'I can clean up product listing text and make the title, bullets, and description easier to scan.', offerCategory: 'Ecommerce', offerAvailability: 'This week', offerMode: 'remote', offerLocation: 'Remote', offerIncludes: ['Title cleanup', 'Bullet rewrite'], offerTags: ['ecommerce', 'copy'], offerTone: '#15803d',
  },
  {
    ownerId: 'demo-user-1', ownerName: 'Mina', ownerHandle: 'mina',
    needTitle: 'Need beta tester for mobile web', needDescription: 'I need someone to test mobile web layout with multiple trades, long text, and form scrolling.', needCategory: 'Testing', needTiming: 'Today', needMode: 'remote', needLocation: 'Remote', needTags: ['testing', 'mobile'], needTone: '#0284c7',
    offerTitle: 'Profile bio rewrite', offerDescription: 'I can rewrite a short creator or freelancer profile bio with a clearer offer and tone.', offerCategory: 'Writing', offerAvailability: 'Today', offerMode: 'remote', offerLocation: 'Remote', offerIncludes: ['Bio rewrite', 'One revision'], offerTags: ['bio', 'writing'], offerTone: '#be123c',
  },
  {
    ownerId: 'demo-user-2', ownerName: 'Noah', ownerHandle: 'noah',
    needTitle: 'Need quick SEO title audit', needDescription: 'I need help checking page titles and descriptions for a small marketing site.', needCategory: 'Marketing', needTiming: 'Next week', needMode: 'remote', needLocation: 'Remote', needTags: ['seo', 'marketing'], needTone: '#0891b2',
    offerTitle: 'Video thumbnail feedback', offerDescription: 'I can review three video thumbnails and suggest better hierarchy and contrast.', offerCategory: 'Video', offerAvailability: 'Evenings', offerMode: 'remote', offerLocation: 'Remote', offerIncludes: ['Thumbnail review', 'Contrast notes'], offerTags: ['video', 'thumbnail'], offerTone: '#7c3aed',
  },
  {
    ownerId: 'demo-user-2', ownerName: 'Noah', ownerHandle: 'noah',
    needTitle: 'Need product sample styling', needDescription: 'I need styling ideas for a small product sample pack before taking photos.', needCategory: 'Goods', needTiming: 'This month', needMode: 'hybrid', needLocation: 'Local or remote', needTags: ['goods', 'styling'], needTone: '#0f766e',
    offerTitle: 'Remote usability notes', offerDescription: 'I can give usability notes for one mobile flow with screenshots and priority fixes.', offerCategory: 'UX', offerAvailability: 'This week', offerMode: 'remote', offerLocation: 'Remote', offerIncludes: ['UX notes', 'Priority fixes'], offerTags: ['ux', 'mobile'], offerTone: '#2563eb',
  },
  {
    ownerId: 'demo-user-2', ownerName: 'Noah', ownerHandle: 'noah',
    needTitle: 'Need intro email polish', needDescription: 'I need a concise intro email polished so it feels friendly and clear.', needCategory: 'Email', needTiming: 'Tomorrow', needMode: 'remote', needLocation: 'Remote', needTags: ['email', 'copy'], needTone: '#ea580c',
    offerTitle: 'Small logo direction notes', offerDescription: 'I can give notes on simple logo directions and help choose the cleanest option.', offerCategory: 'Branding', offerAvailability: 'Tomorrow', offerMode: 'remote', offerLocation: 'Remote', offerIncludes: ['Logo notes', 'Direction choice'], offerTags: ['logo', 'brand'], offerTone: '#334155',
  },
];

for (const [index, fixture] of stressMockFixtures.entries()) {
  const number = index + 1;
  const createdAt = new Date(Date.parse(now) + number * 60_000).toISOString();
  const expiresAt = new Date(Date.parse(now) + (number + 5) * 24 * 60 * 60 * 1000).toISOString();
  const needId = `demo-need-stress-${number}`;
  const offerId = `demo-offer-stress-${number}`;
  const needMedia = [demoImage(`demo-media-need-stress-${number}`, fixture.ownerId, 'need', needId, fixture.needTitle.replace(/^Need\s+/i, '').slice(0, 20), fixture.needTone)];
  const offerMedia = [demoImage(`demo-media-offer-stress-${number}`, fixture.ownerId, 'offer', offerId, fixture.offerTitle.replace(/^Offer\s+/i, '').slice(0, 20), fixture.offerTone)];
  const need: NeedDto = {
    id: needId,
    ownerId: fixture.ownerId,
    title: fixture.needTitle,
    description: fixture.needDescription,
    itemType: fixture.needCategory === 'Goods' ? 'goods' : fixture.needCategory === 'Errand' ? 'other' : 'service',
    category: fixture.needCategory,
    timing: fixture.needTiming,
    mode: fixture.needMode,
    locationLabel: fixture.needLocation,
    tags: fixture.needTags,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    expiresAt,
    media: needMedia,
  };
  const offer: OfferDto = {
    id: offerId,
    ownerId: fixture.ownerId,
    title: fixture.offerTitle,
    description: fixture.offerDescription,
    itemType: 'service',
    category: fixture.offerCategory,
    availability: fixture.offerAvailability,
    mode: fixture.offerMode,
    locationLabel: fixture.offerLocation,
    includes: fixture.offerIncludes,
    tags: fixture.offerTags,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    expiresAt: null,
    media: offerMedia,
  };

  mockNeeds.push(need);
  mockOffers.push(offer);
  mockTrades.push({
    id: `demo-trade-stress-${number}`,
    ownerId: fixture.ownerId,
    title: `${fixture.needTitle} ↔ ${fixture.offerTitle}`,
    description: `${fixture.needDescription} In exchange, ${fixture.offerDescription.toLowerCase()}`,
    creditAmount: 0,
    amountCents: 0,
    currency: 'eur',
    status: 'active',
    isPublic: true,
    createdAt,
    updatedAt: createdAt,
    expiresAt,
    owner: { id: fixture.ownerId, profile: { displayName: fixture.ownerName, handle: fixture.ownerHandle, avatarUrl: null } },
    need,
    offer,
  });
}
