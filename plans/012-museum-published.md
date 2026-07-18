# 012 — A-02 · museum published

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-02 · **Commit base**: 4cca6e8
- **Severity**: HIGH
- **Category**: aditiva — profile-museum
- **File**: `src/components/ProfileMuseum.jsx:1221`

## Problema

The PUBLISHED celebration — the rarest, highest-emotion moment in the museum (first publish of your world) — fades in as one flat block: kicker, chrome display, copy and both buttons land simultaneously, and dismissal unmounts the overlay instantly (asymmetric: enters with a .6s fade, exits with nothing).

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div role="dialog" aria-label="Your world is live" style={{ position: 'fixed', inset: 0, zIndex: 10010, background: `radial-gradient(120% 88% at 50% 8%, rgba(199,201,209,.09) 0%, transparent 55%), ${VOID}`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn .6s ease' }}>
```

## Target — el fix del catálogo, valores exactos

This is where the delight budget lives, and the house already owns the ceremony grammar (.rise procession — WorldBuilder.jsx:505-533, CreateCentral.jsx:136-147, ClaimWorld.jsx:151). Keep the overlay's fadeIn .6s; stage the inner children: kicker className="rise", display "rise rise-1" (120ms), copy "rise rise-2" (200ms), primary button "rise rise-3" (280ms), ghost button "rise rise-4" (360ms) — riseIn = opacity 0→1 + translateY(12px)→0, var(--dur-slow)=500ms, var(--ease-house)=cubic-bezier(.2,.7,.2,1) (index.css:177-180). Reduced-motion is pre-wired: index.css:378 collapses .rise to fadeIn .3s with animation-delay 0 !important. For the symmetric exit: a `closing` state that transitions overlay opacity 1→0 over var(--dur-fast)=200ms var(--ease-exit)=cubic-bezier(0.23,1,0.32,1), unmount on transitionend. No springs, no confetti — an editorial procession.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-02).
