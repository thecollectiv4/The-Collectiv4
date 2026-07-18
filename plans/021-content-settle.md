# 021 — A-11 · content settle

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-11 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — os
- **File**: `src/components/os/ContentEngine.jsx:26`

## Problema

A content card created from the editor (or from the Brain's 'Save to Engine') mounts with no acknowledgment when entrance is false, while the identical gesture on the Board settles (Board.jsx:212 uses `entrance ? 'os-reveal-fast' : 'os-settle'` — the documented house pattern: "a moved/created card SETTLES — feedback, not an entrance").

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div key={c.id} className={`os-card${entrance ? ' os-reveal' : ''}`} tabIndex={0} style={{ border: `1px solid ${HAIR}`, background: PANEL, borderRadius: '12px', padding: '13px 14px', animationDelay: entrance ? `${i * 45}ms` : undefined, minWidth: 0 }}>
```

## Target — el fix del catálogo, valores exactos

Mirror Board.jsx:212's ternary exactly: className={`os-card ${entrance ? 'os-reveal' : 'os-settle'}`}. Existing class: .os-settle = osSettle keyframe scale(.98)→scale(1) + border-color pulse from rgba(242,238,230,.28), var(--dur-fast) 200ms, var(--ease-house) cubic-bezier(.2,.7,.2,1), no delay, no rise. Zero new CSS; reduced-motion already covered (`.os-settle { animation:none }`); on tab re-entry all cards settle — the same accepted behavior Board already ships.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-11).
