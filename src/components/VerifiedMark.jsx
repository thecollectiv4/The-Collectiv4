/* =========================================================================
   VerifiedMark — EL SELLO DE ÓRBITA C4.

   ─── por qué murió la palomita azul ──────────────────────────────────────

   Era el check de Instagram: el mismo azul #1D9BF0, la misma silueta
   festoneada, el mismo tick knocked-out. Funcionaba — y ése era el problema.
   Leía como cromo prestado. Un perfil de C4 con la insignia de otra
   plataforma encima dice, sin querer, "esto es un clon".

   ⚠ DECISIÓN DE FUNDADOR, NO DE ESTILO: el azul lo eligió DIEGO a propósito,
   y este mismo archivo lo documentaba como "la única ruptura sancionada del
   monocromo Cosmos". Pato lo revierte aquí. Son dos fundadores iguales:
   NO MERGEAR sin el visto bueno de Diego.

   ─── qué es ahora ────────────────────────────────────────────────────────

   Una CHISPA DE CUATRO PUNTAS dentro de una ÓRBITA, con un satélite que le
   da la vuelta despacio.

   · las cuatro puntas SON el 4 — el símbolo de la casa, el que significa
     intención ("¿para qué lo hacemos? para la gente"). No es una estrella
     decorativa: es la marca de la casa a escala de insignia.
   · la órbita es la pertenencia. El badge no dice "esta cuenta es real"
     (eso lo dice cualquier plataforma); dice ESTÁS EN ÓRBITA DEL COLECTIVO —
     un mundo conectado a los otros mundos. Ésa es la diferencia entre un
     check genérico y una insignia que significa algo AQUÍ.
   · el satélite se mueve porque el vínculo está VIVO. Catorce segundos por
     vuelta: si lo miras fijo lo ves, si no lo miras no te estorba. Es el
     único movimiento continuo de toda la pantalla, y por eso se nota.

   ─── por qué NO trae color ───────────────────────────────────────────────

   La tentación obvia era darle un tono propio para que "resalte". No.
   El nombre ya se lleva el cromo de la pantalla (Ley 8); meter un segundo
   tono aquí serían DOS acentos peleando, que es exactamente el defecto que
   este rediseño vino a matar. La insignia destaca por FORMA y por
   MOVIMIENTO, no por tinta. Hueso y plata sobre void, como todo lo demás.
   La restricción es lo que la hace leer cara.

   Es sólo presentación. Quién está verificado es un hecho del servidor (la
   columna `verified`, protegida por trigger contra auto-otorgarse) — aquí
   no se decide nada.
   ========================================================================= */

const BONE = 'var(--cream)'
const SILVER = 'var(--silver)'

/* La chispa de cuatro puntas. Lados CÓNCAVOS (curvas, no rectas): una
   estrella de cuatro puntas rectas lee como asterisco o como juguete; la
   concavidad es lo que la vuelve joyería.

   OCUPA 7.5→16.5, NO 6→18. La primera versión la dibujé casi tan ancha como
   la órbita: se veía preciosa renderizada a 160px y se DESHACÍA a 19px, que
   es el único tamaño al que esto existe de verdad en el héroe. Chispa y aro
   se tocaban, el hueco desaparecía y todo el conjunto colapsaba a "puntito
   brillante" — se perdía justo la lectura que da el significado, la de estar
   EN ÓRBITA. El aire entre la chispa y el aro no es margen: es el dibujo. */
const SPARK = 'M12 7.5C12.255 10.245 13.755 11.745 16.5 12C13.755 12.255 12.255 13.755 12 16.5C11.745 13.755 10.245 12.255 7.5 12C10.245 11.745 11.745 10.245 12 7.5Z'

const ORBIT_R = 10.4

export default function VerifiedMark({ size = 16, style }) {
  /* Esto se dibuja a 19px (móvil) y 24px (escritorio) — nunca grande. A esa
     escala un trazo de 0.9 sobre un viewBox de 24 aterriza en ~0.7px reales y
     la órbita simplemente no está. El aro engorda y se ilumina en tamaños
     chicos para que exista; en grande se afina, porque ahí sobra resolución.
     Mismo criterio que ya usaba la palomita con su strokeWidth. */
  const small = size <= 30
  const ringW = small ? 1.3 : 0.95
  const ringO = small ? 0.5 : 0.42
  const satR = small ? 1.75 : 1.55

  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      aria-hidden="true" focusable="false"
      style={{
        /* un halo apenas: confirma que la marca emite luz propia sin
           convertirla en un botón de neón.
           v12 — el radio ESCALA con el tamaño. Estaba fijo en 6px, así que
           en un badge de 14px el halo era casi la mitad del glifo y en el
           de 24px del héroe apenas se notaba: el resplandor se leía MÁS
           fuerte en las marcas chicas que en la grande. Al revés de la
           intención. 0.28 × size reproduce los 6px originales a size 21. */
        filter: `drop-shadow(0 0 ${(size * 0.28).toFixed(1)}px rgba(var(--ink-rgb),.34))`,
        display: 'block', flexShrink: 0, overflow: 'visible', ...style,
      }}
    >
      {/* la órbita: hairline, nunca un aro grueso. Es el camino, no el sujeto. */}
      <circle cx="12" cy="12" r={ORBIT_R} fill="none" stroke={SILVER} strokeWidth={ringW} opacity={ringO} />

      {/* el 4 de la casa */}
      <path d={SPARK} fill={BONE} />

      {/* El satélite. `transformBox: view-box` es lo que hace que un
          transform-origin en px signifique coordenadas del viewBox y no de la
          caja del propio elemento — sin eso el punto gira sobre su propio
          centro, o sea NO orbita: vibra en su sitio.
          La animación vive en index.css (.c4-orbit) porque tiene que poder
          apagarse bajo prefers-reduced-motion, y eso no se puede desde un
          estilo inline. */}
      <g className="c4-orbit" style={{ transformOrigin: '12px 12px', transformBox: 'view-box' }}>
        <circle cx="12" cy={12 - ORBIT_R} r={satR} fill={BONE} />
      </g>
    </svg>
  )
}
