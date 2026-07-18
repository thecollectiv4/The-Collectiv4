# 025 — A-15 · c4 hero

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-15 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — missed-opportunities
- **File**: `src/pages/HouseWorld.jsx:126`

## Problema

/c4 is the flagship front door ('the first thing a visitor sees' per the file header; Layout.jsx PUBLIC_PATHS names it the front door when the domain points here) — a rare/first-visit surface with full delight budget — yet its hero (kicker, chrome h1, paragraph, CTA row, lines 126-141) mounts with only Layout's generic 200ms .page-transition. The equivalent hero on EventLanding.jsx:260-296 gets the house procession (.fade-up / .fade-up-1..4). The flagship is the one surface in the repo that earns the deck's staged welcome and doesn't have it.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: wide ? '.34em' : '.28em', textTransform: 'uppercase', marginBottom: '10px' }}>◇ the house world · Houston</div>
<h1 style={{ fontFamily: 'Bebas Neue', fontSize: wide ? 'clamp(72px, 8vw, 110px)' : '56px', letterSpacing: '.01em', lineHeight: .88, margin: 0, ...chromeText }}>THE COLLECTIV4</h1>
```

## Target — el fix del catálogo, valores exactos

Apply the existing procession classes (index.css:89-93, fadeUp 0.55s var(--ease-house) i.e. cubic-bezier(.2,.7,.2,1), delays 0/100/200/300ms, forwards): className="fade-up" on the kicker div (line 126), "fade-up-1" on the h1 (line 127), "fade-up-2" on the <p> (line 128), "fade-up-3" on the CTA row div (line 132). The hero block contains no position:fixed descendants, so the forwards fill is safe (same accepted pattern as EventLanding). No new keyframes, no new tokens. Note while there: .fade-up* are absent from the prefers-reduced-motion block (index.css:351-381) — add `.fade-up,.fade-up-1,.fade-up-2,.fade-up-3,.fade-up-4 { animation: fadeIn .3s ease forwards; animation-delay: 0ms !important; }` to it, mirroring the .rise rule at index.css:378.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-15).
