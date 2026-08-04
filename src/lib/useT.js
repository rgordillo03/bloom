// ═══════════════════════════════════════════════════════════════
// useT — tiny translation hook
// ═══════════════════════════════════════════════════════════════
// Usage:
//   const t = useT(profile?.language);
//   <button>{t.common.save}</button>
//   <p>{t.fill(t.settings.removeMemberConfirm, { name: 'Ronja' })}</p>
//
// Silently falls back to English if the language is missing or invalid.
// ═══════════════════════════════════════════════════════════════

import { translations, fill } from './translations.js';

export function useT(language) {
  const lang = language && translations[language] ? language : 'en';
  const t = translations[lang];
  // Attach fill so callers don't have to import it separately.
  return { ...t, fill };
}
