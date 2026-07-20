/* =========================================================================
   THE GLASS RECIPE — one source for every liquid-glass surface (v11).

   These lived hand-rolled inside GlassNav.jsx while the desktop header wore
   a flat pill, so the two drifted: the same CREATE button was a lit bubble
   on a phone and a dead outline on a laptop. One module now, both callers.

   RULES BAKED IN HERE, learned the hard way on real WebKit:

   · LITERAL VALUES ONLY inside backdrop-filter. WebKit silently drops the
     whole declaration if any part of the chain resolves from a CSS custom
     property (bug 289800) — and DevTools still shows it as applied.
   · COLOUR OPS BEFORE BLUR. saturate/contrast/brightness must act on
     unblurred pixels; putting blur first flattens the chroma it needs.
   · NEVER NEST GLASS. An element with backdrop-filter is itself a backdrop
     root, so glass inside glass re-blurs the parent's output instead of the
     page — a muddy grey patch. Inner panes get GRADIENTS, never a second
     blur. That is what CHIP and BUBBLE below are.
   · THE EDGE CARRIES THE DEPTH, not the blur radius. A lit top facet over a
     dark inner floor is what the eye reads as thickness; past ~28px the blur
     only buys GPU cost (the kernel runs in DEVICE pixels — 28 CSS px is an
     84px kernel on a 3x iPhone).

   ── V12: DOS TEMPERATURAS, UNA RECETA ────────────────────────────────────
   Los colores salieron de aquí y se volvieron tokens (index.css). El archivo
   dejó de ser una paleta y quedó siendo lo que siempre debió ser: la FÓRMULA
   del material. La estructura —especular arriba, piso oscuro abajo, canto
   hairline, dos proyectadas— es idéntica en los dos registros; lo único que
   cambia es de qué lado viene la luz.

   LA REGLA DEL LITERAL SIGUE VIVA Y ES LA MÁS IMPORTANTE DE ESTE ARCHIVO:
   `backdrop-filter` NO puede tocar una custom property (WebKit 289800 tira
   la declaración entera, en silencio, y DevTools miente diciendo que aplicó).
   Por suerte ese filtro no lleva color — es saturate/contrast/brightness/blur
   puro — así que se queda literal y no pierde nada. Todo lo demás (background,
   border, box-shadow) sí admite var() sin drama: son propiedades normales.
   Si alguien alguna vez mete un color en GLASS_FILTER, esto se rompe en
   Safari y sólo en Safari. Que no pase.
   ========================================================================= */

/* The full material — only for surfaces that genuinely have live page behind
   them (the floating bar, chrome over the atmosphere). Both properties must
   be emitted; Safari 17.6 and older only know the prefixed one.
   LITERAL A PROPÓSITO — ver la regla de arriba. Sin color adentro. */
export const GLASS_FILTER = 'saturate(158%) contrast(0.96) brightness(1.05) blur(20px)'

/* EL VIDRIO SOBRE EL VACÍO — por qué el filo hace el trabajo, no el blur.

   Detrás de la barra casi siempre hay void puro (#07080E con tres estrellas).
   Difuminar negro da negro: el backdrop-filter puede estar funcionando
   perfecto y la barra aun así leer como una placa plana. Ésa es la trampa —
   parece que el vidrio "no jala" cuando en realidad no tiene nada que
   muestrear.

   La cura NO es más blur (más radio sobre negro = más negro, más caro) ni un
   borde más grueso (un contorno marcado lee como caja de CSS, no como
   material). La cura es la ESPECULAR: el filo superior iluminado sobre un
   piso interno oscuro. Eso es lo que el ojo lee como espesor, y funciona
   igual sobre una foto que sobre el vacío absoluto, porque la luz la genera
   el propio material en vez de tomarla prestada del fondo.

   Tres cosas se afinaron aquí sin engordar nada:
   · la especular de arriba sube .22 → .30 — el filo lee como filo, no como
     una línea gris
   · el derrame de luz bajo esa especular se alarga (36px → 44px) para que la
     losa tenga cara superior, no sólo canto
   · las dos sombras proyectadas BAJAN (.60→.52, .45→.38): sobre void una
     sombra dura no da profundidad, da suciedad. Profundidad por luz, no por
     oscuridad apilada.
   El borde se queda hairline a propósito (.12 → .14, nada más). */
export const glassSurface = (extra = {}) => ({
  WebkitBackdropFilter: GLASS_FILTER,
  backdropFilter: GLASS_FILTER,
  background: 'linear-gradient(180deg, var(--glass-hi) 0%, var(--glass-lo) 100%)',
  border: '1px solid var(--glass-border)',
  boxShadow: [
    'var(--glass-cast)',
    'inset 0 1.5px 0 var(--glass-edge)',
    'inset 0 -1px 0 var(--glass-floor)',
    'inset 0 30px 44px -30px var(--glass-bloom)',
  ].join(', '),
  ...extra,
})

/* ── CONTROLES SUELTOS (v12.1) ───────────────────────────────────────────
   EL VIDRIO QUE FALTABA, Y DÓNDE FALTABA.

   La app tenía dos clases de vidrio resueltas —la losa (glassSurface) y la
   tarjeta (cardGlass)— y una tercera sin resolver: el CONTROL SUELTO. La
   píldora que flota sola sobre el cielo ("◇ THE HOUSE WORLD", el botón de
   ajustes sobre la portada, los chips de un panel). Ésos llevaban borde y
   un tinte del 6% y NADA detrás: leían como contorno dibujado, no como
   material, porque no difuminaban nada.

   Media docena además se había hecho su propio blur a mano —6px, 8px, 12px,
   16px, cada uno inventado en su archivo— que es exactamente la deriva que
   este módulo existe para matar. Una receta, todos los llamadores.

   ⚠ CUÁNDO **NO** USAR ESTO — LA REGLA DE NO ANIDAR, QUE SIGUE VIVA.
   Sólo para controles que flotan DIRECTAMENTE sobre la página. Un elemento
   con backdrop-filter es él mismo una raíz de backdrop: metido dentro de una
   tarjeta con cardGlass() o dentro de la barra, vuelve a difuminar la salida
   de su padre en vez de la página y da un parche gris lodo. Adentro de otro
   vidrio van CHIP / WELL / BUBBLE, que son gradientes y no vuelven a
   difuminar. Si dudás: ¿hay un cardGlass o un glassSurface arriba? Entonces
   no es esto.

   El blur es 12px, no los 20 de la barra: un control es chico, se dibujan
   muchos por vista, y el kernel corre en píxeles de DISPOSITIVO (12 CSS px
   son 36 en un iPhone 3x). Más radio aquí no se ve y sí se paga. */
export const CONTROL_FILTER = 'saturate(150%) brightness(1.04) blur(12px)'

export const glassControl = (extra = {}) => ({
  WebkitBackdropFilter: CONTROL_FILTER,
  backdropFilter: CONTROL_FILTER,
  background: 'linear-gradient(180deg, rgba(var(--ink-rgb),0.10), rgba(var(--ink-rgb),0.035))',
  border: '1px solid rgba(var(--ink-rgb),0.22)',
  // mismas tres señales de profundidad que WELL, un paso más bajas: filo
  // especular arriba, piso oscuro debajo, sombra proyectada. Quitá una y el
  // volumen se cae por más opacidad que le pongas (ver la nota de WELL).
  boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.30), inset 0 -4px 8px -5px rgba(var(--shadow-rgb),0.42), 0 2px 8px rgba(var(--shadow-rgb),0.24)',
  ...extra,
})

/* CHIP — the pane of brighter glass that marks the active thing. Gradient
   only (see the no-nesting rule). Reads as a lit facet resting ON the slab. */
/* EL ACTIVO SE INVIERTE, Y ESO ES CORRECTO. En el vacío "activo" es MÁS LUZ:
   un panel teñido de hueso sobre la losa oscura. De día no se puede subir
   más allá del blanco, así que activo pasa a ser MÁS TINTA — el mismo .24,
   ahora de vacío sobre el vidrio claro. El canal hace el trabajo solo y la
   jerarquía (activo destaca contra el reposo) se conserva en los dos
   registros sin re-afinar un solo número. La especular se queda blanca en
   ambos: la luz cae de arriba en el vacío y de día igual. */
export const CHIP = {
  background: 'linear-gradient(180deg, rgba(var(--ink-rgb),0.24), rgba(var(--ink-rgb),0.09), rgba(var(--void-rgb),0.12))',
  border: '1px solid rgba(var(--ink-rgb),0.26)',
  boxShadow: 'inset 0 1.5px 1px rgba(255,255,255,0.50), inset 0 -6px 10px -4px rgba(var(--shadow-rgb),0.5), 0 6px 16px rgba(var(--shadow-rgb),0.38)',
}

/* BUBBLE — the CREATE treatment: brighter fill, a thin BONE ring, a specular
   top edge. This is what makes an icon read as a physical control instead of
   a glyph on a flat plane. */
export const BUBBLE = {
  background: 'linear-gradient(180deg, rgba(var(--ink-rgb),0.22), rgba(var(--ink-rgb),0.07))',
  border: '1px solid rgba(var(--ink-rgb),0.58)',
  boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.45), 0 4px 12px rgba(var(--shadow-rgb),0.35)',
}

/* WELL — the resting version of a BUBBLE, not a flat box. The first pass
   made this so faint (0.05 fill, 0.10 border, one weak inset) that it read as
   a drawn rectangle instead of a piece of glass, which is exactly the note
   that came back from the phone.

   The fix is not more opacity — it is keeping all THREE depth cues BUBBLE
   has and only lowering their level: a specular top edge, a dark inner floor
   under it, and a cast shadow beneath. Drop any one of them and the volume
   collapses no matter how bright the fill is.

   v12: the border went 0.24 → 0.34 and the specular 0.30 → 0.38. At 0.24 on
   a 12px-radius box the eye read "outlined rectangle", not "glass" — the note
   that came back from the laptop was that CREATE was a bubble and the four
   nav marks were little boxes. The level still sits clearly under BUBBLE
   (0.58 / 0.45), so active vs resting is never in doubt; it just no longer
   falls off the bottom of the material. */
export const WELL = {
  background: 'linear-gradient(180deg, rgba(var(--ink-rgb),0.16), rgba(var(--ink-rgb),0.045) 55%, rgba(var(--void-rgb),0.10))',
  border: '1px solid rgba(var(--ink-rgb),0.34)',
  boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.38), inset 0 -5px 9px -5px rgba(var(--shadow-rgb),0.50), 0 3px 10px rgba(var(--shadow-rgb),0.32)',
}

/* ── THE SHAPE RULE (v12) ────────────────────────────────────────────────
   Material was never the whole story. WELL and BUBBLE were already the same
   family on both bars, yet the laptop still read four boxes next to one
   pill — because CREATE was 100px-radius and the marks were 12px-radius on
   a 34px square. A 12px radius on a 34px box IS a rounded rectangle; no
   amount of specular rescues it.

   So the chip that carries a MARK is a circle, and the chip that carries a
   WORD is a pill. One fully-rounded family, two widths. This constant exists
   so the two bars can never disagree about it again. */
export const MARK_CHIP_RADIUS = '50%'
export const WORD_CHIP_RADIUS = '100px'

/* Hierarchy, kept on purpose: CREATE is the only FILLED pill (it is the one
   thing you DO here); the four rooms are glass you travel through. Same
   material, same shape family, different job — that is jerarquía, not drift.
   `active` promotes a room to BUBBLE so standing somewhere always reads. */
export const markChip = (active = false) => ({
  borderRadius: MARK_CHIP_RADIUS,
  ...(active ? BUBBLE : WELL),
})

/* The bone glow, one value, so every lit mark in the app agrees.
   De día no es un brillo sino un PESO: la misma α de tinta alrededor de una
   marca ya oscura lee como énfasis, que es exactamente el trabajo que hacía
   el resplandor sobre el vacío. Un halo de hueso sobre papel sería invisible
   — la marca activa se quedaría sin señal, que es el único estado que este
   valor existe para comunicar. */
export const BONE_GLOW = 'drop-shadow(0 0 7px rgba(var(--ink-rgb),.55))'

/* ── CARDS ───────────────────────────────────────────────────────────────
   Cards used to be a flat opaque #0E0E13, which meant any "glass" chip drawn
   on one was glass over a wall — the blur had nothing live to sample. They
   are translucent now, so the app's own atmosphere (the star field, whatever
   scrolls past) genuinely reads through them.

   TWO DELIBERATE LIMITS:

   · The blur is 14px, not the bar's 28. A view shows ONE bar but a DOZEN
     cards, and backdrop-filter re-rasterizes per element per frame — the
     kernel runs in device pixels, so 28px on a 3x phone is an 84px kernel,
     twelve times over, every scroll frame. And the backdrop here is a dark,
     nearly featureless sky: past ~14px the extra radius buys almost no
     visible difference and a lot of GPU. Translucency is what sells this
     effect, not blur radius.
   · The fill still carries real weight (0.72-0.80 alpha). Text legibility on
     a card is not negotiable, and a card you can read the stars through is a
     card you cannot read the name on.

   CARD_TINT is the plain translucent fill for surfaces that should show the
   sky but do not warrant their own compositor layer (nested rows, inner
   panels). Reach for cardGlass only on the outer card. */
export const CARD_TINT = 'var(--card-tint)'

/* LITERAL A PROPÓSITO — misma regla que GLASS_FILTER. Sin color adentro. */
const CARD_FILTER = 'saturate(150%) brightness(1.06) blur(14px)'

/* ── EL CANTO CON VOLUMEN (v12.2) ────────────────────────────────────────
   Diego: "dale dimensión a las cápsulas, que el borde refracte luz como
   cristal con volumen, no que se vean planas".

   La tarjeta ya tenía DOS señales de profundidad (un filo arriba de 1px y un
   piso abajo de 1px) y por eso leía como un rectángulo con borde, no como un
   objeto. Lo que le faltaba no es más opacidad —eso sólo la ensucia— sino
   las dos señales que hacen que un canto de vidrio real se lea:

     · EL DERRAME BAJO EL FILO. En cristal de verdad la luz que entra por el
       canto superior no se corta en el canto: sangra hacia adentro unos
       milímetros y se apaga. Sin ese derrame el filo lee como una LÍNEA
       DIBUJADA encima; con él, lee como luz ENTRANDO por un espesor.
     · LA SOMBRA INTERNA DE ABAJO. El mismo gesto invertido: el cuerpo del
       vidrio proyecta hacia dentro sobre su propia base. Es lo que da el
       "hay material entre las dos caras".

   Es exactamente el razonamiento que WELL ya tenía escrito para los chips
   ("quitá cualquiera de las tres señales y el volumen se cae por más
   opacidad que le pongas") — sólo que la TARJETA nunca lo había recibido.
   Cinco capas en un solo box-shadow: cero nodos nuevos, cero costo de
   layout, y el compositor ya estaba rasterizando esta caja de todos modos. */
export const cardGlass = (extra = {}) => ({
  background: 'linear-gradient(180deg, var(--card-hi) 0%, var(--card-lo) 100%)',
  WebkitBackdropFilter: CARD_FILTER,
  backdropFilter: CARD_FILTER,
  boxShadow: [
    'inset 0 1.5px 0 var(--card-edge)',              // el filo de arriba
    'inset 0 16px 24px -18px var(--card-bloom)',     // su derrame hacia adentro
    'inset 0 -1px 0 var(--glass-floor)',             // el piso
    'inset 0 -14px 20px -16px var(--card-underglow)',// la sombra interna de abajo
    'var(--card-cast)',                              // la proyectada
  ].join(', '),
  ...extra,
})
