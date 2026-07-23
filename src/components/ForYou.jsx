import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWide } from '@/lib/useIsDesktop'
import { fetchForYou, reasonsFor, eventReasonsFor } from '@/lib/forYou'
import { socialReady, follow, unfollow, startDM } from '@/lib/social'
import { VOCAB } from '@/lib/socialVocab'
import { isOwnerFounder } from '@/lib/osAccess'
import SeedPill, { SEED_BORDER } from '@/components/SeedMark'
import { categoryMeta } from '@/lib/crafts'
import { vibeMeta } from '@/lib/match'
import { Plus, UserCheck, MapPin, MessageCircle } from 'lucide-react'
import VerifiedMark from './VerifiedMark'
import { CARD_TINT, cardGlass } from '@/lib/glass'
import { tintChannel } from '@/lib/cosmos'
import { StateChip } from '@/components/Chip'

/* =========================================================================
   FOR YOU — the discovery feed (D2 · 0022): local talent, worlds and
   rooms matched by taste + crafts + follows + event character. Taste-based,
   never follower-based — serendipity with purpose.

   PRIVACY LAW (the product's soul): the ranking may use private taste
   invisibly, but the UI names ONLY speakable overlaps — shared crafts,
   shared PUBLIC tastes, shared sounds, city (lib/forYou.js composes them).
   A high match with nothing nameable gets the quiet line, nothing more.

   ── v16 — EL REDISEÑO DEL SKETCH DE DIEGO ────────────────────────────────
   UNA persona domina el viewport: tarjetas casi pantalla completa, scroll
   vertical con snap suave para pasar a la siguiente (tipo Tinder, pero el
   gesto es scroll, no swipe). La cápsula es glass simétrica con la foto de
   fondo FULL-BLEED — la máscara llega al 100% y el contraste lo pone el
   scrim (el estándar que Community ya conquistó; la máscara al 88% ya
   causó una regresión y no se repite). Avatar y nombre centrados y altos,
   craft + ubicación abajo del nombre, acciones (follow / message) al pie.
   Las dos composiciones alternadas de v10-v12 murieron: una sola cápsula,
   simétrica, con margen consistente al ancho de pantalla.

   HONESTIDAD DEL COPY: no hay algoritmo de matching real — el RPC agrupa
   por señales públicas compartidas y ordena; desde 0054 el score ORDENA
   pero nunca excluye (todos los perfiles reales aparecen). El copy sigue
   diciendo sólo lo que el sistema hace de verdad.

   SNAP: el contenedor de scroll es la ventana, así que el snap vive en
   <html> (html.c4-snap-feed, index.css) — `proximity`, no `mandatory`,
   para que el encabezado de Community siga alcanzable sin pelear.
   ========================================================================= */

const VOID = 'var(--bg)'
const BONE = 'var(--cream)'
const BONE_MID = 'var(--cream-soft)'
const BONE_LOW = 'var(--cream-dim)'
const SILVER = 'var(--silver)'
const CARD = CARD_TINT
const HAIR = 'rgba(var(--ink-rgb),0.08)'
const HAIR_HI = 'rgba(var(--ink-rgb),0.15)'
const WARN = 'var(--warn)'

/* EL ESTÁNDAR DE LA PORTADA (Community.jsx lo escribió, v16 lo comparte de
   facto): la máscara llega al 100% — la foto EXISTE hasta abajo — y la
   legibilidad la garantiza el scrim por tema (--card-cover-scrim, con sus
   α asimétricas medidas para AA en claro). Separar esos dos trabajos ya
   causó la regresión "la cover se volvió a subir"; no se repite. */
const CARD_COVER_MASK = 'linear-gradient(180deg, #000 0%, #000 62%, rgba(0,0,0,.85) 78%, rgba(0,0,0,.6) 90%, rgba(0,0,0,.4) 100%)'
const CARD_COVER_SCRIM = 'var(--card-cover-scrim)'

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : 'DATE TBA'

export default function ForYou({ user, onBrainstorm, onEveryone }) {
  const navigate = useNavigate()
  const wide = useWide()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  // follow chips only render when the social layer can keep their promise
  // (Ley 9 — the socialReady probe, same doctrine as everywhere else)
  const [socialOn, setSocialOn] = useState(false)
  const [followOverride, setFollowOverride] = useState({})   // id → optimistic truth
  const [followErr, setFollowErr] = useState({})             // id → honest rollback voice
  // guardrail 4 in the for-you (v10 · N1): 0036 made the seed RANK here for
  // founders — 0040 makes it LABELED. Same derivation Community uses: the
  // /os SHOW SEED switch (localStorage) + the owner check. Display-gating
  // only — a non-owner's payload never carries a seed row to begin with.
  const [showSeed, setShowSeed] = useState(false)

  useEffect(() => {
    let alive = true
    socialReady().then((ok) => { if (alive) setSocialOn(ok) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    let seedPref = import.meta.env?.VITE_DISCOVERY_PREVIEW === 'true'
    try { seedPref = seedPref || localStorage.getItem('c4_seed_visible') === '1' } catch { /* private mode */ }
    if (!user || !seedPref) { setShowSeed(false); return undefined }
    isOwnerFounder().then((ok) => { if (alive) setShowSeed(!!ok) })
    return () => { alive = false }
  }, [user])

  useEffect(() => {
    let alive = true
    setLoading(true)
    /* v16: límite 200 — desde 0054 el RPC no excluye a nadie real, y el
       cliente pide el techo completo para que "todos" sea verdad aquí. */
    fetchForYou({ limit: 200 }).then((d) => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [user?.id])

  /* el snap del feed vive en <html> mientras esta vista está montada —
     mismo mecanismo que body.wide-full (una clase, un dueño, cleanup) */
  useEffect(() => {
    document.documentElement.classList.add('c4-snap-feed')
    return () => document.documentElement.classList.remove('c4-snap-feed')
  }, [])

  // the rhythm: ~3 people, then a room, repeat — events run out first, fine.
  // A room without a slug has no door and doesn't render (Ley 9).
  // Seed rows (owner-only in the payload, 0040) honor the /os toggle the
  // way Community does: SHOW SEED off = seed hidden, never unlabeled
  // (review catch — the founder must never mistake a fixture for a member).
  const feed = useMemo(() => {
    const people = (data?.people || []).filter((p) => !p.is_demo || showSeed)
    const events = (data?.events || []).filter((ev) => ev?.slug)
    const out = []
    let e = 0
    people.forEach((p, i) => {
      out.push({ kind: 'person', p })
      if ((i + 1) % 3 === 0 && e < events.length) out.push({ kind: 'event', ev: events[e++] })
    })
    while (e < events.length) out.push({ kind: 'event', ev: events[e++] })
    return out
  }, [data, showSeed])

  const isFollowing = (p) => followOverride[p.id] ?? !!p.i_follow
  // optimistic + honest rollback WITH a voice (the UserProfile doctrine);
  // follow() itself retries through ensure_own_profile on 23503
  const toggleFollow = async (p) => {
    if (!user?.id) return
    const was = isFollowing(p)
    setFollowOverride((s) => ({ ...s, [p.id]: !was }))
    setFollowErr((s) => ({ ...s, [p.id]: '' }))
    try {
      if (was) await unfollow(user.id, p.id)
      else await follow(user.id, p.id)
    } catch (err) {
      setFollowOverride((s) => ({ ...s, [p.id]: was }))
      setFollowErr((s) => ({ ...s, [p.id]: err?.message || "that didn't land — try again" }))
    }
  }

  /* MESSAGE = sólo abrir el hilo directo (la misma decisión de Diego que
     Community ya obedece: message y connect son dos cosas distintas). */
  const openDM = async (p) => {
    if (!user?.id) return
    try { navigate(`/messages/${await startDM(p.id)}`) }
    catch { navigate('/messages') }   // el hilo no abrió → la bandeja, nunca una pantalla muerta
  }

  const city = (data?.city || '').toLowerCase()
  const empty = !loading && (!data || (!data.people?.length && !data.events?.length))

  /* v16 — la geometría de la cápsula dominante: casi todo el viewport menos
     el aire del encabezado y la barra. Una constante, ambas tarjetas. */
  const CARD_H = wide ? 'min(74vh, 700px)' : 'calc(100dvh - 218px)'

  return (
    /* v16: columna centrada SIEMPRE — el masonry de escritorio murió con el
       sketch (una persona domina el viewport también en laptop; la cápsula
       conserva proporción de teléfono, centrada como pieza). */
    <div style={{ maxWidth: wide ? '520px' : undefined, marginInline: wide ? 'auto' : undefined }}>

      {/* the kicker — where the matching stands, city lowercase-proud */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '9px', marginTop: '18px' }}>
        <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER }}>◇</span>
        <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em' }}>
          MATCHED BY TASTE{city ? ` · ${city}` : ''}
        </span>
      </div>

      {loading ? (
        /* un solo marco alto y tenue — la silueta de la cápsula que viene */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '14px' }}>
          {[0, 1].map((i) => (
            <div key={i} aria-hidden style={{ height: i === 0 ? CARD_H : '120px', borderRadius: '26px', border: `1px solid ${HAIR}`, background: 'rgba(var(--ink-rgb),.015)' }} />
          ))}
        </div>
      ) : empty ? (
        /* the honest empty — a quiet moment, two doors (Ley 11) */
        <div data-testid="foryou-empty" style={{ minHeight: '52vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', textAlign: 'center', padding: '40px 24px' }}>
          <span className="rise" aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '11px', color: BONE_LOW, animationDelay: '0ms' }}>◇</span>
          <div className="rise" style={{ fontFamily: 'DM Sans', fontSize: '14.5px', color: BONE_MID, lineHeight: 1.6, maxWidth: '280px', animationDelay: '70ms' }}>
            the universe hasn't heard your taste yet.
          </div>
          {/* buttons WRAPPED in .rise (never on the button itself — a filled
              rise animation outranks :active; plan 005's settled correction) */}
          <div className="rise" style={{ animationDelay: '140ms', display: 'flex' }}>
            <button className="press-spring" onClick={onBrainstorm}
              style={{ marginTop: '8px', background: BONE, border: 'none', borderRadius: '100px', padding: '13px 24px', color: VOID, fontFamily: 'DM Sans', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              brainstorm your taste →
            </button>
          </div>
          <div className="rise" style={{ animationDelay: '210ms', display: 'flex' }}>
            <button className="pressable" onClick={onEveryone}
              style={{ background: 'transparent', border: 'none', padding: '6px 10px', cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em' }}>
              or wander everyone ↓
            </button>
          </div>
        </div>
      ) : (
        <div data-testid="foryou-feed" className="feed-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '14px' }}>
          {feed.map((item) => {
            const key = item.kind === 'person' ? item.p.id : item.ev.slug
            return item.kind === 'person' ? (
              <PersonCard key={key} p={item.p} showSeed={showSeed} height={CARD_H}
                following={isFollowing(item.p)} canFollow={socialOn} err={followErr[item.p.id]}
                onOpen={() => navigate('/user/' + item.p.id)}
                onFollow={() => toggleFollow(item.p)}
                onMessage={() => openDM(item.p)} />
            ) : (
              <EventCard key={key} ev={item.ev} onOpen={() => navigate('/e/' + item.ev.slug)} />
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---- a person, as the content (Ley 6) — la cápsula dominante v16 ----
   Foto full-bleed detrás de todo (máscara 100% + scrim por tema), avatar y
   nombre centrados y altos, craft + ciudad, razones nombrables, y las dos
   acciones al pie. El FOLLOWING vive como StateChip arriba a la derecha —
   la MISMA posición que Community usa desde v16, con respaldo legible
   sobre cualquier foto. */
function PersonCard({ p, showSeed, height, following, canFollow, err, onOpen, onFollow, onMessage }) {
  const cover = safeImg(p.cover_url)
  const avatar = safeImg(p.avatar_url)
  const name = p.name || p.username || 'Unnamed'
  // guardrail 4 (v10): a seed world in the feed is ALWAYS marked — the pill
  // rides the payload truth (is_demo), never the toggle. A member's payload
  // carries is_demo: false by construction (0040/0054). ONE source: SeedMark.
  const isSeed = !!p.is_demo
  const initial = (name[0] || '?').toUpperCase()
  const crafts = Array.isArray(p.crafts) ? p.crafts : []
  const primary = crafts.find((c) => c.is_primary) || crafts[0]
  const meta = primary ? categoryMeta(primary.category) : null
  const reasons = reasonsFor(p)
  const keyOpen = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen() } }

  return (
    <div data-testid={`foryou-person-${p.id}`} role="button" tabIndex={0}
      aria-label={`Open ${name}'s world`} onClick={onOpen} onKeyDown={keyOpen}
      className="disc-card"
      style={{
        position: 'relative', height, minHeight: '420px',
        borderRadius: '26px', overflow: 'hidden',
        border: `1px solid ${isSeed ? SEED_BORDER : HAIR_HI}`,
        cursor: 'pointer',
        scrollSnapAlign: 'start', scrollMarginTop: '14px',
        display: 'flex', flexDirection: 'column',
        ...cardGlass(),
      }}>

      {/* LA FOTO — full-bleed, nunca cortada: capa absoluta inset:0 con la
          máscara al 100% y el scrim por tema encima (el estándar de
          Community; disc-banner va en el contenedor de la IMG para que la
          respiración de hover viva — contrato CSS de index.css). */}
      <div className="disc-banner" aria-hidden style={{
        position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none',
        WebkitMaskImage: CARD_COVER_MASK, maskImage: CARD_COVER_MASK,
      }}>
        {cover
          ? <img src={cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: '200px', lineHeight: 1, color: 'rgba(var(--ink-rgb),.05)' }}>{initial}</span>}
        <div style={{ position: 'absolute', inset: 0, background: CARD_COVER_SCRIM }} />
      </div>

      {/* los sellos — arriba: seed a la izquierda, FOLLOWING + verified a la
          derecha, posición idéntica a la de Community v16 */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
        <span style={{ display: 'inline-flex' }}>{isSeed && <SeedPill is_demo={p.is_demo} />}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {following && <StateChip label={VOCAB.followingState} mark={<UserCheck size={8} />} title="You follow this world" onPhoto />}
          {p.verified && <span title="In The Collectiv4 network" aria-label="Verified — in The Collectiv4 network" style={{ display: 'inline-flex' }}><VerifiedMark size={16} /></span>}
        </span>
      </div>

      {/* la identidad — centrada y ALTA en la cápsula (sketch de Diego) */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 'clamp(18px, 6%, 44px)', padding: '0 22px' }}>
        <div style={{ width: '76px', height: '76px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${SILVER}`, background: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 22px rgba(var(--shadow-rgb),.5)' }}>
          {avatar
            ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: 'Bebas Neue', fontSize: '31px', color: BONE }}>{initial}</span>}
        </div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(30px, 8.6vw, 38px)', letterSpacing: '.02em', lineHeight: 0.98, color: BONE, marginTop: '14px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 18px rgba(var(--shadow-rgb),.45)' }}>{name}</div>
        {p.username && (
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_MID, letterSpacing: '.18em', marginTop: '7px' }}>@{p.username}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '11px', minWidth: 0 }}>
          {primary && (
            <span style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: `rgb(${tintChannel(meta.tint)})`, letterSpacing: '.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {primary.name}{crafts.length > 1 ? `  +${crafts.length - 1}` : ''}
            </span>
          )}
          {primary && p.city && <span aria-hidden style={{ color: BONE_LOW, fontSize: '8px' }}>◇</span>}
          {p.city && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'DM Mono', fontSize: '8.5px', color: BONE_MID, letterSpacing: '.12em', textTransform: 'uppercase' }}>
              <MapPin size={9} /> {p.city}
            </span>
          )}
        </div>
      </div>

      {/* el aire — la foto vive aquí, sin nada encima */}
      <div style={{ flex: 1 }} />

      {/* el pie: razones nombrables + las dos acciones (sketch: abajo) */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 18px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div data-testid="foryou-reasons" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.08em', lineHeight: 1.65, textAlign: 'center' }}>
          {reasons.join(' · ')}
        </div>
        {p.follows_me && !following && (
          <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '4px 10px', background: 'rgba(var(--void-rgb),.35)' }}>follows you</span>
        )}
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          {canFollow && (
            <button className="press-spring" onClick={(ev) => { ev.stopPropagation(); onFollow() }}
              aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
              style={{
                flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                background: following ? 'rgba(var(--ink-rgb),.10)' : BONE,
                border: following ? `1px solid rgba(var(--ink-rgb),.30)` : '1px solid transparent',
                borderRadius: '100px', padding: '13px 12px',
                color: following ? BONE : VOID,
                fontFamily: 'DM Mono', fontSize: '9.5px', letterSpacing: '.18em', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'background .2s, border-color .2s, color .2s, transform var(--dur-spring) var(--ease-spring)',
              }}>
              {following ? <UserCheck size={11} /> : <Plus size={11} />}
              {following ? VOCAB.followingState : VOCAB.followAction}
            </button>
          )}
          <button className="press-spring" onClick={(ev) => { ev.stopPropagation(); onMessage() }}
            aria-label={`Message ${name}`}
            style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              background: 'rgba(var(--void-rgb),.38)', border: `1px solid rgba(var(--ink-rgb),.26)`,
              borderRadius: '100px', padding: '13px 12px', color: BONE,
              fontFamily: 'DM Mono', fontSize: '9.5px', letterSpacing: '.18em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'background .2s, border-color .2s, transform var(--dur-spring) var(--ease-spring)',
            }}>
            <MessageCircle size={11} /> Message
          </button>
        </div>
        {err && <div style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: WARN, letterSpacing: '.04em' }}>{err}</div>}
      </div>
    </div>
  )
}

/* ---- a room in the stream — it carries its declared temperature (Ley 14);
   undeclared renders clean, no invented character (Ley 11). v16: misma
   familia de cápsula (radio, glass), altura propia — un interludio entre
   personas, no una persona. ---- */
function EventCard({ ev, onOpen }) {
  const meta = ev.kind ? vibeMeta(ev.kind) : null
  const pulseClass = meta?.pulse === 'warm' ? 'temp-warm' : meta?.pulse === 'electric' ? 'temp-electric' : undefined
  const sounds = (Array.isArray(ev.sounds) ? ev.sounds : []).filter(Boolean).slice(0, 3)
  const reasons = eventReasonsFor(ev)
  const place = ev.venue || ev.city

  return (
    <div data-testid={`foryou-event-${ev.slug}`} className="pressable" role="button" tabIndex={0}
      aria-label={`Enter ${ev.title}`} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      style={{ position: 'relative', borderRadius: '26px', overflow: 'hidden', border: `1px solid ${meta ? `rgba(${tintChannel(meta.tint)},.28)` : HAIR_HI}`, cursor: 'pointer', padding: '20px 18px', scrollSnapAlign: 'start', scrollMarginTop: '14px', ...cardGlass() }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase' }}>A room</span>
        {meta && (
          <span className={pulseClass} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', border: `1px solid rgba(${tintChannel(meta.tint)},.4)`, background: `rgba(${tintChannel(meta.tint)},.06)`, borderRadius: '100px', padding: '3px 11px' }}>
            <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: `rgb(${tintChannel(meta.tint)})` }}>{meta.mark}</span>
            <span style={{ fontFamily: 'DM Mono', fontSize: '8.5px', letterSpacing: '.18em', textTransform: 'uppercase', color: BONE }}>{meta.label}</span>
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', letterSpacing: '.01em', lineHeight: .95, color: BONE, marginTop: '10px' }}>{ev.title}</div>
      <div style={{ fontFamily: 'DM Mono', fontSize: '9.5px', color: BONE_MID, letterSpacing: '.08em', marginTop: '8px' }}>
        {fmtDate(ev.event_date)}{place ? ` · ${String(place).toUpperCase()}` : ''}
      </div>
      {sounds.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
          {sounds.map((s) => (
            <span key={s} style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_MID, letterSpacing: '.1em', textTransform: 'lowercase', border: `1px solid ${HAIR}`, borderRadius: '100px', padding: '3px 9px' }}>{s}</span>
          ))}
        </div>
      )}
      {reasons.length > 0 && (
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.08em', lineHeight: 1.65, marginTop: '10px' }}>
          {reasons.join(' · ')}
        </div>
      )}
    </div>
  )
}
