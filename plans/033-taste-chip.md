# 033 — A-23 · taste chip

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-23 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — missed-opportunities
- **File**: `src/components/TasteBrainstorm.jsx:196`

## Problema

Ley 15's core beat — tap a constellation suggestion and 'it lands in your set' — renders as a teleport: the new chip appears in the held set (lines 192-210) with zero arrival while the recognition line right below it fades in (line 220, `animation: 'fadeIn .4s ease'`). The universe's answer is half-animated: the words arrive, the object doesn't. A spatially-connected landing (chip travels from the constellation above into your set) has no motion explaining it.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<span key={`${t.domain}:${kb}`} data-testid={`taste-chip-${t.domain}-${kb}`}
  style={{ display: 'inline-flex', alignItems: 'stretch', borderRadius: '100px', border: `1px solid ${pub ? 'rgba(242,238,230,.45)' : HAIR_HI}`, background: pub ? 'rgba(242,238,230,.07)' : 'rgba(242,238,230,.02)', overflow: 'hidden', transition: 'background .25s ease, border-color .25s ease' }}>
```

## Target — el fix del catálogo, valores exactos

Add one shared class to index.css next to .menu-in (line 167): `.chip-in { animation: menuIn 160ms var(--ease-exit); }` — reusing the existing menuIn keyframes (index.css:160, scale(.96)+opacity → 1) on the strong ease-out cubic-bezier(0.23,1,0.32,1); no forwards fill. Apply `className="chip-in"` to the chip span at line 196. Keys are stable (`${t.domain}:${kb}`), so only the newly-mounted chip plays it — existing chips never re-dance on re-render. Add `.chip-in { animation: none; }` to the reduced-motion block. Never a spring, never a bounce — the 0.96 settle on the house's exit curve is the whole gesture.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-23).
