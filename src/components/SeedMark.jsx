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
