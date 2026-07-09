/* Plain-node assertions for computeVisibleLabels (RoadmapStrip label math).
   Run: node scripts/roadmap-labels.test.mjs — exits non-zero on any failure. */
import { computeVisibleLabels } from '../src/components/os/roadmapLabels.js'

let failures = 0
const check = (name, cond) => {
  if (cond) console.log(`  ok — ${name}`)
  else { failures++; console.error(`  FAIL — ${name}`) }
}

// realistic label widths at 8px DM Mono, .12em tracking (capped at 120px):
// endpoints "CHAPTER · JUL 1" ≈ 92px, "FALL 001 · AUG 28" ≈ 104px
// mid date labels ("JUL 21") ≈ 42px
const ENDPOINTS = [92, 104]
const MIDS = [
  { pct: 12, labelWidthPx: 42 },
  { pct: 34, labelWidthPx: 42 },
  { pct: 36, labelWidthPx: 48 }, // nearly on top of the previous one
  { pct: 61, labelWidthPx: 42 },
  { pct: 95, labelWidthPx: 42 }, // hugs the FALL 001 endpoint
]
const GAP = 12

function boxes(width, visible) {
  // reconstruct the visible boxes exactly as the component lays them out
  const out = [
    { name: 'CHAPTER (start)', left: 0, right: ENDPOINTS[0] },
    { name: 'FALL 001 (end)', left: width - ENDPOINTS[1], right: width },
  ]
  MIDS.forEach((m, i) => {
    if (!visible[i]) return
    const c = (m.pct / 100) * width
    out.push({ name: `mid@${m.pct}%`, left: c - m.labelWidthPx / 2, right: c + m.labelWidthPx / 2 })
  })
  return out
}

for (const width of [320, 600, 900, 1200]) {
  console.log(`container ${width}px`)
  const visible = computeVisibleLabels(width, ENDPOINTS, MIDS, GAP)

  check('returns one verdict per mid (nodes never removed — only labels toggle)', visible.length === MIDS.length && visible.every((v) => typeof v === 'boolean'))

  const b = boxes(width, visible)
  let overlap = false
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    // endpoints may legitimately meet at tiny widths; mids must never touch anything
    const bothEndpoints = i < 2 && j < 2
    if (!bothEndpoints && b[i].left < b[j].right && b[i].right > b[j].left) { overlap = true; console.error(`    overlap: ${b[i].name} × ${b[j].name}`) }
  }
  check('no two visible label boxes overlap', !overlap)
  check('endpoints always visible (never part of the hide set)', b[0].name.includes('start') && b[1].name.includes('end'))

  if (width >= 900) check('wide strips show at least one mid label', visible.some(Boolean))
  if (width <= 320) check('tight strips hide the colliding mids rather than stack them', visible.filter(Boolean).length <= 2)
}

// degenerate inputs stay safe
const zero = computeVisibleLabels(0, ENDPOINTS, MIDS)
check('zero-width container hides all mid labels', zero.every((v) => v === false))
const empty = computeVisibleLabels(800, ENDPOINTS, [])
check('no mids → empty array', Array.isArray(empty) && empty.length === 0)

if (failures) { console.error(`\n${failures} assertion(s) failed`); process.exit(1) }
console.log('\nall assertions passed')
