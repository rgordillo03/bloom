-- ═══════════════════════════════════════════════════════════════
-- BLOOM — MIGRATION 002: Edit & Delete permissions
-- ═══════════════════════════════════════════════════════════════
-- Purpose: Allow users to edit and delete their OWN entries.
--   • check_ins  — author can update/delete
--   • notes      — author can update/delete
--   • moments    — author can update/delete
--
-- Others (garden members) can still SEE these entries — but only
-- the author can modify or remove them.
--
-- Safe to run: uses IF NOT EXISTS pattern for idempotent execution.
-- Run this in Supabase → SQL Editor → New Query.
-- ═══════════════════════════════════════════════════════════════

-- ─── CHECK-INS ─────────────────────────────────────────────
-- Existing policies:  checkins_select_member, checkins_insert_member
-- New policies:       author can UPDATE and DELETE own reflections

DROP POLICY IF EXISTS "checkins_update_author" ON check_ins;
CREATE POLICY "checkins_update_author" ON check_ins
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "checkins_delete_author" ON check_ins;
CREATE POLICY "checkins_delete_author" ON check_ins
  FOR DELETE
  USING (user_id = auth.uid());


-- ─── NOTES ─────────────────────────────────────────────────
-- Existing policies:  notes_select_member, notes_insert_member,
--                     notes_update_member (too permissive — replace it)
-- New policies:       author-only edit + delete

DROP POLICY IF EXISTS "notes_update_member" ON notes;
DROP POLICY IF EXISTS "notes_update_author" ON notes;
CREATE POLICY "notes_update_author" ON notes
  FOR UPDATE
  USING (from_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS "notes_delete_author" ON notes;
CREATE POLICY "notes_delete_author" ON notes
  FOR DELETE
  USING (from_user_id = auth.uid());


-- ─── MOMENTS (goals) ───────────────────────────────────────
-- Existing policies:  moments_select_member, moments_insert_member
-- New policies:       author can UPDATE and DELETE own goals

DROP POLICY IF EXISTS "moments_update_author" ON moments;
CREATE POLICY "moments_update_author" ON moments
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "moments_delete_author" ON moments;
CREATE POLICY "moments_delete_author" ON moments
  FOR DELETE
  USING (created_by = auth.uid());


-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION (optional — run to confirm policies are in place)
-- ═══════════════════════════════════════════════════════════════
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('check_ins', 'notes', 'moments')
-- ORDER BY tablename, cmd;
--
-- Expected result: SELECT, INSERT, UPDATE, DELETE policies
-- for each of the 3 tables, with UPDATE/DELETE scoped to author.
-- ═══════════════════════════════════════════════════════════════
