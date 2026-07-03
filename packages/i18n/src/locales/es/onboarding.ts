import { onboarding as enOnboarding } from '../en/onboarding';

export const onboarding = {
  ...enOnboarding,
  ariaLabel: 'Guía de bienvenida de Hellowhen',
  actions: {
    ...enOnboarding.actions,
    skip: 'Saltar',
    back: 'Volver',
    next: 'Siguiente',
    getStarted: 'Empezar',
  },
  guides: {
    ...enOnboarding.guides,
    global: {
      ...enOnboarding.guides.global,
      title: 'Guía de Hellowhen',
      summary: 'Una vista rápida de Trade, Plans, Me y seguridad.',
    },
    trade: {
      ...enOnboarding.guides.trade,
      title: 'Guía de Trade',
      summary: 'Aprende cómo funcionan Necesidades, Ofertas, tarjetas de intercambio y propuestas.',
    },
    plans: {
      ...enOnboarding.guides.plans,
      title: 'Guía de Plans',
      summary: 'Aprende cómo funcionan Plans, lugares, unirse, crear y la seguridad.',
    },
  },
  preferences: {
    ...enOnboarding.preferences,
    title: 'Preferencias',
    body: 'Elige el idioma y la apariencia antes de continuar.',
    openAccessibilityLabel: 'Cambiar idioma y apariencia de bienvenida',
    languageTitle: 'Idioma',
    appearanceTitle: 'Apariencia',
    done: 'Hecho',
    languageOptions: {
      system: 'Idioma del sistema',
      en: 'English',
      fr: 'Français',
      es: 'Español',
    },
    appearanceOptions: {
      system: 'Sistema',
      light: 'Claro',
      dark: 'Oscuro',
    },
  },
  slides: {
    ...enOnboarding.slides,
    globalWelcome: {
      ...enOnboarding.slides.globalWelcome,
      title: 'Bienvenido a Hellowhen',
      body: 'Hellowhen ayuda a las personas a conectar alrededor de necesidades, ofertas, planes y conversaciones más seguras.',
      caption: 'Empieza con la idea general y luego explora cada área cuando lo necesites.',
    },
    globalWorlds: {
      ...enOnboarding.slides.globalWorlds,
      title: 'Trade, Plans y Me',
      body: 'Usa Trade para un intercambio, Plans para objetivos o rutas más grandes, y Me para tu actividad, herramientas y perfil.',
      caption: 'Tres áreas principales mantienen la app simple.',
    },
    globalMeHub: {
      ...enOnboarding.slides.globalMeHub,
      title: 'Tu actividad vive en Me',
      body: 'Encuentra tus intercambios, propuestas, planes, elementos guardados, Agenda, notificaciones, ajustes y soporte desde Me.',
      caption: 'Me es tu centro personal.',
    },
    globalSafety: {
      ...enOnboarding.slides.globalSafety,
      title: 'Mantén claros los acuerdos',
      body: 'Usa la app para conservar detalles importantes, evitar información sensible y reportar cualquier cosa sospechosa.',
      caption: 'La guía de seguridad aparece de nuevo dentro de cada función.',
    },
    welcome: {
      ...enOnboarding.slides.welcome,
      title: 'Bienvenido a Trade',
      body: 'Publica lo que necesitas y lo que puedes ofrecer, y conecta alrededor de intercambios claros.',
      caption: 'Necesidad + Oferta puede convertirse en un intercambio.',
    },
    createNeed: {
      ...enOnboarding.slides.createNeed,
      title: 'Crea una Necesidad',
      body: 'Añade un título, detalles útiles, una categoría e imágenes opcionales para que otros entiendan lo que necesitas.',
    },
    createOffer: {
      ...enOnboarding.slides.createOffer,
      title: 'Crea una Oferta',
      body: 'Comparte lo que puedes ofrecer, desde ayuda práctica hasta trabajo creativo u objetos útiles.',
    },
    discoverTrades: {
      ...enOnboarding.slides.discoverTrades,
      title: 'Descubre intercambios',
      body: 'Explora el feed de Intercambios, abre las tarjetas que te interesen y encuentra posibles conexiones.',
    },
    sendProposal: {
      ...enOnboarding.slides.sendProposal,
      title: 'Envía una Propuesta',
      body: 'Elige lo que puedes ofrecer o necesitar, y envía un mensaje privado para empezar la conversación.',
    },
    staySafe: {
      ...enOnboarding.slides.staySafe,
      title: 'Mantente seguro',
      body: 'Acuerda los detalles con claridad, evita información sensible y reporta problemas si algo no te parece bien.',
    },
    accountGuide: {
      ...enOnboarding.slides.accountGuide,
      title: 'Cuenta y guía',
      body: 'Gestiona tu perfil, ajustes, soporte y guía de usuario desde el área Cuenta.',
    },
    plansWelcome: {
      ...enOnboarding.slides.plansWelcome,
      title: 'Bienvenido a Plans',
      body: 'Un Plan es un objetivo o una ruta más grande que puede incluir lugares, personas, necesidades, ofertas y más adelante discusiones.',
      caption: 'Plans da contexto alrededor de una actividad más grande.',
    },
    plansDiscover: {
      ...enOnboarding.slides.plansDiscover,
      title: 'Descubre Plans públicos',
      body: 'Explora Plans para entender qué quiere hacer alguien, dónde ocurre y cómo podrías unirte o ayudar.',
      caption: 'Plans se basa en objetivos, no solo en una tarjeta de intercambio.',
    },
    plansPlaces: {
      ...enOnboarding.slides.plansPlaces,
      title: 'Lugares dentro de Plans',
      body: 'Plans puede incluir direcciones offline y lugares online para que los usuarios entiendan claramente la ruta o actividad.',
      caption: 'Los lugares hacen que un Plan sea concreto.',
    },
    plansCreateJoin: {
      ...enOnboarding.slides.plansCreateJoin,
      title: 'Crea o únete',
      body: 'Crea tu propio Plan, guarda lugares útiles o únete a un Plan público cuando te interese.',
      caption: 'Plans puede crecer desde una idea hasta varios pasos útiles.',
    },
    plansSafety: {
      ...enOnboarding.slides.plansSafety,
      title: 'Usa Plans con seguridad',
      body: 'Revisa detalles de ubicación, mantén apropiada la información pública y reporta cualquier cosa sospechosa.',
      caption: 'La seguridad de Plans es importante alrededor de lugares y encuentros.',
    },
  },
} as const;
