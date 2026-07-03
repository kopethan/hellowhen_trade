export const onboarding = {
  ariaLabel: 'Guide de démarrage Hellowhen',
  progress: '{{current}} / {{total}}',
  actions: {
    skip: 'Passer',
    back: 'Retour',
    next: 'Suivant',
    getStarted: 'Commencer',
  },
  guides: {
    global: {
      title: 'Guide Hellowhen',
      summary: 'Un aperçu rapide des échanges, des plans, de Me et de la sécurité.',
    },
    trade: {
      title: 'Guide Trade',
      summary: 'Comprendre les besoins, les offres, les cartes d’échange et les propositions.',
    },
    plans: {
      title: 'Guide Plans',
      summary: 'Comprendre les plans, les lieux, l’inscription, la création et la sécurité.',
    },
  },
  preferences: {
    title: 'Préférences',
    body: 'Choisissez la langue et l’apparence avant de continuer.',
    summary: '{{language}} · {{appearance}}',
    openAccessibilityLabel: 'Changer la langue et l’apparence du guide',
    languageTitle: 'Langue',
    appearanceTitle: 'Apparence',
    done: 'Terminé',
    languageOptions: {
      system: 'Langue du système',
      en: 'English',
      fr: 'Français',
      es: 'Español',
    },
    appearanceOptions: {
      system: 'Système',
      light: 'Clair',
      dark: 'Sombre',
    },
  },
  slides: {
    globalWelcome: {
      title: 'Bienvenue sur Hellowhen',
      body: 'Hellowhen aide les personnes à se connecter autour de besoins, d’offres, de plans et de conversations plus sûres.',
      caption: 'Commencez par la vision globale, puis explorez chaque espace quand vous en avez besoin.',
    },
    globalWorlds: {
      title: 'Trade, Plans et Me',
      body: 'Utilisez Trade pour un échange, Plans pour des objectifs ou trajets plus grands, et Me pour votre activité, vos outils et votre profil.',
      caption: 'Trois espaces principaux gardent l’app simple.',
    },
    globalMeHub: {
      title: 'Votre activité vit dans Me',
      body: 'Retrouvez vos échanges, propositions, plans, éléments enregistrés, Agenda, notifications, paramètres et assistance dans Me.',
      caption: 'Me est votre hub personnel.',
    },
    globalSafety: {
      title: 'Gardez les accords clairs',
      body: 'Utilisez l’app pour conserver les détails importants, éviter les informations sensibles et signaler tout comportement suspect.',
      caption: 'Les conseils de sécurité reviennent dans chaque guide de fonctionnalité.',
    },
    welcome: {
      title: 'Bienvenue dans Trade',
      body: 'Publiez ce dont vous avez besoin et ce que vous pouvez offrir, puis échangez autour de propositions claires.',
      caption: 'Un besoin + une offre peuvent devenir un échange.',
    },
    createNeed: {
      title: 'Créer un besoin',
      body: 'Ajoutez un titre, des détails utiles, une catégorie et des images optionnelles pour expliquer votre besoin.',
      caption: 'Un besoin clair aide les autres à vous comprendre.',
    },
    createOffer: {
      title: 'Créer une offre',
      body: 'Présentez ce que vous pouvez donner en retour : aide pratique, travail créatif ou objet utile.',
      caption: 'Les offres peuvent être des services, des objets ou de l’aide.',
    },
    discoverTrades: {
      title: 'Découvrir les échanges',
      body: 'Explorez le fil des échanges, ouvrez les cartes qui vous intéressent et trouvez des correspondances possibles.',
      caption: 'Parcourez les cartes d’échange une par une.',
    },
    sendProposal: {
      title: 'Envoyer une proposition',
      body: 'Choisissez ce que vous pouvez offrir ou demander, puis envoyez un message privé pour lancer la conversation.',
      caption: 'Les propositions restent privées entre les deux utilisateurs.',
    },
    staySafe: {
      title: 'Rester en sécurité',
      body: 'Mettez-vous d’accord clairement, évitez les informations sensibles et signalez tout comportement suspect.',
      caption: 'Gardez les détails importants de l’accord dans l’app.',
    },
    accountGuide: {
      title: 'Compte et guide',
      body: 'Gérez votre profil, vos paramètres, l’assistance et le guide depuis l’espace Compte.',
      caption: 'Vous pouvez revoir ce guide plus tard depuis Compte.',
    },
    plansWelcome: {
      title: 'Bienvenue dans Plans',
      body: 'Un Plan est un objectif ou un trajet plus grand qui peut inclure des lieux, des personnes, des besoins, des offres et plus tard des discussions.',
      caption: 'Les Plans donnent du contexte autour d’une activité plus grande.',
    },
    plansDiscover: {
      title: 'Découvrir les Plans publics',
      body: 'Parcourez les Plans pour comprendre ce qu’une personne veut faire, où cela se passe et comment vous pouvez rejoindre ou aider.',
      caption: 'Les Plans sont centrés sur un objectif, pas seulement sur une carte d’échange.',
    },
    plansPlaces: {
      title: 'Les lieux dans les Plans',
      body: 'Les Plans peuvent inclure des adresses hors ligne et des lieux en ligne pour rendre le trajet ou l’activité plus clair.',
      caption: 'Les lieux rendent un Plan plus concret.',
    },
    plansCreateJoin: {
      title: 'Créer ou rejoindre',
      body: 'Créez votre propre Plan, enregistrez des lieux utiles ou rejoignez un Plan public quand il vous intéresse.',
      caption: 'Un Plan peut partir d’une idée et devenir plusieurs étapes utiles.',
    },
    plansSafety: {
      title: 'Utiliser Plans en sécurité',
      body: 'Vérifiez les détails des lieux, gardez les informations publiques appropriées et signalez tout comportement suspect.',
      caption: 'La sécurité des Plans est importante autour des lieux et des rencontres.',
    },
  },
} as const;
