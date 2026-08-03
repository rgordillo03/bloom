-- ═══════════════════════════════════════════════════════════════
-- BLOOM v4 — MULTILINGUAL CONTENT SYSTEM
-- Per-garden question banks + shared inspiration quotes
-- EN / DE / ES columns (DE and ES filled manually later)
-- ═══════════════════════════════════════════════════════════════
-- Run this on your existing Supabase project. It does NOT wipe
-- any user data. It only adds new tables + a language column.
-- ═══════════════════════════════════════════════════════════════

-- ─── PROFILE LANGUAGE ────────────────────────────────────────
-- Each user picks their preferred display language.
-- Defaults to 'en'. Values: 'en' | 'de' | 'es'.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'
  CHECK (language IN ('en', 'de', 'es'));

-- ─── CONTENT TABLES ──────────────────────────────────────────
-- One table per garden type. Same shape.
-- category = internal English slug (awareness, gratitude, ...)
-- sort_order = position within category (drives rotation)
-- question_en NOT NULL (source of truth + fallback)
-- question_de, question_es nullable (filled later)

CREATE TABLE IF NOT EXISTS public.content_solo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,
  sort_order    INTEGER NOT NULL,
  question_en   TEXT NOT NULL,
  question_de   TEXT,
  question_es   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, sort_order)
);

CREATE TABLE IF NOT EXISTS public.content_couple (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,
  sort_order    INTEGER NOT NULL,
  question_en   TEXT NOT NULL,
  question_de   TEXT,
  question_es   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, sort_order)
);

CREATE TABLE IF NOT EXISTS public.content_group (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,
  sort_order    INTEGER NOT NULL,
  question_en   TEXT NOT NULL,
  question_de   TEXT,
  question_es   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_content_solo_cat   ON public.content_solo(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_content_couple_cat ON public.content_couple(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_content_group_cat  ON public.content_group(category, sort_order);

-- ─── SHARED INSPIRATION QUOTES ───────────────────────────────
-- Universal across all garden types.
CREATE TABLE IF NOT EXISTS public.content_inspirations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order    INTEGER NOT NULL UNIQUE,
  author        TEXT NOT NULL,
  text_en       TEXT NOT NULL,
  text_de       TEXT,
  text_es       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspirations_sort ON public.content_inspirations(sort_order);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════
-- Content is read-only for all signed-in users. No client writes.
-- You edit content directly in Supabase Table Editor.

ALTER TABLE public.content_solo         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_couple       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_group        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_inspirations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_solo_read"         ON public.content_solo;
DROP POLICY IF EXISTS "content_couple_read"       ON public.content_couple;
DROP POLICY IF EXISTS "content_group_read"        ON public.content_group;
DROP POLICY IF EXISTS "content_inspirations_read" ON public.content_inspirations;

CREATE POLICY "content_solo_read"         ON public.content_solo
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "content_couple_read"       ON public.content_couple
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "content_group_read"        ON public.content_group
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "content_inspirations_read" ON public.content_inspirations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════
-- DONE. Now run 004_content_seed.sql to populate.
-- ═══════════════════════════════════════════════════════════════
