export const onboarding = {
  ariaLabel: 'Hellowhen onboarding guide',
  progress: '{{current}} / {{total}}',
  actions: {
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    getStarted: 'Get started',
  },
  preferences: {
    title: 'Preferences',
    body: 'Choose the language and appearance before you continue.',
    summary: '{{language}} · {{appearance}}',
    openAccessibilityLabel: 'Change onboarding language and appearance',
    languageTitle: 'Language',
    appearanceTitle: 'Appearance',
    done: 'Done',
    languageOptions: {
      system: 'System language',
      en: 'English',
      fr: 'Français',
    },
    appearanceOptions: {
      system: 'System',
      light: 'Light',
      dark: 'Dark',
    },
  },
  slides: {
    welcome: {
      title: 'Welcome to Hellowhen',
      body: 'Post what you need and what you can offer, then connect around clear trades.',
      caption: 'Need + Offer can become a trade.',
    },
    createNeed: {
      title: 'Create a Need',
      body: 'Add a title, useful details, a category, and optional images so people know what you need.',
      caption: 'A clear Need helps others understand you.',
    },
    createOffer: {
      title: 'Create an Offer',
      body: 'Share what you can give back, from practical help to creative work or useful items.',
      caption: 'Offers can be services, items, or help.',
    },
    discoverTrades: {
      title: 'Discover Trades',
      body: 'Explore the Trades feed, open cards that interest you, and find possible matches.',
      caption: 'Browse trade cards one by one.',
    },
    sendProposal: {
      title: 'Send a Proposal',
      body: 'Choose what you can offer or need, then send a private message to start the conversation.',
      caption: 'Proposals are private between both users.',
    },
    staySafe: {
      title: 'Stay Safe',
      body: 'Agree clearly, avoid sensitive information, and report problems if something feels wrong.',
      caption: 'Keep important agreement details inside the app.',
    },
    accountGuide: {
      title: 'Account & Guide',
      body: 'Manage your profile, settings, support, and user guide from the Account area.',
      caption: 'You can replay this guide later from Account.',
    },
  },
} as const;
