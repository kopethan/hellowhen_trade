export const media = {
  labels: {
    image: 'image',
  },
  states: {
    uploading: 'Uploading...',
    uploadingImage: 'Uploading image {{current}} of {{total}}...',
  },
  statuses: {
    active: 'Approved',
    pending_review: 'Pending review',
    flagged: 'Flagged',
    removed: 'Removed',
  },
  empty: {
    noImagesYet: 'No images yet',
    sideImagesAppearHere: 'Images attached to this side will appear here.',
  },
  authRequired: {
    title: 'Log in to view images',
    body: '{{count}} image(s) are hidden from logged-out visitors for safety and privacy.',
  },
  errors: {
    removedAfterReport: 'This image was removed after a content report.',
    couldNotLoad: 'The image could not be loaded.',
    uploadFailed: 'The image upload failed. Check your connection and try again.',
    uploadFailedAt: 'Image {{current}} of {{total}} could not upload. {{reason}}',
  },
} as const;
