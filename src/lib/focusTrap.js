import { useEffect, useRef } from 'react'

/* =========================================================================
   LA TRAMPA DE FOCO — una receta, TRES consumidores: <Onboarding/>,
   <Tutorial/> y <AuthModal/>. Nació en Onboarding.jsx con la advertencia
   escrita de que "si aparece un tercer consumidor, se muda a su propio
   módulo" — AuthModal fue el tercero (v15), así que se mudó, tal cual la
   regla de la casa contra la deriva (ver la cabecera de Chip.jsx: tres
   copias a mano del mismo chip terminaron siendo tres chips distintos).

   Hace tres cosas que un modal debe hacer y que las hojas de esta app hacen
   sólo a medias: mete el foco, lo CICLA (Tab y Shift+Tab no se escapan
   detrás del panel) y lo devuelve al control que abrió. Además bloquea el
   scroll del body mientras está abierta.

   ⚠ EL EFECTO SE MONTA UNA VEZ. onEscape viaja por ref a propósito: un
   callback inline inestable desde Layout volvería a correr este efecto en
   cada render y le robaría el foco a quien está leyendo — exactamente el
   bug que CreateCentral documenta y arregló de la misma forma.
   ========================================================================= */

/* Lo que el navegador considera alcanzable con Tab. `getClientRects()` en vez
   de `offsetParent` porque este último miente con position:fixed. */
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(panelRef, onEscape) {
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape

  useEffect(() => {
    const node = panelRef.current
    if (!node) return undefined
    const returnTo = document.activeElement

    node.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); escapeRef.current?.(); return }
      if (e.key !== 'Tab') return
      const items = Array.from(node.querySelectorAll(FOCUSABLE))
        .filter((el) => el.getClientRects().length > 0)
      if (items.length === 0) { e.preventDefault(); node.focus(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const outside = !node.contains(active)
      if (e.shiftKey && (outside || active === first || active === node)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (outside || active === last)) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      try { returnTo?.focus?.() } catch { /* el que abrió ya no está en el DOM */ }
    }
  }, [panelRef])
}
