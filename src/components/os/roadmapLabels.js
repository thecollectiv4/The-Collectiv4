/* =========================================================================
   Pure layout math for the RoadmapStrip labels. No DOM, no React — testable
   in plain node (scripts/roadmap-labels.test.mjs).

   Rules:
   - Endpoint labels (chapter origin, Fall 001) are NEVER hidden — they are
     not even passed in; their boxes are reserved space the mids must respect.
   - Intermediate labels hide progressively when their box would collide with
     an endpoint box or an already-visible mid box. Nodes always stay — this
     only decides LABEL visibility.
   ========================================================================= */

/**
 * @param {number} containerWidthPx  strip width
 * @param {[number, number]} endpointWidthsPx  [startLabelWidth, endLabelWidth]
 *        start label is left-aligned at 0, end label right-aligned at width
 * @param {{pct:number, labelWidthPx:number}[]} mids  centered at pct% of width
 * @param {number} gapPx  minimum clear air between label boxes
 * @returns {boolean[]}  visibility per mid, same order as passed
 */
export function computeVisibleLabels(containerWidthPx, endpointWidthsPx, mids, gapPx = 12) {
  const cw = Number(containerWidthPx) || 0
  const list = Array.isArray(mids) ? mids : []
  if (cw <= 0) return list.map(() => false)
  const [startW = 0, endW = 0] = endpointWidthsPx || []

  // reserved boxes: [left, right]
  const occupied = [
    [0, Math.min(startW, cw)],
    [Math.max(0, cw - endW), cw],
  ]

  return list.map((m) => {
    const center = (Math.min(100, Math.max(0, m.pct)) / 100) * cw
    const half = (m.labelWidthPx || 0) / 2
    const left = center - half
    const right = center + half
    const collides = right - left <= 0 || left < 0 || right > cw ||
      occupied.some(([a, b]) => left < b + gapPx && right > a - gapPx)
    if (collides) return false
    occupied.push([left, right])
    return true
  })
}
