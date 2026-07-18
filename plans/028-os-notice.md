# 028 — A-18 · os notice

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-18 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — os
- **File**: `src/pages/OS.jsx:365`

## Problema

The notice line mounts instantly (pushing the whole pane down ~30px) and unmounts instantly when the 5s timeout fires (Events.jsx:357 has the identical pattern with a 6s timeout) — the second reflow is timeout-driven, yanking content up while the member may be reading or aiming a click.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
{notice && <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase', padding: '8px 0 14px' }}>△ {notice}</div>}
```

## Target — el fix del catálogo, valores exactos

Keep the node mounted and drive it with a class instead of conditional render. Wrapper: display:grid; grid-template-rows:0fr; opacity:0; transition: grid-template-rows var(--dur-base) var(--ease-house), opacity var(--dur-fast) var(--ease-house) (250ms/200ms, cubic-bezier(.2,.7,.2,1)); when notice is set: grid-template-rows:1fr; opacity:1. Inner div: min-height:0; overflow:hidden. CSS transition, not keyframes, so a new say() mid-collapse retargets smoothly (interruptible). Reduced-motion: transition opacity 200ms ease only (rows snap). Apply the same recipe to Events.jsx:357.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-18).
