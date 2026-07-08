import { useMemo } from 'react'
import { BONE, BONE_MID, BONE_LOW, STAR, HAIR_HI, FONT_MONO, CHAPTER_START_ISO, FALL_001_ISO } from '@/lib/cosmos'

/* =========================================================================
   RoadmapStrip — the chapter as an instrument. A thin hairline from the
   chapter opening to Fall 001; the elapsed portion fills in bone (§E: progress
   is a hairline filling with bone, never a colored bar). Star-chart nodes are
   REAL dated work (task due dates + content planned dates), not decoration.
   The "now" position pulses subtly (disabled under prefers-reduced-motion).
   ========================================================================= */

const DAY = 86400000
const toDate = (iso) => new Date(iso + 'T00:00:00')
const fmt = (iso) => toDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()

export default function RoadmapStrip({ tasks = [], content = [] }) {
  const { nodes, nowPct, todayLabel } = useMemo(() => {
    const start = toDate(CHAPTER_START_ISO).getTime()
    const end = toDate(FALL_001_ISO).getTime()
    const span = Math.max(1, end - start)
    const now = Date.now()
    const nowPct = Math.min(100, Math.max(0, ((now - start) / span) * 100))

    // real dated work → nodes, deduped by day, capped so the strip stays legible
    const raw = []
    tasks.forEach((t) => { if (t.due_date) raw.push({ iso: t.due_date, label: t.title }) })
    content.forEach((c) => { if (c.planned_date) raw.push({ iso: c.planned_date, label: c.title }) })
    const byDay = new Map()
    raw.sort((a, b) => a.iso.localeCompare(b.iso)).forEach((n) => {
      if (!byDay.has(n.iso)) byDay.set(n.iso, { ...n, count: 1 })
      else byDay.get(n.iso).count++
    })
    let mids = [...byDay.values()].filter((n) => {
      const t = toDate(n.iso).getTime()
      return t > start && t < end
    })
    if (mids.length > 5) mids = mids.slice(0, 4).concat(mids[mids.length - 1])

    const nodes = mids.map((n) => {
      const t = toDate(n.iso).getTime()
      return {
        pct: Math.min(100, Math.max(0, ((t - start) / span) * 100)),
        iso: n.iso,
        label: n.count > 1 ? `${n.label} +${n.count - 1}` : n.label,
        past: t <= now,
        terminal: false,
      }
    })
    return { nodes, nowPct, todayLabel: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() }
  }, [tasks, content])

  return (
    <div aria-label="Roadmap to Fall 001" style={{ padding: '6px 0 26px' }}>
      <div style={{ position: 'relative', height: '10px' }}>
        {/* the orbit: full hairline + elapsed filled in bone */}
        <div style={{ position: 'absolute', top: '4px', left: 0, right: 0, height: '1px', background: HAIR_HI }} />
        <div style={{ position: 'absolute', top: '4px', left: 0, width: `${nowPct}%`, height: '1px', background: 'rgba(242,238,230,.55)' }} />

        {/* origin tick */}
        <Node pct={0} past label={`CHAPTER · ${fmt(CHAPTER_START_ISO)}`} kind="tick" edge="start" />

        {/* real dated work */}
        {nodes.map((n, i) => (
          <Node key={n.iso + i} pct={n.pct} past={n.past} iso={n.iso} label={n.label} kind="diamond" mid />
        ))}

        {/* now — the pulse */}
        <div className="os-now-dot" title={`Today · ${todayLabel}`} style={{ position: 'absolute', top: '1.5px', left: `${nowPct}%`, transform: 'translateX(-50%)', width: '6px', height: '6px', borderRadius: '50%', background: STAR }} />

        {/* terminal star: Fall 001 */}
        <Node pct={100} past={false} label={`FALL 001 · ${fmt(FALL_001_ISO)}`} kind="star" edge="end" />
      </div>
    </div>
  )
}

function Node({ pct, past, iso, label, kind, mid, edge }) {
  const align = edge === 'start' ? 'flex-start' : edge === 'end' ? 'flex-end' : 'center'
  const translate = edge === 'start' ? '0' : edge === 'end' ? '-100%' : '-50%'
  return (
    <div title={label} style={{ position: 'absolute', top: 0, left: `${pct}%`, transform: `translateX(${translate})`, display: 'flex', flexDirection: 'column', alignItems: align, gap: '7px', minWidth: 0 }}>
      {kind === 'star' ? (
        <svg width="9" height="9" viewBox="0 0 10 10" style={{ marginTop: '0px', flexShrink: 0 }}>
          <path d="M5 0 L6.1 3.9 L10 5 L6.1 6.1 L5 10 L3.9 6.1 L0 5 L3.9 3.9 Z" fill={STAR} />
        </svg>
      ) : kind === 'tick' ? (
        <div style={{ width: '1px', height: '9px', background: HAIR_HI, marginTop: 0 }} />
      ) : (
        <div style={{ width: '6px', height: '6px', marginTop: '1.5px', transform: 'rotate(45deg)', background: past ? BONE : 'transparent', border: `1px solid ${past ? BONE : 'rgba(242,238,230,.4)'}`, flexShrink: 0 }} />
      )}
      <div className={mid ? 'os-node-label--mid' : undefined} style={{ fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.12em', color: past ? BONE_MID : BONE_LOW, whiteSpace: 'nowrap', textTransform: 'uppercase', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {mid && iso ? fmt(iso) : label}
      </div>
    </div>
  )
}
