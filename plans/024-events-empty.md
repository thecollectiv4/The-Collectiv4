# 024 — A-14 · events empty

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-14 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — events
- **File**: `src/pages/Events.jsx:200`

## Problema

When loading flips false with no upcoming rooms, the 'NO ROOMS OPEN TONIGHT' composition and the last-room card render with zero entrance — while the populated branch of the exact same ternary cascades in via .card-in (lines 166, 187, settled plan 009). The spinner→empty-state swap is the only path on this page with no bridge.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
{!featured && upcoming.length === 0 && (
  <div style={{ marginTop: '22px', display: wide ? 'grid' : 'flex', ...(wide ? { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '22px', alignItems: 'start' } : { flexDirection: 'column', gap: '14px' }) }}>
```

## Target — el fix del catálogo, valores exactos

Extend the page's already-settled cascade grammar to this branch: wrap the statement block (line 202) with className={entered ? undefined : 'card-in'} + style animationDelay:'0ms', and the last-room wrapper (line 220) with animationDelay:'100ms'. .card-in (index.css:347) = fadeUp var(--dur-slow)=500ms var(--ease-house)=cubic-bezier(.2,.7,.2,1), opacity 0→1 + translateY(16px)→0, forwards. Reduced-motion already downgrades .card-in to fadeIn .3s ease (index.css:371). Implementer note: gate on `entered` directly, NOT `entered.current` — `entered` is a useState boolean and the existing `.current` reads at lines 166/187 are always undefined (benign today because fadeUp runs forwards once with stable keys, but wrong to copy).

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-14).
