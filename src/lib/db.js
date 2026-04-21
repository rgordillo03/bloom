import { supabase } from './supabase.js';
import { todayDateStr } from './content.js';

// ─── INVITE CODES ────────────────────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── COUPLE MANAGEMENT ──────────────────────────────────────
export async function createCouple(userId) {
  const code = generateCode();
  const { data: couple, error: coupleErr } = await supabase
    .from('couples')
    .insert({ invite_code: code, partner1_id: userId })
    .select()
    .single();
  if (coupleErr) throw coupleErr;

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ couple_id: couple.id })
    .eq('id', userId);
  if (profileErr) throw profileErr;

  return couple;
}

export async function joinCouple(userId, inviteCode) {
  // Find couple by code
  const { data: couple, error: findErr } = await supabase
    .from('couples')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase().trim())
    .single();
  if (findErr || !couple) throw new Error('Invalid invite code');
  if (couple.partner2_id) throw new Error('This garden already has two partners');
  if (couple.partner1_id === userId) throw new Error('You cannot join your own garden');

  // Link partner2
  const { error: coupleErr } = await supabase
    .from('couples')
    .update({ partner2_id: userId, invite_code: null }) // nullify code after use
    .eq('id', couple.id);
  if (coupleErr) throw coupleErr;

  // Update profile
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ couple_id: couple.id })
    .eq('id', userId);
  if (profileErr) throw profileErr;

  return couple;
}

export async function getMyCouple(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('couple_id')
    .eq('id', userId)
    .single();
  if (!profile?.couple_id) return null;

  const { data: couple } = await supabase
    .from('couples')
    .select('*')
    .eq('id', profile.couple_id)
    .single();
  return couple;
}

export async function getPartnerProfile(userId, coupleId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('couple_id', coupleId)
    .neq('id', userId);
  return data?.[0] || null;
}

export async function getMyProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export async function updateDisplayName(userId, name) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', userId);
  if (error) throw error;
}

// ─── CHECK-INS ──────────────────────────────────────────────
export async function submitCheckIn(coupleId, userId, question, answer) {
  const { data, error } = await supabase
    .from('check_ins')
    .insert({
      couple_id: coupleId,
      user_id: userId,
      question_text: question.q,
      category: question.cat,
      answer: answer,
      check_in_date: todayDateStr(),
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('You already checked in today!');
    throw error;
  }
  return data;
}

export async function getTodayCheckIns(coupleId) {
  const { data } = await supabase
    .from('check_ins')
    .select('*, profiles:user_id(display_name)')
    .eq('couple_id', coupleId)
    .eq('check_in_date', todayDateStr())
    .order('created_at');
  return data || [];
}

export async function getRecentCheckIns(coupleId, limit = 14) {
  const { data } = await supabase
    .from('check_ins')
    .select('*, profiles:user_id(display_name)')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// ─── GARDEN STATS ───────────────────────────────────────────
export async function getGardenStats(coupleId) {
  const { data } = await supabase
    .from('garden_stats')
    .select('*')
    .eq('couple_id', coupleId)
    .single();
  return data || { current_streak: 0, longest_streak: 0, total_blooms: 0 };
}

// ─── NOTES ──────────────────────────────────────────────────
export async function sendNote(coupleId, userId, content) {
  const { data, error } = await supabase
    .from('notes')
    .insert({ couple_id: coupleId, from_user_id: userId, content })
    .select('*, profiles:from_user_id(display_name)')
    .single();
  if (error) throw error;
  return data;
}

export async function getNotes(coupleId, limit = 20) {
  const { data } = await supabase
    .from('notes')
    .select('*, profiles:from_user_id(display_name)')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function markNoteRead(noteId) {
  await supabase.from('notes').update({ is_read: true }).eq('id', noteId);
}

// ─── MOMENTS ────────────────────────────────────────────────
export async function addMoment(coupleId, userId, title) {
  const { data, error } = await supabase
    .from('moments')
    .insert({
      couple_id: coupleId,
      created_by: userId,
      title,
      moment_date: todayDateStr(),
    })
    .select('*, profiles:created_by(display_name)')
    .single();
  if (error) throw error;
  return data;
}

export async function getMoments(coupleId, limit = 30) {
  const { data } = await supabase
    .from('moments')
    .select('*, profiles:created_by(display_name)')
    .eq('couple_id', coupleId)
    .order('moment_date', { ascending: false })
    .limit(limit);
  return data || [];
}

// ─── REALTIME ───────────────────────────────────────────────
export function subscribeToCheckins(coupleId, callback) {
  return supabase
    .channel(`checkins-${coupleId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'check_ins',
      filter: `couple_id=eq.${coupleId}`,
    }, callback)
    .subscribe();
}

export function subscribeToNotes(coupleId, callback) {
  return supabase
    .channel(`notes-${coupleId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notes',
      filter: `couple_id=eq.${coupleId}`,
    }, callback)
    .subscribe();
}
