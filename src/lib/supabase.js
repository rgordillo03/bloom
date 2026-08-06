import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '⚠️ Missing Supabase credentials. Create a .env file with:\n' +
    'VITE_SUPABASE_URL=https://your-project.supabase.co\n' +
    'VITE_SUPABASE_ANON_KEY=your-anon-key'
  );
}

// ═══════════════════════════════════════════════════════════════
// Session persistence — "logged in for life"
// ═══════════════════════════════════════════════════════════════
// persistSession   → keeps the session in localStorage across restarts
// autoRefreshToken → silently rotates the access token before it expires
// detectSessionInUrl → catches any lingering magic links (legacy)
//
// The refresh token lifetime is set in Supabase Dashboard → Auth → Sessions.
// As long as the user opens the app within that window, they stay logged in
// indefinitely (the refresh token rotates and the clock resets each time).
// ═══════════════════════════════════════════════════════════════
export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'bloom-auth',
  },
});
