# 039 — A-29 · community toggle

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-29 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — missed-opportunities
- **File**: `src/pages/Community.jsx:226`

## Problema

The FOR YOU ↔ EVERYONE toggle (lines 221-231) swaps the entire page body below the tab row with a hard cut — the only unanimated content swap left on a surface that already crossfades its refilters (.refilter-in with firstKey guard at line 289) and cascades its first load (.card-in at line 295). Tab-to-tab panes elsewhere in the app (OS.jsx:360-366) always arrive connected, never a dry cut.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
onClick={() => { if (key === 'foryou' && !authLoading && !user) { setShowAuth(true); return } setView(key) }}
```

## Target — el fix del catálogo, valores exactos

Wrap the view body (the conditional starting at `view === 'foryou' ?`, rendered below line 237) in `<div key={view} className={view !== firstView.current ? 'refilter-in' : undefined}>` with `const firstView = useRef(view)` — the identical guard-and-key pattern the same file already uses for filterKey at line 289. 200ms var(--ease-house) blur-masked crossfade on toggle, nothing on landing, reduced-motion already handled (index.css:372).

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-29).
