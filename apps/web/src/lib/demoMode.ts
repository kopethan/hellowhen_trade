export function isWebDemoDataEnabled() {
  return process.env.NEXT_PUBLIC_DEMO_DATA_ENABLED === 'true' || (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEMO_DATA_DISABLED !== 'true');
}
