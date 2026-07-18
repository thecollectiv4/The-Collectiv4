# 019 — A-09 · bond in

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-09 · **Commit base**: 4cca6e8
- **Severity**: MEDIUM
- **Category**: aditiva — community
- **File**: `src/components/PeopleSearch.jsx:174`

## Problema

After a successful send/accept, the 'amigo' button (line 192) or 'accept' button (line 186) is replaced by a structurally different element — the 'requested' span (line 181) or 'amigos' span (line 176) — in the same frame: a border button becomes a borderless label with no bridge, at the exact confirmation moment of the launch-test gesture ('agrega a Diego de amigo').

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
function BondButton({ bond, busy, onSend, onAccept, personId }) {
  if (bond === 'friends') return (
```

## Target — el fix del catálogo, valores exactos

In ResultRow, track the previous bond in a ref; when bond CHANGES after mount (post-action only), render the incoming BondButton state with a one-shot entrance class reusing @keyframes msgIn (index.css:257): opacity 0→1 + translateY(4px)→0, var(--dur-fast) 200ms var(--ease-house) cubic-bezier(.2,.7,.2,1). New class e.g. .bond-in { animation: msgIn var(--dur-fast) var(--ease-house); } and add .bond-in to the reduced-motion block alongside .msg-in (index.css:355, animation: none). Gate is mandatory: it must NOT run on initial results render or every row's chip would dance when a search lands.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-09).
