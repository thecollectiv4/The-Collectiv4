# 035 — A-25 · brief expand

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-25 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — missed-opportunities
- **File**: `src/components/os/ContentEngine.jsx:79`

## Problema

'view brief' expands a potentially 260px-tall block with a hard cut, shoving the 2-up card grid down in one frame. The house grammar for exactly this inline-expand seam already exists: EventLanding's guest list opens with `animation:'fadeUp .3s ease'` (EventLanding.jsx:454) and the tier list likewise (EventLanding.jsx:500). The brief is the only inline expand in the app with nothing.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
{open && (
  <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, lineHeight: 1.6, marginTop: '8px', paddingLeft: '10px', borderLeft: `1px solid ${HAIR_HI}`, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '260px', overflowY: 'auto' }}>
```

## Target — el fix del catálogo, valores exactos

Add `animation: 'fadeUp 0.3s var(--ease-house)'` to the expanded div's style at line 80 — the existing fadeUp keyframes (index.css:83) at 300ms on cubic-bezier(.2,.7,.2,1); no forwards fill needed (natural end = visible). This animates the content's arrival, not the layout reflow — cheap and honest for a work instrument. Collapse stays instant (unmount), which is correct: the system's response snaps.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-25).
