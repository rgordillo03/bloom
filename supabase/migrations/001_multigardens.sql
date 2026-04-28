-- ═══════════════════════════════════════════════════════════════
-- BLOOM v2 — MULTI-GARDEN ARCHITECTURE
-- ═══════════════════════════════════════════════════════════════
-- ⚠️  THIS WIPES THE OLD SCHEMA. Run on fresh project.
-- Run this entire file in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ─── CLEAN UP OLD TABLES ─────────────────────────────────────
DROP TABLE IF EXISTS public.garden_stats CASCADE;
DROP TABLE IF EXISTS public.moments CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.check_ins CASCADE;
DROP TABLE IF EXISTS public.couples CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.garden_members CASCADE;
DROP TABLE IF EXISTS public.gardens CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_garden_on_check_in() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_garden_ids() CASCADE;
DROP FUNCTION IF EXISTS public.is_garden_member(UUID) CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.gardens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('solo', 'couple', 'group')),
  invite_code TEXT UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gardens_owner ON public.gardens(owner_id);
CREATE INDEX idx_gardens_invite ON public.gardens(invite_code) WHERE invite_code IS NOT NULL;

CREATE TABLE public.garden_members (
  garden_id UUID NOT NULL REFERENCES public.gardens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (garden_id, user_id)
);

CREATE INDEX idx_members_user ON public.garden_members(user_id);
CREATE INDEX idx_members_garden ON public.garden_members(garden_id);

CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id UUID NOT NULL REFERENCES public.gardens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  category TEXT NOT NULL,
  answer TEXT NOT NULL,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_checkin_unique ON public.check_ins(user_id, garden_id, check_in_date);
CREATE INDEX idx_checkin_garden ON public.check_ins(garden_id, check_in_date DESC);

CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id UUID NOT NULL REFERENCES public.gardens(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_garden ON public.notes(garden_id, created_at DESC);

CREATE TABLE public.moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id UUID NOT NULL REFERENCES public.gardens(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  moment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moments_garden ON public.moments(garden_id, moment_date DESC);

CREATE TABLE public.garden_stats (
  garden_id UUID PRIMARY KEY REFERENCES public.gardens(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_blooms INTEGER DEFAULT 0,
  last_check_in_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS (SECURITY DEFINER bypasses RLS recursion)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_garden_member(g UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.garden_members
    WHERE garden_id = g AND user_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_garden_id UUID;
  user_name TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, user_name);

  INSERT INTO public.gardens (name, type, owner_id, invite_code)
  VALUES (user_name || '''s Solo Garden', 'solo', NEW.id, NULL)
  RETURNING id INTO new_garden_id;

  INSERT INTO public.garden_members (garden_id, user_id, role)
  VALUES (new_garden_id, NEW.id, 'owner');

  INSERT INTO public.garden_stats (garden_id) VALUES (new_garden_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_garden_on_check_in()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.garden_stats (garden_id, total_blooms, last_check_in_date, current_streak, longest_streak)
  VALUES (NEW.garden_id, 1, NEW.check_in_date, 1, 1)
  ON CONFLICT (garden_id) DO UPDATE SET
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_garden_update
  AFTER INSERT ON check_ins
  FOR EACH ROW EXECUTE FUNCTION public.update_garden_on_check_in();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (using helper function to avoid recursion)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gardens ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_stats ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- GARDENS
CREATE POLICY "gardens_select_member_or_invite" ON gardens
  FOR SELECT USING (
    is_garden_member(id)
    OR (invite_code IS NOT NULL AND type IN ('couple', 'group'))
  );
CREATE POLICY "gardens_insert_self" ON gardens
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "gardens_update_owner" ON gardens
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "gardens_delete_owner" ON gardens
  FOR DELETE USING (owner_id = auth.uid() AND type != 'solo');

-- GARDEN MEMBERS
CREATE POLICY "members_select" ON garden_members
  FOR SELECT USING (user_id = auth.uid() OR is_garden_member(garden_id));
CREATE POLICY "members_insert_self" ON garden_members
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "members_delete_self" ON garden_members
  FOR DELETE USING (user_id = auth.uid());

-- CHECK-INS
CREATE POLICY "checkins_select_member" ON check_ins
  FOR SELECT USING (is_garden_member(garden_id));
CREATE POLICY "checkins_insert_member" ON check_ins
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND is_garden_member(garden_id)
  );

-- NOTES
CREATE POLICY "notes_select_member" ON notes
  FOR SELECT USING (is_garden_member(garden_id));
CREATE POLICY "notes_insert_member" ON notes
  FOR INSERT WITH CHECK (
    from_user_id = auth.uid() AND is_garden_member(garden_id)
  );
CREATE POLICY "notes_update_member" ON notes
  FOR UPDATE USING (is_garden_member(garden_id));

-- MOMENTS
CREATE POLICY "moments_select_member" ON moments
  FOR SELECT USING (is_garden_member(garden_id));
CREATE POLICY "moments_insert_member" ON moments
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND is_garden_member(garden_id)
  );

-- GARDEN STATS
CREATE POLICY "stats_select_member" ON garden_stats
  FOR SELECT USING (is_garden_member(garden_id));
CREATE POLICY "stats_insert_system" ON garden_stats
  FOR INSERT WITH CHECK (true);
CREATE POLICY "stats_update_system" ON garden_stats
  FOR UPDATE USING (true);

-- ═══════════════════════════════════════════════════════════════
-- DONE 🌿
-- ═══════════════════════════════════════════════════════════════
