# 037 — A-27 · network verify

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-27 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — missed-opportunities
- **File**: `src/components/os/Network.jsx:119`

## Problema

Granting verified in the OS Network desk flips the row's border (HAIR → rgba(199,201,209,.28)) and background (CARD → rgba(199,201,209,.05)) with no transition — the founder's grant lands as a hard restyle. The standalone twin of this exact row already does it right: NetworkAdmin.jsx:156 carries `transition: 'background .2s, border-color .2s'` on the identical flip. The OS copy dropped the transition, so the same act feels different in the two rooms.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 13px', borderRadius: '13px', border: `1px solid ${u.verified ? 'rgba(199,201,209,.28)' : HAIR}`, background: u.verified ? 'rgba(199,201,209,.05)' : CARD }}>
```

## Target — el fix del catálogo, valores exactos

Add `transition: 'background .2s ease, border-color .2s ease'` to the row div style at line 119, matching NetworkAdmin.jsx:156 verbatim. Rows are keyed by u.id and survive the post-write re-read (non-optimistic refresh replaces array contents but React reconciles by key), so the flip animates in place. Color/background only — reduced-motion exempt by nature (no movement).

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-27).
