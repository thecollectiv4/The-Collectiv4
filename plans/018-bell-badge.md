# 018 — A-08 · bell badge

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-08 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — shell
- **File**: `src/components/Layout.jsx:264`

## Problema

The bell badge mounts/unmounts via bare conditional render — it appears at full size and opacity in the persistent nav with no bridge, in both surfaces (wide header Layout.jsx:196-203, mobile nav Layout.jsx:264-271). No animation or transition property exists on the span.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
{tab.to === '/messages' && bellCount > 0 && (
  <span data-testid="bell-badge" aria-label={`${bellCount} unread signals`}
```

## Target — el fix del catálogo, valores exactos

Add to index.css: `@keyframes badgeIn { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:scale(1); } }` and `.badge-in { animation: badgeIn var(--dur-fast) var(--ease-house); }` — 200ms, cubic-bezier(.2,.7,.2,1), transform+opacity only, NO forwards fill (NO-forwards law; end state equals natural values, and the badge has no fixed descendants anyway). Apply className="badge-in" to both bell-badge spans (Layout.jsx:197 and Layout.jsx:265). Reduced-motion: add `.badge-in { animation: fadeIn .2s ease; }` inside the existing @media (prefers-reduced-motion: reduce) block (index.css:351). The animation plays only on mount (unread going 0→n, or a session loading with unread) — in-place count updates (3→4) never remount the span, so it never re-triggers at navigation frequency.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-08).
