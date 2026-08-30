export const appUpdate = {
  optional: {
    title: 'Nueva actualización disponible',
    body: 'Hay una nueva versión de Hellowhen disponible con correcciones y mejoras.',
  },
  mandatory: {
    title: 'Actualización obligatoria',
    body: 'Esta versión de Hellowhen ya no es compatible. Actualiza la app para seguir utilizándola.',
  },
  version: 'Versión {{version}}',
  releaseNotes: 'Novedades',
  storeError: 'No pudimos abrir la tienda. Comprueba tu conexión e inténtalo de nuevo.',
  actions: {
    later: 'Más tarde',
    update: 'Actualizar',
    openingStore: 'Abriendo tienda…',
  },
} as const;
