import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { humanizeAuthError } from '@/lib/authErrors'
import { fetchGateEnabled, humanizeGateError } from '@/lib/earlyAccess'
import EarlyAccessGate from '@/components/EarlyAccessGate'
import { OAUTH_PROVIDERS, signInWithProvider } from '@/lib/oauth'
import {
  BONE, BONE_MID, BONE_LOW, FAINT, HAIR, HAIR_HI,
  FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, EASE_HOUSE,
} from '@/lib/cosmos'
import { Field, PRESS } from '@/components/AuthField'
import { glassControl } from '@/lib/glass'
import { useWide } from '@/lib/useIsDesktop'

/* =========================================================================
   /auth — THE SECOND SCREEN OF THE HOUSE.

   La puerta (EarlyAccessGate) is the first thing a stranger sees. This is the
   second, and for every member who already exists it is the FIRST — the
   ticket buyer bounced from /claim, the founder on a new phone, anyone whose
   session expired. It used to be a cream box with a "..." for a loading
   state. It is the moment trust either forms or doesn't, so it now reads like
   the rest of the universe: void, bone, one chrome moment, air.

   STRUCTURE borrowed (not copied) from a reference the founder supplied — a
   white/blue grid app. We took the ANATOMY of a modern entry screen: bracket
   tag over a display headline, iconed fields, a real primary with a real
   spinner, an "or" rule, the third-party doors, a footer that switches modes
   and names the legal terms. Every pixel of the LOOK is ours.

   ── WHAT IS LOAD-BEARING HERE (do not "simplify" any of it) ─────────────
   • mode defaults to SIGN IN when we arrived with ?next=, SIGN UP on a cold
     visit. See the comment on the useState below — it is a real decision
     about a real person, not a default.
   • `next` is guarded to a local path (/^\/(?!\/)/). It is the only thing
     standing between this screen and an open redirect.
   • LA PUERTA STANDS IN FRONT OF SIGNUP ONLY. `gate === undefined` holds the
     signup form and NOTHING else — an existing member on bad signal must
     never get a blank page where sign-in and password recovery used to be.
   • The invite code rides to signUp(); a gate rejection clears it and sends
     the visitor back to the door.
   • Forgot-password is anti-enumeration: the SAME confirmation whether or not
     an account exists. Never "no account with that email" — that turns this
     form into a membership oracle for anyone with a list of addresses.
   • Placeholders ("First name" / "Last name" / "Email" / "Password") and the
     primary's labels ("Create Account" / "Sign In") are the handles the e2e
     harness grabs (e2e/walkthrough-v*.spec.js). Rename one and every QA run
     dies. The mode switch keeps an explicit aria-label for the same reason.
   • transparent background + position:relative + zIndex:1 — the shared sky
     from App.jsx paints behind this page. Never hand-roll a gradient here.

   ── LEY 8: ONE CHROME MOMENT ────────────────────────────────────────────
   It is the headline. Nothing else on this screen shines: not the primary
   button, not the third-party doors, not the founders' names. If you add a
   second chrome element, delete this one first.
   ========================================================================= */

const REDUCED = () => typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* PRESS y el cascarón de campo <Field/> vivían aquí en v14; en v15 el modal
   alcanzó paridad con esta página y ambos se mudaron a
   src/components/AuthField.jsx — un solo rectángulo para las dos superficies
   de entrada, mismo criterio anti-deriva que Chip.jsx y focusTrap.js. Las
   notas originales (por qué PRESS se appendea y nunca se reemplaza, por qué
   Field es module-scope, por qué 16px) viajaron con el código. */

export default function Auth() {
  /* Default to SIGN IN whenever we were sent here from somewhere (?next=…).
     That path is overwhelmingly someone who already has an account and lost
     their session — most sharply the ticket buyer bounced from /claim. They
     already paid; "NOT FOR ALL PEOPLE" is the wrong first thing to show them.
     A cold visit to /auth still opens on signup. */
  const [mode, setMode] = useState(() =>
    new URLSearchParams(window.location.search).get('next') ? 'signin' : 'signup')
  /* v12 — LA PUERTA. The gate stands in front of SIGNUP only; sign-in is
     never gated (see EarlyAccessGate). `gate` is undefined until the flag
     resolves, so we render nothing rather than flashing the open signup
     form and then yanking it away. fetchGateEnabled fails OPEN. */
  const [gate, setGate] = useState(undefined)
  const [inviteCode, setInviteCode] = useState('')
  useEffect(() => { let ok = true; fetchGateEnabled().then(v => { if (ok) setGate(v) }); return () => { ok = false } }, [])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthBusy, setOauthBusy] = useState('')          // provider id in flight
  const [oauthLine, setOauthLine] = useState('')          // the calm sentence, when a door is closed
  const [enter, setEnter] = useState(REDUCED())           // reduced motion lands composed, not blank
  const { signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const wide = useWide()
  // Only ever honor a local, same-app return path (leading "/", no "//") — never an
  // open redirect to an external URL.
  const rawNext = searchParams.get('next') || ''
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : '/'

  const holding = gate === undefined && mode === 'signup'
  const doorOpen = gate === true && !inviteCode && mode === 'signup'

  /* THE 430px TRAP. index.css puts max-width:430px on BODY — the phone frame —
     and only Layout releases it (body.wide-full). This route renders OUTSIDE
     Layout, so on a laptop the entry screen was a phone strip in a black
     desert. Same mechanism EarlyAccessGate uses, so there is one way to
     release the frame, not two. */
  useEffect(() => {
    document.body.classList.add('wide-full')
    return () => document.body.classList.remove('wide-full')
  }, [])
  /* …and the repair. EarlyAccessGate owns the same class and removes it on ITS
     unmount, which happens the instant a code is accepted — i.e. exactly when
     this form appears. Without this the signup form inherited the 430px strip
     the gate just gave back. Keyed on doorOpen so it re-asserts in the same
     commit the child's cleanup runs in (React flushes every passive cleanup
     before any passive mount). */
  useEffect(() => { if (!doorOpen) document.body.classList.add('wide-full') }, [doorOpen])

  useEffect(() => {
    if (REDUCED()) return undefined
    const t = setTimeout(() => setEnter(true), 40)
    return () => clearTimeout(t)
  }, [])

  /* The staggered entrance, state-driven rather than a CSS animation — so
     reduced motion lands at the FINAL state instead of at frame 1 (the
     identity-in bug, index.css:794). Always applied to a WRAPPER, never to a
     button: an inline transform outranks `.pressable:active` and would
     silently kill the press response of everything it touched. */
  const rise = (d) => ({
    opacity: enter ? 1 : 0,
    transform: enter ? 'translateY(0)' : 'translateY(10px)',
    transition: REDUCED() ? 'none' : `opacity .8s ${EASE_HOUSE} ${d}ms, transform .8s ${EASE_HOUSE} ${d}ms`,
  })

  const submit = async (e) => {
    if (e) e.preventDefault()
    if (loading) return
    if (mode === 'signup' && (!firstName.trim() || !lastName.trim())) { setError('Enter your first and last name'); return }
    setLoading(true); setError(''); setNotice(''); setOauthLine('')
    try {
      // Everyone — members included — lands on the public app after signing in.
      // The OS is reached deliberately via its own server-gated entry (the OS tab
      // in the nav, shown only to network members), never by an auto-redirect.
      if (mode === 'signin') { const { error } = await signIn(email, password); if (error) throw error; navigate(next) }
      else {
        const fullName = `${firstName.trim()} ${lastName.trim()}`
        // inviteCode rides to the before_user_created hook via user metadata
        const { error } = await signUp(email, password, fullName, { first_name: firstName.trim(), last_name: lastName.trim() }, inviteCode); if (error) throw error; navigate(next)
      }
    } catch (err) {
      const gateMsg = humanizeGateError(err)
      // The hook refused the code (it can fail open past the client oracle, or
      // the code was revoked between check and submit). Send them BACK to the
      // door — otherwise they are staring at "check your code" on a screen with
      // no code field, and every resubmit fails the same way forever.
      if (gateMsg) setInviteCode('')
      setError(gateMsg || humanizeAuthError(err))
    } finally { setLoading(false) }
  }

  // D3: forgot password — send the reset link. ANTI-ENUMERATION: the same
  // confirmation shows whether or not an account exists at that email. Do not
  // "improve" this into a helpful "we don't know that address" — that hands a
  // stranger a membership oracle for any list of emails they own.
  const forgot = async () => {
    if (!email.trim()) { setError('Enter your email to get the reset link'); return }
    setLoading(true); setError(''); setNotice(''); setOauthLine('')
    try {
      /* resetPasswordForEmail RESOLVES { data, error } — it only throws for a
         non-auth failure (an offline fetch). So the old catch-only version
         could never fire on the errors that actually happen here, and printed
         "we sent a link" over a link that was never sent: a 429 rate limit, a
         malformed address, a 500. Anti-enumeration was never the reason those
         were swallowed — it was a bug wearing anti-enumeration's coat.

         ANTI-ENUMERATION SURVIVES THIS, and that is not an accident. GoTrue
         answers 200 for an address with no account, so nothing surfaced here
         can be existence-derived: rate limits and dead networks are facts
         about the request, not about the person. The guard below is the belt —
         if a future GoTrue ever starts saying "user not found", that sentence
         still never reaches this screen and the member gets the same
         confirmation as everyone else. Add phrasings to it, never remove any. */
      const { error: err } = (await resetPassword(email.trim())) || {}
      const raw = (err?.message || err?.error_description || '').toLowerCase()
      const leaksExistence = /user not found|email not found|account not found|no user|not registered|does ?n.t exist/.test(raw)
      if (err && !leaksExistence) { setError(humanizeAuthError(err)); return }
      setNotice('If an account exists for that email, we sent a link to reset your password.')
    } catch (e) { setError(humanizeAuthError(e)) } finally { setLoading(false) }
  }

  /* The third-party doors. Both providers are OFF on the live project today,
     and signInWithProvider is what makes that honest instead of catastrophic —
     read the header of src/lib/oauth.js before touching this. The buttons are
     REAL and never rendered disabled: they run the real supabase flow, and
     when the server says the provider is off they say so in one calm line
     with a working alternative in it. */
  const openProvider = async (id) => {
    if (oauthBusy) return
    setOauthBusy(id); setError(''); setNotice(''); setOauthLine('')
    const r = await signInWithProvider(id, { redirectTo: `${window.location.origin}${next}` })
    // 'redirecting' means the browser is already leaving — leave the spinner
    // spinning, because clearing it would flash a dead button during unload.
    if (r.status !== 'redirecting') { setOauthBusy(''); setOauthLine(r.message) }
  }

  const switchMode = (m) => { setMode(m); setError(''); setNotice(''); setOauthLine('') }

  /* Flag still resolving — hold ONLY the signup form. Sign-in and password
     recovery are never gated, so they must never wait on this RPC: holding
     the whole page meant an existing member on bad signal got a blank 100vh
     div where sign-in used to be, with no Back button (this route renders
     outside Layout). fetchGateEnabled also times out at 2s now. */
  if (holding) return <div style={{ minHeight: '100vh' }} />

  /* Gate ON + the visitor hasn't presented a code yet → la puerta.
     `mode` is the escape hatch: switching to sign-in walks straight past
     this, because an existing member is not a new signup. */
  if (doorOpen) {
    return (
      <EarlyAccessGate
        onAccepted={(c) => { setInviteCode(c); setError('') }}
        onSignIn={() => setMode('signin')}
      />
    )
  }

  const signup = mode === 'signup'

  return (
    // v12: transparent + zIndex 1 — the shared sky (App.jsx) paints behind
    // this page. It used to hand-roll a flat void gradient.
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      padding: wide ? '88px 40px 64px' : '78px 26px 54px',
      background: 'transparent', position: 'relative', zIndex: 1,
    }}>
      {/* Back — this route renders outside Layout, so it carries its own way
          home. glassControl(), not a hand-rolled blur: a loose control
          floating directly over the page is exactly what that material is
          for, and nothing above it carries backdrop-filter, so this is a
          first blur and not a nested one.

          NO `.pressable` HERE, AND THAT IS DELIBERATE. The glass lives on the
          button itself, so the class's `transform: translateY(1px) scale(.99)`
          would land ON a backdrop-filter element — and WebKit never
          re-attaches backdrop sampling once a transform has been applied to
          and removed from one (glass.js / index.css:696). The glass would go
          dead for the rest of the session. The response is light instead:
          border and text brighten, exactly like the Settings control on
          /profile, which is the same material solving the same problem. */}
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label="Back"
        style={{
          ...glassControl(), position: 'absolute', top: wide ? '28px' : '20px', left: wide ? '32px' : '20px',
          borderRadius: '100px', padding: '7px 15px 7px 12px', color: BONE_MID,
          display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer',
          fontFamily: FONT_SANS, fontSize: '12.5px', zIndex: 2,
          transition: `border-color .25s ${EASE_HOUSE}, color .25s ${EASE_HOUSE}`,
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.42)'; e.currentTarget.style.color = BONE }}
        onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),0.22)'; e.currentTarget.style.color = BONE_MID }}>
        <ArrowLeft size={13} /> Back
      </button>

      {/* margin:auto, not justify-content:center — a centred flex column
          CLIPS its own top when the content outgrows the viewport, and the
          signup form on a small phone does exactly that. auto margins centre
          the same way and push instead of clipping. */}
      <div style={{ width: '100%', maxWidth: wide ? '460px' : '420px', margin: 'auto' }}>

        {/* ── the header. The bracket tag is a catalog mark, not decoration:
              it is the same grammar as the [BRACKET TAGS] the rest of the app
              uses for codes and labels. ── */}
        <div style={{ ...rise(0), textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>
            [&nbsp;C4&nbsp;]
          </div>
        </div>

        {/* THE chrome moment. The ONLY one on this screen (Ley 8). */}
        <div style={{ ...rise(80), textAlign: 'center' }}>
          <h1 style={{
            ...chromeText, fontFamily: FONT_DISPLAY, fontWeight: 400,
            fontSize: wide ? 'clamp(46px, 4.6vw, 64px)' : 'clamp(34px, 10.5vw, 48px)',
            lineHeight: 0.94, letterSpacing: '.02em', margin: wide ? '20px 0 0' : '16px 0 0',
          }}>
            {signup ? 'COME INSIDE' : 'WELCOME BACK'}
          </h1>
        </div>

        <div style={{ ...rise(150), textAlign: 'center' }}>
          <p style={{
            fontFamily: FONT_SANS, fontSize: wide ? '14.5px' : '13.5px', lineHeight: 1.65,
            color: BONE_MID, margin: '16px auto 0', maxWidth: '32ch', textWrap: 'balance',
          }}>
            {signup ? 'Make the account. Then make the world.' : 'Your world is where you left it.'}
          </p>
        </div>

        {/* ── the form. A real <form onSubmit> so Enter submits from any field
              — the e2e harness signs in by pressing Enter in the password
              field, and so does every human. ── */}
        <form onSubmit={submit} noValidate style={{ ...rise(220), marginTop: wide ? '38px' : '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* name row collapses via grid-template-rows (A-06) — same recipe
                as AuthModal. The inner overflow:hidden/minHeight:0 wrapper is
                load-bearing; without it the row does not actually collapse. */}
            <div className="row-collapse" aria-hidden={!signup} style={{ display: 'grid', gridTemplateRows: signup ? '1fr' : '0fr', opacity: signup ? 1 : 0 }}>
              <div style={{ overflow: 'hidden', minHeight: 0 }}>
                {/* no padding on this row: the parent column's 10px gap is
                    the ONLY vertical rhythm in the form, and adding a second
                    one here made the name/email gap twice every other gap */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Field
                    icon={User} label="First name" placeholder="First name" type="text"
                    autoComplete="given-name" value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    tabIndex={signup ? 0 : -1} wrapStyle={{ flex: 1, minWidth: 0 }}
                  />
                  <Field
                    icon={User} label="Last name" placeholder="Last name" type="text"
                    autoComplete="family-name" value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    tabIndex={signup ? 0 : -1} wrapStyle={{ flex: 1, minWidth: 0 }}
                  />
                </div>
              </div>
            </div>

            <Field
              icon={Mail} label="Email" placeholder="Email" type="email"
              autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              inputMode="email" value={email} onChange={e => setEmail(e.target.value)}
            />

            <Field
              icon={Lock} label="Password" placeholder="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={password} onChange={e => setPassword(e.target.value)}
              right={
                <button
                  type="button"
                  className="pressable"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  style={{ background: 'none', border: 'none', padding: '6px', margin: '0 -4px 0 0', cursor: 'pointer', color: showPassword ? BONE_MID : BONE_LOW, display: 'flex', transition: `color .3s ${EASE_HOUSE}, ${PRESS}` }}>
                  {showPassword ? <EyeOff size={15} strokeWidth={1.6} /> : <Eye size={15} strokeWidth={1.6} />}
                </button>
              }
            />

            {/* sign-in only — a password you have not set yet cannot be forgotten */}
            {!signup && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button" onClick={forgot} disabled={loading}
                  style={{ background: 'none', border: 'none', padding: '2px 1px', cursor: loading ? 'default' : 'pointer', fontFamily: FONT_SANS, fontSize: '12.5px', color: BONE_LOW, textDecoration: 'underline', textUnderlineOffset: '3px', opacity: loading ? 0.6 : 1 }}>
                  Forgot your password?
                </button>
              </div>
            )}

            {/* One region, two voices. role="alert" interrupts a screen reader
                because a failure blocks the person; the confirmation is a
                role="status" and waits its turn. */}
            {error && (
              <div role="alert" style={{ fontFamily: FONT_SANS, fontSize: '12.5px', lineHeight: 1.55, color: 'var(--warn)', border: '1px solid var(--warn)', borderRadius: '4px', padding: '11px 13px' }}>
                {error}
              </div>
            )}
            {notice && (
              <div role="status" style={{ fontFamily: FONT_SANS, fontSize: '12.5px', lineHeight: 1.55, color: BONE_MID, border: `1px solid ${HAIR_HI}`, background: 'rgba(var(--ink-rgb),.03)', borderRadius: '4px', padding: '11px 13px' }}>
                {notice}
              </div>
            )}

            {/* THE PRIMARY. A real spinner, not the string "..." this screen
                shipped with — a loading state that is three periods is a
                loading state a member reads as "broken". */}
            <button
              type="submit" className="pressable" disabled={loading} aria-busy={loading}
              style={{
                width: '100%', marginTop: '6px', background: BONE, color: 'var(--bg)',
                border: 'none', borderRadius: '4px', padding: '17px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '.22em',
                textTransform: 'uppercase', fontWeight: 500,
                cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
                transition: `opacity .25s ${EASE_HOUSE}, ${PRESS}`,
              }}>
              {loading
                ? <><Loader2 size={13} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />{signup ? 'Creating…' : 'Signing in…'}</>
                : (signup ? 'Create Account' : 'Sign In')}
            </button>
          </div>
        </form>

        {/* ── the rule ── */}
        <div style={{ ...rise(300), display: 'flex', alignItems: 'center', gap: '14px', margin: '26px 0' }}>
          <div style={{ flex: 1, height: '1px', background: HAIR }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.28em', textTransform: 'uppercase', color: FAINT }}>or</span>
          <div style={{ flex: 1, height: '1px', background: HAIR }} />
        </div>

        {/* ── the third-party doors ──────────────────────────────────────────
            No brand logos on purpose: the Apple mark and the four-colour
            Google G are trademarked artwork, and the G is a colour gradient,
            which Cosmos forbids outright. The label does the work in the same
            mono-uppercase voice as every other button in the app.

            These buttons are NEVER rendered disabled. Both providers are off
            on the live project today, and a greyed-out button is a dead
            promise; a live button that answers honestly is a door that hasn't
            opened yet. See src/lib/oauth.js for exactly how that is detected
            — and note that the day the dashboard flag flips, this works with
            zero code change here or there. */}
        <div style={{ ...rise(360), display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: '10px' }}>
          {OAUTH_PROVIDERS.map(p => {
            const busy = oauthBusy === p.id
            return (
              <button
                key={p.id} type="button" className="pressable"
                onClick={() => openProvider(p.id)}
                disabled={Boolean(oauthBusy)} aria-busy={busy}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                  width: '100%', background: 'rgba(var(--ink-rgb),.03)',
                  border: `1px solid ${HAIR_HI}`, borderRadius: '4px', padding: '15px 12px',
                  color: BONE_MID, fontFamily: FONT_MONO, fontSize: '10px',
                  letterSpacing: '.16em', textTransform: 'uppercase',
                  cursor: oauthBusy ? 'default' : 'pointer',
                  opacity: oauthBusy && !busy ? 0.45 : 1,
                  transition: `border-color .3s ${EASE_HOUSE}, color .3s ${EASE_HOUSE}, opacity .25s, ${PRESS}`,
                }}
                onMouseOver={e => { if (!oauthBusy) { e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.34)'; e.currentTarget.style.color = BONE } }}
                onMouseOut={e => { e.currentTarget.style.borderColor = HAIR_HI; e.currentTarget.style.color = BONE_MID }}>
                {busy
                  ? <><Loader2 size={12} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />Opening…</>
                  : <>Continue with {p.label}</>}
              </button>
            )
          })}
        </div>

        {/* The truth when a door is closed. role="status", not alert: nothing
            failed and nothing is blocked — the member has a working way in
            two fields above, and the sentence says so.

            THE REGION IS ALWAYS MOUNTED, and the sentence appears INSIDE it.
            A live region inserted into the DOM in the same commit as its own
            text is announced unreliably (worst for polite ones): the screen
            reader has nothing to observe changing. Present-then-filled is the
            shape that actually fires — and this is the one sentence the whole
            oauth.js probe exists to deliver, so it has to reach a member who
            cannot see it. Free here: an empty div in a plain block column has
            no height and no gap of its own. Inside the form's gap-ed flex
            column the same trick would cost 10px of dead air per region, which
            is why the error/notice boxes above are still mounted with their
            text — a layout tax on every render for an unmeasured gain. */}
        <div role="status" aria-live="polite">
          {oauthLine && (
            <div style={{
              marginTop: '14px', fontFamily: FONT_SANS, fontSize: '12.5px', lineHeight: 1.55,
              color: BONE_LOW, textAlign: 'center', maxWidth: '34ch', marginInline: 'auto',
            }}>
              {oauthLine}
            </div>
          )}
        </div>

        {/* ── the footer: the switch, then the terms ── */}
        <div style={{ ...rise(440), marginTop: '34px', paddingTop: '24px', borderTop: `1px solid ${HAIR}`, textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => switchMode(signup ? 'signin' : 'signup')}
            /* The e2e harness switches modes with
               getByRole('button', { name: 'Sign In' }).first() — this explicit
               label is what keeps that handle stable no matter how the visible
               sentence is reworded later. */
            aria-label={signup ? 'Sign In' : 'Sign Up'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', fontFamily: FONT_SANS, fontSize: '13px', color: BONE_MID }}>
            {signup ? 'Already have an account? ' : 'New here? '}
            <span style={{ color: BONE, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              {signup ? 'Sign in' : 'Sign up'}
            </span>
          </button>

          {/* Real routes, both of them (App.jsx: /terms, /privacy). A new tab
              so a half-filled form is not thrown away to read a policy.

              BONE_LOW, not FAINT. FAINT (--cream-ghost) is ~2:1 and index.css
              marks it decorative-only — and a legal notice is the last text on
              a screen that is allowed to be unreadable. */}
          <div style={{ marginTop: '16px', fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', color: BONE_LOW, lineHeight: 1.9 }}>
            By continuing you agree to our{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: BONE_MID, textDecoration: 'underline', textUnderlineOffset: '3px' }}>Terms</a>
            {' '}&amp;{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: BONE_MID, textDecoration: 'underline', textUnderlineOffset: '3px' }}>Privacy</a>
          </div>
        </div>
      </div>
    </div>
  )
}
