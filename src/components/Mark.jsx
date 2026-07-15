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
  else shape = <path d={`M${c} ${s * 0.1} L${s * 0.9} ${c} L${c} ${s * 0.9} L${s * 0.1} ${c} Z`} {...(filled ? { fill: color, stroke: 'none' } : common)} />
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={style} aria-hidden="true">{shape}</svg>
}
