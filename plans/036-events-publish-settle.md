# 036 — A-26 · events publish settle

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-26 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — missed-opportunities
- **File**: `src/components/os/Events.jsx:379`

## Problema

Publishing an event — the frequency map's rare/high-emotion 'Done' moment, gated by a window.confirm warning 'It goes live on the public landing' (line 180) — answers only with a mono notice string and an instant StatusChip swap DRAFT→LIVE (line 383). The row that just went live gets zero physical acknowledgment, while the Board gives every moved card an .os-settle ('a moved/created card SETTLES — feedback, not an entrance', index.css:250-254).

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div key={e.id} style={{ padding: '14px 2px', borderBottom: i === mineRows.length - 1 ? 'none' : `1px solid ${HAIR}` }}>
```

## Target — el fix del catálogo, valores exactos

Track the last status-changed row: add `const [settledId, setSettledId] = useState(null)` and in quickStatus after the successful RPC (after line 186's say()) call `setSettledId(e.id)`. On the row div (line 379) add `className={settledId === e.id ? 'os-settle' : undefined}` — osSettle (index.css:253): scale .98 → 1 with a border flash, var(--dur-fast)=200ms on var(--ease-house)=cubic-bezier(.2,.7,.2,1). Clear settledId when opening the editor or switching view so it can replay on the next publish. Reduced-motion already silenced (index.css:355). No confetti, no bounce — the house's own settle.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-26).
