# 014 — A-04 · c4 chapters

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-04 · **Commit base**: 4cca6e8
- **Severity**: HIGH
- **Category**: aditiva — profile-museum
- **File**: `src/pages/HouseWorld.jsx:144`

## Problema

The flagship /c4 page hard-cuts from a lone spinner to all four chapters (THE ROOMS, THE NETWORK, THE CULTURE, THE OFFER) at once — the museum's sibling surfaces (ProfileMuseum useReveal, Community .card-in cascade) all bridge their entrances; the flagship alone teleports.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
{loading ? (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '70px 0' }}>
    <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
```

## Target — el fix del catálogo, valores exactos

Reuse the discovery-grid vocabulary verbatim: on the post-load branch, wrap each <Chapter> in className="card-in" (index.css:347 — fadeUp: opacity 0→1 + translateY(16px)→0, var(--dur-slow)=500ms, var(--ease-house)=cubic-bezier(.2,.7,.2,1), forwards) with inline animationDelay: idx*70ms (0/70/140/210ms — inside the 30–80ms stagger band; decorative, never blocks interaction). Mirror Community.jsx:295's `entered` guard so only the first load dances — a later refetch renders plain. Reduced-motion comes free: index.css:371 already collapses .card-in to fadeIn .3s ease. Zero new CSS.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-04).
