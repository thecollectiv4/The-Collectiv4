import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import Mark from './Mark'
import { CHIP, BUBBLE, WELL, BONE_GLOW, MARK_CHIP_RADIUS, WORD_CHIP_RADIUS } from '@/lib/glass'

/* =========================================================================
   GlassNavDesktop (v12) — la barra de arriba, hermana de GlassNav.

   Antes esto vivía suelto dentro de Layout.jsx y por eso derivó: el mismo
   CREATE era una pastilla de vidrio encendida, y las cuatro salas eran
   cajitas de 12px de radio. Mismo material, distinta forma — y la forma es
   la mitad del mensaje.

   ─── LA GRAMÁTICA, UNA SOLA PARA LAS DOS BARRAS ───────────────────────

   · Cada MARCA viaja dentro de un CÍRCULO de vidrio en reposo (WELL).
     Círculo, no rectángulo redondeado: 12px de radio sobre una caja de
     34px ES un rectángulo, y ninguna cantidad de brillo lo salva.
   · La sala donde ESTÁS PARADO la marca UN chip de vidrio que se DESLIZA
     (CHIP), no un cambio de estado en el botón. Un solo indicador que
     viaja — no cuatro que prenden y apagan.
   · CREATE es la única pastilla RELLENA (BUBBLE). Es lo único que se HACE
     aquí; las otras cuatro son cuartos por los que se pasa. Mismo material,
     misma familia de forma, distinto trabajo: eso es jerarquía, no deriva.

   ─── EL GESTO EN ESCRITORIO (Parte 4) ─────────────────────────────────

   En el teléfono se puede mantener apretado y barrer. Aquí el equivalente
   honesto es arrastrar con el puntero — y funciona con mouse, con trackpad
   y con las Mac que sí tienen pantalla táctil, porque va sobre Pointer
   Events y no sobre Touch Events.

   El click normal NO se toca: el arrastre sólo despierta después de 6px de
   viaje real. Un press-release sin viaje jamás entra aquí y lo atiende el
   onClick de siempre. Así el gesto se agrega sin quitarle nada al click, que
   es la única forma de que no estorbe.

   NO se generalizó el hook táctil de GlassNav a punteros. Ese archivo
   documenta que "aflojar" su forma REGRESIONÓ WebKit de funcionar a muerto,
   verificado y revertido. La barra que ya sirve en el teléfono se queda
   exactamente como está; ésta es código aparte que sólo corre en escritorio.
   ========================================================================= */

const BONE = '#F2EEE6'
const DIM = '#83838F'

const CHIP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CHIP_MS = 380          // igual que la barra del teléfono, a propósito
const HOUSE_EASE = 'cubic-bezier(.2, .7, .2, 1)'
const SCRUB_MS = 190         // mientras el dedo/puntero manda, el chip no se retrasa

const DRAG_THRESHOLD = 6     // px de viaje honesto antes de que sea un arrastre

/* ── el arrastre con puntero ───────────────────────────────────────────────
   press → (6px) → arrastre → preview slot a slot → soltar → vas ahí.
   Devuelve el índice bajo el puntero mientras dura, o null. */
function usePointerScrub(rowRef, itemRefs, { onPreview, onCommit }) {
  const cb = useRef({ onPreview, onCommit })
  cb.current = { onPreview, onCommit }

  useEffect(() => {
    const row = rowRef.current
    if (!row) return undefined

    let down = false, dragging = false, startX = 0, actual = -1, guard = 0
    const GUARD_MS = 400

    /* Qué slot está bajo el puntero — medido en vivo contra las cajas
       reales, porque acá los botones NO son de ancho igual (Community es
       más largo que Event) y un cálculo por fracción mentiría. */
    const slotAt = (clientX) => {
      const boxes = itemRefs.current
      if (!boxes?.length) return -1
      for (let i = 0; i < boxes.length; i++) {
        const el = boxes[i]
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (clientX >= r.left && clientX <= r.right) return i
      }
      // fuera de los extremos: se pega al más cercano, para que arrastrar
      // pasado el borde no suelte el preview a media maniobra
      const first = boxes[0]?.getBoundingClientRect()
      const last = boxes[boxes.length - 1]?.getBoundingClientRect()
      if (first && clientX < first.left) return 0
      if (last && clientX > last.right) return boxes.length - 1
      return -1
    }

    const onDown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      down = true; dragging = false; startX = e.clientX; actual = -1
    }
    const onMove = (e) => {
      if (!down) return
      if (!dragging) {
        if (Math.abs(e.clientX - startX) < DRAG_THRESHOLD) return
        dragging = true
        // desde aquí el puntero es nuestro aunque salga de la barra
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
      // el click que sigue al soltar re-dispararía este mismo slot
      guard = performance.now() + GUARD_MS
      cb.current.onCommit(i)
    }
    const onCancel = () => {
      // como en el teléfono: cancelar ABANDONA, nunca confirma un viaje
      // que la persona pudo no haber querido
      down = false; dragging = false; cb.current.onPreview(null)
    }
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
  }, [rowRef, itemRefs])
}

export default function GlassNavDesktop({ tabs, currentIdx, bellCount, onTab, onCreate }) {
  const rowRef = useRef(null)
  const itemRefs = useRef([])
  const [scrub, setScrub] = useState(null)
  const [armed, setArmed] = useState(false)

  /* El chip aparece YA colocado en la primera pintura y sólo después se le
     permite animar. Sin esto, al cargar la página se ve viajar desde la
     izquierda hasta la sala en la que ya estabas — un movimiento que dice
     algo falso ("acabas de llegar aquí").

     EL rAF NECESITA RED DE SEGURIDAD, y es un caso de escritorio, no del
     teléfono: `requestAnimationFrame` NO corre mientras la pestaña está
     oculta. Abrir un enlace en pestaña de fondo es de lo más normal en una
     laptop (en un teléfono prácticamente no existe), y esa pestaña se quedaba
     con `armed=false` — o sea con el indicador muerto, saltando de sala en
     sala sin animar, justo el defecto que este componente viene a arreglar.
     Verificado en vivo: con document.hidden=true el rAF nunca disparó.

     El timeout no rompe la garantía original. Si la pestaña está VISIBLE, el
     rAF gana la carrera y arma después de la primera pintura, como siempre.
     Si está OCULTA no hubo pintura, así que no hay nada que pudiera animarse
     mal: cuando por fin se muestre, el chip ya está en su sitio y una
     transición sin cambio de valor no anima nada. */
  useEffect(() => {
    let done = false
    const arm = () => { if (!done) { done = true; setArmed(true) } }
    const raf = requestAnimationFrame(arm)
    const timer = setTimeout(arm, 120)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [])

  usePointerScrub(rowRef, itemRefs, {
    onPreview: setScrub,
    onCommit: (i) => { const t = tabs[i]; if (t) onTab(t) },
  })

  /* Dónde se para el chip. El puntero manda mientras está abajo — eso es lo
     que convierte el arrastre en un preview y no en un salto consumado. */
  const chipIdx = scrub ?? (currentIdx < 0 ? null : currentIdx)

  /* La geometría del chip se MIDE, no se calcula por fracción: los rótulos
     tienen anchos distintos y un translateX por porcentaje quedaría corrido.
     useLayoutEffect y no useEffect — medir después de pintar deja un cuadro
     con el chip en la posición vieja, que es justo el brinco que se quiere
     matar. */
  const [box, setBox] = useState(null)
  useLayoutEffect(() => {
    if (chipIdx == null) { setBox(null); return undefined }
    const measure = () => {
      const el = itemRefs.current[chipIdx]
      const row = rowRef.current
      if (!el || !row) return
      const r = el.getBoundingClientRect()
      const rr = row.getBoundingClientRect()
      setBox({ x: r.left - rr.left, w: r.width })
    }
    measure()
    // los rótulos son texto web: el ancho cambia cuando la fuente aterriza,
    // y con ella la posición correcta del chip
    const ro = new ResizeObserver(measure)
    if (rowRef.current) ro.observe(rowRef.current)
    itemRefs.current.forEach((el) => el && ro.observe(el))
    return () => ro.disconnect()
  }, [chipIdx, tabs.length])

  return (
    <nav ref={rowRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '2px' }}>
      {/* EL CHIP QUE VIAJA — el mismo vidrio y la misma curva que el de la
          barra del teléfono. Antes en escritorio no había ninguno: cada botón
          prendía y apagaba su propio fondo, que es exactamente el "cambio
          brusco" que se pidió matar. Ahora hay UN indicador y se desliza.
          zIndex 0 contra los botones en 1: un absoluto pinta encima de sus
          hermanos en flujo sin importar el orden del DOM, y sin esto el
          degradado lavaría la marca y el rótulo que va marcando. */}
      <div aria-hidden="true" className="glass-nav-chip" style={{
        position: 'absolute', top: '2px', bottom: '2px', left: 0, zIndex: 0,
        borderRadius: WORD_CHIP_RADIUS, pointerEvents: 'none',
        transform: `translateX(${box?.x ?? 0}px)`,
        width: `${box?.w ?? 0}px`,
        opacity: box ? 1 : 0,
        ...CHIP,
        transition: armed
          ? `transform ${scrub !== null ? SCRUB_MS : CHIP_MS}ms ${scrub !== null ? HOUSE_EASE : CHIP_EASE},
             width ${scrub !== null ? SCRUB_MS : CHIP_MS}ms ${scrub !== null ? HOUSE_EASE : CHIP_EASE},
             opacity ${CHIP_MS}ms ${CHIP_EASE}`
          : 'none',
        willChange: 'transform, width',
      }} />

      {tabs.map((tab, i) => {
        const active = i === currentIdx
        const held = scrub === i
        return (
          <button key={tab.to} ref={(el) => { itemRefs.current[i] = el }}
            className="pressable glass-tap" onClick={() => onTab(tab)}
            aria-current={active ? 'page' : undefined}
            style={{
              position: 'relative', zIndex: 1,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '9px',
              fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase',
              color: (active || held) ? BONE : DIM,
              transition: 'color .25s var(--ease-house)',
              WebkitTapHighlightColor: 'transparent',
            }}>
            {/* la marca de la casa en su círculo de vidrio. Se queda en WELL
                siempre: el que dice dónde estás es el CHIP que viaja, y dos
                indicadores para un solo hecho es ruido, no énfasis. */}
            <span className="glass-chip" style={{
              position: 'relative', display: 'inline-flex', flexShrink: 0,
              alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px',
              borderRadius: MARK_CHIP_RADIUS,
              ...WELL,
            }}>
              <Mark type={tab.mark} size={17} filled={active}
                color={(active || held) ? BONE : DIM}
                style={{ flexShrink: 0, filter: active ? BONE_GLOW : 'none', transition: 'filter .2s' }} />
              {tab.to === '/messages' && bellCount > 0 && (
                <span data-testid="bell-badge" className="badge-in" aria-label={`${bellCount} unread signals`}
                  style={{ position: 'absolute', top: '-4px', right: '-5px', minWidth: '13px', height: '13px',
                    borderRadius: '100px', background: BONE, color: '#0A0A0D', fontFamily: 'DM Mono',
                    fontSize: '8px', fontWeight: 700, lineHeight: '13px', textAlign: 'center', padding: '0 3px', letterSpacing: 0,
                    boxShadow: '0 0 0 2px rgba(12,12,17,.65)' }}>
                  {bellCount > 9 ? '9+' : bellCount}
                </span>
              )}
            </span>
            {tab.label}
          </button>
        )
      })}

      {/* CREATE — la única pastilla rellena, una puerta clara (Ley 13). El
          hover ya no se pinta a mano con onMouseOver: .glass-tap/.glass-chip
          lo llevan en CSS, igual que todo lo demás que se pica. */}
      <button className="pressable glass-tap" onClick={onCreate} aria-label="Create"
        style={{ marginLeft: '12px', position: 'relative', zIndex: 1, background: 'transparent',
          border: 'none', padding: 0, cursor: 'pointer', color: BONE,
          fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '.18em', textTransform: 'uppercase',
          WebkitTapHighlightColor: 'transparent' }}>
        <span className="glass-chip" style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          borderRadius: WORD_CHIP_RADIUS, padding: '8px 17px',
          ...BUBBLE,
        }}>
          <Plus size={13} strokeWidth={2} /> Create
        </span>
      </button>
    </nav>
  )
}
