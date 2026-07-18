# 027 — A-17 · close star

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-17 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — messages
- **File**: `src/pages/Messages.jsx:590`

## Problema

El toggle optimista de close friends (línea 214) voltea fill ('none'→STAR), color (BONE_LOW→STAR) y el glow drop-shadow en un solo frame — la estrella que 'significa algo' (Ley 14, comentario línea 562) se enciende como checkbox, no como estrella.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<Star size={17} strokeWidth={1.6} fill={isClose ? STAR : 'none'} color={isClose ? STAR : BONE_LOW}
  style={isClose ? { filter: 'drop-shadow(0 0 6px rgba(232,233,237,.5))' } : undefined} />
```

## Target — el fix del catálogo, valores exactos

Pasar siempre fill={STAR} y mover el estado a propiedades interpolables: style={{ fillOpacity: isClose ? 1 : 0, color: isClose ? STAR : BONE_LOW, filter: isClose ? 'drop-shadow(0 0 6px rgba(232,233,237,.5))' : 'drop-shadow(0 0 0 rgba(232,233,237,0))', transition: 'fill-opacity var(--dur-base) var(--ease-house), color var(--dur-base) var(--ease-house), filter var(--dur-base) var(--ease-house)' }} — 250ms, cubic-bezier(.2,.7,.2,1). Transición CSS interrumpible: el rollback del catch (línea 217) retargetea suave, sin snap. Solo color/opacity/filter (sin transform) — se mantiene bajo reduced-motion.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-17).
