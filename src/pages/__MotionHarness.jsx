import { useState } from 'react'
import { VOID, BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, CARD, HAIR, HAIR_HI, chromeText } from '@/lib/cosmos'

/* =========================================================================
   PREVIEW-ONLY harness — /__motion. Every one of the 31 ADITIVAS from the
   Fase 3 audit, playing on demand, using the REAL classes and values from
   src/index.css (no re-implementations, no fake curves).

   Why it exists: 7 of the 31 only fire behind real data/state (an empty
   events night, an incoming bell, a first publish, a fresh user's silent
   feed…). Forcing those into the live DB would mean real side effects —
   publishing a real event onto the public landing, seeding fake rows. This
   harness shows the motion honestly instead, with zero writes.

   HONESTY: this is the motion vocabulary in isolation, NOT the real surface.
   For the 24 that need no special state, judge them on the real screen —
   each row links to where it actually lives. The specimens here use the same
   class + the same tokens, so the CURVE and TIMING are true; the surrounding
   pixels are not.

   Registered in App.jsx ONLY when VITE_MOTION_HARNESS === '1' — statically
   excluded from every build without that flag, including production. Lives
   in its own commit so it can be dropped without touching the 31.
   ========================================================================= */

const mono = { fontFamily: 'DM Mono, monospace' }
const sans = { fontFamily: 'DM Sans, sans-serif' }

/* one row per additive */
function Row({ id, sev, title, where, note, mode, children, onReplay }) {
  return (
    <div style={{ borderTop: `1px solid ${HAIR}`, padding: '22px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
        <span style={{ ...mono, fontSize: '12px', color: BONE, letterSpacing: '.08em', fontWeight: 500 }}>{id}</span>
        <span style={{ ...mono, fontSize: '8px', letterSpacing: '.14em', textTransform: 'uppercase', color: sev === 'HIGH' ? 'var(--warn)' : sev === 'MEDIUM' ? SILVER : FAINT, border: `1px solid ${sev === 'HIGH' ? 'rgba(229,160,160,.35)' : sev === 'MEDIUM' ? 'rgba(var(--silver-rgb),.3)' : HAIR}`, borderRadius: '2px', padding: '2px 7px' }}>{sev}</span>
        <span style={{ ...sans, fontSize: '13.5px', color: BONE_MID }}>{title}</span>
        <span style={{ ...mono, fontSize: '9px', color: FAINT, letterSpacing: '.06em', marginLeft: 'auto' }}>{where}</span>
      </div>
      <div style={{ ...mono, fontSize: '9.5px', color: FAINT, letterSpacing: '.04em', marginBottom: '14px' }}>{note}</div>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <button className="pressable" onClick={onReplay}
          style={{ ...mono, flexShrink: 0, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', background: 'rgba(var(--ink-rgb),.06)', border: `1px solid ${HAIR_HI}`, borderRadius: '6px', padding: '9px 14px', color: BONE, cursor: 'pointer' }}>
          {mode === 'toggle' ? '⇄ alternar' : mode === 'live' ? '▶ probar' : '▶ replay'}
        </button>
        <div style={{ flex: 1, minWidth: '260px', border: `1px dashed ${HAIR}`, borderRadius: '10px', padding: '18px', background: 'rgba(var(--ink-rgb),.012)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function MotionHarness() {
  // one replay counter per additive — bumping it remounts the specimen so the
  // CSS animation replays (the same trick the app uses with key={})
  const [n, setN] = useState({})
  const bump = (k) => setN(s => ({ ...s, [k]: (s[k] || 0) + 1 }))
  const k = (id) => n[id] || 0

  // interactive states
  const [signup, setSignup] = useState(true)          // A-06
  const [sold, setSold] = useState(false)             // A-10
  const [view, setView] = useState('list')            // A-12
  const [filt, setFilt] = useState('review')          // A-13
  const [read, setRead] = useState(false)             // A-16
  const [star, setStar] = useState(false)             // A-17
  const [notice, setNotice] = useState(false)         // A-18
  const [brief, setBrief] = useState(false)           // A-25
  const [verif, setVerif] = useState(false)           // A-27
  const [tab, setTab] = useState('foryou')            // A-29
  const [vis, setVis] = useState('friends')           // A-30

  const card = { border: `1px solid ${HAIR}`, background: CARD, borderRadius: '12px', padding: '13px 15px', ...sans, fontSize: '13px', color: BONE }
  const chip = { display: 'inline-flex', alignItems: 'center', gap: '7px', borderRadius: '100px', padding: '6px 12px', background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR_HI}`, ...mono, fontSize: '10.5px', letterSpacing: '.08em', textTransform: 'uppercase', color: BONE_MID }

  return (
    <div style={{ background: VOID, minHeight: '100vh', padding: '46px 22px 120px' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <div style={{ ...mono, fontSize: '10px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ preview-only · feat/motion-aditivas</div>
        <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(38px,8vw,64px)', lineHeight: .9, margin: '12px 0 0', ...chromeText }}>LAS 31, TODAS PRENDIDAS</h1>
        <p style={{ ...sans, fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '16px 0 0', maxWidth: '60ch' }}>
          Cada aditiva con su clase y sus valores REALES de <code style={{ ...mono, fontSize: '12px', color: STAR }}>src/index.css</code> — curva de la casa
          <code style={{ ...mono, fontSize: '12px', color: STAR }}> cubic-bezier(.2,.7,.2,1)</code>, sin springs, sin bounce.
          Dale replay las veces que quieras.
        </p>
        <p style={{ ...mono, fontSize: '10px', color: FAINT, lineHeight: 1.7, margin: '14px 0 0', maxWidth: '70ch' }}>
          △ esto es el vocabulario en aislamiento, NO la pantalla real. Las 24 que no necesitan
          estado especial, júzgalas en su superficie (la columna derecha dice dónde). Las 7 que
          sólo salen con datos reales, aquí es donde se pueden ver sin efectos secundarios.
        </p>

        <div style={{ marginTop: '34px' }}>

          {/* ============ las 7 que sólo se ven aquí ============ */}
          <div style={{ ...mono, fontSize: '9px', color: STAR, letterSpacing: '.26em', textTransform: 'uppercase', margin: '26px 0 6px' }}>
            ● las 7 que necesitan datos reales — aquí es donde se ven
          </div>

          <Row id="A-01" sev="HIGH" title="El silencio del usuario nuevo sube escalonado" where="/community · FOR YOU" note="rise ×4 · 500ms · delays 0/70/140/210ms — necesita un usuario nuevo sin taste" onReplay={() => bump('a1')}>
            <div key={k('a1')} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <span className="rise" style={{ ...mono, fontSize: '11px', color: BONE_LOW, animationDelay: '0ms' }}>◇</span>
              <div className="rise" style={{ ...sans, fontSize: '14.5px', color: BONE_MID, maxWidth: '280px', animationDelay: '70ms' }}>the universe hasn't heard your taste yet.</div>
              <div className="rise" style={{ animationDelay: '140ms', display: 'flex' }}>
                <button className="pressable" style={{ background: BONE, border: 'none', borderRadius: '11px', padding: '13px 24px', color: VOID, ...sans, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>brainstorm your taste →</button>
              </div>
              <div className="rise" style={{ animationDelay: '210ms', display: 'flex' }}>
                <button className="pressable" style={{ background: 'transparent', border: 'none', ...mono, fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', cursor: 'pointer' }}>or wander everyone ↓</button>
              </div>
            </div>
          </Row>

          <Row id="A-14" sev="MEDIUM" title="La noche sin salas entra en cascada" where="/ (home)" note="card-in ×2 · 500ms · delays 0/100ms — sólo cuando NO hay salas próximas" onReplay={() => bump('a14')}>
            <div key={k('a14')} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="card-in" style={{ ...card, padding: '26px 22px', animationDelay: '0ms' }}>
                <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '46px', lineHeight: .85, color: BONE, opacity: .92 }}>00</div>
                <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '26px', letterSpacing: '.03em', marginTop: '10px' }}>NO ROOMS OPEN TONIGHT</div>
                <p style={{ ...sans, fontSize: '13px', color: BONE_MID, lineHeight: 1.6, marginTop: '10px' }}>The next one is being built. Stay close — the room always comes back.</p>
              </div>
              <div className="card-in" style={{ animationDelay: '100ms' }}>
                <div style={{ ...mono, fontSize: '8px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase', marginBottom: '9px' }}>the last room</div>
                <div style={{ ...card, height: '64px' }} />
              </div>
            </div>
          </Row>

          <Row id="A-08" sev="MEDIUM" title="El badge de la campana llega, no aparece" where="nav (todas)" note="badge-in · scale(.8)→1 + fade · 200ms — necesita una señal entrante" onReplay={() => bump('a8')}>
            <div key={k('a8')} style={{ position: 'relative', display: 'inline-flex', padding: '10px 14px' }}>
              <span style={{ ...mono, fontSize: '11px', color: BONE_MID, letterSpacing: '.14em' }}>◇ MESSAGES</span>
              <span className="badge-in" style={{ position: 'absolute', top: '-2px', right: '-9px', minWidth: '14px', height: '14px', borderRadius: '100px', background: BONE, color: VOID, ...mono, fontSize: '8.5px', fontWeight: 700, lineHeight: '14px', textAlign: 'center', padding: '0 3px' }}>3</span>
            </div>
          </Row>

          <Row id="A-16" sev="MEDIUM" title="Mark all read se funde, no teletransporta" where="/messages · Bell" mode="toggle" note="background + border-color + opacity · 250ms — necesita señales sin leer" onReplay={() => setRead(r => !r)}>
            {[0, 1].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 6px', borderTop: i > 0 ? `1px solid ${HAIR}` : 'none', background: !read ? 'rgba(232,233,237,.03)' : 'transparent', transition: 'background-color var(--dur-base) var(--ease-house)' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', border: `1px solid ${!read ? SILVER : HAIR_HI}`, background: CARD, transition: 'border-color var(--dur-base) var(--ease-house)', flexShrink: 0 }} />
                <div style={{ flex: 1, ...sans, fontSize: '13px', fontWeight: !read ? 700 : 500, color: !read ? BONE : BONE_MID }}>señal {i + 1}</div>
                <span aria-hidden style={{ width: '5px', height: '5px', borderRadius: '50%', background: STAR, boxShadow: '0 0 6px rgba(232,233,237,.6)', opacity: !read ? 1 : 0, transition: 'opacity var(--dur-base) var(--ease-house)' }} />
              </div>
            ))}
            <div style={{ ...mono, fontSize: '9px', color: FAINT, marginTop: '10px' }}>estado: {read ? 'leídas' : 'sin leer'} · ojo al hueco que el punto reserva cuando está leído</div>
          </Row>

          <Row id="A-30" sev="LOW" title="Los pills de visibilidad transicionan" where="/e/:slug" mode="toggle" note="border + background + color + opacity · 200ms — necesita login + estar going" onReplay={() => setVis(v => v === 'friends' ? 'everyone' : v === 'everyone' ? 'private' : 'friends')}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['friends', 'everyone', 'private'].map(t => {
                const on = vis === t
                return (
                  <button key={t} onClick={() => setVis(t)} style={{ flex: 1, borderRadius: '100px', padding: '8px', cursor: 'pointer', border: `1px solid ${on ? 'rgba(var(--silver-rgb),.5)' : 'rgba(var(--ink-rgb),.14)'}`, background: on ? 'rgba(var(--silver-rgb),.1)' : 'transparent', color: on ? BONE : BONE_LOW, ...mono, fontSize: '9px', letterSpacing: '.06em', textTransform: 'uppercase', transition: 'border-color var(--dur-fast) var(--ease-house), background var(--dur-fast) var(--ease-house), color var(--dur-fast) var(--ease-house), opacity var(--dur-fast) var(--ease-house)' }}>{t}</button>
                )
              })}
            </div>
          </Row>

          <Row id="A-10" sev="MEDIUM" title="La pieza vendida se retira del muro" where="/user/:id · OFFER" mode="toggle" note="opacity 1→.62 + border-color · 250ms — necesita una pieza en venta" onReplay={() => setSold(s => !s)}>
            <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${!sold ? HAIR_HI : HAIR}`, background: CARD, opacity: !sold ? 1 : .62, transition: 'opacity var(--dur-base) var(--ease-house), border-color var(--dur-base) var(--ease-house)', padding: '16px' }}>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '20px', color: BONE }}>PIEZA · $120</div>
              <div style={{ ...mono, fontSize: '9px', color: BONE_LOW, letterSpacing: '.14em', marginTop: '6px' }}>{sold ? 'SOLD' : 'LIVE'}</div>
            </div>
          </Row>

          <Row id="A-26" sev="LOW" title="La fila que acaba de salir en vivo asienta" where="/os · Events" note="os-settle · scale(.98)→1 + flash de borde · 200ms — dispararla publicaría un evento REAL" onReplay={() => bump('a26')}>
            <div key={k('a26')} className="os-settle" style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ ...sans, fontSize: '14px', fontWeight: 600 }}>Fall 001</span>
              <span style={{ ...mono, fontSize: '8px', color: STAR, border: `1px solid ${HAIR_HI}`, borderRadius: '4px', padding: '2px 7px', letterSpacing: '.14em' }}>LIVE</span>
            </div>
          </Row>

          {/* ============ las 24 en contexto ============ */}
          <div style={{ ...mono, fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase', margin: '40px 0 6px' }}>
            ○ las otras 24 — aquí de referencia, júzgalas en su pantalla real
          </div>

          <Row id="A-15" sev="MEDIUM" title="El héroe de la portada sube escalonado" where="/c4" note="fade-up ×4 · 550ms · delays 0/100/200/300ms" onReplay={() => bump('a15')}>
            <div key={k('a15')}>
              <div className="fade-up" style={{ ...mono, fontSize: '9px', color: BONE_LOW, letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: '10px' }}>◇ the house world · Houston</div>
              <div className="fade-up-1" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '44px', lineHeight: .88, ...chromeText }}>THE COLLECTIV4</div>
              <p className="fade-up-2" style={{ ...sans, fontSize: '13.5px', color: BONE_MID, lineHeight: 1.7, margin: '14px 0 0' }}>A creative movement at the intersection of music, art and human connection.</p>
              <div className="fade-up-3" style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button className="pressable" style={{ background: BONE, border: 'none', borderRadius: '11px', padding: '11px 20px', color: VOID, fontFamily: 'Bebas Neue, sans-serif', fontSize: '15px', letterSpacing: '.06em', cursor: 'pointer' }}>MEET THE COMMUNITY</button>
              </div>
            </div>
          </Row>

          <Row id="A-04" sev="HIGH" title="Los 4 capítulos entran en cascada" where="/c4" note="card-in ×4 · 500ms · delays 0/70/140/210ms" onReplay={() => bump('a4')}>
            <div key={k('a4')} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['01 THE ROOMS', '02 THE NETWORK', '03 THE CULTURE', '04 THE OFFER'].map((t, i) => (
                <div key={t} className="card-in" style={{ ...card, animationDelay: `${i * 70}ms`, fontFamily: 'Bebas Neue, sans-serif', fontSize: '20px', letterSpacing: '.05em' }}>{t}</div>
              ))}
            </div>
          </Row>

          <Row id="A-02" sev="HIGH" title="La ceremonia del mundo publicado" where="/profile · publicar" note="rise + rise-1..4 · 500ms · 120/200/280/360ms — la salida simétrica NO se implementó" onReplay={() => bump('a2')}>
            <div key={k('a2')} style={{ textAlign: 'center' }}>
              <div className="rise" style={{ ...mono, fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ published</div>
              <div className="rise rise-1" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '40px', lineHeight: .95, marginTop: '14px', ...chromeText }}>YOUR WORLD<br />IS LIVE</div>
              <p className="rise rise-2" style={{ ...sans, fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, marginTop: '14px' }}>Your card in Discover. Your museum. Yours.</p>
              <div className="rise rise-3" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                <button className="pressable" style={{ width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '13px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: 'pointer', ...sans }}>SEE IT AS THE WORLD SEES IT</button>
              </div>
              <div className="rise rise-4" style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                <button className="pressable" style={{ background: 'transparent', border: 'none', color: BONE_LOW, ...mono, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>keep curating</button>
              </div>
            </div>
          </Row>

          <Row id="A-05" sev="HIGH" title="El plan recién creado sube a la lista" where="/messages · PLANS" note="msg-in · translateY(4px)→0 + fade · 200ms" onReplay={() => bump('a5')}>
            <div key={k('a5')} className="msg-in" style={{ ...card }}>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '19px', letterSpacing: '.02em' }}>CENA EN MONTROSE</div>
              <div style={{ ...mono, fontSize: '9px', color: BONE_LOW, letterSpacing: '.1em', marginTop: '5px' }}>viernes · 8pm</div>
            </div>
          </Row>

          <Row id="A-03" sev="HIGH" title="Press feedback en los CTAs" where="/experience/:slug" mode="live" note="pressable · translateY(1px) scale(.99) · 160ms entra / 80ms suelta — MANTÉN PRESIONADO" onReplay={() => {}}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="pressable" style={{ background: BONE, border: 'none', borderRadius: '12px', padding: '15px 22px', color: VOID, ...sans, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>GET YOUR TICKET</button>
              <button className="pressable" style={{ background: 'rgba(var(--void-rgb),.5)', border: `1px solid ${HAIR_HI}`, borderRadius: '8px', padding: '9px 16px', color: BONE_MID, ...sans, fontSize: '12px', cursor: 'pointer' }}>← Back</button>
            </div>
          </Row>

          <Row id="A-19" sev="MEDIUM" title="La flecha del archivo responde" where="/editions" mode="live" note="pressable + color 200ms — PRESIÓNALA" onReplay={() => {}}>
            <button className="pressable" style={{ background: 'none', border: 'none', color: BONE_MID, cursor: 'pointer', fontSize: '20px', transition: 'color var(--dur-fast) var(--ease-house)' }}
              onMouseOver={e => { e.currentTarget.style.color = BONE }} onMouseOut={e => { e.currentTarget.style.color = BONE_MID }}>←</button>
          </Row>

          <Row id="A-31" sev="LOW" title="La sala destacada respira (sin levantarse)" where="/ (home)" mode="live" note="feat-room · border 500ms + discBreathe 6s — PASA EL CURSOR (desktop)" onReplay={() => {}}>
            <div className="feat-room" style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(var(--ink-rgb),.16)', background: CARD, cursor: 'pointer' }}>
              <div className="disc-banner" style={{ height: '120px', background: 'linear-gradient(150deg, rgba(var(--silver-rgb),.16), rgba(var(--silver-rgb),.02))', overflow: 'hidden' }}>
                <svg width="100%" height="120" style={{ display: 'block' }}><circle cx="50%" cy="60" r="34" fill="none" stroke={SILVER} strokeWidth="1" opacity=".5" /></svg>
              </div>
              <div style={{ padding: '14px 16px', fontFamily: 'Bebas Neue, sans-serif', fontSize: '24px', letterSpacing: '.03em' }}>FALL 001</div>
            </div>
          </Row>

          <Row id="A-29" sev="LOW" title="FOR YOU ⇄ EVERYONE cruza-funde" where="/community" mode="toggle" note="refilter-in · opacity .4→1 + blur(2px)→0 · 200ms" onReplay={() => setTab(t => t === 'foryou' ? 'everyone' : 'foryou')}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              {['foryou', 'everyone'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ ...mono, fontSize: '10px', letterSpacing: '.16em', textTransform: 'uppercase', background: 'transparent', border: 'none', color: tab === t ? BONE : FAINT, cursor: 'pointer', padding: '4px 0' }}>{t === 'foryou' ? 'for you' : 'everyone'}</button>
              ))}
            </div>
            <div key={tab} className="refilter-in" style={{ ...card }}>
              {tab === 'foryou' ? 'tu feed compuesto por gusto' : 'todos los mundos del universo'}
            </div>
          </Row>

          <Row id="A-07" sev="MEDIUM" title="El feed For You surface como uno solo" where="/community · FOR YOU" note="feed-in · fade 200ms — opacity sola, sin stagger por columnas" onReplay={() => bump('a7')}>
            <div key={k('a7')} className="feed-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ ...card, height: '52px' }} />
              <div style={{ ...card, height: '38px' }} />
              <div style={{ ...card, height: '52px' }} />
            </div>
          </Row>

          <Row id="A-06" sev="MEDIUM" title="La fila de nombre colapsa, no salta" where="Auth · modal y /auth" mode="toggle" note="row-collapse · grid-template-rows 0fr⇄1fr · 250ms (interrumpible)" onReplay={() => setSignup(s => !s)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="row-collapse" style={{ display: 'grid', gridTemplateRows: signup ? '1fr' : '0fr', opacity: signup ? 1 : 0 }}>
                <div style={{ overflow: 'hidden', minHeight: 0 }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input readOnly placeholder="First name" style={{ flex: 1, background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR_HI}`, borderRadius: '8px', padding: '12px', color: BONE, ...sans, fontSize: '13px' }} />
                    <input readOnly placeholder="Last name" style={{ flex: 1, background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR_HI}`, borderRadius: '8px', padding: '12px', color: BONE, ...sans, fontSize: '13px' }} />
                  </div>
                </div>
              </div>
              <input readOnly placeholder="Email" style={{ background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR_HI}`, borderRadius: '8px', padding: '12px', color: BONE, ...sans, fontSize: '13px' }} />
              <div style={{ ...mono, fontSize: '9px', color: FAINT }}>modo: {signup ? 'Create Account' : 'Sign In'} · ojo al espacio que queda en Sign In</div>
            </div>
          </Row>

          <Row id="A-09" sev="MEDIUM" title="El chip de vínculo sube al cambiar" where="/community · buscar" note="bond-in · msgIn 200ms — sólo tras la acción, nunca al listar" onReplay={() => bump('a9')}>
            <div key={k('a9')} className="bond-in" style={{ ...chip, color: SILVER }}>✓ CONNECTED</div>
          </Row>

          <Row id="A-17" sev="MEDIUM" title="La estrella se enciende como estrella" where="/messages · CREWS" mode="toggle" note="fill-opacity + color + filter · 250ms (no checkbox)" onReplay={() => setStar(s => !s)}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill={STAR} strokeWidth="1.6" stroke="currentColor"
              style={{ fillOpacity: star ? 1 : 0, color: star ? STAR : BONE_LOW, filter: star ? 'drop-shadow(0 0 6px rgba(232,233,237,.5))' : 'drop-shadow(0 0 0 rgba(232,233,237,0))', transition: 'fill-opacity var(--dur-base) var(--ease-house), color var(--dur-base) var(--ease-house), filter var(--dur-base) var(--ease-house)' }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </Row>

          <Row id="A-22" sev="LOW" title="WORLDS IN ORBIT entra, no aparece" where="/user/:id" note="card-in · fadeUp 500ms" onReplay={() => bump('a22')}>
            <div key={k('a22')} className="card-in">
              <div style={{ ...mono, fontSize: '10px', color: SILVER, letterSpacing: '.2em', marginBottom: '10px' }}>◇ WORLDS IN ORBIT</div>
              <div style={{ display: 'flex', gap: '10px' }}>{[0, 1, 2].map(i => <div key={i} style={{ ...card, width: '86px', height: '58px' }} />)}</div>
            </div>
          </Row>

          <Row id="A-20" sev="LOW" title="El craft elegido aterriza en tu fila" where="/profile · editar" note="chip-in · menuIn scale(.96)→1 · 160ms" onReplay={() => bump('a20')}>
            <div key={k('a20')} className="chip-in" style={chip}>◆ PRODUCER</div>
          </Row>

          <Row id="A-23" sev="LOW" title="El taste aterriza en tu set" where="/profile · editar" note="chip-in · menuIn scale(.96)→1 · 160ms" onReplay={() => bump('a23')}>
            <div key={k('a23')} className="chip-in" style={chip}>houston rap</div>
          </Row>

          <Row id="A-21" sev="LOW" title="Los botones del chip responden" where="/profile · editar" mode="live" note="pressable · 160/80ms — PRESIÓNALOS" onReplay={() => {}}>
            <span style={chip}>
              <button className="pressable" style={{ background: 'transparent', border: 'none', color: BONE_MID, cursor: 'pointer', ...mono, fontSize: '10.5px', padding: 0 }}>◇ PRODUCER</button>
              <button className="pressable" style={{ width: '17px', height: '17px', borderRadius: '50%', background: 'rgba(var(--ink-rgb),.05)', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </span>
          </Row>

          <Row id="A-28" sev="LOW" title="El hairline del roadmap se dibuja" where="/os · HQ" note="os-orbit-draw · scaleX(0)→1 · 950ms (el beat cinematográfico del deck)" onReplay={() => bump('a28')}>
            <div key={k('a28')} style={{ position: 'relative', height: '10px' }}>
              <div style={{ position: 'absolute', top: '4px', left: 0, right: 0, height: '1px', background: HAIR_HI }} />
              <div className="os-orbit-draw" style={{ position: 'absolute', top: '4px', left: 0, width: '62%', height: '1px', background: 'rgba(var(--ink-rgb),.55)' }} />
            </div>
          </Row>

          <Row id="A-24" sev="LOW" title="La cifra de retención entra escalonada" where="/os · Cohorts" note="os-reveal-fast · 500ms · stagger 45ms" onReplay={() => bump('a24')}>
            <div key={k('a24')} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="os-reveal-fast" style={{ ...mono, fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase' }}>04 real buyers · 02 came back (30d)</div>
              {[0, 1].map(i => <div key={i} className="os-reveal-fast" style={{ ...card, animationDelay: `${i * 45}ms` }}>cohorte {i + 1}</div>)}
            </div>
          </Row>

          <Row id="A-11" sev="MEDIUM" title="La tarjeta de contenido creada asienta" where="/os · Content" note="os-settle · scale(.98)→1 + flash de borde · 200ms" onReplay={() => bump('a11')}>
            <div key={k('a11')} className="os-card os-settle" style={{ ...card }}>reel · Fall 001 teaser</div>
          </Row>

          <Row id="A-25" sev="LOW" title="El brief se despliega" where="/os · Content" mode="toggle" note="fadeUp 300ms sobre la curva de la casa" onReplay={() => setBrief(b => !b)}>
            <div>
              <button className="pressable" onClick={() => setBrief(b => !b)} style={{ ...mono, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', background: 'transparent', border: 'none', color: BONE_MID, cursor: 'pointer', padding: 0 }}>{brief ? '◇ hide brief' : '◇ view brief'}</button>
              {brief && (
                <div style={{ ...mono, fontSize: '10px', color: BONE_LOW, lineHeight: 1.6, marginTop: '8px', paddingLeft: '10px', borderLeft: `1px solid ${HAIR_HI}`, animation: 'fadeUp 0.3s var(--ease-house)' }}>
                  el brief del contenido — tono, formato, quién aparece, qué se dice.
                </div>
              )}
            </div>
          </Row>

          <Row id="A-12" sev="MEDIUM" title="Lista ⇄ editor desliza" where="/os · Events" mode="toggle" note="os-slide-in-right/left · translateX(±10px) · 200ms" onReplay={() => setView(v => v === 'list' ? 'edit' : 'list')}>
            <div key={view} className={view === 'edit' ? 'os-slide-in-right' : 'os-slide-in-left'} style={{ ...card }}>
              {view === 'edit' ? '✎ editor del evento' : '☰ lista de eventos'}
            </div>
          </Row>

          <Row id="A-13" sev="MEDIUM" title="El filtro cruza-funde la lista" where="/os · Moderation" mode="toggle" note="refilter-in · opacity .4→1 + blur(2px)→0 · 200ms" onReplay={() => setFilt(f => f === 'review' ? 'building' : 'review')}>
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {['review', 'building'].map(f => (
                  <button key={f} onClick={() => setFilt(f)} style={{ ...mono, fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', background: filt === f ? 'rgba(var(--ink-rgb),.07)' : 'transparent', border: `1px solid ${filt === f ? HAIR_HI : HAIR}`, borderRadius: '100px', padding: '6px 12px', color: filt === f ? BONE : FAINT, cursor: 'pointer' }}>{f}</button>
                ))}
              </div>
              <div key={filt} className="refilter-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[0, 1, 2].map(i => <div key={i} style={{ ...card, padding: '10px 13px', ...mono, fontSize: '10px' }}>{filt} · cuenta {i + 1}</div>)}
              </div>
            </div>
          </Row>

          <Row id="A-27" sev="LOW" title="Verificar transiciona, no salta" where="/os · Network" mode="toggle" note="background + border-color · 200ms" onReplay={() => setVerif(v => !v)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 13px', borderRadius: '13px', border: `1px solid ${verif ? 'rgba(var(--silver-rgb),.28)' : HAIR}`, background: verif ? 'rgba(var(--silver-rgb),.05)' : CARD, transition: 'background .2s ease, border-color .2s ease' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', border: `1px solid ${HAIR_HI}`, background: VOID, flexShrink: 0 }} />
              <span style={{ ...sans, fontSize: '13px', color: BONE }}>Diego Villaseñor</span>
              <span style={{ ...mono, fontSize: '9px', color: verif ? STAR : FAINT, marginLeft: 'auto', letterSpacing: '.14em' }}>{verif ? 'VERIFIED' : '—'}</span>
            </div>
          </Row>

          <Row id="A-18" sev="MEDIUM" title="El aviso se despliega y se recoge" where="/os" mode="toggle" note="grid-template-rows 0fr⇄1fr 250ms + opacity 200ms — sin tirón al expirar" onReplay={() => setNotice(x => !x)}>
            <div>
              <div style={{ display: 'grid', gridTemplateRows: notice ? '1fr' : '0fr', opacity: notice ? 1 : 0, transition: 'grid-template-rows var(--dur-base) var(--ease-house), opacity var(--dur-fast) var(--ease-house)' }}>
                <div style={{ minHeight: 0, overflow: 'hidden' }}>
                  <div style={{ ...mono, fontSize: '9px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase', padding: '8px 0 14px' }}>△ guardado “Fall 001” — publicado</div>
                </div>
              </div>
              <div style={{ ...card }}>el pane de abajo NO da el tirón</div>
            </div>
          </Row>

        </div>

        <div style={{ ...mono, fontSize: '9px', color: FAINT, letterSpacing: '.1em', lineHeight: 1.9, marginTop: '50px', borderTop: `1px solid ${HAIR}`, paddingTop: '20px' }}>
          ● 31 aditivas · curva de la casa cubic-bezier(.2,.7,.2,1) · sin springs, sin bounce, sin confetti<br />
          ○ prueba también con “reducir movimiento” del sistema prendido: todo debe degradar a fade o quedarse quieto<br />
          ✕ esta ruta no existe en producción — vive sólo mientras VITE_MOTION_HARNESS=1
        </div>
      </div>
    </div>
  )
}
