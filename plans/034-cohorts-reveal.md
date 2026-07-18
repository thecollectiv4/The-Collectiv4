# 034 — A-24 · cohorts reveal

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-24 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — missed-opportunities
- **File**: `src/components/os/Cohorts.jsx:80`

## Problema

The retention read — per the file header 'the number the company hangs on: on July 26 you open this and see, honestly, how many REAL people came back' — is a rare, founder-only, high-stakes moment, and it teleports: spinner (line 44) hard-swaps to the full stat-card stack in one frame. Sibling OS panes stagger their first paint (ContentEngine.jsx:26 gives each card os-reveal with a 45ms stagger); the pane that carries the most emotional weight in the OS has none of it.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
  {cohorts.map(c => (
    <div key={c.event_id} style={{ border: `1px solid ${HAIR}`, borderRadius: '14px', background: CARD, padding: '16px 18px' }}>
```

## Target — el fix del catálogo, valores exactos

On the per-cohort card div (line 81) add `className="os-reveal-fast"` and `style={{ ...existing, animationDelay: \`${i * 45}ms\` }}` (add the index param to the map). .os-reveal-fast = opacity:0 + osReveal var(--dur-slow) var(--ease-house) forwards (index.css:224) — the deck's 20px rise at 500ms, exactly the ContentEngine.jsx:26 recipe. Also give the count line (line 67) plain `className="os-reveal-fast"` with no delay so the headline number leads. Reduced-motion already covered by index.css:353 (`.os-reveal, .os-reveal-fast { animation:none; opacity:1; }`). Load-once only — the pane remounts per tab visit, matching the OS's per-session entrance doctrine.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-24).
