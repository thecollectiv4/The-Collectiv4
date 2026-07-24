import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Loader2, MapPin, Link2, Check } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { publicPlan, joinPlan, planWhen } from '@/lib/social'
import SeedPill from '@/components/SeedMark'
import {
  BONE, BONE_MID, BONE_LOW, VOID, CARD, HAIR, HAIR_HI, SILVER,
  FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, safeImg,
} from '@/lib/cosmos'

/* =========================================================================
   /p/:id — LA LANDING COMPARTIBLE DE UN PLAN PÚBLICO (v17 · fase 4).

   El caso real que la parió: los 60 del WhatsApp del fucho no tenían
   puerta. Este link se pega en cualquier chat y ABRE PARA NO-MIEMBROS —
   la ruta vive en isPublicPath (Layout.jsx) y la lectura (public_plan,
   0057) tiene grant explícito a anon. Lo que un extraño ve es la TARJETA
   pública: qué, cuándo, dónde, quién lo arma. Nunca el roster, nunca los
   conteos (doctrina 0029: el descubridor ve el plan, no quién está).

   El CTA es la conversión entera del funnel:
   · anon           → /auth?mode=create&next=/p/:id (puerta de unirse, F1)
   · con sesión     → join_plan (idempotente) → el room del plan en
                      Messages. Unirse ES caer en el cuarto.

   not_found es UNA respuesta para todo lo invisible (privado, cancelado,
   inexistente) — esta página no es un oráculo de planes ajenos.

   LEY 8: el único chrome es el título del plan.
   ========================================================================= */

export default function PlanLanding() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(undefined)   // undefined=loading · null=not found
  const [joining, setJoining] = useState(false)
  const [err, setErr] = useState('')
  /* v18 — el copy-link sube a donde se ve (regla: un feature que nadie
     encuentra no existe). Esta landing ES la página compartible: quien
     llegó por el link puede re-tirarlo a su propio chat sin ser miembro. */
  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${id}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard denied — the button simply doesn't confirm */ }
  }

  useEffect(() => {
    let alive = true
    setPlan(undefined)
    publicPlan(id).then((p) => { if (alive) setPlan(p) })
    return () => { alive = false }
  }, [id])

  const join = async () => {
    // identidad sin resolver ≠ sin sesión (doctrina three-way, AuthContext):
    // en hard load del link compartido, el tap de un miembro rehidratando
    // NO puede rebotar a Create Account — se ignora el click, como
    // EventLanding.jsx hace en la misma ventana de milisegundos.
    if (authLoading) return
    if (!user) { navigate(`/auth?mode=create&next=${encodeURIComponent(`/p/${id}`)}`); return }
    if (joining) return
    setJoining(true); setErr('')
    try {
      const { thread_id } = await joinPlan(id)
      // unirse ES caer al room — si el plan no tiene room (no debería), la
      // lista de Messages sigue siendo la casa de todos los rooms
      navigate(thread_id ? `/messages/${thread_id}` : '/messages')
    } catch (e) {
      setErr(e?.message || 'something went wrong — try again.')
      setJoining(false)
    }
  }

  if (plan === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
        <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (plan === null) {
    return (
      <div style={{ padding: '90px 26px 60px', textAlign: 'center', maxWidth: '420px', margin: '0 auto' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>
          [&nbsp;A PLAN&nbsp;]
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 'clamp(30px, 9vw, 42px)', lineHeight: .95, letterSpacing: '.02em', margin: '18px 0 0', color: BONE }}>
          THIS PLAN ISN&rsquo;T ON THE MAP
        </h1>
        <p style={{ fontFamily: FONT_SANS, fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '14px auto 0', maxWidth: '300px' }}>
          It may have ended, gone private, or never existed. The city keeps moving — see what&rsquo;s happening now.
        </p>
        <button className="pressable" onClick={() => navigate('/')}
          style={{ marginTop: '24px', background: BONE, border: 'none', borderRadius: '10px', padding: '13px 22px', color: VOID, fontWeight: 600, fontSize: '13px', fontFamily: FONT_SANS, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          What&rsquo;s happening <ArrowRight size={14} />
        </button>
      </div>
    )
  }

  const c = plan.creator || {}
  const creatorName = c.name || c.username || 'a member'

  return (
    <div style={{ padding: '78px 26px 60px', maxWidth: '460px', margin: '0 auto' }}>
      <div className="rise" style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase', textAlign: 'center' }}>
        [&nbsp;A PLAN ON THE COLLECTIV4&nbsp;]
      </div>

      {/* THE chrome moment — the plan's own words */}
      <h1 className="rise rise-1" style={{
        ...chromeText, fontFamily: FONT_DISPLAY, fontWeight: 400,
        fontSize: 'clamp(32px, 9.5vw, 46px)', lineHeight: .95, letterSpacing: '.02em',
        margin: '16px 0 0', textAlign: 'center',
      }}>
        {plan.title}
      </h1>

      {/* when · where — mono catalog rows, only what exists */}
      <div className="rise rise-2" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '22px', padding: '16px', border: `1px solid ${HAIR_HI}`, borderRadius: '14px', background: CARD }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase', width: '46px', flexShrink: 0 }}>when</span>
          {/* regla del oro (v18): el cuándo es el dato vivo del plan */}
          <span style={{ fontFamily: FONT_MONO, fontSize: '12px', color: 'var(--gold-live)', letterSpacing: '.04em' }}>{planWhen(plan.starts_at)}</span>
        </div>
        {plan.spot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase', width: '46px', flexShrink: 0 }}>where</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: '12px', color: BONE, letterSpacing: '.04em' }}>{plan.spot}</span>
          </div>
        )}
      </div>

      {/* the plan's own voice — free text lands verbatim, never rewritten */}
      {plan.detail && (
        <p className="rise rise-3" style={{ fontFamily: FONT_SANS, fontSize: '14px', color: BONE_MID, lineHeight: 1.7, margin: '18px 0 0', whiteSpace: 'pre-wrap' }}>
          {plan.detail}
        </p>
      )}

      {/* who's making it happen — the card, never the roster (0029) */}
      <button className="rise rise-4 pressable" onClick={() => navigate(`/user/${c.id}`)}
        style={{ display: 'flex', alignItems: 'center', gap: '11px', width: '100%', textAlign: 'left', marginTop: '22px', padding: '12px 14px', background: 'none', border: `1px solid ${HAIR}`, borderRadius: '12px', cursor: 'pointer' }}>
        {safeImg(c.avatar_url)
          ? <img src={c.avatar_url} alt="" style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HAIR_HI}` }} />
          : <span aria-hidden style={{ width: '34px', height: '34px', borderRadius: '50%', border: `1px solid ${HAIR_HI}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_MONO, fontSize: '12px', color: BONE_LOW }}>◇</span>}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase' }}>made by</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '2px' }}>
            <span style={{ fontFamily: FONT_SANS, fontSize: '13.5px', color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creatorName}</span>
            <SeedPill is_demo={c.is_demo} />
          </span>
        </span>
        {c.city && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <MapPin size={10} style={{ color: BONE_LOW }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW }}>{c.city}</span>
          </span>
        )}
      </button>

      {/* the conversion — one button, the whole funnel */}
      <div className="rise rise-5" style={{ marginTop: '26px' }}>
        <button onClick={join} disabled={joining} className="pressable" data-testid="plan-join"
          style={{ width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13.5px', fontFamily: FONT_SANS, cursor: joining ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: joining ? .6 : 1 }}>
          {joining ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <>I&rsquo;m in <ArrowRight size={15} /></>}
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', textAlign: 'center', marginTop: '10px', minHeight: '13px' }}>
          {authLoading ? '' : user ? 'you land in the plan’s room' : 'create your account · land in the plan’s room'}
        </div>
        {err && <div style={{ fontFamily: FONT_MONO, fontSize: '9.5px', color: 'var(--warn)', textAlign: 'center', marginTop: '10px' }}>⚠ {err}</div>}
        {/* the door link, right where the door is — drop it in any chat */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '14px' }}>
          <button className="pressable" data-testid="landing-copy-link" onClick={copyLink}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(var(--ink-rgb),.05)', border: `1px solid ${HAIR}`, borderRadius: '100px', padding: '7px 14px', color: copied ? BONE : BONE_MID, cursor: 'pointer', fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.14em', textTransform: 'uppercase' }}>
            {copied ? <Check size={10} /> : <Link2 size={10} />}
            {copied ? 'copied — drop it anywhere' : 'copy the door link'}
          </button>
        </div>
      </div>
    </div>
  )
}
