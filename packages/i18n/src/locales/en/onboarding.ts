export const onboarding = {
  ariaLabel: 'Hellowhen onboarding guide',
  progress: '{{current}} / {{total}}',
  actions: {
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    getStarted: 'Get started',
  },
  guides: {
    global: {
      title: 'Hellowhen Guide',
      summary: 'A quick overview of Trade, Plans, Me, and safety.',
    },
    trade: {
      title: 'Trade Guide',
      summary: 'Learn how Needs, Offers, trade cards, and proposals work.',
    },
    plans: {
      title: 'Plan Guide',
      summary: 'Learn how Plans, places, joining, creating, and safety work.',
    },
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
      es: 'Español',
    },
    appearanceOptions: {
      system: 'System',
      light: 'Light',
      dark: 'Dark',
    },
  },
  slides: {
    globalWelcome: {
      title: 'Welcome to Hellowhen',
      body: 'Hellowhen helps people connect around clear needs, offers, plans, and safe conversations.',
      caption: 'Start with the big picture, then explore each area when you need it.',
    },
    globalWorlds: {
      title: 'Trade, Plans, and Me',
      body: 'Use Trade for one exchange, Plans for bigger goals or routes, and Me for your activity, tools, and profile.',
      caption: 'Three main areas keep the app simple.',
    },
    globalMeHub: {
      title: 'Your activity lives in Me',
      body: 'Find your trades, proposals, plans, saved items, Agenda, notifications, settings, and support from Me.',
      caption: 'Me is your personal hub.',
    },
    globalSafety: {
      title: 'Keep agreements clear',
      body: 'Use the app to keep important details visible, avoid sensitive information, and report anything suspicious.',
      caption: 'Safety guidance appears again inside each feature guide.',
    },
    welcome: {
      title: 'Welcome to Trade',
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
    plansWelcome: {
      title: 'Welcome to Plans',
      body: 'A Plan is a bigger goal or route that can include places, people, needs, offers, and later discussions.',
      caption: 'Plans give context around a bigger activity.',
    },
    plansDiscover: {
      title: 'Discover public Plans',
      body: 'Browse Plans to understand what someone wants to do, where it happens, and how you might join or help.',
      caption: 'Plans are goal-based, not only one exchange card.',
    },
    plansPlaces: {
      title: 'Places inside Plans',
      body: 'Plans can include offline addresses and online places, so users can understand the route or activity clearly.',
      caption: 'Places help make a Plan concrete.',
    },
    plansCreateJoin: {
      title: 'Create or join',
      body: 'Create your own Plan, save useful places, or join a public Plan when you are interested.',
      caption: 'Plans can grow from one idea into many useful steps.',
    },
    plansSafety: {
      title: 'Plan safely',
      body: 'Check location details, keep public information appropriate, and report anything that looks suspicious.',
      caption: 'Plan safety is especially important around places and meetups.',
    },
  },
} as const;
