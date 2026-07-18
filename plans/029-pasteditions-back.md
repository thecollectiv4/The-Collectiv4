# 029 — A-19 · pasteditions back

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-19 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — events
- **File**: `src/pages/PastEditions.jsx:25`

## Problema

The back-arrow button in the sticky header is completely inert: no transition property, no hover state, no :active state. It is the only way out of the archive and the only Ley 13 violation on the page.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<button onClick={()=>navigate('/')} style={{background:'none',border:'none',color:'var(--cream)',cursor:'pointer',display:'flex',alignItems:'center'}}>
```

## Target — el fix del catálogo, valores exactos

Add className="pressable" (index.css:129-133: :active transform: translateY(1px) scale(.99), enter var(--dur-press)=160ms var(--ease-exit)=cubic-bezier(0.23,1,0.32,1), release 80ms). Optionally add the house hover brighten: base color:'var(--cream-mid)', inline transition:'color var(--dur-fast) var(--ease-house)' (200ms cubic-bezier(.2,.7,.2,1)) with onMouseOver→'var(--cream)' / onMouseOut restore, mirroring Events.jsx:139-141. Reduced-motion: covered by index.css:359; the color transition needs no gating (color-only, no transform).

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-19).
