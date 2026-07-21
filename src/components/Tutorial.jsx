import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Mark from '@/components/Mark'
import { useWide } from '@/lib/useIsDesktop'
import { useFocusTrap, prefersReducedMotion } from '@/components/Onboarding'
import {
  BONE, BONE_MID, BONE_LOW, FAINT, HAIR, HAIR_HI,
  FONT_DISPLAY, FONT_MONO, FONT_SANS, EASE_HOUSE,
} from '@/lib/cosmos'

/* =========================================================================
   TUTORIAL — el recorrido de siete marcas, encima de la app de verdad.

   La diferencia con <Onboarding/> no es de tono, es de NATURALEZA: la
   bienvenida CUENTA (es su propia pantalla), el recorrido SEÑALA (la app
   sigue ahí abajo y se ve por el hueco). Por eso este archivo mide el DOM
   real en vez de dibujar una maqueta de la barra: una maqueta se desincroniza
   el día que alguien reordena las pestañas, y entonces el tutorial le enseña
   a la gente una app que no existe.

   ── LAS SIETE MARCAS SON NUESTRAS ────────────────────────────────────────
   01 el recorrido · 02 CREATE · 03 community · 04 messages · 05 la campana ·
   06 connections + close friends · 07 tu mundo.
   Todas son superficies vivas de ESTA app. El paso 01 y el 07 no son el
   mismo: el 01 es el encuadre (qué es esto, cuánto dura, cómo se sale) y el
   07 es el museo del perfil, que es donde el recorrido termina a propósito
   — la última cosa que ves es la tuya.

   ── DEGRADA HONESTO O NO SEÑALA ──────────────────────────────────────────
   Un coach-mark que apunta a 0,0 es peor que ninguno: enseña un lugar
   equivocado con toda la autoridad de la interfaz. Aquí un paso sólo señala
   si encuentra su elemento Y ese elemento tiene caja usable Y está dentro
   del viewport. Si algo de eso falla, el globo se centra y el foco se cierra
   a un punto: sigue explicando la función, deja de mentir sobre dónde está.
   Eso NO es un caso raro — es el camino normal de dos pasos:
     · 01 no tiene a qué apuntar (es el encuadre)
     · 06 tampoco: /connections no vive en la barra, se llega desde Messages
       o desde Settings. Se dice con palabras, no con una flecha inventada.

   ── LAS DOS BARRAS NO SON LA MISMA BARRA ─────────────────────────────────
   GlassNav (teléfono) y GlassNavDesktop (>=1024px) montan EXCLUYÉNDOSE, y
   su orden de ranuras es distinto porque CREATE va al centro geométrico en
   el teléfono y al final en escritorio. Se resuelve por TEXTO de la ranura
   (que sobrevive a un reordenamiento) y sólo se cae al índice si el texto
   cambiara. Ninguno de los dos archivos se toca desde aquí: este componente
   lee el DOM, no lo edita.

   ── EL MATERIAL: AQUÍ NO HAY VIDRIO, Y ES A PROPÓSITO ────────────────────
   El velo del foco es casi opaco (.84) porque un reflector sólo se lee si
   su alrededor está oscuro. glass.js dice la consecuencia con todas sus
   letras: difuminar negro da negro. Un backdrop-filter sobre este velo
   costaría un re-rasterizado por fotograma para muestrear casi-negro y
   devolver una placa plana. Así que el globo es panel SÓLIDO con las tres
   señales de canto que glass.js documenta (filo especular arriba, piso
   oscuro abajo, proyectada) — el filo carga la profundidad, no el blur.
   Beneficio colateral: sin backdrop-filter, el globo PUEDE reposicionarse
   sin miedo (un transform sobre un elemento con backdrop-filter mata el
   muestreo en WebKit para el resto de la sesión).

   ── CROMO: NINGUNO ───────────────────────────────────────────────────────
   Ley 8, una vez por PANTALLA. Esta superficie no es una pantalla: la app
   está debajo y se ve. El museo del perfil ya gasta su cromo en el NOMBRE;
   un titular cromado aquí sería el segundo de la vista. Bebas en hueso
   sólido, y punto.
   ========================================================================= */

const STEPS = [
  {
    mark: 'ring', target: null, kicker: 'The tour',
    title: 'SEVEN MARKS',
    body: 'About a minute. Nothing here changes anything — it only shows you where things live. You can leave at any point.',
  },
  {
    mark: 'plus', target: 'create', kicker: 'Create',
    title: 'THE +',
    body: 'Everything you make starts here: a moment for your world, a plan with people, or an offer.',
  },
  {
    mark: 'people', target: 'community', kicker: 'Community',
    title: 'THE PEOPLE',
    body: 'Search, browse, open a world. Following is one tap and it asks nobody permission.',
  },
  {
    mark: 'bubble', target: 'messages', kicker: 'Messages',
    title: 'THE CONVERSATIONS',
    body: 'One to one, or a whole room around an event or a plan.',
  },
  {
    /* LA MISMA LISTA QUE EL TIEMPO 04 DE <Onboarding/>, PALABRA POR PALABRA.
       Los siete tipos con productor real: follow (0048) · friend_request ·
       friend_accept · plan_invite · plan_rsvp · message · ticket_sale (todos
       0043). Decía cuatro y cerraba con "nothing else pings you" — el primer
       RSVP a un plan la desmentía. `offer_sale` y `match_new` existen en la
       restricción de tipos (0048:30) y no tienen productor: no se nombran.
       Si algún día se agrega un tipo, se cambian LAS DOS pantallas juntas.
       Dos copias de la misma frase divergiendo es el bug que documenta la
       cabecera de Chip.jsx, y aquí costaría la credibilidad de la campana. */
    mark: 'dot', target: 'messages', kicker: 'The bell',
    title: 'WHAT REACHES YOU',
    body: 'The bell rides on Messages. It only lights for what a person does with you: a follow, a connection, a plan invite or an answer, a message, a ticket sold.',
  },
  {
    mark: 'star', target: null, kicker: 'Connections',
    title: 'THE SHORT LIST',
    body: 'A connection goes both ways — both sides have to say yes. The star marks close friends. You manage them from Messages, or from Settings.',
  },
  {
    mark: 'world', target: 'profile', kicker: 'Your world',
    title: 'YOUR OWN ROOM',
    body: 'The cover, your crafts, the moments you post, what you offer. It starts empty, and only you can fill it.',
  },
]

/* El rótulo visible de cada ranura, que es la llave de búsqueda primaria.
   Los dos órdenes existen porque las barras SON distintas (ver cabecera);
   sólo se usan si el texto dejara de coincidir. */
const NAV_LABEL = { event: 'Event', community: 'Community', create: 'Create', messages: 'Messages', profile: 'Profile' }
const PHONE_ORDER = ['event', 'community', 'create', 'messages', 'profile']
const DESK_ORDER = ['event', 'community', 'messages', 'profile', 'create']

/* Lo que se dice CON PALABRAS cuando no se pudo señalar con una flecha.
   No es una disculpa ni un error: es la misma información por el otro
   canal. Fijate que CREATE no dice "la pestaña Create" — no es una
   pestaña, es el + del centro, y decirlo mal sería el mismo tipo de
   mentira pequeña que apuntar al lugar equivocado. */
const WHERE = {
  event: 'The Event tab, in the bar',
  community: 'The Community tab, in the bar',
  messages: 'The Messages tab, in the bar',
  profile: 'The Profile tab, in the bar',
  create: 'The + at the centre of the bar',
}

/* `data-c4-tour` es el gancho ESTABLE y hoy no existe en ninguna parte: se
   busca primero para que el día que GlassNav/GlassNavDesktop lo lleven, este
   archivo empiece a usarlo sin cambiar una línea. Mientras tanto, texto. */
function findNavSlot(key) {
  if (!key) return null
  const stable = document.querySelector(`[data-c4-tour="${key}"]`)
  if (stable) return stable

  const phone = document.querySelector('nav.glass-nav')
  const desk = document.querySelector('header.glass-header nav')
  const bar = phone || desk
  if (!bar) return null

  const buttons = Array.from(bar.querySelectorAll('button'))
  if (buttons.length === 0) return null

  const label = (NAV_LABEL[key] || '').toLowerCase()
  if (label) {
    const byText = buttons.find((b) => {
      const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase()
      if (aria === label) return true
      // el texto del botón de Messages incluye el número de la campana
      // ("3Messages") — por eso includes y no igualdad
      return (b.textContent || '').trim().toLowerCase().includes(label)
    })
    if (byText) return byText
  }

  const order = phone ? PHONE_ORDER : DESK_ORDER
  const i = order.indexOf(key)
  return i >= 0 ? (buttons[i] || null) : null
}

/* Una caja sirve si existe, tiene tamaño real y está DENTRO de la pantalla.
   Lo tercero es lo que salva al recorrido de señalar una barra que en ese
   ancho no se montó: sin esta prueba, un rect de ceros pasaría por bueno. */
function usableRect(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return null
  const r = el.getBoundingClientRect()
  if (!r || r.width < 8 || r.height < 8) return null
  const vw = window.innerWidth || document.documentElement.clientWidth
  const vh = window.innerHeight || document.documentElement.clientHeight
  if (r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right }
}

const HALO = 10          // aire alrededor del elemento señalado
const GAP = 16           // separación entre el foco y el globo
const EDGE = 14          // margen mínimo contra el canto de la pantalla
const pad = (n) => String(n).padStart(2, '0')
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export default function Tutorial({ onDone }) {
  const wide = useWide()
  const panelRef = useRef(null)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const [calloutH, setCalloutH] = useState(200)
  const [vp, setVp] = useState(() => ({
    w: typeof window === 'undefined' ? 0 : window.innerWidth,
    h: typeof window === 'undefined' ? 0 : window.innerHeight,
  }))
  // marcado por defecto: el camino normal es que el recorrido no vuelva
  const [remember, setRemember] = useState(true)
  const [enter, setEnter] = useState(prefersReducedMotion())
  const titleId = useId()
  const bodyId = useId()

  const step = STEPS[i]
  const last = i === STEPS.length - 1
  const reduced = prefersReducedMotion()

  /* La casilla manda en TODAS las salidas —terminar, cerrar con la ×,
     Escape— y no sólo en la última pantalla. Desmarcada no se escribe nada
     y el recorrido vuelve en el siguiente arranque, que es exactamente lo
     que dicen sus palabras. Un control que se puede mover y no hace nada es
     peor que uno que no existe (la ley que preside Settings.jsx). */
  const rememberRef = useRef(remember)
  rememberRef.current = remember
  const close = useCallback(() => { onDone?.(rememberRef.current) }, [onDone])

  useFocusTrap(panelRef, close)

  /* ── LA MEDICIÓN ──────────────────────────────────────────────────────
     Se remide en cada paso, en cada resize, en cada scroll (con captura:
     un scroll dentro de un contenedor interno no burbujea hasta window) y
     en los eventos de visualViewport, que en iOS son los únicos que avisan
     cuando la barra de Safari se colapsa o entra el teclado.
     Con rAF de por medio para no medir dos veces en el mismo fotograma:
     getBoundingClientRect fuerza layout y esto puede dispararse en ráfaga.

     ES useLayoutEffect Y NO useEffect POR UN FOTOGRAMA CONCRETO: al cambiar
     de paso, con un efecto pasivo React pinta primero el texto NUEVO y mide
     después, así que existe un fotograma con la copia del paso 04 sobre el
     reflector del 03 (o sobre el punto central). Un recorrido cuya tesis es
     "degrada honesto o no señala" no puede permitirse ni un fotograma
     señalando el lugar equivocado. La primera medición corre antes de
     pintar; el rAF de asentamiento de abajo sigue siendo posterior, que es
     donde tiene que estar (la barra puede montar en el mismo commit). */
  useLayoutEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const w = window.innerWidth
      const h = window.innerHeight
      // los dos setState comparan antes de escribir: sin esto, cada
      // fotograma de un scroll o de un resize produciría un objeto nuevo y
      // un re-render aunque nada se hubiera movido un píxel
      setVp((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
      const next = usableRect(findNavSlot(step.target))
      setRect((prev) => {
        if (!prev && !next) return prev
        if (!prev || !next) return next
        const same = Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5
          && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5
        return same ? prev : next
      })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }

    measure()
    // segunda pasada un fotograma después: la barra puede montar en el mismo
    // commit que nosotros y su vidrio se coloca al armarse (GlassNav espera
    // un rAF para habilitar transiciones)
    const settle = requestAnimationFrame(schedule)

    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.addEventListener('scroll', schedule, true)
    const vv = window.visualViewport
    vv?.addEventListener('resize', schedule)
    vv?.addEventListener('scroll', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      cancelAnimationFrame(settle)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.removeEventListener('scroll', schedule, true)
      vv?.removeEventListener('resize', schedule)
      vv?.removeEventListener('scroll', schedule)
    }
  }, [step.target, wide])

  // el alto del globo cambia con el largo del texto; se mide para poder
  // colocarlo arriba o abajo del objetivo con la cuenta correcta
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return undefined
    const read = () => {
      const h = el.getBoundingClientRect().height
      setCalloutH((prev) => (Math.abs(prev - h) < 1 ? prev : h))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [i])

  // el contenido de cada paso vuelve a entrar escalonado (misma mecánica de
  // transición que la bienvenida: si nunca corre, el texto igual está ahí)
  useEffect(() => {
    if (reduced) return undefined
    setEnter(false)
    const t = setTimeout(() => setEnter(true), 30)
    return () => clearTimeout(t)
  }, [i, reduced])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); setI((v) => Math.min(v + 1, STEPS.length - 1)) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setI((v) => Math.max(v - 1, 0)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const next = () => { if (last) close(); else setI((v) => v + 1) }

  /* ── EL HUECO ─────────────────────────────────────────────────────────
     Un solo elemento para los dos estados. Sin objetivo, el hueco se
     encoge a un punto en el centro: la sombra de 9999px sigue cubriendo
     todo, así que la pantalla queda uniformemente oscura y el reflector se
     CIERRA y se vuelve a ABRIR entre pasos en vez de cortar a negro. Un
     elemento, cero remontajes, cero fundidos cruzados que doblen el velo. */
  const halo = rect
    ? { top: rect.top - HALO, left: rect.left - HALO, width: rect.width + HALO * 2, height: rect.height + HALO * 2 }
    : { top: vp.h / 2, left: vp.w / 2, width: 0, height: 0 }
  const haloRadius = rect ? Math.min(18, halo.height / 2) : 0

  /* ── DÓNDE VA EL GLOBO ────────────────────────────────────────────────
     Se prefiere ABAJO del objetivo si cabe, porque la barra de escritorio
     vive arriba; la del teléfono vive abajo y ahí no cabe, así que sube
     sola. Sin objetivo, centrado. Todo termina sujeto contra los cantos:
     el globo nunca se sale de la pantalla, aunque la cuenta ideal lo pida. */
  const calloutW = Math.min(wide ? 400 : 360, Math.max(240, vp.w - EDGE * 2))
  let top
  let left
  let arrow = null
  if (rect) {
    const roomBelow = vp.h - (halo.top + halo.height) - GAP - EDGE
    const below = roomBelow >= calloutH
    top = below ? halo.top + halo.height + GAP : halo.top - GAP - calloutH
    top = clamp(top, EDGE, Math.max(EDGE, vp.h - calloutH - EDGE))
    left = clamp(rect.left + rect.width / 2 - calloutW / 2, EDGE, Math.max(EDGE, vp.w - calloutW - EDGE))
    const tip = rect.left + rect.width / 2 - left
    // la punta sólo se dibuja si el globo quedó realmente del lado que dice
    // apuntar; si el sujetado lo movió encima del objetivo, no hay flecha
    const aligned = below ? top >= halo.top + halo.height : top + calloutH <= halo.top
    arrow = aligned ? { side: below ? 'top' : 'bottom', x: clamp(tip, 22, calloutW - 22) } : null
  } else {
    top = clamp(vp.h / 2 - calloutH / 2, EDGE, Math.max(EDGE, vp.h - calloutH - EDGE))
    left = clamp(vp.w / 2 - calloutW / 2, EDGE, Math.max(EDGE, vp.w - calloutW - EDGE))
  }

  const rise = (d) => ({
    opacity: enter ? 1 : 0,
    transform: enter ? 'translateY(0)' : 'translateY(7px)',
    transition: reduced ? 'none' : `opacity .55s ${EASE_HOUSE} ${d}ms, transform .55s ${EASE_HOUSE} ${d}ms`,
  })

  const ghostBtn = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '11px 4px',
    fontFamily: FONT_MONO, fontSize: '9.5px', letterSpacing: '.2em',
    textTransform: 'uppercase', color: BONE_LOW, transition: `color .25s ${EASE_HOUSE}`,
  }

  /* La punta: un cuadradito girado 45° con dos de sus lados pintados, para
     que se lea como una esquina del panel y no como un triángulo pegado.
     El transform aquí es inofensivo — este panel NO lleva backdrop-filter
     (ver cabecera), así que no hay muestreo que romper. */
  const arrowStyle = arrow ? {
    position: 'absolute', width: '11px', height: '11px',
    left: `${arrow.x - 5.5}px`,
    [arrow.side]: '-6px',
    background: arrow.side === 'top' ? 'var(--card-hi-solid)' : 'var(--card-solid)',
    borderTop: arrow.side === 'top' ? `1px solid ${HAIR_HI}` : 'none',
    borderLeft: arrow.side === 'top' ? `1px solid ${HAIR_HI}` : 'none',
    borderBottom: arrow.side === 'bottom' ? `1px solid ${HAIR_HI}` : 'none',
    borderRight: arrow.side === 'bottom' ? `1px solid ${HAIR_HI}` : 'none',
    transform: 'rotate(45deg)',
  } : null

  return createPortal(
    <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 10030 }}>

      {/* el tragaluz que come los clics: mientras el recorrido está abierto
          la app de abajo se MIRA, no se toca. Salir es lo único que se
          puede hacer, y para eso están la ×, Escape y GET STARTED. */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />

      {/* EL HUECO. pointerEvents:none para que la sombra no se coma nada por
          su cuenta; quien bloquea es la capa de arriba. */}
      <div aria-hidden="true" style={{
        position: 'fixed', boxSizing: 'border-box', pointerEvents: 'none',
        top: `${halo.top}px`, left: `${halo.left}px`,
        width: `${halo.width}px`, height: `${halo.height}px`,
        borderRadius: `${haloRadius}px`,
        border: rect ? '1px solid rgba(var(--ink-rgb),.26)' : 'none',
        // el velo ENTERO es esta sombra: un solo elemento oscurece todo
        // menos su propia caja, y su caja es el hueco. Sin capas apiladas,
        // sin recortes SVG, sin máscaras que no invierten con el tema.
        boxShadow: '0 0 0 9999px rgba(var(--void-rgb),.84)',
        /* la geometría se anima en LAYOUT y no con transform a propósito: el
           hueco tiene que seguir siendo un hueco de tamaño exacto, y un
           scale deformaría el radio y el grosor del filo. Es UN elemento
           fijo; el costo es despreciable frente a la mentira visual. */
        transition: reduced ? 'none'
          : `top .42s ${EASE_HOUSE}, left .42s ${EASE_HOUSE}, width .42s ${EASE_HOUSE}, height .42s ${EASE_HOUSE}, border-radius .42s ${EASE_HOUSE}`,
      }} />

      {/* ── EL GLOBO ─────────────────────────────────────────────────────── */}
      <div
        ref={panelRef} tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
        style={{
          position: 'fixed', top: `${top}px`, left: `${left}px`, width: `${calloutW}px`,
          boxSizing: 'border-box', outline: 'none',
          background: 'linear-gradient(180deg, var(--card-hi-solid) 0%, var(--card-solid) 100%)',
          border: `1px solid ${HAIR_HI}`, borderRadius: '10px',
          /* Las tres señales de canto de glass.js, sin blur: filo especular
             arriba, piso oscuro debajo, proyectada. El filo carga el volumen
             (quitá cualquiera de las tres y se cae, por más opacidad que le
             pongas — está medido en la nota de WELL).
             El rgba(255,255,255,·) de la especular es DELIBERADO y es el
             mismo criterio que glass.js: la luz cae de arriba en el vacío y
             de día también, así que ese reflejo no invierte con el tema.
             Es la única excepción del archivo; todo lo demás va por canal. */
          boxShadow: [
            'inset 0 1px 0.5px rgba(255,255,255,0.22)',
            'inset 0 -14px 20px -16px rgba(var(--shadow-rgb),0.55)',
            '0 18px 48px rgba(var(--shadow-rgb),0.55)',
          ].join(', '),
          /* SIN transición de posición: el globo SALTA de paso a paso y es
             el contenido el que vuelve a entrar. Deslizar una caja de texto
             mientras cambia su texto es ilegible, y el reflector ya carga
             todo el movimiento que esta pantalla necesita. */
        }}>

        {arrowStyle && <span aria-hidden="true" style={arrowStyle} />}

        {/* cabecera: paso, marca y la salida */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
            <Mark type={step.mark} size={14} color="var(--silver)" />
            <span style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.26em', textTransform: 'uppercase', color: FAINT, whiteSpace: 'nowrap' }}>
              Step {pad(i + 1)}/{pad(STEPS.length)}
            </span>
            <span aria-hidden="true" style={{ width: '10px', height: '1px', background: HAIR_HI, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.2em', textTransform: 'uppercase', color: BONE_LOW, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {step.kicker}
            </span>
          </div>
          <button type="button" className="pressable" onClick={close} aria-label="Close the tour"
            style={{
              flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%',
              background: 'rgba(var(--ink-rgb),.06)', border: `1px solid ${HAIR}`, color: BONE_LOW,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <X size={12} />
          </button>
        </div>

        {/* la barra de avance: una vía hairline y un relleno de hueso.
            scaleX porque es lo barato y aquí no hay vidrio que proteger. */}
        <div aria-hidden="true" style={{ margin: '12px 16px 0', height: '2px', background: 'rgba(var(--ink-rgb),.10)', borderRadius: '100px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: BONE, borderRadius: '100px',
            transform: `scaleX(${(i + 1) / STEPS.length})`, transformOrigin: 'left center',
            transition: reduced ? 'none' : `transform .45s ${EASE_HOUSE}`,
          }} />
        </div>

        {/* el cuerpo. aria-live sobre el bloque entero para que cada paso se
            ANUNCIE al cambiar: el texto se reemplaza en el mismo nodo, y sin
            esto un lector de pantalla no diría nada después del primer paso. */}
        <div aria-live="polite" style={{ padding: '16px 16px 4px' }}>
          <h2 id={titleId} style={{
            ...rise(0), fontFamily: FONT_DISPLAY, fontWeight: 400, color: BONE,
            fontSize: wide ? '25px' : '23px', lineHeight: 1, letterSpacing: '.03em', margin: 0,
          }}>
            {step.title}
          </h2>
          <p id={bodyId} style={{
            ...rise(70), fontFamily: FONT_SANS, fontSize: '13.5px', lineHeight: 1.6,
            color: BONE_MID, margin: '10px 0 0',
            // altura mínima: sin ella los botones bailan bajo el pulgar de
            // paso a paso, porque el texto de cada uno mide distinto
            minHeight: '62px', textWrap: 'pretty',
          }}>
            {step.body}
          </p>

          {/* LA HONESTIDAD DEL PASO SIN OBJETIVO. No se dice "mira la barra"
              cuando no encontramos la barra: se dice dónde vive de verdad.
              Sólo aparece cuando el paso pretendía señalar y no pudo.

              ⚠ VA EN BONE_LOW, NUNCA EN FAINT. Este renglón ES el mecanismo
              de degradación completo: cuando no hay reflector, estos nueve
              píxeles son el ÚNICO canal que lleva dónde está la cosa. FAINT
              (--cream-ghost) mide ~2.2:1 en los dos temas y el propio
              index.css lo declara con todas sus letras — "filetes y adornos,
              jamás texto". --cream-low mide 4.6:1 y pasa AA de texto chico.
              Dejarlo en el gris decorativo le borraba la única información
              del paso a quien peor ve, mientras el cromo de alrededor seguía
              legible: exactamente al revés de lo que hay que perder. */}
          {step.target && !rect && (
            <p style={{ ...rise(120), fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', color: BONE_LOW, margin: '10px 0 0', lineHeight: 1.6 }}>
              ◇&nbsp;&nbsp;{WHERE[step.target] || 'In the navigation bar'}
            </p>
          )}
        </div>

        {/* la casilla. Es real: desmarcada, al salir no se guarda nada y el
            recorrido vuelve. El renglón de abajo confirma en voz alta lo que
            va a pasar, para que nadie tenga que adivinarlo. */}
        <div style={{ padding: '6px 16px 0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
              style={{ width: '14px', height: '14px', margin: 0, accentColor: 'var(--cream)', cursor: 'pointer', flexShrink: 0 }} />
            <span style={{ fontFamily: FONT_SANS, fontSize: '12px', color: BONE_MID }}>Don&rsquo;t show this again</span>
          </label>
          {/* BONE_LOW por la misma razón que el renglón de arriba: esta línea
              es lo que hace HONESTA a la casilla —dice en voz alta qué va a
              pasar al salir— y bajo la ley de Settings.jsx un control cuya
              promesa no se puede leer es un control que miente. FAINT lo
              dejaba en ~2.2:1; --cream-low lo pone en 4.6:1. */}
          <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.18em', textTransform: 'uppercase', color: BONE_LOW, marginTop: '6px', minHeight: '12px' }}>
            {remember ? '' : 'The tour will open again next time'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 16px 14px', marginTop: '6px', borderTop: `1px solid ${HAIR}` }}>
          {i > 0 ? (
            <button type="button" className="pressable" onClick={() => setI((v) => v - 1)} style={ghostBtn}
              onMouseOver={(e) => { e.currentTarget.style.color = BONE }}
              onMouseOut={(e) => { e.currentTarget.style.color = BONE_LOW }}>
              Back
            </button>
          ) : <span />}

          <button type="button" className="pressable" onClick={next}
            style={{
              background: BONE, color: 'var(--bg)', border: 'none', borderRadius: '4px',
              padding: '12px 20px', cursor: 'pointer',
              fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.2em',
              textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap',
            }}>
            {last ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
