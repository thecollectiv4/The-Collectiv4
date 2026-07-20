/* =========================================================================
   THE ◇ SEED PILL (v10 · guardrail 4, total) — the ONE source of the label.

   The law (founder's order): is_demo travels with the IDENTITY, not with
   the surface. Every payload that transports a profile transports is_demo;
   every surface that renders a profile passes it here, and the pill
   renders itself — or nothing. No surface re-implements this.

   Only a founder can ever hold an is_demo:true identity (RLS 0033 floors
   profile reads; 0040/0042/0044 floor the RPC payloads) — for every other
   member this component renders null, forever, by construction.

   Layout-agnostic: inline-flex. The surface positions it (absolute over a
   cover, inline beside a name); it never positions itself.

   ⚠ V12 — ESTA PASTILLA NO SIGUE EL TEMA, Y ES A PROPÓSITO.
   El ámbar es un literal fijo en los dos registros: no es color de marca
   (Cosmos no tiene ámbar), es una BANDERA DE QA, y una bandera que cambia
   de color según el tema deja de funcionar como bandera. Como el fondo es
   fijo, la tinta encima TIENE que ser fija también.
   El texto decía `var(--bg)` y de noche resolvía a vacío sobre oro —
   correcto— pero de día resolvía a HUESO sobre oro, que es ~1.4:1: la
   etiqueta desaparecía justo en la superficie donde avisa que unos datos
   son falsos. Atrapado en la auditoría de light. Literal, y comentado para
   que nadie lo "arregle" de vuelta a una variable.
   ========================================================================= */
export default function SeedPill({ is_demo, size = 7.5 }) {
  if (!is_demo) return null
  return (
    <span data-testid="seed-card-badge" title="Seed world — QA fixture, invisible to the public"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'DM Mono', fontSize: `${size}px`, letterSpacing: '.18em', textTransform: 'uppercase', color: '#0A0A0D', background: 'rgba(229,200,140,.92)', borderRadius: '100px', padding: '3px 8px', fontWeight: 600, flexShrink: 0 }}>
      ◇ seed
    </span>
  )
}

/* the border tint a seed card wears — same single source */
export const SEED_BORDER = 'rgba(229,200,140,.4)'
