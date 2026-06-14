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
    welcome: {
      ...enOnboarding.slides.welcome,
      title: 'Bienvenido a Hellowhen',
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
  },
} as const;
