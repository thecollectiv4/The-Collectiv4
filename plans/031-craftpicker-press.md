# 031 — A-21 · craftpicker press

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-21 · **Commit base**: 4cca6e8
- **Severity**: LOW
- **Category**: aditiva — community
- **File**: `src/components/CraftPicker.jsx:92`

## Problema

The chosen-chip remove button (line 92) and the lead-handoff button (line 86) are the only interactive elements across the six community files with no className="pressable" — no :active press state, no transition; taps land with zero physical acknowledgment (a Ley 13 gap by the house's own rule).

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<button onClick={() => remove(c)} aria-label={`Remove ${c.name}`}
  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '17px', height: '17px', borderRadius: '50%', background: 'rgba(242,238,230,.05)', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: 0 }}>
```

## Target — el fix del catálogo, valores exactos

Add className="pressable" to both buttons (lines 86 and 92). House press already defined (index.css:129-133): rest transition transform 80ms var(--ease-exit) cubic-bezier(0.23,1,0.32,1); :active transform: translateY(1px) scale(.99) entering over var(--dur-press) 160ms var(--ease-exit). Reduced-motion already neutralized at index.css:359 (.pressable:not(:disabled):active { transform: none }). Zero new CSS.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-21).
