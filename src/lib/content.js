// ═══════════════════════════════════════════════════════════════
// BLOOM v4 — CONTENT LOADER (Supabase-backed, multilingual)
// ═══════════════════════════════════════════════════════════════
// - Questions live in Supabase, per garden type
// - Rotation: category cycles day-by-day, question cycles within category
// - Fallback: DE/ES fall back to EN when null
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase.js';

// ─── Rotation order (MUST match Supabase category slugs) ─────
// The order here determines which category appears on which day.
export const CATEGORY_ORDER = {
  solo:   ['awareness', 'gratitude', 'growth', 'dreams', 'reflection'],
  couple: ['gratitude', 'dreams', 'memories', 'playful', 'deep', 'needs'],
  group:  ['connection', 'memories', 'plans', 'playful', 'updates'],
};

// ─── Icon per category (kept in code, not translated) ────────
export const CAT_ICONS = {
  // solo
  awareness:  '🌿',
  growth:     '🌱',
  dreams:     '✨',
  reflection: '💫',
  // couple
  memories:   '📸',
  playful:    '🎲',
  deep:       '💎',
  needs:      '🤝',
  // group
  connection: '🤝',
  plans:      '✨',
  updates:    '🌱',
  // shared
  gratitude:  '🙏',
};

const CONTENT_TABLES = {
  solo:   'content_solo',
  couple: 'content_couple',
  group:  'content_group',
};

export const GARDEN_TYPES = {
  solo:   { icon: '🧘', label: 'Solo',   color: '#8B9E7E', desc: 'Your private space for reflection' },
  couple: { icon: '💑', label: 'Couple', color: '#C17F59', desc: 'Deepen your bond with your partner' },
  group:  { icon: '🤝', label: 'Group',  color: '#C9A96E', desc: 'Family, friends, or chosen family' },
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export function todayDateStr() {
  return new Date().toISOString().split('T')[0];
}

// Local-timezone day counter.
// Each device rotates at its own midnight, so Cologne users and
// Guatemala users each see "today's" question aligned to their real day.
// Two people in very different timezones may see different questions
// during the overlap window around midnight — this is intentional.
function dayIndex() {
  const now = new Date();
  // Use LOCAL calendar components (getFullYear/getMonth/getDate),
  // then anchor to UTC to produce a stable integer day count.
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}

// Language field picker with EN fallback.
function localized(row, prefix, language) {
  const langKey = language === 'de' ? `${prefix}_de`
                : language === 'es' ? `${prefix}_es`
                : `${prefix}_en`;
  const value = row?.[langKey];
  if (value && value.trim()) return value;
  // Fallback chain: requested lang → English
  return row?.[`${prefix}_en`] || '';
}

// ═══════════════════════════════════════════════════════════════
// FETCHERS
// ═══════════════════════════════════════════════════════════════

async function fetchGardenQuestions(gardenType) {
  const table = CONTENT_TABLES[gardenType];
  if (!table) return [];
  const { data, error } = await supabase
    .from(table)
    .select('id, category, sort_order, question_en, question_de, question_es')
    .order('category')
    .order('sort_order');
  if (error) {
    console.error(`Failed to load ${table}:`, error);
    return [];
  }
  return data || [];
}

async function fetchInspirations() {
  const { data, error } = await supabase
    .from('content_inspirations')
    .select('id, sort_order, author, text_en, text_de, text_es')
    .order('sort_order');
  if (error) {
    console.error('Failed to load inspirations:', error);
    return [];
  }
  return data || [];
}

// ═══════════════════════════════════════════════════════════════
// ROTATION LOGIC
// ═══════════════════════════════════════════════════════════════
// Day N picks category[N mod C] where C = number of categories.
// Within that category, cycle picks question[floor(N/C) mod Q]
// where Q = questions in that category.
// Result: no repeats until you've seen every question.

function pickTodayQuestion(gardenType, questions, day, language) {
  const cats = CATEGORY_ORDER[gardenType] || [];
  if (cats.length === 0 || questions.length === 0) return null;

  const catIndex = day % cats.length;
  const category = cats[catIndex];

  const inCat = questions
    .filter(q => q.category === category)
    .sort((a, b) => a.sort_order - b.sort_order);
  if (inCat.length === 0) return null;

  const cycleNumber = Math.floor(day / cats.length);
  const idx = cycleNumber % inCat.length;
  const row = inCat[idx];

  return {
    id: row.id,
    q: localized(row, 'question', language),
    cat: category,
    icon: CAT_ICONS[category] || '🌿',
  };
}

function pickTodayInspiration(inspirations, day, language) {
  if (inspirations.length === 0) return null;
  const idx = day % inspirations.length;
  const row = inspirations[idx];
  return {
    text: localized(row, 'text', language),
    author: row.author,
  };
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

// Main entrypoint. Call from a useEffect keyed on gardenType + language.
export async function getTodayContent(gardenType, language = 'en') {
  const day = dayIndex();
  const [questions, inspirations] = await Promise.all([
    fetchGardenQuestions(gardenType),
    fetchInspirations(),
  ]);
  return {
    question:    pickTodayQuestion(gardenType, questions, day, language),
    inspiration: pickTodayInspiration(inspirations, day, language),
  };
}

// ─── Supported languages (for UI switcher) ───────────────────
export const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
];
