# 022 — A-12 · events view slide

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-12 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — os
- **File**: `src/components/os/Events.jsx:215`

## Problema

setView('edit') / setView('list') swaps the entire Events pane between the list and the editor with a dry cut — no transition — while every sibling seam in the OS (tab panes) arrives via os-slide-in-right/left. The editor is a deeper view; returning to the list is also a dry cut.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
if (view === 'edit') {
```

## Target — el fix del catálogo, valores exactos

Reuse the OS's existing directional grammar, zero new CSS: key the view root by `view` and apply className 'os-slide-in-right' when entering edit and 'os-slide-in-left' when returning to list. Existing classes: osSlideInRight/osSlideInLeft = opacity 0→1 + translateX(±10px)→0, var(--dur-fast) 200ms, var(--ease-house) cubic-bezier(.2,.7,.2,1), no `forwards` fill (respects the house NO-forwards law). Guard with a mounted ref so the first render (incl. deep-link /os?tab=events&new=1) does not double-animate under the pane's own slideClass. Reduced-motion is already covered globally: `.os-slide-in-right, .os-slide-in-left { animation:none }`.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-12).
