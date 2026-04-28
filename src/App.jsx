import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase.js';
import { getTodayContent, GARDEN_TYPES } from './lib/content.js';
import * as db from './lib/db.js';

// ─── COLORS ─────────────────────────────────────────────────
const C = {
  bg: '#FAF7F2', bgDeep: '#F5F0E8', warm: '#FDF9F3',
  terra: '#C17F59', terraL: '#D4A574', terraD: '#A66B45',
  sage: '#8B9E7E', sageL: '#B5C7A9', sageD: '#6B7E5E',
  brown: '#3D3229', brownL: '#5C4A3A', brownM: '#7A6A5A',
  gold: '#C9A96E', blush: '#E8C4B8', peach: '#F0D5C8',
};

const btn = {
  primary: {
    background: `linear-gradient(135deg, ${C.terra}, ${C.terraD})`,
    color: '#fff', border: 'none', borderRadius: 14, padding: '14px 28px',
    fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(193,127,89,0.2)',
    width: '100%', transition: 'all 0.2s', fontFamily: "'Lora', serif",
  },
  secondary: {
    background: 'transparent', color: C.sageD, border: `1.5px solid ${C.sage}`,
    borderRadius: 14, padding: '12px 20px', fontSize: 14,
    cursor: 'pointer', width: '100%', transition: 'all 0.2s', fontFamily: "'Lora', serif",
  },
};

const inputStyle = {
  width: '100%', padding: '14px 16px', fontSize: 15,
  fontFamily: "'Lora', serif", border: `2px solid ${C.terraL}50`,
  borderRadius: 12, background: C.warm, color: C.brown, boxSizing: 'border-box',
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGardenId, setActiveGardenId] = useState(null);

  // Initial load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) loadUserData(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
      if (session?.user) loadUserData(session.user.id);
      else { setProfile(null); setGardens([]); setActiveGardenId(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    try {
      const p = await db.getMyProfile(userId);
      setProfile(p);
      const gs = await db.getMyGardens(userId);
      setGardens(gs);

      // Restore last active garden from localStorage, else use solo (first)
      const saved = localStorage.getItem('bloom-active-garden');
      const exists = gs.find(g => g.id === saved);
      setActiveGardenId(exists ? saved : (gs[0]?.id || null));
    } catch (e) {
      console.error('Load error:', e);
    }
    setLoading(false);
  };

  const refreshGardens = async () => {
    if (!user) return;
    const gs = await db.getMyGardens(user.id);
    setGardens(gs);
    return gs;
  };

  const switchGarden = (gardenId) => {
    setActiveGardenId(gardenId);
    localStorage.setItem('bloom-active-garden', gardenId);
  };

  if (loading) return <SplashScreen />;
  if (!user) return <AuthScreen />;
  const activeGarden = gardens.find(g => g.id === activeGardenId);
  if (!activeGarden) return <SplashScreen />;

  return (
    <MainApp
      user={user}
      profile={profile}
      gardens={gardens}
      activeGarden={activeGarden}
      onSwitchGarden={switchGarden}
      onRefreshGardens={refreshGardens}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// SPLASH
// ═══════════════════════════════════════════════════════════════
function SplashScreen() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <div style={{ animation: 'gentleFloat 2s ease-in-out infinite' }}>
        <BloomIcon size={56} />
      </div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 400, color: C.brown, marginTop: 16, letterSpacing: '0.06em' }}>bloom</h1>
      <p style={{ fontSize: 13, color: C.brownM, fontStyle: 'italic', marginTop: 6 }}>tending your gardens...</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════════════
function AuthScreen() {
  const [mode, setMode] = useState(null); // 'signup', 'login'
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (mode === 'signup' && !name.trim()) return;
    setBusy(true);
    setError('');
    const options = { emailRedirectTo: window.location.origin };
    if (mode === 'signup') options.data = { display_name: name.trim() };
    const { error: authErr } = await supabase.auth.signInWithOtp({
      email: email.trim(), options,
    });
    setBusy(false);
    if (authErr) { setError(authErr.message); return; }
    setSent(true);
  };

  const reset = () => { setMode(null); setEmail(''); setName(''); setSent(false); setError(''); };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: `linear-gradient(180deg, ${C.bg}, ${C.bgDeep})` }}>
      <BloomIcon size={48} />
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 500, color: C.brown, margin: '16px 0 8px' }}>
        Welcome to <em style={{ color: C.terra }}>Bloom</em>
      </h1>
      <p style={{ fontSize: 14, color: C.brownL, textAlign: 'center', maxWidth: 320, marginBottom: 32, lineHeight: 1.6 }}>
        Tend your love, one tap at a time.
      </p>

      {!mode && !sent && (
        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp 0.4s ease' }}>
          <button onClick={() => setMode('signup')} style={btn.primary}>🌱 Create New Account</button>
          <button onClick={() => setMode('login')} style={btn.secondary}>🔑 Log In</button>
        </div>
      )}

      {mode === 'signup' && !sent && (
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 320, animation: 'fadeUp 0.4s ease' }}>
          <p style={{ fontSize: 13, color: C.terra, fontWeight: 600, textAlign: 'center', marginBottom: 18, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Create Your Account
          </p>
          <label style={{ fontSize: 12, color: C.brownM, display: 'block', marginBottom: 6 }}>Your name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rafael" style={{ ...inputStyle, marginBottom: 16 }} autoFocus />
          <label style={{ fontSize: 12, color: C.brownM, display: 'block', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={{ ...inputStyle, marginBottom: 8 }} />
          {error && <p style={{ fontSize: 13, color: '#C75050', marginBottom: 8 }}>{error}</p>}
          <p style={{ fontSize: 11, color: C.brownM, opacity: 0.6, marginBottom: 20 }}>We'll send you a magic link — no password needed</p>
          <button type="submit" disabled={busy || !email || !name} style={{ ...btn.primary, opacity: email && name ? 1 : 0.4 }}>
            {busy ? 'Sending...' : 'Sign Up ✨'}
          </button>
          <button type="button" onClick={reset} style={{ background: 'none', border: 'none', color: C.brownM, fontSize: 12, marginTop: 14, cursor: 'pointer', padding: 8, width: '100%' }}>← Back</button>
        </form>
      )}

      {mode === 'login' && !sent && (
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 320, animation: 'fadeUp 0.4s ease' }}>
          <p style={{ fontSize: 13, color: C.terra, fontWeight: 600, textAlign: 'center', marginBottom: 18, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Welcome Back
          </p>
          <label style={{ fontSize: 12, color: C.brownM, display: 'block', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={{ ...inputStyle, marginBottom: 8 }} autoFocus />
          {error && <p style={{ fontSize: 13, color: '#C75050', marginBottom: 8 }}>{error}</p>}
          <p style={{ fontSize: 11, color: C.brownM, opacity: 0.6, marginBottom: 20 }}>We'll send you a magic link to sign in</p>
          <button type="submit" disabled={busy || !email} style={{ ...btn.primary, opacity: email ? 1 : 0.4 }}>
            {busy ? 'Sending...' : 'Send Magic Link ✨'}
          </button>
          <button type="button" onClick={reset} style={{ background: 'none', border: 'none', color: C.brownM, fontSize: 12, marginTop: 14, cursor: 'pointer', padding: 8, width: '100%' }}>← Back</button>
        </form>
      )}

      {sent && (
        <div style={{ textAlign: 'center', maxWidth: 320, animation: 'scaleIn 0.4s ease' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.brown, marginBottom: 8 }}>Check your email!</h2>
          <p style={{ fontSize: 14, color: C.brownL, lineHeight: 1.6 }}>
            We sent a magic link to <strong>{email}</strong>.
          </p>
          <button onClick={reset} style={{ ...btn.secondary, marginTop: 20, width: 'auto', padding: '10px 20px' }}>Use a different email</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP — Garden switcher + tab content
// ═══════════════════════════════════════════════════════════════
function MainApp({ user, profile, gardens, activeGarden, onSwitchGarden, onRefreshGardens }) {
  const [tab, setTab] = useState('today');
  const [stats, setStats] = useState({ current_streak: 0, longest_streak: 0, total_blooms: 0 });
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { question, inspiration } = getTodayContent(activeGarden.type);

  useEffect(() => {
    if (activeGarden?.id) {
      db.getGardenStats(activeGarden.id).then(setStats);
      const sub = db.subscribeToCheckins(activeGarden.id, () => {
        db.getGardenStats(activeGarden.id).then(setStats);
      });
      return () => { supabase.removeChannel(sub); };
    }
  }, [activeGarden?.id]);

  const meta = GARDEN_TYPES[activeGarden.type];

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Top bar with garden switcher */}
      <div style={{ padding: '16px 20px 8px', maxWidth: 420, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <button onClick={() => setShowSwitcher(true)} style={{
          width: '100%', background: C.warm, border: `1px solid ${C.bgDeep}`,
          borderRadius: 14, padding: '12px 16px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
          fontFamily: "'Lora', serif",
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{meta.icon}</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 9, color: C.brownM, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>
                {meta.label} garden
              </p>
              <p style={{ fontSize: 14, color: C.brown, fontWeight: 500 }}>{activeGarden.name}</p>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.brownM} strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, padding: '8px 20px 100px', maxWidth: 420, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {tab === 'today' && (
          <TodayTab user={user} profile={profile} garden={activeGarden}
            question={question} inspiration={inspiration} stats={stats}
            onCheckIn={() => db.getGardenStats(activeGarden.id).then(setStats)}
            onShowSettings={() => setShowSettings(true)} />
        )}
        {tab === 'garden' && <GardenTab gardenName={activeGarden.name} stats={stats} gardenId={activeGarden.id} />}
        {tab === 'notes' && <NotesTab user={user} garden={activeGarden} />}
        {tab === 'moments' && <MomentsTab user={user} garden={activeGarden} />}
      </div>

      {/* Bottom navigation */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(253,249,243,0.92)', backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${C.bgDeep}`, display: 'flex',
        justifyContent: 'space-around', padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
        zIndex: 100,
      }}>
        {[
          { id: 'today', label: 'Today', icon: '☀️' },
          { id: 'garden', label: 'Garden', icon: '🌱' },
          { id: 'notes', label: 'Notes', icon: '💌' },
          { id: 'moments', label: 'Moments', icon: '📸' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'none', border: 'none', padding: '6px 14px',
            color: tab === t.id ? C.terra : C.brownM,
            fontFamily: "'Lora', serif", fontSize: 10, gap: 2,
          }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontWeight: tab === t.id ? 600 : 400 }}>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Modals */}
      {showSwitcher && (
        <GardenSwitcher
          gardens={gardens}
          activeId={activeGarden.id}
          onSelect={(id) => { onSwitchGarden(id); setShowSwitcher(false); }}
          onCreate={() => { setShowSwitcher(false); setShowCreate(true); }}
          onClose={() => setShowSwitcher(false)}
          onSignOut={async () => { await supabase.auth.signOut(); }}
        />
      )}

      {showCreate && (
        <CreateGardenModal
          user={user}
          onCreated={async () => {
            setShowCreate(false);
            const newGardens = await onRefreshGardens();
            // Switch to the newest garden (last created)
            if (newGardens?.length) {
              const newest = newGardens.reduce((a, b) =>
                new Date(a.created_at) > new Date(b.created_at) ? a : b
              );
              onSwitchGarden(newest.id);
            }
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {showSettings && (
        <GardenSettingsModal
          user={user}
          garden={activeGarden}
          onUpdated={async () => {
            await onRefreshGardens();
            setShowSettings(false);
          }}
          onLeft={async () => {
            const newGardens = await onRefreshGardens();
            // Switch to solo garden
            const solo = newGardens?.find(g => g.type === 'solo');
            if (solo) onSwitchGarden(solo.id);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GARDEN SWITCHER MODAL
// ═══════════════════════════════════════════════════════════════
function GardenSwitcher({ gardens, activeId, onSelect, onCreate, onClose, onSignOut }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(46,36,28,0.4)',
      backdropFilter: 'blur(4px)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.bg, borderRadius: '24px 24px 0 0',
        width: '100%', maxWidth: 420, padding: '20px 20px max(20px, env(safe-area-inset-bottom))',
        animation: 'slideUp 0.3s cubic-bezier(0.22,1,0.36,1)',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ width: 40, height: 4, background: C.bgDeep, borderRadius: 2, margin: '0 auto 20px' }} />
        <p style={{ fontSize: 11, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, textAlign: 'center' }}>
          Switch garden
        </p>

        {gardens.map(g => {
          const meta = GARDEN_TYPES[g.type];
          const isActive = g.id === activeId;
          return (
            <button key={g.id} onClick={() => onSelect(g.id)} style={{
              width: '100%', background: isActive ? `${C.terraL}20` : C.warm,
              border: `1.5px solid ${isActive ? C.terra : 'transparent'}`,
              borderRadius: 14, padding: '14px 16px', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', fontFamily: "'Lora', serif", textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{meta.icon}</span>
                <div>
                  <p style={{ fontSize: 14, color: C.brown, fontWeight: 500, marginBottom: 2 }}>{g.name}</p>
                  <p style={{ fontSize: 11, color: C.brownM }}>{meta.label}</p>
                </div>
              </div>
              {isActive && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.terra} strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12l5 5L20 7"/>
                </svg>
              )}
            </button>
          );
        })}

        <button onClick={onCreate} style={{
          width: '100%', background: 'transparent', border: `1.5px dashed ${C.terraL}`,
          borderRadius: 14, padding: '14px 16px', marginTop: 8,
          color: C.terra, cursor: 'pointer', fontFamily: "'Lora', serif",
          fontSize: 14, fontWeight: 500,
        }}>
          + Plant a new garden
        </button>

        <button onClick={onSignOut} style={{
          background: 'none', border: 'none', color: C.brownM,
          fontSize: 12, marginTop: 16, cursor: 'pointer',
          padding: 10, width: '100%', fontFamily: "'Lora', serif",
        }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CREATE GARDEN MODAL
// ═══════════════════════════════════════════════════════════════
function CreateGardenModal({ user, onCreated, onClose }) {
  const [step, setStep] = useState('choose'); // 'choose', 'create', 'join'
  const [type, setType] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [createdGarden, setCreatedGarden] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !type) return;
    setBusy(true); setError('');
    try {
      const garden = await db.createGarden(user.id, name, type);
      setCreatedGarden(garden);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setBusy(true); setError('');
    try {
      await db.joinGarden(user.id, code);
      onCreated();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(46,36,28,0.5)',
      backdropFilter: 'blur(6px)', zIndex: 250,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn 0.2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.bg, borderRadius: 24, padding: 28,
        width: '100%', maxWidth: 380, animation: 'scaleIn 0.3s ease',
        maxHeight: '90vh', overflowY: 'auto',
      }}>

        {/* CHOOSE STEP */}
        {step === 'choose' && (
          <>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: C.brown, textAlign: 'center', marginBottom: 6 }}>
              Plant a new garden
            </h2>
            <p style={{ fontSize: 13, color: C.brownM, textAlign: 'center', marginBottom: 24 }}>
              Start a new garden, or join one with an invite code
            </p>

            <button onClick={() => { setStep('create'); setType('couple'); }} style={{
              width: '100%', background: C.warm, border: `1px solid ${C.bgDeep}`,
              borderRadius: 14, padding: 18, marginBottom: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              fontFamily: "'Lora', serif",
            }}>
              <span style={{ fontSize: 32 }}>💑</span>
              <div>
                <p style={{ fontSize: 15, color: C.brown, fontWeight: 600, marginBottom: 2 }}>Couple Garden</p>
                <p style={{ fontSize: 12, color: C.brownM }}>For you and your partner</p>
              </div>
            </button>

            <button onClick={() => { setStep('create'); setType('group'); }} style={{
              width: '100%', background: C.warm, border: `1px solid ${C.bgDeep}`,
              borderRadius: 14, padding: 18, marginBottom: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              fontFamily: "'Lora', serif",
            }}>
              <span style={{ fontSize: 32 }}>🤝</span>
              <div>
                <p style={{ fontSize: 15, color: C.brown, fontWeight: 600, marginBottom: 2 }}>Group Garden</p>
                <p style={{ fontSize: 12, color: C.brownM }}>For family, friends, chosen family</p>
              </div>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 16px' }}>
              <div style={{ flex: 1, height: 1, background: C.bgDeep }} />
              <span style={{ fontSize: 11, color: C.brownM, textTransform: 'uppercase', letterSpacing: '0.08em' }}>or</span>
              <div style={{ flex: 1, height: 1, background: C.bgDeep }} />
            </div>

            <button onClick={() => setStep('join')} style={btn.secondary}>
              Join with invite code
            </button>

            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: C.brownM, fontSize: 12,
              marginTop: 14, cursor: 'pointer', padding: 8, width: '100%',
              fontFamily: "'Lora', serif",
            }}>Cancel</button>
          </>
        )}

        {/* CREATE STEP */}
        {step === 'create' && !createdGarden && (
          <>
            <button onClick={() => setStep('choose')} style={{
              background: 'none', border: 'none', color: C.brownM,
              fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 16,
              fontFamily: "'Lora', serif",
            }}>← Back</button>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: C.brown, textAlign: 'center', marginBottom: 6 }}>
              {GARDEN_TYPES[type].icon} Name your {GARDEN_TYPES[type].label.toLowerCase()} garden
            </h2>
            <p style={{ fontSize: 13, color: C.brownM, textAlign: 'center', marginBottom: 20 }}>
              {type === 'couple' ? 'Like "Rafael & Ronja" or "Us"' : 'Like "Family", "The Crew", "Best Friends Forever"'}
            </p>

            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder={type === 'couple' ? 'Rafael & Ronja' : 'Family Garden'}
              style={{ ...inputStyle, marginBottom: 16, textAlign: 'center', fontFamily: "'Playfair Display', serif", fontSize: 18 }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && name.trim() && handleCreate()}
            />
            {error && <p style={{ fontSize: 13, color: '#C75050', marginBottom: 8, textAlign: 'center' }}>{error}</p>}

            <button onClick={handleCreate} disabled={!name.trim() || busy}
              style={{ ...btn.primary, opacity: name.trim() ? 1 : 0.4 }}>
              {busy ? 'Planting...' : 'Plant Garden 🌱'}
            </button>
          </>
        )}

        {/* CREATED — SHOW INVITE CODE */}
        {createdGarden && (
          <>
            <div style={{ textAlign: 'center', animation: 'scaleIn 0.4s ease' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌸</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 500, color: C.brown, marginBottom: 8 }}>
                Garden planted!
              </h2>
              <p style={{ fontSize: 13, color: C.brownL, marginBottom: 20 }}>
                Share this code to invite {type === 'couple' ? 'your partner' : 'others'}:
              </p>
              <div style={{
                background: C.warm, borderRadius: 16, padding: '20px 24px',
                fontSize: 30, fontFamily: "'Playfair Display', serif", fontWeight: 600,
                color: C.terra, letterSpacing: 6, marginBottom: 16,
                border: `2px dashed ${C.terraL}`,
              }}>
                {createdGarden.invite_code}
              </div>
              <button onClick={() => {
                navigator.clipboard?.writeText(createdGarden.invite_code);
                navigator.share?.({ text: `Join my Bloom garden! Use code: ${createdGarden.invite_code}\n\nOpen: ${window.location.origin}` }).catch(() => {});
              }} style={{ ...btn.secondary, marginBottom: 10 }}>
                Share Code 📤
              </button>
              <button onClick={onCreated} style={btn.primary}>
                Continue to Garden →
              </button>
            </div>
          </>
        )}

        {/* JOIN STEP */}
        {step === 'join' && (
          <>
            <button onClick={() => setStep('choose')} style={{
              background: 'none', border: 'none', color: C.brownM,
              fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 16,
              fontFamily: "'Lora', serif",
            }}>← Back</button>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: C.brown, textAlign: 'center', marginBottom: 6 }}>
              Join a garden
            </h2>
            <p style={{ fontSize: 13, color: C.brownM, textAlign: 'center', marginBottom: 20 }}>
              Enter the 6-character invite code
            </p>

            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="X7K9M2"
              maxLength={6}
              style={{ ...inputStyle, textAlign: 'center', fontSize: 22, letterSpacing: 6, fontFamily: "'Playfair Display', serif", marginBottom: 8 }}
              autoFocus
            />
            {error && <p style={{ fontSize: 13, color: '#C75050', marginBottom: 8, textAlign: 'center' }}>{error}</p>}

            <button onClick={handleJoin} disabled={code.length < 6 || busy}
              style={{ ...btn.primary, marginTop: 12, opacity: code.length >= 6 ? 1 : 0.4 }}>
              {busy ? 'Joining...' : 'Join Garden 🌿'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GARDEN SETTINGS MODAL
// ═══════════════════════════════════════════════════════════════
function GardenSettingsModal({ user, garden, onUpdated, onLeft, onClose }) {
  const [members, setMembers] = useState([]);
  const [name, setName] = useState(garden.name);
  const [busy, setBusy] = useState(false);
  const isOwner = garden.owner_id === user.id;

  useEffect(() => {
    db.getGardenMembers(garden.id).then(setMembers);
  }, [garden.id]);

  const handleRename = async () => {
    if (!name.trim() || name === garden.name) return;
    setBusy(true);
    try { await db.renameGarden(garden.id, name); onUpdated(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };

  const handleLeave = async () => {
    if (!confirm(`Leave "${garden.name}"? You won't see its content anymore.`)) return;
    setBusy(true);
    try { await db.leaveGarden(user.id, garden.id); onLeft(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(46,36,28,0.5)',
      backdropFilter: 'blur(6px)', zIndex: 250,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn 0.2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.bg, borderRadius: 24, padding: 28,
        width: '100%', maxWidth: 380, animation: 'scaleIn 0.3s ease',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 32 }}>{GARDEN_TYPES[garden.type].icon}</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: C.brown, marginTop: 8 }}>
            Garden Settings
          </h2>
        </div>

        {isOwner && garden.type !== 'solo' && (
          <>
            <label style={{ fontSize: 12, color: C.brownM, display: 'block', marginBottom: 6 }}>Garden name</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={handleRename} disabled={!name.trim() || name === garden.name || busy}
                style={{ ...btn.primary, width: 'auto', padding: '14px 20px', opacity: (name.trim() && name !== garden.name) ? 1 : 0.4 }}>
                Save
              </button>
            </div>
          </>
        )}

        <p style={{ fontSize: 12, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Members ({members.length})
        </p>
        <div style={{ marginBottom: 24 }}>
          {members.map(m => (
            <div key={m.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', background: C.warm, borderRadius: 12, marginBottom: 6,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.peach}, ${C.blush})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Playfair Display', serif", color: C.terraD, fontSize: 14, fontWeight: 600,
              }}>
                {m.profiles?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, color: C.brown, fontWeight: 500 }}>
                  {m.profiles?.display_name}
                  {m.user_id === user.id && <span style={{ fontSize: 11, color: C.brownM, marginLeft: 6 }}>(you)</span>}
                </p>
              </div>
              {m.role === 'owner' && (
                <span style={{ fontSize: 10, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Owner
                </span>
              )}
            </div>
          ))}
        </div>

        {garden.type !== 'solo' && garden.invite_code && (
          <div style={{
            background: C.warm, borderRadius: 14, padding: 16, marginBottom: 20,
            textAlign: 'center', border: `1px dashed ${C.terraL}`,
          }}>
            <p style={{ fontSize: 11, color: C.brownM, marginBottom: 6 }}>Invite code</p>
            <p style={{ fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 600, color: C.terra, letterSpacing: 4, marginBottom: 8 }}>
              {garden.invite_code}
            </p>
            <button onClick={() => navigator.share?.({ text: `Join my Bloom garden! Code: ${garden.invite_code}\n${window.location.origin}` }).catch(() => navigator.clipboard?.writeText(garden.invite_code))}
              style={{ ...btn.secondary, padding: '8px 18px', fontSize: 12, width: 'auto' }}>
              Share Code 📤
            </button>
          </div>
        )}

        {garden.type !== 'solo' && (
          <button onClick={handleLeave} disabled={busy} style={{
            width: '100%', background: 'transparent', border: `1px solid #C75050`,
            color: '#C75050', borderRadius: 12, padding: 12, fontSize: 13,
            cursor: 'pointer', fontFamily: "'Lora', serif",
          }}>
            Leave this garden
          </button>
        )}

        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.brownM,
          fontSize: 12, marginTop: 14, cursor: 'pointer',
          padding: 8, width: '100%', fontFamily: "'Lora', serif",
        }}>Close</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TODAY TAB
// ═══════════════════════════════════════════════════════════════
function TodayTab({ user, profile, garden, question, inspiration, stats, onCheckIn, onShowSettings }) {
  const [todayIns, setTodayIns] = useState([]);
  const [answer, setAnswer] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (garden?.id) db.getTodayCheckIns(garden.id).then(setTodayIns);
  }, [garden?.id, justDone]);

  const myCheckIn = todayIns.find(c => c.user_id === user.id);
  const otherCheckIns = todayIns.filter(c => c.user_id !== user.id);
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setBusy(true);
    try {
      await db.submitCheckIn(garden.id, user.id, question, answer.trim());
      setAnswer(''); setShowForm(false); setJustDone(true);
      onCheckIn();
      setTimeout(() => setJustDone(false), 3000);
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 11, color: C.sage, marginBottom: 1 }}>{greeting}</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 500, color: C.brown }}>
            {profile?.display_name}
          </h1>
        </div>
        <button onClick={onShowSettings} style={{
          background: C.warm, border: `1px solid ${C.bgDeep}`, borderRadius: 10,
          width: 36, height: 36, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.brownM} strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {stats.current_streak > 0 && (
        <div style={{ background: `${C.sageL}25`, borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🌱</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.brown }}>{stats.current_streak} day streak!</p>
            <p style={{ fontSize: 11, color: C.brownM }}>{stats.total_blooms} bloom{stats.total_blooms !== 1 ? 's' : ''} planted</p>
          </div>
        </div>
      )}

      {/* Inspiration */}
      <div style={{ background: C.warm, borderRadius: 18, padding: '24px 22px', marginBottom: 16, boxShadow: '0 2px 10px rgba(61,50,41,0.05)' }}>
        <p style={{ fontSize: 10, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Daily bloom</p>
        <p style={{ fontSize: 15, color: C.brown, lineHeight: 1.7, fontStyle: 'italic', fontFamily: "'Playfair Display', serif", marginBottom: 10 }}>
          "{inspiration.text}"
        </p>
        <p style={{ fontSize: 12, color: C.sage, fontWeight: 500 }}>— {inspiration.author}</p>
      </div>

      {/* Question CTA */}
      {!myCheckIn && !showForm && (
        <button onClick={() => setShowForm(true)} style={{
          width: '100%', background: `linear-gradient(135deg, ${C.terra}, ${C.terraD})`,
          border: 'none', borderRadius: 16, padding: '20px 22px', textAlign: 'left',
          marginBottom: 16, boxShadow: '0 4px 18px rgba(193,127,89,0.2)', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span>{question.icon}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today's question · {question.cat}</span>
          </div>
          <p style={{ fontSize: 15, color: '#fff', lineHeight: 1.5, fontFamily: "'Playfair Display', serif" }}>{question.q}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>Tap to answer →</p>
        </button>
      )}

      {/* Answer Form */}
      {showForm && (
        <div style={{ background: C.warm, borderRadius: 18, padding: 22, marginBottom: 16, animation: 'fadeUp 0.3s ease', boxShadow: '0 2px 10px rgba(61,50,41,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span>{question.icon}</span>
            <span style={{ fontSize: 10, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{question.cat}</span>
          </div>
          <p style={{ fontSize: 15, color: C.brown, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', lineHeight: 1.5, marginBottom: 14 }}>
            {question.q}
          </p>
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Share your thoughts..."
            rows={4} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, marginBottom: 12, fontSize: 14 }} autoFocus />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowForm(false)} style={{ ...btn.secondary, flex: 1 }}>Cancel</button>
            <button onClick={handleSubmit} disabled={!answer.trim() || busy}
              style={{ ...btn.primary, flex: 2, opacity: answer.trim() ? 1 : 0.4 }}>
              {busy ? 'Planting...' : 'Plant Bloom 🌸'}
            </button>
          </div>
        </div>
      )}

      {justDone && (
        <div style={{ background: `${C.peach}40`, borderRadius: 16, padding: '24px 22px', marginBottom: 16, textAlign: 'center', animation: 'scaleIn 0.4s ease' }}>
          <div style={{ fontSize: 36, marginBottom: 6, animation: 'gentleFloat 2s ease-in-out infinite' }}>🌸</div>
          <p style={{ fontSize: 15, fontFamily: "'Playfair Display', serif", color: C.brown, fontStyle: 'italic' }}>A new bloom in your garden!</p>
        </div>
      )}

      {myCheckIn && !justDone && garden.type === 'solo' && (
        <div style={{ background: `${C.sageL}18`, borderRadius: 16, padding: '18px 20px', marginBottom: 16, textAlign: 'center', border: `1px solid ${C.sageL}35` }}>
          <span style={{ fontSize: 24 }}>🌸</span>
          <p style={{ fontSize: 13, color: C.sageD, fontWeight: 500, margin: '6px 0 2px' }}>Today's bloom is planted!</p>
          <p style={{ fontSize: 11, color: C.brownM }}>Come back tomorrow for a new question</p>
        </div>
      )}

      {/* Show your answer + others' answers (for couple/group) */}
      {myCheckIn && (todayIns.length > 1 || garden.type === 'solo') && (
        <div style={{ marginTop: 4 }}>
          <p style={{ fontSize: 10, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Today's reflection{todayIns.length > 1 ? 's' : ''}
          </p>
          {todayIns.map((ci, i) => (
            <div key={ci.id} style={{ background: C.warm, borderRadius: 14, padding: '14px 16px', marginBottom: 10, borderLeft: `3px solid ${ci.user_id === user.id ? C.terra : C.sage}` }}>
              <p style={{ fontSize: 12, color: ci.user_id === user.id ? C.terra : C.sage, fontWeight: 600, marginBottom: 4 }}>
                {ci.profiles?.display_name || 'Anonymous'} {ci.user_id === user.id && '(you)'}
              </p>
              <p style={{ fontSize: 14, color: C.brown, lineHeight: 1.6 }}>{ci.answer}</p>
            </div>
          ))}
        </div>
      )}

      {/* Waiting for others (couple/group) */}
      {myCheckIn && garden.type !== 'solo' && otherCheckIns.length === 0 && (
        <div style={{ background: C.warm, borderRadius: 14, padding: '14px 18px', marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <p style={{ fontSize: 13, color: C.brownM }}>
            Waiting for others in your garden to answer...
          </p>
        </div>
      )}

      {/* Show invite code if garden has one */}
      {garden.invite_code && (
        <div style={{ background: C.warm, borderRadius: 16, padding: 16, textAlign: 'center', marginTop: 14, border: `1px dashed ${C.terraL}` }}>
          <p style={{ fontSize: 11, color: C.brownL, marginBottom: 6 }}>Invite code for this garden</p>
          <p style={{ fontSize: 24, fontFamily: "'Playfair Display', serif", fontWeight: 600, color: C.terra, letterSpacing: 5 }}>{garden.invite_code}</p>
          <button onClick={() => navigator.share?.({ text: `Join my Bloom garden! Code: ${garden.invite_code}\n${window.location.origin}` }).catch(() => navigator.clipboard?.writeText(garden.invite_code))}
            style={{ ...btn.secondary, marginTop: 10, width: 'auto', padding: '8px 18px', fontSize: 12 }}>Share Code 📤</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GARDEN VIEW TAB
// ═══════════════════════════════════════════════════════════════
function GardenTab({ gardenName, stats, gardenId }) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (gardenId) db.getRecentCheckIns(gardenId, 20).then(setHistory);
  }, [gardenId, stats.total_blooms]);

  const flowerColors = [C.terra, C.terraL, C.blush, C.peach, C.gold, C.sage, '#D4869C', '#E8A87C', '#C3A6D8', C.sageL, '#D4A574', '#E0C4A8'];
  const positions = [];
  for (let row = 0; row < 5; row++) {
    const count = row % 2 === 0 ? 4 : 3;
    const offset = row % 2 === 0 ? 40 : 80;
    for (let col = 0; col < count; col++) {
      positions.push({ x: offset + col * 85 + (Math.sin(row * col + 1) * 10), y: 130 + row * 55 + (Math.cos(col) * 8) });
    }
  }

  return (
    <div style={{ textAlign: 'center', paddingBottom: 20 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 500, color: C.brown, marginBottom: 4 }}>{gardenName}</h2>
      <p style={{ fontSize: 12, color: C.sage, marginBottom: 20 }}>{stats.total_blooms} bloom{stats.total_blooms !== 1 ? 's' : ''} planted</p>

      <div style={{
        width: '100%', maxWidth: 380, aspectRatio: '1/1.15', borderRadius: 22,
        background: `linear-gradient(180deg, #E2EDD8 0%, #C8DDB5 35%, #B0C49E 70%, #8B9E7E 100%)`,
        margin: '0 auto 22px', position: 'relative', overflow: 'hidden',
        boxShadow: 'inset 0 -16px 32px rgba(107,126,94,0.15)',
      }}>
        <div style={{ position: 'absolute', top: 16, right: 24, width: 36, height: 36, borderRadius: '50%', background: `radial-gradient(circle, ${C.gold}90, transparent)`, animation: 'gentleFloat 5s ease-in-out infinite' }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.gold, margin: '9px auto', opacity: 0.8 }} />
        </div>

        <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 380 440" fill="none">
          {positions.map((pos, i) => {
            const bloomed = i < stats.total_blooms;
            const color = flowerColors[i % flowerColors.length];
            const size = 10 + (i % 3) * 3;
            return (
              <g key={i} style={{ opacity: bloomed ? 1 : 0.12, transition: `opacity 0.6s ease ${i * 0.08}s` }}>
                <line x1={pos.x} y1={pos.y} x2={pos.x} y2={pos.y + size * 1.6} stroke={C.sageD} strokeWidth="1.5" opacity="0.4" />
                {[0, 72, 144, 216, 288].map((a, j) => (
                  <ellipse key={j}
                    cx={pos.x + Math.cos((a * Math.PI) / 180) * size * 0.38}
                    cy={pos.y + Math.sin((a * Math.PI) / 180) * size * 0.38 - 2}
                    rx={size * 0.28} ry={size * 0.16} fill={color} opacity="0.75"
                    transform={`rotate(${a},${pos.x + Math.cos((a * Math.PI) / 180) * size * 0.38},${pos.y + Math.sin((a * Math.PI) / 180) * size * 0.38 - 2})`}
                  />
                ))}
                <circle cx={pos.x} cy={pos.y - 2} r={size * 0.13} fill={C.gold} opacity="0.85" />
              </g>
            );
          })}
        </svg>

        {stats.total_blooms === 0 && (
          <div style={{ position: 'absolute', bottom: 70, left: 0, right: 0, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#5C6E4E', fontStyle: 'italic' }}>Your garden is waiting to bloom...</p>
            <p style={{ fontSize: 12, color: '#5C6E4E', opacity: 0.6 }}>Complete your first check-in to plant a flower</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {[
          { v: `${stats.current_streak}`, l: 'Streak', i: '🔥' },
          { v: `${stats.total_blooms}`, l: 'Blooms', i: '🌸' },
          { v: `${stats.longest_streak}`, l: 'Best', i: '🏆' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: C.warm, borderRadius: 14, padding: '14px 10px', boxShadow: '0 1px 6px rgba(61,50,41,0.04)' }}>
            <span style={{ fontSize: 18 }}>{s.i}</span>
            <p style={{ fontSize: 20, fontWeight: 600, color: C.brown, fontFamily: "'Playfair Display', serif", margin: '4px 0 2px' }}>{s.v}</p>
            <p style={{ fontSize: 9, color: C.brownM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.l}</p>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div style={{ marginTop: 22, textAlign: 'left' }}>
          <p style={{ fontSize: 10, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Recent reflections</p>
          {history.slice(0, 6).map((h, i) => (
            <div key={i} style={{ background: C.warm, borderRadius: 12, padding: '12px 14px', marginBottom: 8, borderLeft: `2px solid ${C.terraL}` }}>
              <p style={{ fontSize: 11, color: C.brownM, marginBottom: 4 }}>{h.profiles?.display_name} · {h.check_in_date}</p>
              <p style={{ fontSize: 13, color: C.brown, lineHeight: 1.5 }}>{h.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NOTES TAB
// ═══════════════════════════════════════════════════════════════
function NotesTab({ user, garden }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (garden?.id) {
      db.getNotes(garden.id).then(setNotes);
      const sub = db.subscribeToNotes(garden.id, () => db.getNotes(garden.id).then(setNotes));
      return () => supabase.removeChannel(sub);
    }
  }, [garden?.id]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await db.sendNote(garden.id, user.id, text.trim());
      setText(''); setSent(true);
      setTimeout(() => setSent(false), 2000);
      db.getNotes(garden.id).then(setNotes);
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  const placeholder = garden.type === 'solo'
    ? 'A note to yourself...'
    : `Write something for your garden...`;

  return (
    <div style={{ paddingBottom: 20 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 500, color: C.brown, marginBottom: 4 }}>
        {garden.type === 'solo' ? 'Notes to Self' : 'Love Notes'}
      </h2>
      <p style={{ fontSize: 12, color: C.brownM, marginBottom: 18 }}>
        {garden.type === 'solo' ? 'Letters to your future self' : 'Leave surprises for your garden'}
      </p>

      <div style={{ background: C.warm, borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: '0 2px 8px rgba(61,50,41,0.04)' }}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder}
          rows={3} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, fontSize: 14, marginBottom: 10 }} />
        <button onClick={send} disabled={!text.trim() || busy}
          style={{ ...btn.primary, opacity: text.trim() ? 1 : 0.4 }}>
          {busy ? 'Sending...' : 'Leave Note 💌'}
        </button>
      </div>

      {sent && (
        <div style={{ textAlign: 'center', padding: 14, animation: 'scaleIn 0.3s ease' }}>
          <span style={{ fontSize: 28 }}>💌</span>
          <p style={{ fontSize: 13, color: C.terra, fontStyle: 'italic' }}>Note delivered with love!</p>
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Previous notes</p>
          {notes.map(n => (
            <div key={n.id} style={{ background: C.warm, borderRadius: 12, padding: '12px 16px', marginBottom: 8, borderLeft: `3px solid ${n.from_user_id === user.id ? C.terra : C.sage}` }}>
              <p style={{ fontSize: 14, color: C.brown, lineHeight: 1.6, marginBottom: 4 }}>{n.content}</p>
              <p style={{ fontSize: 10, color: C.brownM, opacity: 0.6 }}>
                {n.profiles?.display_name || 'You'} · {new Date(n.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && !sent && (
        <div style={{ textAlign: 'center', padding: '36px 20px' }}>
          <span style={{ fontSize: 36, opacity: 0.3 }}>💌</span>
          <p style={{ fontSize: 13, color: C.brownM, fontStyle: 'italic', marginTop: 10 }}>No notes yet. Write the first one!</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MOMENTS TAB
// ═══════════════════════════════════════════════════════════════
function MomentsTab({ user, garden }) {
  const [moments, setMoments] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (garden?.id) db.getMoments(garden.id).then(setMoments);
  }, [garden?.id]);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await db.addMoment(garden.id, user.id, text.trim());
      setText('');
      db.getMoments(garden.id).then(setMoments);
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  return (
    <div style={{ paddingBottom: 20 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 500, color: C.brown, marginBottom: 4 }}>Moments</h2>
      <p style={{ fontSize: 12, color: C.brownM, marginBottom: 18 }}>
        {garden.type === 'solo' ? 'Your timeline of meaningful moments' : 'Your shared timeline'}
      </p>

      <div style={{ background: C.warm, borderRadius: 16, padding: 18, marginBottom: 22, boxShadow: '0 2px 8px rgba(61,50,41,0.04)' }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Capture a memory or milestone..."
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ ...inputStyle, fontSize: 14, marginBottom: 10 }} />
        <button onClick={add} disabled={!text.trim() || busy}
          style={{ ...btn.secondary, opacity: text.trim() ? 1 : 0.4 }}>Add to Timeline</button>
      </div>

      {moments.length > 0 ? (
        <div style={{ paddingLeft: 22, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 6, top: 4, bottom: 4, width: 2, background: `linear-gradient(180deg, ${C.terra}, ${C.sageL})`, borderRadius: 1, opacity: 0.25 }} />
          {moments.map((m, i) => (
            <div key={m.id} style={{ position: 'relative', marginBottom: 18, paddingLeft: 14 }}>
              <div style={{ position: 'absolute', left: -19, top: 5, width: 10, height: 10, borderRadius: '50%', background: i === 0 ? C.terra : C.terraL, border: `2px solid ${C.warm}` }} />
              <p style={{ fontSize: 14, color: C.brown, lineHeight: 1.5, marginBottom: 2 }}>{m.title}</p>
              <p style={{ fontSize: 10, color: C.brownM, opacity: 0.6 }}>
                {m.profiles?.display_name} · {m.moment_date}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '36px 20px' }}>
          <span style={{ fontSize: 36, opacity: 0.3 }}>📸</span>
          <p style={{ fontSize: 13, color: C.brownM, fontStyle: 'italic', marginTop: 10 }}>Start capturing moments</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BLOOM ICON
// ═══════════════════════════════════════════════════════════════
function BloomIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" stroke={C.terra} strokeWidth="1.5" fill="none" opacity="0.2" />
      <path d="M24 8C24 8 18 16 18 24C18 30 20.7 34 24 36C27.3 34 30 30 30 24C30 16 24 8 24 8Z" fill={C.sage} opacity="0.6" />
      <path d="M24 36V42" stroke={C.sageD} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 24C10 24 16 20 24 22C24 22 16 28 10 24Z" fill={C.sageL} opacity="0.5" />
      <path d="M38 22C38 22 32 18 24 20C24 20 32 26 38 22Z" fill={C.sageL} opacity="0.5" />
      <circle cx="24" cy="20" r="3" fill={C.terra} opacity="0.7" />
      <circle cx="24" cy="20" r="1.5" fill={C.gold} opacity="0.8" />
    </svg>
  );
}
