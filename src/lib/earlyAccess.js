import { supabase } from '@/api/supabase'

/* =========================================================================
   LA PUERTA — the early-access gate, client side.

   READ THIS FIRST: none of this is the gate. The real gate is the Supabase
   `before_user_created` hook in migration 0046. The anon key ships inside
   this bundle, so anyone can POST /auth/v1/signup with curl and skip every
   line of React below. This module exists to make the door BEAUTIFUL and to
   fail early with a good message — not to enforce.

   Consequence: everything here FAILS OPEN. If the RPC is missing (the
   migration hasn't been pushed), or Supabase is unreachable, or the call
   times out, we report "gate off" and let the normal signup through. A
   decorative lock that jams is pure downside: it cannot stop a bot, and it
   CAN strand a real person the founders invited. The hook is what says no.
   ========================================================================= */

export const GATE_FLAG = 'invite_gate'

/* Is the gate on right now? Read at runtime from app_flags, never from a
   VITE_ var — the flag has to move without a rebuild, so the founders can
   open or close the door from a phone in the middle of a launch night. */
const GATE_TIMEOUT_MS = 2000

export async function fetchGateEnabled() {
  try {
    // A STALLED CONNECTION NEVER REJECTS. The Supabase client is built with no
    // timeout (src/api/supabase.js), so `await rpc(...)` on flaky mobile data
    // can hang indefinitely — and the caller is holding the whole /auth screen
    // on it. Without this race, a member on bad signal gets a blank page where
    // sign-in and password recovery used to be. Losing the race means "open",
    // which is the same answer every other failure gives.
    const result = await Promise.race([
      supabase.rpc('gate_status'),
      new Promise(resolve => setTimeout(() => resolve({ data: null, error: 'timeout' }), GATE_TIMEOUT_MS)),
    ])
    if (result?.error) return false               // missing RPC / timeout → open
    return Boolean(result?.data?.invite_gate)
  } catch {
    return false                                  // network/unknown → open
  }
}

/* Codes are read aloud, screenshotted, and typed with thumbs. Normalize
   hard: strip everything that isn't alphanumeric, uppercase, re-hyphenate
   to C4-XXXX-XXXX. So "c4 a1b2 c3d4", "C4A1B2C3D4" and "c4-a1b2-c3d4" are
   all the same code. */
export function normalizeCode(raw) {
  const clean = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  // Only strip a leading C4 when what remains is a full 8-char body. The mint
  // alphabet contains both C and 4, so C4-C4XY-ZZZZ is a real mintable code —
  // stripping blindly would eat the body's own "C4" and reject a valid code
  // for the ~1/961 of holders whose body happens to start that way.
  const body = (clean.startsWith('C4') && clean.length !== 8) ? clean.slice(2) : clean
  const a = body.slice(0, 4)
  const b = body.slice(4, 8)
  if (!a) return clean.startsWith('C4') ? 'C4-' : ''
  return b ? `C4-${a}-${b}` : `C4-${a}`
}

export const isCodeComplete = (code) => /^C4-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code || '')

/* Pre-flight so we never ask for a password behind a code that will be
   rejected anyway. Returns {valid} only — the RPC deliberately reveals
   nothing else. Fails OPEN for the same reason as above: a check that
   can't reach the server must not become the thing that blocks a real
   invitee. The hook still refuses at commit time if the code is bad. */
export async function checkInviteCode(code) {
  const c = normalizeCode(code)
  if (!isCodeComplete(c)) return { valid: false, checked: true }
  try {
    const { data, error } = await supabase.rpc('check_invite_code', { p_code: c })
    if (error) return { valid: true, checked: false }   // couldn't verify → let the hook decide
    return { valid: Boolean(data?.valid), checked: true }
  } catch {
    return { valid: true, checked: false }
  }
}

/* The code travels to the hook inside raw_user_meta_data.

   ONLY AuthContext.signUp uses this. The app's OTHER signup path —
   AuthModal.jsx — hand-builds its own options.data and does NOT call this;
   it is covered differently, by refusing to sign up at all when the gate is
   on and sending the visitor to /auth instead (AuthModal.jsx). Do not delete
   that redirect on the assumption this helper covers the modal. It does not. */
export function withInviteCode(extra, code) {
  const c = normalizeCode(code)
  return isCodeComplete(c) ? { ...extra, invite_code: c } : { ...extra }
}

/* The hook's rejection messages, in the house's voice. Never blame the
   person: they were probably invited and mistyped one character. */
export function humanizeGateError(e) {
  const m = String(e?.message || e || '').toLowerCase()
  if (m.includes('invite_required')) return 'This door needs an invitation code.'
  if (m.includes('invite_invalid')) return "That code isn't open anymore. Check it, or ask whoever invited you for a new one."
  return ''
}
