import { supabase } from './supabase.js';
import { todayDateStr } from './content.js';

// ─── INVITE CODES ────────────────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── PROFILE ────────────────────────────────────────────
export async function getMyProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

// ─── GARDENS ────────────────────────────────────────────
// Get all gardens the current user is a member of
export async function getMyGardens(userId) {
  const { data, error } = await supabase
    .from('garden_members')
    .select('garden_id, role, gardens(*)')
    .eq('user_id', userId);
  if (error) throw error;

  // Sort: solo first, then by created_at
  const gardens = (data || []).map(m => ({
    ...m.gardens,
    myRole: m.role,
  }));
  gardens.sort((a, b) => {
    if (a.type === 'solo' && b.type !== 'solo') return -1;
    if (b.type === 'solo' && a.type !== 'solo') return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });
  return gardens;
}

// Create a new garden (couple or group)
export async function createGarden(userId, name, type) {
  if (type === 'solo') throw new Error('Solo gardens are auto-created');

  const code = generateCode();
  const { data: garden, error } = await supabase
    .from('gardens')
    .insert({
      name: name.trim(),
      type,
      owner_id: userId,
      invite_code: code,
    })
    .select()
    .single();
  if (error) throw error;

  // Add creator as owner member
  const { error: memberErr } = await supabase
    .from('garden_members')
    .insert({ garden_id: garden.id, user_id: userId, role: 'owner' });
  if (memberErr) throw memberErr;

  // Initialize stats
  await supabase
    .from('garden_stats')
    .insert({ garden_id: garden.id });

  return garden;
}

// Join a garden via invite code
export async function joinGarden(userId, inviteCode) {
  const code = inviteCode.toUpperCase().trim();

  // Find garden by code
  const { data: garden, error: findErr } = await supabase
    .from('gardens')
    .select('*')
    .eq('invite_code', code)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!garden) throw new Error('Invalid invite code');

  // Couple gardens are limited to 2 members
  if (garden.type === 'couple') {
    const { data: members } = await supabase
      .from('garden_members')
      .select('user_id')
      .eq('garden_id', garden.id);
    if (members && members.length >= 2) {
      throw new Error('This couple garden already has two members');
    }
    if (members && members.some(m => m.user_id === userId)) {
      throw new Error('You\'re already in this garden');
    }
  } else {
    // Check not already a member
    const { data: existing } = await supabase
      .from('garden_members')
      .select('user_id')
      .eq('garden_id', garden.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) throw new Error('You\'re already in this garden');
  }

  // Add as member
  const { error: memberErr } = await supabase
    .from('garden_members')
    .insert({ garden_id: garden.id, user_id: userId, role: 'member' });
  if (memberErr) throw memberErr;

  // For couple gardens, nullify invite code after second person joins
  if (garden.type === 'couple') {
    await supabase
      .from('gardens')
      .update({ invite_code: null })
      .eq('id', garden.id);
  }

  return garden;
}

// Update garden name (owner only)
export async function renameGarden(gardenId, newName) {
  const { error } = await supabase
    .from('gardens')
    .update({ name: newName.trim() })
    .eq('id', gardenId);
  if (error) throw error;
}

// Leave a garden (delete own membership)
export async function leaveGarden(userId, gardenId) {
  const { error } = await supabase
    .from('garden_members')
    .delete()
    .eq('user_id', userId)
    .eq('garden_id', gardenId);
  if (error) throw error;
}

// Get all members of a garden (with profile info)
export async function getGardenMembers(gardenId) {
  const { data, error } = await supabase
    .from('garden_members')
    .select('*, profiles:user_id(id, display_name, email)')
    .eq('garden_id', gardenId)
    .order('joined_at');
  if (error) throw error;
  return data || [];
}

// ─── CHECK-INS ──────────────────────────────────────────
export async function submitCheckIn(gardenId, userId, question, answer) {
  const { data, error } = await supabase
    .from('check_ins')
    .insert({
      garden_id: gardenId,
      user_id: userId,
      question_text: question.q,
      category: question.cat,
      answer: answer,
      check_in_date: todayDateStr(),
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('You already checked in to this garden today!');
    throw error;
  }
  return data;
}

export async function getTodayCheckIns(gardenId) {
  const { data } = await supabase
    .from('check_ins')
    .select('*, profiles:user_id(display_name)')
    .eq('garden_id', gardenId)
    .eq('check_in_date', todayDateStr())
    .order('created_at');
  return data || [];
}

export async function getRecentCheckIns(gardenId, limit = 14) {
  const { data } = await supabase
    .from('check_ins')
    .select('*, profiles:user_id(display_name)')
    .eq('garden_id', gardenId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// ─── GARDEN STATS ───────────────────────────────────────
export async function getGardenStats(gardenId) {
  const { data } = await supabase
    .from('garden_stats')
    .select('*')
    .eq('garden_id', gardenId)
    .maybeSingle();
  return data || { current_streak: 0, longest_streak: 0, total_blooms: 0 };
}

// ─── NOTES ──────────────────────────────────────────────
export async function sendNote(gardenId, userId, content) {
  const { data, error } = await supabase
    .from('notes')
    .insert({ garden_id: gardenId, from_user_id: userId, content })
    .select('*, profiles:from_user_id(display_name)')
    .single();
  if (error) throw error;
  return data;
}

export async function getNotes(gardenId, limit = 30) {
  const { data } = await supabase
    .from('notes')
    .select('*, profiles:from_user_id(display_name)')
    .eq('garden_id', gardenId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function markNoteRead(noteId) {
  await supabase.from('notes').update({ is_read: true }).eq('id', noteId);
}

// ─── MOMENTS ────────────────────────────────────────────
export async function addMoment(gardenId, userId, title) {
  const { data, error } = await supabase
    .from('moments')
    .insert({
      garden_id: gardenId,
      created_by: userId,
      title,
      moment_date: todayDateStr(),
    })
    .select('*, profiles:created_by(display_name)')
    .single();
  if (error) throw error;
  return data;
}

export async function getMoments(gardenId, limit = 30) {
  const { data } = await supabase
    .from('moments')
    .select('*, profiles:created_by(display_name)')
    .eq('garden_id', gardenId)
    .order('moment_date', { ascending: false })
    .limit(limit);
  return data || [];
}

// ─── REALTIME ───────────────────────────────────────────
export function subscribeToCheckins(gardenId, callback) {
  return supabase
    .channel(`checkins-${gardenId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'check_ins',
      filter: `garden_id=eq.${gardenId}`,
    }, callback)
    .subscribe();
}

export function subscribeToNotes(gardenId, callback) {
  return supabase
    .channel(`notes-${gardenId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notes',
      filter: `garden_id=eq.${gardenId}`,
    }, callback)
    .subscribe();
}
