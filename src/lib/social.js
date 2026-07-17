import { supabase } from '@/api/supabase'

/* =========================================================================
   social — the connective tissue (migrations 0017 + 0023): follows +
   threads (DMs, event rooms, crews, plan rooms) + the circle (amigos) +
   plans. The Base44 chat REBUILT native — nothing here touches the
   legacy conversations/messages/chat_messages tables.

   DOCTRINE (0023): crews and plans are built FROM friendship — you bring
   YOUR people. Friend lists are PRIVATE (only participants see the bond);
   no public counts anywhere.

   DEGRADES HONESTLY pre-migration (the worldPosts doctrine): a missing
   table resolves reads to empty and surfaces a human sentence on writes —
   and socialReady()/circleReady() let surfaces render ABSENCE instead of
   dead doors (Leyes 9/11: a button that can't keep its promise doesn't
   render).
   ========================================================================= */

const MISSING = /follows|threads|thread_messages|thread_members|friendships|plan_members|plans|start_dm|join_event_chat|my_circle|my_plans|create_group_thread|create_plan|schema cache|does not exist|Could not find/i
const NOT_ON_YET = "connections aren't switched on yet — the platform update is on its way."

let readyProbe = null
/* Is the social layer live in the DB? A GET select limit(0) against
   follows answers without moving data. NOT head:true — supabase-js can't
   parse the error out of a body-less HEAD 404, which made a missing table
   read as "ready" (caught by the v4 local gate).
   Cache policy (review catch): only DEFINITIVE answers stick — table
   exists (true) or table missing (false, real pre-migration state). A
   transient failure (network drop, 5xx) answers false for THIS call but
   never poisons the whole session. */
export function socialReady() {
  if (!readyProbe) {
    readyProbe = supabase
      .from('follows')
      .select('follower_id')
      .limit(0)
      .then(({ error }) => {
        if (!error) return true
        const missing = error.code === 'PGRST205' || MISSING.test(error.message || '')
        if (!missing) readyProbe = null   // transient — let the next surface re-ask
        return false
      })
      .catch(() => { readyProbe = null; return false })
  }
  return readyProbe
}

let circleProbe = null
/* Is the circle layer (0023: friendships / crews / plans) live in the DB?
   Same probe pattern as socialReady(): a limit(0) select against
   friendships, and only DEFINITIVE answers stick — a transient failure
   answers false for THIS call but never poisons the session. */
export function circleReady() {
  if (!circleProbe) {
    circleProbe = supabase
      .from('friendships')
      .select('requester_id')
      .limit(0)
      .then(({ error }) => {
        if (!error) return true
        const missing = error.code === 'PGRST205' || MISSING.test(error.message || '')
        if (!missing) circleProbe = null   // transient — let the next surface re-ask
        return false
      })
      .catch(() => { circleProbe = null; return false })
  }
  return circleProbe
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
  let { error } = await supabase.from('follows').insert({ follower_id: viewerId, followee_id: profileId })
  if (error && error.code === '23503') {
    // the follower has no profiles row yet (it's born lazily on the first
    // /profile visit) — the FK refuses. ensure_own_profile() (0017) creates
    // the minimal row server-side; then the edge lands. Caught LIVE by the
    // first post-migration prod walkthrough.
    await supabase.rpc('ensure_own_profile')
    ;({ error } = await supabase.from('follows').insert({ follower_id: viewerId, followee_id: profileId }))
  }
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
   (for kind='event') resolved to a title. Kinds 'group' and 'plan' (0023)
   carry their title on the threads row itself — no extra join. The column
   list is probe-gated (threadCols): asking a pre-0023 DB for title/plan_id
   would error the WHOLE inbox, not just the new kinds. One honest empty
   on failure. */
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
      supabase.from('threads').select(await threadCols()).in('id', ids),
      supabase.from('thread_members').select('thread_id,profile_id').in('thread_id', ids),
    ])
    if (!threads?.length) return []

    // resolve faces + event titles (public reads)
    const otherIds = [...new Set((members || []).map((m) => m.profile_id).filter((id) => id !== meId))]
    const eventIds = [...new Set(threads.map((t) => t.event_id).filter(Boolean))]
    const [profRes, evRes, lastMsgs] = await Promise.all([
      otherIds.length
        // is_demo travels with the identity (guardrail 4) — every payload
        // that transports a profile transports the flag, no exception
        ? supabase.from('profiles').select('id,full_name,username,avatar_url,is_demo').in('id', otherIds)
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
      .map((t) => {
        const last = lastMsgs[t.id] || null
        return {
          ...t,
          others: membersByThread[t.id] || [],
          event: t.event_id ? evById[t.event_id] || null : null,
          lastMessage: last,
          // your own message is never "unread" (review catch)
          unread: !!(last && last.sender_id !== meId && lastRead[t.id] && new Date(last.created_at) > new Date(lastRead[t.id])),
        }
      })
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
  } catch { return [] }
}

/* threads columns, probe-gated: title + plan_id exist only once 0023 is
   live — selecting them earlier would fail the whole read (a missing
   COLUMN errors the query; there is no per-column grace). */
async function threadCols() {
  return (await circleReady())
    ? 'id,kind,event_id,title,plan_id,last_message_at,created_at'
    : 'id,kind,event_id,last_message_at,created_at'
}

/* newest message per thread (preview lines) — one limit(1) per thread so a
   busy event room can never starve a quiet DM's preview out of a shared
   window (review catch). Inboxes are small; capped at 50 lookups. */
async function fetchLastMessages(threadIds) {
  if (!threadIds.length) return {}
  const ids = threadIds.slice(0, 50)
  const rows = await Promise.all(ids.map((id) =>
    supabase
      .from('thread_messages')
      .select('thread_id,sender_id,body,created_at')
      .eq('thread_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => data?.[0] || null)
      .catch(() => null)
  ))
  const out = {}
  rows.forEach((m) => { if (m) out[m.thread_id] = m })
  return out
}

/* One thread, fully resolved: meta + roster + messages (oldest first).
   The window is the NEWEST 300, then re-ordered — an ascending limit
   would freeze a long room at its first 300 messages forever (review
   catch). */
export async function fetchThread(threadId, meId) {
  const [{ data: t }, { data: members }, { data: msgsDesc }] = await Promise.all([
    supabase.from('threads').select(await threadCols()).eq('id', threadId).maybeSingle(),
    supabase.from('thread_members').select('profile_id').eq('thread_id', threadId),
    supabase.from('thread_messages').select('id,thread_id,sender_id,body,created_at').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(300),
  ])
  if (!t) return null
  const msgs = (msgsDesc || []).slice().reverse()
  const ids = [...new Set((members || []).map((m) => m.profile_id))]
  const [profRes, evRes] = await Promise.all([
    // is_demo travels with the identity (guardrail 4)
    ids.length ? supabase.from('profiles').select('id,full_name,username,avatar_url,is_demo').in('id', ids) : Promise.resolve({ data: [] }),
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

/* ------------------------- the circle (0023) -------------------------
   Amigos — the mutual, PRIVATE bond. Every write below goes through a
   SECURITY DEFINER door; the client holds no insert grants. Envelope
   errors ({ok:false, error}) become human sentences here so surfaces
   never print a code. */

const ENVELOPE_HUMAN = {
  not_authenticated: 'sign in first.',
  bad_target: "that world isn't reachable.",
  not_found: "that world isn't reachable.",
  no_request: 'that request is gone — it may have been withdrawn.',
  not_your_friend: 'you can only bring your own amigos.',
  group_full: 'the crew is full — 24 is the room.',
  not_a_group: "this room isn't a crew.",
  not_member: "you're not in this room.",
  not_invited: "you're not on this plan.",
  not_yours: 'only the person who made the plan can cancel it.',
  creator_cancels: 'the plan is yours — cancel it instead of leaving.',
  not_signed_in: 'sign in first.',
  bad_visibility: 'pick public, friends, or close friends.',
  not_creator: 'only the person who made the plan can change who sees it.',
  no_event: "that event isn't reachable.",
}

/* one door-call: rpc → envelope checked → data (throws human sentences) */
async function callDoor(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    if (MISSING.test(error.message || '')) throw new Error(NOT_ON_YET)
    throw new Error(humanRpcError(error.message))
  }
  if (data && typeof data === 'object' && data.ok === false) {
    throw new Error(ENVELOPE_HUMAN[data.error] || data.error || 'something went wrong — try again.')
  }
  return data
}

/* the pairwise bond between me and ONE other world → 'none' | 'out'
   (my request waits on them) | 'in' (theirs waits on me) | 'friends'.
   RLS admits only participants, and the pair is unique (0023) — one row
   at most. null on error/pre-migration: the museum renders a door only
   when the state is KNOWN (Ley 9 — no dead promises). */
export async function fetchFriendState(meId, otherId) {
  if (!meId || !otherId || meId === otherId) return null
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('requester_id,addressee_id,status')
      .or(`and(requester_id.eq.${meId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${meId})`)
      .maybeSingle()
    if (error) return null
    if (!data) return 'none'
    if (data.status === 'accepted') return 'friends'
    if (data.status === 'pending') return data.requester_id === meId ? 'out' : 'in'
    return 'none'
  } catch { return null }
}

/* friends + requests waiting on me + requests I sent — one call, always
   shaped, empty on any failure (reads resolve to absence, never a crash). */
export async function myCircle() {
  const empty = { friends: [], pending_in: [], pending_out: [] }
  try {
    const { data, error } = await supabase.rpc('my_circle')
    if (error || !data?.ok) return empty
    return {
      friends: data.friends || [],
      pending_in: data.pending_in || [],
      pending_out: data.pending_out || [],
    }
  } catch { return empty }
}

/* ask — or complete a mutual ask (two reaches meet) → 'pending'|'accepted' */
export async function requestFriend(otherId) {
  const data = await callDoor('request_friend', { p_other: otherId })
  return data?.status
}

/* answer a request waiting on me → 'accepted'|'declined' */
export async function respondFriend(otherId, accept) {
  const data = await callDoor('respond_friend', { p_other: otherId, p_accept: !!accept })
  return data?.status
}

export async function removeFriend(otherId) {
  await callDoor('remove_friend', { p_other: otherId })
}

/* find people by name or @handle — the entry door to a friend request from
   your OWN surface, not just from their world (v9 D1: "buscar gente… desde
   una superficie propia"). RLS floors is_demo to founders (0033), so a
   normal member's search never surfaces seed; a founder's does — exactly
   the reach the launch test needs ("agrega a Diego"). Empty on any failure;
   never a crash. Special chars are stripped so a stray comma/paren can't
   break PostgREST's or() grammar or inject an ilike wildcard. */
export async function searchPeople(query, meId, limit = 16) {
  const clean = (query || '').replace(/[,()%_\\]/g, ' ').trim()
  if (clean.length < 2) return []
  try {
    const pattern = `%${clean}%`
    let sel = supabase
      .from('profiles')
      .select('id,full_name,username,avatar_url,verified,city,discipline,is_demo')
      .or(`full_name.ilike.${pattern},username.ilike.${pattern}`)
      .limit(limit)
    if (meId) sel = sel.neq('id', meId)
    const { data, error } = await sel
    if (error) return []
    // name first, then handle — a full_name hit is the stronger match
    const q = clean.toLowerCase()
    return (data || []).sort((a, b) => {
      const an = (a.full_name || '').toLowerCase().includes(q) ? 0 : 1
      const bn = (b.full_name || '').toLowerCase().includes(q) ? 0 : 1
      return an - bn
    })
  } catch { return [] }
}

/* --------------------- visibility tiers (D5) ---------------------
   PÚBLICO / AMIGOS / CLOSE FRIENDS — the Instagram Close Friends model, on
   event attendance AND plans. Default amigos. Close friends is a curated
   subset WITHIN your amigos (add_close_friend gates on are_friends). */
export const VIS_TIERS = ['public', 'friends', 'close']
export const VIS_LABEL = { public: 'Public', friends: 'Friends', close: 'Close friends' }

/* who can see you're going to this event → the chosen tier ('public'|'friends'|'close') */
export async function setAttendanceVisibility(eventId, tier) {
  const data = await callDoor('set_attendance_visibility', { p_event: eventId, p_tier: tier })
  return data?.visibility
}

/* creator opens/closes who can discover a plan → the chosen tier */
export async function setPlanVisibility(planId, tier) {
  const data = await callDoor('set_plan_visibility', { p_plan: planId, p_tier: tier })
  return data?.visibility
}

/* curate the close-friends list (must already be your amigo) */
export async function addCloseFriend(otherId) {
  await callDoor('add_close_friend', { p_other: otherId })
}
export async function removeCloseFriend(otherId) {
  await callDoor('remove_close_friend', { p_other: otherId })
}
export async function myCloseFriends() {
  try {
    const { data, error } = await supabase.rpc('my_close_friends')
    if (error || !data?.ok) return []
    return data.close || []
  } catch { return [] }
}

/* ------------------------------ crews ------------------------------ */

/* start a crew (kind='group' thread) with YOUR friends → thread id.
   The RPC returns the uuid bare (raises on bad title); strangers in
   memberIds are silently filtered server-side. Cap 24. */
export async function createCrew(title, memberIds = []) {
  const { data, error } = await supabase.rpc('create_group_thread', {
    p_title: (title || '').trim(),
    p_member_ids: memberIds,
  })
  if (error) {
    if (MISSING.test(error.message || '')) throw new Error(NOT_ON_YET)
    if (/bad_title/.test(error.message || '')) throw new Error('give the crew a name — up to 60 characters.')
    throw new Error(humanRpcError(error.message))
  }
  return data
}

export async function addCrewMember(threadId, otherId) {
  await callDoor('add_group_member', { p_thread: threadId, p_other: otherId })
}

/* walk out of a crew (groups only; an empty crew dissolves server-side) */
export async function leaveCrew(threadId) {
  await callDoor('leave_thread', { p_thread: threadId })
}

/* ------------------------------ plans ------------------------------ */

/* the kickback: what / where / when + your people. Born WITH its room —
   returns { plan_id, thread_id, invited }; non-friend invitees are
   silently skipped server-side and the honest count comes back. */
export async function createPlan({ title, spot, detail, startsAt, inviteeIds = [] }) {
  const p = { title: (title || '').trim() }
  if ((spot || '').trim()) p.spot = spot.trim()
  if ((detail || '').trim()) p.detail = detail.trim()
  if (startsAt) p.starts_at = startsAt
  if (inviteeIds.length) p.invitee_ids = inviteeIds
  const data = await callDoor('create_plan', { p })
  return { plan_id: data.plan_id, thread_id: data.thread_id, invited: data.invited }
}

/* in / out / maybe — the honest three → the status that landed */
export async function rsvpPlan(planId, status) {
  const data = await callDoor('rsvp_plan', { p_plan: planId, p_status: status })
  return data?.status
}

/* any member widens the circle — with THEIR friends only → honest count */
export async function invitePlan(planId, otherIds = []) {
  const data = await callDoor('invite_to_plan', { p_plan: planId, p_others: otherIds })
  return data?.invited ?? 0
}

/* creator only; the room survives the cancellation */
export async function cancelPlan(planId) {
  await callDoor('cancel_plan', { p_plan: planId })
}

/* an invitee walks (0026): removes the caller from the plan. The creator
   can't leave — they cancel instead ({ok:false,error:'creator_cancels'}). */
export async function leavePlan(planId) {
  await callDoor('leave_plan', { p_plan: planId })
}

/* every plan I'm part of, fully resolved (roster, counts, my_status,
   thread_id), live-first then by starts_at. Empty on any failure. */
export async function myPlans() {
  try {
    const { data, error } = await supabase.rpc('my_plans')
    if (error || !data?.ok) return []
    return data.plans || []
  } catch { return [] }
}
