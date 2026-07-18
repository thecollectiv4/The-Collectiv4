# 011 — A-01 · foryou empty

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-01 · **Commit base**: 4cca6e8
- **Severity**: HIGH
- **Category**: aditiva — community
- **File**: `src/components/ForYou.jsx:143`

## Problema

The first-run empty state (◇ mark line 144, copy line 145, 'brainstorm your taste' button line 148, 'or wander everyone' button line 152) mounts in one frame after the skeleton — the highest-emotion moment in the community area (a new user whose universe is silent) renders completely flat.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div data-testid="foryou-empty" style={{ minHeight: '52vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', textAlign: 'center', padding: '40px 24px' }}>
```

## Target — el fix del catálogo, valores exactos

Zero new CSS: add className="rise" to the four children (mark, copy, primary button, secondary button) with inline style animationDelay '0ms' / '70ms' / '140ms' / '210ms'. .rise (index.css:178) = riseIn: opacity 0→1 + translateY(12px)→0, var(--dur-slow) 500ms var(--ease-house) cubic-bezier(.2,.7,.2,1), forwards — the house's editorial settle, no bounce. Reduced-motion is already covered: index.css:378 remaps .rise to fadeIn .3s ease with animation-delay 0ms !important (the inline delays collapse correctly). Fires once per mount only — the `empty` branch (line 141) can only be reached after loading resolves, never replays mid-session.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-01).
