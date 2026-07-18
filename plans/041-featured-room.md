# 041 — A-31 · featured room

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-31 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — events
- **File**: `src/pages/Events.jsx:275`

## Problema

The FeaturedRoom spread — the largest clickable surface on the page — has no hover response at all, while its sibling RoomCards (line 353, className="disc-card pressable") lift, brighten, and breathe on hover. Its banner even carries className="disc-banner" (line 279), so the discBreathe keyframe is attached but permanently paused: only a .disc-card ancestor resumes it (index.css:327), and none exists here.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div className="pressable" onClick={onEnter} role="button" tabIndex={0} aria-label={`Enter ${e.title}`}
```

## Target — el fix del catálogo, valores exactos

Tens/day tier → near-imperceptible only: give the spread the quiet half of the RoomCard grammar (border brighten + banner breathe) and deliberately NOT the translateY(-5px) lift — a 230-340px spread lifting reads louder than this tier allows. New scoped class in index.css: `.feat-room { transition: border-color var(--dur-slow) ease; }` and `@media (hover: hover) and (pointer: fine) { .feat-room:hover { border-color: rgba(242,238,230,.34); } .feat-room:hover .disc-banner img, .feat-room:hover .disc-banner svg { animation-play-state: running; } }`. The breathe already exists attached-and-paused (index.css:326, discBreathe 6s ease-in-out, scale 1→1.045). Reduced-motion: add .feat-room to the index.css:365-368 block (transition:none; banner animation:none). Zero new keyframes; keeps .pressable for the press.

## Aplicado en esta pasada

Cambio aplicado fielmente al Target. Reusa el vocabulario de movimiento ya
existente (curva de la casa `cubic-bezier(.2,.7,.2,1)`; keyframes/clases ya en
`src/index.css`). Sin springs, sin bounce, sin confetti. Clases nuevas — sólo
las que el catálogo pide y que no existían — viven en el bloque ADITIVAS de
`src/index.css` con su regla de `prefers-reduced-motion`.

## Boundaries

- Sólo propiedades de movimiento / clases; sin rediseño, sin tocar datos.
- No toca `api/`, ni el camino del comprador, ni `main`.
- Reduced-motion cubierto (fade o none) para todo lo que mueve.

## Verificación

- **Mecánica**: `npm run build` verde tras el cambio; gate esbuild por archivo verde.
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-31).
