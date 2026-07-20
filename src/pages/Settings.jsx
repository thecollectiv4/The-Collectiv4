import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useTheme } from '@/lib/theme'
import { supabase } from '@/api/supabase'
import { useWide } from '@/lib/useIsDesktop'
import AuthResolving from '@/components/AuthResolving'
import SeedPill from '@/components/SeedMark'
import { cardGlass } from '@/lib/glass'
import { BONE, BONE_LOW, BONE_MID, FAINT, SILVER, HAIR, HAIR_HI, CHROME, FONT_DISPLAY, FONT_MONO, FONT_SANS } from '@/lib/cosmos'
import { Copy, Check, ChevronRight, LogOut, MapPin } from 'lucide-react'

/* =========================================================================
   SETTINGS — el cuarto de máquinas, vestido de casa (v12).

   La referencia que trajo Diego (el settings de Archived Spaces) aportó la
   ESTRUCTURA: qué secciones tiene que tener una plataforma seria para no
   sentirse a medias. La piel es de aquí y de nadie más — void/hueso, DM Mono
   con tracking ancho, numeración de catálogo, marcas de carta estelar,
   vidrio en las superficies. Se tomó la lista, no el look.

   ─── LA REGLA QUE GOBIERNA ESTA PANTALLA ────────────────────────────────
   Un ajuste que se puede mover PERO NO HACE NADA es peor que un ajuste que
   no existe: el que no existe no promete nada, el otro miente. Y cuando lo
   que promete es PRIVACIDAD, la mentira puede costarle algo real a una
   persona que se creyó protegida.

   Así que aquí hay dos clases de fila y se distinguen a simple vista:
     · las que FUNCIONAN — se mueven y guardan
     · las que ESPERAN BACKEND — <Pending/>, apagadas, con el motivo escrito
   Ninguna finge. Lo que está marcado se detalla en el reporte del envío.

   ─── LO QUE SE AUDITÓ EN LA DB ANTES DE ESCRIBIR ESTO ────────────────────
   · `profiles` NO tiene columna de visibilidad. El museo es público POR
     ARQUITECTURA (un link compartido tiene que abrir el mundo, no un muro)
     y la lista de CONNECTED es privada por RLS, sin rama pública. O sea que
     la privacidad real de esta plataforma NO vive en un interruptor — vive
     en el esquema. La sección lo explica en vez de fingir un control.
   · No hay tabla de preferencias de notificación. Las campanas (`signals`)
     existen y se leen; qué recibir no se elige todavía.
   · No hay sistema de consentimiento de cookies. La Privacy Policy dice que
     el uso es mínimo y de sesión; se enlaza y no se inventa un panel.
   ========================================================================= */

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '—'

/* La plataforma, leída del navegador y nada más. Sin librería, sin huella:
   lo que se muestra es lo que cualquiera ve en su propio user agent, y su
   único trabajo es que un reporte de bug traiga contexto. */
function platformLine() {
  if (typeof navigator === 'undefined') return '—'
  const ua = navigator.userAgent || ''
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux' : 'Unknown'
  const browser = /CriOS|Chrome/.test(ua) ? 'Chrome'
    : /FxiOS|Firefox/.test(ua) ? 'Firefox'
    : /Edg/.test(ua) ? 'Edge'
    : /Safari/.test(ua) ? 'Safari' : 'Unknown'
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true
  return `${os} · ${browser}${standalone ? ' · installed' : ''}`
}

/* ── piezas ───────────────────────────────────────────────────────────── */

/* El kicker de sección: número de catálogo + marca de carta estelar + palabra.
   Mismo compás en las nueve secciones, que es lo que hace que se lea como un
   índice y no como nueve cajas apiladas. */
function SectionHead({ n, mark, title, note }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: FAINT, letterSpacing: '.18em' }}>{n}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: SILVER, letterSpacing: '.18em' }}>{mark}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.22em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      {note && (
        <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: BONE_LOW, lineHeight: 1.6, marginTop: '8px', maxWidth: '52ch' }}>{note}</div>
      )}
    </div>
  )
}

/* La superficie de cada sección — vidrio de tarjeta, canto hairline, radio
   corto (la casa no redondea: 10px es el techo). */
function Panel({ children }) {
  return (
    <div style={{ ...cardGlass(), border: `1px solid ${HAIR}`, borderRadius: '10px', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

/* Una fila. `lead` a la izquierda, lo que sea a la derecha. Las filas se
   separan con filete, nunca con margen: el bloque tiene que leerse como una
   lista continua, que es lo que un settings ES. */
function Row({ label, hint, children, onClick, last }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { onClick, className: 'pressable', type: 'button' } : {})}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '16px', padding: '15px 16px', textAlign: 'left', background: 'none',
        border: 'none', borderBottom: last ? 'none' : `1px solid ${HAIR}`,
        cursor: onClick ? 'pointer' : 'default', font: 'inherit', color: 'inherit',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: '14px', color: BONE }}>{label}</span>
        {hint && <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: '11.5px', color: BONE_LOW, marginTop: '3px', lineHeight: 1.5 }}>{hint}</span>}
      </span>
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>{children}</span>
    </Tag>
  )
}

/* EL SELLO DE LO QUE NO EXISTE TODAVÍA. Existe para que nadie —ni un usuario
   ni el próximo que abra este archivo— confunda "lo dejamos listo" con "ya
   jala". Va apagado a propósito: no es un control, es una promesa fechada. */
function Pending({ children = 'Needs backend' }) {
  return (
    <span style={{
      fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.16em', textTransform: 'uppercase',
      // BONE_LOW y no FAINT. La primera versión usaba FAINT y la auditoría de
      // contraste la sacó a 2.02:1 — o sea, el aviso de que un ajuste NO
      // FUNCIONA era lo menos legible de la pantalla. Justo al revés de su
      // trabajo. FAINT está documentado como decorativo en los dos registros
      // (index.css) y esto no es decoración, es la advertencia.
      color: BONE_LOW, border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '4px 9px', whiteSpace: 'nowrap',
    }}>◇ {children}</span>
  )
}

/* Valor de sólo lectura que se puede copiar. Los identificadores existen
   para pegarse en un reporte; enseñarlos sin poder copiarlos es enseñarlos
   para nada. Mono y truncado — es un dato, no una frase. */
function CopyValue({ value }) {
  const [done, setDone] = useState(false)
  if (!value) return <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: FAINT }}>—</span>
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400) } catch { /* clipboard bloqueado: el valor sigue visible y seleccionable */ }
  }
  return (
    <button type="button" onClick={copy} className="pressable selectable" style={{
      display: 'flex', alignItems: 'center', gap: '7px', background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, maxWidth: '190px',
    }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      {done ? <Check size={12} color={SILVER} /> : <Copy size={12} color={FAINT} />}
    </button>
  )
}

/* ── APARIENCIA: las tres pastillas ───────────────────────────────────── */
/* Segmentado, no tres botones sueltos: el tema es UNA elección de tres, y la
   forma tiene que decirlo. La activa se llena; las otras son vidrio. Se
   aplica al instante — un tema que pide "guardar" se siente roto. */
function ThemePills() {
  const { pref, setPref, resolved } = useTheme()
  const opts = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ]
  return (
    <div style={{ padding: '14px 16px' }}>
      <div role="radiogroup" aria-label="Appearance" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px',
        background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR}`,
        borderRadius: '100px', padding: '4px',
      }}>
        {opts.map((o) => {
          const on = pref === o.key
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPref(o.key)}
              className="pressable"
              style={{
                padding: '9px 6px', borderRadius: '100px', cursor: 'pointer',
                fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase',
                transition: 'background 200ms var(--ease-house), color 200ms var(--ease-house), border-color 200ms var(--ease-house)',
                // La activa usa el canal de tinta, así que se invierte sola:
                // pastilla clara sobre vidrio oscuro de noche, oscura sobre
                // vidrio claro de día. Un solo valor, dos lecturas correctas.
                background: on ? 'rgba(var(--ink-rgb),.92)' : 'transparent',
                color: on ? 'var(--bg)' : BONE_LOW,
                border: `1px solid ${on ? 'transparent' : 'rgba(var(--ink-rgb),.10)'}`,
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {/* BONE_LOW, no FAINT: esta línea es la que responde "¿y qué está
          pasando ahora?" — sobre todo en `system`, donde es lo ÚNICO que
          dice si el aparato está en claro u oscuro. Misma corrección de
          contraste que <Pending/>. */}
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '11px', textAlign: 'center' }}>
        {pref === 'system' ? `Following your device · now ${resolved}` : `Locked to ${pref}`}
      </div>
    </div>
  )
}

/* ── la pantalla ──────────────────────────────────────────────────────── */

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const wide = useWide()
  const [profile, setProfile] = useState(null)
  const [sessionId, setSessionId] = useState('')
  const [geo, setGeo] = useState('unknown')

  // El cielo de esta ruta (quiet, semilla 'the-machine-room') se declara en
  // la tabla de Atmosphere.jsx, no aquí — ver la nota junto a presetForPath.

  useEffect(() => {
    if (authLoading || !user) return undefined
    let alive = true
    /* is_demo VIAJA CON LA IDENTIDAD (guardrail 4, L1) — y el tripwire me lo
       cobró al primer intento con `select('full_name, username')`.
       Lo que NO se hace aquí es la otra salida que la ley admite,
       `.eq('is_demo', false)`: eso excluiría la fila y una cuenta semilla se
       quedaría sin nombre EN SU PROPIA pantalla de ajustes. La regla existe
       para que el público no vea datos falsos, no para que un fundador con
       una cuenta de QA no pueda leer la suya. Se transporta la bandera y se
       renderiza con la pastilla compartida, que es lo que la ley pide. */
    supabase.from('profiles').select('full_name, username, is_demo').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (alive) setProfile(data || null) }, () => {})
    supabase.auth.getSession().then(({ data }) => {
      // No hay "session id" como tal en Supabase: la sesión se identifica por
      // su access token, que es un secreto y NO se enseña. Lo que se muestra
      // es el identificador del token (jti si viene, si no una huella corta
      // del final) — sirve para correlacionar un reporte con un log y no
      // sirve para autenticarse con él.
      const tok = data?.session?.access_token || ''
      if (!alive || !tok) return
      try {
        const claims = JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        setSessionId(claims.session_id || claims.jti || `…${tok.slice(-8)}`)
      } catch { setSessionId(`…${tok.slice(-8)}`) }
    }, () => {})
    return () => { alive = false }
  }, [authLoading, user])

  // Permiso de ubicación: esto SÍ es real y no necesita backend — es el
  // estado del permiso del navegador, leído en vivo. Lo que falta (guardar
  // dónde estás, el mapa) es lo que va marcado abajo.
  useEffect(() => {
    if (!navigator.permissions?.query) { setGeo('unsupported'); return undefined }
    let alive = true
    let handle = null
    navigator.permissions.query({ name: 'geolocation' }).then((st) => {
      if (!alive) return
      setGeo(st.state)
      handle = st
      st.onchange = () => { if (alive) setGeo(st.state) }
    }, () => { if (alive) setGeo('unsupported') })
    return () => { alive = false; if (handle) handle.onchange = null }
  }, [])

  const askGeo = () => {
    if (!navigator.geolocation) return
    // Sólo dispara el diálogo del sistema. No se guarda la coordenada en
    // ningún lado — no hay dónde, y escribirla sin decirlo sería justo el
    // tipo de cosa que esta pantalla existe para no hacer.
    navigator.geolocation.getCurrentPosition(() => setGeo('granted'), () => setGeo('denied'), { timeout: 8000 })
  }

  if (authLoading) return <AuthResolving />
  // <Navigate/>, NO navigate() suelto: llamar al navegador durante el render
  // es un efecto en fase de render — React avisa ("cannot update a component
  // while rendering a different component") y el redirect queda a merced del
  // orden de commit. El elemento lo hace en el sitio correcto del ciclo.
  // `replace` para que el botón de atrás no rebote contra esta pantalla.
  if (!user) return <Navigate to="/" replace />

  const displayName = profile?.full_name || user.user_metadata?.full_name || '—'
  const geoLabel = { granted: 'Allowed', denied: 'Blocked', prompt: 'Not asked yet', unsupported: 'Unsupported', unknown: '…' }[geo] || geo

  return (
    <div style={{
      minHeight: '100vh',
      padding: wide ? '40px clamp(24px, 4vw, 56px) 96px' : '26px 18px 40px',
      maxWidth: wide ? '760px' : 'none',
      margin: wide ? '0 auto' : 0,
    }}>
      {/* EL ÚNICO MOMENTO DE CROMO DE LA PANTALLA (Ley 8). Todo lo demás es
          hueso y mono. Un settings con joyería en cada sección sería un
          catálogo de efectos; con una sola es una portada. */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: '8px' }}>
          ● the machine room
        </div>
        <h1 style={{
          fontFamily: FONT_DISPLAY, fontSize: wide ? '58px' : '46px', lineHeight: 0.92,
          letterSpacing: '.01em', background: CHROME, WebkitBackgroundClip: 'text',
          backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent',
        }}>SETTINGS</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

        {/* 01 — APARIENCIA */}
        <section>
          <SectionHead n="01" mark="◇" title="Appearance"
            note="Dark is the house. Light is the same universe by day — the same constellation, read as graphite on paper." />
          <Panel><ThemePills /></Panel>
        </section>

        {/* 02 — CUENTA */}
        <section>
          <SectionHead n="02" mark="●" title="Account" />
          <Panel>
            <Row label="Name" >
              {/* La pastilla se renderiza sola o no se renderiza (devuelve
                  null si is_demo es falso), así que esto es honesto para
                  todos y no cuesta nada para casi nadie. */}
              <SeedPill is_demo={profile?.is_demo} />
              <span style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_MID }}>{displayName}</span>
            </Row>
            <Row label="Email">
              <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
            </Row>
            <Row label="User ID" hint="Paste this when you report something.">
              <CopyValue value={user.id} />
            </Row>
            <Row label="Edit your world" hint="Cover, crafts, moments — the builder." onClick={() => navigate('/profile')} last>
              <ChevronRight size={15} color={SILVER} />
            </Row>
          </Panel>
        </section>

        {/* 03 — VISIBILIDAD. La sección que MÁS fácil habría sido falsear. */}
        <section>
          <SectionHead n="03" mark="○" title="Profile visibility"
            note="Your world is a public address on purpose — a link someone shares has to open it, not a wall. What stays private isn't a setting: your CONNECTED list has no public read path in the database at all. Nobody can open it, including us." />
          <Panel>
            <Row label="Private world" hint="Hide your world from anyone you haven't accepted. Needs a visibility column on profiles and a matching read policy — neither exists yet.">
              <Pending />
            </Row>
            <Row label="Who can see you're attending" hint="Chosen per room today, when you get a ticket. A global default is not stored yet." last>
              <Pending />
            </Row>
          </Panel>
        </section>

        {/* 04 — SESIÓN */}
        <section>
          <SectionHead n="04" mark="△" title="Session" />
          <Panel>
            <Row label="Session ID" hint="An identifier for this sign-in. Never your token." last>
              <CopyValue value={sessionId} />
            </Row>
          </Panel>
        </section>

        {/* 05 — UBICACIÓN */}
        <section>
          <SectionHead n="05" mark="✕" title="Location"
            note="For the map of rooms near you. The permission below is real and lives in your browser; nothing is stored anywhere yet." />
          <Panel>
            <Row label="Location access" hint={geo === 'denied' ? 'Blocked — your browser settings can undo this.' : 'Asks your device, nothing else.'}>
              <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: geo === 'granted' ? SILVER : BONE_LOW, letterSpacing: '.12em', textTransform: 'uppercase' }}>{geoLabel}</span>
              {(geo === 'prompt' || geo === 'unknown') && (
                <button type="button" onClick={askGeo} className="pressable" style={{
                  display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(var(--ink-rgb),.06)',
                  border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '5px 11px', cursor: 'pointer',
                  fontFamily: FONT_MONO, fontSize: '9px', color: BONE, letterSpacing: '.12em', textTransform: 'uppercase',
                }}><MapPin size={10} /> Allow</button>
              )}
            </Row>
            <Row label="Save my city" hint="Storing a location needs a column and a policy that don't exist yet." last>
              <Pending />
            </Row>
          </Panel>
        </section>

        {/* 06 — PRIVACIDAD Y COOKIES */}
        <section>
          <SectionHead n="06" mark="◇" title="Privacy & cookies"
            note="We use minimal local storage to keep you signed in and to remember your theme — no third-party ad tracking, so there is nothing to opt out of." />
          <Panel>
            <Row label="Privacy Policy" hint="Includes how cookies and local storage are used." onClick={() => navigate('/privacy')}>
              <ChevronRight size={15} color={SILVER} />
            </Row>
            <Row label="Terms" onClick={() => navigate('/terms')}>
              <ChevronRight size={15} color={SILVER} />
            </Row>
            <Row label="Refunds" onClick={() => navigate('/refunds')} last>
              <ChevronRight size={15} color={SILVER} />
            </Row>
          </Panel>
        </section>

        {/* 07 — NOTIFICACIONES */}
        <section>
          <SectionHead n="07" mark="●" title="Notifications"
            note="The bell is live — you already get signals for messages and requests. What you can't do yet is choose which ones." />
          <Panel>
            <Row label="Email notifications" hint="No preferences table exists; today email is transactional only (tickets, password resets).">
              <Pending />
            </Row>
            <Row label="Push notifications" hint="No web-push subscription or service worker yet." last>
              <Pending />
            </Row>
          </Panel>
        </section>

        {/* 08 — APP */}
        <section>
          <SectionHead n="08" mark="△" title="App" />
          <Panel>
            <Row label="Version">
              <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID }}>{APP_VERSION}</span>
            </Row>
            <Row label="Platform" last>
              <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID }}>{platformLine()}</span>
            </Row>
          </Panel>
        </section>

        {/* 09 — SALIR. Plata fantasma, nunca rojo: la paleta no admite
            semáforos, y cerrar sesión no es una emergencia (panel catch). */}
        <section>
          <SectionHead n="09" mark="✕" title="Session end" />
          <button
            onClick={async () => { await signOut(); navigate('/') }}
            className="pressable"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
              padding: '15px', borderRadius: '10px', cursor: 'pointer',
              background: 'rgba(var(--ink-rgb),.03)', border: `1px solid ${HAIR_HI}`,
              fontFamily: FONT_MONO, fontSize: '11px', color: SILVER, letterSpacing: '.16em', textTransform: 'uppercase',
              transition: 'border-color .2s var(--ease-house)',
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(var(--silver-rgb),.45)' }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),.15)' }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </section>

        <div style={{ textAlign: 'center', fontFamily: FONT_MONO, fontSize: '8.5px', color: FAINT, letterSpacing: '.24em', textTransform: 'uppercase', paddingTop: '4px' }}>
          ●&nbsp;&nbsp;○&nbsp;&nbsp;✕&nbsp;&nbsp;△&nbsp;&nbsp;◇
        </div>
      </div>
    </div>
  )
}
