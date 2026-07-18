# 030 — A-20 · craftpicker chip

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-20 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — missed-opportunities
- **File**: `src/components/CraftPicker.jsx:84`

## Problema

Same seam as TasteBrainstorm, same Ley-15 file doctrine ('the craft stops being a text field and becomes RECOGNITION'): toggling a craft in the constellation makes its chip appear in the chosen row (lines 79-99) with no arrival, while the recognition line below fades in (line 104, `animation: 'fadeIn .4s ease'`). The recognition speaks; the recognized object teleports.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<span key={c.id} data-testid={`craft-chip-${c.slug}`}
  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', borderRadius: '100px', padding: '6px 6px 6px 12px', background: isP ? `rgba(${meta.tint},.12)` : 'rgba(242,238,230,.04)', border: `1px solid ${isP ? `rgba(${meta.tint},.55)` : HAIR_HI}`, transition: 'background .25s ease, border-color .25s ease', boxShadow: isP ? `0 0 16px rgba(${meta.tint},.12)` : 'none' }}>
```

## Target — el fix del catálogo, valores exactos

Apply the same `.chip-in` class introduced for TasteBrainstorm (menuIn 160ms var(--ease-exit) — cubic-bezier(0.23,1,0.32,1), scale .96 + fade, no fill) to the chip span at line 84. Keys are stable (c.id) so only a newly-chosen chip animates. One class, two files, one landing gesture across the whole brainstorm grammar. Reduced-motion: covered by the same `.chip-in { animation: none; }` rule.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-20).
