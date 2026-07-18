import { navigation as enNavigation } from '../en/navigation';

export const navigation = {
  ...enNavigation,
  primary: 'Navegación principal',
  goBack: 'Volver',
  authRequired: {
    ...enNavigation.authRequired,
    default: {
      title: 'Inicio de sesión obligatorio',
      body: 'Inicia sesión para continuar con tus necesidades, ofertas, propuestas y ajustes de cuenta guardados.',
    },
    manageNeeds: {
      title: 'Inicia sesión para gestionar tus necesidades',
      body: 'El feed público sigue abierto. Inicia sesión para crear, editar y gestionar tus propias necesidades.',
    },
    manageOffers: {
      title: 'Inicia sesión para gestionar tus ofertas',
      body: 'El feed público sigue abierto. Inicia sesión para crear, editar y gestionar tus propias ofertas.',
    },
    account: {
      title: 'Inicia sesión para abrir tu cuenta',
      body: 'Inicia sesión para acceder a tu perfil, ajustes, soporte y herramientas de cuenta.',
    },
    planDiscussion: {
      title: 'Inicia sesión para ver la conversación del Plan',
      body: 'La conversación pública del Plan está disponible para miembros con sesión iniciada para mantener una moderación responsable.',
    },
    createPlan: {
      title: 'Inicia sesión para crear un Plan',
      body: 'Inicia sesión antes de crear Planes para que queden vinculados a tu cuenta.',
    },
    createPlace: {
      title: 'Inicia sesión para crear un lugar',
      body: 'Inicia sesión antes de crear lugares reutilizables para que queden vinculados a tu cuenta.',
    },
    createNeed: {
      title: 'Inicia sesión para crear una necesidad',
      body: 'Inicia sesión antes de crear necesidades para que queden vinculadas a tu cuenta.',
    },
    createOffer: {
      title: 'Inicia sesión para crear una oferta',
      body: 'Inicia sesión antes de crear ofertas para que queden vinculadas a tu cuenta.',
    },
    createTrade: {
      title: 'Inicia sesión para crear un intercambio',
      body: 'Puedes explorar el feed público ahora. Inicia sesión cuando quieras publicar un intercambio.',
    },
    sendProposal: {
      title: 'Inicia sesión para enviar una propuesta',
      body: 'Los mensajes de propuesta son privados, así que necesitas una cuenta antes de proponer un intercambio.',
    },
    tradeDiscussion: {
      title: 'Inicia sesión para ver la conversación pública',
      body: 'La conversación pública está disponible para miembros con sesión iniciada para mantener una moderación responsable.',
    },
    privateProposals: {
      title: 'Inicia sesión para ver propuestas privadas',
      body: 'Las conversaciones privadas de propuestas solo son visibles para el propietario del intercambio y cada solicitante.',
    },
  },
  tabs: {
    ...enNavigation.tabs,
    trades: 'Intercambios',
    needs: 'Necesidades',
    offers: 'Ofertas',
    account: 'Cuenta',
    plans: 'Planes',
    me: 'Yo',
    trade: 'Intercambio',
  },
  workspace: {
    ...enNavigation.workspace,
    plans: {
      ...enNavigation.workspace.plans,
      planGuide: { title: 'Guía de Planes', body: 'Aprende cómo funcionan los Planes, lugares, unirse, crear y la seguridad.' },
    },
  },
  routes: {
    ...enNavigation.routes,
    trades: 'Intercambios',
    needs: 'Necesidades',
    offers: 'Ofertas',
    account: 'Cuenta',
    me: 'Yo',
    membership: 'Membresía',
    createTrade: 'Crear intercambio',
    plan: 'Plan',
    plans: 'Planes',
    createPlan: 'Crear plan',
    editPlan: 'Editar plan',
    editPlace: 'Editar lugar',
    profile: 'Perfil',
    trade: 'Intercambio',
    createNeed: 'Crear necesidad',
    editNeed: 'Editar necesidad',
    need: 'Necesidad',
    createOffer: 'Crear oferta',
    editOffer: 'Editar oferta',
    offer: 'Oferta',
    settings: 'Ajustes',
    onboardingGuide: 'Guía',
    support: 'Soporte',
    legal: 'Legal y seguridad',
    terms: 'Términos',
    privacy: 'Privacidad',
    safety: 'Seguridad',
    refundDispute: 'Reembolsos y disputas',
  },
} as const;
