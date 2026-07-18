# 026 — A-16 · mark read

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-16 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — messages
- **File**: `src/pages/Messages.jsx:443`

## Problema

'mark all read' (líneas 302-304) voltea en el mismo frame el background de todas las filas unread del Bell, el border del avatar (SILVER→HAIR_HI, línea 444), los colores de texto, y desmonta cada punto unread (línea 460 `{unread && <span .../>}`) — teleport simultáneo de N filas mientras el usuario sigue mirando la lista.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
borderTop: i > 0 ? `1px solid ${HAIR}` : 'none', background: unread ? 'rgba(232,233,237,.03)' : 'transparent' }}>
```

## Target — el fix del catálogo, valores exactos

En el div de fila (línea 442) añadir transition: 'background-color var(--dur-base) var(--ease-house)' (250ms, cubic-bezier(.2,.7,.2,1)); en el span del avatar (444) añadir 'border-color var(--dur-base) var(--ease-house)'. El punto unread (460): renderizarlo siempre con opacity: unread ? 1 : 0 y transition: 'opacity var(--dur-base) var(--ease-house)' en vez del unmount condicional. Dejar el fontWeight 700→500 como snap (no interpolable con webfonts estáticas). Solo color/opacity, sin transform — aceptable bajo reduced-motion (la casa mapea a fades, gentler not zero). No aplica al tap individual (onOpen navega fuera; el cambio no es visible).

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-16).
