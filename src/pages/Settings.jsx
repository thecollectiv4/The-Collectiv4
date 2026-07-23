import { Component, Suspense, lazy, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useTheme } from '@/lib/theme'
import { supabase } from '@/api/supabase'
import { useWide } from '@/lib/useIsDesktop'
import AuthResolving from '@/components/AuthResolving'
import GlassSheet from '@/components/GlassSheet'
import SeedPill from '@/components/SeedMark'
import VerifiedMark from '@/components/VerifiedMark'
import { BADGE_COLORS, readBadgeColor, writeBadgeColor } from '@/lib/badgeColors'
import { replayTour, TUTORIAL_ENABLED } from '@/lib/firstRun'
import { cardGlass, glassControl } from '@/lib/glass'
import { BONE, BONE_LOW, BONE_MID, CARD_HI, FAINT, SILVER, HAIR, HAIR_HI, WARN, CHROME, FONT_DISPLAY, FONT_MONO, FONT_SANS, safeImg } from '@/lib/cosmos'
import { ArrowUpRight, Copy, Check, ChevronRight, Loader2, LogOut, MapPin } from 'lucide-react'

/* =========================================================================
   SETTINGS — el cuarto de máquinas, vestido de casa (v12 · ampliado en v14).

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

   ─── V14: PARIDAD DE ESTRUCTURA, SIN UNA SOLA FILA FALSA ────────────────
   El pedido fue paridad con una pantalla de ajustes de referencia (GENERAL /
   PRIVACY / SUPPORT / ACCOUNT). Se entregó la estructura completa y NINGUNA
   de sus filas se inventó un backend:

     · Push notifications  → no hay service worker ni suscripción web-push.
                             <Pending/>. Un switch aquí sería el clásico
                             "lo activé y nunca me llegó nada".
     · Dark Mode           → YA ERA REAL desde v12 y se queda intacto. Nunca
                             se marca "coming soon" algo que ya funciona: esa
                             mentira es la misma mentira, al revés.
     · Language            → ver la nota larga en la sección 01.
     · Blocked users       → NO EXISTE TABLA DE BLOQUEOS. Es exactamente el
                             caso para el que se escribió la ley de arriba, y
                             ni siquiera lleva conteo: un "0" ya afirmaría
                             que la función existe y que no has bloqueado a
                             nadie. Lo honesto es no dar número.
     · Contact support     → la fila que pasó de muerta a la más útil de la
                             página: mailto REAL con el diagnóstico que esta
                             pantalla ya calculaba (versión, plataforma,
                             tema, tus ids). Cero backend, valor inmediato.
     · Delete account      → flujo completo con doble confirmación y estado
                             terminal honesto. NO EJECUTA NADA. El porqué
                             está escrito entero en <DeleteAccountSheet/>.

   ─── LO QUE SE AUDITÓ EN LA DB ANTES DE ESCRIBIR ESTO ────────────────────
   · `profiles` NO tiene columna de visibilidad. El museo es público POR
     ARQUITECTURA (un link compartido tiene que abrir el mundo, no un muro)
     y la lista de CONNECTED es privada por RLS, sin rama pública. O sea que
     la privacidad real de esta plataforma NO vive en un interruptor — vive
     en el esquema. La sección lo explica en vez de fingir un control.
   · No hay tabla de preferencias de notificación. Las campanas (`signals`)
     existen y se leen; qué recibir no se elige todavía.
   · No hay tabla de bloqueos (`blocks` / `blocked_users`). No existe. Punto.
   · No hay sistema de consentimiento de cookies. La Privacy Policy dice que
     el uso es mínimo y de sesión; se enlaza y no se inventa un panel.
   · No hay RPC de auto-borrado. El ciclo de vida real es `deleted_at`
     (borrado suave, REVERSIBLE) y el trigger `lock_lifecycle` (0027) le
     prohíbe a un miembro escribirlo sobre su propia fila.

   ─── EL LENGUAJE DE ÍCONOS DE ESTA PANTALLA (a propósito, corto) ─────────
   El ícono de una sección es su MARCA DE CARTA ESTELAR (● ○ ✕ △ ◇) junto al
   número de catálogo — eso es el sistema de la casa y ya estaba. Lucide se
   reserva para AFORDANCIAS, nunca para decorar una etiqueta, y hay
   exactamente dos:
       ChevronRight  → esto entra más adentro de la app
       ArrowUpRight  → esto SALE de la app (abre tu cliente de correo)
   Una fila con ícono de adorno a la izquierda convierte un índice editorial
   en una sopa de SaaS. Dos marcas con significado valen más que doce.
   ========================================================================= */

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '—'

/* EL BUZÓN. Canon, no invención: es el mismo que ya usan la Privacy Policy,
   los Terms, los Refunds (src/pages/Legal.jsx:21) y la escotilla de la
   puerta (EarlyAccessGate.jsx:185). No existe un support@ ni un help@.
   `tickets@send.thecollectiv4.com` (api/_ticketEmail.js) NO sirve para esto:
   es el remitente de Resend del correo de boleto, un dominio de envío, no
   una bandeja que alguien lea. Escribirle a esa dirección sería mandar a la
   gente a un buzón sin dueño — que es la versión por correo de un 404. */
const SUPPORT_EMAIL = 'thecollectiv4@gmail.com'

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

/* EL BLOQUE DE DIAGNÓSTICO — lo que convierte "Contact support" en la fila
   más útil de la página sin una sola línea de servidor.

   Lo que lleva es exactamente lo que esta pantalla YA calculaba y enseñaba
   con botón de copiar: versión, plataforma, tema, tu id y el id de sesión.
   Antes había que copiar cuatro cosas a mano y la mitad de los reportes
   llegaban sin ninguna.

   ⚠ LO QUE NO LLEVA, Y POR QUÉ:
   · el access token — es un secreto; el "Session" de abajo es el `jti` /
     `session_id` del token, que sirve para cruzar un log y no sirve para
     autenticarse (misma regla que la fila Session ID, ver el efecto abajo).
   · tu correo — es el REMITENTE del mensaje. Repetirlo en el cuerpo es
     ruido, y datos personales de más en una URI es exactamente lo que no
     se hace aunque el destino sea el correo de uno mismo.
   · una marca de tiempo — el correo trae su propia cabecera Date. Meterla
     en el cuerpo además de ser redundante obligaría a recalcular el href en
     cada clic para que no envejeciera con la pestaña abierta. La cabecera lo
     resuelve gratis y siempre bien. */
function diagnosticsBlock({ theme, userId, sessionId }) {
  return [
    'THE COLLECTIV4 — diagnostics',
    `App        ${APP_VERSION}`,
    `Platform   ${platformLine()}`,
    `Theme      ${theme}`,
    `User ID    ${userId || '—'}`,
    `Session    ${sessionId || '—'}`,
  ].join('\n')
}

/* mailto bien formado. encodeURIComponent en los DOS campos: un asunto con
   `&` o un cuerpo con saltos de línea rompe el URI si se concatena crudo, y
   el cliente de correo abre en blanco sin decir por qué. */
const mailtoUrl = (to, subject, body) =>
  `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

/* ── piezas ───────────────────────────────────────────────────────────── */

/* El kicker de sección: número de catálogo + marca de carta estelar + palabra.
   Mismo compás en todas las secciones, que es lo que hace que se lea como un
   índice y no como una pila de cajas. */
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
function Panel({ children, style }) {
  return (
    <div style={{ ...cardGlass(), border: `1px solid ${HAIR}`, borderRadius: '10px', overflow: 'hidden', ...style }}>
      {children}
    </div>
  )
}

/* Una fila. `lead` a la izquierda, lo que sea a la derecha. Las filas se
   separan con filete, nunca con margen: el bloque tiene que leerse como una
   lista continua, que es lo que un settings ES.

   V14 — TRES ETIQUETAS, NO DOS. `href` renderiza un <a> de verdad, y eso no
   es purismo: un mailto metido en un <button> pierde todo lo que el
   navegador ya sabe hacer con un enlace (abrir en otra app, copiar la
   dirección, el menú largo de iOS) y encima obliga a tocar
   window.location a mano. Botón = acción dentro de la app; enlace = te vas
   a otro lado. La forma del DOM dice cuál es cuál. */
function Row({ label, hint, children, onClick, href, last, testId }) {
  const Tag = href ? 'a' : onClick ? 'button' : 'div'
  const interactive = Boolean(href || onClick)
  return (
    <Tag
      {...(href ? { href, className: 'pressable' } : {})}
      {...(!href && onClick ? { onClick, className: 'pressable', type: 'button' } : {})}
      {...(testId ? { 'data-testid': testId } : {})}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '16px', padding: '15px 16px', textAlign: 'left', background: 'none',
        border: 'none', borderBottom: last ? 'none' : `1px solid ${HAIR}`,
        cursor: interactive ? 'pointer' : 'default', font: 'inherit', color: 'inherit',
        textDecoration: 'none', boxSizing: 'border-box',
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
  // BONE_LOW y no FAINT, por la misma razón que el guión de la fila de la
  // tarjeta de identidad: este guión NO separa nada, dice "todavía no
  // tenemos ese identificador". Es el estado de la fila, y un estado a 2:1
  // de contraste se lee como fila vacía.
  if (!value) return <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_LOW }}>—</span>
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

/* El mismo gesto de copiar, pero para un bloque de varias líneas donde
   enseñar el valor no ayuda a nadie. La etiqueta dice qué se lleva. */
function CopyBlock({ text, idle = 'Copy', done = 'Copied' }) {
  const [hit, setHit] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setHit(true); setTimeout(() => setHit(false), 1600) } catch { /* sin permiso de portapapeles: el mailto sigue siendo el camino */ }
  }
  return (
    <button type="button" onClick={copy} className="pressable" style={{
      display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(var(--ink-rgb),.06)',
      border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '5px 11px', cursor: 'pointer',
      fontFamily: FONT_MONO, fontSize: '9px', color: hit ? SILVER : BONE, letterSpacing: '.12em', textTransform: 'uppercase',
    }}>
      {hit ? <Check size={10} /> : <Copy size={10} />} {hit ? done : idle}
    </button>
  )
}

/* ── LA TARJETA DE CUENTA ─────────────────────────────────────────────── */
/* Arriba del índice y SIN número de catálogo, a propósito: no es una de las
   secciones, es la placa de identidad de quien está adelante de la pantalla.
   Un settings que no te dice de qué cuenta estás hablando es un settings en
   el que tarde o temprano alguien cambia algo en la cuenta equivocada.

   Datos reales o nada:
   · el nombre sale de `profiles` y, si esa lectura todavía no vuelve, del
     metadata de la sesión — que también es real, sólo que más pobre.
   · el @handle SÓLO se pinta cuando la lectura resolvió. Mientras tanto no
     hay línea: una ausencia es honesta, un "@undefined" es basura.
   · <SeedPill/> y <VerifiedMark/> se dibujan solos o no se dibujan. La ley
     de is_demo se cumple transportando la bandera, no filtrando la fila —
     ver el comentario del efecto que la lee.
   · el tratamiento sin foto es EL MISMO del museo (ProfileMuseum.jsx:1051):
     círculo CARD_HI, aro de luz en vez de contorno duro, inicial en Bebas.
     Copiado a propósito para que la persona se reconozca en las dos
     pantallas; si allá cambia, aquí también.

   ─── DOS CORRECCIONES DE LA AUTO-REVISIÓN, LAS DOS DE LA MISMA LEY ───────
   · EL SELLO SE PINTA CON `badgeKey`, NO CON EL DEFAULT. El selector de
     color vive 150px más abajo EN ESTA MISMA PANTALLA. Un selector que se
     mueve y deja el sello que tienes a la vista exactamente igual es, al pie
     de la letra, el ajuste que se mueve y no hace nada. Lo que ese color
     alcanza y lo que no está escrito donde se toma la decisión, en
     <BadgePicker/>.
   · NO LLEVA aria-label, y quitarlo fue el arreglo, no el descuido. Un
     aria-label en el <button> SUSTITUYE al nombre calculado de su contenido:
     el lector de pantalla decía "Open your profile, button" y se comía el
     nombre, el @handle, el sello y la pastilla seed (◇) — o sea, se comía lo
     único que esta tarjeta existe para decir, que es DE QUÉ CUENTA estamos
     hablando. El contenido ya nombra el control y "View your world" ya
     nombra la acción. El sello sí necesitaba etiqueta propia: su SVG es
     aria-hidden, así que sin el envoltorio no se anunciaba en ningún lado. */
function AccountCard({ name, username, avatarUrl, isDemo, verified, badgeKey, ready, onOpen }) {
  const initial = (String(name || '').trim()[0] || '·').toUpperCase()
  const avatar = safeImg(avatarUrl)
  return (
    <button type="button" onClick={onOpen} className="pressable" data-testid="settings-account-card"
      style={{
        ...cardGlass(), border: `1px solid ${HAIR}`, borderRadius: '10px',
        width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
        padding: '16px', marginBottom: '30px', cursor: 'pointer', textAlign: 'left',
        font: 'inherit', color: 'inherit', boxSizing: 'border-box',
      }}>
      <span style={{ position: 'relative', width: '52px', height: '52px', flexShrink: 0, display: 'block' }}>
        {avatar
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 1px rgba(var(--ink-rgb),.28), 0 6px 22px rgba(var(--shadow-rgb),.55)' }} />
          : (
            <span style={{
              width: '100%', height: '100%', borderRadius: '50%', background: CARD_HI,
              boxShadow: '0 0 0 1px rgba(var(--ink-rgb),.28), 0 6px 22px rgba(var(--shadow-rgb),.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FONT_DISPLAY, fontSize: '24px', color: BONE,
            }}>{initial}</span>
          )}
      </span>

      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {/* Bebas y no Sans: es un nombre propio en una placa, no una fila
              de formulario. Se trunca antes de empujar al chevron. */}
          <span style={{
            fontFamily: FONT_DISPLAY, fontSize: '25px', lineHeight: 1.05, color: BONE,
            letterSpacing: '.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{name}</span>
          {verified && (
            /* La ETIQUETA es la misma frase que el museo (ProfileMuseum:1116)
               y la comunidad (Community:605) — literal, para que la insignia
               se anuncie igual en toda la app. El estilo sí es de aquí, y el
               `color` también: el museo todavía no lee la preferencia.
               El envoltorio hace falta porque el SVG de la insignia es
               aria-hidden a propósito (es forma, no texto): sin span, el
               sello simplemente no existe para quien no lo ve. */
            <span title="In The Collectiv4 network" aria-label="Verified — in The Collectiv4 network"
              style={{ display: 'inline-flex', flexShrink: 0 }}>
              <VerifiedMark size={17} color={badgeKey} />
            </span>
          )}
          <SeedPill is_demo={isDemo} size={7.5} />
        </span>
        {ready && username && (
          <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, letterSpacing: '.04em', marginTop: '4px' }}>
            @{username}
          </span>
        )}
        {/* BONE_LOW, no FAINT. Ésta es la ÚNICA línea que dice qué hace la
            tarjeta si la tocas, o sea que no es adorno: es la etiqueta de la
            acción. FAINT mide ~2.3:1 de noche y ~2.0:1 de día — por debajo
            incluso del mínimo de texto grande — y está documentado como
            decorativo en index.css. Misma corrección que ya se hizo en
            <Pending/> y en la línea de estado del tema. */}
        <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase', marginTop: ready && username ? '7px' : '6px' }}>
          View your world
        </span>
      </span>

      <ChevronRight size={16} color={SILVER} style={{ flexShrink: 0 }} />
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

/* ── EL COLOR DEL SELLO (sólo verificados) ────────────────────────────── */
/* Se dibuja la insignia DE VERDAD en cada opción, no una pastilla de color:
   lo que se elige es cómo se ve tu sello, así que la muestra tiene que ser
   el sello. Un círculo de color al lado de la palabra "Gold" te haría
   adivinar el resultado.

   ─── CONTROLADO, NO CON ESTADO PROPIO. LA RAZÓN ES LA LEY DE ARRIBA ──────
   La primera versión guardaba `sel` aquí adentro. Funcionaba de maravilla y
   mentía: la tarjeta de cuenta —que está 150px MÁS ARRIBA, en la misma
   pantalla y a la vista— seguía dibujando el sello dorado porque nadie le
   pasaba la elección. O sea que la promesa y su desmentido cabían en el
   mismo viewport. Ahora la elección vive en <Settings/>, la tarjeta la
   recibe, y lo que este bloque afirma se puede comprobar sin scrollear.

   Lo que sigue sin ser cierto está dicho abajo con todas sus letras: NINGUNA
   otra pantalla de la app lee esta preferencia (grep: `readBadgeColor` se
   consume aquí y en ningún otro lado), así que el museo, la comunidad y la
   vista que los demás tienen de ti siguen en dorado. No se disimula. */
function BadgePicker({ value, onPick }) {
  const opts = Object.values(BADGE_COLORS)
  return (
    <div style={{ padding: '4px 16px 16px', borderTop: `1px solid ${HAIR}`, marginTop: '2px' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_MID, letterSpacing: '.2em', textTransform: 'uppercase', margin: '14px 0 10px' }}>
        Your badge
      </div>
      <div role="radiogroup" aria-label="Badge colour" style={{ display: 'flex', gap: '10px' }}>
        {opts.map((o) => {
          const on = value === o.key
          return (
            <button key={o.key} type="button" role="radio" aria-checked={on}
              onClick={() => onPick(o.key)} className="pressable"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '11px 8px', borderRadius: '10px', cursor: 'pointer',
                background: on ? 'rgba(var(--ink-rgb),.07)' : 'transparent',
                border: `1px solid ${on ? 'rgba(var(--ink-rgb),.30)' : HAIR}`,
                transition: 'background 200ms var(--ease-house), border-color 200ms var(--ease-house)',
                fontFamily: FONT_MONO, fontSize: '9.5px', letterSpacing: '.14em', textTransform: 'uppercase',
                color: on ? BONE : BONE_LOW,
              }}>
              <VerifiedMark size={18} color={o.key} /> {o.label}
            </button>
          )
        })}
      </div>
      {/* La verdad, dicha donde se toma la decisión y no en una nota al pie —
          y dicha con el alcance EXACTO. "Saved on this device only" era
          verdad a medias: no se guardaba en el servidor, cierto, pero
          tampoco se leía en NINGÚN lado de este aparato. Ahora se lee en un
          sitio y esa frase nombra cuál, en vez de dejar que se entienda
          "en toda la app". Si algún día el museo lee la preferencia, esta
          frase se corrige aquí — no se borra. */}
      <div style={{ fontFamily: FONT_SANS, fontSize: '11.5px', color: BONE_LOW, lineHeight: 1.55, marginTop: '11px' }}>
        Stored on this device, and read here — the badge on your card above follows it.
        Nowhere else yet: your profile and the rest of the app still draw it in gold, and so
        does everyone else's view of you. Making the choice travel needs a <span className="selectable" style={{ fontFamily: FONT_MONO, fontSize: '10.5px' }}>badge_color</span> column
        and a policy that only verified rows can write it.
      </div>
    </div>
  )
}

/* ── LAS HOJAS QUE VIVEN EN OTROS ARCHIVOS ────────────────────────────── */
/* CARGA PEREZOSA, Y NO POR PESO — POR PROPIEDAD.

   StatusSheet e IdentityCard los escribe otro agente en paralelo en esta
   misma rama. Un import estático amarra ESTA pantalla a los nombres de
   exportación de ESE archivo en tiempo de build: si allá renombran, aquí no
   compila el cuarto de máquinas entero, y el cuarto de máquinas es de donde
   uno sale (Sign out) cuando algo se rompió.

   Perezoso + frontera de error = el peor caso posible es que UNA fila diga
   la verdad ("esto no abrió") en vez de que la página no exista. El
   `|| m.default` cubre el renombre más probable (que la hoja pase de
   exportación nombrada a default). El hogar principal de las dos sigue
   siendo el perfil; esto es una puerta secundaria y las filas lo dicen. */
const StatusSheetLazy = lazy(() => import('@/components/StatusSheet'))
const IdentityCardSheetLazy = lazy(() =>
  import('@/components/IdentityCard').then((m) => ({ default: m.IdentityCardSheet || m.default }))
)

/* La frontera. Sin esto, un fallo al cargar el chunk sube por el árbol y se
   lleva la pantalla completa — con esto se queda en una hoja que se puede
   cerrar. `failed` no se resetea a propósito: si el módulo no cargó, no va a
   cargar en el segundo intento, y un botón que reintenta y falla en silencio
   es justo lo que este archivo existe para no tener. */
class SheetBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return this.props.fallback || null
    return this.props.children
  }
}

/* El scrim mientras el chunk viaja. Mismo valor de fondo que GlassSheet, así
   que cuando la hoja llega el cambio es invisible.
   ⚠ PORTAL OBLIGATORIO, por la misma razón que GlassSheet documenta: el
   wrapper de página de Layout es `position:relative; z-index:1`, o sea un
   contexto de apilamiento, y cualquier z-index de adentro compite contra la
   barra (9999) valiendo 1. Fuera de la isla, o queda debajo de la barra. */
function SheetLoading() {
  return createPortal(
    <div aria-hidden="true" className="overlay-backdrop" style={{
      position: 'fixed', inset: 0, zIndex: 10020, background: 'rgba(var(--void-rgb),.62)',
      // el MISMO velo que GlassSheet (scrim .62 + blur 3px), copiado valor por
      // valor: si el de espera fuera sólo el color, al llegar la hoja el fondo
      // "saltaría" a desenfocado y el cambio se notaría. Literal a propósito —
      // backdrop-filter no puede resolver de una custom property (WebKit
      // 289800 tira la declaración entera, en silencio).
      WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
    </div>,
    document.body
  )
}

/* Lo que se ve si un chunk de hoja no cargó. Es una hoja de verdad (cierra
   con Escape, con el fondo, devuelve el foco) diciendo una frase honesta. */
function SheetFailed({ onClose, wide }) {
  return (
    /* El kicker viaja con U+00A0 EXPLÍCITO, no con &nbsp; ni con dos
       espacios normales: dos espacios normales colapsan a uno al pintarse, y
       una entidad escrita dentro de un ATRIBUTO depende de que el transform
       las decodifique. Ninguna de las dos apuestas hace falta. */
    <GlassSheet title="Didn't open" kicker={'✕  Sorry'} onClose={onClose} wide={wide} maxWidth="380px">
      <p style={{ fontFamily: FONT_SANS, fontSize: '13.5px', lineHeight: 1.65, color: BONE_MID, padding: '4px 12px 14px', margin: 0 }}>
        That panel failed to load. Reload the page and try again — nothing on
        your account changed.
      </p>
    </GlassSheet>
  )
}

/* ── BORRAR LA CUENTA ─────────────────────────────────────────────────── */
/* =========================================================================
   ESTA HOJA NO BORRA NADA, Y ESO ES LA FUNCIÓN, NO UNA LIMITACIÓN.

   Lo que se auditó antes de escribirla:
   · No existe ningún RPC de auto-borrado. Ninguno.
   · El ciclo de vida real de esta plataforma es `profiles.deleted_at`: un
     borrado SUAVE y REVERSIBLE (el mundo deja de ser legible; la fila sigue
     ahí para poder deshacerlo y para que un boleto vendido siga teniendo
     comprador).
   · El trigger `lock_lifecycle` (migración 0027) le PROHÍBE a un miembro
     escribir `deleted_at` sobre su propia fila. Sólo un fundador puede.

   O sea que un botón "Delete my account" que llamara a la base haría
   exactamente una cosa: fallar contra RLS, en silencio, y dejar a la persona
   creyendo que su cuenta ya no existe. Ésa es la peor versión posible de la
   mentira que esta pantalla existe para no decir — peor que un switch muerto,
   porque el switch muerto no te hace creer que ya te fuiste.

   Entonces: se construye el FLUJO completo y el acto destructivo se sustituye
   por el camino que SÍ funciona hoy — pedirlo a una persona. No es un parche:
   es lo que la Privacy Policy ya promete por escrito ("You can ask us to
   delete your account and personal data by emailing…", Legal.jsx:140). La
   pantalla y el documento legal por fin dicen lo mismo.

   ─── ¿Y POR QUÉ DOBLE CONFIRMACIÓN SI AL FINAL SÓLO ABRE UN CORREO? ──────
   Pregunta justa, y se contestó en la auto-revisión antes de escribir el
   campo. Dos razones, ninguna decorativa:
     1. La compuerta no protege una escritura destructiva — protege a la
        persona de MANDAR una petición que no quería mandar, y obliga a que
        el momento de escribir tu propio handle sea el momento en que la
        pantalla te dice qué significa borrarse aquí.
     2. Es la UI que va a estar delante del borrado real el día que exista el
        RPC. Construirla ahora significa que ese día se cambia el destino del
        botón y no se inventa una confirmación de cero.
   Y para que la compuerta no MIENTA mientras tanto, dos cosas son
   innegociables en el copy: el botón NO dice "Delete my account" (dice lo
   que hace: mandar la petición), y la hoja dice literalmente que nada se
   borra desde aquí. Escribir tu handle no borró nada, y la hoja lo dice
   antes, durante y después.
   ========================================================================= */
function DeleteAccountSheet({ onClose, wide, email, username, userId }) {
  const [typed, setTyped] = useState('')
  const [sent, setSent] = useState(false)
  /* El foco se pinta con un ANILLO, no con el borde. El borde de este campo
     ya tiene un trabajo —encenderse cuando lo tecleado COINCIDE— y si el foco
     lo encendiera también, un campo enfocado y equivocado se vería idéntico a
     uno correcto: se perdería la única confirmación visual de la compuerta.
     Dos señales distintas para dos cosas distintas. Y hace falta alguna:
     con outline:none y sin esto, quien navega con teclado no veía DÓNDE
     estaba parado dentro de la hoja más delicada de la app. */
  const [focused, setFocused] = useState(false)

  /* El objetivo a teclear es el @handle si existe y el correo si no. No se
     pide "DELETE" en mayúsculas: teclear una palabra genérica es un reflejo,
     teclear TU nombre te obliga a mirar de quién es la cuenta — que es el
     error que esta compuerta previene de verdad. */
  const target = username ? `@${username}` : (email || '')
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/^@/, '')
  const match = norm(typed) !== '' && norm(typed) === norm(target)

  const requestBody = [
    "I'm asking for my Collectiv4 account to be deleted.",
    '',
    `Handle     ${username ? `@${username}` : '—'}`,
    `User ID    ${userId || '—'}`,
    `App        ${APP_VERSION}`,
    '',
    '',
  ].join('\n')
  const requestHref = mailtoUrl(SUPPORT_EMAIL, 'Account deletion request', requestBody)

  return (
    <GlassSheet title="Delete account" kicker={'✕  Leaving'} onClose={onClose} wide={wide} maxWidth="470px">
      <div data-testid="delete-account-sheet" style={{ padding: '2px 12px 10px' }}>

        {/* La primera frase de la hoja es la que evita el malentendido. Va
            arriba de todo, en hueso, antes de cualquier control. */}
        <p style={{ fontFamily: FONT_SANS, fontSize: '14px', lineHeight: 1.6, color: BONE, margin: '0 0 16px' }}>
          Nothing on this screen deletes anything.
        </p>

        <div style={{ fontFamily: FONT_SANS, fontSize: '12.5px', lineHeight: 1.68, color: BONE_MID, display: 'flex', flexDirection: 'column', gap: '11px' }}>
          <p style={{ margin: 0 }}>
            There is no self-serve delete here yet. Removing an account is done by
            a person, on request — and we answer.
          </p>
          <p style={{ margin: 0 }}>
            What actually happens: your world comes down and stops being readable
            by anyone. It is reversible for a while, on purpose, so a decision made
            at 3am is not permanent by 3:05. What we keep is only what we are
            required to — a record that a ticket sale happened.
          </p>
          <p style={{ margin: 0, color: BONE_LOW }}>
            The database blocks your own account from setting that flag, by design,
            so no screen can do it on your behalf.
          </p>
        </div>

        {/* El separador de la casa: filete, no caja. */}
        <div style={{ height: '1px', background: HAIR, margin: '20px 0' }} />

        {!sent ? (
          <>
            <label htmlFor="delete-confirm" style={{
              display: 'block', fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW,
              letterSpacing: '.22em', textTransform: 'uppercase', marginBottom: '9px',
            }}>
              Type <span style={{ color: BONE }}>{target || 'your handle'}</span> to confirm
            </label>
            <input
              id="delete-confirm"
              data-testid="delete-confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="delete-confirm-hint"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(var(--ink-rgb),.022)',
                // El campo despierta cuando lo tecleado coincide — el mismo
                // gesto de luz que la puerta de invitación (EarlyAccessGate).
                border: `1px solid ${match ? 'rgba(var(--ink-rgb),.42)' : HAIR_HI}`,
                borderRadius: '4px', padding: '15px 14px',
                fontFamily: FONT_MONO,
                // 16px no es gusto: por debajo, iOS Safari hace zoom al
                // enfocar y la hoja se descuadra a media confirmación.
                fontSize: '16px', letterSpacing: '.06em',
                color: BONE, outline: 'none', caretColor: BONE,
                // Anillo de foco: 2px sin desenfoque sobre el canal de tinta.
                // No es sombra de SaaS (no hay difuminado ni desplazamiento)
                // y se invierte solo de día, como todo lo que va por canal.
                boxShadow: focused ? '0 0 0 2px rgba(var(--ink-rgb),.20)' : 'none',
                transition: 'border-color .35s var(--ease-house), box-shadow .2s var(--ease-house)',
              }}
            />

            {/* `href` va SIEMPRE puesto, aunque el control esté apagado: un
                <a> sin href no es enfocable, o sea que la versión "limpia"
                (quitar el href hasta que coincida) sacaba el control del
                tabulador y quien navega con teclado no encontraba nunca la
                acción de la hoja. Con href permanente + aria-disabled el
                lector de pantalla lo anuncia como deshabilitado, el foco
                llega, y el clic se detiene en el handler — que es donde
                debe detenerse. */}
            <a
              href={requestHref}
              data-testid="delete-request-link"
              aria-disabled={!match}
              onClick={(e) => {
                if (!match) { e.preventDefault(); return }
                setSent(true)
              }}
              className={match ? 'pressable' : undefined}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                width: '100%', boxSizing: 'border-box', marginTop: '14px',
                background: match ? BONE : 'rgba(var(--ink-rgb),.06)',
                color: match ? 'var(--bg)' : BONE_LOW,
                border: match ? 'none' : `1px solid ${HAIR}`,
                borderRadius: '4px', padding: '16px',
                fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '.2em',
                textTransform: 'uppercase', fontWeight: 500, textDecoration: 'none',
                cursor: match ? 'pointer' : 'default',
                transition: 'background .4s var(--ease-house), color .4s var(--ease-house)',
              }}
            >
              Email the request <ArrowUpRight size={13} />
            </a>

            <p id="delete-confirm-hint" style={{
              fontFamily: FONT_SANS, fontSize: '11.5px', lineHeight: 1.6, color: BONE_LOW,
              margin: '12px 0 0', textAlign: 'center',
            }}>
              This opens your mail app with the request written out. You send it —
              and you can read it first.
            </p>
          </>
        ) : (
          /* EL ESTADO TERMINAL. "should have opened", no "opened": nadie puede
             saber desde el navegador si el cliente de correo abrió de verdad,
             y afirmarlo sería inventar un acuse de recibo. Por eso además va
             el camino de repuesto: copiar el texto y mandarlo por donde sea. */
          <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: SILVER, letterSpacing: '.26em', textTransform: 'uppercase', marginBottom: '12px' }}>
              ◇&nbsp;&nbsp;Request written
            </div>
            <p style={{ fontFamily: FONT_SANS, fontSize: '13.5px', lineHeight: 1.65, color: BONE_MID, margin: '0 auto 6px', maxWidth: '36ch' }}>
              Your mail app should have opened with the request ready. Nothing has
              been deleted — send that email and a founder takes it from there.
            </p>
            <p style={{ fontFamily: FONT_SANS, fontSize: '12px', lineHeight: 1.6, color: BONE_LOW, margin: '0 auto 18px', maxWidth: '36ch' }}>
              We reply to the address you signed up with. If your mail app didn't
              open, copy the request and send it any way you like to{' '}
              <span className="selectable" style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID }}>{SUPPORT_EMAIL}</span>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <CopyBlock text={requestBody} idle="Copy the request" done="Copied" />
              <button type="button" onClick={onClose} className="pressable" style={{
                background: 'none', border: `1px solid ${HAIR_HI}`, borderRadius: '100px',
                padding: '5px 13px', cursor: 'pointer', fontFamily: FONT_MONO, fontSize: '9px',
                color: BONE_LOW, letterSpacing: '.12em', textTransform: 'uppercase',
              }}>Close</button>
            </div>
          </div>
        )}

        {/* WARN se usa UNA vez en toda la hoja y para la única frase que
            protege dinero de alguien. La casa no pinta semáforos (ver el
            comentario del botón de Sign out) — este token es el de aviso,
            no el de "peligro rojo", y una sola línea lo mantiene siendo
            señal en vez de decoración. */}
        <p style={{
          fontFamily: FONT_SANS, fontSize: '11.5px', lineHeight: 1.6, color: WARN,
          margin: '20px 0 0', paddingTop: '14px', borderTop: `1px solid ${HAIR}`,
        }}>
          Holding a ticket to an upcoming room? Deleting takes that with it. Tell
          us in the email if you want the ticket sorted out first.
        </p>
      </div>
    </GlassSheet>
  )
}

/* ── la pantalla ──────────────────────────────────────────────────────── */

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { pref, resolved } = useTheme()
  const navigate = useNavigate()
  const wide = useWide()
  const [profile, setProfile] = useState(null)
  const [profileReady, setProfileReady] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [geo, setGeo] = useState('unknown')
  /* EL COLOR DEL SELLO VIVE AQUÍ Y NO EN <BadgePicker/>, porque hay DOS
     lugares en esta pantalla que lo enseñan: el selector y la tarjeta de
     cuenta. Con el estado adentro del selector, la tarjeta nunca se
     enteraba y la pantalla se contradecía a sí misma a la vista. El
     inicializador es perezoso a propósito: `readBadgeColor` toca
     localStorage y no debe correr en cada render. */
  const [badgeKey, setBadgeKey] = useState(readBadgeColor)
  const pickBadge = (k) => { setBadgeKey(k); writeBadgeColor(k) }
  /* v17 — LA CIUDAD SE GUARDA DE VERDAD. El stub "Save my city" mentía
     ("needs a column and a policy that don't exist yet") — profiles.city
     existe desde el arranque y profiles_self_update la cubre. Ésta es la
     única escritura de perfil en esta pantalla: el builder pregunta la
     ciudad al construir (v17 F3), y esta fila es el "editable después sin
     cazar menús legacy" del mismo send-off. draft null = sin tocar. */
  const [cityDraft, setCityDraft] = useState(null)
  const [citySaved, setCitySaved] = useState(false)
  const [cityBusy, setCityBusy] = useState(false)
  const cityValue = cityDraft ?? (profile?.city || '')
  const saveCity = async () => {
    if (cityBusy || cityDraft === null) return
    const v = cityDraft.trim()
    if (v === (profile?.city || '')) { setCityDraft(null); return }
    setCityBusy(true)
    const { error } = await supabase.from('profiles').update({ city: v || null }).eq('id', user.id)
    setCityBusy(false)
    if (!error) {
      setProfile(p => (p ? { ...p, city: v } : p))
      setCityDraft(null)
      setCitySaved(true)
      setTimeout(() => setCitySaved(false), 2000)
    }
  }
  // Una sola variable para las tres hojas: nunca hay dos abiertas, y con un
  // booleano por hoja sí podría haberlas si un render se cruza.
  const [sheet, setSheet] = useState(null)  // 'status' | 'card' | 'delete' | null

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
       renderiza con la pastilla compartida, que es lo que la ley pide.

       V14 — la selección creció con `id, avatar_url, created_at` porque la
       tarjeta de cuenta necesita la foto y la tarjeta de identidad necesita
       las tres. Es la MISMA fila y la misma lectura: una consulta más ancha,
       no una consulta más. Nada de lo nuevo se escribe nunca desde aquí. */
    supabase.from('profiles')
      .select('id, full_name, username, avatar_url, is_demo, verified, created_at, city')
      .eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (alive) { setProfile(data || null); setProfileReady(true) } },
            () => { if (alive) setProfileReady(true) })
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

  /* Sólo dispara el diálogo del sistema. No se guarda la coordenada en ningún
     lado — no hay dónde, y escribirla sin decirlo sería justo el tipo de cosa
     que esta pantalla existe para no hacer.

     ─── EL FALLO NO ES SIEMPRE UN "NO" ──────────────────────────────────────
     La versión anterior mandaba TODO error a 'denied'. GeolocationPositionError
     tiene tres códigos y sólo el 1 es una negativa:
       1 PERMISSION_DENIED   → dijiste que no
       2 POSITION_UNAVAILABLE→ dijiste que sí y el aparato no encontró señal
       3 TIMEOUT             → dijiste que sí y no le alcanzaron los 8s
     Con 2 y 3 pintados como "Blocked", alguien que ACABA de dar permiso
     estando bajo techo leía que lo tiene bloqueado y que lo arregle en los
     ajustes del navegador — donde no hay nada que arreglar. Una instrucción
     falsa es peor que un estado falso: manda a la persona a trabajar en balde.

     Y el `prev === 'granted'` no es paranoia, es una carrera real: el listener
     de permissions.query dispara 'granted' en el momento en que aceptas, y el
     timeout llega DESPUÉS a sobreescribirlo. El permiso lo sabe el navegador,
     no este callback; si ya nos dijo que sí, un fallo de señal no lo desdice. */
  const askGeo = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      () => setGeo('granted'),
      (err) => setGeo((prev) => (prev === 'granted' ? prev : err?.code === 1 ? 'denied' : 'unavailable')),
      { timeout: 8000 }
    )
  }

  if (authLoading) return <AuthResolving />
  // <Navigate/>, NO navigate() suelto: llamar al navegador durante el render
  // es un efecto en fase de render — React avisa ("cannot update a component
  // while rendering a different component") y el redirect queda a merced del
  // orden de commit. El elemento lo hace en el sitio correcto del ciclo.
  // `replace` para que el botón de atrás no rebote contra esta pantalla.
  if (!user) return <Navigate to="/" replace />

  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email || '—'
  const geoLabel = { granted: 'Allowed', denied: 'Blocked', unavailable: 'No fix', prompt: 'Not asked yet', unsupported: 'Unsupported', unknown: '…' }[geo] || geo
  const geoHint = geo === 'denied' ? 'Blocked — your browser settings can undo this.'
    : geo === 'unavailable' ? "Your device couldn't get a fix. Nothing was blocked — try again."
    : 'Asks your device, nothing else.'

  // El diagnóstico y el mailto se arman en render porque no llevan reloj (ver
  // la nota de diagnosticsBlock): son función pura de datos que ya están en
  // pantalla, así que no pueden envejecer con la pestaña abierta.
  const themeLine = pref === 'system' ? `system (${resolved})` : pref
  const diagnostics = diagnosticsBlock({ theme: themeLine, userId: user.id, sessionId })
  const supportHref = mailtoUrl(
    SUPPORT_EMAIL,
    `Support — The Collectiv4 (${APP_VERSION})`,
    `[ Tell us what happened, and what you expected instead. ]\n\n\n---\n${diagnostics}\n`
  )

  const closeSheet = () => setSheet(null)

  return (
    <div style={{
      minHeight: '100vh',
      padding: wide ? '40px clamp(24px, 4vw, 56px) 96px' : '26px 18px 40px',
      maxWidth: wide ? '760px' : 'none',
      margin: wide ? '0 auto' : 0,
    }}>
      {/* EL ÚNICO MOMENTO DE CROMO DE LA PANTALLA (Ley 8). Todo lo demás es
          hueso y mono. Un settings con joyería en cada sección sería un
          catálogo de efectos; con una sola es una portada. La tarjeta de
          cuenta de abajo lleva Bebas en HUESO SÓLIDO por lo mismo: dos
          momentos de cromo en una pantalla es cero momentos de cromo. */}
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

      <AccountCard
        name={displayName}
        username={profile?.username}
        avatarUrl={profile?.avatar_url}
        isDemo={profile?.is_demo}
        verified={profile?.verified}
        badgeKey={badgeKey}
        ready={profileReady}
        onOpen={() => navigate('/profile')}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

        {/* 01 — GENERAL. Apariencia (real), notificaciones (no) e idioma (no).
            Las tres viven juntas porque las tres contestan "¿cómo llega la
            app hasta mí?" — y porque poner la única que funciona al lado de
            las dos que no, con el sello puesto, es la manera más rápida de
            que se entienda la diferencia entre las dos clases de fila. */}
        <section>
          {/* LA FRASE DE LA CAMPANA SE RESTITUYÓ AQUÍ. Vivía en la vieja
              sección 07 y se cayó al fundir nueve secciones en seis — y era
              el ÚNICO dato verdadero que la página daba sobre notificaciones.
              Sin ella quedaban dos filas selladas diciendo qué no existe y
              nada diciendo qué sí, o sea que la sección se leía como "aquí no
              te llega nada", que es falso: los triggers de `notifications`
              están vivos desde 0042/0043/0048 y la campana suena hoy. Lo que
              no hay es TABLA DE PREFERENCIAS — y ésa es la frase exacta.
              Decir sólo lo que falta también es contar mal. */}
          <SectionHead n="01" mark="◇" title="General"
            note="Dark is the house. Light is the same universe by day — the same constellation, read as graphite on paper. Below it: the two things that reach you when you're not here, and the language they reach you in. The bell inside the app is already live — messages and requests ring today. What you can't do yet is choose which ones." />
          <Panel>
            <ThemePills />
            {/* EL SELLO SÓLO SE PINTA SI EL SELLO ES TUYO. `verified` lo
                escribe el servidor y el trigger lock_verified impide que un
                cliente se lo ponga, así que esta compuerta descansa sobre un
                hecho real y no sobre una bandera de UI. Sin eso, cualquiera se
                pintaría un sello y el sello dejaría de significar algo — que
                es exactamente lo que la insignia existe para significar. */}
            {profile?.verified && <BadgePicker value={badgeKey} onPick={pickBadge} />}

            <div style={{ borderTop: `1px solid ${HAIR}` }}>
              <Row label="Push notifications" hint="There is no service worker and no web-push subscription in this app yet. A switch here would turn on nothing — and you'd only find out by waiting for a notification that never comes.">
                <Pending />
              </Row>
              <Row label="Email notifications" hint="No preferences table exists; today email is transactional only (tickets, password resets).">
                <Pending />
              </Row>
              {/* IDIOMA — la decisión, argumentada, porque el pedido dejaba
                  abierto omitirla.

                  Se QUEDA la fila y se va el selector. Un picker con una sola
                  opción es teatro: promete elección donde no hay ninguna. Pero
                  omitir la fila entera tampoco es neutral — deja a alguien que
                  lee esto en Houston, donde media ciudad habla español,
                  buscando un control que no existe y sin saber si es que no
                  está o es que no lo encuentra. La ausencia informa peor que
                  la verdad escrita.

                  El sello dice "Not translated" y no "Needs backend" a
                  propósito: esto NO lo desbloquea el servidor. Lo desbloquea
                  que alguien extraiga los textos y los traduzca. Nombrar la
                  pieza que falta de verdad es lo que separa una promesa de
                  una excusa. */}
              <Row label="Language" hint="English only for now. There is no translation layer and no second language file — a picker with one option would be a choice you can't make." last>
                <Pending>Not translated</Pending>
              </Row>
            </div>
          </Panel>
        </section>

        {/* 02 — TU EXPEDIENTE. Todo lo que la plataforma sabe y enseña de ti,
            y las puertas a las superficies donde eso se ve completo. */}
        <section>
          <SectionHead n="02" mark="●" title="Your record" />
          <Panel>
            <Row label="Email">
              <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
            </Row>
            <Row label="User ID" hint="Paste this when you report something.">
              <CopyValue value={user.id} />
            </Row>
            <Row label="Session ID" hint="An identifier for this sign-in. Never your token.">
              <CopyValue value={sessionId} />
            </Row>
            {/* LAS DOS PUERTAS A LAS HOJAS NUEVAS.

                ⚠ LAS PISTAS DECÍAN "Also on your profile." Y SE QUITÓ. En el
                plan, el hogar principal de las dos es el museo y Settings era
                la puerta de servicio — pero AL DÍA DE HOY, en esta rama,
                Profile.jsx y ProfileMuseum.jsx no montan ninguna de las dos
                (grep de StatusSheet / IdentityCard sobre los dos archivos:
                cero). O sea que la frase mandaba a la persona a buscar a
                /profile una entrada que no está, dos veces, en la única
                pantalla cuya ley escrita prohíbe exactamente eso.

                No se escribe una frase con la esperanza de que otro agente
                la vuelva verdad antes del merge: si el cableado del perfil
                entra EN EL MISMO merge, esto se corrige entonces y con el
                código delante. Mientras tanto la pista dice sólo lo que la
                fila hace, que es abrir la hoja. */}
            <Row label="Where you stand" hint="Your tier and what the next one asks for."
              onClick={() => setSheet('status')} testId="settings-status-row">
              <ChevronRight size={15} color={SILVER} />
            </Row>
            {/* LA ÚNICA FILA QUE ESPERA A QUE LA LECTURA VUELVA, y la razón es
                que la tarjeta imprime un NOMBRE. Con `profile` todavía en
                null la tarjeta pinta su respaldo ("UNNAMED") — correcto como
                respaldo suyo, falso como estado nuestro: la persona SÍ tiene
                nombre, sólo que la consulta no volvió. Abrirla en ese instante
                sería enseñar un dato equivocado durante medio segundo, y un
                dato equivocado medio segundo sigue siendo un dato equivocado.
                Mientras carga, el chevron es un spinner y la fila no abre;
                si la lectura resolvió SIN fila, un guión — no se pudo leer tu
                expediente, y eso se dice, no se disfraza de tarjeta vacía. */}
            <Row label="Your identity card" hint="The card with your name and number."
              onClick={profile ? () => setSheet('card') : undefined} testId="settings-card-row">
              {/* BONE_LOW en los dos, no FAINT — y aquí importa más que en
                  ningún otro sitio de la pantalla: ese guión NO es un adorno
                  ni un separador, es el estado "no pudimos leer tu
                  expediente". Pintado a ~2:1 de contraste, para quien ve poco
                  la fila se lee VACÍA, y una fila vacía dice "aquí no hay
                  nada" en vez de "algo falló". El aviso vuelve a ser lo menos
                  visible de la pantalla, que es la corrección que <Pending/>
                  ya lleva escrita arriba. El spinner va igual: también es
                  estado, no decoración. */}
              {profile
                ? <ChevronRight size={15} color={SILVER} />
                : profileReady
                  ? <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_LOW }}>—</span>
                  : <Loader2 size={13} style={{ color: BONE_LOW, animation: 'spin 1s linear infinite' }} />}
            </Row>
            {/* v14 — LA PUERTA DE VUELTA AL RECORRIDO. Real, no <Pending/>:
                0049 ya está en prod, así que replayTour() escribe de verdad.

                v15 — DETRÁS DE TUTORIAL_ENABLED (firstRun.js): el recorrido
                está apagado por decisión de founders. Con el tour apagado esta
                fila relanzaría un recorrido que nunca va a montar — el control
                muerto exacto que la ley de esta pantalla prohíbe. Así que
                desaparece entera, no se sella con <Pending/>: no está
                "esperando backend", está apagada a propósito. Si el flag
                vuelve a true, la fila vuelve sola, con todo su cableado vivo.

                LLEVA RECARGA A PROPÓSITO, y no es pereza. firstRun.js lo deja
                advertido en el cuerpo de replayTour: limpia la fila y el caché
                pero NO el `dismissed` de useFirstRun, que es estado de SESIÓN.
                Cableada sin recargar, esta fila se pulsaría y no pasaría nada
                visible hasta el siguiente arranque — exactamente el control que
                la ley de esta pantalla prohíbe. Así que el gesto se completa
                entero: se escribe, y se vuelve a la portada ya sin la marca,
                donde el recorrido arranca solo. `assign` y no `navigate` porque
                hace falta un montaje limpio del hook, no una transición de
                router. Si el UPDATE falla no se recarga: mejor una fila que no
                responde que una recarga que promete un recorrido que no viene. */}
            {TUTORIAL_ENABLED && (
              <Row label="Replay the walkthrough" hint="See the seven-step tour again. Takes you back to the start."
                onClick={async () => {
                  const r = await replayTour(user.id)
                  if (r?.ok) window.location.assign('/')
                }}>
                <ChevronRight size={15} color={SILVER} />
              </Row>
            )}
            <Row label="Edit your world" hint="Cover, crafts, moments — the builder." onClick={() => navigate('/profile')}>
              <ChevronRight size={15} color={SILVER} />
            </Row>
            {/* v13 — la puerta a la gestión de vínculos */}
            <Row label="Connections" hint="Connected, requests, close friends — manage your people." onClick={() => navigate('/connections')} last>
              <ChevronRight size={15} color={SILVER} />
            </Row>
          </Panel>
        </section>

        {/* 03 — PRIVACIDAD. La sección que MÁS fácil habría sido falsear. */}
        <section>
          <SectionHead n="03" mark="○" title="Privacy"
            note="Your world is a public address on purpose — a link someone shares has to open it, not a wall. What stays private isn't a setting: your CONNECTED list has no public read path in the database at all. Nobody can open it, including us." />
          <Panel>
            {/* BLOQUEOS — LA FILA MÁS PELIGROSA DE TODA LA APP.

                No hay tabla `blocks` ni `blocked_users`. No existe. Un control
                aquí sería un botón que le dice a alguien "esta persona ya no
                te puede alcanzar" mientras la persona sigue pudiendo — y
                quien confió en el botón es quien lo paga, en la vida real, no
                en un ticket.

                Y NO LLEVA CONTEO, tampoco un "0". Un cero no es neutral:
                afirma que la función existe y que tu lista está vacía. Dos
                mentiras en un carácter. El sello y la razón escrita, nada
                más. Ésta es literalmente la fila para la que se escribió la
                ley que encabeza este archivo. */}
            <Row label="Blocked users" hint="Blocking isn't built. There is no blocks table in the database, so there is nothing here to show you a number for — and a control that says someone can't reach you, while they still can, is the one lie that costs a person something real.">
              <Pending />
            </Row>
            <Row label="Private world" hint="Hide your world from anyone you haven't accepted. Needs a visibility column on profiles and a matching read policy — neither exists yet.">
              <Pending />
            </Row>
            <Row label="Who can see you're attending" hint="Chosen per room today, when you get a ticket. A global default is not stored yet." last>
              <Pending />
            </Row>
          </Panel>

          {/* Los documentos van en su propio panel y no mezclados con los
              controles de arriba: lo que se puede LEER hoy no debe compartir
              lista con lo que todavía no se puede HACER. */}
          <Panel style={{ marginTop: '10px' }}>
            <Row label="Privacy Policy" hint="Includes how cookies and local storage are used — minimal, session-only, no third-party ad tracking, so there is nothing to opt out of." onClick={() => navigate('/privacy')}>
              <ChevronRight size={15} color={SILVER} />
            </Row>
            <Row label="Terms" onClick={() => navigate('/terms')}>
              <ChevronRight size={15} color={SILVER} />
            </Row>
            <Row label="Refunds" hint="What happens if a room moves, or checkout charged you twice." onClick={() => navigate('/refunds')} last>
              <ChevronRight size={15} color={SILVER} />
            </Row>
          </Panel>
        </section>

        {/* 04 — UBICACIÓN */}
        <section>
          <SectionHead n="04" mark="✕" title="Location"
            note="For the map of rooms near you. The permission below is real and lives in your browser; the only thing stored is the city you type yourself." />
          <Panel>
            <Row label="Location access" hint={geoHint}>
              <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: geo === 'granted' ? SILVER : BONE_LOW, letterSpacing: '.12em', textTransform: 'uppercase' }}>{geoLabel}</span>
              {/* 'unavailable' TIENE que conservar el botón: si el aparato no
                  encontró señal, la única salida es volver a intentar. Sin
                  esta rama la fila quedaba en un callejón — un estado sin
                  acción, que es la otra forma de mentirle a alguien. */}
              {(geo === 'prompt' || geo === 'unknown' || geo === 'unavailable') && (
                <button type="button" onClick={askGeo} className="pressable" style={{
                  display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(var(--ink-rgb),.06)',
                  border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '5px 11px', cursor: 'pointer',
                  fontFamily: FONT_MONO, fontSize: '9px', color: BONE, letterSpacing: '.12em', textTransform: 'uppercase',
                }}><MapPin size={10} /> Allow</button>
              )}
            </Row>
            <Row label="Your city" hint="Where real life happens for you — it feeds who the universe puts near you. The builder asks once; change it here whenever it changes." last testId="settings-city-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  value={cityValue}
                  onChange={e => setCityDraft(e.target.value)}
                  onBlur={saveCity}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCity() } }}
                  placeholder="Houston"
                  maxLength={60}
                  aria-label="Your city"
                  data-testid="settings-city-input"
                  style={{
                    width: '130px', background: 'rgba(var(--ink-rgb),.06)', border: `1px solid ${HAIR_HI}`,
                    borderRadius: '8px', padding: '7px 10px', color: BONE, fontFamily: FONT_SANS,
                    fontSize: '12.5px', outline: 'none', textAlign: 'right',
                  }} />
                {cityBusy ? <Loader2 size={12} style={{ color: BONE_LOW, animation: 'spin 1s linear infinite' }} />
                  : citySaved ? <Check size={12} style={{ color: SILVER }} /> : null}
              </span>
            </Row>
          </Panel>
        </section>

        {/* 05 — SOPORTE.

            NO HAY FILA DE "HELP CENTER", y no por descuido: no existe un
            centro de ayuda, no hay artículos, no hay dominio donde vivan. Una
            fila que enlaza a un 404 es peor que no tener la fila — te hace
            caminar hasta la puerta para encontrarla tapiada. Lo que SÍ existe
            son dos personas que contestan correos y tres documentos escritos
            en lenguaje humano (arriba, en 03). Eso es la ayuda de esta
            plataforma hoy, y eso es lo que se ofrece. */}
        <section>
          <SectionHead n="05" mark="△" title="Support"
            note="Two founders read this mailbox. The report carries what we need to find your problem, so you don't have to describe your phone." />
          <Panel>
            <Row label="Contact support" href={supportHref} testId="settings-support-row"
              hint="Opens your mail app with the version, platform, theme and your ids already written in. Read it before you send it — it's your email.">
              <ArrowUpRight size={15} color={SILVER} />
            </Row>
            <Row label="Diagnostics" hint="The same block, for when mail isn't the way you want to reach us.">
              <CopyBlock text={diagnostics} idle="Copy" />
            </Row>
            <Row label="Version">
              <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID }}>{APP_VERSION}</span>
            </Row>
            <Row label="Platform" last>
              <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID }}>{platformLine()}</span>
            </Row>
          </Panel>
          <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', color: FAINT, letterSpacing: '.22em', textTransform: 'uppercase', marginTop: '12px', textAlign: 'center' }}>
            The Collectiv4 LLC · Houston, Texas
          </div>
        </section>

        {/* 06 — CUENTA. Salir y pedir irse. Plata fantasma, nunca rojo: la
            paleta no admite semáforos, y cerrar sesión no es una emergencia
            (panel catch). Sign out va primero por ser lo común y lo seguro. */}
        <section>
          <SectionHead n="06" mark="✕" title="Account" />
          <button
            onClick={async () => { await signOut(); navigate('/') }}
            className="pressable"
            /* Vidrio de verdad: este botón vive SUELTO en la sección, fuera
               de cualquier <Panel/>. Los controles de adentro (el "Allow" de
               ubicación, las pastillas de tema) NO lo llevan a propósito —
               ahí arriba hay un cardGlass() que ya es raíz de backdrop, y
               anidar vidrio da el parche gris que glass.js documenta. */
            style={{
              ...glassControl(),
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
              padding: '15px', borderRadius: '10px', cursor: 'pointer',
              fontFamily: FONT_MONO, fontSize: '11px', color: SILVER, letterSpacing: '.16em', textTransform: 'uppercase',
              transition: 'border-color .2s var(--ease-house)',
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(var(--silver-rgb),.45)' }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),0.22)' }}
          >
            <LogOut size={13} /> Sign out
          </button>

          {/* La fila no grita. La gravedad la carga la hoja, no un botón rojo
              — y el hint ya dice la única cosa que hay que saber antes de
              tocarla, que es que tocarla no borra nada. */}
          <Panel style={{ marginTop: '10px' }}>
            <Row label="Delete account" hint="What deleting actually means here, and how to ask for it. Nothing is deleted from this screen."
              onClick={() => setSheet('delete')} testId="settings-delete-row" last>
              <ChevronRight size={15} color={SILVER} />
            </Row>
          </Panel>
        </section>

        <div style={{ textAlign: 'center', fontFamily: FONT_MONO, fontSize: '8.5px', color: FAINT, letterSpacing: '.24em', textTransform: 'uppercase', paddingTop: '4px' }}>
          ●&nbsp;&nbsp;○&nbsp;&nbsp;✕&nbsp;&nbsp;△&nbsp;&nbsp;◇
        </div>
      </div>

      {/* ── LAS HOJAS ──────────────────────────────────────────────────────
          Se montan sólo cuando se abren: con `sheet === null` el chunk de
          StatusSheet/IdentityCard nunca se descarga y ninguna de las dos
          paga un render. Las tres portalean a <body> por su cuenta
          (GlassSheet lo hace), que es obligatorio aquí — el wrapper de
          página de Layout es un contexto de apilamiento y la barra vale
          9999 en el plano del documento. */}
      {sheet === 'status' && (
        <SheetBoundary fallback={<SheetFailed onClose={closeSheet} wide={wide} />}>
          <Suspense fallback={<SheetLoading />}>
            <StatusSheetLazy profileId={user.id} onClose={closeSheet} wide={wide} />
          </Suspense>
        </SheetBoundary>
      )}

      {sheet === 'card' && (
        <SheetBoundary fallback={<SheetFailed onClose={closeSheet} wide={wide} />}>
          <Suspense fallback={<SheetLoading />}>
            {/* `tier={null}` es deliberado y NO es un olvido: esta pantalla no
                lee la escalera, y la tarjeta ya trata null como "desconocido"
                y pinta un guión en vez de inventar un rango. Un peldaño falso
                sería peor que ninguno. Si el orquestador quiere el rango real
                aquí, se pasa el registro de fetchMyStatus — ver `wiring`. */}
            <IdentityCardSheetLazy open profile={profile} tier={null} onClose={closeSheet} />
          </Suspense>
        </SheetBoundary>
      )}

      {sheet === 'delete' && (
        <DeleteAccountSheet
          onClose={closeSheet}
          wide={wide}
          email={user.email}
          username={profile?.username}
          userId={user.id}
        />
      )}

    </div>
  )
}
