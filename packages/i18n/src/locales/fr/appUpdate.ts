export const appUpdate = {
  optional: {
    title: 'Nouvelle mise à jour disponible',
    body: 'Une nouvelle version de Hellowhen est disponible avec des correctifs et des améliorations.',
  },
  mandatory: {
    title: 'Mise à jour requise',
    body: "Cette version de Hellowhen n'est plus prise en charge. Mettez à jour l'app pour continuer à l'utiliser.",
  },
  version: 'Version {{version}}',
  releaseNotes: 'Nouveautés',
  storeError: "Impossible d'ouvrir la boutique. Vérifiez votre connexion et réessayez.",
  actions: {
    later: 'Plus tard',
    update: 'Mettre à jour',
    openingStore: 'Ouverture…',
  },
} as const;
