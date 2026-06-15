export const media = {
  labels: {
    image: 'image',
  },
  states: {
    uploading: 'Importation…',
    uploadingImage: 'Importation de l’image {{current}} sur {{total}}…',
  },
  statuses: {
    active: 'Approuvée',
    pending_review: 'En attente de vérification',
    flagged: 'Signalée',
    removed: 'Retirée',
  },
  empty: {
    noImagesYet: 'Aucune image pour le moment',
    sideImagesAppearHere: 'Les images attachées à ce côté apparaîtront ici.',
  },
  authRequired: {
    title: 'Connectez-vous pour voir les images',
    body: '{{count}} image(s) sont masquées aux visiteurs non connectés pour la sécurité et la confidentialité.',
  },
  errors: {
    removedAfterReport: 'Cette image a été retirée après un signalement de contenu.',
    couldNotLoad: 'L’image n’a pas pu être chargée.',
    uploadFailed: 'L’importation de l’image a échoué. Vérifiez votre connexion puis réessayez.',
    uploadFailedAt: 'L’image {{current}} sur {{total}} n’a pas pu être importée. {{reason}}',
  },
} as const;
