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
export async function getMyGardens(userId) {
  const { data, error } = await supabase
    .from('garden_members')
    .select('garden_id, role, gardens(*)')
    .eq('user_id', userId);
  if (error) throw error;

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

  const { error: memberErr } = await supabase
    .from('garden_members')
    .insert({ garden_id: garden.id, user_id: userId, role: 'owner' });
  if (memberErr) throw memberErr;

  await supabase
    .from('garden_stats')
    .insert({ garden_id: garden.id });

  return garden;
}

// ─── JOIN REQUEST FLOW (NEW in v3) ─────────────────────
// Request to join — does NOT auto-add; requires owner approval
export async function requestToJoin(userId, inviteCode) {
  const code = inviteCode.toUpperCase().trim();

  const { data: garden, error: findErr } = await supabase
    .from('gardens')
    .select('*')
    .eq('invite_code', code)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!garden) throw new Error('Invalid invite code');

  const { data: existingMember } = await supabase
    .from('garden_members')
    .select('user_id')
    .eq('garden_id', garden.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (existingMember) throw new Error("You're already in this garden");

  if (garden.type === 'couple') {
    const { data: members } = await supabase
      .from('garden_members')
      .select('user_id')
      .eq('garden_id', garden.id);
    if (members && members.length >= 2) {
      throw new Error('This couple garden is already full');
    }
  }

  const { data: existingRequest } = await supabase
    .from('join_requests')
    .select('*')
    .eq('garden_id', garden.id)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existingRequest) {
    throw new Error('You already have a pending request for this garden');
  }

  const { data: request, error: reqErr } = await supabase
    .from('join_requests')
    .insert({ garden_id: garden.id, user_id: userId, status: 'pending' })
    .select('*, gardens(name, type)')
    .single();
  if (reqErr) throw reqErr;

  return { request, garden };
}

export async function getPendingRequests(gardenId) {
  const { data, error } = await supabase
    .from('join_requests')
    .select('*, profiles:user_id(id, display_name, email)')
    .eq('garden_id', gardenId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Pending requests across ALL gardens user owns (for badge counter)
export async function getMyPendingRequestCounts(userId) {
  const { data: ownedGardens } = await supabase
    .from('gardens')
    .select('id')
    .eq('owner_id', userId);

  if (!ownedGardens || ownedGardens.length === 0) return {};

  const gardenIds = ownedGardens.map(g => g.id);
  const { data: requests } = await supabase
    .from('join_requests')
    .select('garden_id')
    .in('garden_id', gardenIds)
    .eq('status', 'pending');

  const counts = {};
  (requests || []).forEach(r => {
    counts[r.garden_id] = (counts[r.garden_id] || 0) + 1;
  });
  return counts;
}

export async function approveRequest(requestId) {
  const { data: request, error: getErr } = await supabase
    .from('join_requests')
    .select('*, gardens(type)')
    .eq('id', requestId)
    .single();
  if (getErr) throw getErr;

  const { error: updateErr } = await supabase
    .from('join_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', requestId);
  if (updateErr) throw updateErr;

  const { error: memberErr } = await supabase
    .from('garden_members')
    .insert({
      garden_id: request.garden_id,
      user_id: request.user_id,
      role: 'member',
    });
  if (memberErr && memberErr.code !== '23505') throw memberErr;

  if (request.gardens?.type === 'couple') {
    const { data: members } = await supabase
      .from('garden_members')
      .select('user_id')
      .eq('garden_id', request.garden_id);
    if (members && members.length >= 2) {
      await supabase
        .from('gardens')
        .update({ invite_code: null })
        .eq('id', request.garden_id);
    }
  }
}

export async function denyRequest(requestId) {
  const { error } = await supabase
    .from('join_requests')
    .update({ status: 'denied', resolved_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

// ─── MEMBER MANAGEMENT ─────────────────────────────────
export async function renameGarden(gardenId, newName) {
  const { error } = await supabase
    .from('gardens')
    .update({ name: newName.trim() })
    .eq('id', gardenId);
  if (error) throw error;
}

export async function leaveGarden(userId, gardenId) {
  const { error } = await supabase
    .from('garden_members')
    .delete()
    .eq('user_id', userId)
    .eq('garden_id', gardenId);
  if (error) throw error;
}

export async function removeMember(gardenId, userIdToRemove) {
  const { error } = await supabase
    .from('garden_members')
    .delete()
    .eq('garden_id', gardenId)
    .eq('user_id', userIdToRemove);
  if (error) throw error;
}

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

export async function updateCheckIn(checkInId, newAnswer) {
  const { data, error } = await supabase
    .from('check_ins')
    .update({ answer: newAnswer })
    .eq('id', checkInId)
    .select('*, profiles:user_id(display_name)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCheckIn(checkInId) {
  const { error } = await supabase
    .from('check_ins')
    .delete()
    .eq('id', checkInId);
  if (error) throw error;
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

export async function updateNote(noteId, newContent) {
  const { data, error } = await supabase
    .from('notes')
    .update({ content: newContent })
    .eq('id', noteId)
    .select('*, profiles:from_user_id(display_name)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(noteId) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);
  if (error) throw error;
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

export async function updateMoment(momentId, newTitle) {
  const { data, error } = await supabase
    .from('moments')
    .update({ title: newTitle })
    .eq('id', momentId)
    .select('*, profiles:created_by(display_name)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMoment(momentId) {
  const { error } = await supabase
    .from('moments')
    .delete()
    .eq('id', momentId);
  if (error) throw error;
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

export function subscribeToJoinRequests(userId, callback) {
  return supabase
    .channel(`join-requests-${userId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'join_requests',
    }, callback)
    .subscribe();
}
