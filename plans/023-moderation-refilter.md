# 023 — A-13 · moderation refilter

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-13 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — missed-opportunities
- **File**: `src/components/os/Moderation.jsx:195`

## Problema

Switching a filter chip (Review/Incomplete/Building/Protected/Purged/Demo/All, lines 172-183) hard-swaps the entire account list in one frame — dozens of rows replaced with zero transition. The same act performed on a purge/restore (act() → refresh(), rows leave the active bucket instantly) also cuts. The house already owns the exact tool for this seam: .refilter-in (index.css:348-349, refilterIn 200ms var(--ease-house), opacity .4 + 2px blur mask → clear), used by Community.jsx:289 for its refilter with a first-key guard so the landing paint never animates.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
{/* list — raw evidence, no verdict */}
<div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
  {shown.map(a => {
```

## Target — el fix del catálogo, valores exactos

Mirror Community.jsx:289 exactly: add `const firstFilter = useRef(filter)` near the state (line 48), then change line 195 to `<div key={filter} className={filter !== firstFilter.current ? 'refilter-in' : undefined} style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>`. The key remount triggers the 200ms var(--ease-house) blur-masked crossfade on every filter change; first paint stays still. Reduced-motion already silenced by index.css:372 (`.refilter-in { animation: none; }`). No values invented — token durations/curves only.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-13).
