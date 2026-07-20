import { useMemo, useRef, useState, useLayoutEffect } from 'react'
import { BONE, BONE_MID, BONE_LOW, STAR, HAIR_HI, FONT_MONO, CHAPTER_START_ISO, FALL_001_ISO } from '@/lib/cosmos'
import { computeVisibleLabels } from './roadmapLabels'

/* =========================================================================
   RoadmapStrip — the chapter as an instrument. A thin hairline from the
   chapter opening to Fall 001; the elapsed portion fills in bone (§E: progress
   is a hairline filling with bone, never a colored bar). Star-chart nodes are
   REAL dated work (task due dates + content planned dates), not decoration.
   The "now" position pulses subtly (disabled under prefers-reduced-motion).

   Label collision: a ResizeObserver watches the strip; every label is measured
   in a hidden measurer and computeVisibleLabels (pure, node-tested) decides
   which intermediate labels get air. Endpoint labels are never hidden; nodes
   always render (with title tooltips) even when their label hides.
   ========================================================================= */

const toDate = (iso) => new Date(iso + 'T00:00:00')
const fmt = (iso) => toDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()

const START_LABEL = `CHAPTER · ${fmt(CHAPTER_START_ISO)}`
const END_LABEL = `FALL 001 · ${fmt(FALL_001_ISO)}`
const LABEL_MAX_W = 120
const labelStyle = { fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.12em', whiteSpace: 'nowrap', textTransform: 'uppercase', maxWidth: `${LABEL_MAX_W}px`, overflow: 'hidden', textOverflow: 'ellipsis' }

export default function RoadmapStrip({ tasks = [], content = [] }) {
  const wrapRef = useRef(null)
  const measureRef = useRef(null)
  const [cw, setCw] = useState(0)
  const [widths, setWidths] = useState(null) // { start, end, mids: [] }

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
      }
    })
    return { nodes, nowPct, todayLabel: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() }
  }, [tasks, content])

  const midTexts = nodes.map((n) => fmt(n.iso)).join('|')

  // strip width — live, so window resizes recompute label visibility
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    setCw(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setCw(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // measure label widths off a hidden measurer (same font metrics as the real labels)
  useLayoutEffect(() => {
    const m = measureRef.current
    if (!m) return
    const spans = m.querySelectorAll('span')
    const w = (i) => Math.min(LABEL_MAX_W, spans[i] ? spans[i].offsetWidth : 0)
    setWidths({ start: w(0), end: w(1), mids: nodes.map((_, i) => w(i + 2)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midTexts])

  const visible = useMemo(() => {
    if (!widths || !cw) return nodes.map(() => false)
    return computeVisibleLabels(cw, [widths.start, widths.end], nodes.map((n, i) => ({ pct: n.pct, labelWidthPx: widths.mids[i] || 0 })))
  }, [cw, widths, nodes])

  return (
    <div ref={wrapRef} aria-label="Roadmap to Fall 001" style={{ padding: '6px 0 26px' }}>
      {/* hidden measurer — same type styles, never seen */}
      <div ref={measureRef} aria-hidden style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', height: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <span style={{ ...labelStyle, display: 'inline-block', maxWidth: 'none' }}>{START_LABEL}</span>
        <span style={{ ...labelStyle, display: 'inline-block', maxWidth: 'none' }}>{END_LABEL}</span>
        {nodes.map((n, i) => <span key={n.iso + i} style={{ ...labelStyle, display: 'inline-block', maxWidth: 'none' }}>{fmt(n.iso)}</span>)}
      </div>

      <div style={{ position: 'relative', height: '10px' }}>
        {/* the orbit: full hairline + elapsed filled in bone */}
        <div style={{ position: 'absolute', top: '4px', left: 0, right: 0, height: '1px', background: HAIR_HI }} />
        <div className="os-orbit-draw" style={{ position: 'absolute', top: '4px', left: 0, width: `${nowPct}%`, height: '1px', background: 'rgba(var(--ink-rgb),.55)' }} />

        {/* origin tick — endpoint label, never hidden */}
        <Node pct={0} past label={START_LABEL} kind="tick" edge="start" />

        {/* real dated work — nodes always render; labels only when they have air */}
        {nodes.map((n, i) => (
          <Node key={n.iso + i} pct={n.pct} past={n.past} iso={n.iso} label={n.label} kind="diamond" mid labelVisible={visible[i]} />
        ))}

        {/* now — the pulse */}
        <div className="os-now-dot" title={`Today · ${todayLabel}`} style={{ position: 'absolute', top: '1.5px', left: `${nowPct}%`, transform: 'translateX(-50%)', width: '6px', height: '6px', borderRadius: '50%', background: STAR }} />

        {/* terminal star: Fall 001 — endpoint label, never hidden */}
        <Node pct={100} past={false} label={END_LABEL} kind="star" edge="end" />
      </div>
    </div>
  )
}

function Node({ pct, past, iso, label, kind, mid, edge, labelVisible = true }) {
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
        <div style={{ width: '6px', height: '6px', marginTop: '1.5px', transform: 'rotate(45deg)', background: past ? BONE : 'transparent', border: `1px solid ${past ? BONE : 'rgba(var(--ink-rgb),.4)'}`, flexShrink: 0 }} />
      )}
      <div aria-hidden={!labelVisible || undefined} style={{ ...labelStyle, color: past ? BONE_MID : BONE_LOW, visibility: labelVisible ? 'visible' : 'hidden' }}>
        {mid && iso ? fmt(iso) : label}
      </div>
    </div>
  )
}
