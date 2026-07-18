# 038 — A-28 · roadmap draw

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-28 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — missed-opportunities
- **File**: `src/components/os/RoadmapStrip.jsx:106`

## Problema

The chapter instrument's elapsed fill — the §E signature 'progress is a hairline filling with bone, never a colored bar' — renders statically while everything around it plays the deck's first-visit cinema (the OS panes os-reveal at 950ms). The one element whose entire meaning is 'time filling in' is the one element that never fills in. A one-time draw from the chapter origin to now is the exact rare-moment delight the register allows.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div style={{ position: 'absolute', top: '4px', left: 0, width: `${nowPct}%`, height: '1px', background: 'rgba(242,238,230,.55)' }} />
```

## Target — el fix del catálogo, valores exactos

Add to index.css near the os- keyframes: `@keyframes osOrbitDraw { from { transform: scaleX(0); } to { transform: scaleX(1); } }` and `.os-orbit-draw { transform-origin: left center; animation: osOrbitDraw var(--dur-cinematic) var(--ease-house); }` — 950ms on cubic-bezier(.2,.7,.2,1), the deck's own cinematic beat; no forwards (natural end state = scaleX(1)). Apply `className="os-orbit-draw"` to the fill div at line 106; keep `width: ${nowPct}%` static so only compositor-cheap transform animates. Add `.os-orbit-draw { animation: none; }` to the reduced-motion block. Plays once per mount, which matches the OS's per-visit remount cadence.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-28).
