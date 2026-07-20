/* =========================================================================
   Mark — the star-chart geometric mark set (● ○ ✕ △ ◇ ◆ + star/square),
   the house's OWN icon system (Bauhaus steal: geometric, consistent, one
   job each). Extracted from ProfileMuseum so the nav, the museum and every
   surface draw from the same vocabulary — icons as BRAND MARKS, never
   stock pictograms (Ley 14 · D3). The word always rides beside it (Ley 5).
   ========================================================================= */

const SILVER = '#C7C9D1'

export default function Mark({ type = 'ring', size = 14, color = SILVER, filled = false, style }) {
  const s = size, c = s / 2, r = s * 0.36, sw = Math.max(1, s * 0.085)
  const common = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinejoin: 'round', strokeLinecap: 'round' }
  let shape
  if (type === 'dot') shape = <circle cx={c} cy={c} r={r * 0.62} fill={color} />
  else if (type === 'star') shape = <path d={`M${c} ${s * 0.1} L${c + s * 0.09} ${c - s * 0.09} L${s * 0.9} ${c} L${c + s * 0.09} ${c + s * 0.09} L${c} ${s * 0.9} L${c - s * 0.09} ${c + s * 0.09} L${s * 0.1} ${c} L${c - s * 0.09} ${c - s * 0.09} Z`} fill={color} stroke="none" />
  else if (type === 'ring') shape = <circle cx={c} cy={c} r={r} {...common} />
  else if (type === 'cross') shape = <g {...common}><line x1={s * 0.18} y1={s * 0.18} x2={s * 0.82} y2={s * 0.82} /><line x1={s * 0.82} y1={s * 0.18} x2={s * 0.18} y2={s * 0.82} /></g>
  else if (type === 'plus') shape = <g {...common}><line x1={c} y1={s * 0.12} x2={c} y2={s * 0.88} /><line x1={s * 0.12} y1={c} x2={s * 0.88} y2={c} /></g>
  else if (type === 'triangle') shape = <path d={`M${c} ${s * 0.15} L${s * 0.86} ${s * 0.83} L${s * 0.14} ${s * 0.83} Z`} {...(filled ? { fill: color, stroke: 'none' } : common)} />
  else if (type === 'square') shape = <rect x={s * 0.18} y={s * 0.18} width={s * 0.64} height={s * 0.64} {...(filled ? { fill: color, stroke: 'none' } : common)} />
  /* ===================================================================
     V12 PROPOSAL — the four WAYFINDING marks (see /__icons).

     ⚠ NOT WIRED INTO THE NAV. These are additive types only; the existing
     eight above are untouched, so the museum, the OS board and the plan
     rooms cannot move. Nothing renders these until a founder says so.

     WHY: ✕ ○ ◇ ● are locked by the design system "as section markers /
     separators" (CLAUDE.md) — they were never assigned navigation duty.
     In the shipped nav ✕ reads as CLOSE, ○ and ● are the same primitive
     at two radii, and ◇ has ~20 other jobs in this app. Each mark below
     is drawn in the SAME hand — monochrome, geometric, s*0.085 stroke,
     round caps, 0.1–0.9 envelope — but shaped by what the tab DOES, and
     where possible by what the brand MEANS.
     =================================================================== */
  // EVENT — the marquee: a poster with its header bar. The room, announced.
  else if (type === 'marquee') shape = <g {...common}><rect x={s * 0.16} y={s * 0.17} width={s * 0.68} height={s * 0.66} rx={s * 0.06} /><line x1={s * 0.16} y1={s * 0.38} x2={s * 0.84} y2={s * 0.38} /></g>
  // COMMUNITY — two circles meeting. The convention for "people", and the
  // thesis at the same time: the overlap is "we are all one."
  else if (type === 'people') shape = <g {...common}><circle cx={s * 0.38} cy={c} r={s * 0.21} /><circle cx={s * 0.62} cy={c} r={s * 0.21} /></g>
  // MESSAGES — the bubble. The one universal glyph for "something was said."
  else if (type === 'bubble') shape = <path d={`M${s * 0.5} ${s * 0.17} C${s * 0.75} ${s * 0.17} ${s * 0.86} ${s * 0.3} ${s * 0.86} ${s * 0.46} C${s * 0.86} ${s * 0.62} ${s * 0.75} ${s * 0.74} ${s * 0.5} ${s * 0.74} L${s * 0.36} ${s * 0.74} L${s * 0.22} ${s * 0.86} L${s * 0.25} ${s * 0.72} C${s * 0.18} ${s * 0.66} ${s * 0.14} ${s * 0.57} ${s * 0.14} ${s * 0.46} C${s * 0.14} ${s * 0.3} ${s * 0.25} ${s * 0.17} ${s * 0.5} ${s * 0.17} Z`} {...common} />
  // PROFILE — a world in orbit. Not a person icon: every profile here is a
  // personal museum, a world. The orbit also separates it from ● decisively.
  else if (type === 'world') shape = <g {...common}><circle cx={c} cy={c} r={s * 0.17} fill={filled ? color : 'none'} /><ellipse cx={c} cy={c} rx={s * 0.42} ry={s * 0.17} transform={`rotate(-22 ${c} ${c})`} /></g>
  else shape = <path d={`M${c} ${s * 0.1} L${s * 0.9} ${c} L${c} ${s * 0.9} L${s * 0.1} ${c} Z`} {...(filled ? { fill: color, stroke: 'none' } : common)} />
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={style} aria-hidden="true">{shape}</svg>
}
