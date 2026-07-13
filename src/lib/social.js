import { supabase } from '@/api/supabase'

/* =========================================================================
   social — the connective tissue (migration 0017): follows + threads
   (DMs and event rooms). The Base44 chat REBUILT native — nothing here
   touches the legacy conversations/messages/chat_messages tables.

   DEGRADES HONESTLY pre-migration (the worldPosts doctrine): a missing
   table resolves reads to empty and surfaces a human sentence on writes —
   and socialReady() lets surfaces render ABSENCE instead of dead doors
   (Leyes 9/11: a button that can't keep its promise doesn't render).
   ========================================================================= */

const MISSING = /follows|threads|thread_messages|thread_members|start_dm|join_event_chat|schema cache|does not exist|Could not find/i
const NOT_ON_YET = "connections aren't switched on yet — the platform update is on its way."

let readyProbe = null
/* One probe per session: is the social layer live in the DB? A select
   limit(0) against follows answers without moving data. Cached — surfaces
   may call it freely. */
export function socialReady() {
  if (!readyProbe) {
    readyProbe = supabase
      .from('follows')
      .select('follower_id', { head: true, count: 'exact' })
      .limit(0)
      .then(({ error }) => !error)
      .catch(() => false)
  }
  return readyProbe
}

/* ------------------------------ follows ------------------------------ */

/* Follow state + honest public counts for one profile. */
export async function fetchFollowState(profileId, viewerId) {
  const empty = { followers: 0, following: 0, iFollow: false }
  if (!profileId) return empty
  try {
    const [fers, fing, mine] = await Promise.all([
      supabase.from('follows').select('follower_id', { head: true, count: 'exact' }).eq('followee_id', profileId),
      supabase.from('follows').select('followee_id', { head: true, count: 'exact' }).eq('follower_id', profileId),
      viewerId && viewerId !== profileId
        ? supabase.from('follows').select('follower_id').eq('follower_id', viewerId).eq('followee_id', profileId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    if (fers.error || fing.error) return empty
    return { followers: fers.count || 0, following: fing.count || 0, iFollow: !!mine.data }
  } catch { return empty }
}

export async function follow(viewerId, profileId) {
  const { error } = await supabase.from('follows').insert({ follower_id: viewerId, followee_id: profileId })
  if (error && error.code !== '23505') {   // already following = already true
    if (MISSING.test(error.message || '')) throw new Error(NOT_ON_YET)
    throw new Error(error.message || "couldn't follow")
  }
}

export async function unfollow(viewerId, profileId) {
  const { error } = await supabase.from('follows').delete().eq('follower_id', viewerId).eq('followee_id', profileId)
  if (error) throw new Error(error.message || "couldn't unfollow")
}

/* Which of these profiles does the viewer follow? → Set of ids (for
   Community cards). Empty set on any failure — never a crash. */
export async function fetchFollowingSet(viewerId, profileIds = []) {
  if (!viewerId || !profileIds.length) return new Set()
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', viewerId)
      .in('followee_id', profileIds)
    if (error) return new Set()
    return new Set((data || []).map((r) => r.followee_id))
  } catch { return new Set() }
}

/* ------------------------------ threads ------------------------------ */

/* Open (or create) the DM with another member → thread id. */
export async function startDM(otherProfileId) {
  const { data, error } = await supabase.rpc('start_dm', { p_other: otherProfileId })
  if (error) {
    if (MISSING.test(error.message || '')) throw new Error(NOT_ON_YET)
    throw new Error(humanRpcError(error.message))
  }
  return data
}

/* Enter an event's room (ticket holders / host / founders) → thread id. */
export async function joinEventChat(eventId) {
  const { data, error } = await supabase.rpc('join_event_chat', { p_event: eventId })
  if (error) {
    if (MISSING.test(error.message || '')) throw new Error(NOT_ON_YET)
    if (/not_in/.test(error.message || '')) throw new Error('the room chat is for ticket holders — get yours to enter.')
    throw new Error(humanRpcError(error.message))
  }
  return data
}

function humanRpcError(msg = '') {
  if (/not_signed_in/.test(msg)) return 'sign in first.'
  if (/bad_target|not_found/.test(msg)) return "that world isn't reachable."
  return msg || 'something went wrong — try again.'
}

/* The inbox: every thread the member belongs to, newest movement first,
   with the other members resolved to names/faces and the thread's event
   (for kind='event') resolved to a title. One honest empty on failure. */
export async function fetchInbox(meId) {
  if (!meId) return []
  try {
    const { data: mine, error } = await supabase
      .from('thread_members')
      .select('thread_id,last_read_at')
      .eq('profile_id', meId)
    if (error || !mine?.length) return []
    const ids = mine.map((m) => m.thread_id)
    const lastRead = Object.fromEntries(mine.map((m) => [m.thread_id, m.last_read_at]))

    const [{ data: threads }, { data: members }] = await Promise.all([
      supabase.from('threads').select('id,kind,event_id,last_message_at,created_at').in('id', ids),
      supabase.from('thread_members').select('thread_id,profile_id').in('thread_id', ids),
    ])
    if (!threads?.length) return []

    // resolve faces + event titles (public reads)
    const otherIds = [...new Set((members || []).map((m) => m.profile_id).filter((id) => id !== meId))]
    const eventIds = [...new Set(threads.map((t) => t.event_id).filter(Boolean))]
    const [profRes, evRes, lastMsgs] = await Promise.all([
      otherIds.length
        ? supabase.from('profiles').select('id,full_name,username,avatar_url').in('id', otherIds)
        : Promise.resolve({ data: [] }),
      eventIds.length
        ? supabase.from('events').select('id,title,edition,event_date').in('id', eventIds)
        : Promise.resolve({ data: [] }),
      fetchLastMessages(ids),
    ])
    const profById = Object.fromEntries((profRes.data || []).map((p) => [p.id, p]))
    const evById = Object.fromEntries((evRes.data || []).map((e) => [e.id, e]))
    const membersByThread = {}
    ;(members || []).forEach((m) => {
      if (m.profile_id === meId) return
      ;(membersByThread[m.thread_id] ||= []).push(profById[m.profile_id] || { id: m.profile_id })
    })

    return threads
      .map((t) => ({
        ...t,
        others: membersByThread[t.id] || [],
        event: t.event_id ? evById[t.event_id] || null : null,
        lastMessage: lastMsgs[t.id] || null,
        unread: !!(lastMsgs[t.id] && lastRead[t.id] && new Date(lastMsgs[t.id].created_at) > new Date(lastRead[t.id])),
      }))
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
  } catch { return [] }
}

/* newest message per thread (preview lines) — one query, newest first,
   first-seen wins per thread. */
async function fetchLastMessages(threadIds) {
  if (!threadIds.length) return {}
  const { data } = await supabase
    .from('thread_messages')
    .select('thread_id,sender_id,body,created_at')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false })
    .limit(Math.min(200, threadIds.length * 8))
  const out = {}
  ;(data || []).forEach((m) => { if (!out[m.thread_id]) out[m.thread_id] = m })
  return out
}

/* One thread, fully resolved: meta + roster + messages (oldest first). */
export async function fetchThread(threadId, meId) {
  const [{ data: t }, { data: members }, { data: msgs }] = await Promise.all([
    supabase.from('threads').select('id,kind,event_id,last_message_at').eq('id', threadId).maybeSingle(),
    supabase.from('thread_members').select('profile_id').eq('thread_id', threadId),
    supabase.from('thread_messages').select('id,thread_id,sender_id,body,created_at').eq('thread_id', threadId).order('created_at', { ascending: true }).limit(300),
  ])
  if (!t) return null
  const ids = [...new Set((members || []).map((m) => m.profile_id))]
  const [profRes, evRes] = await Promise.all([
    ids.length ? supabase.from('profiles').select('id,full_name,username,avatar_url').in('id', ids) : Promise.resolve({ data: [] }),
    t.event_id ? supabase.from('events').select('id,title,edition,event_date,slug').eq('id', t.event_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const profiles = Object.fromEntries((profRes.data || []).map((p) => [p.id, p]))
  return {
    ...t,
    event: evRes.data || null,
    members: ids.map((id) => profiles[id] || { id }),
    others: ids.filter((id) => id !== meId).map((id) => profiles[id] || { id }),
    messages: msgs || [],
  }
}

export async function sendMessage(threadId, meId, body) {
  const text = (body || '').trim()
  if (!text) return null
  const { data, error } = await supabase
    .from('thread_messages')
    .insert({ thread_id: threadId, sender_id: meId, body: text })
    .select('id,thread_id,sender_id,body,created_at')
    .single()
  if (error) {
    if (MISSING.test(error.message || '')) throw new Error(NOT_ON_YET)
    throw new Error(error.message || "couldn't send — try again")
  }
  return data
}

/* mark the thread read for me (fire-and-forget; failures are silent). */
export function markThreadRead(threadId, meId) {
  supabase
    .from('thread_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('profile_id', meId)
    .then(() => {})
    .catch(() => {})
}

/* live messages for an open thread. Returns unsubscribe. RLS gates the
   stream server-side — non-members receive nothing. */
export function subscribeThread(threadId, onMessage) {
  const channel = supabase
    .channel(`thread:${threadId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'thread_messages', filter: `thread_id=eq.${threadId}` },
      (payload) => onMessage(payload.new))
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

export const msgTime = (iso) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) } catch { return '' }
}
