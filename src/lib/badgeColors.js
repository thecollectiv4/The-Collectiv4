/* =========================================================================
   LOS COLORES DEL SELLO C4 (v12.2) — decisión de Diego.

   ⚠ ESTO REABRE UN DESACUERDO DE FUNDADORES, Y ESTÁ ESCRITO EN EL PROPIO
   VerifiedMark.jsx. El historial corto:

     · Diego eligió un check AZUL, sancionado como "la única ruptura del
       monocromo Cosmos".
     · Pato lo revirtió al sello de órbita monocromo (commit 4901f91) y dejó
       escrito el argumento: el nombre ya se lleva el cromo de la pantalla
       (Ley 8), un segundo tono serían DOS acentos peleando; la insignia
       destaca por FORMA y MOVIMIENTO, no por tinta.
     · Ese mismo archivo dice, textual: "Son dos fundadores iguales: NO
       MERGEAR sin el visto bueno de Diego."

   Ahora Diego —el fundador cuyo color se revirtió— vuelve a pedir color, y
   elige mejor: un dorado apagado en vez del azul prestado. Es su llamada de
   producto y se implementa. Pero la simetría del archivo obliga a decirlo al
   revés también: ESTO NO SE MERGEA SIN EL VISTO BUENO DE PATO, porque
   deshace un cambio suyo con un argumento escrito detrás.

   ─── POR QUÉ ESTE ORO Y NO UNO INVENTADO ─────────────────────────────────
   rgb(198,170,118) no es un color nuevo: es EXACTAMENTE la nota dorada que
   ya vive en la nebulosa de Atmosphere.jsx, documentada ahí como "la aurora,
   the single warm note" — el único calor que Cosmos admite. Reusarla ata la
   insignia a la paleta en vez de abrirle una excepción. Un oro elegido a
   ojo habría sido una segunda excepción; éste ya estaba aprobado.
   Es apagado a propósito: cerca del gris, apenas inclinado al calor. Un
   amarillo brillante habría leído como advertencia, no como pertenencia.

   ─── CÓMO AGREGAR UNO NUEVO ──────────────────────────────────────────────
   Una entrada más aquí y aparece sola en el selector de /settings. Nada más
   en la app escribe estos valores a mano — ése es el punto del archivo.
   ========================================================================= */

export const BADGE_GOLD_RGB = '198,170,118'   // la aurora de la nebulosa

export const BADGE_COLORS = {
  gold: {
    key: 'gold',
    label: 'Gold',
    spark: `rgb(${BADGE_GOLD_RGB})`,
    ring: `rgb(${BADGE_GOLD_RGB})`,
    glowRgb: BADGE_GOLD_RGB,
  },
  bone: {
    key: 'bone',
    label: 'Original',
    // el monocromo de la casa: sigue el tema, así que de día es tinta
    spark: 'var(--cream)',
    ring: 'var(--silver)',
    glowRgb: 'var(--ink-rgb)',
  },
}

export const BADGE_DEFAULT = 'gold'
export const BADGE_KEY = 'c4:badge-color'

export const badgeColor = (key) => BADGE_COLORS[key] || BADGE_COLORS[BADGE_DEFAULT]

/* LA PERSISTENCIA ES LOCAL Y ESO NO SE DISIMULA.

   No existe `profiles.badge_color` en la base (auditado: ninguna migración
   la crea). Sin esa columna, el color que elijas vive en TU aparato y nadie
   más lo ve — tu sello sigue saliendo dorado para el resto del mundo.

   Se guarda igual, porque una preferencia que no sobrevive al refresh es
   peor que inútil; pero /settings lo dice con todas sus letras en vez de
   dejar creer que cambió para todos. Un ajuste que promete lo que no hace es
   justo lo que esa pantalla existe para no hacer.

   PARA QUE SEA REAL hacen falta dos cosas, y las dos son de servidor:
     1. `alter table profiles add column badge_color text` (default 'gold')
     2. una policy que sólo deje escribirla si la fila tiene verified = true
        — si no, cualquiera se pinta el sello y el sello deja de significar.
   El trigger lock_verified ya protege `verified`; esto necesita su gemelo. */
export function readBadgeColor() {
  try {
    const v = localStorage.getItem(BADGE_KEY)
    return BADGE_COLORS[v] ? v : BADGE_DEFAULT
  } catch { return BADGE_DEFAULT }
}

export function writeBadgeColor(key) {
  if (!BADGE_COLORS[key]) return
  try { localStorage.setItem(BADGE_KEY, key) } catch { /* almacenamiento bloqueado */ }
}
