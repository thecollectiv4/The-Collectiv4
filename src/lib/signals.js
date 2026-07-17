import { supabase } from '@/api/supabase'

/* =========================================================================
   LAS CAMPANAS (v10 · D2) — the client side of the notification stream.
   One table, three doors (0042): my_signals / signals_unread_count /
   mark_signals_read. Same envelope convention as social.js: {ok:false}
   becomes a thrown sentence; a missing schema (pre-migration build) means
   the bell surfaces simply don't render (Ley 11 — no dead promises).
   Email rides the SAME rows later (email_sent_at is the Resend cursor) —
   nothing here changes when the domain lands.
   ========================================================================= */

const MISSING = /(could not find|does not exist|schema cache)/i
const NOT_ON_YET = "the bells aren't wired on this build yet."

async function door(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    if (MISSING.test(error.message || '')) throw new Error(NOT_ON_YET)
    throw new Error(error.message)
  }
  if (data && typeof data === 'object' && data.ok === false) {
    throw new Error(data.error || 'something went wrong')
  }
  return data
}

/* the badge's cheap poll — 0 on any failure: a badge never invents */
export async function signalsUnread() {
  try {
    const d = await door('signals_unread_count', {})
    return d?.count || 0
  } catch { return 0 }
}

/* the inbox read — unread first, then newest; empty shape on failure */
export async function fetchSignals(limit = 24) {
  try {
    const d = await door('my_signals', { p_limit: limit })
    return { unread: d?.unread || 0, signals: Array.isArray(d?.signals) ? d.signals : [] }
  } catch { return { unread: 0, signals: [] } }
}

/* mark read — ids for one bell, null for the whole inbox. Announces the
   change so the Layout badge corrects itself without a round trip.
   Returns null on failure (not 0) so callers can roll their optimistic
   flip back to server truth — the honest-rollback doctrine (Ley 11). */
export async function markSignalsRead(ids = null) {
  try {
    const d = await door('mark_signals_read', { p_ids: ids })
    announceSignalsChange()
    return d?.marked ?? 0
  } catch { return null }
}

/* reading the room IS reading the bell (0043) — called beside
   markThreadRead so the badge tells the truth after the normal flow.
   Fire-and-forget: a miss here self-heals on the next inbox fetch. */
export async function markThreadSignalsRead(threadId) {
  if (!threadId) return
  try {
    const d = await door('mark_thread_signals_read', { p_thread: threadId })
    if (d?.marked > 0) announceSignalsChange()
  } catch { /* pre-migration or offline — the stream simply stays as-is */ }
}

/* one shared wire: any surface that changes the stream announces it,
   any surface that displays it listens */
export const SIGNALS_EVENT = 'c4-signals-change'
export function announceSignalsChange() {
  try { window.dispatchEvent(new Event(SIGNALS_EVENT)) } catch { /* SSR/tests */ }
}

/* the voice — lowercase, quiet. A bell doesn't shout (anti-corny law). */
export function signalLine(s) {
  const t = s?.subject || {}
  switch (s?.kind) {
    case 'friend_request': return 'asked to join your circle'
    case 'friend_accept':  return "accepted — you're in each other's circle"
    case 'plan_invite':    return t.title ? `invited you — ${t.title}` : 'invited you to a plan'
    case 'plan_rsvp':      return t.title ? `answered ${t.status || ''} — ${t.title}`.replace('  ', ' ') : 'answered your plan'
    case 'message':        return t.preview || 'sent a message'
    case 'ticket_sale':    return t.title ? `a ticket sold — ${t.title}` : 'a ticket sold'
    case 'offer_sale':     return 'your offer sold'
    case 'match_new':      return 'a new match in your city'
    default:               return 'something moved'
  }
}

/* every bell keeps its promise: the row opens the surface it names (Ley 9) */
export function signalTo(s) {
  const t = s?.subject || {}
  switch (s?.kind) {
    case 'friend_request': return '/messages?seg=crews'
    case 'friend_accept':  return s?.actor?.id ? '/user/' + s.actor.id : '/messages?seg=crews'
    case 'plan_invite':
    case 'plan_rsvp':      return '/messages?seg=plans'
    case 'message':        return t.thread_id ? '/messages/' + t.thread_id : '/messages'
    case 'ticket_sale':    return t.slug ? '/e/' + t.slug : '/'
    default:               return '/messages'
  }
}
