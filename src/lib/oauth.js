import { supabase } from '@/api/supabase'

/* =========================================================================
   oauth.js — CONTINUE WITH APPLE / GOOGLE, AND THE TRUTH WHEN THEY'RE OFF.

   READ THIS BEFORE CHANGING A LINE. Both providers are switched OFF on the
   live project today. Measured, not remembered — GET /auth/v1/settings on
   tpjbyxbsgtiwqcxcpwyn, 21 jul 2026:

       {"external":{"apple":false,"google":false,…,"email":true}, …}

   That is not a reason to hide the buttons. It is the reason this file exists.

   ── WHAT supabase-js ACTUALLY DOES ──────────────────────────────────────
   Checked against the copy in node_modules (@supabase/auth-js 2.105.3,
   GoTrueClient#_handleProviderSignIn):

       const url = await this._getUrlForProvider(`${this.url}/authorize`, …)
       if (isBrowser() && !options.skipBrowserRedirect) window.location.assign(url)
       return { data: { provider, url }, error: null }

   It BUILDS the url locally and navigates. It never touches the server, so it
   can never return an error — `error` is the literal `null` above. Every
   "handle the signInWithOAuth error" recipe on the internet is checking a
   value that is always null. The refusal happens AFTER the browser has
   already left our app.

   And the refusal is not a polite bounce back with ?error= either. Measured
   against the live project the same day:

       GET /auth/v1/authorize?provider=apple
       → 400  {"code":400,"error_code":"validation_failed",
               "msg":"Unsupported provider: provider is not enabled"}

   So a member who taps "Continue with Apple" today lands on a white page of
   raw JSON on supabase.co — no header, no back button, no way home, and the
   last thing they see before deciding whether this platform is real. That is
   the failure this module exists to prevent.

   ── HOW WE PREVENT IT: WE LOOK BEFORE WE LEAP ───────────────────────────
     1. ask supabase-js to BUILD the url without navigating (skipBrowserRedirect)
     2. fetch that exact url once, ourselves, with redirect:'manual'
     3. a 400 whose message matches /provider.*not enabled/i → a calm sentence,
        and we never navigate. A 3xx → hand the browser over.

     The happy path in step 3 calls signInWithOAuth AGAIN, this time WITHOUT
     skipBrowserRedirect, so the navigation is supabase-js's own code doing
     supabase-js's own thing, byte for byte. We add a look. We do not
     reimplement the flow, and we do not hand-edit its url.

   ── redirect:'manual' IS LOAD-BEARING. IT IS NOT A SEATBELT. ────────────
   An earlier version of this header claimed skipBrowserRedirect makes
   supabase-js append skip_http_redirect=true, so an enabled provider would
   answer 200-with-JSON and there would be "no opaque-redirect guessing".
   THAT WAS FALSE, and believing it is exactly how someone deletes the line
   that makes this file work. Read _handleProviderSignIn again — the options
   it forwards into the url builder are the whole story:

       const url = await this._getUrlForProvider(`${this.url}/authorize`, provider, {
         redirectTo: options.redirectTo,
         scopes: options.scopes,
         queryParams: options.queryParams,        // ← and NOTHING else
       })

   signInWithOAuth does pass skipBrowserRedirect down, but only so this method
   can decide whether to call window.location.assign. It is NEVER forwarded
   into _getUrlForProvider, and _getUrlForProvider is the only place that
   pushes skip_http_redirect=true — a flag it only ever receives from
   linkIdentityOAuth. So the url we probe does not carry it. Which means:

       · a DISABLED provider answers 400 with a JSON body, and that body is
         CORS-readable from our origin — access-control-allow-origin echoes us
         on the refusal (measured, same day). That is what lets us read the
         message and say the true thing instead of guessing.
       · an ENABLED provider answers 302 to appleid.apple.com /
         accounts.google.com. THIS IS THE NORMAL HAPPY PATH HERE, not a legacy
         fallback: with redirect:'manual' the fetch resolves as an
         opaqueredirect (type 'opaqueredirect', status 0, ok false), which is
         precisely the shape `probe` reads as "the handoff is live".

   Delete redirect:'manual', or delete the opaqueredirect branch in probe(),
   and fetch reverts to redirect:'follow', chases that 302 into an origin that
   sends no CORS headers, throws a TypeError into our catch — and every
   WORKING provider gets reported to the member as unreachable. OAuth would be
   silently, permanently dead the day a founder flips Apple on, and nothing on
   screen would say why. Both lines stay.

   ── THE MOMENT THE DASHBOARD FLAG FLIPS, THIS WORKS WITH ZERO CODE CHANGE ──
   Nothing here hardcodes "apple is off". There is no VITE_ var, no allowlist,
   no boolean in the bundle. The probe asks the live server on every tap. Turn
   Apple on in Supabase → Authentication → Providers and the very next tap
   stops getting the 400, gets the 302 instead, and goes to Apple. No deploy,
   no edit, no line of this file touched. That is the whole point of probing
   instead of declaring.

   ── WHY THIS FAILS CLOSED (and earlyAccess.js fails open) ───────────────
   La puerta fails OPEN because failing closed strands a real invitee who has
   no other way in. Here the asymmetry inverts: email sign-in always works, so
   a wrong "not available" costs a member one tap, while a wrong "go ahead"
   costs them that dead JSON page. And today the cost is asymmetric in one
   more way — no provider has EVER been on, so no human being on this platform
   has an Apple-or-Google-only identity. There is nobody a false negative can
   lock out. Revisit this default the day a provider ships and members exist
   whose only credential is that provider.

   ⚠ TODO — LA PUERTA vs OAUTH, unresolved by design.
   An OAuth signup cannot carry raw_user_meta_data, so it cannot carry an
   invite_code, so the before_user_created hook (migration 0046) will refuse
   it while the invite gate is on. Nothing breaks today because no provider is
   on. Before either one is switched on, a founder has to decide: exempt OAuth
   from the gate, or collect the code first and mint the identity behind it.
   Do not flip a provider without answering that question.
   ========================================================================= */

/* v16 — SOLO GOOGLE. Decisión de fundador (send-off v16): el botón de Apple
   se elimina del bundle; queda Google + email. Deliberately no brand logo:
   the four-colour Google G is a colour gradient — which Cosmos forbids
   outright. The label does the work, in the same mono-uppercase voice as
   every other button in the app. */
export const OAUTH_PROVIDERS = [
  { id: 'google', label: 'Google' },
]

const LABEL = Object.fromEntries(OAUTH_PROVIDERS.map(p => [p.id, p.label]))
const labelOf = (id) => LABEL[id] || 'That'

/* Generous, because the probe talks to the same host we are about to send the
   whole browser to — if this times out, that navigation was going to be slow
   anyway. Short enough that nobody sits watching a spinner. */
const PROBE_TIMEOUT_MS = 2500

/* GoTrue's exact phrasing today is "Unsupported provider: provider is not
   enabled", and older builds capitalise it differently. Match loosely on the
   part that carries the meaning and let EVERYTHING else fall to the generic
   sentence — including the neighbouring 400, "Unsupported provider: Provider
   nonsense could not be found", which is a bug in our code, not a switched-off
   provider. Telling a member "coming soon" about our own typo would be a lie
   with a friendly face. */
const PROVIDER_OFF = /provider.*not[\s_-]*enabled/i

/* Read every field GoTrue and supabase-js are known to put the sentence in.
   `msg` is the raw REST shape, `message` is what AuthError carries, and
   `error_description` is the OAuth-callback shape. Joining them means we do
   not have to be right about which one arrived. */
export function isProviderOffError(payload) {
  if (!payload) return false
  const text = [payload.msg, payload.message, payload.error_description, payload.error]
    .filter(v => typeof v === 'string')
    .join(' · ')
  return PROVIDER_OFF.test(text)
}

/* "isn't open", NOT "is coming". Nothing on this platform backs a promise of
   arrival: no provider has ever been switched on, and the TODO above is a
   real unanswered question that could land on never shipping OAuth at all.
   This is the Settings law applied to a sentence — "el que no existe no
   promete nada, el otro miente" — and Ley 9, every click keeps its promise.
   State the door's condition, hand back the one that works, promise nothing. */
const offLine = (label) => `${label} sign-in isn't open. Use your email for now.`
const refusedLine = (label) => `${label} sign-in isn't available right now. Use your email for now.`
const unreachableLine = (label) => `Couldn't reach ${label} sign-in. Try again, or use your email.`

/* Providers the live server has already told us are off. Only DEFINITIVE
   answers are remembered — a timeout or a network failure caches nothing, so
   a second tap gets a fresh look. Same discipline as the probes in social.js.
   Scoped to the page load: if a founder flips the flag mid-session, one
   reload is enough. */
const knownOff = new Set()

/* Ask the server about the exact url supabase-js built. Returns one of:
     { verdict: 'go' }          the handoff is live
     { verdict: 'off' }         this provider is switched off, said out loud
     { verdict: 'refused' }     a readable refusal that is NOT "not enabled"
     { verdict: 'unreachable' } we never got an answer
   Never throws. */
async function probe(url) {
  let res
  try {
    res = await Promise.race([
      fetch(url, {
        method: 'GET',
        // We are inspecting, not authenticating. Nothing this request sets or
        // receives should touch the real navigation that may follow it a
        // millisecond later.
        credentials: 'omit',
        cache: 'no-store',
        // Accept is CORS-safelisted, so this stays a single round trip with no
        // preflight.
        headers: { Accept: 'application/json' },
        /* LOAD-BEARING — do not remove, and read the header before you argue.
           signInWithOAuth never puts skip_http_redirect on this url, so an
           ENABLED provider answers 302 straight to the provider's own domain,
           an origin that sends no CORS headers. The default redirect:'follow'
           would chase it, throw a TypeError into the catch below, and we would
           tell a member that a perfectly working provider was unreachable —
           i.e. OAuth dies silently the day it starts working. With 'manual'
           that 302 surfaces as an opaqueredirect, which is what the handoff
           looks like from in here. */
        redirect: 'manual',
      }),
      new Promise(resolve => setTimeout(() => resolve(null), PROBE_TIMEOUT_MS)),
    ])
  } catch {
    return { verdict: 'unreachable' }               // network / CORS / offline
  }
  if (!res) return { verdict: 'unreachable' }       // lost the race
  // 200 would mean GoTrue answered with JSON instead of redirecting. It does
  // not today (nothing puts skip_http_redirect on this url) — kept because a
  // future build that does answer 200 is still a live handoff, not a refusal.
  if (res.ok) return { verdict: 'go' }
  // THE ENABLED PATH. 302 → the provider's own domain, surfaced as an
  // opaqueredirect by redirect:'manual'. This is the normal "go", not a
  // fallback for old behaviour. Deleting it kills every working provider.
  if (res.type === 'opaqueredirect') return { verdict: 'go' }

  let payload = null
  try { payload = await res.json() } catch { payload = null }
  if (isProviderOffError(payload)) return { verdict: 'off' }
  // A 4xx we could read but did not recognise, or a 5xx: the provider may be
  // fine and Supabase may be having a moment. Either way the member's next
  // move is the same, and it is not a raw JSON page.
  return { verdict: 'refused' }
}

/* THE ONE ENTRY POINT. Resolves to:
     { status: 'redirecting' }              the browser is leaving; render nothing new
     { status: 'unavailable', message }     provider is off — say the calm line
     { status: 'error', message }           anything else — say the calm line
   Never throws, never leaves the caller without a sentence to show. */
export async function signInWithProvider(providerId, { redirectTo } = {}) {
  const label = labelOf(providerId)
  if (knownOff.has(providerId)) {
    return { status: 'unavailable', provider: providerId, message: offLine(label) }
  }

  let url = ''
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: providerId,
      options: { redirectTo, skipBrowserRedirect: true },
    })
    // Always null in 2.105.3 (see the header). Read it anyway — the contract
    // allows an error here and a future version may start honouring it, and a
    // check that costs nothing is cheaper than the bug it prevents.
    if (error) {
      if (isProviderOffError(error)) { knownOff.add(providerId); return { status: 'unavailable', provider: providerId, message: offLine(label) } }
      return { status: 'error', provider: providerId, message: refusedLine(label) }
    }
    url = data?.url || ''
  } catch (e) {
    if (isProviderOffError(e)) { knownOff.add(providerId); return { status: 'unavailable', provider: providerId, message: offLine(label) } }
    return { status: 'error', provider: providerId, message: unreachableLine(label) }
  }

  if (!url) return { status: 'error', provider: providerId, message: refusedLine(label) }

  const { verdict } = await probe(url)
  if (verdict === 'off') {
    knownOff.add(providerId)
    return { status: 'unavailable', provider: providerId, message: offLine(label) }
  }
  if (verdict === 'refused') return { status: 'error', provider: providerId, message: refusedLine(label) }
  if (verdict === 'unreachable') return { status: 'error', provider: providerId, message: unreachableLine(label) }

  /* GO. Second call, this time WITHOUT skipBrowserRedirect, so supabase-js
     performs its own window.location.assign with its own url — we never
     hand-edit a url we did not build, and the probe's request never touches
     the navigation. The client is flowType:'implicit' with
     detectSessionInUrl:true (supabase-js defaults, we pass no options in
     api/supabase.js), so the session comes home in the hash and AuthContext's
     onAuthStateChange picks it up wherever `redirectTo` lands. */
  /* Handled exactly like the first call, for a sharper reason: if this one
     ever DOES return an error (or throw), window.location.assign was never
     reached, the browser is NOT leaving, and answering 'redirecting' would
     leave the member watching a spinner forever with no sentence under it —
     the caller deliberately does not clear its busy state on 'redirecting'.
     It also keeps this function's promise literally true: never throws. */
  try {
    const { error: goError } = await supabase.auth.signInWithOAuth({ provider: providerId, options: { redirectTo } })
    if (goError) {
      if (isProviderOffError(goError)) { knownOff.add(providerId); return { status: 'unavailable', provider: providerId, message: offLine(label) } }
      return { status: 'error', provider: providerId, message: refusedLine(label) }
    }
  } catch (e) {
    if (isProviderOffError(e)) { knownOff.add(providerId); return { status: 'unavailable', provider: providerId, message: offLine(label) } }
    return { status: 'error', provider: providerId, message: unreachableLine(label) }
  }
  return { status: 'redirecting', provider: providerId }
}
