# 013 — A-03 · experience press

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-03 · **Commit base**: 4cca6e8
- **Severity**: HIGH
- **Category**: aditiva — events
- **File**: `src/pages/ExperienceDetail.jsx:131`

## Problema

The GET YOUR TICKET CTA (line 131) and the Back button (line 74) have hover styles but zero :active press state — a tap on mobile (the primary audience) gives no physical response. These two buttons predate the house's Ley 13 ('every clickable thing FEELS pressable'); every sibling CTA in the area (EventLanding.jsx:366, Events.jsx:138) already carries .pressable.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
<button onClick={()=>navigate('/')} style={{width:'100%',background:'var(--cream)',border:'none',borderRadius:'12px',padding:'16px',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',cursor:'pointer',transition:'transform .2s'}}
```

## Target — el fix del catálogo, valores exactos

Add className="pressable" to both buttons (lines 74 and 131). The class (index.css:129-133) presses to transform: translateY(1px) scale(.99) entering at var(--dur-press)=160ms var(--ease-exit)=cubic-bezier(0.23,1,0.32,1) and releasing at 80ms on the same curve. Line 131 keeps its inline transition:'transform .2s' — the press then runs at 200ms, the exact stacking the flagship buy button already uses (EventLanding.jsx:366-369, className="pressable" + inline transition). Line 74: extend its inline transition to 'border-color .2s, color .2s, transform .2s' so the press does not snap (Events.jsx:139 house-door precedent). Reduced-motion is already neutralized globally at index.css:359 (.pressable:not(:disabled):active { transform:none; }). No new CSS, no new keyframes.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-03).
