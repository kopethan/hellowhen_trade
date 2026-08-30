export const appUpdate = {
  optional: {
    title: 'New update available',
    body: 'A newer version of Hellowhen is ready with fixes and improvements.',
  },
  mandatory: {
    title: 'Update required',
    body: 'This version of Hellowhen is no longer supported. Update to continue using the app.',
  },
  version: 'Version {{version}}',
  releaseNotes: "What's new",
  storeError: 'We could not open the store. Check your connection and try again.',
  actions: {
    later: 'Later',
    update: 'Update',
    openingStore: 'Opening store…',
  },
} as const;
