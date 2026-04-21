-- ═══════════════════════════════════════════════════════════════
-- BLOOM DATABASE SCHEMA — Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. COUPLES
CREATE TABLE public.couples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT UNIQUE NOT NULL,
  partner1_id UUID,
  partner2_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES (linked to Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  couple_id UUID REFERENCES public.couples(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign keys back to couples
ALTER TABLE public.couples
  ADD CONSTRAINT fk_partner1 FOREIGN KEY (partner1_id) REFERENCES public.profiles(id),
  ADD CONSTRAINT fk_partner2 FOREIGN KEY (partner2_id) REFERENCES public.profiles(id);

-- 3. CHECK-INS
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  category TEXT NOT NULL,
  answer TEXT NOT NULL,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_checkin_unique ON public.check_ins(user_id, check_in_date);
CREATE INDEX idx_checkin_couple ON public.check_ins(couple_id, check_in_date DESC);

-- 4. NOTES
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_couple ON public.notes(couple_id, created_at DESC);

-- 5. MOMENTS
CREATE TABLE public.moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  moment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moments_couple ON public.moments(couple_id, moment_date DESC);

-- 6. GARDEN STATS
CREATE TABLE public.garden_stats (
  couple_id UUID PRIMARY KEY REFERENCES public.couples(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_blooms INTEGER DEFAULT 0,
  last_check_in_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Auto-update garden stats on check-in
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_garden_on_check_in()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO garden_stats (couple_id, total_blooms, last_check_in_date, current_streak, longest_streak)
  VALUES (NEW.couple_id, 1, NEW.check_in_date, 1, 1)
  ON CONFLICT (couple_id) DO UPDATE SET
    total_blooms = garden_stats.total_blooms + 1,
    current_streak = CASE
      WHEN garden_stats.last_check_in_date = NEW.check_in_date - INTERVAL '1 day'
        THEN garden_stats.current_streak + 1
      WHEN garden_stats.last_check_in_date = NEW.check_in_date
        THEN garden_stats.current_streak
      ELSE 1
    END,
    longest_streak = GREATEST(
      garden_stats.longest_streak,
      CASE
        WHEN garden_stats.last_check_in_date = NEW.check_in_date - INTERVAL '1 day'
          THEN garden_stats.current_streak + 1
        ELSE 1
      END
    ),
    last_check_in_date = NEW.check_in_date,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_garden_update
  AFTER INSERT ON check_ins
  FOR EACH ROW EXECUTE FUNCTION update_garden_on_check_in();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Auto-create profile on user signup
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_stats ENABLE ROW LEVEL SECURITY;

-- Profiles: see self + partner
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  id = auth.uid()
  OR couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid() AND couple_id IS NOT NULL)
);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

-- Couples: see own couple + joinable couples (by invite code)
CREATE POLICY "couples_select" ON couples FOR SELECT USING (
  partner1_id = auth.uid() OR partner2_id = auth.uid()
  OR invite_code IS NOT NULL  -- allows looking up by invite code during pairing
);
CREATE POLICY "couples_insert" ON couples FOR INSERT WITH CHECK (partner1_id = auth.uid());
CREATE POLICY "couples_update" ON couples FOR UPDATE USING (
  partner1_id = auth.uid() OR partner2_id = auth.uid()
);

-- Check-ins: only your couple
CREATE POLICY "checkins_select" ON check_ins FOR SELECT USING (
  couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "checkins_insert" ON check_ins FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
);

-- Notes: only your couple
CREATE POLICY "notes_select" ON notes FOR SELECT USING (
  couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "notes_insert" ON notes FOR INSERT WITH CHECK (
  from_user_id = auth.uid()
  AND couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "notes_update" ON notes FOR UPDATE USING (
  couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
);

-- Moments: only your couple
CREATE POLICY "moments_select" ON moments FOR SELECT USING (
  couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "moments_insert" ON moments FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
);

-- Garden stats: only your couple
CREATE POLICY "garden_select" ON garden_stats FOR SELECT USING (
  couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
);
