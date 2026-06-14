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
  empty: {
    ...enMedia.empty,
    noImagesYet: 'Sin imágenes todavía',
    sideImagesAppearHere: 'Las imágenes adjuntas a este lado aparecerán aquí.',
  },
  errors: {
    ...enMedia.errors,
    removedAfterReport: 'Esta imagen se eliminó después de un reporte de contenido.',
    couldNotLoad: 'No se pudo cargar la imagen.',
    uploadFailed: 'La carga de la imagen falló. Comprueba tu conexión e inténtalo de nuevo.',
    uploadFailedAt: 'La imagen {{current}} de {{total}} no se pudo subir. {{reason}}',
  },
} as const;
