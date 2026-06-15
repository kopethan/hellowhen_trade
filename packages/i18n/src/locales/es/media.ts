import { media as enMedia } from '../en/media';

export const media = {
  ...enMedia,
  labels: {
    ...enMedia.labels,
    image: 'imagen',
  },
  states: {
    ...enMedia.states,
    uploading: 'Subiendo...',
    uploadingImage: 'Subiendo imagen {{current}} de {{total}}...',
  },
  statuses: {
    active: 'Aprobada',
    pending_review: 'Pendiente de revisión',
    flagged: 'Marcada',
    removed: 'Eliminada',
  },
  empty: {
    ...enMedia.empty,
    noImagesYet: 'Sin imágenes todavía',
    sideImagesAppearHere: 'Las imágenes adjuntas a este lado aparecerán aquí.',
  },
  authRequired: {
    title: 'Inicia sesión para ver las imágenes',
    body: '{{count}} imagen(es) están ocultas para visitantes sin sesión por seguridad y privacidad.',
  },
  errors: {
    ...enMedia.errors,
    removedAfterReport: 'Esta imagen se eliminó después de un reporte de contenido.',
    couldNotLoad: 'No se pudo cargar la imagen.',
    uploadFailed: 'La carga de la imagen falló. Comprueba tu conexión e inténtalo de nuevo.',
    uploadFailedAt: 'La imagen {{current}} de {{total}} no se pudo subir. {{reason}}',
  },
} as const;
