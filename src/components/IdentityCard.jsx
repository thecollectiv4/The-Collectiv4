import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'
import { Contact } from 'lucide-react'
import {
  BONE, BONE_MID, BONE_LOW, FAINT, SILVER, HAIR, HAIR_HI,
  FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, safeImg,
} from '@/lib/cosmos'
import { glassControl } from '@/lib/glass'
import { useWide } from '@/lib/useIsDesktop'
import { TIERS } from '@/lib/tiers'
import GlassSheet from '@/components/GlassSheet'
import VerifiedMark from '@/components/VerifiedMark'
import SeedPill from '@/components/SeedMark'

/* =========================================================================
   LA CREDENCIAL — the C4 identity card.

   WHAT IT IS: not a UI panel. An OBJECT. A laminated identification card
   that happens to live on a screen — die-cut corners, micro-print, a
   guilloche raster, a barcode, a signature strip, and a gloss that moves
   when you move. You should want to hold it.

   WHY IT LOOKS LIKE THIS
   ─────────────────────────────────────────────────────────────────────────
   · A credential is LANDSCAPE. Every card a person has ever been handed —
     licence, access badge, membership card — is wider than it is tall, and
     a landscape card is the only orientation that fits a phone sheet
     without scrolling. A card you have to scroll is not an object.
   · DENSITY IS THE GENRE. The type here runs at, and just under, the small
     end of the house mono scale on purpose: micro-print is what makes a
     credential read as printed rather than as a web page. Measured on the
     phone card (W=312, u=3.12): labels 7.4px, the SIGNATURE label 6.9px,
     values 9.8px. The house floor for DM Mono is 8.5px, so the labels are a
     DELIBERATE deviation and worth a founder's eye — the VALUES, which carry
     the actual information, stay at readable sizes, and the deviation buys
     the one thing that makes this an object instead of a panel. What it does
     NOT buy is unreadable colour: everything below the floor is BONE_MID, at
     ≥5.5:1 in both registers (see `label`). FAINT never carries text — it is
     a decorative token (see index.css) and here it only draws the ✕ △ ◇.
   · ONE CHROME MOMENT, AND IT IS THE NAME. Same law the museum obeys
     (Ley 8, ProfileMuseum:1851): the world's single chrome moment is the
     NAME, and the card spends its one where the app always spends it. The
     specular sweep is NOT chrome: it is white light, the same literal white
     glass.js already sanctions for speculars in both registers ("la
     especular se queda blanca en ambos").

     ⚠ TWO OPEN QUESTIONS ABOUT THAT NAME. Neither is settled here; both
     want a founder's eye before the card ships anywhere but /settings.
     (a) ONE SCREEN, OR TWO? On a phone the sheet IS the screen and one
         chrome moment is one. On desktop it is a 486px dialog over a 62%
         scrim — so if the page behind it already spends a chrome moment
         (a museum H1 does, on the default nameSkin) that is two on one
         screen. Today the only wired host is /settings, which spends none,
         so the question is live but not yet a bug.
     (b) `-webkit-background-clip: text` has known WebKit failures under a
         `preserve-3d` / `will-change: transform` ancestor — and this h3 has
         both. The failure mode is the NAME PAINTING NOTHING (`color` and
         `-webkit-text-fill-color` are both transparent), which is exactly
         the class of bug index.css:794-809 already paid for once. There is
         no inline hedge — background-clip either clips or it does not — so
         it has to be EYEBALLED once on iOS Safari and once on macOS Safari.
         If it fails the repair is one line: drop `...chromeText` from the
         h3 and use `color: BONE`. Nothing else on the card depends on it,
         and BONE is what the recon prescribes for any surface that does not
         fully cover the page anyway.

   HONESTY — what traces to a row, and the one thing that does not
   ─────────────────────────────────────────────────────────────────────────
   full_name · username · verified · is_demo · avatar_url · created_at come
   straight off the profile row that is handed in. Nothing is fetched here
   and nothing is invented:
     · no username  → the handle line does not render (not a fake handle)
     · no full_name → the initials fall back to the username, then to ◇
     · no created_at→ MEMBER SINCE prints "—"
     · no id        → NO card number and NO barcode. A serial we could not
                      derive is a serial we do not print.
   EXACTLY ONE CELL DOES NOT COME FROM A ROW, and it is labelled for what it
   is: PRINTED. There is no issuance table anywhere in the database, so the
   card cannot say when it was issued — the only true statement it can make
   about a clock reading is that THIS COPY was printed at that moment. It
   used to say ISSUED, in the identical grammar as MEMBER SINCE, which made
   a date that changes overnight with no user action look like a fact about
   the person. It is not, so it no longer says so: the word is PRINTED, the
   value is dimmed to BONE_MID so the two row-derived cells read as the
   primary pair, and the sheet's footer says the same thing in words.
   The TIER comes from outside ('@/lib/tiers') and is THREE-WAY, because
   "not wired yet" and "could not read your record" are different facts:
   omitted prints the floor (rung one, true without reading anything), an
   explicit null prints "—" (a failed read must never look like a demotion —
   that law is written in tiers.js), and a value prints that rung. It is
   never "ELITE": no rung on this platform is named for someone else
   choosing you.

   THE MOTION IS AN ENHANCEMENT, NEVER A REQUIREMENT
   ─────────────────────────────────────────────────────────────────────────
   Pointer tilt (mouse, pen, and a finger dragging on the card) is the base
   behaviour. The gyroscope is a bonus that has to be ASKED for on iOS 13+
   (DeviceOrientationEvent.requestPermission, user gesture, HTTPS only) and
   silently does not exist elsewhere. prefers-reduced-motion kills both —
   the listener is never even attached, not merely the transition — and the
   card lands flat, composed and complete. Same obligation Atmosphere already
   carries for the parallax (Atmosphere.jsx:274-279): gate the LISTENER, not
   just the animation, and promote a layer only while it actually animates.

   PERFORMANCE: transform and opacity only. The pointer rect is measured on
   enter and re-measured only after something could have moved it (resize, or
   a scroll anywhere up the tree) — never per frame. A getBoundingClientRect()
   inside a pointermove is a forced reflow, and it would also read the card's
   OWN tilted box and feed the tilt back into itself. The card does no work at
   all while it is closed — IdentityCardSheet returns null and nothing below
   it mounts.

   ⚠ THE 3D IS FRAGILE IN ONE SPECIFIC WAY: `overflow` other than `visible`
   on an element forces `transform-style: flat`, which would collapse every
   depth layer onto one plane. So the CARD keeps preserve-3d and clips
   nothing; a separate absolutely-positioned "field" div does the clipping
   for the flat texture layers only (raster, watermark, sweep, glare). If
   someone ever puts overflow:hidden on the card element itself, the depth
   silently dies and nothing errors. That is the trap; it is written down.
   ========================================================================= */

/* THE FLOOR — the name of rung one, read ONLY when the card is not wired to
   the ladder at all. TIERS[0] is the rung whose requirement list is empty,
   so everyone clears it vacuously and nobody can stand below it.

   IMPORTED, not copied. This was a literal 'ARRIVED' with a note saying "if
   the rung is ever renamed there, rename it here" — which is integrity kept
   by MEMORY, the one thing this codebase does not allow (CLAUDE.md §4).
   Rename rung 0 in tiers.js and the card would have gone on printing a rung
   that no longer exists, silently. The ladder module ships in this same
   branch and StatusSheet already imports it, so the dependency costs nothing
   and the copy can no longer drift. The literal survives only as a last
   guard: a shape change in tiers.js must never make the card print
   `undefined` where a rung name goes. */
const TIER_FLOOR = TIERS?.[0]?.name || 'ARRIVED'

/* The design series of the artifact itself, not a claim about the person.
   This is the first identity card the platform has ever printed; when the
   art changes, this becomes 02. Catalog numbering as texture (Cosmos). */
const SERIES = '01'

/* Tilt envelope. Small on purpose — a card that swings 25° reads as a toy.
   Nine degrees is a card being angled to catch a light, which is the whole
   gesture we are imitating. */
const MAX_ROT_Y = 9.5
const MAX_ROT_X = 7

/* Damped, no bounce-fest: ζ ≈ 1.02 (damping / 2√(stiffness·mass)). It settles
   without overshoot and, because everything is a motion value, a new pointer
   sample interrupts it mid-flight instead of queueing behind it. */
const SPRING = { stiffness: 160, damping: 20, mass: 0.6, restDelta: 0.0005 }

/* THE GLOSS. White for the highlight, --shadow-rgb for the two flanks that
   frame it. Neither can be a plain --ink/--void veil: by day a void veil
   LIGHTENS the paper, so the flanks would vanish exactly where the card is
   brightest and the lamination would stop reading. --shadow-rgb is the one
   channel that means "darker than this surface" in both registers. */
const SWEEP = 'linear-gradient(102deg, transparent 20%, rgba(var(--shadow-rgb),.12) 36%, rgba(255,255,255,.12) 45%, rgba(255,255,255,.36) 50%, rgba(255,255,255,.12) 55%, rgba(var(--shadow-rgb),.12) 64%, transparent 80%)'
const GLARE = 'radial-gradient(circle at 50% 50%, rgba(255,255,255,.22) 0%, rgba(255,255,255,.055) 38%, transparent 66%)'

/* El grabado de seguridad. Dos tramas cruzadas a pasos COPRIMOS (7 y 11):
   con pasos que comparten divisor sale muaré, y el muaré sobre una tarjeta
   pequeña lee como un artefacto de compresión, no como papel grabado. */
const GUILLOCHE = [
  'repeating-linear-gradient(112deg, rgba(var(--ink-rgb),.030) 0 1px, transparent 1px 7px)',
  'repeating-linear-gradient(64deg, rgba(var(--ink-rgb),.020) 0 1px, transparent 1px 11px)',
].join(', ')

/* ── derivations ─────────────────────────────────────────────────────── */

/* Same initial logic the museum uses (ProfileMuseum:672-673), extended to a
   second letter when there is a second word — plus two guards the museum
   does not need because it only ever prints ONE character at body scale and
   this prints two at the size of the whole plate:

   · `[...s][0]` and not `s[0]`. charAt would cut an astral character in half
     and render a replacement glyph on the most prominent element of the card.
   · WORDS THAT START WITH A LETTER OR DIGIT WIN. Display names that open with
     an emoji or a decorative bullet are common, and "🎧 Nightshift" reduced
     to "🎧N" is not a monogram, it is a mistake. Fall back to the raw first
     grapheme only when there is nothing alphanumeric at all — that person
     still gets THEIR character, not an invented letter. */
function initialsOf(fullName, username) {
  const src = String(fullName || username || '').trim()
  if (!src) return '◇'                                    // no name → a mark, never an invented letter
  const parts = src.split(/\s+/).filter(Boolean)
  const worded = parts.filter((w) => /^[\p{L}\p{N}]/u.test(w))
  const use = worded.length ? worded : parts
  const first = [...use[0]][0] || ''
  const last = use.length > 1 ? ([...use[use.length - 1]][0] || '') : ''
  return (first + last).toUpperCase()
}

/* FNV-1a, 32-bit. Math.imul keeps the multiply in int32 — a plain `*` would
   go through a double and lose the low bits, which makes the hash
   non-deterministic across engines. */
function fnv1a(str, seed = 0x811c9dc5) {
  let h = seed >>> 0
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h >>> 0
}

/* THE CARD NUMBER IS DERIVED, NOT RANDOM AND NOT SECRET.

   It is a hash of profiles.id, so it is stable: the same person gets the
   same number on every device, forever, with nothing stored anywhere. It
   carries strictly LESS information than the uuid it comes from — and that
   uuid is already public in the /user/:id URL — so it grants nobody
   anything. It is a serial on an object, in the same way the folio numeral
   on the museum's closing mark is.

   Twelve DECIMAL digits on purpose. An invite code is `C4-XXXX-XXXX`
   (earlyAccess.js) and a card number that rhymed with one would eventually
   be typed into la puerta by someone who thought it was their way in. Two
   different things must not look like the same thing. */
function cardNumberOf(id) {
  const src = String(id || '')
  if (!src) return null                                   // no id → no serial. We do not mint one.
  const a = fnv1a(src)
  const b = fnv1a([...src].reverse().join(''), 0x2545f491)
  // < 10^12, comfortably inside 2^53 — no float rounding on the join
  return String((a % 1e6) * 1e6 + (b % 1e6)).padStart(12, '0')
}

const groupNumber = (n) => (n ? n.replace(/(\d{4})(?=\d)/g, '$1 ') : '')

/* THE BARCODE GENUINELY ENCODES THE NUMBER — it is not noise shaped like a
   barcode. Each digit contributes four modules whose widths are its four
   bits (bar, space, bar, space), between two guard patterns. What it is NOT
   is a scannable symbology: it is not Code 128, no reader will resolve it,
   and it is never presented as scannable. The only scannable code in this
   app is the ticket QR on /profile, which comes from a real tickets row. */
function barsFrom(digits) {
  const bars = []
  let x = 0
  const push = (w, on) => { if (on) bars.push({ x, w }); x += w }
  push(1, true); push(1, false); push(1, true); push(2, false)          // opening guard
  for (const ch of digits) {
    const d = Number(ch)
    for (let b = 0; b < 4; b++) push(((d >> b) & 1) ? 2 : 1, b % 2 === 0)
    push(1, false)
  }
  push(1, true); push(1, false); push(1, true)                          // closing guard
  return { bars, total: x }
}

const fmtSince = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()
}
/* Assembled by hand instead of one toLocaleDateString call: the en-US short
   form is "Jul 21, 2026" and a comma in the middle of a data cell reads as a
   sentence, not as a stamped field. Only the month name is delegated. */
const fmtPrinted = (d) => `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`

/* ⚠ OMITTED AND NULL ARE NOT THE SAME THING, and collapsing them would break
   a law written in '@/lib/tiers':

     "an unknown status must render as absence, never as ARRIVED, or a read
      failure would quietly demote everyone who looked at it"  (tierNameOf)

   So the prop is three-way, and the distinction is the whole point:

     · omitted (undefined) → the card is NOT wired to the ladder yet. Print
       the floor. Nobody can stand below rung one, so the floor is the one
       name that is true without reading anything.
     · null                → the caller HAS the ladder and it could not read
       the record. Print "—". A failed read must never look like a demotion.
     · string | object     → that rung.

   Liberal about the object because the ladder owns the shape: a tiers.js
   rung ({name, index, …}), a whole fetchMyStatus record ({status:{tier}}),
   or anything with a name-ish key. `index` is 0-BASED in tiers.js (ARRIVED
   is 0), so the display adds one — 'FIXED STAR' is rung 05 of 05, not 04.
   `total` is not on a tiers.js rung; pass it explicitly (TIERS.length) or
   the fraction simply does not render.

   ⚠ THE FOOTGUN THAT COMES WITH A THREE-WAY PROP: the obvious inline form,
   `tier={status?.tier?.name}`, evaluates to UNDEFINED on a failed read —
   which lands on the "not wired yet" branch and prints the floor. That is
   the quiet demotion tiers.js forbids, arrived at through optional chaining
   instead of through a bug. Callers that HAVE the ladder must coalesce:
   `tier={status?.tier ?? null}`. Settings.jsx passes an explicit `null` and
   is correct. undefined is reserved for "this caller does not know the
   ladder exists", and nothing else. */
function readTier(tier) {
  if (tier === undefined) return { name: TIER_FLOOR, index: null, total: null, unknown: false }
  if (tier === null) return { name: '—', index: null, total: null, unknown: true }
  if (typeof tier === 'string') {
    const s = tier.trim()
    return { name: s || TIER_FLOOR, index: null, total: null, unknown: false }
  }
  const t = tier.status?.tier || tier.tier || tier         // a status record, or a rung
  const name = t?.name || t?.label || t?.title || t?.key
  if (!name) return { name: '—', index: null, total: null, unknown: true }
  const rawIndex = t.index ?? t.tierIndex ?? tier.tierIndex ?? null
  const total = t.total ?? tier.total ?? null
  return {
    name: String(name).trim(),
    index: typeof rawIndex === 'number' ? rawIndex : null,
    total: typeof total === 'number' ? total : null,
    unknown: false,
  }
}

/* ── gyroscope ───────────────────────────────────────────────────────── */

/* 'none'   → the device has no orientation API at all (every laptop)
   'gated'  → iOS 13+: exists, but requires requestPermission() from a real
              user gesture, over HTTPS. Never call it on mount.
   'open'   → Android/older: the event just works once you subscribe. */
function gyroKind() {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return 'none'
  return typeof window.DeviceOrientationEvent.requestPermission === 'function' ? 'gated' : 'open'
}
const coarsePointer = () => typeof window !== 'undefined'
  && window.matchMedia?.('(pointer: coarse)').matches

/* Degrees of DEVICE tilt that map to the card's full deflection. ±22° is
   about as far as a wrist rolls while you are looking at the screen; wider
   and most of the range is unreachable, narrower and the card slams into
   its stops on every micro-movement. */
const GYRO_RANGE = 44

/* Read synchronously, not from a hook alone: framer's useReducedMotion has
   returned null before its listener initialised in some versions, and `!null`
   is `true` — i.e. the failure would land on the side that TURNS THE MOTION
   ON for the person who asked for none. The wrong-side failure is the only
   one that matters here, so the media query answers directly when the hook
   is not yet sure. */
const REDUCED = () => typeof window !== 'undefined'
  && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* =========================================================================
   THE CARD
   ========================================================================= */
// no default on `tier` on purpose — undefined and null mean different things
// here, and `tier = null` would erase the distinction (see readTier)
export default function IdentityCard({ profile, tier, width, interactive = true }) {
  const wide = useWide()
  const reducedHook = useReducedMotion()
  const reduced = reducedHook ?? REDUCED()

  /* NOMINAL width. Every internal dimension is a multiple of u = W/100, the
     way a printed object is specified — one layout, two sizes, nothing
     re-tuned by hand. The box is `min(W, 100%)`, so on a narrower screen the
     die-cut shrinks but u does NOT: u is pinned to the nominal W.

     ⚠ WHICH MEANS THE BOX CAN GET SHORTER THAN ITS CONTENT. The bands need
     ~59.3u ≈ 185px of height (the budget below); the sheet's own chrome eats
     ~55px of viewport width on a phone, so the box is (vw − 55) / 1.5862
     tall. Break-even is around vw = 348. At 360 there is ~7px of slack; a
     320px-class device spills ~18px past the die-cut, and the card cannot
     clip (see the header). Documented, not fixed: fixing it means deriving u
     from the MEASURED width, i.e. a ResizeObserver and a render pass, and
     320px CSS-width phones are effectively none of this audience. If that
     ever changes, that is the fix — not shrinking the bands. */
  const W = width || (wide ? 392 : 312)
  const u = W / 100
  const px = (n) => `${(n * u).toFixed(2)}px`

  /* ⚠ THE VERTICAL BUDGET IS THE TIGHT CONSTRAINT OF THIS FILE, and it has
     no safety net: the card CANNOT clip (overflow would kill the 3D — see
     the header), so anything that does not fit spills outside the die-cut in
     plain view. An ID-1 card is 1.5862 wide for every 1 tall, so at u=W/100
     the interior is 63.04u tall minus 2·PAD, and the five bands have to live
     inside it. Measured, in u:

       padding      4.8 × 2                              =  9.6
       top rail     2.6 (lineHeight 1)                   =  2.6
       identity     GAP 3.6 + plate 15.0                 = 18.6
       star chart   GAP_SM 3.2 + marks 2.1               =  5.3
       data         GAP_SM 3.2 + 2.38 + 2.0 + 3.15       = 10.7
       stripe       3.0 + hairline + tallest column 9.2  = 12.5
                                                    total ≈ 59.3 of 63.04

     (the stripe's two columns are close on purpose — barcode+serial 9.2u,
     signature 9.1u — so whichever wins, the band does not move.)

     ~3.7u of slack, and it sits between the data row and the stripe because
     the stripe is pinned with marginTop:auto. Spend it and the card leaks.
     If a band has to grow, take it from another band, not from the slack. */
  const PAD = 4.8
  const GAP = 3.6        // between the rail and the identity block
  const GAP_SM = 3.2     // between every band after that

  /* The depth layers, in the same u so the parallax is proportional at both
     sizes — the perspective scales with the card (see the stage below), so a
     fixed pixel depth would flatten the wide card relative to the phone. The
     portrait plate is highest: on a real laminated card the photo is the
     layer nearest your eye, under the film. */
  const zt = (n) => `translateZ(${(n * u).toFixed(2)}px)`

  const p = profile || {}
  const fullName = String(p.full_name || '').trim()
  const displayName = fullName || 'UNNAMED'          // the museum's own word for a nameless row
  const username = String(p.username || '').trim()   // '' and null are the same thing here
  const avatar = safeImg(p.avatar_url)
  const initials = initialsOf(fullName, username)
  const t = readTier(tier)
  const serial = cardNumberOf(p.id)
  const code = useMemo(() => (serial ? barsFrom(serial) : null), [serial])

  /* PRINTED, not ISSUED — and the word is the whole fix.

     There is no issuance row anywhere in the database, so this cell traces
     to a clock and not to a column. Called ISSUED, in the same label/value
     grammar as MEMBER SINCE, it read as a fact about the PERSON: two members
     who joined the same day would see different ISSUED dates, and the same
     member would get a different one tomorrow with no action in between. A
     credential that contradicts its own previous copy is not a credential.
     Called PRINTED it is simply true — this copy was printed now — and it
     is the honest property of an object you mint on demand.
     Frozen at mount so it cannot change under a re-render. */
  const [printedAt] = useState(() => new Date())

  /* ── the tilt rig ──────────────────────────────────────────────────── */
  // -0.5 … 0.5 across the card, from pointer or gyro. Hooks are unconditional;
  // under reduced motion nothing ever writes to them, so the whole rig costs
  // two idle numbers and never schedules a frame.
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const lift = useMotionValue(0)

  const sx = useSpring(mx, SPRING)
  const sy = useSpring(my, SPRING)
  const sLift = useSpring(lift, SPRING)

  /* THE FACE TURNS TOWARD THE POINTER. rotateY(+) pushes the right edge AWAY
     (x' = x·cosθ + z·sinθ, z' = −x·sinθ), so facing a pointer on the right
     needs a NEGATIVE rotateY; rotateX(+) brings the bottom forward, so a
     pointer BELOW the centre needs a positive rotateX. Not a coin flip:
     the specular has to land under the cursor, because a highlight that
     runs away from your hand reads as a bug in the physics. */
  const rotY = useTransform(sx, (v) => -v * 2 * MAX_ROT_Y)
  const rotX = useTransform(sy, (v) => v * 2 * MAX_ROT_X)
  // NOT named `z`: the style key below is also `z`, and `z: live ? z : 0`
  // reads like a self-reference to anyone skimming it.
  const liftZ = useTransform(sLift, [0, 1], [0, 14])      // the card rises to meet you

  // the sweep travels with the tilt and brightens with its magnitude
  const sweepX = useTransform(sx, [-0.5, 0.5], ['-30%', '30%'])
  const sweepOp = useTransform([sx, sy], ([a, b]) => {
    const m = Math.min(1, (Math.abs(a) + Math.abs(b)) * 1.9)
    return 0.34 + m * 0.5
  })
  // the glare is a fixed radial pane that gets TRANSLATED, never a
  // background-position rewritten every frame: transform only, one raster
  const glareX = useTransform(sx, [-0.5, 0.5], ['-34%', '34%'])
  const glareY = useTransform(sy, [-0.5, 0.5], ['-30%', '30%'])
  // the cast shadow slides the other way, like a real object over a table
  const shadX = useTransform(sx, (v) => v * -20)
  const shadY = useTransform(sy, (v) => v * -12)

  const live = interactive && !reduced

  /* The card's box, measured on ENTER and on resize. Never inside the move
     handler: that is a forced reflow every frame, and worse, it would read
     the card's already-tilted rect and feed the tilt back into itself. */
  const boxRef = useRef(null)
  const rect = useRef(null)
  /* a REF and not state: the pointer handler has to read "is the gyro
     driving?" at event time, and re-rendering the whole card to answer that
     question would be a re-render on every permission flip for nothing.

     ⚠ IT MEANS "A SENSOR HAS ACTUALLY REPORTED", NOT "WE SUBSCRIBED". Those
     are different facts and confusing them killed the card: it used to be
     set at subscribe time, so on every device where `kind === 'open'`
     (coarse pointer + DeviceOrientationEvent present + no permission gate)
     the pointer path hard-returned from mount — and if no sensor ever fired,
     nothing ever drove the card. Chrome's device emulation satisfies all
     three conditions and fires zero events unless you switch the sensor
     override on by hand, which is precisely the path a founder QAs from; the
     same is true of coarse-pointer machines with no accelerometer, and of
     any device that fires the event with a null beta. Now only a REAL sample
     claims the rig (see onTilt), so the pointer keeps the card alive until
     the gyro proves it exists. */
  const gyroLive = useRef(false)
  const measure = useCallback(() => {
    const el = boxRef.current
    if (el) rect.current = el.getBoundingClientRect()
  }, [])

  useEffect(() => {
    if (!live) return undefined
    const stale = () => { rect.current = null }           // invalidate; re-measured on next move
    window.addEventListener('resize', stale, { passive: true })
    /* CAPTURE, because scroll does not bubble. The card lives inside
       GlassSheet's own `overflowY:auto` pane, and scrolling that pane under a
       stationary cursor fires no pointerenter — so without this the tilt
       origin stays where the card USED to be and the highlight tracks a
       ghost. A capture listener on window sees scrolls from every ancestor. */
    window.addEventListener('scroll', stale, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', stale)
      window.removeEventListener('scroll', stale, { capture: true })
    }
  }, [live])

  const onPointerMove = (e) => {
    // gyro wins ONCE IT IS REALLY DRIVING: two inputs writing the same motion
    // value fight each other every frame and the card jitters between them
    if (!live || gyroLive.current) return
    if (!rect.current) measure()
    const r = rect.current
    if (!r || !r.width || !r.height) return
    // clamped a hair past the edge so approaching the card already moves it,
    // but the deflection can never exceed the envelope
    const nx = Math.max(-0.55, Math.min(0.55, (e.clientX - r.left) / r.width - 0.5))
    const ny = Math.max(-0.55, Math.min(0.55, (e.clientY - r.top) / r.height - 0.5))
    mx.set(nx); my.set(ny); lift.set(1)
  }
  const onPointerLeave = () => {
    if (!live || gyroLive.current) return
    mx.set(0); my.set(0); lift.set(0)
  }

  /* ── gyro (enhancement only) ───────────────────────────────────────── */
  const [gyro, setGyro] = useState('off')   // off | on | denied
  const kind = useMemo(() => (live && coarsePointer() ? gyroKind() : 'none'), [live])

  // Android and older iOS: no gate, so just subscribe. iOS 13+ waits for the
  // tap. Either way the listener only exists while the card is mounted.
  const gyroActive = live && (gyro === 'on' || (kind === 'open' && gyro !== 'denied'))

  useEffect(() => {
    if (!gyroActive) return undefined
    let base = null                                        // first sample = "flat", whatever way you hold it
    const onTilt = (e) => {
      const { beta, gamma } = e
      if (beta == null || gamma == null) return
      // ONLY HERE. Subscribing proves nothing; a reading does. Everything
      // above this line is still the pointer's card.
      gyroLive.current = true
      if (!base) base = { beta, gamma }
      // screen.orientation would swap these on a rotated phone; not corrected
      // on purpose — the card is a portrait-held object and the correction
      // costs more than the case is worth.
      const nx = Math.max(-0.5, Math.min(0.5, (gamma - base.gamma) / GYRO_RANGE))
      const ny = Math.max(-0.5, Math.min(0.5, (beta - base.beta) / GYRO_RANGE))
      mx.set(nx); my.set(ny); lift.set(1)
    }
    window.addEventListener('deviceorientation', onTilt, { passive: true })
    return () => {
      window.removeEventListener('deviceorientation', onTilt)
      // settle home ONLY if the gyro was the one holding the card. If no
      // sample ever arrived, the pointer is still driving and yanking the
      // values to zero would snap the card out from under the cursor.
      if (gyroLive.current) {
        gyroLive.current = false
        mx.set(0); my.set(0); lift.set(0)
      }
    }
  }, [gyroActive, mx, my, lift])

  /* the sheet can be closed mid-permission-prompt (the iOS dialog is modal to
     the page, not to the app) — resolving after that would be a setState on
     an unmounted tree, so the answer is dropped instead.

     ⚠ THE `= true` IN THE BODY IS NOT REDUNDANT. main.jsx mounts the app in
     StrictMode, which in dev runs effect → cleanup → effect. Without the
     re-arm, the first cleanup would leave this false for the rest of the
     component's life and the gyro permission answer would be silently
     discarded — a bug that exists ONLY in development, i.e. only where we
     would be testing it. */
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const askGyro = useCallback(async () => {
    try {
      const res = await window.DeviceOrientationEvent.requestPermission()
      if (mounted.current) setGyro(res === 'granted' ? 'on' : 'denied')
    } catch {
      // no HTTPS, no gesture, no sensor — all the same outcome: fall back to
      // the pointer, which has been working this whole time.
      if (mounted.current) setGyro('denied')
    }
  }, [])

  /* ── type scale ────────────────────────────────────────────────────── */
  // the name is the chrome moment, so it gets the room it needs — and gives
  // room back when the name is long, instead of overflowing the plate
  const nameLen = displayName.length
  const nameSize = nameLen > 24 ? 6.3 : nameLen > 17 ? 7.6 : 9.4

  /* ⚠ BONE_MID AND NOT BONE_LOW, AND IT IS NOT TASTE — IT IS THE LIGHT AUDIT.
     BONE_LOW's AA margin was tuned against the PAGE (--bg #EDEBE6). This card
     is not the page: its background ends in `rgba(var(--shadow-rgb),.30)`, so
     by day the bottom-right corner sits at rgb(198,195,187), L=0.546 — and
     BONE_LOW on that is 3.43:1, under the 4.5:1 floor for normal text. At
     these sizes every label on the card was failing (≈3.4–4.0:1), and the
     one at the darkest corner was the SIGNATURE label. Dark theme passed at
     5.41:1, which is exactly why it would have shipped. BONE_MID is 5.56:1
     at that same worst corner and 6.6:1 up on the rail, and it stays
     comfortably secondary to the BONE values in both registers. Micro-print
     is the genre here; unreadable print is not. */
  const label = { fontFamily: FONT_MONO, fontSize: px(2.38), letterSpacing: '.2em', textTransform: 'uppercase', color: BONE_MID, lineHeight: 1 }
  const value = { fontFamily: FONT_MONO, fontSize: px(3.15), letterSpacing: '.06em', color: BONE, lineHeight: 1, marginTop: px(2), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(4) }}>
      {/* THE STAGE — perspective lives here, not on the card, so the card's
          own transform stays purely rotational and every depth layer shares
          one vanishing point. */}
      <div
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerEnter={measure}
        style={{
          /* 2.8× the card's own width. Flatter than that and 9.5° reads as a
             skew instead of a rotation; much tighter and the near corner
             balloons like a fisheye. */
          perspective: px(280), perspectiveOrigin: 'center',
          padding: px(3), width: '100%', display: 'flex', justifyContent: 'center',
        }}>
        <div ref={boxRef} style={{ position: 'relative', width: `min(${W}px, 100%)`, aspectRatio: '1.5862' }}>

          {/* the contact shadow — a soft pane, no filter: blur() would make
              this a grouping element and drop it out of the 3D context */}
          <motion.div aria-hidden="true" style={{
            position: 'absolute', left: '4%', right: '4%', top: '14%', bottom: '-12%',
            background: 'radial-gradient(ellipse at 50% 55%, rgba(var(--shadow-rgb),.50) 0%, rgba(var(--shadow-rgb),.22) 45%, transparent 72%)',
            x: shadX, y: shadY, pointerEvents: 'none',
          }} />

          <motion.div
            data-testid="identity-card"
            role="group"
            aria-label={`Identity card — ${displayName}`}
            style={{
              position: 'absolute', inset: 0,
              rotateX: live ? rotX : 0, rotateY: live ? rotY : 0, z: live ? liftZ : 0,
              transformStyle: 'preserve-3d',
              /* ⚠ NO overflow HERE. See the header: anything other than
                 `visible` forces transform-style:flat and every translateZ
                 below silently collapses onto one plane. */
              borderRadius: '10px',
              /* 10px is the Cosmos ceiling for a card and the card sits AT it,
                 deliberately: a credential's die-cut radius is its silhouette.
                 The ceiling, not an exception to it. */
              background: 'linear-gradient(148deg, rgba(var(--ink-rgb),.075) 0%, rgba(var(--ink-rgb),.018) 38%, rgba(var(--shadow-rgb),.30) 100%), var(--bg-deep)',
              border: `1px solid ${HAIR_HI}`,
              boxShadow: [
                'inset 0 1px 0 rgba(255,255,255,.14)',     // the lamination edge (white in both registers)
                'inset 0 -1px 0 rgba(var(--shadow-rgb),.4)',
                '0 26px 50px -18px rgba(var(--shadow-rgb),.62)',
                '0 6px 16px rgba(var(--shadow-rgb),.32)',
              ].join(', '),
              /* promoted only while it can actually move. A permanent
                 will-change on a layer that never animates is the documented
                 cause of the iPhone "sharp only while pinching" bug
                 (Atmosphere.jsx:877-884). */
              willChange: live ? 'transform' : 'auto',
              display: 'flex', flexDirection: 'column',
              padding: px(PAD),
            }}>

            {/* ── THE FIELD: the only clipped box. Flat texture only. ──── */}
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '10px', overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', inset: 0, background: GUILLOCHE }} />

              {/* the ghost monogram — the museum's own gesture (its initial
                  at opacity .05), bleeding off the die-cut like a watermark */}
              <div style={{
                position: 'absolute', right: px(-4), bottom: px(-16),
                fontFamily: FONT_DISPLAY, fontSize: px(64), lineHeight: 0.8,
                letterSpacing: '.01em', color: BONE, opacity: 0.055,
              }}>{initials}</div>

              <motion.div style={{
                position: 'absolute', top: '-40%', bottom: '-40%', left: '-60%', width: '220%',
                background: SWEEP, x: live ? sweepX : 0, opacity: live ? sweepOp : 0.34,
              }} />
              <motion.div style={{
                position: 'absolute', left: '-35%', top: '-35%', width: '170%', height: '170%',
                background: GLARE, x: live ? glareX : 0, y: live ? glareY : 0,
              }} />
            </div>

            {/* ── TOP RAIL ─────────────────────────────────────────────── */}
            {/* lineHeight 1 on both, and it is load-bearing, not taste: DM
                Mono's normal leading is ~1.3, which would quietly spend a
                third of a band on air the budget above does not have. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: px(4), transform: zt(1.9) }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: px(2.6), lineHeight: 1, letterSpacing: '.3em', textTransform: 'uppercase', color: BONE_MID, whiteSpace: 'nowrap' }}>
                ◇&nbsp;&nbsp;The Collectiv4
              </div>
              {/* BONE_MID for the same reason as `label`: BONE_LOW measures
                  3.8:1 against the card's own surface by day. The rail keeps
                  its hierarchy through size and tracking, not through a
                  colour that only works at night. */}
              <div style={{ fontFamily: FONT_MONO, fontSize: px(2.38), lineHeight: 1, letterSpacing: '.24em', textTransform: 'uppercase', color: BONE_MID, whiteSpace: 'nowrap' }}>
                Series&nbsp;{SERIES}
              </div>
            </div>

            {/* ── IDENTITY ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: px(4), marginTop: px(GAP), minWidth: 0, transform: zt(6.4) }}>

              {/* the portrait plate — the photo if there is one, the initials
                  if there is not. Sits highest in Z: on a real card the photo
                  is the layer under the laminate, closest to your eye.
                  3:3.5 like a passport portrait, and it is the band's whole
                  height budget — the text column is sized to match it. */}
              <div style={{
                flexShrink: 0, width: px(12.9), height: px(15), borderRadius: '3px',
                overflow: 'hidden', border: `1px solid ${HAIR_HI}`,
                background: 'rgba(var(--ink-rgb),.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.10)',
              }}>
                {avatar
                  ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <span style={{ fontFamily: FONT_DISPLAY, fontSize: px(6.4), letterSpacing: '.02em', color: BONE, lineHeight: 1 }}>{initials}</span>}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: px(2.8), minWidth: 0 }}>
                  {/* THE one chrome moment of this screen (Ley 8) */}
                  <h3 style={{
                    ...chromeText, fontFamily: FONT_DISPLAY, fontWeight: 400,
                    fontSize: px(nameSize), lineHeight: 0.92, letterSpacing: '.02em',
                    margin: 0, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{displayName.toUpperCase()}</h3>
                  {p.verified && <VerifiedMark size={wide ? 17 : 14} style={{ marginBottom: px(0.8) }} />}
                </div>

                {/* no username → no line. We do not print a handle nobody has. */}
                {(username || p.is_demo) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: px(2.4), marginTop: px(2.2), minWidth: 0 }}>
                    {username && (
                      <span style={{ fontFamily: FONT_MONO, fontSize: px(2.9), lineHeight: 1.2, letterSpacing: '.05em', color: BONE_MID, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{username}
                      </span>
                    )}
                    {/* is_demo travels with the identity — a seed account's
                        card says so, on the card, not somewhere else */}
                    {/* 7 and not smaller: 7 is the smallest this flag runs
                        anywhere in the app (SeedMark's default is 7.5), and a
                        flag whose entire job is to be NOTICED does not get to
                        be the one element the micro-print rule shrinks. */}
                    <SeedPill is_demo={p.is_demo} size={7} />
                  </div>
                )}
              </div>
            </div>

            {/* ── THE STAR CHART ───────────────────────────────────────── */}
            <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: px(3), marginTop: px(GAP_SM), transform: zt(1.3) }}>
              <div style={{ flex: 1, borderTop: `1px solid ${HAIR}` }} />
              <div style={{ fontFamily: FONT_MONO, fontSize: px(2.1), letterSpacing: '.55em', color: FAINT, lineHeight: 1, paddingLeft: '.55em' }}>
                ●○✕△◇
              </div>
              <div style={{ flex: 1, borderTop: `1px solid ${HAIR}` }} />
            </div>

            {/* ── THE DATA ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: px(4), marginTop: px(GAP_SM), transform: zt(3.8) }}>
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <div style={label}>Tier</div>
                {/* BONE_MID, never BONE_LOW: same light-audit floor as the
                    labels. "unknown" still reads as secondary against the
                    BONE of a real rung — one step down, not one step under
                    the contrast minimum. */}
                <div style={{ ...value, color: t.unknown ? BONE_MID : BONE }}>
                  {t.name.toUpperCase()}
                  {/* +1: tiers.js indexes the ladder from 0 */}
                  {t.index != null && t.total != null && (
                    <span style={{ color: BONE_MID, letterSpacing: '.1em' }}>
                      {` ${String(t.index + 1).padStart(2, '0')}/${String(t.total).padStart(2, '0')}`}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <div style={label}>Member since</div>
                <div style={value}>{fmtSince(p.created_at)}</div>
              </div>
              {/* THE THIRD CELL IS ABOUT THE COPY, NOT ABOUT THE PERSON —
                  see the header. The word carries that, and BONE_MID carries
                  it again: the two cells that trace to a row are the primary
                  pair in BONE; the one that traces to a clock sits a step
                  behind them, where it belongs. */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <div style={label}>Printed</div>
                <div style={{ ...value, color: BONE_MID }}>{fmtPrinted(printedAt)}</div>
              </div>
            </div>

            {/* ── THE STRIPE: barcode + serial, signature on the right ─── */}
            <div style={{
              marginTop: 'auto', paddingTop: px(3), borderTop: `1px solid ${HAIR}`,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              gap: px(4), transform: zt(2.6),
            }}>
              <div style={{ minWidth: 0 }}>
                {code
                  ? (
                    <svg
                      aria-hidden="true" focusable="false"
                      width={px(43)} height={px(4.4)}
                      viewBox={`0 0 ${code.total} 10`} preserveAspectRatio="none"
                      style={{ display: 'block', color: BONE, opacity: 0.86 }}>
                      {code.bars.map((b, i) => (
                        <rect key={i} x={b.x} y="0" width={b.w} height="10" fill="currentColor" />
                      ))}
                    </svg>
                  )
                  : null}
                {/* one colour for both states: BONE_LOW on this surface is
                    3.4:1 by day, and "there is no number" is not a reason to
                    print an unreadable dash. Twelve digits versus a single —
                    is already the whole difference; it does not need a
                    contrast drop to say it. */}
                <div style={{ fontFamily: FONT_MONO, fontSize: px(2.8), lineHeight: 1, letterSpacing: '.16em', color: BONE_MID, marginTop: px(2), whiteSpace: 'nowrap' }}>
                  {serial ? groupNumber(serial) : '—'}
                </div>
              </div>

              {/* the signature strip. DM Sans italic is the app's own
                  hand-written register (the museum's pull-quote); there is no
                  script face in the house and importing one for a flourish
                  would be a whole font for one line.

                  It is the TYPESET name over the rule where a signature would
                  go — nobody has signed anything and the app captures no
                  signature, so this claims nothing a printed card does not
                  already claim by having the line at all. It is also the only
                  element deliberately left under the AA floor (BONE at .5 ≈
                  3.0:1 by day): a stamped-solid signature stops reading as a
                  signature, and the same name is on the same card at 15:1 as
                  the H1, so nothing is only available here. */}
              <div style={{ minWidth: 0, maxWidth: '44%', textAlign: 'right' }}>
                <div style={{
                  fontFamily: FONT_SANS, fontStyle: 'italic', fontSize: px(3.4), lineHeight: 1.15,
                  color: BONE, opacity: 0.5, paddingBottom: px(1.2),
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{fullName || username || '—'}</div>
                <div style={{ borderTop: `1px solid ${HAIR_HI}` }} />
                <div style={{ ...label, fontSize: px(2.2), marginTop: px(1.5) }}>Signature</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* THE TILT AFFORDANCE — only where a gyroscope has to be asked for.
          Ley 9: it never appears on a device that cannot honour it, and a
          refusal does not leave a dead button behind — it turns into the
          instruction for the thing that still works. */}
      {live && kind === 'gated' && gyro !== 'on' && (
        gyro === 'denied'
          ? (
            <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.24em', textTransform: 'uppercase', color: BONE_LOW, textAlign: 'center' }}>
              ◇&nbsp;&nbsp;Drag the card to tilt it
            </div>
          )
          : (
            <button type="button" className="pressable" onClick={askGyro}
              data-testid="identity-card-tilt"
              style={{
                background: 'none', border: `1px solid ${HAIR}`, borderRadius: '100px',
                padding: '7px 14px', cursor: 'pointer',
                fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.24em',
                textTransform: 'uppercase', color: BONE_MID,
              }}>
              ◇&nbsp;&nbsp;Tilt with your phone
            </button>
          )
      )}
    </div>
  )
}

/* =========================================================================
   THE PRESENTATION.

   GlassSheet, not a hand-rolled overlay. The card genuinely wants a dark
   stage — and it gets one: the sheet portals to <body> at z-10020 over a
   62%-void scrim, which IS a full-screen dark stage, and it brings escape,
   backdrop-close and focus return/restore already solved. Hand-rolling a
   second overlay to gain a black background we already have would mean
   re-implementing the focus contract from scratch, and that is the class of
   thing that rots.

   NO GLASS INSIDE THE GLASS: the card is an opaque laminated object with no
   backdrop-filter of its own, so nothing re-blurs the sheet. The 3D is safe
   inside the sheet's scroll pane too — `overflow:auto` on an ancestor clips
   a 3D context, it does not flatten it, and the stage's own padding keeps
   the tilted corners well inside the clip.

   `open` is the whole performance story: closed, this returns null, the card
   never mounts, no listener exists and no motion value is ever read.
   ========================================================================= */
export function IdentityCardSheet({ open, profile, tier, onClose }) {
  const wide = useWide()
  if (!open) return null
  return (
    <GlassSheet title="Identity" kicker="◇  The Collectiv4" onClose={onClose} wide={wide} maxWidth="486px">
      <div style={{ padding: wide ? '16px 12px 8px' : '14px 8px 6px' }}>
        <IdentityCard profile={profile} tier={tier} />

        {/* the one honest line under the object. It is not a disclaimer, it
            is the answer to the only questions the card raises — and the
            third sentence is not optional: the card has exactly one cell that
            is not drawn from a row, so a footer that stopped at "drawn from
            your profile" would be false for a third of the data band. */}
        <p style={{
          fontFamily: FONT_SANS, fontSize: '12.5px', lineHeight: 1.6, color: BONE_LOW,
          textAlign: 'center', margin: '22px auto 4px', maxWidth: '34ch',
        }}>
          Drawn from your profile. The number is derived from your account, the
          same every time — and it is not a secret. PRINTED is when you opened
          this copy, not a date on your record.
        </p>
      </div>
    </GlassSheet>
  )
}

/* =========================================================================
   THE TRIGGER — for the profile's topBar.

   Copies the Settings pill's recipe verbatim (Profile.jsx:253-258) so the
   two read as one pair of controls rather than two people's ideas. The glass
   is a FIRST blur here: the hero it floats over is transparent and no
   ancestor carries backdrop-filter, so glassControl() is the correct
   material and not a nested one.
   ========================================================================= */
export function IdentityCardButton({ onClick, label = 'Card' }) {
  return (
    <button onClick={onClick} aria-label="Your identity card" data-testid="identity-card-btn"
      style={{ ...glassControl(), borderRadius: '100px', padding: '6px 14px', color: SILVER, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: FONT_SANS, transition: 'border-color .2s' }}
      onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(var(--silver-rgb),.45)'}
      onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(var(--ink-rgb),0.22)'}>
      <Contact size={11} /> {label}
    </button>
  )
}
