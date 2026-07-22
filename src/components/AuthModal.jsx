import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { humanizeAuthError } from '@/lib/authErrors'
import { fetchGateEnabled, humanizeGateError } from '@/lib/earlyAccess'
import { useFocusTrap } from '@/lib/focusTrap'
import { Field, PRESS } from '@/components/AuthField'
import {
  BONE, BONE_MID, BONE_LOW, HAIR, HAIR_HI,
  FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, EASE_HOUSE,
} from '@/lib/cosmos'
import { X, User, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'

/* =========================================================================
   AuthModal — la puerta RÁPIDA. /auth es la entrada completa; esto es el
   portón lateral que se abre encima de la página cuando un anónimo toca
   algo que pide sesión (Follow, Connect, el +, una pestaña gated). Al
   cerrar con éxito NO navega: la persona se queda exactamente donde estaba,
   que es todo el punto de un modal contextual.

   v15 — PARIDAD CON LA PÁGINA. Este modal se quedó en v13 mientras /auth
   se volvía Cosmos en v14: mezclaba español/inglés, cargaba con el string
   '...', no tenía ojo de contraseña y su forgot-password se tragaba errores
   reales. Ahora comparte con la página el MISMO cascarón de campo
   (src/components/AuthField.jsx), la misma plomería (useAuth — ya no llama
   supabase.auth directo), el mismo rigor anti-enumeración, y la misma voz.
   Lo que NO comparte es deliberado:
     · Sin puertas Apple/Google — el modal es la vía corta; las puertas de
       terceros viven en /auth (alcance acordado con el founder, 22 jul).
     · mode arranca en 'signin' — quien toca Follow suele TENER cuenta.
     · Al éxito, onClose() y nada más — nunca un redirect.

   signinTitle / signinKicker override the sign-in greeting for a first-touch
   context (e.g. the For You door): a first-time visitor must never be
   greeted with "WELCOME BACK". Signup copy is unchanged.

   v12 — LA PUERTA. This modal is the app's OTHER signup path, so it is
   exactly where a gate springs a hole in its own UI. It does NOT host a
   second gate: when the flag is on, the signup tab disappears here and the
   visitor is sent to /auth, which is the one door. Sign-in is never gated.
   `gate` arranca en undefined y el toggle sólo se monta cuando resuelve a
   false — la versión anterior arrancaba en false y FLASHEABA la pestaña de
   signup para luego arrebatarla (el mismo bug de parpadeo que la página
   arregló sosteniendo el render).

   v13 — PORTAL A BODY (bug del barrido). AuthModal se renderiza en DOS
   sitios: como hermano de <main> en Layout y DENTRO de Community, que vive
   en una isla `z-index:1`. En esa isla su z-10000 valía "10000 dentro de un
   contexto que en el documento es 1", así que la barra (9999 a nivel
   documento) lo tapaba y seguía clickeable. Portalear al body lo saca de
   cualquier isla.

   LEY 8: el único momento chrome del modal es el título. Nada más brilla.
   ========================================================================= */
export default function AuthModal({ onClose, signinTitle = 'WELCOME BACK', signinKicker = 'Sign in to continue' }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [gate, setGate] = useState(undefined)
  const { signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  const cardRef = useRef(null)

  useEffect(() => { let ok = true; fetchGateEnabled().then(v => { if (ok) setGate(v) }); return () => { ok = false } }, [])

  /* If the flag resolves true while someone is mid-signup, we flip them to
     sign-in. Clear the credentials and say so — otherwise their typed name
     and password silently become a sign-in attempt and they get "Invalid
     login credentials" for a password they never had. */
  useEffect(() => {
    if (gate && mode === 'signup') {
      setMode('signin'); setPassword(''); setFirstName(''); setLastName('')
      setNotice('Early access is by invitation now — sign in, or ask for an invite below.')
    }
  }, [gate, mode])

  /* La casa entera del modal: mete el foco, cicla Tab, Escape cierra,
     bloquea el scroll del body y devuelve el foco al control que abrió.
     La misma trampa que Onboarding y Tutorial (src/lib/focusTrap.js). */
  useFocusTrap(cardRef, onClose)

  const signup = mode === 'signup'

  const submit = async (e) => {
    if (e) e.preventDefault()
    if (loading) return
    if (signup && (!firstName.trim() || !lastName.trim())) { setError('Enter your first and last name'); return }
    setLoading(true); setError(''); setNotice('')
    try {
      if (signup) {
        // Belt and braces: if the gate turned on between mount and submit,
        // hand the visitor to the real door instead of a rejected signup.
        if (gate) { setLoading(false); onClose(); navigate('/auth'); return }
        const fullName = `${firstName.trim()} ${lastName.trim()}`
        const { error: err } = await signUp(email, password, fullName, { first_name: firstName.trim(), last_name: lastName.trim() })
        if (err) throw err
      } else {
        const { error: err } = await signIn(email, password)
        if (err) throw err
      }
      // Just dismiss — the user stays on the page they were on. Members reach
      // the OS deliberately via its own server-gated nav entry, never an
      // auto-redirect.
      onClose()
      return
    } catch (err) { setError(humanizeGateError(err) || humanizeAuthError(err)) }
    setLoading(false)
  }

  /* D3: forgot password — anti-enumeration (same confirmation either way).
     resetPasswordForEmail RESUELVE {data, error}: sólo lanza en fallos no-auth
     (fetch offline). La versión catch-only de v13 imprimía "te mandamos un
     enlace" encima de un 429 o un 500 — el mismo bug que la página documentó
     y arregló (Auth.jsx). El regex es el cinturón: si un GoTrue futuro
     empezara a decir "user not found", esa frase jamás llega a esta pantalla.
     Add phrasings to it, never remove any. */
  const forgot = async () => {
    if (!email.trim()) { setError('Enter your email to get the reset link'); return }
    setLoading(true); setError(''); setNotice('')
    try {
      const { error: err } = (await resetPassword(email.trim())) || {}
      const raw = (err?.message || err?.error_description || '').toLowerCase()
      const leaksExistence = /user not found|email not found|account not found|no user|not registered|does ?n.t exist/.test(raw)
      if (err && !leaksExistence) { setError(humanizeAuthError(err)); return }
      setNotice('If an account exists for that email, we sent a link to reset your password.')
    } catch (e) { setError(humanizeAuthError(e)) } finally { setLoading(false) }
  }

  const switchMode = (m) => { setMode(m); setError(''); setNotice('') }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px' }} onClick={onClose}>
      {/* Backdrop blur */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(var(--void-rgb),.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} />

      {/* La tarjeta. 18px de radio = la gramática de los modales de la casa
          (CreateCentral wide, GlassSheet wide), no los 4px de página abierta.
          tabIndex -1 para que la trampa pueda enfocarla al montar. */}
      <div
        ref={cardRef} tabIndex={-1} role="dialog" aria-modal="true"
        aria-label={signup ? 'Create your account' : signinTitle}
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: '100%', maxWidth: '360px', background: 'var(--bg-card)', border: `1px solid ${HAIR_HI}`, borderRadius: '18px', padding: '32px 28px', animation: 'fadeUp .3s ease', outline: 'none' }}>
        {/* Close button */}
        <button onClick={onClose} aria-label="Close" className="pressable" style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px' }}>
          <X size={18} />
        </button>

        {/* EL momento chrome — el único (Ley 8). */}
        <h2 style={{ ...chromeText, fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: '30px', lineHeight: 0.96, letterSpacing: '.02em', textAlign: 'center', margin: '0 0 6px' }}>
          {signup ? 'JOIN THE COMMUNITY' : signinTitle}
        </h2>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, textAlign: 'center', letterSpacing: '.24em', textTransform: 'uppercase', marginBottom: '24px' }}>
          {signup ? 'Create your account' : signinKicker}
        </div>

        {/* Toggle — v12: with the gate ON there is nothing to toggle to.
            Creating an account is not a tab anymore, it is a door. Y mientras
            el flag resuelve, tampoco: sólo con un false firme se monta. */}
        {gate === false && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(var(--ink-rgb),.03)', border: `1px solid ${HAIR}`, borderRadius: '6px', padding: '3px' }}>
            {['signin', 'signup'].map(m => (
              <button key={m} type="button" onClick={() => switchMode(m)} className="pressable"
                aria-pressed={mode === m}
                style={{
                  flex: 1, background: mode === m ? 'rgba(var(--ink-rgb),.08)' : 'transparent',
                  border: 'none', borderRadius: '4px', padding: '9px 8px',
                  color: mode === m ? BONE : BONE_LOW, cursor: 'pointer',
                  fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase',
                  transition: `background .25s ${EASE_HOUSE}, color .25s ${EASE_HOUSE}, ${PRESS}`,
                }}>
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
        )}

        {/* Un <form> real: Enter manda desde cualquier campo, como en /auth. */}
        <form onSubmit={submit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* name row stays mounted and collapses via grid-template-rows so the
                email/password inputs glide instead of teleporting on mode toggle (A-06) */}
            <div className="row-collapse" aria-hidden={!signup} style={{ display: 'grid', gridTemplateRows: signup ? '1fr' : '0fr', opacity: signup ? 1 : 0 }}>
              <div style={{ overflow: 'hidden', minHeight: 0 }}>
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

            {/* THE PRIMARY — un spinner real, nunca el string '...' (la página
                lo dice mejor: un loading de tres puntos se lee como "roto"). */}
            <button
              type="submit" className="pressable" disabled={loading} aria-busy={loading}
              style={{
                width: '100%', marginTop: '6px', background: BONE, color: 'var(--bg)',
                border: 'none', borderRadius: '4px', padding: '15px',
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

        {/* v12: the way to the door, for someone who has no account yet.
            Never a dead end (Ley 9) — it goes to the real gate. */}
        {gate && (
          <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: `1px solid ${HAIR}`, textAlign: 'center' }}>
            <button onClick={() => { onClose(); navigate('/auth') }} className="pressable" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT_SANS, fontSize: '12px', color: BONE_LOW, padding: '4px' }}>
              New here? <span style={{ color: BONE_MID, textDecoration: 'underline', textUnderlineOffset: '3px' }}>Early access is by invitation&nbsp;→</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
