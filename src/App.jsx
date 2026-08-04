import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase.js';
import { getTodayContent, GARDEN_TYPES, LANGUAGES } from './lib/content.js';
import { useT } from './lib/useT.js';
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

  const refreshProfile = async () => {
    if (!user) return;
    const p = await db.getMyProfile(user.id);
    setProfile(p);
    return p;
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
      onRefreshProfile={refreshProfile}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// SPLASH
// ═══════════════════════════════════════════════════════════════
function SplashScreen() {
  const browserLang = (typeof navigator !== 'undefined' ? (navigator.language || 'en').slice(0, 2) : 'en');
  const initialLang = ['en', 'de', 'es'].includes(browserLang) ? browserLang : 'en';
  const t = useT(initialLang);
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <div style={{ animation: 'gentleFloat 2s ease-in-out infinite' }}>
        <BloomIcon size={56} />
      </div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 400, color: C.brown, marginTop: 16, letterSpacing: '0.06em' }}>bloom</h1>
      <p style={{ fontSize: 13, color: C.brownM, fontStyle: 'italic', marginTop: 6 }}>{t.today.loading}</p>
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

  // Browser language detection — before user has a profile.
  const browserLang = (typeof navigator !== 'undefined' ? (navigator.language || 'en').slice(0, 2) : 'en');
  const initialLang = ['en', 'de', 'es'].includes(browserLang) ? browserLang : 'en';
  const t = useT(initialLang);

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
        {t.auth.welcomeTitle} <em style={{ color: C.terra }}>Bloom</em>
      </h1>
      <p style={{ fontSize: 14, color: C.brownL, textAlign: 'center', maxWidth: 320, marginBottom: 32, lineHeight: 1.6 }}>
        {t.auth.tagline}
      </p>

      {!mode && !sent && (
        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp 0.4s ease' }}>
          <button onClick={() => setMode('signup')} style={btn.primary}>{t.auth.createNewAccount}</button>
          <button onClick={() => setMode('login')} style={btn.secondary}>{t.auth.logIn}</button>
        </div>
      )}

      {mode === 'signup' && !sent && (
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 320, animation: 'fadeUp 0.4s ease' }}>
          <p style={{ fontSize: 13, color: C.terra, fontWeight: 600, textAlign: 'center', marginBottom: 18, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t.auth.createTitle}
          </p>
          <label style={{ fontSize: 12, color: C.brownM, display: 'block', marginBottom: 6 }}>{t.auth.yourName}</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t.auth.yourNamePlaceholder} style={{ ...inputStyle, marginBottom: 16 }} autoFocus />
          <label style={{ fontSize: 12, color: C.brownM, display: 'block', marginBottom: 6 }}>{t.auth.email}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.auth.emailPlaceholder} style={{ ...inputStyle, marginBottom: 8 }} />
          {error && <p style={{ fontSize: 13, color: '#C75050', marginBottom: 8 }}>{error}</p>}
          <p style={{ fontSize: 11, color: C.brownM, opacity: 0.6, marginBottom: 20 }}>{t.auth.magicLinkHintSignup}</p>
          <button type="submit" disabled={busy || !email || !name} style={{ ...btn.primary, opacity: email && name ? 1 : 0.4 }}>
            {busy ? t.auth.sending : t.auth.signUpButton}
          </button>
          <button type="button" onClick={reset} style={{ background: 'none', border: 'none', color: C.brownM, fontSize: 12, marginTop: 14, cursor: 'pointer', padding: 8, width: '100%' }}>{t.auth.backButton}</button>
        </form>
      )}

      {mode === 'login' && !sent && (
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 320, animation: 'fadeUp 0.4s ease' }}>
          <p style={{ fontSize: 13, color: C.terra, fontWeight: 600, textAlign: 'center', marginBottom: 18, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t.auth.welcomeBack}
          </p>
          <label style={{ fontSize: 12, color: C.brownM, display: 'block', marginBottom: 6 }}>{t.auth.email}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.auth.emailPlaceholder} style={{ ...inputStyle, marginBottom: 8 }} autoFocus />
          {error && <p style={{ fontSize: 13, color: '#C75050', marginBottom: 8 }}>{error}</p>}
          <p style={{ fontSize: 11, color: C.brownM, opacity: 0.6, marginBottom: 20 }}>{t.auth.magicLinkHint}</p>
          <button type="submit" disabled={busy || !email} style={{ ...btn.primary, opacity: email ? 1 : 0.4 }}>
            {busy ? t.auth.sending : t.auth.magicLinkButton}
          </button>
          <button type="button" onClick={reset} style={{ background: 'none', border: 'none', color: C.brownM, fontSize: 12, marginTop: 14, cursor: 'pointer', padding: 8, width: '100%' }}>{t.auth.backButton}</button>
        </form>
      )}

      {sent && (
        <div style={{ textAlign: 'center', maxWidth: 320, animation: 'scaleIn 0.4s ease' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.brown, marginBottom: 8 }}>{t.auth.magicLinkSent}</h2>
          <p style={{ fontSize: 14, color: C.brownL, lineHeight: 1.6 }}>
            {t.auth.magicLinkSentDesc} <strong>{email}</strong>.
          </p>
          <button onClick={reset} style={{ ...btn.secondary, marginTop: 20, width: 'auto', padding: '10px 20px' }}>{t.auth.useDifferentEmail}</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP — Garden switcher + tab content
// ═══════════════════════════════════════════════════════════════
function MainApp({ user, profile, gardens, activeGarden, onSwitchGarden, onRefreshGardens, onRefreshProfile }) {
  const [tab, setTab] = useState('today');
  const [stats, setStats] = useState({ current_streak: 0, longest_streak: 0, total_blooms: 0 });
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingCounts, setPendingCounts] = useState({});
  const [content, setContent] = useState({ question: null, inspiration: null });
  const language = profile?.language || 'en';
  const t = useT(language);

  // Fetch today's question + inspiration from Supabase whenever
  // the active garden or the user's language changes.
  useEffect(() => {
    if (!activeGarden?.type) return;
    let cancelled = false;
    getTodayContent(activeGarden.type, language).then(c => {
      if (!cancelled) setContent(c);
    });
    return () => { cancelled = true; };
  }, [activeGarden?.type, language]);

  const { question, inspiration } = content;

  useEffect(() => {
    if (activeGarden?.id) {
      db.getGardenStats(activeGarden.id).then(setStats);
      const sub = db.subscribeToCheckins(activeGarden.id, () => {
        db.getGardenStats(activeGarden.id).then(setStats);
      });
      return () => { supabase.removeChannel(sub); };
    }
  }, [activeGarden?.id]);

  // Poll pending request counts (and update via realtime)
  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => db.getMyPendingRequestCounts(user.id).then(setPendingCounts);
    refresh();
    const sub = db.subscribeToJoinRequests(user.id, refresh);
    return () => { supabase.removeChannel(sub); };
  }, [user?.id]);

  const pendingForActive = pendingCounts[activeGarden.id] || 0;

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
                {t.create[activeGarden.type] || meta.label}
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
            pendingRequests={pendingForActive} t={t}
            onCheckIn={() => db.getGardenStats(activeGarden.id).then(setStats)}
            onShowSettings={() => setShowSettings(true)} />
        )}
        {tab === 'garden' && <GardenTab user={user} gardenName={activeGarden.name} stats={stats} gardenId={activeGarden.id} t={t} />}
        {tab === 'notes' && <NotesTab user={user} garden={activeGarden} t={t} />}
        {tab === 'moments' && <MomentsTab user={user} garden={activeGarden} t={t} />}
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
          { id: 'today', label: t.tabs.today, icon: '☀️' },
          { id: 'garden', label: t.tabs.garden, icon: '🌱' },
          { id: 'notes', label: t.tabs.notes, icon: '💌' },
          { id: 'moments', label: t.tabs.goals, icon: '🏆' },
        ].map(tab_ => (
          <button key={tab_.id} onClick={() => setTab(tab_.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'none', border: 'none', padding: '6px 14px',
            color: tab === tab_.id ? C.terra : C.brownM,
            fontFamily: "'Lora', serif", fontSize: 10, gap: 2,
          }}>
            <span style={{ fontSize: 18 }}>{tab_.icon}</span>
            <span style={{ fontWeight: tab === tab_.id ? 600 : 400 }}>{tab_.label}</span>
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
          user={user}
          profile={profile}
          onRefreshProfile={onRefreshProfile}
          t={t}
        />
      )}

      {showCreate && (
        <CreateGardenModal
          user={user}
          t={t}
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
          t={t}
          onRefreshRequests={() => db.getMyPendingRequestCounts(user.id).then(setPendingCounts)}
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
function GardenSwitcher({ gardens, activeId, onSelect, onCreate, onClose, onSignOut, user, profile, onRefreshProfile, t }) {
  const currentLang = profile?.language || 'en';
  const [switching, setSwitching] = useState(false);
  const handleLangChange = async (code) => {
    if (code === currentLang || !user?.id || switching) return;
    setSwitching(true);
    try {
      await db.updateLanguage(user.id, code);
      if (onRefreshProfile) await onRefreshProfile();
    } catch (e) {
      console.error('Language update failed', e);
      alert(t.errors.couldNotChangeLanguage);
    }
    setSwitching(false);
  };
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
          {t.switcher.switchGarden}
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
                  <p style={{ fontSize: 11, color: C.brownM }}>{t.create[g.type] || meta.label}</p>
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
          {t.switcher.createNew}
        </button>

        {/* ─── Language switcher ─── */}
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 11, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, textAlign: 'center' }}>
            {t.switcher.language}
          </p>
          <div style={{ display: 'flex', gap: 6, background: C.warm, borderRadius: 12, padding: 4 }}>
            {LANGUAGES.map(lng => {
              const active = currentLang === lng.code;
              return (
                <button key={lng.code} onClick={() => handleLangChange(lng.code)} disabled={switching} style={{
                  flex: 1,
                  background: active ? C.bg : 'transparent',
                  border: active ? `1px solid ${C.terra}` : '1px solid transparent',
                  borderRadius: 10, padding: '10px 8px',
                  cursor: switching ? 'wait' : 'pointer',
                  fontFamily: "'Lora', serif", fontSize: 13,
                  color: active ? C.brown : C.brownM,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: switching && !active ? 0.5 : 1,
                }}>
                  <span style={{ fontSize: 16 }}>{lng.flag}</span>
                  <span>{lng.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button onClick={onSignOut} style={{
          background: 'none', border: 'none', color: C.brownM,
          fontSize: 12, marginTop: 16, cursor: 'pointer',
          padding: 10, width: '100%', fontFamily: "'Lora', serif",
        }}>
          {t.switcher.signOut}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CREATE GARDEN MODAL
// ═══════════════════════════════════════════════════════════════
function CreateGardenModal({ user, onCreated, onClose, t }) {
  const [step, setStep] = useState('choose'); // 'choose', 'create', 'join'
  const [type, setType] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [createdGarden, setCreatedGarden] = useState(null);
  const [requestSent, setRequestSent] = useState(null); // { gardenName }
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
      const { garden } = await db.requestToJoin(user.id, code);
      setRequestSent({ gardenName: garden.name });
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
              {t.create.title}
            </h2>
            <p style={{ fontSize: 13, color: C.brownM, textAlign: 'center', marginBottom: 24 }}>
              {t.create.subtitle}
            </p>

            <button onClick={() => { setStep('create'); setType('couple'); }} style={{
              width: '100%', background: C.warm, border: `1px solid ${C.bgDeep}`,
              borderRadius: 14, padding: 18, marginBottom: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              fontFamily: "'Lora', serif",
            }}>
              <span style={{ fontSize: 32 }}>💑</span>
              <div>
                <p style={{ fontSize: 15, color: C.brown, fontWeight: 600, marginBottom: 2 }}>{t.create.couple}</p>
                <p style={{ fontSize: 12, color: C.brownM }}>{t.create.coupleDesc}</p>
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
                <p style={{ fontSize: 15, color: C.brown, fontWeight: 600, marginBottom: 2 }}>{t.create.group}</p>
                <p style={{ fontSize: 12, color: C.brownM }}>{t.create.groupDesc}</p>
              </div>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 16px' }}>
              <div style={{ flex: 1, height: 1, background: C.bgDeep }} />
              <span style={{ fontSize: 11, color: C.brownM, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.common.or || 'or'}</span>
              <div style={{ flex: 1, height: 1, background: C.bgDeep }} />
            </div>

            <button onClick={() => setStep('join')} style={btn.secondary}>
              {t.create.joinWithCode}
            </button>

            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: C.brownM, fontSize: 12,
              marginTop: 14, cursor: 'pointer', padding: 8, width: '100%',
              fontFamily: "'Lora', serif",
            }}>{t.common.cancel}</button>
          </>
        )}

        {/* CREATE STEP */}
        {step === 'create' && !createdGarden && (
          <>
            <button onClick={() => setStep('choose')} style={{
              background: 'none', border: 'none', color: C.brownM,
              fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 16,
              fontFamily: "'Lora', serif",
            }}>{t.create.backButton}</button>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: C.brown, textAlign: 'center', marginBottom: 6 }}>
              {type === 'couple' ? t.create.nameCoupleGarden : t.create.nameGroupGarden}
            </h2>
            <p style={{ fontSize: 13, color: C.brownM, textAlign: 'center', marginBottom: 20 }}>
              {type === 'couple' ? t.create.hintCouple : t.create.hintGroup}
            </p>

            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder={type === 'couple' ? t.create.gardenNamePlaceholderCouple : t.create.gardenNamePlaceholderGroup}
              style={{ ...inputStyle, marginBottom: 16, textAlign: 'center', fontFamily: "'Playfair Display', serif", fontSize: 18 }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && name.trim() && handleCreate()}
            />
            {error && <p style={{ fontSize: 13, color: '#C75050', marginBottom: 8, textAlign: 'center' }}>{error}</p>}

            <button onClick={handleCreate} disabled={!name.trim() || busy}
              style={{ ...btn.primary, opacity: name.trim() ? 1 : 0.4 }}>
              {busy ? t.create.planting : t.create.plantButton}
            </button>
          </>
        )}

        {/* CREATED — SHOW INVITE CODE */}
        {createdGarden && (
          <>
            <div style={{ textAlign: 'center', animation: 'scaleIn 0.4s ease' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌸</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 500, color: C.brown, marginBottom: 8 }}>
                {t.create.plantedTitle}
              </h2>
              <p style={{ fontSize: 13, color: C.brownL, marginBottom: 20 }}>
                {type === 'couple' ? t.create.sharePartner : t.create.shareOthers}
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
                navigator.share?.({ text: t.fill(t.create.shareText, { code: createdGarden.invite_code, url: window.location.origin }) }).catch(() => {});
              }} style={{ ...btn.secondary, marginBottom: 10 }}>
                {t.create.shareCode}
              </button>
              <button onClick={onCreated} style={btn.primary}>
                {t.create.continueToGarden}
              </button>
            </div>
          </>
        )}

        {/* JOIN STEP — form */}
        {step === 'join' && !requestSent && (
          <>
            <button onClick={() => setStep('choose')} style={{
              background: 'none', border: 'none', color: C.brownM,
              fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 16,
              fontFamily: "'Lora', serif",
            }}>{t.create.backButton}</button>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: C.brown, textAlign: 'center', marginBottom: 6 }}>
              {t.create.joinTitle}
            </h2>
            <p style={{ fontSize: 13, color: C.brownM, textAlign: 'center', marginBottom: 20 }}>
              {t.create.joinSubtitle}
            </p>

            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder={t.create.inviteCodePlaceholder}
              maxLength={6}
              style={{ ...inputStyle, textAlign: 'center', fontSize: 22, letterSpacing: 6, fontFamily: "'Playfair Display', serif", marginBottom: 8 }}
              autoFocus
            />
            {error && <p style={{ fontSize: 13, color: '#C75050', marginBottom: 8, textAlign: 'center' }}>{error}</p>}

            <button onClick={handleJoin} disabled={code.length < 6 || busy}
              style={{ ...btn.primary, marginTop: 12, opacity: code.length >= 6 ? 1 : 0.4 }}>
              {busy ? t.create.sending : t.create.sendRequest}
            </button>
          </>
        )}

        {/* JOIN — REQUEST SENT success */}
        {requestSent && (
          <div style={{ textAlign: 'center', animation: 'scaleIn 0.4s ease' }}>
            <div style={{ fontSize: 48, marginBottom: 16, animation: 'gentleFloat 2s ease-in-out infinite' }}>📨</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: C.brown, marginBottom: 10 }}>
              {t.create.requestSentTitle}
            </h2>
            <p style={{ fontSize: 14, color: C.brownL, lineHeight: 1.6, marginBottom: 24, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
              {t.fill(t.create.requestSentDesc, { name: requestSent.gardenName })}
            </p>
            <button onClick={onClose} style={btn.primary}>
              {t.create.gotIt}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GARDEN SETTINGS MODAL
// ═══════════════════════════════════════════════════════════════
function GardenSettingsModal({ user, garden, onUpdated, onLeft, onRefreshRequests, onClose, t }) {
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [name, setName] = useState(garden.name);
  const [busy, setBusy] = useState(false);
  const isOwner = garden.owner_id === user.id;

  const reload = async () => {
    const m = await db.getGardenMembers(garden.id);
    setMembers(m);
    if (isOwner) {
      const r = await db.getPendingRequests(garden.id);
      setRequests(r);
    }
    onRefreshRequests?.();
  };

  useEffect(() => { reload(); }, [garden.id]);

  const handleRename = async () => {
    if (!name.trim() || name === garden.name) return;
    setBusy(true);
    try { await db.renameGarden(garden.id, name); onUpdated(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };

  const handleLeave = async () => {
    if (!confirm(t.fill(t.settings.leaveConfirm, { name: garden.name }))) return;
    setBusy(true);
    try { await db.leaveGarden(user.id, garden.id); onLeft(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };

  const handleApprove = async (requestId) => {
    setBusy(true);
    try { await db.approveRequest(requestId); await reload(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };

  const handleDeny = async (requestId) => {
    setBusy(true);
    try { await db.denyRequest(requestId); await reload(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!confirm(t.fill(t.settings.removeMemberConfirm, { name: memberName }))) return;
    setBusy(true);
    try { await db.removeMember(garden.id, memberId); await reload(); }
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
            {t.settings.title}
          </h2>
        </div>

        {isOwner && garden.type !== 'solo' && (
          <>
            <label style={{ fontSize: 12, color: C.brownM, display: 'block', marginBottom: 6 }}>{t.settings.gardenName}</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={handleRename} disabled={!name.trim() || name === garden.name || busy}
                style={{ ...btn.primary, width: 'auto', padding: '14px 20px', opacity: (name.trim() && name !== garden.name) ? 1 : 0.4 }}>
                {t.settings.save}
              </button>
            </div>
          </>
        )}

        {/* PENDING REQUESTS — owner only */}
        {isOwner && requests.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#E04848',
                animation: 'pulse 2s ease-in-out infinite',
              }} />
              <p style={{ fontSize: 12, color: '#C04040', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                {t.settings.pendingRequests} ({requests.length})
              </p>
            </div>
            <div style={{ marginBottom: 24 }}>
              {requests.map(r => (
                <div key={r.id} style={{
                  background: '#FFF4E8', borderRadius: 12, padding: 14, marginBottom: 8,
                  border: `1px solid ${C.terraL}40`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${C.peach}, ${C.blush})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Playfair Display', serif", color: C.terraD, fontSize: 15, fontWeight: 600,
                    }}>
                      {r.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, color: C.brown, fontWeight: 500 }}>
                        {r.profiles?.display_name}
                      </p>
                      <p style={{ fontSize: 11, color: C.brownM }}>{r.profiles?.email}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleDeny(r.id)} disabled={busy}
                      style={{
                        flex: 1, background: 'transparent', color: '#C75050',
                        border: `1px solid #C75050`, borderRadius: 10, padding: '8px 12px',
                        fontSize: 12, cursor: 'pointer', fontFamily: "'Lora', serif",
                      }}>
                      {t.settings.decline}
                    </button>
                    <button
                      onClick={() => handleApprove(r.id)} disabled={busy}
                      style={{
                        flex: 2, background: C.sage, color: '#fff',
                        border: 'none', borderRadius: 10, padding: '8px 12px',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'Lora', serif",
                      }}>
                      {t.settings.approve}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <p style={{ fontSize: 12, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          {t.settings.members} ({members.length})
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
                  {m.user_id === user.id && <span style={{ fontSize: 11, color: C.brownM, marginLeft: 6 }}>{t.settings.memberYou}</span>}
                </p>
              </div>
              {m.role === 'owner' && (
                <span style={{ fontSize: 10, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  {t.settings.memberOwner}
                </span>
              )}
              {/* Owner can remove other members (not themselves, not other owners) */}
              {isOwner && m.user_id !== user.id && m.role !== 'owner' && (
                <button
                  onClick={() => handleRemoveMember(m.user_id, m.profiles?.display_name)}
                  disabled={busy}
                  title={t.settings.removeMember}
                  style={{
                    background: 'transparent', border: 'none', color: '#C75050',
                    cursor: 'pointer', padding: 4, marginLeft: 4, lineHeight: 1,
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M6 18L18 6"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {garden.type !== 'solo' && garden.invite_code && (
          <div style={{
            background: C.warm, borderRadius: 14, padding: 16, marginBottom: 20,
            textAlign: 'center', border: `1px dashed ${C.terraL}`,
          }}>
            <p style={{ fontSize: 11, color: C.brownM, marginBottom: 6 }}>{t.settings.inviteCode}</p>
            <p style={{ fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 600, color: C.terra, letterSpacing: 4, marginBottom: 8 }}>
              {garden.invite_code}
            </p>
            <p style={{ fontSize: 10, color: C.brownM, marginBottom: 8, fontStyle: 'italic' }}>
              {t.settings.inviteCodeDesc}
            </p>
            <button onClick={() => navigator.share?.({ text: `${t.fill(t.today.shareText, { code: garden.invite_code })}\n${window.location.origin}` }).catch(() => navigator.clipboard?.writeText(garden.invite_code))}
              style={{ ...btn.secondary, padding: '8px 18px', fontSize: 12, width: 'auto' }}>
              {t.settings.shareCode}
            </button>
          </div>
        )}

        {garden.type !== 'solo' && (
          <button onClick={handleLeave} disabled={busy} style={{
            width: '100%', background: 'transparent', border: `1px solid #C75050`,
            color: '#C75050', borderRadius: 12, padding: 12, fontSize: 13,
            cursor: 'pointer', fontFamily: "'Lora', serif",
          }}>
            {t.settings.leaveGarden}
          </button>
        )}

        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.brownM,
          fontSize: 12, marginTop: 14, cursor: 'pointer',
          padding: 8, width: '100%', fontFamily: "'Lora', serif",
        }}>{t.settings.close}</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHECK-IN FLIP CARD — tap to flip between answer and question
// ═══════════════════════════════════════════════════════════════
function CheckInFlipCard({
  checkIn, isMine, showAuthor = true, compact = false,
  onUpdated, onDeleted,
  // Lifted state — controlled by parent so only one card is open at a time.
  isEditing = false, isConfirmingDelete = false,
  onOpenEdit, onOpenDelete, onCloseActions,
  t,
}) {
  const [flipped, setFlipped] = useState(false);
  const [editText, setEditText] = useState(checkIn.answer);
  const [busy, setBusy] = useState(false);
  const accentColor = isMine ? C.terra : C.sage;
  const padding = compact ? '12px 14px' : '14px 16px';
  const borderRadius = compact ? 12 : 14;
  const borderWidth = compact ? '2px' : '3px';

  // If parent forces edit off, keep local text in sync with the saved answer.
  useEffect(() => {
    if (!isEditing) setEditText(checkIn.answer);
  }, [isEditing, checkIn.answer]);

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === checkIn.answer) {
      onCloseActions && onCloseActions();
      return;
    }
    setBusy(true);
    try {
      const updated = await db.updateCheckIn(checkIn.id, trimmed);
      if (onUpdated) onUpdated(updated);
    } catch (e) {
      alert(t.errors.couldNotSaveChanges + e.message);
    }
    setBusy(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await db.deleteCheckIn(checkIn.id);
      if (onDeleted) onDeleted(checkIn.id);
    } catch (e) {
      alert(t.errors.couldNotDelete + e.message);
      setBusy(false);
    }
  };

  // Editing mode — no flip, just an inline editor
  if (isEditing) {
    return (
      <div style={{
        background: C.warm,
        borderRadius,
        padding,
        borderLeft: `${borderWidth} solid ${accentColor}`,
        marginBottom: compact ? 8 : 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: accentColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t.checkIn.editingLabel}
          </p>
        </div>
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          rows={3}
          autoFocus
          style={{
            ...inputStyle,
            fontSize: compact ? 13 : 14,
            resize: 'none',
            lineHeight: 1.6,
            marginBottom: 10,
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setEditText(checkIn.answer); onCloseActions && onCloseActions(); }}
            disabled={busy}
            style={{ ...btn.secondary, padding: '8px 14px', fontSize: 12, flex: 1 }}
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={busy || !editText.trim()}
            style={{ ...btn.primary, padding: '8px 14px', fontSize: 12, flex: 1, opacity: (busy || !editText.trim()) ? 0.5 : 1 }}
          >
            {busy ? t.checkIn.saving : t.checkIn.save}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={() => setFlipped(!flipped)}
        style={{
          position: 'relative',
          marginBottom: compact ? 8 : 10,
          cursor: 'pointer',
          perspective: '1000px',
          minHeight: compact ? 70 : 80,
        }}
      >
        <div style={{
          position: 'relative',
          width: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* FRONT — Answer side */}
          <div style={{
            background: C.warm,
            borderRadius,
            padding,
            borderLeft: `${borderWidth} solid ${accentColor}`,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            position: flipped ? 'absolute' : 'relative',
            width: '100%',
            top: 0, left: 0,
            boxSizing: 'border-box',
          }}>
            {showAuthor && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <p style={{ fontSize: 12, color: accentColor, fontWeight: 600 }}>
                  {checkIn.profiles?.display_name || t.checkIn.anonymous} {isMine && t.checkIn.you}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: C.brownM, opacity: 0.5, letterSpacing: '0.05em' }}>
                    {t.checkIn.tap}
                  </span>
                  {isMine && (
                    <EntryActionsMenu
                      t={t}
                      onEdit={() => onOpenEdit && onOpenEdit()}
                      onDelete={() => onOpenDelete && onOpenDelete()}
                    />
                  )}
                </div>
              </div>
            )}
            {!showAuthor && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <p style={{ fontSize: 11, color: C.brownM }}>
                  {checkIn.profiles?.display_name} · {checkIn.check_in_date}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: C.brownM, opacity: 0.5, letterSpacing: '0.05em' }}>
                    {t.checkIn.tap}
                  </span>
                  {isMine && (
                    <EntryActionsMenu
                      t={t}
                      onEdit={() => onOpenEdit && onOpenEdit()}
                      onDelete={() => onOpenDelete && onOpenDelete()}
                    />
                  )}
                </div>
              </div>
            )}
            <p style={{ fontSize: compact ? 13 : 14, color: C.brown, lineHeight: 1.6 }}>
              {checkIn.answer}
            </p>
          </div>

          {/* BACK — Question side */}
          <div style={{
            background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}08)`,
            borderRadius,
            padding,
            borderLeft: `${borderWidth} solid ${accentColor}`,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'absolute',
            width: '100%',
            top: 0, left: 0,
            boxSizing: 'border-box',
            minHeight: compact ? 70 : 80,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <p style={{
              fontSize: 10, color: accentColor, textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: 6, fontWeight: 600,
            }}>
              {t.checkIn.question} · {checkIn.category}
            </p>
            <p style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic',
              fontSize: compact ? 14 : 15,
              color: C.brown, lineHeight: 1.5,
            }}>
              {checkIn.question_text}
            </p>
          </div>
        </div>
      </div>

      {isConfirmingDelete && (
        <ConfirmDialog
          title={t.checkIn.deleteConfirm}
          message={t.checkIn.deleteMessage}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          onConfirm={handleDelete}
          onClose={() => !busy && onCloseActions && onCloseActions()}
          busy={busy}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// TODAY TAB
// ═══════════════════════════════════════════════════════════════
function TodayTab({ user, profile, garden, question, inspiration, stats, pendingRequests, onCheckIn, onShowSettings, t }) {
  const [todayIns, setTodayIns] = useState([]);
  const [answer, setAnswer] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [busy, setBusy] = useState(false);
  // Lift check-in edit/delete state: only one card open at a time.
  const [activeCardId, setActiveCardId] = useState(null);
  const [activeCardMode, setActiveCardMode] = useState(null); // 'edit' | 'delete' | null

  useEffect(() => {
    if (garden?.id) db.getTodayCheckIns(garden.id).then(setTodayIns);
  }, [garden?.id, justDone]);

  // Content still loading from Supabase — render a gentle placeholder
  if (!question || !inspiration) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.brownM, fontFamily: "'Lora', serif", fontSize: 13, opacity: 0.7,
      }}>
        {t.today.loading}
      </div>
    );
  }

  const myCheckIn = todayIns.find(c => c.user_id === user.id);
  const otherCheckIns = todayIns.filter(c => c.user_id !== user.id);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.today.goodMorning : hour < 17 ? t.today.goodAfternoon : t.today.goodEvening;

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
          alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.brownM} strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          {pendingRequests > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 10, height: 10, borderRadius: '50%',
              background: '#E04848',
              border: `2px solid ${C.warm}`,
              boxShadow: '0 0 0 0 rgba(224,72,72,0.4)',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
          )}
        </button>
      </div>

      {stats.current_streak > 0 && (
        <div style={{ background: `${C.sageL}25`, borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🌱</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.brown }}>
              {t.fill(stats.current_streak === 1 ? t.today.dayStreak : t.today.daysStreak, { n: stats.current_streak })}
            </p>
            <p style={{ fontSize: 11, color: C.brownM }}>
              {t.fill(stats.total_blooms === 1 ? t.today.bloomPlanted : t.today.bloomsPlanted, { n: stats.total_blooms })}
            </p>
          </div>
        </div>
      )}

      {/* Inspiration */}
      <div style={{ background: C.warm, borderRadius: 18, padding: '24px 22px', marginBottom: 16, boxShadow: '0 2px 10px rgba(61,50,41,0.05)' }}>
        <p style={{ fontSize: 10, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{t.today.dailyBloom}</p>
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
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.today.todaysQuestion} · {question.cat}</span>
          </div>
          <p style={{ fontSize: 15, color: '#fff', lineHeight: 1.5, fontFamily: "'Playfair Display', serif" }}>{question.q}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>{t.today.tapToAnswer}</p>
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
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder={t.today.placeholder}
            rows={4} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, marginBottom: 12, fontSize: 14 }} autoFocus />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowForm(false)} style={{ ...btn.secondary, flex: 1 }}>{t.common.cancel}</button>
            <button onClick={handleSubmit} disabled={!answer.trim() || busy}
              style={{ ...btn.primary, flex: 2, opacity: answer.trim() ? 1 : 0.4 }}>
              {busy ? t.today.planting : t.today.plantBloom}
            </button>
          </div>
        </div>
      )}

      {justDone && (
        <div style={{ background: `${C.peach}40`, borderRadius: 16, padding: '24px 22px', marginBottom: 16, textAlign: 'center', animation: 'scaleIn 0.4s ease' }}>
          <div style={{ fontSize: 36, marginBottom: 6, animation: 'gentleFloat 2s ease-in-out infinite' }}>🌸</div>
          <p style={{ fontSize: 15, fontFamily: "'Playfair Display', serif", color: C.brown, fontStyle: 'italic' }}>{t.today.newBloom}</p>
        </div>
      )}

      {myCheckIn && !justDone && garden.type === 'solo' && (
        <div style={{ background: `${C.sageL}18`, borderRadius: 16, padding: '18px 20px', marginBottom: 16, textAlign: 'center', border: `1px solid ${C.sageL}35` }}>
          <span style={{ fontSize: 24 }}>🌸</span>
          <p style={{ fontSize: 13, color: C.sageD, fontWeight: 500, margin: '6px 0 2px' }}>{t.today.yourBloom}</p>
          <p style={{ fontSize: 11, color: C.brownM }}>{t.today.comeBackTomorrow}</p>
        </div>
      )}

      {/* Show your answer + others' answers (for couple/group) */}
      {myCheckIn && (todayIns.length > 1 || garden.type === 'solo') && (
        <div style={{ marginTop: 4 }}>
          <p style={{ fontSize: 10, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            {todayIns.length > 1 ? t.today.todaysReflections : t.today.todaysReflection}
          </p>
          {todayIns.map((ci) => (
            <CheckInFlipCard
              key={ci.id}
              checkIn={ci}
              isMine={ci.user_id === user.id}
              showAuthor={true}
              t={t}
              isEditing={activeCardId === ci.id && activeCardMode === 'edit'}
              isConfirmingDelete={activeCardId === ci.id && activeCardMode === 'delete'}
              onOpenEdit={() => { setActiveCardId(ci.id); setActiveCardMode('edit'); }}
              onOpenDelete={() => { setActiveCardId(ci.id); setActiveCardMode('delete'); }}
              onCloseActions={() => { setActiveCardId(null); setActiveCardMode(null); }}
              onUpdated={(updated) => {
                setTodayIns(prev => prev.map(c => c.id === updated.id ? updated : c));
                setActiveCardId(null); setActiveCardMode(null);
              }}
              onDeleted={(id) => {
                setTodayIns(prev => prev.filter(c => c.id !== id));
                setActiveCardId(null); setActiveCardMode(null);
              }}
            />
          ))}
        </div>
      )}

      {/* Waiting for others (couple/group) */}
      {myCheckIn && garden.type !== 'solo' && otherCheckIns.length === 0 && (
        <div style={{ background: C.warm, borderRadius: 14, padding: '14px 18px', marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <p style={{ fontSize: 13, color: C.brownM }}>
            {t.today.waitingOthers}
          </p>
        </div>
      )}

      {/* Show invite code if garden has one */}
      {garden.invite_code && (
        <div style={{ background: C.warm, borderRadius: 16, padding: 16, textAlign: 'center', marginTop: 14, border: `1px dashed ${C.terraL}` }}>
          <p style={{ fontSize: 11, color: C.brownL, marginBottom: 6 }}>{t.today.inviteCodeLabel}</p>
          <p style={{ fontSize: 24, fontFamily: "'Playfair Display', serif", fontWeight: 600, color: C.terra, letterSpacing: 5 }}>{garden.invite_code}</p>
          <button onClick={() => navigator.share?.({ text: `${t.fill(t.today.shareText, { code: garden.invite_code })}\n${window.location.origin}` }).catch(() => navigator.clipboard?.writeText(garden.invite_code))}
            style={{ ...btn.secondary, marginTop: 10, width: 'auto', padding: '8px 18px', fontSize: 12 }}>{t.today.shareCode}</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GARDEN VIEW TAB
// ═══════════════════════════════════════════════════════════════
function GardenTab({ user, gardenName, stats, gardenId, t }) {
  const [history, setHistory] = useState([]);
  // Edit/delete state lifted from cards so only one is open at a time.
  const [activeCardId, setActiveCardId] = useState(null);
  const [activeCardMode, setActiveCardMode] = useState(null);

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
      <p style={{ fontSize: 12, color: C.sage, marginBottom: 20 }}>
        {t.fill(stats.total_blooms === 1 ? t.today.bloomPlanted : t.today.bloomsPlanted, { n: stats.total_blooms })}
      </p>

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
            <p style={{ fontSize: 14, color: '#5C6E4E', fontStyle: 'italic' }}>{t.today.emptyState}</p>
            <p style={{ fontSize: 12, color: '#5C6E4E', opacity: 0.6 }}>{t.today.completeFirst}</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {[
          { v: `${stats.current_streak}`, l: t.garden.streak, i: '🔥' },
          { v: `${stats.total_blooms}`, l: t.garden.blooms, i: '🌸' },
          { v: `${stats.longest_streak}`, l: t.garden.best, i: '🏆' },
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
          <p style={{ fontSize: 10, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{t.garden.recentReflections}</p>
          {history.slice(0, 6).map((h) => (
            <CheckInFlipCard
              key={h.id}
              checkIn={h}
              isMine={h.user_id === user?.id}
              showAuthor={false}
              compact={true}
              t={t}
              isEditing={activeCardId === h.id && activeCardMode === 'edit'}
              isConfirmingDelete={activeCardId === h.id && activeCardMode === 'delete'}
              onOpenEdit={() => { setActiveCardId(h.id); setActiveCardMode('edit'); }}
              onOpenDelete={() => { setActiveCardId(h.id); setActiveCardMode('delete'); }}
              onCloseActions={() => { setActiveCardId(null); setActiveCardMode(null); }}
              onUpdated={(updated) => {
                setHistory(prev => prev.map(c => c.id === updated.id ? updated : c));
                setActiveCardId(null); setActiveCardMode(null);
              }}
              onDeleted={(id) => {
                setHistory(prev => prev.filter(c => c.id !== id));
                setActiveCardId(null); setActiveCardMode(null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NOTES TAB
// ═══════════════════════════════════════════════════════════════
function NotesTab({ user, garden, t }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [deleteId, setDeleteId] = useState(null);

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

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditText(note.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const updated = await db.updateNote(editingId, trimmed);
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      setEditingId(null);
      setEditText('');
    } catch (e) { alert(t.errors.couldNotSave + e.message); }
    setBusy(false);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await db.deleteNote(deleteId);
      setNotes(prev => prev.filter(n => n.id !== deleteId));
      setDeleteId(null);
    } catch (e) {
      alert(t.errors.couldNotDelete + e.message);
    }
    setBusy(false);
  };

  const placeholder = garden.type === 'solo' ? t.notes.placeholderSolo : t.notes.placeholderShared;
  const title = garden.type === 'solo' ? t.notes.titleSolo : garden.type === 'group' ? t.notes.titleGroup : t.notes.titleShared;
  const subtitle = garden.type === 'solo' ? t.notes.subtitleSolo : t.notes.subtitleShared;

  return (
    <div style={{ paddingBottom: 20 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 500, color: C.brown, marginBottom: 4 }}>
        {title}
      </h2>
      <p style={{ fontSize: 12, color: C.brownM, marginBottom: 18 }}>
        {subtitle}
      </p>

      <div style={{ background: C.warm, borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: '0 2px 8px rgba(61,50,41,0.04)' }}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder}
          rows={3} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, fontSize: 14, marginBottom: 10 }} />
        <button onClick={send} disabled={!text.trim() || busy}
          style={{ ...btn.primary, opacity: text.trim() ? 1 : 0.4 }}>
          {busy && !editingId && !deleteId ? t.notes.sending : t.notes.button}
        </button>
      </div>

      {sent && (
        <div style={{ textAlign: 'center', padding: 14, animation: 'scaleIn 0.3s ease' }}>
          <span style={{ fontSize: 28 }}>💌</span>
          <p style={{ fontSize: 13, color: C.terra, fontStyle: 'italic' }}>{t.notes.delivered}</p>
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{t.notes.previous}</p>
          {notes.map(n => {
            const isMine = n.from_user_id === user.id;
            const accent = isMine ? C.terra : C.sage;

            // Edit mode for this note
            if (editingId === n.id) {
              return (
                <div key={n.id} style={{ background: C.warm, borderRadius: 12, padding: '12px 16px', marginBottom: 8, borderLeft: `3px solid ${accent}` }}>
                  <p style={{ fontSize: 10, color: accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    {t.notes.editingLabel}
                  </p>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    autoFocus
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, fontSize: 14, marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelEdit} disabled={busy}
                      style={{ ...btn.secondary, padding: '8px 14px', fontSize: 12, flex: 1 }}>
                      {t.common.cancel}
                    </button>
                    <button onClick={saveEdit} disabled={busy || !editText.trim()}
                      style={{ ...btn.primary, padding: '8px 14px', fontSize: 12, flex: 1, opacity: (busy || !editText.trim()) ? 0.5 : 1 }}>
                      {busy ? t.checkIn.saving : t.checkIn.save}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={n.id} style={{ background: C.warm, borderRadius: 12, padding: '12px 16px', marginBottom: 8, borderLeft: `3px solid ${accent}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ fontSize: 14, color: C.brown, lineHeight: 1.6, marginBottom: 4, flex: 1, paddingRight: 8 }}>
                    {n.content}
                  </p>
                  {isMine && (
                    <EntryActionsMenu
                      t={t}
                      onEdit={() => startEdit(n)}
                      onDelete={() => setDeleteId(n.id)}
                    />
                  )}
                </div>
                <p style={{ fontSize: 10, color: C.brownM, opacity: 0.6 }}>
                  {n.profiles?.display_name || t.notes.you} · {new Date(n.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {notes.length === 0 && !sent && (
        <div style={{ textAlign: 'center', padding: '36px 20px' }}>
          <span style={{ fontSize: 36, opacity: 0.3 }}>💌</span>
          <p style={{ fontSize: 13, color: C.brownM, fontStyle: 'italic', marginTop: 10 }}>{t.notes.empty}</p>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          title={t.notes.deleteConfirm}
          message={t.notes.deleteMessage}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          onConfirm={confirmDelete}
          onClose={() => !busy && setDeleteId(null)}
          busy={busy}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MOMENTS TAB
// ═══════════════════════════════════════════════════════════════
function MomentsTab({ user, garden, t }) {
  const [moments, setMoments] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [deleteId, setDeleteId] = useState(null);

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

  const startEdit = (moment) => {
    setEditingId(moment.id);
    setEditText(moment.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const updated = await db.updateMoment(editingId, trimmed);
      setMoments(prev => prev.map(m => m.id === updated.id ? updated : m));
      setEditingId(null);
      setEditText('');
    } catch (e) { alert(t.errors.couldNotSave + e.message); }
    setBusy(false);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await db.deleteMoment(deleteId);
      setMoments(prev => prev.filter(m => m.id !== deleteId));
      setDeleteId(null);
    } catch (e) {
      alert(t.errors.couldNotDelete + e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{ paddingBottom: 20 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 500, color: C.brown, marginBottom: 4 }}>{t.goals.title}</h2>
      <p style={{ fontSize: 12, color: C.brownM, marginBottom: 18 }}>
        {garden.type === 'solo' ? t.goals.subtitleSolo : t.goals.subtitleShared}
      </p>

      <div style={{ background: C.warm, borderRadius: 16, padding: 18, marginBottom: 22, boxShadow: '0 2px 8px rgba(61,50,41,0.04)' }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={t.goals.placeholder}
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ ...inputStyle, fontSize: 14, marginBottom: 10 }} />
        <button onClick={add} disabled={!text.trim() || busy}
          style={{ ...btn.secondary, opacity: text.trim() ? 1 : 0.4 }}>{t.goals.button}</button>
      </div>

      {moments.length > 0 ? (
        <div style={{ paddingLeft: 22, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 6, top: 4, bottom: 4, width: 2, background: `linear-gradient(180deg, ${C.terra}, ${C.sageL})`, borderRadius: 1, opacity: 0.25 }} />
          {moments.map((m, i) => {
            const isMine = m.created_by === user.id;

            // Edit mode for this moment
            if (editingId === m.id) {
              return (
                <div key={m.id} style={{ position: 'relative', marginBottom: 18, paddingLeft: 14 }}>
                  <div style={{ position: 'absolute', left: -19, top: 5, width: 10, height: 10, borderRadius: '50%', background: i === 0 ? C.terra : C.terraL, border: `2px solid ${C.warm}` }} />
                  <input
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    autoFocus
                    style={{ ...inputStyle, fontSize: 14, marginBottom: 8, padding: '10px 12px' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelEdit} disabled={busy}
                      style={{ ...btn.secondary, padding: '6px 12px', fontSize: 12, flex: 1 }}>
                      {t.common.cancel}
                    </button>
                    <button onClick={saveEdit} disabled={busy || !editText.trim()}
                      style={{ ...btn.primary, padding: '6px 12px', fontSize: 12, flex: 1, opacity: (busy || !editText.trim()) ? 0.5 : 1 }}>
                      {busy ? t.checkIn.saving : t.checkIn.save}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} style={{ position: 'relative', marginBottom: 18, paddingLeft: 14 }}>
                <div style={{ position: 'absolute', left: -19, top: 5, width: 10, height: 10, borderRadius: '50%', background: i === 0 ? C.terra : C.terraL, border: `2px solid ${C.warm}` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <p style={{ fontSize: 14, color: C.brown, lineHeight: 1.5, marginBottom: 2, flex: 1 }}>{m.title}</p>
                  {isMine && (
                    <EntryActionsMenu
                      t={t}
                      onEdit={() => startEdit(m)}
                      onDelete={() => setDeleteId(m.id)}
                    />
                  )}
                </div>
                <p style={{ fontSize: 10, color: C.brownM, opacity: 0.6 }}>
                  {m.profiles?.display_name} · {m.moment_date}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '36px 20px' }}>
          <span style={{ fontSize: 36, opacity: 0.3 }}>🏆</span>
          <p style={{ fontSize: 13, color: C.brownM, fontStyle: 'italic', marginTop: 10 }}>{t.goals.empty}</p>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          title={t.goals.deleteConfirm}
          message={t.goals.deleteMessage}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          onConfirm={confirmDelete}
          onClose={() => !busy && setDeleteId(null)}
          busy={busy}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTRY ACTIONS MENU — the (i) icon + Edit / Delete popup
// ═══════════════════════════════════════════════════════════════
function EntryActionsMenu({ onEdit, onDelete, t }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = () => setOpen(false);
    // Delay attaching so the current click doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [open]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-label="Entry options"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: C.brownM,
          opacity: 0.55,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.55'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(46,36,28,0.15), 0 2px 6px rgba(46,36,28,0.08)',
            border: `1px solid ${C.bgDeep}`,
            minWidth: 130,
            zIndex: 50,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
            style={{
              width: '100%', padding: '10px 14px',
              background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', fontSize: 13, color: C.brown,
              fontFamily: "'Lora', serif", textAlign: 'left',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.bgDeep}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {t?.common?.edit || 'Edit'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            style={{
              width: '100%', padding: '10px 14px',
              background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', fontSize: 13, color: '#B4483B',
              fontFamily: "'Lora', serif", textAlign: 'left',
              borderTop: `1px solid ${C.bgDeep}`,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f0'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            {t?.common?.delete || 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONFIRM DIALOG — "Are you sure?" modal for destructive actions
// ═══════════════════════════════════════════════════════════════
function ConfirmDialog({ title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, onClose, busy }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(46,36,28,0.5)',
      backdropFilter: 'blur(4px)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn 0.2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.warm, borderRadius: 18,
        padding: 24, maxWidth: 360, width: '100%',
        boxShadow: '0 20px 60px rgba(46,36,28,0.25)',
        animation: 'scaleIn 0.25s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <h3 style={{
          fontFamily: "'Playfair Display', serif", fontSize: 18,
          fontWeight: 500, color: C.brown, marginBottom: 8,
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: 14, color: C.brownM, lineHeight: 1.5,
          marginBottom: 20, fontFamily: "'Lora', serif",
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              ...btn.secondary,
              flex: 1,
              opacity: busy ? 0.5 : 1,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1,
              background: '#B4483B',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: '12px 20px',
              fontSize: 14,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: "'Lora', serif",
              opacity: busy ? 0.6 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(180,72,59,0.2)',
            }}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
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
