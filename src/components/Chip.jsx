/* =========================================================================
   LOS DOS CHIPS DE ESTADO — +N y FOLLOWING (v12.4).

   Diego reportó que el "+11" junto al rol y el "FOLLOWING" junto a la gente
   que sigue se veían sucios y desalineados. Auditado: NO era un chip mal
   hecho, eran TRES chips a mano en tres archivos, cada uno con sus propios
   números — padding 2px 8px vs 1px 6px, fontSize 8 vs 7.5 vs 8.5, y un
   letterSpacing de .14em que le comía el aire al "+". Tres copias divergen
   siempre; el arreglo no es afinar las tres, es que haya UNA.

   MoreChip · el "+N". Un contador que ADEMÁS es una puerta (abre la lista
   completa). Por eso es un botón de verdad y no un adorno: la app te dice que
   hay más y te deja verlo (Ley 9).

   StateChip · un estado que NO se pica — FOLLOWING es información, no acción
   (la acción es el botón FOLLOW de abajo). Por eso es un <span>, con su
   marca opcional a la izquierda.

   Los dos comparten la misma cápsula: mono, tracking medido para que quepa
   sin cortarse, borde hairline, radio de pastilla. Marca Cosmos, un solo
   sitio donde cambiarla.
   ========================================================================= */
import { SILVER, BONE_MID, FONT_MONO } from '@/lib/cosmos'

const CAP = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0,
  fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.1em',
  lineHeight: 1, whiteSpace: 'nowrap',
  borderRadius: '100px', padding: '4px 8px',
  // ligado al canal de tinta: se invierte solo entre día y noche
  border: '1px solid rgba(var(--ink-rgb),.16)',
  background: 'rgba(var(--ink-rgb),.05)',
}

/* +N — contador-puerta. `+` y número pegados (sin tracking entre ellos) para
   que "+11" lea como una unidad y no como "+ 11" con un hueco raro. */
export function MoreChip({ n, onClick, label, style }) {
  if (!n || n < 1) return null
  return (
    <button type="button" onClick={onClick} className="pressable"
      aria-label={label || `See ${n} more`}
      style={{ ...CAP, cursor: 'pointer', color: BONE_MID, letterSpacing: '.02em', ...style }}>
      +{n}
    </button>
  )
}

/* Estado — no interactivo. `mark` opcional (un ícono de lucide, ya
   dimensionado por quien lo pasa).

   v16 · `onPhoto`: la pill que vive SOBRE la foto (Community y For You la
   anclan arriba a la derecha de la cápsula) necesita respaldo propio — la
   cápsula base a tinta .05 desaparece contra una portada. El respaldo es
   velo de VACÍO (se invierte solo por canal: noche = oscurece, día =
   aclara) + borde más presente + texto al frente. Diego reportó la pill
   ilegible y mal posicionada en ambos modos; esto es la mitad del
   contraste, la posición la ponen las cápsulas. */
export function StateChip({ label, mark, tone = SILVER, title, style, onPhoto = false }) {
  return (
    <span title={title} style={{
      ...CAP,
      ...(onPhoto
        ? { background: 'rgba(var(--void-rgb),.55)', border: '1px solid rgba(var(--ink-rgb),.30)', color: 'var(--cream)' }
        : { color: tone }),
      textTransform: 'uppercase', ...style }}>
      {mark}
      {label}
    </span>
  )
}
