import { useState } from 'react'
import { BONE, BONE_MID, BONE_LOW, HAIR_HI, FONT_SANS, EASE_HOUSE, EASE_EXIT } from '@/lib/cosmos'
import { glassControl } from '@/lib/glass'

/* =========================================================================
   EL CAMPO DE LA ENTRADA — un solo cascarón para /auth Y AuthModal.

   Nació en Auth.jsx (v14) como "ONE field shell for the whole screen"; en
   v15 el modal alcanzó paridad con la página y la única forma de que dos
   superficies de entrada no deriven en dos rectángulos distintos es que
   compartan el componente, no la receta. Mismo criterio que la trampa de
   foco (src/lib/focusTrap.js) y que Chip.jsx.

   El icon gutter, el despertar de foco y el slot derecho (el ojo de la
   contraseña) viven aquí, para que ocho inputs en dos superficies no puedan
   volverse ocho rectángulos ligeramente distintos.
   ========================================================================= */

/* `.pressable` es la respuesta táctil de la casa, pero una `transition`
   inline le gana a cualquier regla de clase — así que todo botón que traiga
   su propio fade de color u opacidad tiene que cargar él mismo la pata del
   transform. Se APPENDEA, nunca se reemplaza. (Historia completa en la
   versión original de esta nota, Auth.jsx v14: la asimetría deliberada de
   la clase —160ms de entrada, 80ms de salida— no sobrevive una declaración
   inline, así que 80ms con easing es lo honesto disponible. Con movimiento
   reducido index.css quita el transform del :active y no queda nada que
   animar.) */
export const PRESS = `transform 80ms ${EASE_EXIT}`

/* v16 — la pata de transform del RESORTE, para botones que (como PRESS)
   cargan su propia `transition` inline y por eso no pueden heredar la de
   `.press-spring`. Se APPENDEA junto a la clase: la clase pone el scale del
   :active, esta cadena pone la curva con rebote en la suelta. Sólo para
   elementos SIN backdrop-filter (la regla de .disc-card sigue viva). */
export const PRESS_SPRING = 'transform var(--dur-spring) var(--ease-spring)'

/* MODULE SCOPE A PROPÓSITO. Declarado dentro del componente que lo usa
   sería un tipo NUEVO en cada render: React desmontaría y remontaría el
   input en cada tecla y el foco moriría al primer carácter. */
export function Field({ icon: Icon, label, right = null, wrapStyle, ...input }) {
  const [focused, setFocused] = useState(false)
  /* El único momento de luz en un campo: despierta cuando estás en él. Esto
     ES el indicador de foco — el input pone outline:none, así que si algún
     día borras este cambio de borde, pon un anillo real antes. */
  const border = focused ? 'rgba(var(--ink-rgb),.42)' : 'rgba(var(--ink-rgb),.20)'
  /* v16 — el campo es una CÁPSULA de vidrio (glassControl: los campos de
     /auth flotan directo sobre el cielo, sin cardGlass arriba — la regla de
     no-anidar se respeta). El borde sigue siendo el indicador de foco: la
     receta pone .20 en reposo y el foco lo sube a .42, igual que siempre. */
  return (
    <div style={{
      ...glassControl(),
      display: 'flex', alignItems: 'center', gap: '11px',
      border: `1px solid ${border}`, borderRadius: '100px', padding: '0 17px',
      transition: `border-color .35s ${EASE_HOUSE}, background .35s ${EASE_HOUSE}`,
      ...wrapStyle,
    }}>
      {Icon && (
        <Icon size={14} strokeWidth={1.6} aria-hidden="true" style={{
          color: focused ? BONE_MID : BONE_LOW, flexShrink: 0,
          transition: `color .35s ${EASE_HOUSE}`,
        }} />
      )}
      <input
        aria-label={label}
        {...input}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
          // 16px no es una decisión de gusto: por debajo, iOS Safari hace zoom
          // al enfocar y toda la composición salta. Misma regla que la puerta.
          fontFamily: FONT_SANS, fontSize: '16px', color: BONE, caretColor: BONE,
          padding: '15px 0', letterSpacing: '.01em',
        }}
      />
      {right}
    </div>
  )
}
