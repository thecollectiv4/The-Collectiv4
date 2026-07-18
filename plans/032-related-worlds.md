# 032 — A-22 · related worlds

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-22 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — missed-opportunities
- **File**: `src/components/RelatedWorlds.jsx:87`

## Problema

WORLDS IN ORBIT mounts abruptly: the component returns null until its two-step async fetch resolves, then the entire section (header + card rail) pops into the page under the museum in one frame, shifting layout. Every movement above it in the same scroll reveals editorially (ProfileMuseum's `reveal` — opacity+12px rise, 0.7s on EASE_HOUSE_ARR [0.2,0.7,0.2,1], whileInView); the orbit section is the only block in the museum's spine that teleports in.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
if (!related.length) return null
...
<div data-testid="related-worlds" style={{ position: 'relative', zIndex: 3, background: 'transparent', marginTop: '-60px' }}>
```

## Target — el fix del catálogo, valores exactos

Add `className="card-in"` to the section root div at line 87. .card-in (index.css:347) = opacity:0 + fadeUp var(--dur-slow)=500ms var(--ease-house)=cubic-bezier(.2,.7,.2,1) forwards — closest CSS sibling of the museum's 0.7s reveal without importing framer-motion into a second file (framer stays exclusive to ProfileMuseum). The forwards fill is safe: the section contains no position:fixed descendants (plain cards with navigate handlers). Mounts exactly once per profile load, so it never replays. Reduced-motion degrades to fadeIn .3s via index.css:371.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-22).
