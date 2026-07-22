import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Mark from '@/components/Mark'
import { useWide } from '@/lib/useIsDesktop'
import { useFocusTrap } from '@/lib/focusTrap'
import { glassSurface } from '@/lib/glass'
import {
  BONE, BONE_MID, BONE_LOW, FAINT, HAIR, HAIR_HI,
  FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, EASE_HOUSE,
} from '@/lib/cosmos'

/* =========================================================================
   ONBOARDING — la bienvenida. Se ve UNA vez, en la primera sesión.

   NO ES UN WIZARD. No pide nada, no valida nada, no bloquea nada: cuenta en
   cuatro tiempos qué se puede hacer aquí y se quita. Por eso el botón de
   SALTAR está desde el primer fotograma y no se esconde nunca — quien ya
   sabe qué es esto no debería tener que aprender a cerrar una pantalla que
   nunca pidió.

   ── SÓLO SE PROMETE LO QUE EXISTE ────────────────────────────────────────
   Cada frase de este archivo apunta a una superficie que ya está en el
   repo: el museo del perfil, /community, /connections + close friends,
   /messages, la campana (notifications, 0042/0043/0048), CREATE (post ·
   curate · make a plan · list an offer) y los eventos con sus tickets. Nada
   más. Una bienvenida es el peor lugar del producto para prometer algo que
   no está: es la primera vez que alguien nos cree.
   NO HAY mapa, importación, lista de lugares, reseñas, calificaciones,
   tienda ni reservas. No se mencionan porque no existen.
   TAMPOCO HAY PROGRESIÓN. Nada en esta app se desbloquea por usarla: no hay
   niveles, ni puertas que abran solas al crecer. Ver la nota del tiempo 03.
   Y UN "SÓLO" OBLIGA A LA LISTA COMPLETA: si una frase acota lo que puede
   pasar, tiene que nombrar todo lo que pasa. Ver la nota del tiempo 04.

   ── EL MATERIAL, Y POR QUÉ EL VELO ES CLARO ──────────────────────────────
   La tarjeta es glassSurface() de verdad, y el velo detrás se queda en .62
   a propósito. glass.js lo explica: difuminar negro da negro — sobre un velo
   casi opaco el backdrop-filter no tiene nada que muestrear y la "hoja de
   vidrio" lee como una placa plana. A .62 el cielo compartido (Atmosphere)
   sigue vivo detrás y el vidrio hace su trabajo. Es literalmente "vidrio
   sobre el cielo", no vidrio sobre un rectángulo negro.

   ⚠ EL VELO ES HERMANO, NO ANCESTRO. Va como <div> absoluto DENTRO del
   contenedor fijo, al lado de la tarjeta — nunca envolviéndola. La clase
   .overlay-backdrop anima OPACIDAD, y un ancestro con opacity<1 convierte a
   la tarjeta en backdrop root por especificación: el vidrio pasaría a
   muestrear a su padre en vez de la página, y en WebKit de iOS eso no se
   recupera hasta un repintado completo (la falla documentada de v11 en
   GlassNav). Con el velo de hermano, la cadena de la tarjeta queda limpia.

   ⚠ LA TARJETA NO SE MUEVE. Nada de .dialog-in ni de un envoltorio con
   transform: un transform sobre —o encima de— un elemento con
   backdrop-filter mata el muestreo en WebKit para el resto de la sesión
   (index.css, nota de .disc-card). La entrada la hacen el velo (fundido) y
   el CONTENIDO (escalonado). Es suficiente, y es la única versión que no
   arriesga el material.

   ── LA ENTRADA ES UNA TRANSICIÓN, NO UNA ANIMACIÓN ───────────────────────
   Se usa el patrón rise(delay) de EarlyAccessGate en vez de las clases
   .rise de index.css. La razón está medida en index.css:794-809: una
   animación que existe pero no avanza pinta su PRIMER fotograma, y el primer
   fotograma de .rise es opacity:0. En una línea de ceremonia eso es una
   línea que falta; aquí sería la pantalla entera en blanco. Una transición
   declara su estado FINAL en el DOM: si nunca corre, el contenido
   simplemente está ahí. Con movimiento reducido arranca ya compuesto.
   ========================================================================= */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia(REDUCED_QUERY).matches

/* LA TRAMPA DE FOCO vivía aquí con la advertencia de que un tercer
   consumidor la mudaría a su propio módulo. AuthModal fue el tercero (v15):
   ahora vive en src/lib/focusTrap.js, con sus notas. Tutorial importa de
   allá; prefersReducedMotion sigue siendo de esta pantalla. */

/* ── LOS CUATRO TIEMPOS ───────────────────────────────────────────────────
   Cuatro y no seis: una bienvenida que se hace larga deja de ser bienvenida.
   Cada marca sale de Mark.jsx (world · people · plus · marquee), que es la
   misma fuente que usa la barra de navegación para sus ranuras, así que
   cuando el recorrido señale la barra el glifo ya va a resultar conocido.
   Continuidad barata y real: cero dibujos nuevos.
   Con UNA salvedad, dicha para que nadie la "arregle" al revés: la ranura de
   CREATE en la barra no dibuja Mark 'plus', dibuja el <Plus> de lucide
   (GlassNav.jsx:2 y :196). Son dos cruces distintas del mismo peso óptico y
   se leen como la misma idea; unificarlas es una decisión de la barra, no de
   esta pantalla. */
const BEATS = [
  {
    mark: 'world',
    kicker: 'Your world',
    title: 'A PROFILE\nIS A ROOM',
    body: 'Not a bio. A cover, the crafts you actually practise, the moments you post, and what you offer. You build it, and it starts empty on purpose — nothing here is filled in for you.',
  },
  {
    mark: 'people',
    kicker: 'Your people',
    title: 'FIND\nYOUR OWN',
    body: 'Community is where the worlds are. Follow one to keep it close. Send a connection when it goes both ways — both sides have to say yes. The star marks close friends: the short list inside your connections.',
  },
  {
    mark: 'plus',
    kicker: 'Create',
    title: 'THE ONLY\nBUTTON THAT\nMAKES THINGS',
    /* AQUÍ DECÍA "some doors open as your world grows" Y ERA MENTIRA.
       En esta app no hay una sola puerta que abra por crecer. Las tres de
       CreateCentral son: planReady y marketReady —sondas de ESQUEMA
       (circleReady/socialReady, CreateCentral.jsx:96 y :100), verdaderas
       para todo el mundo en producción— y `verified`, que la enciende un
       fundador a mano y que el trigger lock_verified prohíbe auto-otorgarse.
       O sea: alguien podía llevar su mundo al 100% de worldCompleteness
       (world.js:189), volver a abrir el +, y HOST AN EVENT seguiría sin
       aparecer. Prometer progresión donde sólo hay una decisión humana es
       exactamente lo que la cabecera de este archivo prohíbe.
       Las cuatro acciones que quedan nombradas son las que ve CUALQUIERA que
       abra el + el primer día (SHARE completo + GATHER/plan + OFFER). */
    body: 'The + at the centre of the bar. Post a moment to your world, curate the room itself, make a plan and invite people, or list what you offer.',
  },
  {
    mark: 'marquee',
    kicker: 'The rooms',
    title: 'AND THE\nNIGHTS\nTHEMSELVES',
    /* LA LISTA DE LA CAMPANA ES COMPLETA, O NO SE DICE "SÓLO".
       Los tipos CON PRODUCTOR REAL hoy son siete: follow (trigger 0048),
       friend_request y friend_accept (0043), plan_invite y plan_rsvp (0043,
       notif_on_plan_member), message (0043) y ticket_sale (0043).
       La versión anterior nombraba cuatro y remataba con "nothing else pings
       you": el tiempo 03 manda a hacer un plan e invitar gente, y la primera
       respuesta a ese plan encendía la campana por una quinta vía que esta
       pantalla acababa de negar. Se desmentía sola en un día.
       `offer_sale` y `match_new` están en la restricción de tipos (0048:30)
       pero NO tienen productor — no se nombran: prometer una campana que
       nadie puede tocar es el mismo error por el otro lado. */
    body: 'Every event has its own room and its own tickets. Messages holds the conversations — one to one, or a whole room. The bell only rings for what a person does with you: a follow, a connection, a plan invite or an answer, a message, a ticket sold.',
  },
]

const pad = (n) => String(n).padStart(2, '0')

export default function Onboarding({ onDone }) {
  const wide = useWide()
  const cardRef = useRef(null)
  const [i, setI] = useState(0)
  const [enter, setEnter] = useState(prefersReducedMotion())
  const titleId = useId()
  const bodyId = useId()

  const beat = BEATS[i]
  const last = i === BEATS.length - 1

  /* onDone(started) — `started` NO es telemetría, es una decisión: llegar al
     final ("Begin") deja entrar al recorrido de 7 pasos; Skip y Escape lo
     cierran también. Encadenar siete coach-marks detrás de un "saltar" sería
     contestar exactamente lo contrario de lo que la persona acaba de pedir.
     Quien lo monta decide qué hacer con el booleano; useFirstRun ya lo hace. */
  const leave = useCallback((started) => { onDone?.(started) }, [onDone])
  const skip = useCallback(() => leave(false), [leave])
  useFocusTrap(cardRef, skip)

  /* El escalonado se REPITE en cada tiempo: se apaga y se vuelve a encender
     un fotograma después, así el contenido del tiempo nuevo entra igual que
     el primero. Con movimiento reducido `enter` nunca baja, así que no hay
     parpadeo — sólo un cambio de texto. */
  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    setEnter(false)
    const t = setTimeout(() => setEnter(true), 30)
    return () => clearTimeout(t)
  }, [i])

  const go = useCallback((next) => {
    if (next < 0) return
    if (next >= BEATS.length) { leave(true); return }
    setI(next)
  }, [leave])

  // flechas del teclado: el mismo recorrido sin ratón ni dedo
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); setI((v) => Math.min(v + 1, BEATS.length - 1)) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setI((v) => Math.max(v - 1, 0)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* El deslizamiento se mide en touchend contra touchstart y NUNCA llama a
     preventDefault: la tarjeta puede tener que desplazarse en vertical en un
     teléfono chico, y robarle el gesto a Safari por un carrusel horizontal
     es cambiar una comodidad por una avería. 45px es viaje honesto, no
     temblor de pulgar. */
  const touch = useRef({ x: 0, y: 0 })
  const onTouchStart = (e) => {
    const t = e.touches[0]
    if (t) touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    const t = e.changedTouches?.[0]
    if (!t) return
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return
    go(dx < 0 ? i + 1 : i - 1)
  }

  const rise = (d) => ({
    opacity: enter ? 1 : 0,
    transform: enter ? 'translateY(0)' : 'translateY(9px)',
    transition: prefersReducedMotion() ? 'none' : `opacity .7s ${EASE_HOUSE} ${d}ms, transform .7s ${EASE_HOUSE} ${d}ms`,
  })

  const ghostBtn = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px',
    fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.22em',
    textTransform: 'uppercase', color: BONE_LOW,
    transition: `color .25s ${EASE_HOUSE}`,
  }

  return createPortal(
    <div role="presentation" style={{
      position: 'fixed', inset: 0,
      /* por encima de la barra (9999), de AuthModal (10000), de CREATE
         (10005) y de GlassSheet (10020): la primera vez tapa a todos */
      zIndex: 10030,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: wide ? '40px' : '18px',
    }}>
      {/* el velo — HERMANO de la tarjeta, jamás su ancestro (ver cabecera) */}
      <div aria-hidden="true" className="overlay-backdrop" style={{
        position: 'absolute', inset: 0, background: 'rgba(var(--void-rgb),.62)',
      }} />

      <div
        ref={cardRef} tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{
          position: 'relative', width: '100%',
          maxWidth: wide ? '560px' : '440px', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          // 18px = el radio de hoja que ya usa GlassSheet. El techo de 10px
          // del sistema es para TARJETAS; esto es una hoja, y ser hermana de
          // la que ya existe vale más que ser fiel a la regla equivocada.
          borderRadius: '18px', overflow: 'hidden', outline: 'none',
          ...glassSurface(),
        }}>

        {/* ── cabecera: el marcador de sección y la salida ─────────────────
            SKIP NO ENTRA EN EL ESCALONADO. Se dibuja opaco desde el primer
            fotograma, sin transición ni retraso: la salida de una pantalla
            que nadie pidió no puede depender de que una animación corra
            (misma ley que la identidad del perfil, index.css:794-809). */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px', padding: wide ? '22px 26px 0' : '18px 20px 0', flexShrink: 0,
        }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>
            ◇&nbsp;&nbsp;Welcome
          </div>
          <button type="button" className="pressable" onClick={skip} style={{ ...ghostBtn, padding: '8px 2px' }}
            onMouseOver={(e) => { e.currentTarget.style.color = BONE }}
            onMouseOut={(e) => { e.currentTarget.style.color = BONE_LOW }}>
            Skip
          </button>
        </div>

        {/* aria-live envuelve al TIEMPO COMPLETO —número, marca, titular y
            cuerpo— y no sólo al párrafo: el texto se reemplaza dentro de los
            mismos nodos, así que sin una región viva un lector de pantalla
            enmudecería después del primer tiempo, aunque la pantalla haya
            cambiado entera. */}
        <div className="no-scrollbar" aria-live="polite" style={{
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: wide ? '30px 44px 0' : '22px 24px 0',
        }}>
          {/* numeración de catálogo + la marca de la sala */}
          <div style={{ ...rise(0), display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: '9.5px', letterSpacing: '.28em', color: FAINT }}>
              {pad(i + 1)}
            </span>
            <span aria-hidden="true" style={{ width: '18px', height: '1px', background: HAIR_HI }} />
            <Mark type={beat.mark} size={16} color="var(--silver)" />
            <span style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.26em', textTransform: 'uppercase', color: BONE_LOW }}>
              {beat.kicker}
            </span>
          </div>

          {/* EL ÚNICO MOMENTO DE CROMO DE LA PANTALLA (Ley 8). Este modal
              cubre el viewport completo: es su propia pantalla, así que
              tiene derecho a UNO — y es el titular. Nada más brilla aquí. */}
          <h2 id={titleId} style={{
            ...rise(80), ...chromeText,
            fontFamily: FONT_DISPLAY, fontWeight: 400,
            fontSize: wide ? 'clamp(40px, 4.4vw, 56px)' : 'clamp(32px, 9vw, 42px)',
            lineHeight: 0.92, letterSpacing: '.02em',
            margin: wide ? '20px 0 0' : '16px 0 0', whiteSpace: 'pre-line',
          }}>
            {beat.title}
          </h2>

          {/* La altura mínima es estructural, no estética: sin ella la
              tarjeta cambia de tamaño entre tiempos y los botones se mueven
              bajo el pulgar de quien está tocando "Next". */}
          <p id={bodyId} style={{
            ...rise(150), fontFamily: FONT_SANS,
            fontSize: wide ? '15px' : '14px', lineHeight: 1.68, color: BONE_MID,
            margin: wide ? '22px 0 0' : '18px 0 0', maxWidth: '46ch',
            minHeight: wide ? '110px' : '150px', textWrap: 'pretty',
          }}>
            {beat.body}
          </p>
        </div>

        {/* ── el pie: dónde estás y a dónde vas ───────────────────────────── */}
        <div style={{
          flexShrink: 0, padding: wide ? '20px 44px 26px' : '16px 24px calc(20px + env(safe-area-inset-bottom, 0px))',
          marginTop: '8px', borderTop: `1px solid ${HAIR}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            {/* los puntos son BOTONES de verdad: si se ven pulsables, llevan
                a algún lado (Ley 9 — cada clic cumple su promesa) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {BEATS.map((b, idx) => (
                <button key={b.kicker} type="button" onClick={() => setI(idx)}
                  aria-label={`Go to ${b.kicker}`} aria-current={idx === i ? 'step' : undefined}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '8px 3px', lineHeight: 0,
                  }}>
                  <span style={{
                    display: 'block', width: idx === i ? '18px' : '5px', height: '5px',
                    borderRadius: '100px',
                    background: idx === i ? BONE : 'rgba(var(--ink-rgb),.22)',
                    transition: prefersReducedMotion() ? 'none' : `width .35s ${EASE_HOUSE}, background .35s ${EASE_HOUSE}`,
                  }} />
                </button>
              ))}
            </div>
            <span style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.24em', color: FAINT }}>
              {pad(i + 1)} / {pad(BEATS.length)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginTop: '12px' }}>
            {/* un <span/> vacío sostiene el lugar cuando no hay Back, para
                que "Next" no cambie de sitio entre el primer tiempo y el
                segundo (mismo recurso que el topBar de Profile.jsx) */}
            {i > 0 ? (
              <button type="button" className="pressable" onClick={() => go(i - 1)} style={ghostBtn}
                onMouseOver={(e) => { e.currentTarget.style.color = BONE }}
                onMouseOut={(e) => { e.currentTarget.style.color = BONE_LOW }}>
                Back
              </button>
            ) : <span />}

            <button type="button" className="pressable" onClick={() => go(i + 1)}
              style={{
                background: BONE, color: 'var(--bg)', border: 'none', borderRadius: '4px',
                padding: wide ? '15px 30px' : '14px 26px', cursor: 'pointer',
                fontFamily: FONT_MONO, fontSize: '10.5px', letterSpacing: '.22em',
                textTransform: 'uppercase', fontWeight: 500,
              }}>
              {last ? 'Begin' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
