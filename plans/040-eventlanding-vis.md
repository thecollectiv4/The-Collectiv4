# 040 — A-30 · eventlanding vis

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-30 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — events
- **File**: `src/pages/EventLanding.jsx:489`

## Problema

The 'Who sees you're going' visibility pills flip border, background, color, and the visBusy 0.6 opacity instantly — no transition property at all. Every neighboring control in the column (tier rows line 521, chat button line 349, consent box line 504) transitions its border/background at .2s; the selection moving between these three pills teleports.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
style={{flex:1,borderRadius:'100px',padding:'8px 8px',cursor:visBusy?'default':'pointer',opacity:visBusy?0.6:1,border:`1px solid ${on?'rgba(199,201,209,.5)':'rgba(242,238,230,.14)'}`,background:on?'rgba(199,201,209,.1)':'transparent',color:on?'var(--cream)':'var(--cream-low)',fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'.06em',textTransform:'uppercase'}}>
```

## Target — el fix del catálogo, valores exactos

Add to the pill's inline style: transition:'border-color var(--dur-fast) var(--ease-house), background var(--dur-fast) var(--ease-house), color var(--dur-fast) var(--ease-house), opacity var(--dur-fast) var(--ease-house)' — 200ms cubic-bezier(.2,.7,.2,1). Color/opacity only, no transform, so no reduced-motion handling or hover gating required. Covers both the selection change and the visBusy opacity dip in one line.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-30).
