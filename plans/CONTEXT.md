# CONTEXT — lee esto antes de tocar nada en esta rama

Contexto que NO vive en el código y se pierde entre sesiones. Si estás retomando
este trabajo (agente o humano), empieza aquí.

## La rama

- **Rama: `feat/motion-diego`.** Respaldada en origin (push autorizado por
  Diego, 2026-07-17). **NO es la versión live.**
- Nació de v9 (`2e47930`) y fue **rebaseada sobre `main` = v10 (`ad051c3`)**
  el 2026-07-17. El rebase pasó sin conflictos; gate v10 (5/5) + regresión
  v6–v9 (33/33) + build + guardrail4 en verde sobre el resultado.
- **`main` no se toca.**

## Reglas duras de esta rama

- **Nunca**: PR, merge, Supabase, migraciones. Push solo como respaldo de esta
  rama (ya autorizado); jamás a `main`.
- El trabajo se ve en el dev server (`npm run dev` →
  http://localhost:5173), no en un preview de Vercel ni en producción.
- Cualquier merge a `main` está gated por aprobación explícita del founder
  (regla de CLAUDE.md). Esta rama todavía no llegó a esa conversación.

## Quién opera

- Quien opera es **Diego (co-fundador)**, desde **Valencia**.
- **La cuenta de git/email es compartida, por eso los commits dicen "Pato"**
  (`thecollectiv4` / `patduranchacon@icloud.com`). No asumas que quien escribe es
  Pato — no le hables a Diego como si fuera Pato.

## Qué hay aquí

Auditoría de animaciones (8 categorías) sobre el commit base `2e47930`, con 10
planes autocontenidos ejecutables por cualquier agente. El índice, el orden de
ejecución y las dependencias están en [README.md](README.md).

Dirección de diseño = lo que está **en el código**: `CLAUDE.md`, los tokens de
`src/lib/cosmos.js`, las convenciones de `src/index.css`. La Design Constitution
NO está en este repo (vive en un vault en otra máquina) — no la busques.

Registro: editorial, museo. La curva de la casa es `cubic-bezier(.2,.7,.2,1)`.
**Nunca bounce, nunca confetti, nunca springs.**
