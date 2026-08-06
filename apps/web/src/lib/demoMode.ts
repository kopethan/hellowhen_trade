export function isWebDemoDataEnabled() {
  const storeReleaseMode = process.env.NEXT_PUBLIC_STORE_RELEASE === 'true';
  if (storeReleaseMode || process.env.NODE_ENV === 'production') return false;

  return process.env.NEXT_PUBLIC_DEMO_DATA_ENABLED === 'true'
    || (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEMO_DATA_DISABLED !== 'true');
}
