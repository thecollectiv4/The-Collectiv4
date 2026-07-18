# 020 — A-10 · offer sold fade

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-10 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — profile-museum
- **File**: `src/components/WorldOffer.jsx:59`

## Problema

Owner taps 'sold' (or 'relist') and the whole listing card snaps between opacity 1 ↔ .62 and border HAIR_HI ↔ HAIR in a single frame — the piece's state change (the point of the action) has no visible bridge.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${live ? HAIR_HI : HAIR}`, background: CARD, opacity: live ? 1 : .62, display: 'flex', flexDirection: 'column' }}>
```

## Target — el fix del catálogo, valores exactos

One line on the card root: transition: 'opacity var(--dur-base) var(--ease-house), border-color var(--dur-base) var(--ease-house)' (250ms, cubic-bezier(.2,.7,.2,1)). Opacity + border-color only — no transform, fully interruptible if the owner toggles sold→relist quickly. Gentle enough that no reduced-motion override is needed (it is itself the reduced form). Makes the card visibly recede as it leaves the live wall.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-10).
