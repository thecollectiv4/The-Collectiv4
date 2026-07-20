import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { glassSurface } from '@/lib/glass'

/* =========================================================================
   GlassSheet (v12) — la superficie donde se abre lo que antes era texto
   muerto: la lista de gente detrás de un conteo, los crafts detrás de un +N.

   UNA sola concha para las dos cosas, porque son el mismo gesto: picas un
   dato y el dato se abre. Si cada una trajera su propia caja, en dos meses
   serían dos cajas distintas.

   · Del borde de abajo en teléfono, centrada en escritorio. Es la gramática
     que ya usa el resto de la app (.sheet-up / .dialog-in en index.css), no
     una nueva.
   · Vidrio de verdad: glassSurface() — la única capa con backdrop-filter de
     todo esto. Adentro NO se anida vidrio (regla de glass.js: un elemento
     con backdrop-filter es él mismo raíz de fondo, y vidrio sobre vidrio
     re-difumina a su padre en vez de la página, que es como se hace ese
     parche gris). Las filas de adentro llevan degradado, nunca un segundo
     blur.
   · zIndex 10020: por encima de la barra (9999), de AuthModal (10000) y de
     la ceremonia del mundo (10010).

   Escape cierra, el fondo cierra, y el foco entra a la hoja para que quien
   navega con teclado no se quede tecleando detrás de un panel abierto.
   ========================================================================= */

const BONE = 'var(--cream)'
const BONE_LOW = 'var(--cream-dim)'
const HAIR_HI = 'rgba(var(--ink-rgb),0.15)'

export default function GlassSheet({ title, kicker, onClose, wide, children, maxWidth = '440px' }) {
  const panelRef = useRef(null)
  const returnTo = useRef(null)

  useEffect(() => {
    returnTo.current = document.activeElement
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', onKey)
    // el foco entra a la hoja; al cerrar vuelve exactamente al control que la
    // abrió, para no dejar al teclado tirado al principio de la página
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      try { returnTo.current?.focus?.() } catch { /* se fue del DOM */ }
    }
  }, [onClose])

  return (
    <div role="presentation" onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10020,
        background: 'rgba(var(--void-rgb),.62)',
        WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center',
        padding: wide ? '24px' : '0',
      }}
      className="overlay-backdrop">
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={wide ? 'dialog-in' : 'sheet-up'}
        style={{
          width: '100%', maxWidth: wide ? maxWidth : undefined,
          maxHeight: wide ? '78vh' : '82vh',
          display: 'flex', flexDirection: 'column',
          borderRadius: wide ? '18px' : '20px 20px 0 0',
          outline: 'none',
          ...glassSurface(),
          // la hoja de teléfono nace del borde: sin sombra abajo ni borde que
          // dibuje una línea contra el canto de la pantalla
          ...(wide ? null : { borderBottom: 'none' }),
        }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: '16px', padding: wide ? '20px 22px 14px' : '18px 20px 12px',
          borderBottom: `1px solid ${HAIR_HI}`, flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            {kicker && (
              <div style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase', marginBottom: '6px' }}>
                {kicker}
              </div>
            )}
            <h2 style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '26px' : '23px', letterSpacing: '.03em', lineHeight: 1, margin: 0, color: BONE }}>
              {title}
            </h2>
          </div>
          <button className="pressable" onClick={onClose} aria-label="Close"
            style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(var(--ink-rgb),.06)', border: `1px solid ${HAIR_HI}`, color: BONE,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div className="no-scrollbar" style={{
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: wide ? '10px 12px 18px' : '8px 10px calc(18px + env(safe-area-inset-bottom, 0px))',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}
