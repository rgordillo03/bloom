// Central place for the app's canonical URL.
// Uses env var in production, falls back to window.location.origin for local dev.
export const SITE_URL = import.meta.env.VITE_SITE_URL || 
  (typeof window !== 'undefined' ? window.location.origin : 'https://bloomgarden.world');
