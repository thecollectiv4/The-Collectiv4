# 016 — A-06 · auth name collapse

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-06 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — builder-create-claim
- **File**: `src/components/AuthModal.jsx:80`

## Problema

Toggling Sign In ↔ Create Account mounts/unmounts the first/last-name row instantly — the email and password inputs teleport down/up by a full row height with no bridge. The identical seam exists in src/pages/Auth.jsx:68 (`{mode==='signup'&&<div style={{display:'flex',gap:'8px'}}>`).

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
{mode==='signup' && (
            <div style={{display:'flex',gap:'8px'}}>
```

## Target — el fix del catálogo, valores exactos

Render the name row unconditionally inside a collapse wrapper: outer div `style={{ display:'grid', gridTemplateRows: mode==='signup' ? '1fr' : '0fr', opacity: mode==='signup' ? 1 : 0 }}` with a small index.css class carrying `transition: grid-template-rows var(--dur-base) var(--ease-house), opacity var(--dur-base) var(--ease-house)` (250ms, cubic-bezier(.2,.7,.2,1)); inner div `style={{ overflow:'hidden', minHeight:0 }}` holding the existing flex row. CSS transition, not keyframes, so rapid toggles retarget smoothly (interruptible). Set `tabIndex={-1}` / `aria-hidden` on the hidden inputs so the collapsed row is unreachable. Reduced-motion (in the same index.css class): `@media (prefers-reduced-motion: reduce) { transition: opacity 150ms ease; }` — gentler, not zero. Apply the same recipe to Auth.jsx:68.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-06).
