import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import Mark from './Mark'
import { CHIP, WELL, BONE_GLOW, WORD_CHIP_RADIUS } from '@/lib/glass'

/* =========================================================================
   GlassNavDesktop (v12) — la barra de arriba, hermana de GlassNav.

   ─── CINCO BURBUJAS IGUALES, CREATE INCLUIDO ──────────────────────────────

   La versión anterior dejaba a CREATE fuera del sistema: era una pastilla
   RELLENA al lado de cuatro marcas metidas cada una en su circulito, con
   anchos distintos y separación de 2px. Leía como cuatro cosas + un bicho.

   Ahora la fila son CINCO RANURAS IDÉNTICAS y CREATE es una de ellas:

   · Mismo tratamiento — cada ranura ES una burbuja de vidrio en reposo
     (WELL); ninguna tiene fondo propio distinto.
   · Mismo tamaño — `flex: 1 1 0` sobre una fila de ancho fijo: los cinco
     miden EXACTAMENTE lo mismo por construcción, no por ojo. La simetría
     deja de ser algo que se cuida y pasa a ser algo que no se puede romper.
   · Íconos LIMPIOS — se fue el círculo de fondo detrás de cada marca. Era
     vidrio dentro de vidrio: la burbuja ya es el continente, el circulito
     sobraba y ensuciaba (museo, no circo).
   · El chip que se desliza PASA POR CREATE. Arrastrar llega a él igual que
     a las otras cuatro.

   ─── POR QUÉ ESTO ES MÁS SIMPLE QUE LO QUE HABÍA ──────────────────────────

   Con anchos distintos había que MEDIR cada botón (useLayoutEffect +
   ResizeObserver + refs) para saber dónde parar el chip, y animar `width`
   además de `transform`. Con anchos iguales el chip es una fracción exacta
   (100/n %) y viaja con un solo translateX por porcentaje — la misma
   mecánica que el teléfono. Se fueron el observer, los refs y la animación
   de ancho. El arreglo visual borró código en vez de agregarlo.

   ─── CREATE SIGUE SIENDO ACCIÓN, NO CUARTO ────────────────────────────────

   El chip DESCANSA sólo sobre salas (índices 0-3). Puede PREVISUALIZAR
   CREATE mientras el puntero está encima, y soltarlo ahí abre CREATE — pero
   después vuelve a la sala donde estás parado, porque nunca "estuviste" en
   CREATE. Es exactamente el contrato de la barra del teléfono.

   (En el teléfono CREATE sigue siendo la pastilla rellena, a propósito: ahí
   es el pulgar el que manda y el destaque ayuda. Esto es sólo escritorio.)

   ─── EL GESTO ─────────────────────────────────────────────────────────────

   Arrastre con Pointer Events: sirve con mouse, trackpad y las Mac con
   pantalla táctil. Despierta a los 6px de viaje real, así que el click
   normal no se toca — un press-release sin viaje ni entra ahí.

   NO se generalizó el hook táctil de GlassNav a punteros. Ese archivo
   documenta que aflojar su forma REGRESIONÓ WebKit de funcionar a muerto,
   verificado y revertido. La barra del teléfono no se toca; esto es código
   aparte que sólo corre en escritorio.
   ========================================================================= */

const BONE = 'var(--cream)'
const DIM = 'var(--cream-low)'

const CHIP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CHIP_MS = 380          // igual que la barra del teléfono, a propósito
const HOUSE_EASE = 'cubic-bezier(.2, .7, .2, 1)'
const SCRUB_MS = 190         // mientras el puntero manda, el chip no se retrasa

const DRAG_THRESHOLD = 6     // px de viaje honesto antes de que sea un arrastre

/* El tamaño intermedio pedido: ni la marca de 34px metida en su caja ni un
   ícono suelto perdido. Una fila de 620px partida en cinco da ~124px por
   ranura, que aloja COMMUNITY (el rótulo más largo) sin apretarlo y deja la
   barra dentro del ancho del encabezado con aire a los lados. */
const ROW_W = 620
const SLOT_H = 40
const ICON = 16

const CREATE_SLOT = { create: true, label: 'Create' }

/* ── el arrastre con puntero ───────────────────────────────────────────────
   press → (6px) → arrastre → preview ranura a ranura → soltar → vas ahí.
   La ranura bajo el puntero se saca por FRACCIÓN de la fila, no midiendo
   cada botón: los cinco miden lo mismo, así que la fracción es exacta (y es
   la misma cuenta que hace el teléfono). */
function usePointerScrub(rowRef, n, { onPreview, onCommit }) {
  const cb = useRef({ onPreview, onCommit })
  cb.current = { onPreview, onCommit }

  useEffect(() => {
    const row = rowRef.current
    if (!row || n <= 0) return undefined

    let down = false, dragging = false, startX = 0, actual = -1, guard = 0
    const GUARD_MS = 400

    const slotAt = (clientX) => {
      const r = row.getBoundingClientRect()
      if (r.width <= 0) return -1
      const i = Math.floor(((clientX - r.left) / r.width) * n)
      return Math.max(0, Math.min(n - 1, i))
    }

    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      down = true; dragging = false; startX = e.clientX; actual = -1
    }
    const onMove = (e) => {
      if (!down) return
      if (!dragging) {
        if (Math.abs(e.clientX - startX) < DRAG_THRESHOLD) return
        dragging = true
        try { row.setPointerCapture(e.pointerId) } catch { /* no capturable */ }
      }
      const i = slotAt(e.clientX)
      if (i !== actual) { actual = i; cb.current.onPreview(i) }
    }
    const onUp = (e) => {
      if (!down) return
      down = false
      try { row.releasePointerCapture(e.pointerId) } catch { /* ya soltado */ }
      if (!dragging) return           // fue un click limpio: no es asunto nuestro
      dragging = false
      const i = slotAt(e.clientX)
      cb.current.onPreview(null)
      if (i < 0) return
      // el click que sigue al soltar re-dispararía esta misma ranura
      guard = performance.now() + GUARD_MS
      cb.current.onCommit(i)
    }
    /* cancelar ABANDONA, nunca confirma un viaje que la persona pudo no
       haber querido — mismo criterio que el teléfono */
    const onCancel = () => { down = false; dragging = false; cb.current.onPreview(null) }
    const clickGuard = (e) => {
      if (performance.now() < guard) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      }
    }

    row.addEventListener('pointerdown', onDown)
    row.addEventListener('pointermove', onMove)
    row.addEventListener('pointerup', onUp)
    row.addEventListener('pointercancel', onCancel)
    row.addEventListener('click', clickGuard, true)
    return () => {
      row.removeEventListener('pointerdown', onDown)
      row.removeEventListener('pointermove', onMove)
      row.removeEventListener('pointerup', onUp)
      row.removeEventListener('pointercancel', onCancel)
      row.removeEventListener('click', clickGuard, true)
    }
  }, [rowRef, n])
}

export default function GlassNavDesktop({ tabs, currentIdx, bellCount, onTab, onCreate }) {
  const rowRef = useRef(null)
  const [scrub, setScrub] = useState(null)
  const [armed, setArmed] = useState(false)
  /* v16 — labels ocultos por default: la palabra sólo existe bajo hover o
     press (scrub). Estado React y no :hover de CSS porque el estado de
     scrub también la enciende, y un inline style le ganaría a la regla. */
  const [hovered, setHovered] = useState(null)

  const slots = [...tabs, CREATE_SLOT]
  const n = slots.length

  /* El chip aparece YA colocado en la primera pintura y sólo después se le
     permite animar. Sin esto, al cargar se ve viajar desde la izquierda hasta
     la sala en la que ya estabas — un movimiento que dice algo falso.

     EL rAF NECESITA RED DE SEGURIDAD, y es un caso de escritorio: rAF no
     corre con la pestaña oculta, y abrir un enlace en pestaña de fondo es
     normalísimo en laptop (en teléfono casi no existe). Esa pestaña se
     quedaba con el indicador muerto. Verificado en vivo: con
     document.hidden=true el rAF nunca disparó. Si la pestaña está VISIBLE el
     rAF gana la carrera y todo es como siempre. */
  useEffect(() => {
    let done = false
    const arm = () => { if (!done) { done = true; setArmed(true) } }
    const raf = requestAnimationFrame(arm)
    const timer = setTimeout(arm, 120)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [])

  usePointerScrub(rowRef, n, {
    onPreview: setScrub,
    onCommit: (i) => {
      const slot = slots[i]
      if (!slot) return
      // pasa por los MISMOS manejadores que el click: destinos y reja de auth
      // idénticos, hayas llegado como hayas llegado
      if (slot.create) onCreate()
      else onTab(slot)
    },
  })

  /* Dónde se para el chip. El puntero manda mientras está abajo — eso es lo
     que convierte el arrastre en un preview y no en un salto consumado.
     currentIdx es -1 en una subpágina: ahí el chip se desvanece en vez de
     mentir sobre en qué cuarto estás. */
  const chipIdx = scrub ?? (currentIdx < 0 ? null : currentIdx)

  return (
    <nav ref={rowRef} style={{
      position: 'relative', display: 'flex', alignItems: 'stretch',
      width: `${ROW_W}px`, height: `${SLOT_H}px`,
    }}>
      {/* EL CHIP QUE VIAJA — mismo vidrio y misma curva que el del teléfono.
          Con ranuras de ancho igual es una fracción exacta y viaja con un
          solo translateX por porcentaje.
          zIndex 0 contra las ranuras en 1 es LOAD-BEARING: un absoluto pinta
          encima de sus hermanos en flujo sin importar el orden del DOM, y sin
          esto el degradado lavaría la marca y el rótulo que va marcando. */}
      <div aria-hidden="true" className="glass-nav-chip glass-nav-chip-pill" style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 0,
        width: `${100 / n}%`, borderRadius: WORD_CHIP_RADIUS, pointerEvents: 'none',
        transform: `translateX(${(chipIdx ?? 0) * 100}%)`,
        opacity: chipIdx === null ? 0 : 1,
        ...CHIP,
        transition: armed
          ? `transform ${scrub !== null ? SCRUB_MS : CHIP_MS}ms ${scrub !== null ? HOUSE_EASE : CHIP_EASE}, opacity ${CHIP_MS}ms ${CHIP_EASE}`
          : 'none',
        willChange: 'transform',
      }} />

      {slots.map((slot, i) => {
        const active = !slot.create && i === currentIdx
        const held = scrub === i
        const lit = active || held
        /* v16: la palabra despierta con el puntero encima o el press; el
           resto del tiempo la píldora es solo-ícono. El max-width anima el
           espacio (el ícono se re-centra suave) y la opacity anima la voz. */
        const wordOn = held || hovered === i
        return (
          /* data-c4-tour: mismo gancho estable que GlassNav — ver la nota
             allí. Las dos barras lo llevan porque el recorrido corre en las
             dos, y una sola de ellas etiquetada sería justo la deriva que
             el par de barras existe para no repetir. */
          <button key={slot.create ? 'create' : slot.to}
            data-c4-tour={slot.create ? 'create' : (slot.label || '').toLowerCase()}
            className="pressable glass-tap" type="button"
            onClick={() => (slot.create ? onCreate() : onTab(slot))}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered(h => (h === i ? null : h))}
            aria-label={slot.create ? 'Create' : slot.label}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: '1 1 0', minWidth: 0,          // los cinco, exactamente iguales
              position: 'relative', zIndex: 1,
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', font: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}>
            {/* LA BURBUJA. Es la ranura entera — no hay circulito adentro:
                el ícono va limpio sobre el vidrio. Un contenedor, no dos. */}
            <span className="glass-chip" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', height: '100%',
              borderRadius: WORD_CHIP_RADIUS,
              fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: lit ? BONE : DIM,
              transition: 'color .25s var(--ease-house)',
              ...WELL,
            }}>
              <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                {slot.create
                  ? <Plus size={ICON} strokeWidth={1.9} />
                  : <Mark type={slot.mark} size={ICON} filled={active} color={lit ? BONE : DIM}
                      style={{ flexShrink: 0, filter: active ? BONE_GLOW : 'none', transition: 'filter .2s' }} />}
                {!slot.create && slot.to === '/messages' && bellCount > 0 && (
                  <span data-testid="bell-badge" className="badge-in" aria-label={`${bellCount} unread signals`}
                    style={{ position: 'absolute', top: '-6px', right: '-7px', minWidth: '13px', height: '13px',
                      borderRadius: '100px', background: BONE, color: 'var(--bg)', fontFamily: 'DM Mono',
                      fontSize: '8px', fontWeight: 700, lineHeight: '13px', textAlign: 'center', padding: '0 3px',
                      letterSpacing: 0, boxShadow: '0 0 0 2px rgba(var(--void-rgb),.65)' }}>
                    {bellCount > 9 ? '9+' : bellCount}
                  </span>
                )}
              </span>
              {/* v16: la palabra, oculta por default — despierta con fade y
                  el ícono se re-centra suave vía max-width animado */}
              <span aria-hidden="true" style={{
                display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap',
                maxWidth: wordOn ? '110px' : '0px',
                opacity: wordOn ? 1 : 0,
                marginLeft: wordOn ? '8px' : '0px',
                transition: 'max-width 320ms var(--ease-house), opacity 240ms var(--ease-house), margin-left 320ms var(--ease-house)',
              }}>
                {slot.label}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
