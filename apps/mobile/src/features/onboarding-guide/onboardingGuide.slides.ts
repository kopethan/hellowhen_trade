export type OnboardingGuideSlideKey =
  | 'welcome'
  | 'createNeed'
  | 'createOffer'
  | 'discoverTrades'
  | 'sendProposal'
  | 'staySafe'
  | 'accountGuide';

export type OnboardingGuideSlide = {
  id: string;
  illustrationKey: OnboardingGuideSlideKey;
  title: string;
  body: string;
  illustrationCaption: string;
};

export const ONBOARDING_GUIDE_SLIDES: OnboardingGuideSlide[] = [
  {
    id: 'welcome-trade-match',
    illustrationKey: 'welcome',
    title: 'Welcome to Hellowhen',
    body: 'Post what you need and what you can offer, then connect around clear trades.',
    illustrationCaption: 'Need + Offer can become a trade.',
  },
  {
    id: 'create-need',
    illustrationKey: 'createNeed',
    title: 'Create a Need',
    body: 'Add a title, useful details, a category, and optional images so people know what you need.',
    illustrationCaption: 'A clear Need helps others understand you.',
  },
  {
    id: 'create-offer',
    illustrationKey: 'createOffer',
    title: 'Create an Offer',
    body: 'Share what you can give back, from practical help to creative work or useful items.',
    illustrationCaption: 'Offers can be services, items, or help.',
  },
  {
    id: 'discover-trades',
    illustrationKey: 'discoverTrades',
    title: 'Discover Trades',
    body: 'Explore the Trades feed, open cards that interest you, and find possible matches.',
    illustrationCaption: 'Browse trade cards one by one.',
  },
  {
    id: 'send-proposal',
    illustrationKey: 'sendProposal',
    title: 'Send a Proposal',
    body: 'Choose what you can offer or need, then send a private message to start the conversation.',
    illustrationCaption: 'Proposals are private between both users.',
  },
  {
    id: 'stay-safe',
    illustrationKey: 'staySafe',
    title: 'Stay Safe',
    body: 'Agree clearly, avoid sensitive information, and report problems if something feels wrong.',
    illustrationCaption: 'Keep important agreement details inside the app.',
  },
  {
    id: 'account-guide',
    illustrationKey: 'accountGuide',
    title: 'Account & Guide',
    body: 'Manage your profile, settings, support, and user guide from the Account area.',
    illustrationCaption: 'You can replay this guide later from Account.',
  },
];
