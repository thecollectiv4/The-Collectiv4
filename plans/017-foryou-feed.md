# 017 — A-07 · foryou feed

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-07 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — community
- **File**: `src/components/ForYou.jsx:161`

## Problema

When fetchForYou resolves, the three static skeleton frames (line 136-139, heights 176/108/176px) are replaced by the full masonry in a single frame — the entire feed teleports in with no bridge, while the sibling Everyone grid on the same page gets a composed first landing (card-in, plan 009).

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div data-testid="foryou-feed" style={wide
  ? { columnCount: veryWide ? 3 : 2, columnGap: '16px', marginTop: '14px' }
  : { display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
```

## Target — el fix del catálogo, valores exactos

Near-imperceptible tier only: ONE fade on the feed container, not per card. Add a class (e.g. .feed-in { animation: fadeIn var(--dur-fast) var(--ease-house); }) reusing @keyframes fadeIn (index.css:84) — opacity 0→1, 200ms, cubic-bezier(.2,.7,.2,1). Opacity only: NO translate, NO per-card stagger — the CSS-columns DOM order ≠ visual order, so any index-based delay would scatter across columns, and the per-card cascade stays exclusive to Community's Everyone grid (plan 009, settled). Reduced-motion: mirror .refilter-in (index.css:372) — .feed-in { animation: none; }.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-07).
