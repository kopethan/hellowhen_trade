export const onboarding = {
  ariaLabel: 'Guide de démarrage Hellowhen',
  progress: '{{current}} / {{total}}',
  actions: {
    skip: 'Passer',
    back: 'Retour',
    next: 'Suivant',
    getStarted: 'Commencer',
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
    },
    appearanceOptions: {
      system: 'Système',
      light: 'Clair',
      dark: 'Sombre',
    },
  },
  slides: {
    welcome: {
      title: 'Bienvenue sur Hellowhen',
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
  },
} as const;
