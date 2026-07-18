# 015 — A-05 · plan card in

- **Status**: DONE (aplicado en rama `feat/motion-aditivas`)
- **Catalog ID**: A-05 · **Commit base**: 4cca6e8
- **Severity**: HIGH
- **Category**: aditiva — messages
- **File**: `src/pages/Messages.jsx:403`

## Problema

Al confirmar MAKE IT REAL, el sheet desmonta en un frame, refreshPlans() resuelve async y la tarjeta del plan recién creado aparece de golpe en la lista PLANS (map en líneas 381-385) sin ningún puente — el pico emocional de la superficie aterriza plano.

## Código actual (excerpt del catálogo, commit 4cca6e8)

```jsx
onCreated={() => { setPlanSheet(false); refreshPlans(); refreshInbox(); setSeg('plans') }} />
```

## Target — el fix del catálogo, valores exactos

PlanSheet ya tiene plan_id (línea 954): cambiar onCreated() → onCreated(plan_id), guardar newPlanId en estado de Inbox, y en el div raíz del PlanCard cuyo p.id === newPlanId aplicar className='msg-in' (clase existente, index.css:257-258: opacity 0→1 + translateY(4px)→translateY(0), var(--dur-fast)=200ms, var(--ease-house)=cubic-bezier(.2,.7,.2,1)). Corre una sola vez al montar; reduced-motion ya está resuelto por index.css:355 (.msg-in → animation: none). Cero springs — es el mismo settle editorial que ya usan los mensajes nuevos.

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
- **Feel-check en preview**: ver la guía pantalla-por-pantalla del PR (dónde mirar A-05).
